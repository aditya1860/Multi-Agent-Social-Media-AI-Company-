"""
Generates high-resolution architecture diagram for the Multi-Agent Social Media System.
Saves to docs/architecture_diagram.png.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pathlib import Path


def generate_diagram(output_path: str = "docs/architecture_diagram.png") -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(16, 11), dpi=300)
    ax.set_facecolor("#0F172A")  # Deep Slate 900
    fig.patch.set_facecolor("#0F172A")

    # Helper function for drawing rounded boxes
    def draw_box(x, y, w, h, title, subtitle, color, text_color="white", alpha=0.9):
        rect = patches.FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.02,rounding_size=0.03",
            linewidth=1.8,
            edgecolor=color,
            facecolor=color,
            alpha=alpha,
        )
        ax.add_patch(rect)
        ax.text(
            x + w / 2,
            y + h * 0.62,
            title,
            color=text_color,
            fontsize=11,
            fontweight="bold",
            ha="center",
            va="center",
        )
        if subtitle:
            ax.text(
                x + w / 2,
                y + h * 0.32,
                subtitle,
                color="#CBD5E1",
                fontsize=8.5,
                ha="center",
                va="center",
            )

    # 1. Human Brief (Top Left)
    draw_box(0.04, 0.84, 0.22, 0.10, "Human Client Brief", "Unstructured Campaign Goals", "#334155")

    # 2. Chief of Staff (Center Top)
    draw_box(0.38, 0.84, 0.24, 0.10, "Chief of Staff Agent", "Decomposition, Routing, Gating", "#0284C7")

    # 3. Human Gate (Top Right)
    draw_box(0.74, 0.84, 0.22, 0.10, "Human Approval Gate", "Interactive CLI Sign-Off", "#DC2626")

    # 4. Central Message Bus (Mid Center)
    draw_box(0.04, 0.66, 0.92, 0.10, "Inter-Agent Synchronous Message Bus", "SQLite Persistence (trace.db) | JSONL Streaming | Hard Compliance Cap (Max 3)", "#1E293B")

    # 5. Core Specialist Agents (Row 1)
    draw_box(0.04, 0.46, 0.20, 0.13, "Strategy Agent", "Audience, Channel Mix, KPIs\nMemory Ingestion", "#2563EB")
    draw_box(0.28, 0.46, 0.20, 0.13, "Content Writer", "Per-Channel Copy & Hooks\nLine-Item Revisions", "#059669")
    draw_box(0.52, 0.46, 0.20, 0.13, "Creative Agent", "Visual Layouts & Lighting\nAspect Ratios (9:16/16:9)", "#7C3AED")
    draw_box(0.76, 0.46, 0.20, 0.13, "Compliance Agent", "Deterministic Banned Checks\n+ LLM Voice & Legal Review", "#D97706")

    # 6. Publishing, Platform & Evaluation (Row 2)
    draw_box(0.04, 0.24, 0.20, 0.14, "Scheduler Agent", "Optimal Window Selection\nPlatform API Publishing", "#4F46E5")
    draw_box(0.28, 0.20, 0.44, 0.18, "Mock Social Media Platform", "FastAPI + SQLite | 3 Channels: QuickPulse, Nexus, ProSphere\nEngagement Engine (8 Hidden Rules: Timing, Hashtags, CTAs)", "#0F766E")
    draw_box(0.76, 0.24, 0.20, 0.14, "Community Manager", "Deterministic Risk Gate\n+ LLM Comment Replies", "#C2410C")

    # 7. Analytics & Memory (Bottom)
    draw_box(0.04, 0.04, 0.44, 0.11, "Analytics Agent", "Deterministic Python Aggregation First\n-> LLM Causal Hypotheses & Quantified Changes", "#0891B2")
    draw_box(0.52, 0.04, 0.44, 0.11, "Persistent Memory Store", "SQLite (memory.db) Relational Storage\nFeeds Week 1 Performance into Week 2 Strategy", "#15803D")

    # Connecting Arrows
    arrow_style = dict(arrowstyle="->", lw=2.2, color="#38BDF8")
    accent_arrow = dict(arrowstyle="->", lw=2.2, color="#F59E0B")
    return_arrow = dict(arrowstyle="->", lw=2.5, color="#10B981", linestyle="--")

    # Brief -> CoS -> Human Gate
    ax.annotate("", xy=(0.38, 0.89), xytext=(0.26, 0.89), arrowprops=arrow_style)
    ax.annotate("", xy=(0.74, 0.89), xytext=(0.62, 0.89), arrowprops=accent_arrow)
    ax.annotate("", xy=(0.62, 0.87), xytext=(0.74, 0.87), arrowprops=accent_arrow)

    # CoS <-> Message Bus
    ax.annotate("", xy=(0.50, 0.76), xytext=(0.50, 0.84), arrowprops=arrow_style)

    # Bus -> Agents
    ax.annotate("", xy=(0.14, 0.59), xytext=(0.14, 0.66), arrowprops=arrow_style)
    ax.annotate("", xy=(0.38, 0.59), xytext=(0.38, 0.66), arrowprops=arrow_style)
    ax.annotate("", xy=(0.62, 0.59), xytext=(0.62, 0.66), arrowprops=arrow_style)
    ax.annotate("", xy=(0.86, 0.59), xytext=(0.86, 0.66), arrowprops=arrow_style)

    # Content Writer <-> Compliance Rejection Loop
    ax.annotate("", xy=(0.76, 0.54), xytext=(0.48, 0.54), arrowprops=accent_arrow)
    ax.annotate("", xy=(0.48, 0.51), xytext=(0.76, 0.51), arrowprops=dict(arrowstyle="->", lw=2.0, color="#EF4444", linestyle="--"))

    # Scheduler -> Mock Platform
    ax.annotate("", xy=(0.28, 0.29), xytext=(0.24, 0.29), arrowprops=arrow_style)

    # Mock Platform -> Community Manager & Analytics
    ax.annotate("", xy=(0.76, 0.29), xytext=(0.72, 0.29), arrowprops=arrow_style)
    ax.annotate("", xy=(0.26, 0.15), xytext=(0.38, 0.20), arrowprops=arrow_style)

    # Analytics -> Memory Store
    ax.annotate("", xy=(0.52, 0.09), xytext=(0.48, 0.09), arrowprops=arrow_style)

    # Memory Store -> Week 2 Strategy Feedback Loop
    ax.annotate(
        "WEEK 2 ADAPTATION FEEDBACK LOOP",
        xy=(0.04, 0.52),
        xytext=(0.74, 0.15),
        arrowprops=return_arrow,
        color="#34D399",
        fontsize=10,
        fontweight="bold",
    )

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    plt.tight_layout()
    plt.savefig(output_path, facecolor=fig.get_facecolor(), edgecolor="none", dpi=300)
    plt.close()
    print(f"Architecture diagram saved to {output_path}")


if __name__ == "__main__":
    generate_diagram()
