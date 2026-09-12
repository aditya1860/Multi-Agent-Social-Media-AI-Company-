"""
Event and message definitions for the Inter-Agent Message Bus.
All communications between agents are standardized as typed messages.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
import uuid


class MessageType(str, Enum):
    BRIEF = "BRIEF"
    TASK_ASSIGNMENT = "TASK_ASSIGNMENT"
    STRATEGY_OUTPUT = "STRATEGY_OUTPUT"
    CONTENT_DRAFT = "CONTENT_DRAFT"
    CREATIVE_BRIEF = "CREATIVE_BRIEF"
    COMPLIANCE_REVIEW = "COMPLIANCE_REVIEW"
    COMPLIANCE_REJECTION = "COMPLIANCE_REJECTION"
    COMPLIANCE_APPROVAL = "COMPLIANCE_APPROVAL"
    REVISION_REQUEST = "REVISION_REQUEST"
    HUMAN_APPROVAL_REQUEST = "HUMAN_APPROVAL_REQUEST"
    HUMAN_DECISION = "HUMAN_DECISION"
    SCHEDULE_PUBLISH = "SCHEDULE_PUBLISH"
    ENGAGEMENT_SIMULATION = "ENGAGEMENT_SIMULATION"
    COMMUNITY_TRIAGE = "COMMUNITY_TRIAGE"
    COMMUNITY_ESCALATION = "COMMUNITY_ESCALATION"
    ANALYTICS_REPORT = "ANALYTICS_REPORT"
    MEMORY_UPDATE = "MEMORY_UPDATE"
    SYSTEM_NOTIFICATION = "SYSTEM_NOTIFICATION"


class AgentMessage(BaseModel):
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    sender: str
    recipient: str
    message_type: MessageType
    payload: Dict[str, Any]
    campaign_id: Optional[str] = None
    week_number: Optional[int] = None
    post_id: Optional[str] = None
    rejection_count: int = 0
    token_usage: Dict[str, int] = Field(
        default_factory=lambda: {"prompt_tokens": 0, "eval_tokens": 0, "total_tokens": 0}
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)
