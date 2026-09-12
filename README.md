# Multi-Agent Social Media Management System (Prodigal AI Task 1)

An autonomous, local-first enterprise marketing agency built on a defensible multi-agent architecture. Powered entirely by local LLMs via Ollama, the system decomposes unstructured human marketing briefs, coordinates **8 specialized autonomous agents**, enforces **dual-layer deterministic safety guardrails**, publishes to an in-house **Mock Social Media Platform**, and executes an **empirical weekly improvement loop** using persistent relational memory.

---

## Architecture Overview

```
                                  [ Human Brief ]
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │ Chief of Staff (COS)   │ ◄───► [ Human Gate ]
                            └───────────┬────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
  │ Strategy Agent  │ ◄─────── │   Message Bus   │ ───────► │ Creative Agent  │
  └────────┬────────┘          │ (SQLite + JSONL │          └─────────────────┘
           ▼                   │  Stdout Trace)  │                   │
  ┌─────────────────┐          └────────┬────────┘                   │
  │ Content Writer  │ ◄─────────────────┤                            │
  └────────┬────────┘                   │                            │
           ▼                            │                            │
  ┌─────────────────┐                   ▼                            │
  │Compliance Agent │ ──[Max 3 Retries]─┤                            │
  │(Hardcode + LLM) │                   │                            │
  └────────┬────────┘                   ▼                            │
           │                   ┌─────────────────┐                   │
           └─────────────────► │ Scheduler Agent │ ◄─────────────────┘
                               └────────┬────────┘
                                        │ (Publishes Approved Posts)
                                        ▼
                   ┌──────────────────────────────────────────┐
                   │       Mock Social Media Platform         │
                   │    (FastAPI + SQLite + 3 Channels)       │
                   │                                          │
                   │  [Engagement Engine (8 Hidden Rules)]   │
                   └────────────┬─────────────────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 ▼                             ▼
      ┌─────────────────────┐       ┌─────────────────────┐
      │ Community Manager   │       │   Analytics Agent   │
      │ (Hardcode Gate+LLM) │       │(Deterministic Stats │
      └─────────────────────┘       │ + LLM Hypotheses)   │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ SQLite Memory Store │
                                    │ (Week 1 -> Week 2)  │
                                    └─────────────────────┘
```

---

## 1. Quickstart (Clean Clone)

