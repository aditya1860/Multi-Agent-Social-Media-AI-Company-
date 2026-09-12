"""
Community Manager Agent (agents/community_manager_agent.py)

Responsible for:
- Monitoring incoming audience comments on published posts
- Drafting empathetic, brand-aligned replies to user questions and feedback
- Safeguarding the brand by instantly escalating high-risk matters to humans

DUAL-LAYER ESCALATION ARCHITECTURE:
1. Layer 1: Hard-coded deterministic keyword escalation gate.
   Monitors for legal, medical, safety, refund, and scam triggers
   (e.g., 'refund', 'lawsuit', 'unsafe', 'injury', 'scam', 'toxic').
   Immediate escalation to human operator with ZERO automated reply.
2. Layer 2: LLM semantic triage.
   Evaluates tone, intent, nuance, and crafts tailored responses for safe comments.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from agents.base_agent import BaseAgent
from bus.events import MessageType
from mock_platform.database import PlatformDatabase
from mock_platform.models import CommentRecord, PostCommentRequest


class CommentTriageDecision(BaseModel):
    action: str = Field(description="'REPLY' or 'ESCALATE'")
    escalate_to_human: bool
    urgency: str = Field(description="'LOW', 'MEDIUM', or 'HIGH'")
    sentiment: str = Field(description="'positive', 'neutral', or 'negative'")
    escalation_reason: Optional[str] = None
    draft_reply: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_triage(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if "comment_triage_decision" in data and isinstance(data["comment_triage_decision"], dict):
            data = {**data["comment_triage_decision"], **{k: v for k, v in data.items() if k != "comment_triage_decision"}}

        action = str(data.get("action", "")).upper()
        if "ESCALAT" in action:
            action = "ESCALATE"
        else:
            action = "REPLY"
        data["action"] = action

        if "escalate_to_human" not in data or data["escalate_to_human"] is None:
            data["escalate_to_human"] = (action == "ESCALATE")
        elif isinstance(data["escalate_to_human"], str):
            data["escalate_to_human"] = data["escalate_to_human"].lower() in ("true", "1", "yes")
        else:
            data["escalate_to_human"] = bool(data["escalate_to_human"])

        urgency = str(data.get("urgency", "LOW")).upper()
        if "HIGH" in urgency:
            data["urgency"] = "HIGH"
        elif "MED" in urgency:
            data["urgency"] = "MEDIUM"
        else:
            data["urgency"] = "LOW"

        if not data.get("sentiment"):
            data["sentiment"] = "neutral"

        return data


COMMUNITY_SYSTEM_PROMPT = """You are the Senior Community Manager and Customer Advocate for the brand.
Your responsibility is to foster authentic, respectful audience relationships and protect user safety.

ESCALATION MANDATE:
- You must NEVER attempt to resolve legal threats, refund demands, product injuries, safety defects,
  or scam accusations autonomously.
- If a comment mentions or implies risk (e.g. fire, burn, hazard, refund, lawsuit, scam), immediately
  mark 'escalate_to_human' = true, action = 'ESCALATE', urgency = 'HIGH', and leave draft_reply null.

