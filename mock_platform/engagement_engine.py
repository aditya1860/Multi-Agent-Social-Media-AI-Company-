"""
Mock Social Media Platform: Ground-Truth Engagement & Comment Simulation Engine

========================================================================================
DELIBERATE HIDDEN GROUND-TRUTH RULES (Documented for Analytics Verification)
========================================================================================
This engine simulates audience behavior deterministically based on empirical social dynamics.
A capable Analytics Agent should rediscover these exact patterns through grouped data analysis:

RULE 1: TIMING-WINDOW INTERACTION (T_factor)
- 'short_form': Peak audience active in the evening (17:00 - 21:59). Multiplier = 1.45.
  Morning (07:00 - 11:59) suffers algorithmic & viewer depression. Multiplier = 0.70.
- 'professional': Workday morning peak (08:00 - 11:59). Multiplier = 1.40.
  Evening / night (18:00+) suffers severe professional drop-off. Multiplier = 0.65.
- 'community_forum': Sustained afternoon/evening active window (13:00 - 20:59). Multiplier = 1.30.

RULE 2: QUESTION-ENDING CTA BONUS (Q_factor)
- Posts whose copy or CTA ends with a question mark ('?') prompt user comments:
  * 'community_forum': +120% comments (multiplier = 2.20), +30% shares.
  * 'short_form': +60% comments (multiplier = 1.60).
  * 'professional': +50% comments (multiplier = 1.50).

RULE 3: INVERTED-U HASHTAG SATURATION EFFECT (H_factor)
- N = 0 hashtags: Discovery penalty (multiplier = 0.65).
- N = 1-2 hashtags: Mild under-saturation (multiplier = 0.85).
- N = 3-5 hashtags: OPTIMAL SWEET SPOT (multiplier = 1.30).
- N = 6-7 hashtags: Clutter onset (multiplier = 0.90).
- N >= 8 hashtags: Algorithmic SPAM PENALTY (multiplier = 0.55 on reach, -40% engagement).

RULE 4: PER-CHANNEL COPY-LENGTH RESONANCE (L_factor)
- 'short_form': Optimal < 150 chars (multiplier = 1.35). If > 300 chars, severe drop (0.60).
- 'professional': Optimal 350-750 chars (multiplier = 1.40). Shallow < 180 chars suffers (0.65).
- 'community_forum': Optimal 200-550 chars (multiplier = 1.35). Low-effort < 150 chars suffers (0.70).

RULE 5: NOVELTY-DECAY / CONSECUTIVE FORMAT REPETITION (N_factor)
- Posting the exact same format_type on the same channel on consecutive days causes viewer fatigue:
  * 1st repeat: -20% engagement (multiplier = 0.80).
  * 2nd+ repeat: -40% engagement (multiplier = 0.60).

RULE 6: CTA-TYPE CHANNEL CONFLICT (C_factor)
- 'urgency' CTAs ('BUY NOW', 'LIMITED TIME OFFER'):
  * On 'professional': Severe backlash. Multiplier = 0.50, shifts comments heavily negative.
  * On 'short_form': Mild impulse clicks (multiplier = 1.10).
  * On 'community_forum': Perceived as spam (multiplier = 0.65).
- 'question' CTAs: Elevates sentiment and comment velocity across all channels.
- 'value' / 'soft' CTAs: Highest performance on 'professional' (multiplier = 1.35).

RULE 7: HYPE BIAS & SENTIMENT SKW
- Copy containing hype keywords ('guaranteed', 'miracle', '100% risk-free', 'foolproof', 'secret trick')
  reduces sentiment by -0.50 and shares by -40%, even if impressions spike slightly.

RULE 8: REALISTIC COMMENT SIMULATION & RISK INJECTION
- Generates 2-6 context-appropriate comments per post matching sentiment.
- ~12% of posts receive realistic customer queries containing high-risk keywords
  ('refund', 'unsafe', 'scam', 'injury', 'lawsuit') to test the Community Manager's escalation gate.
========================================================================================
"""

