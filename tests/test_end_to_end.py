"""
End-to-End Integration Test for Multi-Agent System
"""

import os
import tempfile
import pytest
from agents.llm_client import LLMClient
from bus.message_bus import MessageBus
from memory.memory_store import MemoryStore
from mock_platform.database import PlatformDatabase
from orchestrator import CampaignOrchestrator


def test_end_to_end_campaign_optimization():
    """
    Validates complete pipeline:
    Brief -> Strategy -> Creation -> Compliance -> Gating -> Publication ->
    Simulation -> Community Moderation -> Analytics -> Week 2 Adaptation ->
    Comparison Reporting.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        # Isolated databases and logs for clean test
        db_platform_path = os.path.join(tmpdir, "platform.db")
        db_trace_path = os.path.join(tmpdir, "trace.db")
        jsonl_trace_path = os.path.join(tmpdir, "trace.jsonl")
        db_memory_path = os.path.join(tmpdir, "memory.db")

        llm_client = LLMClient(offline_mode=True)
        bus = MessageBus(db_path=db_trace_path, jsonl_path=jsonl_trace_path, verbose=False)
        memory = MemoryStore(db_path=db_memory_path)
        platform_db = PlatformDatabase(db_path=db_platform_path)

        orchestrator = CampaignOrchestrator(
            llm_client=llm_client,
            bus=bus,
            memory_store=memory,
            db=platform_db,
        )

        test_brief = (
            "Launch campaign for EcoGlow: ultra-compact modular solar lantern made from "
            "recycled ocean plastic for backpackers, vanlifers, and eco-conscious outdoor adventurers."
        )

        result = orchestrator.run_campaign(
            raw_brief=test_brief,
            campaign_id="test_camp_e2e",
            auto_approve=True,
        )

        assert result["campaign_id"] == "test_camp_e2e"
        assert "week_1" in result
        assert "week_2" in result
        assert result["week_1"]["posts_published"] == 7
        assert result["week_2"]["posts_published"] == 7

        # Verify Community Manager caught the safety escalation
        assert result["week_1"]["moderation"]["escalated_to_human"] >= 1

        # Verify Week 2 engagement rate improved over Week 1 baseline
        w1_rate = result["comparison"]["engagement_rate_week1"]
        w2_rate = result["comparison"]["engagement_rate_week2"]
        assert w2_rate > w1_rate, f"Week 2 rate ({w2_rate}) should exceed Week 1 rate ({w1_rate})"

        # Verify trace persistence
        traces = bus.get_traces(limit=100)
        assert len(traces) >= 20
        assert os.path.exists(jsonl_trace_path)
