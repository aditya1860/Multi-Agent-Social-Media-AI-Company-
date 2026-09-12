"""
Generates docs/TECHNICAL_REPORT.pdf from TECHNICAL_REPORT.md and architecture_diagram.png.
Uses fpdf2 with text sanitization to produce a clean, publication-ready technical whitepaper.
"""

import os
from fpdf import FPDF
from fpdf.enums import XPos, YPos


def sanitize_text(text: str) -> str:
    """Sanitize Unicode punctuation into Latin-1 compatible characters for core PDF fonts."""
    replacements = {
        "\u2013": "-",
        "\u2014": "--",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "*",
        "\u2026": "...",
        "\u2265": ">=",
        "\u2264": "<=",
        "\u00d7": "x",
        "\u2192": "->",
        "\u2190": "<-",
        "\u2194": "<->",
        "\u00b1": "+/-",
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    return text.encode("latin-1", "replace").decode("latin-1")


class TechReportPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(128, 128, 128)
            self.cell(self.epw / 2, 8, "Autonomous Multi-Agent Social Media System | Technical Report", 0, new_x=XPos.RIGHT, new_y=YPos.TOP, align="L")
            self.cell(self.epw / 2, 8, f"Page {self.page_no()}", 0, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="R")
            self.set_draw_color(200, 200, 200)
            self.line(15, 18, 195, 18)
            self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(self.epw, 8, "Prodigal AI Task 1 | 100% Local Inference via Ollama | Defensible Multi-Agent Architecture", 0, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")


def build_pdf(
    md_path: str = "docs/TECHNICAL_REPORT.md",
    diagram_path: str = "docs/architecture_diagram.png",
    pdf_path: str = "docs/TECHNICAL_REPORT.pdf",
):
    pdf = TechReportPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)

    pdf.add_page()

    # Title Page Banner
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(15, 23, 42)  # Slate 900
    pdf.multi_cell(pdf.epw, 9, "Autonomous Multi-Agent Social Media System", 0, "L")

    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(2, 132, 199)  # Sky 600
    pdf.multi_cell(pdf.epw, 7, "Technical Architecture & Engineering Defense Report", 0, "L")

    pdf.ln(2)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 116, 139)  # Slate 500
    pdf.multi_cell(
        pdf.epw,
        5,
        "Author: Senior AI Systems Engineer | Target: Prodigal AI Task 1\n"
        "Hardware: 16GB RAM, ~8GB VRAM Class | Engine: Local Ollama (qwen2.5:7b-instruct)",
        0,
        "L",
    )

    pdf.ln(3)
    pdf.set_draw_color(2, 132, 199)
    pdf.set_line_width(0.8)
    pdf.line(15, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(5)

    # Embed Architecture Diagram on first page
    if os.path.exists(diagram_path):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(pdf.epw, 6, "Figure 1: Complete Multi-Agent Architecture & Causal Message Flow", 0, new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="C")
        pdf.ln(1)
        pdf.image(diagram_path, x=15, w=180)
        pdf.ln(6)

    # Read and parse Markdown sections
    with open(md_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(30, 41, 59)

    in_code_block = False

    for line in lines:
        stripped = line.strip()

        # Skip main headers already handled in banner
        if (
            stripped.startswith("# Autonomous Multi-Agent")
            or stripped.startswith("## Technical Architecture")
            or stripped.startswith("**Author:")
            or stripped.startswith("![")
        ):
            continue

        if stripped.startswith("```"):
            in_code_block = not in_code_block
            pdf.ln(1)
            continue

        if in_code_block:
            pdf.set_font("Courier", "", 8.5)
            pdf.set_text_color(15, 23, 42)
            safe_text = sanitize_text("  " + stripped)
            pdf.multi_cell(pdf.epw, 4.5, safe_text, 0, "L")
            continue

        if stripped.startswith("## "):
            pdf.ln(4)
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(15, 23, 42)
            header_text = sanitize_text(stripped.replace("## ", ""))
            pdf.multi_cell(pdf.epw, 7, header_text, 0, "L")
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(51, 65, 85)
            pdf.ln(1)
            continue

        if stripped.startswith("### "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(2, 132, 199)
            sub_text = sanitize_text(stripped.replace("### ", ""))
            pdf.multi_cell(pdf.epw, 6, sub_text, 0, "L")
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(51, 65, 85)
            pdf.ln(1)
            continue

        # Horizontal rules
        if stripped.startswith("---"):
            pdf.ln(2)
            pdf.set_draw_color(226, 232, 240)
            pdf.set_line_width(0.4)
            pdf.line(15, pdf.get_y(), 195, pdf.get_y())
            pdf.ln(2)
            continue

        # Markdown tables
        if stripped.startswith("|"):
            pdf.set_font("Courier", "", 7.5)
            pdf.set_text_color(15, 23, 42)
            safe_row = sanitize_text(stripped)
            pdf.multi_cell(pdf.epw, 4.2, safe_row, 0, "L")
            continue

        # Regular prose paragraph
        if stripped:
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(51, 65, 85)
            clean_text = stripped.replace("**", "").replace("*", "").replace("`", "")
            safe_text = sanitize_text(clean_text)
            pdf.multi_cell(pdf.epw, 4.8, safe_text, 0, "L")
            pdf.ln(1.5)

    pdf.output(pdf_path)
    print(f"Technical Report PDF generated successfully: {pdf_path}")


if __name__ == "__main__":
    build_pdf()
