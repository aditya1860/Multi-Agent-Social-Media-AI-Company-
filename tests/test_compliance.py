"""
Unit tests for Brand & Compliance Agent and Safety Hard Cap
"""

import pytest
from agents.compliance_agent import ComplianceAgent
from agents.llm_client import LLMClient
from bus.events import AgentMessage, MessageType
from bus.message_bus import MessageBus


def test_deterministic_banned_words_detected():
    client = LLMClient(offline_mode=True)
    compliance = ComplianceAgent(llm_client=client)

    # Text containing multiple banned phrases
    bad_text = "This miracle solar lantern gives guaranteed 10X power and is 100% risk-free!"
    violations = compliance._run_deterministic_checks(bad_text)

    assert len(violations) >= 3
    assert any("guaranteed" in v for v in violations)
    assert any("miracle" in v for v in violations)
    assert any("100% risk-free" in v for v in violations)


def test_compliance_review_clean_copy():
    client = LLMClient(offline_mode=True)
    compliance = ComplianceAgent(llm_client=client)

    clean_text = "Compact solar lantern built with recycled ocean plastic. Recharges in 4 hours of daylight."
    review = compliance.review_post(clean_text, channel="short_form", campaign_name="EcoGlow")

    assert review.approved is True
    assert review.status == "APPROVED"
    assert len(review.violations) == 0


def test_compliance_review_banned_copy_rejected():
    client = LLMClient(offline_mode=True)
    compliance = ComplianceAgent(llm_client=client)

    banned_text = "Get our guaranteed unbreakable miracle lantern today!"
    review = compliance.review_post(banned_text, channel="short_form", campaign_name="EcoGlow")

    assert review.approved is False
    assert review.status == "REJECTED"
    assert len(review.violations) > 0
    assert "guaranteed" in review.actionable_feedback.lower() or "miracle" in review.actionable_feedback.lower()


def test_message_bus_hard_rejection_cap():
    import tempfile
    import os

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_trace.db")
        jsonl_path = os.path.join(tmpdir, "test_trace.jsonl")
        bus = MessageBus(db_path=db_path, jsonl_path=jsonl_path, verbose=False)

        test_post_id = "test_post_999"

        # Attempt 1
        msg1 = AgentMessage(
            sender="ComplianceAgent",
            recipient="ContentWriterAgent",
            message_type=MessageType.COMPLIANCE_REJECTION,
            payload={"feedback": "Fix claims"},
            post_id=test_post_id,
        )
        bus.publish(msg1)
        assert bus.is_post_permanently_rejected(test_post_id) is False
        assert bus.post_rejection_counts[test_post_id] == 1

        # Attempt 2
        msg2 = AgentMessage(
            sender="ComplianceAgent",
            recipient="ContentWriterAgent",
            message_type=MessageType.COMPLIANCE_REJECTION,
            payload={"feedback": "Still contains banned claim"},
            post_id=test_post_id,
        )
        bus.publish(msg2)
        assert bus.is_post_permanently_rejected(test_post_id) is False
        assert bus.post_rejection_counts[test_post_id] == 2

        # Attempt 3 (Hard Cap reached)
        msg3 = AgentMessage(
            sender="ComplianceAgent",
            recipient="ContentWriterAgent",
            message_type=MessageType.COMPLIANCE_REJECTION,
            payload={"feedback": "Third strike failed"},
            post_id=test_post_id,
        )
        bus.publish(msg3)
        assert bus.is_post_permanently_rejected(test_post_id) is True
        assert bus.post_rejection_counts[test_post_id] == 3
        assert msg3.metadata.get("permanently_excluded") is True


def test_all_risk_keywords_trigger_deterministic_escalation():
    """Verify that ALL defined safety/legal risk keywords trigger deterministic escalation 100% of the time."""
    from agents.community_manager_agent import CommunityManagerAgent
    from mock_platform.models import CommentRecord

    client = LLMClient(offline_mode=True)
    cm = CommunityManagerAgent(llm_client=client)
    risk_keywords = [
        "lawsuit",
        "refund",
        "unsafe",
        "injury",
        "scam",
        "toxic",
        "hazard",
        "sue",
        "fire",
        "burn",
        "hospital",
        "lawyer",
    ]

    for kw in risk_keywords:
        comment = CommentRecord(
            comment_id=f"comm_{kw}",
            post_id="post_test",
            author="concerned_user",
            text=f"Warning: this product caused an issue regarding {kw} on our trip!",
            created_at="2026-09-12T10:00:00Z",
            sentiment="negative",
            has_risk_keyword=True,
            risk_keyword=kw,
        )
        decision = cm.triage_comment(
            comment=comment,
            post_copy="Sample post copy",
            channel="community_forum",
        )
        assert decision.action == "ESCALATE", f"Failed to escalate keyword: {kw}"
        assert decision.escalate_to_human is True, f"Failed human escalation for keyword: {kw}"
        assert decision.urgency == "HIGH", f"Expected HIGH urgency for keyword: {kw}"
        assert decision.draft_reply is None, f"Expected no automated reply for keyword: {kw}"
        assert kw in decision.escalation_reason.lower()

