"""
Creative Agent (agents/creative_agent.py)

Responsible for:
- Producing detailed, text-only visual creative briefs to accompany post copy
- Specifying visual concept, composition, focal point, lighting, color palette, and text overlay coordinates
- Adapting visual aspect ratios to specific channel requirements (9:16 vertical, 16:9 landscape, 1:1 square)
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator
from agents.base_agent import BaseAgent
from bus.events import MessageType


class CreativeBrief(BaseModel):
    asset_type: str = Field(description="e.g. '9:16 vertical video storyboard', '1:1 studio macro photo'")
    visual_concept: str = Field(description="Narrative visual description of the scene")
    composition: str = Field(description="Framing, rule-of-thirds, foreground/background elements")
    color_palette: List[str] = Field(description="Hex codes or named palette tones")
    lighting_mood: str = Field(description="Lighting style, contrast, warmth, and atmosphere")
    text_overlay_spec: str = Field(description="Font style, position, exact text overlay")
    aspect_ratio: str = Field(description="'9:16', '16:9', '1:1', or '4:5'")

    @model_validator(mode="before")
    @classmethod
    def normalize_creative_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        # Handle wrapping key if any
        if "creative_brief" in data and isinstance(data["creative_brief"], dict):
            data = {**data["creative_brief"], **{k: v for k, v in data.items() if k != "creative_brief"}}
        # Normalize color_palette
        cp = data.get("color_palette")
        if isinstance(cp, dict):
            data["color_palette"] = [f"{k}: {v}" for k, v in cp.items()]
        elif isinstance(cp, str):
            data["color_palette"] = [x.strip() for x in cp.split(",") if x.strip()]
        elif not isinstance(cp, list):
            data["color_palette"] = ["#1A365D", "#2B6CB0", "#E2E8F0"]

        # Normalize string fields that LLM might return as dicts or lists
        for str_field in ["text_overlay_spec", "composition", "visual_concept", "lighting_mood", "asset_type", "aspect_ratio"]:
            val = data.get(str_field)
            if isinstance(val, dict):
                data[str_field] = ", ".join(f"{k}: {v}" for k, v in val.items())
            elif isinstance(val, list):
                data[str_field] = ", ".join(str(x) for x in val)
            elif val is None or not str(val).strip():
                if str_field == "aspect_ratio":
                    data[str_field] = "1:1"
                elif str_field == "asset_type":
                    data[str_field] = "digital graphic"
                else:
                    data[str_field] = "Standard brand visual specification"
        return data


CREATIVE_SYSTEM_PROMPT = """You are the Creative Director of a digital marketing agency.
Your task is to design evocative, production-ready visual creative briefs for social media posts.

ASPECT RATIO MATRIX:
- 'short_form': 9:16 vertical format (mobile-first, high motion, dynamic overlays).
- 'community_forum': 16:9 landscape or 4:3 documentary style (candid, authentic, non-commercial).
- 'professional': 1:1 or 4:5 clean minimalist studio graphic or executive portrait.

GUIDELINES:
- Provide rich sensory descriptions of composition, textures, focal points, and lighting.
- Specify exact text overlay styling and placement.
- Output ONLY valid JSON conforming to the CreativeBrief schema.
"""


class CreativeAgent(BaseAgent):
    def __init__(self, llm_client=None, bus=None):
        super().__init__(
            name="CreativeAgent",
            system_prompt=CREATIVE_SYSTEM_PROMPT,
            temperature=0.6,
            model_tier="primary",
            llm_client=llm_client,
            bus=bus,
        )

    def generate_brief(
        self,
        post_copy: str,
        channel: str,
        campaign_name: str,
        campaign_id: Optional[str] = None,
        week_number: Optional[int] = None,
        post_id: Optional[str] = None,
    ) -> CreativeBrief:
        """Create a text-only visual brief for a given post."""
        context = {
            "channel": channel,
            "campaign_name": campaign_name,
            "week_number": week_number or 1,
        }

        prompt = (
            f"CAMPAIGN: {campaign_name}\n"
            f"CHANNEL: {channel}\n"
            f"POST COPY:\n\"{post_copy}\"\n\n"
            "TASK: Design a complete, text-only visual creative brief to accompany this post. "
            "Ensure the aspect ratio, lighting mood, and composition align with the channel's culture."
        )

        resp = self._call_llm(
            prompt=prompt,
            schema_validator=CreativeBrief,
            context=context,
        )

        brief_data = resp.parsed_json or {}
        brief = CreativeBrief(**brief_data)

        self._publish(
            recipient="ChiefOfStaff",
            message_type=MessageType.CREATIVE_BRIEF,
            payload=brief.model_dump(),
            campaign_id=campaign_id,
            week_number=week_number,
            post_id=post_id,
            token_usage={"prompt_tokens": resp.prompt_tokens, "eval_tokens": resp.eval_tokens, "total_tokens": resp.total_tokens},
        )

        return brief
