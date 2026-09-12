"""
Scheduler & Publisher Agent (agents/scheduler_agent.py)

Responsible for:
- Selecting optimal publication time windows using memory insights
- Assembling the final publication payload (copy, creative brief, hashtags, format)
- Publishing approved posts directly to the Mock Social Media Platform API/DB
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from agents.base_agent import BaseAgent
from bus.events import MessageType
from mock_platform.database import PlatformDatabase
from mock_platform.models import PostCreateRequest, PostRecord


class ScheduleDecision(BaseModel):
    day_of_week: int
    channel: str
    scheduled_time: str = Field(description="Format 'HH:MM:SS', e.g. '19:30:00'")
    timing_rationale: str
    platform_post_ready: bool = True

    @model_validator(mode="before")
    @classmethod
    def normalize_schedule(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if "schedule_decision" in data and isinstance(data["schedule_decision"], dict):
            data = {**data["schedule_decision"], **{k: v for k, v in data.items() if k != "schedule_decision"}}
        if not data.get("scheduled_time"):
            data["scheduled_time"] = "19:00:00"
        if not data.get("timing_rationale"):
            data["timing_rationale"] = "Targeting peak engagement window."
        if "platform_post_ready" not in data:
            data["platform_post_ready"] = True
        return data


SCHEDULER_SYSTEM_PROMPT = """You are the Senior Traffic & Social Media Publishing Officer.
Your responsibility is to optimize publication slots and push approved posts to platforms.

TIMING RULES:
1. 'short_form': Target peak evening engagement (18:00 - 21:00). Avoid morning drops.
2. 'professional': Target B2B workday morning window (08:30 - 11:30).
3. 'community_forum': Target afternoon/evening discussion peak (14:00 - 19:30).

MEMORY UTILIZATION:
- If prior-week timing recommendations are provided, prioritize those exact empirically-proven windows.
- Always output strictly valid JSON matching the ScheduleDecision schema.
"""


class SchedulerAgent(BaseAgent):
    def __init__(self, llm_client=None, bus=None, db: Optional[PlatformDatabase] = None):
        super().__init__(
            name="SchedulerAgent",
            system_prompt=SCHEDULER_SYSTEM_PROMPT,
            temperature=0.2,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )
        self.db = db or PlatformDatabase()

    def schedule_and_publish(
        self,
        draft_copy: str,
        creative_brief: Dict[str, Any],
        channel: str,
        hashtags: List[str],
        cta_type: str,
        format_type: str,
        campaign_id: str,
        week_number: int,
        day_of_week: int,
        timing_memory: Optional[Dict[str, str]] = None,
    ) -> PostRecord:
        """Pick optimal time slot and publish post directly to the platform."""
        context = {
            "channel": channel,
            "week_number": week_number,
            "day": day_of_week,
            "timing_memory": timing_memory or {},
        }

        prompt = (
            f"CHANNEL: {channel}\n"
            f"WEEK NUMBER: {week_number} | DAY: {day_of_week}\n"
            f"TIMING INSIGHTS FROM MEMORY: {timing_memory if timing_memory else 'None provided'}\n\n"
            "TASK: Select the optimal publication time slot (HH:MM:SS) for this channel, "
            "justifying the choice based on channel audience behavior and prior memory."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=ScheduleDecision,
            context=context,
        )

        decision_data = resp.parsed_json or {}
        decision = ScheduleDecision(**decision_data)

        # Build platform request
        post_req = PostCreateRequest(
            campaign_id=campaign_id,
            week_number=week_number,
            day_of_week=day_of_week,
            channel=channel,
            copy=draft_copy,
            creative_brief=creative_brief,
            scheduled_time=decision.scheduled_time,
            hashtags=hashtags,
            cta_type=cta_type,
            format_type=format_type,
        )

        # Publish to database
        import uuid
        post_id = f"post_{uuid.uuid4().hex[:10]}"
        from mock_platform.models import PostMetrics
        post_record = PostRecord(
            post_id=post_id,
            campaign_id=post_req.campaign_id,
            week_number=post_req.week_number,
            day_of_week=post_req.day_of_week,
            channel=post_req.channel,
            copy=post_req.copy,
            creative_brief=post_req.creative_brief,
            scheduled_time=post_req.scheduled_time,
            hashtags=post_req.hashtags,
            cta_type=post_req.cta_type,
            format_type=post_req.format_type,
            created_at=datetime.now(timezone.utc).isoformat(),
            metrics=PostMetrics(post_id=post_id, simulated=False),
            comments=[],
        )
        self.db.insert_post(post_record)

        # Notify bus
        self._publish(
            recipient="MockPlatform",
            message_type=MessageType.SCHEDULE_PUBLISH,
            payload={
                "post_id": post_id,
                "scheduled_time": decision.scheduled_time,
                "timing_rationale": decision.timing_rationale,
                "channel": channel,
            },
            campaign_id=campaign_id,
            week_number=week_number,
            post_id=post_id,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
        )

        return post_record
