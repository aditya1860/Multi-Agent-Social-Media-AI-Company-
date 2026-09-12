"""
Analytics Agent (agents/analytics_agent.py)

Architectural Mandate:
-----------------------
Do NOT hand raw per-post JSON to the LLM and ask it to 'find patterns.'
Small 7-8B local models are notoriously unreliable at multi-variable arithmetic,
pivoting, and aggregation over tabular data from unstructured strings.

Instead, we strictly separate concerns:
1. Python Deterministic Aggregator:
   Computes exact grouped averages by channel, timing window, hashtag count,
   copy length, format type, and CTA type. Identifies top/bottom outlier posts.
2. LLM Causal Reasoning Layer:
   Interprets the pre-aggregated summary table into causal hypotheses and
   concrete, quantified next-week recommendations.
"""

from collections import defaultdict
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from agents.base_agent import BaseAgent
from bus.events import MessageType
from memory.memory_store import MemoryStore, WeeklyInsightRecord
from mock_platform.models import PostRecord


class AnalyticsReport(BaseModel):
    week_number: int
    kpi_verdict: str
    top_performing_patterns: List[str]
    underperforming_patterns: List[str]
    actionable_recommendations: List[str]
    best_timing_slots: Dict[str, str] = Field(
        default_factory=lambda: {
            "short_form": "19:30:00",
            "professional": "09:15:00",
            "community_forum": "18:00:00",
        }
    )
    precomputed_aggregates: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_analytics(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if "analytics_report" in data and isinstance(data["analytics_report"], dict):
            data = {**data["analytics_report"], **{k: v for k, v in data.items() if k != "analytics_report"}}

        if not data.get("kpi_verdict"):
            data["kpi_verdict"] = "Weekly KPI performance analyzed."

        for list_field in ["top_performing_patterns", "underperforming_patterns", "actionable_recommendations"]:
            val = data.get(list_field)
            if isinstance(val, str):
                data[list_field] = [val]
            elif isinstance(val, dict):
                data[list_field] = [f"{k}: {v}" for k, v in val.items()]
            elif not isinstance(val, list):
                data[list_field] = []

        if not data.get("best_timing_slots") or not isinstance(data.get("best_timing_slots"), dict):
            data["best_timing_slots"] = {
                "short_form": "19:30:00",
                "professional": "09:15:00",
                "community_forum": "18:00:00",
            }

        return data


ANALYTICS_SYSTEM_PROMPT = """You are the Chief Data Scientist and Social Media Analytics Officer.
You interpret empirical marketing metrics and formulate causal hypotheses and quantified recommendations.

STRICT INSTRUCTIONS:
- You are provided with PRE-COMPUTED statistics produced deterministically by Python.
- Do not perform arithmetic; the numbers are already computed and exact.
- Your job is CAUSAL INTERPRETATION:
  * Explain WHY top posts succeeded and bottom posts failed based on the cross-cutting dimensions (timing, length, hashtags, CTAs).
  * Formulate specific, quantified recommendations for next week (e.g. 'Shift short_form to 18:00-21:00 window', 'Limit hashtags to 3-4', 'Adopt question-ending CTAs for forum').
  * Never write vague platitudes like 'post more engaging content'.
- Output strictly valid JSON matching the AnalyticsReport schema.
"""


class AnalyticsAgent(BaseAgent):
    def __init__(
        self,
        llm_client=None,
        bus=None,
        memory_store: Optional[MemoryStore] = None,
    ):
        super().__init__(
            name="AnalyticsAgent",
            system_prompt=ANALYTICS_SYSTEM_PROMPT,
            temperature=0.2,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )
        self.memory_store = memory_store or MemoryStore()

    def run_deterministic_aggregation(self, posts: List[PostRecord]) -> Dict[str, Any]:
        """
        Pure deterministic Python aggregation across all key marketing dimensions.
        """
        if not posts:
            return {}

        total_posts = len(posts)
        total_impressions = sum(p.metrics.impressions for p in posts)
        total_engagements = sum(
            p.metrics.likes + p.metrics.shares + p.metrics.comments_count for p in posts
        )
        avg_engagement_rate = (
            round(total_engagements / total_impressions, 4) if total_impressions > 0 else 0.0
        )

        # 1. By Channel
        channel_data = defaultdict(lambda: {"posts": 0, "impressions": 0, "engagements": 0})
        for p in posts:
            ch = p.channel
            channel_data[ch]["posts"] += 1
            channel_data[ch]["impressions"] += p.metrics.impressions
            channel_data[ch]["engagements"] += (
                p.metrics.likes + p.metrics.shares + p.metrics.comments_count
            )

        channel_summary = {}
        for ch, d in channel_data.items():
            rate = round(d["engagements"] / d["impressions"], 4) if d["impressions"] > 0 else 0.0
            channel_summary[ch] = {
                "post_count": d["posts"],
                "avg_impressions": round(d["impressions"] / d["posts"], 1),
                "avg_engagement_rate": rate,
            }

        # 2. By Timing Window
        timing_data = defaultdict(lambda: {"posts": 0, "impressions": 0, "engagements": 0})
        for p in posts:
            try:
                hour = int(p.scheduled_time.split(":")[0])
            except Exception:
                hour = 12

            if 7 <= hour <= 11:
                window = "morning_07_11"
            elif 12 <= hour <= 16:
                window = "afternoon_12_16"
            elif 17 <= hour <= 21:
                window = "evening_17_21"
            else:
                window = "night_22_06"

            timing_data[window]["posts"] += 1
            timing_data[window]["impressions"] += p.metrics.impressions
            timing_data[window]["engagements"] += (
                p.metrics.likes + p.metrics.shares + p.metrics.comments_count
            )

        timing_summary = {}
        for w, d in timing_data.items():
            rate = round(d["engagements"] / d["impressions"], 4) if d["impressions"] > 0 else 0.0
            timing_summary[w] = {
                "post_count": d["posts"],
                "avg_impressions": round(d["impressions"] / d["posts"], 1),
                "avg_engagement_rate": rate,
            }

        # 3. By Hashtag Count Bins
        hashtag_data = defaultdict(lambda: {"posts": 0, "impressions": 0, "engagements": 0})
        for p in posts:
            c = len(p.hashtags)
            if c <= 2:
                bin_name = "0_to_2_tags"
            elif 3 <= c <= 5:
                bin_name = "3_to_5_tags"
            elif 6 <= c <= 8:
                bin_name = "6_to_8_tags"
            else:
                bin_name = "9_plus_tags"

            hashtag_data[bin_name]["posts"] += 1
            hashtag_data[bin_name]["impressions"] += p.metrics.impressions
            hashtag_data[bin_name]["engagements"] += (
                p.metrics.likes + p.metrics.shares + p.metrics.comments_count
            )

        hashtag_summary = {}
        for b, d in hashtag_data.items():
            rate = round(d["engagements"] / d["impressions"], 4) if d["impressions"] > 0 else 0.0
            hashtag_summary[b] = {
                "post_count": d["posts"],
                "avg_impressions": round(d["impressions"] / d["posts"], 1),
                "avg_engagement_rate": rate,
            }

        # 4. By CTA Type
        cta_data = defaultdict(lambda: {"posts": 0, "impressions": 0, "engagements": 0, "comments": 0})
        for p in posts:
            cta = p.cta_type
            cta_data[cta]["posts"] += 1
            cta_data[cta]["impressions"] += p.metrics.impressions
            cta_data[cta]["engagements"] += (
                p.metrics.likes + p.metrics.shares + p.metrics.comments_count
            )
            cta_data[cta]["comments"] += p.metrics.comments_count

        cta_summary = {}
        for cta, d in cta_data.items():
            rate = round(d["engagements"] / d["impressions"], 4) if d["impressions"] > 0 else 0.0
            cta_summary[cta] = {
                "post_count": d["posts"],
                "avg_engagement_rate": rate,
                "avg_comments_per_post": round(d["comments"] / d["posts"], 1),
            }

        # 5. Top and Bottom Outliers
        sorted_posts = sorted(posts, key=lambda x: x.metrics.engagement_rate, reverse=True)
        top_posts = [
            {
                "post_id": p.post_id,
                "channel": p.channel,
                "eng_rate": p.metrics.engagement_rate,
                "impressions": p.metrics.impressions,
                "time": p.scheduled_time,
                "hashtag_count": len(p.hashtags),
                "cta_type": p.cta_type,
                "copy_snippet": p.copy[:80],
            }
            for p in sorted_posts[:2]
        ]
        bottom_posts = [
            {
                "post_id": p.post_id,
                "channel": p.channel,
                "eng_rate": p.metrics.engagement_rate,
                "impressions": p.metrics.impressions,
                "time": p.scheduled_time,
                "hashtag_count": len(p.hashtags),
                "cta_type": p.cta_type,
                "copy_snippet": p.copy[:80],
            }
            for p in sorted_posts[-2:]
        ]

        # 6. Sentiment aggregation
        all_comments = [c for p in posts for c in p.comments if not c.is_agent_reply]
        total_comm = len(all_comments)
        pos_comm = sum(1 for c in all_comments if c.sentiment == "positive")
        neg_comm = sum(1 for c in all_comments if c.sentiment == "negative")
        risk_comm = sum(1 for c in all_comments if c.has_risk_keyword)

        sentiment_summary = {
            "total_user_comments": total_comm,
            "positive_ratio": round(pos_comm / total_comm, 2) if total_comm > 0 else 0.0,
            "negative_ratio": round(neg_comm / total_comm, 2) if total_comm > 0 else 0.0,
            "risk_flagged_count": risk_comm,
        }

        return {
            "total_posts": total_posts,
            "total_impressions": total_impressions,
            "total_engagements": total_engagements,
            "avg_engagement_rate": avg_engagement_rate,
            "channel_performance": channel_summary,
            "timing_performance": timing_summary,
            "hashtag_performance": hashtag_summary,
            "cta_performance": cta_summary,
            "top_posts": top_posts,
            "bottom_posts": bottom_posts,
            "sentiment_summary": sentiment_summary,
        }

    def analyze_week(
        self,
        posts: List[PostRecord],
        campaign_id: str,
        week_number: int,
    ) -> AnalyticsReport:
        """
        Full analytical pipeline:
        1. Deterministic Python computation of stats
        2. LLM causal reasoning & actionable recommendation generation
        3. Persistence into SQLite memory
        4. Publication to message bus
        """
        aggregates = self.run_deterministic_aggregation(posts)

        context = {
            "week_number": week_number,
            "campaign_id": campaign_id,
            "total_posts": aggregates.get("total_posts", 0),
        }

        import json
        prompt = (
            f"CAMPAIGN ID: {campaign_id}\n"
            f"WEEK NUMBER: {week_number}\n\n"
            f"--- PRE-COMPUTED DETERMINISTIC AGGREGATES ---\n"
            f"{json.dumps(aggregates, separators=(',', ':'))}\n\n"
            "TASK:\n"
            "1. Review the performance across channels, timing windows, hashtag bins, and CTA types.\n"
            "2. Identify causal patterns explaining top vs bottom posts.\n"
            "3. Formulate specific, quantified recommendations for next week's campaign adaptation.\n"
            "4. Specify the best recommended timing slots for each channel in 'best_timing_slots'.\n"
            "Respond strictly in JSON matching the AnalyticsReport schema."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=AnalyticsReport,
            context=context,
        )

        report_data = resp.parsed_json or {}
        report_data["precomputed_aggregates"] = aggregates
        report = AnalyticsReport(**report_data)

        # Save to persistent SQLite memory
        self.memory_store.save_weekly_insights(
            campaign_id=campaign_id,
            week_number=week_number,
            kpi_verdict=report.kpi_verdict,
            top_patterns=report.top_performing_patterns,
            underperforming_patterns=report.underperforming_patterns,
            actionable_recommendations=report.actionable_recommendations,
            best_timing_slots=report.best_timing_slots,
            metrics_summary=aggregates,
        )

        # Publish report to message bus
        self._publish(
            recipient="ChiefOfStaff",
            message_type=MessageType.ANALYTICS_REPORT,
            payload={
                "kpi_verdict": report.kpi_verdict,
                "top_patterns": report.top_performing_patterns,
                "recommendations": report.actionable_recommendations,
                "best_timing_slots": report.best_timing_slots,
                "summary_metrics": aggregates,
            },
            campaign_id=campaign_id,
            week_number=week_number,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
        )

        return report