SAFE REPLIES:
- For product questions, express gratitude and provide clear, truthful, helpful answers.
- For praise, respond warmly without sounding robotic.
- Output strictly valid JSON matching the CommentTriageDecision schema.
"""


class CommunityManagerAgent(BaseAgent):
    RISK_KEYWORDS = [
        "refund",
        "lawsuit",
        "unsafe",
        "injury",
        "scam",
        "sue",
        "toxic",
        "hazard",
        "broken",
        "fire",
        "burn",
        "exploded",
        "danger",
        "hospital",
        "lawyer",
    ]

    def __init__(self, llm_client=None, bus=None, db: Optional[PlatformDatabase] = None):
        super().__init__(
            name="CommunityManagerAgent",
            system_prompt=COMMUNITY_SYSTEM_PROMPT,
            temperature=0.3,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )
        self.db = db or PlatformDatabase()

    def _check_hardcoded_risk(self, comment_text: str) -> Optional[str]:
        """Layer 1: Deterministic scan for critical safety/legal keywords with word boundaries."""
        import re
        text_lower = comment_text.lower()
        for kw in self.RISK_KEYWORDS:
            pattern = rf"\b{re.escape(kw)}\b"
            if re.search(pattern, text_lower):
                return kw
        return None

    def triage_comment(
        self,
        comment: CommentRecord,
        post_copy: str,
        channel: str,
        campaign_id: Optional[str] = None,
        week_number: Optional[int] = None,
    ) -> CommentTriageDecision:
        """Evaluate a comment and either draft a reply or escalate to a human."""
        # Check deterministic safety gate first
        detected_risk_kw = self._check_hardcoded_risk(comment.text)
        if detected_risk_kw:
            decision = CommentTriageDecision(
                action="ESCALATE",
                escalate_to_human=True,
                urgency="HIGH",
                sentiment="negative",
                escalation_reason=f"Deterministic escalation gate triggered by keyword: '{detected_risk_kw}'.",
                draft_reply=None,
            )

            self._publish(
                recipient="HumanGate",
                message_type=MessageType.COMMUNITY_ESCALATION,
                payload={
                    "comment_id": comment.comment_id,
                    "post_id": comment.post_id,
                    "author": comment.author,
                    "comment_text": comment.text,
                    "escalation_reason": decision.escalation_reason,
                    "urgency": "HIGH",
                },
                campaign_id=campaign_id,
                week_number=week_number,
                post_id=comment.post_id,
                metadata={"risk_keyword": detected_risk_kw},
            )
            return decision

        # Layer 2: LLM Triage & Reply Generation
        context = {
            "comment_text": comment.text,
            "channel": channel,
            "author": comment.author,
        }

        prompt = (
            f"CHANNEL: {channel}\n"
            f"POST CONTEXT: \"{post_copy[:200]}...\"\n"
            f"COMMENT FROM @{comment.author}: \"{comment.text}\"\n\n"
            "TASK: Triage this comment. If it poses brand or customer risk, escalate to human. "
            "Otherwise, draft a helpful, respectful, on-brand response."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=CommentTriageDecision,
            context=context,
        )

        decision_data = resp.parsed_json or {}
        decision = CommentTriageDecision(**decision_data)

        # Enforce escalation if LLM or hardcode decided
        if decision.escalate_to_human:
            self._publish(
                recipient="HumanGate",
                message_type=MessageType.COMMUNITY_ESCALATION,
                payload={
                    "comment_id": comment.comment_id,
                    "post_id": comment.post_id,
                    "author": comment.author,
                    "comment_text": comment.text,
                    "escalation_reason": decision.escalation_reason or "Escalated by Community Agent triage.",
                    "urgency": decision.urgency,
                },
                campaign_id=campaign_id,
                week_number=week_number,
                post_id=comment.post_id,
                token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
            )
        elif decision.draft_reply:
            # Post reply to platform
            reply_req = PostCommentRequest(
                author="EcoGlow Team",
                text=decision.draft_reply,
                is_agent_reply=True,
                parent_comment_id=comment.comment_id,
            )
            import uuid
            from datetime import datetime, timezone
            reply_record = CommentRecord(
                comment_id=f"comm_{uuid.uuid4().hex[:8]}",
                post_id=comment.post_id,
                author=reply_req.author,
                text=reply_req.text,
                created_at=datetime.now(timezone.utc).isoformat(),
                sentiment="positive",
                has_risk_keyword=False,
                risk_keyword=None,
                is_agent_reply=True,
                parent_comment_id=comment.comment_id,
            )
            self.db.insert_comment(reply_record)

            self._publish(
                recipient="MockPlatform",
                message_type=MessageType.COMMUNITY_TRIAGE,
                payload={
                    "post_id": comment.post_id,
                    "parent_comment_id": comment.comment_id,
                    "reply_text": decision.draft_reply,
                },
                campaign_id=campaign_id,
                week_number=week_number,
                post_id=comment.post_id,
                token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
            )

        return decision

    def moderate_week_comments(
        self,
        posts: List[Any],
        campaign_id: str,
        week_number: int,
        max_comments_per_post: int = 2,
    ) -> Dict[str, Any]:
        """Triage non-agent comments across all posts in a campaign week, prioritizing risk interception."""
        total_comments = 0
        escalated_count = 0
        replied_count = 0

        for post in posts:
            comments = self.db.get_comments_for_post(post.post_id)
            # Prioritize risk comments first, then sample up to max_comments_per_post
            risk_comms = [c for c in comments if c.has_risk_keyword and not c.is_agent_reply]
            safe_comms = [c for c in comments if not c.has_risk_keyword and not c.is_agent_reply]
            selected_comms = risk_comms + safe_comms[: max(1, max_comments_per_post - len(risk_comms))]

            for comm in selected_comms:
                total_comments += 1
                decision = self.triage_comment(
                    comment=comm,
                    post_copy=post.copy,
                    channel=post.channel,
                    campaign_id=campaign_id,
                    week_number=week_number,
                )
                if decision.escalate_to_human:
                    escalated_count += 1
                elif decision.draft_reply:
                    replied_count += 1

        return {
            "total_comments_reviewed": total_comments,
            "escalated_to_human": escalated_count,
            "replies_published": replied_count,
        }
