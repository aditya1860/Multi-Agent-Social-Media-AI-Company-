"""
Persistent Relational Memory Store (memory/memory_store.py)

Architectural Justification: SQLite vs. Vector DB / RAG
-------------------------------------------------------
At the scale of multi-week social media campaign iterations (weeks 1 to 4, dozens
of posts, concise weekly strategic synthesis), episodic memory is purely structured
relational data indexed by (campaign_id, week_number).

Why NOT a Vector DB?
1. Deterministic Recall: Strategy and Scheduler agents need exact, unadulterated access
   to the prior week's specific numerical findings (e.g. 'Shift short-form to 19:30 PM')
   rather than fuzzy, hallucinated semantic cosine-similarity approximations.
2. Zero Hardware Footprint: Avoids loading a local embedding model (e.g. bge or all-MiniLM)
   which would consume ~500MB-1GB of precious VRAM and compute cycles on an 8GB GPU.
3. Zero Dependency Overhead: SQLite is built into Python standard library and provides
   instantaneous, transactional ACID storage.
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class WeeklyInsightRecord(BaseModel):
    campaign_id: str
    week_number: int
    timestamp: str
    kpi_verdict: str
    top_performing_patterns: List[str]
    underperforming_patterns: List[str]
    actionable_recommendations: List[str]
    best_timing_slots: Dict[str, str] = {}
    metrics_summary: Dict[str, Any] = {}


class MemoryStore:
    def __init__(self, db_path: str = "data/memory.db"):
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
                CREATE TABLE IF NOT EXISTS campaign_weekly_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    campaign_id TEXT NOT NULL,
                    week_number INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    kpi_verdict TEXT NOT NULL,
                    top_patterns_json TEXT NOT NULL,
                    underperforming_patterns_json TEXT NOT NULL,
                    recommendations_json TEXT NOT NULL,
                    best_timing_slots_json TEXT NOT NULL,
                    metrics_summary_json TEXT NOT NULL,
                    UNIQUE(campaign_id, week_number)
                )
                """
            )
            conn.commit()

    def save_weekly_insights(
        self,
        campaign_id: str,
        week_number: int,
        kpi_verdict: str,
        top_patterns: List[str],
        underperforming_patterns: List[str],
        actionable_recommendations: List[str],
        best_timing_slots: Optional[Dict[str, str]] = None,
        metrics_summary: Optional[Dict[str, Any]] = None,
    ) -> WeeklyInsightRecord:
        now_iso = datetime.now(timezone.utc).isoformat()
        timing_slots = best_timing_slots or {
            "short_form": "19:30:00",
            "professional": "09:15:00",
            "community_forum": "18:00:00",
        }
        metrics = metrics_summary or {}

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO campaign_weekly_memory (
                    campaign_id, week_number, timestamp, kpi_verdict,
                    top_patterns_json, underperforming_patterns_json,
                    recommendations_json, best_timing_slots_json, metrics_summary_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    campaign_id,
                    week_number,
                    now_iso,
                    kpi_verdict,
                    json.dumps(top_patterns, ensure_ascii=False),
                    json.dumps(underperforming_patterns, ensure_ascii=False),
                    json.dumps(actionable_recommendations, ensure_ascii=False),
                    json.dumps(timing_slots, ensure_ascii=False),
                    json.dumps(metrics, ensure_ascii=False),
                ),
            )
            conn.commit()

        return WeeklyInsightRecord(
            campaign_id=campaign_id,
            week_number=week_number,
            timestamp=now_iso,
            kpi_verdict=kpi_verdict,
            top_performing_patterns=top_patterns,
            underperforming_patterns=underperforming_patterns,
            actionable_recommendations=actionable_recommendations,
            best_timing_slots=timing_slots,
            metrics_summary=metrics,
        )

    def get_latest_insights(self, campaign_id: str) -> Optional[WeeklyInsightRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM campaign_weekly_memory
                WHERE campaign_id = ?
                ORDER BY week_number DESC
                LIMIT 1
                """,
                (campaign_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return WeeklyInsightRecord(
                campaign_id=row["campaign_id"],
                week_number=row["week_number"],
                timestamp=row["timestamp"],
                kpi_verdict=row["kpi_verdict"],
                top_performing_patterns=json.loads(row["top_patterns_json"]),
                underperforming_patterns=json.loads(row["underperforming_patterns_json"]),
                actionable_recommendations=json.loads(row["recommendations_json"]),
                best_timing_slots=json.loads(row["best_timing_slots_json"]),
                metrics_summary=json.loads(row["metrics_summary_json"]),
            )

    def get_insights(self, campaign_id: str, week_number: int) -> Optional[WeeklyInsightRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM campaign_weekly_memory
                WHERE campaign_id = ? AND week_number = ?
                """,
                (campaign_id, week_number),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return WeeklyInsightRecord(
                campaign_id=row["campaign_id"],
                week_number=row["week_number"],
                timestamp=row["timestamp"],
                kpi_verdict=row["kpi_verdict"],
                top_performing_patterns=json.loads(row["top_patterns_json"]),
                underperforming_patterns=json.loads(row["underperforming_patterns_json"]),
                actionable_recommendations=json.loads(row["recommendations_json"]),
                best_timing_slots=json.loads(row["best_timing_slots_json"]),
                metrics_summary=json.loads(row["metrics_summary_json"]),
            )
