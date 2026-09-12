"""
Brand & Compliance Agent (agents/compliance_agent.py)

Responsible for:
- Reviewing every drafted post before it can be scheduled or published
- Enforcing brand voice guidelines, FTC compliance, and truth-in-advertising
- Rejecting non-compliant posts with specific, actionable remediation issues

DUAL-LAYER SAFETY ARCHITECTURE:
1. Layer 1: Hard-coded deterministic rule engine.
   Scans for banned words, deceptive absolutes, and legal liability terms.
   Core safety rules NEVER rely solely on stochastic LLM behavior.
2. Layer 2: LLM semantic evaluation.
   Reviews nuanced tone mismatch, unsubstantiated implicit claims, and cultural sensitivity.
"""

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from agents.base_agent import BaseAgent
from bus.events import MessageType


class ComplianceReview(BaseModel):
    status: str = Field(description="'APPROVED' or 'REJECTED'")
    approved: bool
    risk_level: str = Field(description="'LOW', 'MEDIUM', or 'HIGH'")
    violations: List[str] = Field(default_factory=list)
    actionable_feedback: str
    deterministic_flags: List[str] = Field(default_factory=list)


COMPLIANCE_SYSTEM_PROMPT = """You are the Senior Brand & Compliance Officer at an advertising agency.
Your mission is to defend the brand against regulatory liability, false advertising, and tone erosion.

REVIEW CRITERIA:
1. Truth in Advertising: No absolute or unsubstantiated claims ('100% unbreakable', 'lasts forever', 'guaranteed').
2. Banned / Hype Terms: Deceptive or scam-like terminology ('miracle', 'foolproof', 'get rich', 'zero risk').
3. Channel Appropriateness: No aggressive hard-sell urgency on professional networks or community forums.
4. Tone & Integrity: Transparent, evidence-backed, and respectful of the audience.

If any violation exists:
- Set 'status' to 'REJECTED', 'approved' to false, and provide specific, actionable remediation steps.
- Explain precisely what text needs to change and why.
Output ONLY valid JSON conforming to the ComplianceReview schema.
"""


class ComplianceAgent(BaseAgent):
    # Hard-coded deterministic banned terms list (non-negotiable safety gate)
    BANNED_PATTERNS = [
        (r"\bguaranteed\b", "Contains banned absolute claim term 'guaranteed'."),
        (r"\bmiracle\b", "Contains deceptive marketing hype term 'miracle'."),
        (r"\bcure\b", "Contains prohibited medical/health claim term 'cure'."),
        (r"\bfoolproof\b", "Contains unverified absolute reliability claim 'foolproof'."),
        (r"\bget\s+rich\b", "Contains high-risk financial hype phrase 'get rich'."),
        (r"\b100%\s+risk-?free\b", "Contains deceptive advertising claim '100% risk-free'."),
        (r"\b100%\s+unbreakable\b", "Contains unsubstantiated physical claim '100% unbreakable'."),
        (r"\bcompetitor\s+(?:sucks|trash|garbage|lies)\b", "Contains disparaging competitor defamation."),
        (r"\buntested\b", "Contains admission of untested consumer safety."),
    ]

    def __init__(self, llm_client=None, bus=None):
        super().__init__(
            name="ComplianceAgent",
            system_prompt=COMPLIANCE_SYSTEM_PROMPT,
            temperature=0.1,  # Strict, low temperature for deterministic compliance
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )

    def _run_deterministic_checks(self, text: str) -> List[str]:
        """Layer 1: Deterministic regex scan of text for banned terms."""
        violations = []
        for pattern, description in self.BANNED_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(description)
        return violations

    def review_post(
        self,
        post_copy: str,
        channel: str,
        campaign_name: str,
        post_id: Optional[str] = None,
        campaign_id: Optional[str] = None,
        week_number: Optional[int] = None,
    ) -> ComplianceReview:
        """
        Evaluate post against both deterministic hard rules and LLM semantic checks.
        """
        # 1. Deterministic Layer
        det_violations = self._run_deterministic_checks(post_copy)

        # 2. LLM Semantic Layer
        context = {
            "post_copy": post_copy,
            "channel": channel,
            "campaign_name": campaign_name,
            "has_deterministic_violations": len(det_violations) > 0,
        }

        prompt = (
            f"CAMPAIGN: {campaign_name}\n"
            f"CHANNEL: {channel}\n"
            f"POST COPY UNDER REVIEW:\n\"{post_copy}\"\n\n"
            f"DETERMINISTIC SCAN FLAGS: {det_violations if det_violations else 'None'}\n\n"
            "TASK: Evaluate this post thoroughly. If deterministic flags are present or if the copy "
            "violates brand voice or makes unverified claims, issue a REJECTED decision with specific "
            "actionable feedback for the copywriter."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=ComplianceReview,
            context=context,
        )

        review_data = resp.parsed_json or {}
        review = ComplianceReview(**review_data)

        # Merge deterministic findings to ensure zero bypass
        if det_violations:
            review.approved = False
            review.status = "REJECTED"
            review.risk_level = "HIGH"
            for dv in det_violations:
                if dv not in review.violations:
                    review.violations.append(dv)
            review.deterministic_flags = det_violations
            if "Remove" not in review.actionable_feedback:
                review.actionable_feedback = (
                    f"Deterministic safety gate triggered: {'; '.join(det_violations)}. "
                    + review.actionable_feedback
                )

        # Publish result to message bus
        msg_type = (
            MessageType.COMPLIANCE_APPROVAL
            if review.approved
            else MessageType.COMPLIANCE_REJECTION
        )

        self._publish(
            recipient="ContentWriterAgent" if not review.approved else "SchedulerAgent",
            message_type=msg_type,
            payload=review.model_dump(),
            campaign_id=campaign_id,
            week_number=week_number,
            post_id=post_id,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
            metadata={"approved": review.approved, "violations_count": len(review.violations)},
        )

        return review
