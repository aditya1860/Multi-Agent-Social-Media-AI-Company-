"""
Pydantic schemas and data models for Mock Social Media Platform.
"""

import uuid
import warnings
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# Silence harmless Pydantic v2 warning about field name "copy" shadowing deprecated BaseModel.copy()
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    message=r'.*shadows an attribute in parent "BaseModel".*',
)


class PostCreateRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    campaign_id: str
    week_number: int
    day_of_week: int  # 1 to 7
    channel: str
    copy: str
    creative_brief: Dict[str, Any]
    scheduled_time: str  # e.g. "19:30:00"
    hashtags: List[str] = Field(default_factory=list)
    cta_type: str = "value"  # "urgency", "question", "value", "soft"
    format_type: str = "field_test"  # "field_test", "founder_story", "product_feature", "q_and_a"


class PostCommentRequest(BaseModel):
    author: str
    text: str
    is_agent_reply: bool = False
    parent_comment_id: Optional[str] = None


class CommentRecord(BaseModel):
    comment_id: str
    post_id: str
    author: str
    text: str
    created_at: str
    sentiment: str  # "positive", "neutral", "negative"
    has_risk_keyword: bool = False
    risk_keyword: Optional[str] = None
    is_agent_reply: bool = False
    parent_comment_id: Optional[str] = None


class PostMetrics(BaseModel):
    post_id: str
    impressions: int = 0
    likes: int = 0
    shares: int = 0
    comments_count: int = 0
    clicks: int = 0
    engagement_rate: float = 0.0
    sentiment_score: float = 0.0  # -1.0 to +1.0
    simulated: bool = False


class PostRecord(BaseModel):
    model_config = {"protected_namespaces": ()}
    post_id: str
    campaign_id: str
    week_number: int
    day_of_week: int
    channel: str
    copy: str
    creative_brief: Dict[str, Any]
    scheduled_time: str
    hashtags: List[str]
    cta_type: str
    format_type: str
    created_at: str
    metrics: PostMetrics
    comments: List[CommentRecord] = Field(default_factory=list)


class WeeklyAnalyticsResponse(BaseModel):
    campaign_id: str
    week_number: int
    total_posts: int
    posts: List[PostRecord]
    raw_aggregated_metrics: Dict[str, Any]