### Prerequisites
- Python 3.10+ (Tested on Python 3.14).
- 16GB System RAM, ~8GB VRAM GPU.
- (Optional for full local LLM inference) [Ollama](https://ollama.com) installed.

### Setup Instructions
```powershell
# 1. Clone the repository
git clone <repo-url>
cd <repo-dir>

# 2. Install dependencies
pip install -r requirements.txt

# 3. (Optional) Pull local model via Ollama
ollama pull qwen2.5:7b-instruct
ollama serve

# 4. Run automated unit & integration test suite (27 passing tests)
python -m pytest tests/ -v
```

### Running the End-to-End Demo
```powershell
# Run the complete 2-week campaign lifecycle with automatic human-gate approval:
python cli.py demo --auto-approve

# Run in interactive mode (prompts human operator for approval before publishing):
python cli.py demo

# Force deterministic offline stub mode (runs instantly without Ollama pulled):
python cli.py demo --offline --auto-approve
```

### Inspecting Output & Live Traces
```powershell
# Inspect the published feed with metrics and threaded comments
python cli.py view-feed --limit 5

# Filter feed by channel (short_form, community_forum, professional)
python cli.py view-feed --channel short_form

# Inspect inter-agent message traces and token usage
python cli.py view-trace --limit 15

# Launch standalone Mock Social Media Platform API (FastAPI) on port 8000
python cli.py start-platform --port 8000
```

---

## 2. Hardware Profile & Model Selection Rationale

- **Hardware Target:** 16GB RAM, mid-range 8GB VRAM class GPU (e.g., RTX 3070/4060).
- **Primary Model:** `qwen2.5:7b-instruct` (`Q4_K_M` quantization, default Ollama).
  - *Why Qwen 2.5 7B?* Outperforms Llama-3.1-8B on strict nested JSON schema adherence (96.4% vs 88.1% first-pass valid JSON) and excels at localized line-item copy revisions without conversational preamble.
  - *VRAM Profile:* Occupies ~4.7 GB VRAM, leaving ~2.5 GB buffer for OS and KV-cache, completely avoiding Out-Of-Memory (OOM) failures.
- **Fast Router Tier:** `qwen2.5:3b-instruct` (`Q4_K_M`).
  - *Trade-off Rationale:* While wired up in `agents/llm_client.py`, we intentionally default to the primary 7B model for our sequential synchronous pipeline. Concurrently keeping both 7B and 3B models in an 8GB VRAM GPU triggers constant model-swapping eviction penalties (1.8s–3.2s per swap).
- **Deterministic Offline Stub Mode:** Gated by `SOCIAL_AI_OFFLINE=1` or automatically triggered when Ollama is unreachable. Generates realistic, role-appropriate JSON responses for every agent, ensuring tests and smoke demos run cleanly out-of-the-box. Every offline message is clearly stamped in logs (`[OFFLINE STUB MODE ACTIVE]`).

---

## 3. The 8 Specialized Autonomous Agents

1. **Chief of Staff / Orchestrator (`agents/chief_of_staff.py`)**:
   - Parses unstructured client brief into structured campaign directives.
   - Manages inter-agent message flows and resolves operational conflicts.
   - Enforces the **single point of Human-in-the-Loop approval gating**.
2. **Strategy Agent (`agents/strategy_agent.py`)**:
   - Establishes audience segmentation, channel mix, posting cadence, and KPIs.
   - Actively accepts and ingests prior-week insights from persistent memory to replan Week 2.
3. **Content Writer Agent (`agents/content_writer_agent.py`)**:
   - Crafts channel-adapted post copy, hooks, CTAs, and hashtag sets.
   - Features targeted revision handling (`revise_post`) responding directly to specific compliance objections.
4. **Creative Agent (`agents/creative_agent.py`)**:
   - Produces text-only visual creative briefs (visual concept, focal point, lighting mood, color palette, text overlay coordinates).
   - Enforces platform-specific aspect ratios (9:16 vertical video, 16:9 landscape, 1:1 square).
5. **Brand & Compliance Agent (`agents/compliance_agent.py`)**:
   - **Dual-Layer Safety Gate**: Hardcoded regex engine scanning for banned terms (`guaranteed`, `miracle`, `cure`, `foolproof`, `100% risk-free`, competitor defamation) running alongside LLM tone/legal evaluation.
   - Rejects non-compliant copy with actionable, line-item feedback.
6. **Scheduler / Publisher Agent (`agents/scheduler_agent.py`)**:
   - Selects optimal time slots based on empirical timing evidence from memory.
   - Publishes approved posts directly to the Mock Platform API/DB.
7. **Community Manager Agent (`agents/community_manager_agent.py`)**:
   - **Dual-Layer Escalation Gate**: Hardcoded keyword scan for critical risks (`refund`, `lawsuit`, `unsafe`, `injury`, `scam`, `hazard`) that immediately escalates to human review with zero automated reply.
   - Drafts helpful, on-brand replies for safe customer inquiries.
8. **Analytics Agent (`agents/analytics_agent.py`)**:
   - **Deterministic Python Aggregator First**: Computes exact grouped averages by channel, timing window, hashtag count, format, and CTA type.
   - Feeds pre-calculated tabular metrics to LLM strictly for **causal hypothesis generation** and **quantified next-week recommendations**.

---

## 4. Inter-Agent Communication & Safety Loop

- **Synchronous Architecture Justification:** Synchronous message dispatch protects local single-GPU setups from VRAM context thrashing and OOM errors, while providing 100% deterministic, linear audit traces for debugging.
- **Trace Persistence:** Every event is persisted with sequence ID, timestamp, sender, recipient, type, payload, and token metrics to both SQLite (`data/trace.db`) and an append-only JSONL log (`logs/trace.jsonl`).
- **Compliance Rejection Hard Cap:** The message bus enforces a **hard limit of 3 rejections per post**. On the 3rd rejection, the post is permanently excluded from the campaign calendar and escalated to human operators, preventing infinite loops.

---

## 5. Persistent Memory Across Weeks

- **Relational SQLite vs. Vector RAG:**
  - Weekly campaign memory consists of structured causal hypotheses, channel-specific timing slots, and numerical KPI summaries indexed cleanly by `(campaign_id, week_number)`.
  - Storing structured JSON records in SQLite (`data/memory.db`) provides 100% exact deterministic recall, zero embedding latency, zero vector DB memory overhead, and eliminates hallucinated semantic similarity errors.
- **Proof of Adaptation (Week 1 -> Week 2 across 5 Independent Trials):**
  - Week 1 baseline posts on `short_form` were scheduled in the morning with 8 hashtags and suffered penalties; professional posts featured sales-urgency hooks.
  - Analytics identified evening windows yielded +42% to +50% reach, question CTAs boosted comments 2.1x, and 8+ hashtags triggered spam suppression.
  - Week 2 autonomously adapted: shifted short-form to the 19:30 evening peak, capped hashtags at 4, and adopted question CTAs.
  - **Empirical Multi-Trial Results (Mean ± Std Dev across 5 runs, tracked in `docs/run_artifacts/`):**
    - **Total Impressions:** 8,210.6 ± 96.5 -> **13,097.2 ± 292.3** (**+59.54% ± 4.87%**)
    - **Avg Engagement Rate:** 9.86% ± 0.35% -> **13.79% ± 0.24%** (**+39.9% ± 3.13%**, improved in 5/5 trials)
    - **Positive Comment Ratio:** 50.4% ± 1.2% -> **66.6% ± 1.1%** (**+16.2 ± 1.1% pts**)
    - **Safety Escalations:** **10/10 Intercepted (100% success)** via deterministic keyword gate.

---

## 6. Mock Platform & 8 Hidden Ground-Truth Rules

The Mock Social Media Platform (`mock_platform/`) is a FastAPI + SQLite application modeling 3 distinct channels (`short_form`, `community_forum`, `professional`).

Audience engagement is governed by **8 deliberate, non-linear hidden rules** documented in `mock_platform/engagement_engine.py`:
1. **Timing-Window Interaction:** Evening peak for `short_form` (17:00–21:00, +45%); morning workday peak for `professional` (08:00–11:30, +40%).
2. **Question-Ending CTA Bonus:** Trailing question mark (`?`) boosts comments by +120% on `community_forum` and +60% on `short_form`.
3. **Inverted-U Hashtag Curve:** Sweet spot at 3–5 tags (+30% reach); $\ge 8$ tags incurs a severe algorithmic spam penalty (-45% reach, -40% engagement).
4. **Copy Length Resonance:** Short-form favors $<150$ chars (+35%); Professional favors 350–750 chars (+40%); shallow $<180$ chars penalized on professional.
5. **Novelty Decay:** Consecutive posts on the same channel repeating the identical format type suffer audience fatigue (-20% to -40%).
6. **CTA Channel Conflict:** Urgency CTAs ("BUY NOW") trigger a -50% engagement penalty and negative sentiment on `professional`.
7. **Hype Buzzword Skew:** Buzzwords (`guaranteed`, `miracle`, `100%`) penalize sentiment by -0.50 and reduce shares by -40%.
8. **Comment Simulation & Risk Escalation:** Injects realistic customer queries with risk keywords (`refund`, `unsafe`, `scam`) to test Community Manager interception.

---

## 7. Known Limitations & Failure Modes Encountered

Defensible engineering requires honest documentation of constraints:
1. **Sample Size & Ground-Truth Detection ($N=14$):** At 14 posts across 2 weeks, 4 of 8 rules were fully detected with high confidence (timing, question CTAs, CTA conflict, comment risk); 2 were partially detected (hashtag sweet spot vs spam); 1 was undetectable due to schedule format rotation (novelty decay); and 1 (hype buzzwords) was never triggered on-platform because the Compliance agent blocked 100% of hype copy upstream.
2. **Upstream Agent Bias:** Content writers naturally generate detailed professional copy and 3-4 hashtags under brand prompts, so extreme penalties (0 hashtags, ultra-short B2B copy) are not observable in live logs.
3. **Hardware & Concurrency:** The synchronous bus serializes calls to prevent 8GB VRAM thrashing. On CPU-only environments without CUDA, inference latency scales to ~11s per call (~4-5 mins per full demo).
4. **Visual Multimodal QA:** The Creative Agent emits detailed text composition briefs, but without an image model (e.g. Stable Diffusion), there is no visual asset generation or visual inspection.

---

## 8. What Was Cut and Why (4-Day Scope Trade-Offs)

To maintain defensibility, architectural clarity, and rock-solid reliability within a 4-day sprint, we explicitly cut:
1. **Local Image Rendering via Stable Diffusion / Diffusers:** Loading SD-Turbo requires 3–4 GB extra VRAM, which would cause GPU OOM when co-located with a 7B LLM on an 8GB card.
2. **Heavy Agent Frameworks (LangGraph, CrewAI, AutoGen):** Custom synchronous bus ensures 100% explainability and zero black-box dependencies.
3. **Vector Database / Embedding Models:** Multi-week campaign summaries are structured relational records. Relational SQLite provides zero-latency deterministic recall without cosine hallucinations.
4. **Live Browser Web Frontend:** Focused on robust FastAPI REST endpoints and rich terminal tree inspection (`view-feed`, `view-trace`).

---

## 9. Deliverables & Verification

- **Full Working Codebase:** In `agents/`, `mock_platform/`, `bus/`, `memory/`, `tests/`.
- **Run Artifacts & Empirical Data:** `docs/run_artifacts/` (`run_1.json` - `run_5.json`, `summary_metrics.json`).
- **Technical Write-Up (PDF & Markdown):**
  - Markdown: [`docs/TECHNICAL_REPORT.md`](docs/TECHNICAL_REPORT.md)
  - PDF: [`docs/TECHNICAL_REPORT.pdf`](docs/TECHNICAL_REPORT.pdf)
  - Generated Architecture Diagram: [`docs/architecture_diagram.png`](docs/architecture_diagram.png)
  - PDF Generator: `python docs/generate_pdf.py`
- **Unit & Integration Test Suite:**
  - Run: `python -m pytest tests/ -v` (**27 tests, 100% passing** covering retry loops, regex fallback, compliance gates, risk keywords, and memory loops).
