"""
Base Agent Class (agents/base_agent.py)

Standard foundation for all 8 specialized agents providing:
- Distinct role identity & system prompt configuration
- Dedicated temperature setting
- Bus publication & event handling
- Safe structured invocation with token tracking
"""

from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel
from bus.events import AgentMessage, MessageType
from bus.message_bus import MessageBus
from agents.llm_client import LLMClient, LLMResponse


class BaseAgent:
    """
    Abstract base for all specialized autonomous agents in the multi-agent system.
    """

    def __init__(
        self,
        name: str,
        system_prompt: str,
        temperature: float = 0.7,
        model_tier: str = "primary",  # "primary" (7B-8B) or "fast" (3B)
        llm_client: Optional[LLMClient] = None,
        bus: Optional[MessageBus] = None,
    ):
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model_tier = model_tier
        self.llm_client = llm_client or LLMClient()
        self.bus = bus

    def _call_llm(
        self,
        prompt: str,
        schema_validator: Optional[Type[BaseModel]] = None,
        context: Optional[Dict[str, Any]] = None,
        json_enforced: bool = True,
    ) -> LLMResponse:
        """Standardized call to local model abstraction layer."""
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]

        return self.llm_client.generate(
            messages=messages,
            temperature=self.temperature,
            model_tier=self.model_tier,
            json_enforced=json_enforced,
            schema_validator=schema_validator,
            agent_role=self.name,
            context=context,
        )

    def _publish(
        self,
        recipient: str,
        message_type: MessageType,
        payload: Dict[str, Any],
        campaign_id: Optional[str] = None,
        week_number: Optional[int] = None,
        post_id: Optional[str] = None,
        token_usage: Optional[Dict[str, int]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AgentMessage:
        """Helper to create and dispatch a message via the message bus."""
        msg = AgentMessage(
            sender=self.name,
            recipient=recipient,
            message_type=message_type,
            payload=payload,
            campaign_id=campaign_id,
            week_number=week_number,
            post_id=post_id,
            token_usage=token_usage or {"prompt_tokens": 0, "eval_tokens": 0, "total_tokens": 0},
            metadata=metadata or {},
        )
        if self.bus:
            self.bus.publish(msg)
        return msg
