"""
Mock Social Media Platform: FastAPI Application

Provides REST endpoints for:
- Publishing posts to 3 channels (short_form, community_forum, professional)
- Reading the live social feed and metrics
- Commenting and threaded replies
- Simulating deterministic audience engagement (powered by EngagementEngine)
- Conveniencing analytics rollups for the Analytics Agent
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from mock_platform.channels import CHANNELS
from mock_platform.database import PlatformDatabase
from mock_platform.engagement_engine import EngagementEngine
from mock_platform.models import (
    CommentRecord,
    PostCommentRequest,
    PostCreateRequest,
    PostMetrics,
    PostRecord,
    WeeklyAnalyticsResponse,
)

app = FastAPI(
    title="Mock Social Media Platform API",
    description="Autonomous local testbed for multi-agent social media publishing and engagement.",
    version="1.0.0",
)

db = PlatformDatabase()
engine = EngagementEngine(seed=42)


@app.get("/", include_in_schema=False)
def root():
    """Redirect root path directly to interactive Swagger API documentation."""
    return RedirectResponse(url="/docs")


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)


@app.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok", "platform": "MockSocialPlatform"}


@app.get("/channels")
def get_channels() -> Dict[str, Any]:
    return {k: v.model_dump() for k, v in CHANNELS.items()}


@app.post("/posts", response_model=PostRecord)
def publish_post(request: PostCreateRequest) -> PostRecord:
    if request.channel not in CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel '{request.channel}'. Must be one of: {list(CHANNELS.keys())}",
        )

    post_id = f"post_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    initial_metrics = PostMetrics(post_id=post_id, simulated=False)

    post = PostRecord(
        post_id=post_id,
        campaign_id=request.campaign_id,
        week_number=request.week_number,
        day_of_week=request.day_of_week,
        channel=request.channel,
        copy=request.copy,
        creative_brief=request.creative_brief,
        scheduled_time=request.scheduled_time,
        hashtags=request.hashtags,
        cta_type=request.cta_type,
        format_type=request.format_type,
        created_at=now_iso,
        metrics=initial_metrics,
        comments=[],
    )

    db.insert_post(post)
    return post


@app.get("/posts", response_model=List[PostRecord])
def list_posts(
    channel: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    week_number: Optional[int] = Query(None),
) -> List[PostRecord]:
    if campaign_id:
        return db.get_posts_by_campaign(campaign_id, week_number)
    return db.get_all_posts(channel)


@app.get("/posts/{post_id}", response_model=PostRecord)
def get_post(post_id: str) -> PostRecord:
    post = db.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@app.get("/posts/{post_id}/comments", response_model=List[CommentRecord])
def get_comments(post_id: str) -> List[CommentRecord]:
    post = db.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return db.get_comments_for_post(post_id)


@app.post("/posts/{post_id}/comments", response_model=CommentRecord)
def add_comment(post_id: str, request: PostCommentRequest) -> CommentRecord:
    post = db.get_post(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    risk_keywords = ["refund", "lawsuit", "unsafe", "injury", "scam", "sue", "toxic"]
    detected_risk = None
    for kw in risk_keywords:
        if kw in request.text.lower():
            detected_risk = kw
            break

    comment_id = f"comm_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now(timezone.utc).isoformat()

    sentiment = "neutral"
    if detected_risk or any(neg in request.text.lower() for neg in ["terrible", "hate", "fake", "broken"]):
        sentiment = "negative"
    elif any(pos in request.text.lower() for pos in ["love", "great", "awesome", "solid", "thanks"]):
        sentiment = "positive"

    comment = CommentRecord(
        comment_id=comment_id,
        post_id=post_id,
        author=request.author,
        text=request.text,
        created_at=now_iso,
        sentiment=sentiment,
        has_risk_keyword=bool(detected_risk),
        risk_keyword=detected_risk,
        is_agent_reply=request.is_agent_reply,
        parent_comment_id=request.parent_comment_id,
    )

    db.insert_comment(comment)
    return comment


@app.post("/campaigns/{campaign_id}/simulate/{week}")
def simulate_week(campaign_id: str, week: int) -> Dict[str, Any]:
    """
    Simulates audience impressions, interactions, and comment generation
    for all posts published in the specified campaign week.
    """
    posts = db.get_posts_by_campaign(campaign_id, week)
    if not posts:
        raise HTTPException(
            status_code=404, detail=f"No posts found for campaign '{campaign_id}' week {week}"
        )

    # Group by channel to evaluate novelty decay
    channel_posts: Dict[str, List[PostRecord]] = {}
    simulated_count = 0

    for post in posts:
        history = channel_posts.get(post.channel, [])
        metrics, comments = engine.simulate_post(post, history)

        db.update_metrics(metrics)
        for comm in comments:
            db.insert_comment(comm)

        history.append(post)
        channel_posts[post.channel] = history
        simulated_count += 1

    return {
        "status": "success",
        "campaign_id": campaign_id,
        "week_number": week,
        "simulated_posts": simulated_count,
    }


@app.get("/campaigns/{campaign_id}/analytics/{week}", response_model=WeeklyAnalyticsResponse)
def get_weekly_analytics(campaign_id: str, week: int) -> WeeklyAnalyticsResponse:
    """
    Convenience endpoint for Analytics Agent: returns all posts,
    associated metrics, and comments for the week, plus pre-calculated totals.
    """
    posts = db.get_posts_by_campaign(campaign_id, week)

    total_impressions = sum(p.metrics.impressions for p in posts)
    total_likes = sum(p.metrics.likes for p in posts)
    total_shares = sum(p.metrics.shares for p in posts)
    total_comments = sum(p.metrics.comments_count for p in posts)
    total_clicks = sum(p.metrics.clicks for p in posts)

    overall_eng_rate = (
        round((total_likes + total_shares + total_comments) / total_impressions, 4)
        if total_impressions > 0
        else 0.0
    )

    raw_agg = {
        "total_posts": len(posts),
        "total_impressions": total_impressions,
        "total_likes": total_likes,
        "total_shares": total_shares,
        "total_comments": total_comments,
        "total_clicks": total_clicks,
        "overall_engagement_rate": overall_eng_rate,
    }

    return WeeklyAnalyticsResponse(
        campaign_id=campaign_id,
        week_number=week,
        total_posts=len(posts),
        posts=posts,
        raw_aggregated_metrics=raw_agg,
    )
