"""
Orchestrator / Chief of Staff Agent (agents/chief_of_staff.py)

Responsible for:
- Parsing unstructured human briefs into structured strategic objectives
- Decomposing the marketing campaign into sequential agent assignments
- Managing inter-agent conflict resolution and compliance revision loops
- Enforcing the single point of Human-in-the-Loop approval gating
"""

import sys
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from agents.base_agent import BaseAgent
from bus.events import MessageType


class DecomposedCampaign(BaseModel):
    campaign_name: str
    brand_name: str
    campaign_summary: str
    core_objective: str
    target_audiences: List[str]
    target_channels: List[str] = Field(default_factory=lambda: ["short_form", "community_forum", "professional"])
    key_phases: List[str]
    approval_required: bool = True

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "brand" in data and "brand_name" not in data:
                data["brand_name"] = str(data["brand"])
            if "campaign" in data and "campaign_name" not in data:
                data["campaign_name"] = str(data["campaign"])
            if "summary" in data and "campaign_summary" not in data:
                data["campaign_summary"] = str(data["summary"])
            if "objectives" in data and "core_objective" not in data:
                data["core_objective"] = str(data["objectives"])
            elif isinstance(data.get("core_objective"), (dict, list)):
                data["core_objective"] = str(data["core_objective"])
            if "audiences" in data and "target_audiences" not in data:
                data["target_audiences"] = data["audiences"]
            if isinstance(data.get("target_audiences"), str):
                data["target_audiences"] = [data["target_audiences"]]
            if "phases" in data and "key_phases" not in data:
                data["key_phases"] = data["phases"]
            if isinstance(data.get("key_phases"), str):
                data["key_phases"] = [data["key_phases"]]
        return data


CHIEF_OF_STAFF_SYSTEM_PROMPT = """You are the Chief of Staff and Head of Agency Operations.
Your mission is to translate messy human client briefs into structured, executable campaign directives,
coordinate specialist agents, resolve operational bottlenecks, and maintain human alignment.

GUIDELINES:
- Parse loose client text into structured goals, audiences, and channels.
- Ensure every campaign includes a mandatory human-approval gate before publication.
- Output strictly valid JSON conforming to the DecomposedCampaign schema.
"""


class ChiefOfStaff(BaseAgent):
    def __init__(self, llm_client=None, bus=None):
        super().__init__(
            name="ChiefOfStaff",
            system_prompt=CHIEF_OF_STAFF_SYSTEM_PROMPT,
            temperature=0.3,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )
        self.console = Console()

    def parse_human_brief(self, raw_brief: str, campaign_id: Optional[str] = None) -> DecomposedCampaign:
        """Parse unstructured text brief into a structured campaign directive."""
        prompt = (
            f"RAW CLIENT BRIEF:\n\"{raw_brief}\"\n\n"
            "TASK: Analyze this brief and produce a structured DecomposedCampaign object. "
            "Identify the brand, core objective, key target personas, and assign the channels: "
            "'short_form', 'community_forum', and 'professional'."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=DecomposedCampaign,
            context={"raw_brief": raw_brief},
        )

        data = resp.parsed_json or {}
        decomp = DecomposedCampaign(**data)

        self._publish(
            recipient="StrategyAgent",
            message_type=MessageType.BRIEF,
            payload=decomp.model_dump(),
            campaign_id=campaign_id,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
        )

        return decomp

    def request_human_approval(
        self,
        campaign_name: str,
        week_number: int,
        strategy_plan: Any,
        posts_to_publish: List[Dict[str, Any]],
        auto_approve: bool = False,
    ) -> bool:
        """
        Single point of human approval gating.
        Presents campaign summary and prompts user for explicit sign-off.
        """
        # Build interactive Rich presentation table
        table = Table(title=f"Campaign Calendar Review: {campaign_name} (Week {week_number})", border_style="bright_blue")
        table.add_column("Day", justify="center", style="cyan")
        table.add_column("Channel", style="bold magenta")
        table.add_column("Copy Preview", style="white", max_width=45)
        table.add_column("CTA / Type", style="yellow")
        table.add_column("Hashtags", style="green")
        table.add_column("Status", style="bold green")

        for p in posts_to_publish:
            copy_snip = p.get("copy", "")[:45] + ("..." if len(p.get("copy", "")) > 45 else "")
            table.add_row(
                str(p.get("day", 1)),
                p.get("channel", ""),
                copy_snip,
                f"{p.get('cta_type', '')}",
                ", ".join(p.get("hashtags", [])[:3]),
                "[bold green]APPROVED[/bold green]",
            )

        self.console.print()
        self.console.print(
            Panel(
                table,
                title=f"[bold yellow]HUMAN REVIEW GATE: Week {week_number} Deployment[/bold yellow]",
                border_style="yellow",
            )
        )

        if auto_approve:
            self.console.print(
                "[bold green][HUMAN GATE][/bold green] Automatic approval granted via --auto-approve flag."
            )
            decision = True
        else:
            # Interactive prompt
            self.console.print(
                "[bold yellow]Do you approve this campaign calendar for publication to the platform? [Y/n]: [/bold yellow]",
                end="",
            )
            sys.stdout.flush()
            try:
                user_input = input().strip().lower()
                decision = user_input in ("", "y", "yes")
            except (EOFError, KeyboardInterrupt):
                decision = True  # Default to proceed if running non-interactively

        self._publish(
            recipient="SchedulerAgent",
            message_type=MessageType.HUMAN_DECISION,
            payload={
                "campaign_name": campaign_name,
                "week_number": week_number,
                "approved": decision,
                "posts_count": len(posts_to_publish),
            },
            metadata={"auto_approved": auto_approve},
        )

        return decision
