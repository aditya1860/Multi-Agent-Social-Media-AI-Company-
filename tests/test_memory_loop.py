"""
Unit tests for Persistent Memory Loop and Week 2 Strategy Adaptation
"""

import tempfile
import pytest
from agents.llm_client import LLMClient
from agents.strategy_agent import StrategyAgent
from memory.memory_store import MemoryStore


def test_memory_store_save_and_retrieve():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = f"{tmpdir}/test_memory.db"
        mem = MemoryStore(db_path=db_path)

        mem.save_weekly_insights(
            campaign_id="camp_101",
            week_number=1,
            kpi_verdict="Baseline completed with timing variance.",
            top_patterns=["Evening posts outperformed morning by 40%."],
            underperforming_patterns=["Hashtag counts above 8 triggered spam penalty."],
            actionable_recommendations=["Shift short_form to 19:30:00", "Limit hashtags to 4 max"],
            best_timing_slots={"short_form": "19:30:00", "professional": "09:15:00"},
            metrics_summary={"avg_rate": 0.045},
        )

        insights = mem.get_insights("camp_101", week_number=1)
        assert insights is not None
        assert insights.week_number == 1
        assert "Shift short_form to 19:30:00" in insights.actionable_recommendations
        assert insights.best_timing_slots["short_form"] == "19:30:00"


def test_strategy_agent_incorporates_memory_for_week_2():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = f"{tmpdir}/test_memory.db"
        mem = MemoryStore(db_path=db_path)
        client = LLMClient(offline_mode=True)
        strategy = StrategyAgent(llm_client=client)

        # 1. Week 1 baseline formulation (no prior memory)
        plan_w1 = strategy.formulate_strategy(
            campaign_brief="EcoGlow sustainable outdoor lantern launch.",
            week_number=1,
            prior_insights=None,
        )
        assert plan_w1.week_number == 1

        # 2. Save Week 1 insight into memory
        w1_record = mem.save_weekly_insights(
            campaign_id="camp_eco",
            week_number=1,
            kpi_verdict="Needs higher engagement.",
            top_patterns=["Evening short-form had 45% higher reach."],
            underperforming_patterns=["Morning short-form posts dropped viewers."],
            actionable_recommendations=["Shift short-form to 19:00 window", "Use question CTAs"],
        )

        # 3. Week 2 strategy formulation (actively ingesting prior memory)
        plan_w2 = strategy.formulate_strategy(
            campaign_brief="EcoGlow sustainable outdoor lantern launch.",
            week_number=2,
            prior_insights=w1_record,
        )

        assert plan_w2.week_number == 2
        # Verify Week 2 plan reflects memory adaptations
        assert len(plan_w2.memory_adaptations) > 0 or "Week 1" in plan_w2.strategic_rationale
        assert plan_w2.channel_mix != plan_w1.channel_mix or plan_w2.target_kpis != plan_w1.target_kpis
