"""
Unit tests for Mock Platform Engagement Engine Ground-Truth Hidden Rules
Verifies that all 8 deliberate hidden rules function deterministically.
"""

import pytest
from mock_platform.engagement_engine import EngagementEngine
from mock_platform.models import PostMetrics, PostRecord


def create_sample_post(
    channel="short_form",
    scheduled_time="19:30:00",
    copy="Compact solar lantern with 12 hour battery life.",
    hashtags=None,
    cta_type="value",
    format_type="field_test",
    day=1,
    week=1,
) -> PostRecord:
    hashtags = hashtags if hashtags is not None else ["#Solar", "#Eco", "#Gear"]
    return PostRecord(
        post_id="test_p1",
        campaign_id="test_camp",
        week_number=week,
        day_of_week=day,
        channel=channel,
        copy=copy,
        creative_brief={"cta": "Check link"},
        scheduled_time=scheduled_time,
        hashtags=hashtags,
        cta_type=cta_type,
        format_type=format_type,
        created_at="2026-09-12T12:00:00Z",
        metrics=PostMetrics(post_id="test_p1"),
        comments=[],
    )


def test_rule_1_timing_window_short_form():
    """Evening (19:30) must outperform morning (09:00) on short_form."""
    engine = EngagementEngine(seed=42)
    post_evening = create_sample_post(channel="short_form", scheduled_time="19:30:00")
    post_morning = create_sample_post(channel="short_form", scheduled_time="09:00:00")

    metrics_eve, _ = engine.simulate_post(post_evening, [])
    metrics_morn, _ = engine.simulate_post(post_morning, [])

    assert metrics_eve.impressions > metrics_morn.impressions
    assert metrics_eve.engagement_rate > metrics_morn.engagement_rate


def test_rule_1_timing_window_professional():
    """Morning (09:30) must outperform evening (20:00) on professional."""
    engine = EngagementEngine(seed=42)
    post_morning = create_sample_post(channel="professional", scheduled_time="09:30:00")
    post_evening = create_sample_post(channel="professional", scheduled_time="20:00:00")

    metrics_morn, _ = engine.simulate_post(post_morning, [])
    metrics_eve, _ = engine.simulate_post(post_evening, [])

    assert metrics_morn.impressions > metrics_eve.impressions
    assert metrics_morn.engagement_rate > metrics_eve.engagement_rate


def test_rule_2_question_cta_boosts_comments():
    """Question ending CTA must dramatically boost comments on community_forum."""
    engine = EngagementEngine(seed=42)
    post_question = create_sample_post(
        channel="community_forum",
        copy="We built an open-source solar lantern with modular cells. What gear do you rely on?",
        cta_type="question",
    )
    post_statement = create_sample_post(
        channel="community_forum",
        copy="We built an open-source solar lantern with modular cells. Read our complete specs here.",
        cta_type="value",
    )

    metrics_q, _ = engine.simulate_post(post_question, [])
    metrics_s, _ = engine.simulate_post(post_statement, [])

    assert metrics_q.comments_count > metrics_s.comments_count


def test_rule_3_inverted_u_hashtag_curve():
    """Optimal 3-5 tags must outperform 0 tags and severely outperform 9+ spam tags."""
    engine = EngagementEngine(seed=42)
    post_optimal = create_sample_post(hashtags=["#A", "#B", "#C", "#D"])
    post_zero = create_sample_post(hashtags=[])
    post_spam = create_sample_post(hashtags=[f"#Tag{i}" for i in range(10)])

    m_opt, _ = engine.simulate_post(post_optimal, [])
    m_zero, _ = engine.simulate_post(post_zero, [])
    m_spam, _ = engine.simulate_post(post_spam, [])

    assert m_opt.impressions > m_zero.impressions
    assert m_opt.impressions > m_spam.impressions
    assert m_opt.engagement_rate > m_spam.engagement_rate


def test_rule_4_copy_length_resonance():
    """Short-form prefers punchy short copy (<150) over wordy (>300)."""
    engine = EngagementEngine(seed=42)
    short_copy = "Ultralight solar lantern for trail runners."
    long_copy = "Ultralight solar lantern for trail runners. " * 10

    p_short = create_sample_post(channel="short_form", copy=short_copy)
    p_long = create_sample_post(channel="short_form", copy=long_copy)

    m_short, _ = engine.simulate_post(p_short, [])
    m_long, _ = engine.simulate_post(p_long, [])

    assert m_short.engagement_rate > m_long.engagement_rate


def test_rule_5_novelty_decay():
    """Consecutive posts with the exact same format_type trigger fatigue penalty."""
    engine = EngagementEngine(seed=42)
    p1 = create_sample_post(format_type="field_test")
    p2 = create_sample_post(format_type="field_test")

    # Post with fresh history vs post with consecutive same format history
    m1, _ = engine.simulate_post(p1, [])
    m2, _ = engine.simulate_post(p2, [p1])

    assert m1.engagement_rate > m2.engagement_rate


def test_rule_6_urgency_cta_penalty_on_professional():
    """Urgency sales CTAs trigger severe penalty and negative sentiment on professional."""
    engine = EngagementEngine(seed=42)
    p_urgency = create_sample_post(
        channel="professional",
        copy="ACT NOW! LIMITED TIME OFFER! Pre-order our lantern today!",
        cta_type="urgency",
    )
    p_value = create_sample_post(
        channel="professional",
        copy="Examining circular supply chains in portable outdoor electronics.",
        cta_type="value",
    )

    m_urg, _ = engine.simulate_post(p_urgency, [])
    m_val, _ = engine.simulate_post(p_value, [])

    assert m_val.engagement_rate > m_urg.engagement_rate
    assert m_val.sentiment_score > m_urg.sentiment_score


def test_rule_7_hype_buzzwords_reduce_sentiment():
    """Hype terms ('miracle', 'guaranteed') trigger negative sentiment bias."""
    engine = EngagementEngine(seed=42)
    p_hype = create_sample_post(copy="This miracle solar device gives guaranteed power.")
    p_clean = create_sample_post(copy="Tested on alpine trails for dependable power.")

    m_hype, _ = engine.simulate_post(p_hype, [])
    m_clean, _ = engine.simulate_post(p_clean, [])

    assert m_clean.sentiment_score > m_hype.sentiment_score


def test_rule_8_risk_keyword_comment_escalation():
    """Simulated comments on specific posts contain risk keywords flagged for escalation."""
    engine = EngagementEngine(seed=42)
    # Day 2, week 1 on community_forum is wired for risk injection
    post = create_sample_post(channel="community_forum", day=2, week=1)
    _, comments = engine.simulate_post(post, [])

    risk_comments = [c for c in comments if c.has_risk_keyword]
    assert len(risk_comments) >= 1
    assert risk_comments[0].risk_keyword in ["refund", "unsafe", "scam", "injury"]
