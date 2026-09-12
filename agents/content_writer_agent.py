"""
Content Writer Agent (agents/content_writer_agent.py)

Responsible for:
- Writing tailored copy adapted to specific channel personas (short_form, community_forum, professional)
- Generating compelling hooks, CTAs, and optimized hashtag sets
- Performing targeted line-item revisions based on explicit Compliance feedback
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from agents.base_agent import BaseAgent
from bus.events import MessageType


class ContentDraft(BaseModel):
    channel: str
    post_copy: str
    hook: str
    cta: str
    hashtags: List[str]
    tone: str
    cta_type: str = Field(description="'question', 'value', 'urgency', or 'soft'")
    format_type: str = "field_test"
    revision_notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_draft(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if "content_draft" in data and isinstance(data["content_draft"], dict):
            data = {**data["content_draft"], **{k: v for k, v in data.items() if k != "content_draft"}}

        # Normalize hashtags
        ht = data.get("hashtags")
        if isinstance(ht, str):
            data["hashtags"] = [t.strip() for t in ht.replace("#", " #").split() if t.strip()]
        elif not isinstance(ht, list):
            data["hashtags"] = ["#SolarTech", "#EcoGlow", "#OutdoorGear"]

        # Normalize post_copy
        post_copy = str(data.get("post_copy") or "")
        data["post_copy"] = post_copy

        if not data.get("hook"):
            data["hook"] = post_copy[:60] or "Discover EcoGlow"
        if not data.get("cta"):
            data["cta"] = "Join the waitlist today."
        if not data.get("tone"):
            data["tone"] = "authentic"
        if not data.get("cta_type"):
            data["cta_type"] = "question" if "?" in data.get("cta", "") else "value"
        if not data.get("format_type"):
            data["format_type"] = "field_test"
        if not data.get("channel"):
            data["channel"] = "short_form"
        return data


CONTENT_WRITER_SYSTEM_PROMPT = """You are an elite Senior Content Copywriter crafting social media posts.

CHANNEL PERSONALITIES:
1. 'short_form': Under 150 characters. Dynamic, punchy hook, lifestyle appeal. Avoid wordiness.
2. 'community_forum': 200-500 characters. Humble, authentic, engineering/technical nuance. End with a genuine open-ended question ending in '?' to invite discussion.
3. 'professional': 350-700 characters. Thought-leadership, structured analytical paragraphs, industry benchmarks. End with value-driven CTAs (e.g. research/discussion).

COMPLIANCE & QUALITY RULES:
- Never make unsubstantiated absolute claims (e.g. NEVER use 'guaranteed', 'miracle', 'foolproof', '100% risk-free').
- When revising, adhere strictly to the compliance officer's feedback. Modify only the targeted issues.
- Hashtags: Keep between 3 to 5 relevant tags. Never exceed 5 hashtags to avoid platform spam penalties.
- Output ONLY valid JSON matching the ContentDraft schema.
"""


class ContentWriterAgent(BaseAgent):
    def __init__(self, llm_client=None, bus=None):
        super().__init__(
            name="ContentWriterAgent",
            system_prompt=CONTENT_WRITER_SYSTEM_PROMPT,
            temperature=0.7,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )

    def draft_post(
        self,
        channel: str,
        content_pillar: str,
        campaign_name: str,
        week_number: int,
        day_of_week: int,
        strategy_guidelines: Optional[str] = None,
        campaign_id: Optional[str] = None,
    ) -> ContentDraft:
        """Generate an initial channel-specific post draft."""
        context = {
            "channel": channel,
            "content_pillar": content_pillar,
            "campaign_name": campaign_name,
            "week_number": week_number,
            "day_of_week": day_of_week,
        }

        prompt = (
            f"CAMPAIGN: {campaign_name}\n"
            f"CHANNEL: {channel}\n"
            f"CONTENT PILLAR: {content_pillar}\n"
            f"WEEK: {week_number} | DAY: {day_of_week}\n"
            f"STRATEGY GUIDELINES: {strategy_guidelines or 'Maintain standard brand voice'}\n\n"
            "TASK: Draft a high-performing post for this channel. Follow the optimal character length, "
            "hook style, and CTA preference for this specific platform. Keep hashtags to exactly 3-4 tags."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=ContentDraft,
            context=context,
        )

        draft_data = resp.parsed_json or {}
        draft = ContentDraft(**draft_data)

        self._publish(
            recipient="ComplianceAgent",
            message_type=MessageType.CONTENT_DRAFT,
            payload=draft.model_dump(),
            campaign_id=campaign_id,
            week_number=week_number,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
            metadata={"channel": channel, "day": day_of_week},
        )

        return draft

    def revise_post(
        self,
        original_draft: ContentDraft,
        compliance_feedback: str,
        campaign_id: Optional[str] = None,
        week_number: Optional[int] = None,
        post_id: Optional[str] = None,
    ) -> ContentDraft:
        """Perform a targeted rewrite in response to specific compliance objections."""
        context = {
            "channel": original_draft.channel,
            "revision_feedback": compliance_feedback,
            "week_number": week_number or 1,
        }

        prompt = (
            f"ORIGINAL POST DRAFT:\n{original_draft.model_dump_json(indent=2)}\n\n"
            f"COMPLIANCE REJECTION FEEDBACK:\n{compliance_feedback}\n\n"
            "TASK: Produce a TARGETED REVISION of this post. Address the exact issues identified by Compliance. "
            "Do NOT just generate random text; fix the banned terms, tone mismatch, or unsubstantiated claims "
            "while maintaining the core message and platform resonance."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=ContentDraft,
            context=context,
        )

        draft_data = resp.parsed_json or {}
        revised_draft = ContentDraft(**draft_data)

        self._publish(
            recipient="ComplianceAgent",
            message_type=MessageType.CONTENT_DRAFT,
            payload=revised_draft.model_dump(),
            campaign_id=campaign_id,
            week_number=week_number,
            post_id=post_id,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
            metadata={"is_revision": True},
        )

        return revised_draft
