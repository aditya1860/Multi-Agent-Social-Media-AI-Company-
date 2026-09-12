"""
Social Media Multi-Agent System CLI Entry Point (cli.py)

Commands:
  demo           Run the complete 2-week multi-agent marketing campaign end-to-end.
  view-feed      Inspect the published posts, metrics, and comments on the mock platform.
  view-trace     Inspect historical agent-to-agent message traces and token usage.
  start-platform Run the standalone FastAPI mock social media server.
"""

import argparse
import os
import sys
from typing import Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

# Default seed brief
DEFAULT_SEED_BRIEF = (
    "Launch campaign for EcoGlow: an ultra-compact modular solar lantern engineered with "
    "recycled ocean plastic and solid-state solar cells for backpackers, vanlifers, and "
    "eco-conscious outdoor enthusiasts. Objectives: 2-week social awareness campaign to "
    "establish authentic community trust, educate on durability benchmarks, and drive early "
    "waitlist pre-orders."
)


def run_demo(args: argparse.Namespace) -> None:
    console = Console()
    console.print(
        Panel.fit(
            "[bold green]PRODIGAL AI MULTI-AGENT SOCIAL MEDIA SYSTEM[/bold green]\n"
            "[cyan]Autonomous Local Multi-Agent Marketing Agency[/cyan]\n"
            "[dim]Powered by Local LLM (Ollama) & Offline Deterministic Stub Fallback[/dim]",
            border_style="green",
        )
    )

    if args.offline:
        os.environ["SOCIAL_AI_OFFLINE"] = "1"
        console.print("[bold yellow][CONFIG] Forcing SOCIAL_AI_OFFLINE=1 (Deterministic Stub Mode)[/bold yellow]")

    from orchestrator import CampaignOrchestrator

    orchestrator = CampaignOrchestrator()
    brief = args.brief or DEFAULT_SEED_BRIEF
    campaign_id = args.campaign_id or "camp_ecoglow_demo"

    console.print(f"\n[bold]Client Brief:[/bold]\n[italic white]{brief}[/italic white]\n")

    result = orchestrator.run_campaign(
        raw_brief=brief,
        campaign_id=campaign_id,
        auto_approve=args.auto_approve,
    )

    console.print("\n[bold green][SUCCESS] Demo execution finished successfully![/bold green]")
    console.print(
        f"[dim]Run 'python cli.py view-feed --campaign-id {campaign_id}' to inspect published posts.\n"
        f"Run 'python cli.py view-trace' to inspect inter-agent message logs.[/dim]\n"
    )


def run_view_feed(args: argparse.Namespace) -> None:
    console = Console()
    from mock_platform.database import PlatformDatabase

    db = PlatformDatabase()
    posts = db.get_posts_by_campaign(args.campaign_id, args.week) if args.campaign_id else db.get_all_posts(args.channel)

    if not posts:
        console.print("[yellow]No posts found matching the specified criteria.[/yellow]")
        return

    console.print(f"\n[bold cyan]=== MOCK SOCIAL MEDIA FEED ({len(posts)} Posts) ===[/bold cyan]\n")

    for post in posts[: args.limit]:
        metrics = post.metrics
        channel_badges = {
            "short_form": "[bold red]QuickPulse (Short-Form)[/bold red]",
            "community_forum": "[bold yellow]NexusForum (Community)[/bold yellow]",
            "professional": "[bold blue]ProSphere (Professional)[/bold blue]",
        }
        badge = channel_badges.get(post.channel, f"[bold]{post.channel}[/bold]")

        post_tree = Tree(f"{badge} | [dim]Post ID: {post.post_id} | Week {post.week_number}, Day {post.day_of_week} ({post.scheduled_time})[/dim]")
        
        # Copy & tags
        post_tree.add(f"[bold white]Copy:[/bold white] {post.copy}")
        post_tree.add(f"[green]Hashtags:[/green] {' '.join(post.hashtags)} | [yellow]CTA:[/yellow] {post.cta_type}")
        
        # Creative brief summary
        cb = post.creative_brief
        if cb:
            cb_branch = post_tree.add("[magenta]Creative Visual Brief:[/magenta]")
            cb_branch.add(f"[dim]Asset:[/dim] {cb.get('asset_type', 'N/A')} ({cb.get('aspect_ratio', 'N/A')})")
            cb_branch.add(f"[dim]Concept:[/dim] {cb.get('visual_concept', 'N/A')[:90]}...")
            cb_branch.add(f"[dim]Lighting:[/dim] {cb.get('lighting_mood', 'N/A')}")

        # Metrics box
        metrics_line = (
            f"[bold cyan]Impressions:[/bold cyan] {metrics.impressions:,} | "
            f"[bold green]Likes:[/bold green] {metrics.likes} | "
            f"[bold yellow]Shares:[/bold yellow] {metrics.shares} | "
            f"[bold magenta]Comments:[/bold magenta] {metrics.comments_count} | "
            f"[bold]Eng Rate:[/bold] {metrics.engagement_rate * 100:.2f}% | "
            f"[bold]Sentiment:[/bold] {metrics.sentiment_score}"
        )
        post_tree.add(metrics_line)

        # Threaded Comments
        if post.comments:
            comm_branch = post_tree.add(f"[bold orange3]Comments ({len(post.comments)}):[/bold orange3]")
            for c in post.comments:
                if c.is_agent_reply:
                    comm_branch.add(f"  --> [bold green]@[{c.author}] (Official Agent Reply):[/bold green] [italic]{c.text}[/italic]")
                elif c.has_risk_keyword:
                    comm_branch.add(f"  * [bold red]@[{c.author}] [ESCALATED - {c.risk_keyword}]:[/bold red] {c.text}")
                else:
                    comm_branch.add(f"  * [cyan]@[{c.author}]:[/cyan] {c.text} [dim]({c.sentiment})[/dim]")

        console.print(Panel(post_tree, border_style="blue", padding=(0, 1)))
        console.print()


