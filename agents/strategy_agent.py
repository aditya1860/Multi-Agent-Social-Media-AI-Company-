"""
Strategy Agent (agents/strategy_agent.py)

Responsible for:
- Audience segmentation and value proposition alignment
- Channel mix allocation across short_form, community_forum, professional
- Posting cadence and quantitative KPI targets
- Ingesting prior-week insights from persistent memory to replan Week 2+
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from agents.base_agent import BaseAgent
from bus.events import MessageType
from memory.memory_store import WeeklyInsightRecord


class StrategyPlan(BaseModel):
    week_number: int
    target_audience: str
    channel_mix: Dict[str, float] = Field(
        description="Percentage allocation per channel summing to 1.0 (e.g. {'short_form': 0.45, 'community_forum': 0.35, 'professional': 0.20})"
    )
    content_pillars: List[str]
    posting_cadence_days: List[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6, 7])
    target_kpis: Dict[str, Any]
    strategic_rationale: str
    memory_adaptations: List[str] = Field(default_factory=list)


STRATEGY_SYSTEM_PROMPT = """You are the Chief Strategy Officer of an AI-driven digital marketing company.
Your role is to formulate data-driven, defensible multi-channel social media strategies.

CHANNELS AVAILABLE:
1. 'short_form' (QuickPulse): Snappy vertical video hooks, high energy, evening audience peak.
2. 'community_forum' (NexusForum): Thoughtful discussion, authentic technical depth, question-ending CTAs.
3. 'professional' (ProSphere): B2B thought-leadership, structured analytical paragraphs, morning workday peak.

GUIDELINES:
- In Week 1: Establish baseline distribution across all 3 channels with balanced content pillars.
- In Week 2+: You MUST read and incorporate the provided prior-week insights. Adjust channel allocations,
  modify content pillars, and mandate specific operational guidelines (e.g., restricting hashtags or shifting to question CTAs)
  to remedy identified weaknesses.
- Always output strictly valid JSON matching the StrategyPlan schema. No markdown backticks or commentary outside JSON.
"""


class StrategyAgent(BaseAgent):
    def __init__(self, llm_client=None, bus=None):
        super().__init__(
            name="StrategyAgent",
            system_prompt=STRATEGY_SYSTEM_PROMPT,
            temperature=0.4,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )

    def formulate_strategy(
        self,
        campaign_brief: str,
        week_number: int = 1,
        prior_insights: Optional[WeeklyInsightRecord] = None,
        campaign_id: Optional[str] = None,
    ) -> StrategyPlan:
        """Formulate strategic plan for the given week, actively incorporating prior memory."""
        context = {
            "week_number": week_number,
            "campaign_id": campaign_id,
            "has_prior_insights": prior_insights is not None,
        }

        user_prompt = f"CAMPAIGN BRIEF:\n{campaign_brief}\n\nWEEK NUMBER: {week_number}\n"

        if prior_insights:
            context["prior_insights"] = prior_insights.actionable_recommendations
            user_prompt += (
                f"\n--- MANDATORY PRIOR-WEEK ANALYTICS INSIGHTS (WEEK {prior_insights.week_number}) ---\n"
                f"KPI Verdict: {prior_insights.kpi_verdict}\n"
                f"Top Patterns: {prior_insights.top_performing_patterns}\n"
                f"Underperforming Patterns: {prior_insights.underperforming_patterns}\n"
                f"Actionable Recommendations: {prior_insights.actionable_recommendations}\n"
                f"Optimal Timing Slots Identified: {prior_insights.best_timing_slots}\n"
                f"TASK: Formulate Strategy for Week {week_number}. You MUST adjust the channel mix, content pillars, "
                f"and strategic rationale based on these specific recommendations.\n"
            )
        else:
            user_prompt += "\nTASK: Formulate initial Week 1 baseline strategy across all 3 channels.\n"

        user_prompt += "\nRespond with a single JSON object conforming strictly to StrategyPlan."

        resp = self._call_llm(
            prompt=user_prompt,
            schema_validator=StrategyPlan,
            context=context,
        )

        plan_data = resp.parsed_json or {}
        plan = StrategyPlan(**plan_data)

        self._publish(
            recipient="ChiefOfStaff",
            message_type=MessageType.STRATEGY_OUTPUT,
            payload=plan.model_dump(),
            campaign_id=campaign_id,
            week_number=week_number,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
        )

        return plan