import math
import random
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from mock_platform.models import CommentRecord, PostMetrics, PostRecord


class EngagementEngine:
    """
    Deterministic simulation engine adhering strictly to documented hidden rules.
    """

    def __init__(self, seed: int = 42):
        # Controlled seed for reproducible testing
        self.rng = random.Random(seed)

    def simulate_post(
        self, post: PostRecord, channel_history: List[PostRecord]
    ) -> Tuple[PostMetrics, List[CommentRecord]]:
        """
        Simulate impressions, likes, shares, comments, clicks, and comment threads
        for a single post by evaluating all 8 hidden rules.
        """
        channel = post.channel
        copy_text = post.copy
        copy_len = len(copy_text)
        scheduled_hour = self._extract_hour(post.scheduled_time)
        hashtag_count = len(post.hashtags)
        has_question = "?" in copy_text or "?" in post.creative_brief.get("cta", "")
        cta_type = post.cta_type.lower()
        format_type = post.format_type.lower()

        # Baseline channel impressions
        base_impressions = {
            "short_form": 1200,
            "community_forum": 800,
            "professional": 1000,
        }.get(channel, 900)

        # Baseline engagement rate: 4.0%
        base_eng_rate = 0.040

        # --- RULE 1: Timing Window Interaction ---
        timing_factor = 1.0
        if channel == "short_form":
            if 17 <= scheduled_hour <= 21:
                timing_factor = 1.45  # Peak evening
            elif 7 <= scheduled_hour <= 11:
                timing_factor = 0.70  # Morning penalty
        elif channel == "professional":
            if 8 <= scheduled_hour <= 11:
                timing_factor = 1.40  # Morning workday peak
            elif scheduled_hour >= 18 or scheduled_hour < 6:
                timing_factor = 0.65  # After-hours penalty
        elif channel == "community_forum":
            if 13 <= scheduled_hour <= 20:
                timing_factor = 1.30  # Afternoon discussion peak
            elif scheduled_hour < 8:
                timing_factor = 0.85

        # --- RULE 2: Question-Ending CTA Bonus ---
        question_comment_boost = 1.0
        question_share_boost = 1.0
        if has_question:
            if channel == "community_forum":
                question_comment_boost = 2.20
                question_share_boost = 1.30
            elif channel == "short_form":
                question_comment_boost = 1.60
                question_share_boost = 1.15
            elif channel == "professional":
                question_comment_boost = 1.50
                question_share_boost = 1.20

        # --- RULE 3: Inverted-U Hashtag Curve ---
        hashtag_factor = 1.0
        if hashtag_count == 0:
            hashtag_factor = 0.65
        elif 1 <= hashtag_count <= 2:
            hashtag_factor = 0.85
        elif 3 <= hashtag_count <= 5:
            hashtag_factor = 1.30  # Optimal sweet spot
        elif 6 <= hashtag_count <= 7:
            hashtag_factor = 0.90
        else:  # >= 8 hashtags
            hashtag_factor = 0.55  # Spam suppression penalty

        # --- RULE 4: Per-Channel Copy-Length Resonance ---
        length_factor = 1.0
        if channel == "short_form":
            if copy_len < 150:
                length_factor = 1.35
            elif copy_len > 300:
                length_factor = 0.60
        elif channel == "professional":
            if copy_len < 180:
                length_factor = 0.65
            elif 350 <= copy_len <= 750:
                length_factor = 1.40
            elif copy_len > 750:
                length_factor = 0.80
        elif channel == "community_forum":
            if copy_len < 150:
                length_factor = 0.70
            elif 200 <= copy_len <= 550:
                length_factor = 1.35

        # --- RULE 5: Novelty Decay / Repetition Penalty ---
        novelty_factor = 1.0
        consecutive_repeats = 0
        for prev in reversed(channel_history):
            if prev.format_type.lower() == format_type:
                consecutive_repeats += 1
            else:
                break
        if consecutive_repeats == 1:
            novelty_factor = 0.80
        elif consecutive_repeats >= 2:
            novelty_factor = 0.60

        # --- RULE 6: CTA-Type Channel Conflict & Sentiment ---
        cta_factor = 1.0
        sentiment_bias = 0.0  # -1.0 to 1.0
        if cta_type == "urgency":
            if channel == "professional":
                cta_factor = 0.50  # B2B urgency backfire
                sentiment_bias -= 0.40
            elif channel == "short_form":
                cta_factor = 1.10
                sentiment_bias -= 0.10
            elif channel == "community_forum":
                cta_factor = 0.65
                sentiment_bias -= 0.35
        elif cta_type == "question":
            cta_factor = 1.20
            sentiment_bias += 0.25
        elif cta_type in ("value", "soft"):
            if channel == "professional":
                cta_factor = 1.35
                sentiment_bias += 0.20
            else:
                cta_factor = 1.15
                sentiment_bias += 0.15

        # --- RULE 7: Hype Buzzwords Bias ---
        hype_words = ["guaranteed", "miracle", "foolproof", "get rich", "100%", "secret trick", "cure"]
        has_hype = any(w in copy_text.lower() for w in hype_words)
        if has_hype:
            sentiment_bias -= 0.50
            hashtag_factor *= 0.80  # Trust penalty

        # --- COMPUTE COMPOSITE METRICS ---
        final_impressions = int(base_impressions * timing_factor * hashtag_factor)
        final_impressions = max(100, final_impressions)

        effective_eng_rate = (
            base_eng_rate * timing_factor * length_factor * novelty_factor * cta_factor
        )
        effective_eng_rate = max(0.010, min(0.18, effective_eng_rate))

        total_engagements = int(final_impressions * effective_eng_rate)
        total_engagements = max(3, total_engagements)

        # Distribute engagements into likes, shares, comments, clicks
        likes = int(total_engagements * 0.65)
        shares = int(total_engagements * 0.15 * question_share_boost)
        comments_count = int(total_engagements * 0.20 * question_comment_boost)
        clicks = int(total_engagements * (1.2 if cta_type == "urgency" else 0.8))

        # Re-estimate engagement rate based on actual totals
        calculated_rate = round((likes + comments_count + shares) / final_impressions, 4)

        # Sentiment score (-1.0 to 1.0)
        base_sentiment = 0.35 + sentiment_bias
        final_sentiment_score = round(max(-0.90, min(0.95, base_sentiment)), 2)

        metrics = PostMetrics(
            post_id=post.post_id,
            impressions=final_impressions,
            likes=likes,
            shares=shares,
            comments_count=comments_count,
            clicks=clicks,
            engagement_rate=calculated_rate,
            sentiment_score=final_sentiment_score,
            simulated=True,
        )

        # --- RULE 8: SIMULATE REALISTIC COMMENTS & RISK INJECTION ---
        comments = self._generate_comments(post, metrics, final_sentiment_score)

        return metrics, comments

    def _generate_comments(
        self, post: PostRecord, metrics: PostMetrics, sentiment_score: float
    ) -> List[CommentRecord]:
        """Generate realistic comments matching the channel persona and sentiment."""
        comments: List[CommentRecord] = []
        num_comments = max(2, min(6, metrics.comments_count // 3))

        channel = post.channel
        # Potential risk injection flag (~12% chance or if specific prompt triggers)
        # We guarantee at least 1 risk comment in week 1 to verify community manager escalation
        inject_risk = (post.day_of_week == 2 and post.week_number == 1 and channel == "community_forum") or (
            post.day_of_week == 7 and post.week_number == 2 and channel == "short_form"
        )

        authors = [
            "Alex_TrailBlazer",
            "EcoNomad99",
            "Sara_GreenTech",
            "Marcus_Dev",
            "OutdoorGearReview",
            "SolarEnthusiast",
            "B2B_Procurement_Guy",
            "WeekendCamper",
        ]

        # Positive comments
        positive_bank = {
            "short_form": [
                "That drop test was crazy! Putting this on my wishlist.",
                "Love the compact form factor. Perfect for ultralight packing.",
                "Finally a solar charger that doesn't look like an ugly brick.",
            ],
            "community_forum": [
                "Appreciate the honest specs instead of fake lumen claims. How does the battery behave below freezing?",
                "Great to see recycled marine polymers used here. Solid step forward for hardware sustainability.",
                "What solar cell efficiency are you hitting on overcast days? Intrigued by the modular battery.",
            ],
            "professional": [
                "Strong positioning on circular manufacturing benchmarks. Hardware lifecycle accountability is overdue.",
                "The 42% carbon footprint reduction is commendable. Looking forward to reviewing the whitepaper.",
                "Excellent industrial design execution. Modular battery replacement is a game-changer.",
            ],
        }

        # Negative / Skeptical comments
        negative_bank = {
            "short_form": [
                "Another drop-shipped gadget with a fancy video filter.",
                "4 hours recharge? Maybe on the equator at noon lol.",
                "Way too expensive when standard powerbanks are $20.",
            ],
            "community_forum": [
                "Seen this promise before on Kickstarter. Show me the third-party battery degradation graphs.",
                "Why the pushy sales CTA? Thought this was an engineering discussion thread.",
                "Marketing team overselling again. What IP rating did this actually achieve?",
            ],
            "professional": [
                "This read like an aggressive sales pitch rather than thought leadership. Disappointing for LinkedIn.",
                "Without verified LCA methodology, claims of 42% carbon reduction are unverified.",
                "Urgent discount codes do not belong in enterprise hardware discussions.",
            ],
        }

        # High-risk escalation comments
        risk_bank = [
            ("I bought this and it overheated on my dashboard. Can I get an immediate refund?", "refund"),
            ("Is this battery unsafe when charging in direct sunlight? It felt dangerously hot.", "unsafe"),
            ("This company is an outright scam taking pre-orders for vaporware.", "scam"),
            ("The plastic cracked and cut my hand on day two. This is an injury hazard.", "injury"),
        ]

        for i in range(num_comments):
            author = authors[(i + post.day_of_week) % len(authors)]
            comm_id = f"comm_{uuid.uuid4().hex[:8]}"
            created_at = datetime.now(timezone.utc).isoformat()

            if inject_risk and i == 0:
                risk_text, risk_kw = risk_bank[(post.week_number) % len(risk_bank)]
                comments.append(
                    CommentRecord(
                        comment_id=comm_id,
                        post_id=post.post_id,
                        author=author,
                        text=risk_text,
                        created_at=created_at,
                        sentiment="negative",
                        has_risk_keyword=True,
                        risk_keyword=risk_kw,
                        is_agent_reply=False,
                    )
                )
                continue

            # Pick based on sentiment score
            is_pos = sentiment_score > 0 and (i % 3 != 0)
            if is_pos:
                pool = positive_bank.get(channel, positive_bank["short_form"])
                text = pool[i % len(pool)]
                sent = "positive"
            else:
                pool = negative_bank.get(channel, negative_bank["short_form"])
                text = pool[i % len(pool)]
                sent = "negative"

            comments.append(
                CommentRecord(
                    comment_id=comm_id,
                    post_id=post.post_id,
                    author=author,
                    text=text,
                    created_at=created_at,
                    sentiment=sent,
                    has_risk_keyword=False,
                    risk_keyword=None,
                    is_agent_reply=False,
                )
            )

        return comments

    def _extract_hour(self, time_str: str) -> int:
        """Extract hour integer from string like '19:30:00' or '09:15'."""
        try:
            parts = time_str.split(":")
            return int(parts[0])
        except Exception:
            return 12
