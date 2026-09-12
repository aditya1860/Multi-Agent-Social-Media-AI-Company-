"""
Database layer for the Mock Social Media Platform using SQLite.
"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional
from mock_platform.models import CommentRecord, PostMetrics, PostRecord


class PlatformDatabase:
    def __init__(self, db_path: str = "data/mock_platform.db"):
        self.db_path = db_path
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS platform_posts (
                    post_id TEXT PRIMARY KEY,
                    campaign_id TEXT NOT NULL,
                    week_number INTEGER NOT NULL,
                    day_of_week INTEGER NOT NULL,
                    channel TEXT NOT NULL,
                    copy TEXT NOT NULL,
                    creative_brief_json TEXT NOT NULL,
                    scheduled_time TEXT NOT NULL,
                    hashtags_json TEXT NOT NULL,
                    cta_type TEXT NOT NULL,
                    format_type TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS platform_metrics (
                    post_id TEXT PRIMARY KEY,
                    impressions INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    shares INTEGER DEFAULT 0,
                    comments_count INTEGER DEFAULT 0,
                    clicks INTEGER DEFAULT 0,
                    engagement_rate REAL DEFAULT 0.0,
                    sentiment_score REAL DEFAULT 0.0,
                    simulated INTEGER DEFAULT 0,
                    FOREIGN KEY (post_id) REFERENCES platform_posts (post_id)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS platform_comments (
                    comment_id TEXT PRIMARY KEY,
                    post_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    sentiment TEXT NOT NULL,
                    has_risk_keyword INTEGER DEFAULT 0,
                    risk_keyword TEXT,
                    is_agent_reply INTEGER DEFAULT 0,
                    parent_comment_id TEXT,
                    FOREIGN KEY (post_id) REFERENCES platform_posts (post_id)
                )
                """
            )
            conn.commit()

    def insert_post(self, post: PostRecord) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO platform_posts (
                    post_id, campaign_id, week_number, day_of_week, channel,
                    copy, creative_brief_json, scheduled_time, hashtags_json,
                    cta_type, format_type, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    post.post_id,
                    post.campaign_id,
                    post.week_number,
                    post.day_of_week,
                    post.channel,
                    post.copy,
                    json.dumps(post.creative_brief, ensure_ascii=False),
                    post.scheduled_time,
                    json.dumps(post.hashtags, ensure_ascii=False),
                    post.cta_type,
                    post.format_type,
                    post.created_at,
                ),
            )
            cursor.execute(
                """
                INSERT OR REPLACE INTO platform_metrics (
                    post_id, impressions, likes, shares, comments_count,
                    clicks, engagement_rate, sentiment_score, simulated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    post.post_id,
                    post.metrics.impressions,
                    post.metrics.likes,
                    post.metrics.shares,
                    post.metrics.comments_count,
                    post.metrics.clicks,
                    post.metrics.engagement_rate,
                    post.metrics.sentiment_score,
                    1 if post.metrics.simulated else 0,
                ),
            )
            conn.commit()

    def update_metrics(self, metrics: PostMetrics) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE platform_metrics
                SET impressions = ?, likes = ?, shares = ?, comments_count = ?,
                    clicks = ?, engagement_rate = ?, sentiment_score = ?, simulated = 1
                WHERE post_id = ?
                """,
                (
                    metrics.impressions,
                    metrics.likes,
                    metrics.shares,
                    metrics.comments_count,
                    metrics.clicks,
                    metrics.engagement_rate,
                    metrics.sentiment_score,
                    metrics.post_id,
                ),
            )
            conn.commit()

    def insert_comment(self, comment: CommentRecord) -> None:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO platform_comments (
                    comment_id, post_id, author, text, created_at,
                    sentiment, has_risk_keyword, risk_keyword, is_agent_reply, parent_comment_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    comment.comment_id,
                    comment.post_id,
                    comment.author,
                    comment.text,
                    comment.created_at,
                    comment.sentiment,
                    1 if comment.has_risk_keyword else 0,
                    comment.risk_keyword,
                    1 if comment.is_agent_reply else 0,
                    comment.parent_comment_id,
                ),
            )
            # Increment comment count in metrics
            cursor.execute(
                """
                UPDATE platform_metrics
                SET comments_count = comments_count + 1
                WHERE post_id = ?
                """,
                (comment.post_id,),
            )
            conn.commit()

    def get_post(self, post_id: str) -> Optional[PostRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT p.*, m.impressions, m.likes, m.shares, m.comments_count,
                       m.clicks, m.engagement_rate, m.sentiment_score, m.simulated
                FROM platform_posts p
                LEFT JOIN platform_metrics m ON p.post_id = m.post_id
                WHERE p.post_id = ?
                """,
                (post_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return self._build_post_record(row, conn)

    def get_posts_by_campaign(
        self, campaign_id: str, week_number: Optional[int] = None
    ) -> List[PostRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if week_number is not None:
                cursor.execute(
                    """
                    SELECT p.*, m.impressions, m.likes, m.shares, m.comments_count,
                           m.clicks, m.engagement_rate, m.sentiment_score, m.simulated
                    FROM platform_posts p
                    LEFT JOIN platform_metrics m ON p.post_id = m.post_id
                    WHERE p.campaign_id = ? AND p.week_number = ?
                    ORDER BY p.day_of_week ASC
                    """,
                    (campaign_id, week_number),
                )
            else:
                cursor.execute(
                    """
                    SELECT p.*, m.impressions, m.likes, m.shares, m.comments_count,
                           m.clicks, m.engagement_rate, m.sentiment_score, m.simulated
                    FROM platform_posts p
                    LEFT JOIN platform_metrics m ON p.post_id = m.post_id
                    WHERE p.campaign_id = ?
                    ORDER BY p.week_number ASC, p.day_of_week ASC
                    """,
                    (campaign_id,),
                )
            rows = cursor.fetchall()
            return [self._build_post_record(row, conn) for row in rows]

    def get_all_posts(self, channel: Optional[str] = None) -> List[PostRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if channel:
                cursor.execute(
                    """
                    SELECT p.*, m.impressions, m.likes, m.shares, m.comments_count,
                           m.clicks, m.engagement_rate, m.sentiment_score, m.simulated
                    FROM platform_posts p
                    LEFT JOIN platform_metrics m ON p.post_id = m.post_id
                    WHERE p.channel = ?
                    ORDER BY p.created_at DESC
                    """,
                    (channel,),
                )
            else:
                cursor.execute(
                    """
                    SELECT p.*, m.impressions, m.likes, m.shares, m.comments_count,
                           m.clicks, m.engagement_rate, m.sentiment_score, m.simulated
                    FROM platform_posts p
                    LEFT JOIN platform_metrics m ON p.post_id = m.post_id
                    ORDER BY p.created_at DESC
                    """
                )
            rows = cursor.fetchall()
            return [self._build_post_record(row, conn) for row in rows]

    def get_comments_for_post(self, post_id: str) -> List[CommentRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM platform_comments
                WHERE post_id = ?
                ORDER BY created_at ASC
                """,
                (post_id,),
            )
            rows = cursor.fetchall()
            return [
                CommentRecord(
                    comment_id=r["comment_id"],
                    post_id=r["post_id"],
                    author=r["author"],
                    text=r["text"],
                    created_at=r["created_at"],
                    sentiment=r["sentiment"],
                    has_risk_keyword=bool(r["has_risk_keyword"]),
                    risk_keyword=r["risk_keyword"],
                    is_agent_reply=bool(r["is_agent_reply"]),
                    parent_comment_id=r["parent_comment_id"],
                )
                for r in rows
            ]

    def _build_post_record(self, row: sqlite3.Row, conn: sqlite3.Connection) -> PostRecord:
        post_id = row["post_id"]
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM platform_comments WHERE post_id = ? ORDER BY created_at ASC",
            (post_id,),
        )
        comm_rows = cursor.fetchall()
        comments = [
            CommentRecord(
                comment_id=cr["comment_id"],
                post_id=cr["post_id"],
                author=cr["author"],
                text=cr["text"],
                created_at=cr["created_at"],
                sentiment=cr["sentiment"],
                has_risk_keyword=bool(cr["has_risk_keyword"]),
                risk_keyword=cr["risk_keyword"],
                is_agent_reply=bool(cr["is_agent_reply"]),
                parent_comment_id=cr["parent_comment_id"],
            )
            for cr in comm_rows
        ]

        metrics = PostMetrics(
            post_id=post_id,
            impressions=row["impressions"] or 0,
            likes=row["likes"] or 0,
            shares=row["shares"] or 0,
            comments_count=row["comments_count"] or 0,
            clicks=row["clicks"] or 0,
            engagement_rate=row["engagement_rate"] or 0.0,
            sentiment_score=row["sentiment_score"] or 0.0,
            simulated=bool(row["simulated"]),
        )

        return PostRecord(
            post_id=post_id,
            campaign_id=row["campaign_id"],
            week_number=row["week_number"],
            day_of_week=row["day_of_week"],
            channel=row["channel"],
            copy=row["copy"],
            creative_brief=json.loads(row["creative_brief_json"]),
            scheduled_time=row["scheduled_time"],
            hashtags=json.loads(row["hashtags_json"]),
            cta_type=row["cta_type"],
            format_type=row["format_type"],
            created_at=row["created_at"],
            metrics=metrics,
            comments=comments,
        )