def run_view_trace(args: argparse.Namespace) -> None:
    console = Console()
    from bus.message_bus import MessageBus

    bus = MessageBus()
    traces = bus.get_traces(limit=args.limit)

    if not traces:
        console.print("[yellow]No message traces found in SQLite trace store.[/yellow]")
        return

    table = Table(
        title=f"Inter-Agent Message Bus Traces (Most Recent {len(traces)})",
        border_style="bright_cyan",
    )
    table.add_column("Seq", justify="right", style="dim")
    table.add_column("Time", style="dim")
    table.add_column("Sender", style="bold green")
    table.add_column("Recipient", style="bold magenta")
    table.add_column("Message Type", style="bold yellow")
    table.add_column("Rej #", justify="center", style="bold red")
    table.add_column("Tokens", justify="right", style="cyan")
    table.add_column("Payload Preview", style="white", max_width=40)

    for t in traces:
        payload_prev = t.get("payload_json", "{}")[:40] + "..."
        table.add_row(
            str(t.get("id")),
            str(t.get("timestamp", "")).split("T")[-1][:8],
            t.get("sender", ""),
            t.get("recipient", ""),
            t.get("message_type", ""),
            str(t.get("rejection_count", 0)),
            str(t.get("total_tokens", 0)),
            payload_prev,
        )

    console.print(Panel(table, border_style="cyan"))


def run_start_platform(args: argparse.Namespace) -> None:
    import uvicorn

    console = Console()
    console.print(
        f"[bold green]Starting Mock Social Media Platform API on http://127.0.0.1:{args.port}...[/bold green]"
    )
    console.print("[dim]Access interactive Swagger API docs at http://127.0.0.1:8000/docs[/dim]\n")
    uvicorn.run("mock_platform.app:app", host="127.0.0.1", port=args.port, reload=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Multi-Agent Social Media Management System (Prodigal AI Task 1)"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available subcommands")

    # Command: demo
    demo_parser = subparsers.add_parser(
        "demo", help="Run full 2-week campaign lifecycle end-to-end"
    )
    demo_parser.add_argument(
        "--brief", type=str, default=None, help="Custom client marketing brief"
    )
    demo_parser.add_argument(
        "--campaign-id", type=str, default="camp_ecoglow_demo", help="Campaign ID identifier"
    )
    demo_parser.add_argument(
        "--auto-approve", action="store_true", help="Auto-approve campaign at the human gate"
    )
    demo_parser.add_argument(
        "--offline", action="store_true", help="Force offline deterministic stub mode"
    )

    # Command: view-feed
    feed_parser = subparsers.add_parser(
        "view-feed", help="View mock social media feed and metrics"
    )
    feed_parser.add_argument("--channel", type=str, default=None, help="Filter by channel")
    feed_parser.add_argument(
        "--campaign-id", type=str, default=None, help="Filter by campaign ID"
    )
    feed_parser.add_argument(
        "--week", type=int, default=None, help="Filter by campaign week number"
    )
    feed_parser.add_argument(
        "--limit", type=int, default=20, help="Maximum number of posts to display"
    )

    # Command: view-trace
    trace_parser = subparsers.add_parser(
        "view-trace", help="View inter-agent communication message traces"
    )
    trace_parser.add_argument(
        "--limit", type=int, default=30, help="Number of trace entries to show"
    )

    # Command: start-platform
    platform_parser = subparsers.add_parser(
        "start-platform", help="Start standalone mock platform FastAPI server"
    )
    platform_parser.add_argument(
        "--port", type=int, default=8000, help="Port to bind server (default 8000)"
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "demo":
        run_demo(args)
    elif args.command == "view-feed":
        run_view_feed(args)
    elif args.command == "view-trace":
        run_view_trace(args)
    elif args.command == "start-platform":
        run_start_platform(args)


if __name__ == "__main__":
    main()
