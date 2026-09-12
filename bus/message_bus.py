"""
Inter-Agent Message Bus

Architectural Decision: Synchronous vs. Asynchronous
-----------------------------------------------------
We deliberately implement a synchronous, in-memory + persisted Message Bus.
Why Synchronous?
1. Hardware Constraint: Local inference on a single 8GB VRAM GPU is constrained by
   the GPU execution context. Concurrent asynchronous calls to local Ollama instances
   cause serialization bottlenecks, context switching overhead, or GPU Out-Of-Memory (OOM).
2. Deterministic Traceability & Reproducibility: A social media campaign pipeline has
   strict causal dependencies (Brief -> Strategy -> Content -> Creative -> Compliance ->
   Approval -> Scheduling -> Simulation -> Community Moderation -> Analytics -> Strategy Re-planning).
   Synchronous dispatch ensures deterministic replay, clear linear stack traces, and trivial
   debugging during live evaluations.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Callable, Dict, List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from bus.events import AgentMessage, MessageType


class MessageBus:
    """
    Central synchronous message broker responsible for:
    - Routing messages between agents
    - Enforcing compliance rejection hard-caps (max 3 rejections)
    - Persisting all traces to SQLite and a JSONL file
    - Emitting formatted live trace logs to stdout
    """

    def __init__(
        self,
        db_path: str = "data/trace.db",
        jsonl_path: str = "logs/trace.jsonl",
        verbose: bool = True,
    ):
        self.db_path = db_path
        self.jsonl_path = jsonl_path
        self.verbose = verbose
        self.console = Console()
        self.handlers: Dict[str, List[Callable[[AgentMessage], None]]] = {}
        self.post_rejection_counts: Dict[str, int] = {}
        self.hard_rejection_cap = 3

        # Ensure directories exist
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        Path(self.jsonl_path).parent.mkdir(parents=True, exist_ok=True)

        self._init_sqlite()

    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()

    def _init_sqlite(self) -> None:
        """Initialize SQLite trace schema."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS message_traces (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    sender TEXT NOT NULL,
                    recipient TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    campaign_id TEXT,
                    week_number INTEGER,
                    post_id TEXT,
                    rejection_count INTEGER,
                    prompt_tokens INTEGER,
                    eval_tokens INTEGER,
                    total_tokens INTEGER,
                    payload_json TEXT NOT NULL,
                    metadata_json TEXT
                )
                """
            )
            conn.commit()

    def subscribe(self, recipient: str, handler: Callable[[AgentMessage], None]) -> None:
        """Subscribe an agent or handler to incoming messages addressed to it or '*'."""
        if recipient not in self.handlers:
            self.handlers[recipient] = []
        self.handlers[recipient].append(handler)

    def publish(self, message: AgentMessage) -> Optional[AgentMessage]:
        """
        Publish an agent message to the bus:
        1. Checks and tracks compliance rejection limits
        2. Persists to SQLite
        3. Appends to JSONL
        4. Prints formatted trace to stdout
        5. Dispatches to registered subscribers
        """
        # Track rejection counts if this is a compliance rejection
        if message.message_type == MessageType.COMPLIANCE_REJECTION and message.post_id:
            current_count = self.post_rejection_counts.get(message.post_id, 0) + 1
            self.post_rejection_counts[message.post_id] = current_count
            message.rejection_count = current_count

            if current_count >= self.hard_rejection_cap:
                message.metadata["permanently_excluded"] = True
                message.metadata["escalation_reason"] = (
                    f"Exceeded hard limit of {self.hard_rejection_cap} compliance rejections."
                )

        # Persist to SQLite
        self._persist_sqlite(message)

        # Persist to JSONL
        self._persist_jsonl(message)

        # Print live readable trace to stdout
        if self.verbose:
            self._print_trace(message)

        # Dispatch to specific recipient handlers and wildcard listeners
        recipients = [message.recipient, "*"]
        for r in recipients:
            for handler in self.handlers.get(r, []):
                handler(message)

        return message

    def _persist_sqlite(self, message: AgentMessage) -> None:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO message_traces (
                        message_id, timestamp, sender, recipient, message_type,
                        campaign_id, week_number, post_id, rejection_count,
                        prompt_tokens, eval_tokens, total_tokens,
                        payload_json, metadata_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        message.message_id,
                        message.timestamp,
                        message.sender,
                        message.recipient,
                        message.message_type.value,
                        message.campaign_id,
                        message.week_number,
                        message.post_id,
                        message.rejection_count,
                        message.token_usage.get("prompt_tokens", 0),
                        message.token_usage.get("eval_tokens", 0),
                        message.token_usage.get("total_tokens", 0),
                        json.dumps(message.payload, ensure_ascii=False),
                        json.dumps(message.metadata, ensure_ascii=False),
                    ),
                )
                conn.commit()
        except Exception as e:
            self.console.print(f"[bold red]Failed to persist message to SQLite:[/bold red] {e}")

    def _persist_jsonl(self, message: AgentMessage) -> None:
        try:
            with open(self.jsonl_path, "a", encoding="utf-8") as f:
                f.write(message.model_dump_json() + "\n")
        except Exception as e:
            self.console.print(f"[bold red]Failed to persist message to JSONL:[/bold red] {e}")

    def _print_trace(self, message: AgentMessage) -> None:
        """Pretty-print agent message to stdout with color-coded badges."""
        color_map = {
            "ChiefOfStaff": "bold cyan",
            "StrategyAgent": "bold blue",
            "ContentWriterAgent": "bold green",
            "CreativeAgent": "bold magenta",
            "ComplianceAgent": "bold yellow",
            "SchedulerAgent": "bold blue_violet",
            "CommunityManagerAgent": "bold orange3",
            "AnalyticsAgent": "bold bright_cyan",
            "MockPlatform": "bold purple",
            "HumanGate": "bold red",
            "MessageBus": "bold white",
        }

        sender_color = color_map.get(message.sender, "bold white")
        recipient_color = color_map.get(message.recipient, "bold white")

        # Format header
        time_str = message.timestamp.split("T")[-1][:8]
        header = Text()
        header.append(f"[{time_str}] ", style="dim")
        header.append(f"{message.sender}", style=sender_color)
        header.append(" -> ", style="bold white")
        header.append(f"{message.recipient}", style=recipient_color)
        header.append(f"  [{message.message_type.value}]", style="bold underline")

        if message.rejection_count > 0:
            header.append(f" (Rejection #{message.rejection_count}/{self.hard_rejection_cap})", style="bold red")

        # Create concise preview of payload
        keys = list(message.payload.keys())
        summary_items = []
        for k in keys[:4]:
            val = message.payload[k]
            if isinstance(val, str):
                summary_items.append(f"{k}: \"{val[:60]}{'...' if len(val) > 60 else ''}\"")
            elif isinstance(val, (int, float, bool)):
                summary_items.append(f"{k}: {val}")
            elif isinstance(val, list):
                summary_items.append(f"{k}: [{len(val)} items]")
            elif isinstance(val, dict):
                summary_items.append(f"{k}: {{{len(val)} keys}}")

        summary_text = " | ".join(summary_items) if summary_items else "{}"

        # Border color based on message type
        border_style = "green"
        if "REJECT" in message.message_type.value or "ESCALAT" in message.message_type.value:
            border_style = "red"
        elif "APPROVAL" in message.message_type.value:
            border_style = "bright_green"
        elif "ANALYTICS" in message.message_type.value:
            border_style = "cyan"

        self.console.print(
            Panel(
                Text(summary_text, style="white"),
                title=header,
                border_style=border_style,
                padding=(0, 1),
            )
        )

    def is_post_permanently_rejected(self, post_id: str) -> bool:
        """Returns True if the post exceeded the hard rejection cap."""
        return self.post_rejection_counts.get(post_id, 0) >= self.hard_rejection_cap

    def get_traces(self, limit: int = 50) -> List[Dict]:
        """Fetch historical traces from SQLite for inspection."""
        with self._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT * FROM message_traces
                ORDER BY id ASC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
