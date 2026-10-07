from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml.ns import qn
from docx.shared import Inches, Pt

from backend.formatting.references import format_references


PAGE_SIZES = {
    "A4": (Inches(8.27), Inches(11.69)),
    "LETTER": (Inches(8.5), Inches(11.0)),
}


def _set_run_font(run, font_name: str, font_size: int, bold: bool = False) -> None:
    run.font.name = font_name
    run.font.size = Pt(font_size)
    run.bold = bold
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.get_or_add_rFonts()
    rfonts.set(qn("w:ascii"), font_name)
    rfonts.set(qn("w:hAnsi"), font_name)
    rfonts.set(qn("w:eastAsia"), font_name)


_ROMAN = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def _to_roman(number: int) -> str:
    result = ""
    for value, numeral in _ROMAN:
        while number >= value:
            result += numeral
            number -= value
    return result or "I"


def _numbered_heading(text: str, level: int, index_path: list[int], scheme: str | None) -> str:
    scheme = (scheme or "numbered").lower()
    clean = text.strip()
    if scheme == "unnumbered":
        import re
        return re.sub(r"^[\dIVXLCivxlc\.\s\)\-]+", "", clean).strip() or clean
    if scheme == "roman" and level == 1:
        prefix = _to_roman(index_path[0]) + "."
        import re
        body = re.sub(r"^[\dIVXLCivxlc\.\s\)\-]+", "", clean).strip() or clean
        return f"{prefix} {body}"
    if scheme == "apa":
        # APA: no numbering, title case preserved as-is.
        import re
        return re.sub(r"^[\d\.\s\)\-]+", "", clean).strip() or clean
    # Default numbered: 1., 1.1, 1.1.1
    prefix = ".".join(str(i) for i in index_path[:level]) + "."
    import re
    body = re.sub(r"^[\d\.\s\)\-]+", "", clean).strip() or clean
    return f"{prefix} {body}"


class DOCXGenerator:
    def generate(self, document: dict, output_path: str | Path, journal_rules: dict | None = None) -> str:
        rules = journal_rules or {}
        font_name = rules.get("font") or "Times New Roman"
        font_size = int(rules.get("font_size") or 11)
        title_size = int(rules.get("title_size_pt") or (font_size + 4))
        line_spacing = float(rules.get("line_spacing") or 1.15)
        paragraph_spacing = int(rules.get("paragraph_spacing") or 6)
        margins = rules.get("margins") or {"top": 1.0, "bottom": 1.0, "left": 1.0, "right": 1.0}
        heading_scheme = rules.get("heading_numbering") or "numbered"
        fig_style = ((rules.get("figure_rules") or {}).get("caption_style")) or "Figure"
        tab_style = ((rules.get("table_rules") or {}).get("caption_style")) or "Table"
        columns = int(rules.get("columns") or 1)

        doc = Document()
        section = doc.sections[0]
        page_key = str(rules.get("page_size") or "A4").upper()
        width, height = PAGE_SIZES.get(page_key, PAGE_SIZES["A4"])
        section.page_width = width
        section.page_height = height
        section.top_margin = Inches(float(margins.get("top", 1.0)))
        section.bottom_margin = Inches(float(margins.get("bottom", 1.0)))
        section.left_margin = Inches(float(margins.get("left", 1.0)))
        section.right_margin = Inches(float(margins.get("right", 1.0)))
        if columns == 2:
            # python-docx has no high-level columns API; record intent via section grid.
            sect_pr = section._sectPr
            cols = sect_pr.find(qn("w:cols"))
            if cols is None:
                from docx.oxml import OxmlElement
                cols = OxmlElement("w:cols")
                sect_pr.append(cols)
            cols.set(qn("w:num"), "2")
            cols.set(qn("w:space"), "708")

        # Journal header line (template identity).
        template_name = rules.get("template_name") or rules.get("journal_name") or ""
        if template_name:
            hdr = doc.add_paragraph()
            hdr.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = hdr.add_run(str(template_name))
            _set_run_font(run, font_name, max(font_size - 2, 8), bold=False)

        title = document.get("title") or "Untitled manuscript"
        title_para = doc.add_paragraph()
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_run = title_para.add_run(title)
        _set_run_font(title_run, font_name, title_size, bold=True)

        authors = document.get("authors") or []
        if authors:
            author_para = doc.add_paragraph()
            author_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            author_run = author_para.add_run(", ".join(authors))
            _set_run_font(author_run, font_name, font_size)

        abstract = document.get("abstract") or ""
        if abstract:
            label = ((rules.get("abstract_requirements") or {}).get("label")) or "Abstract"
            abs_para = doc.add_paragraph()
            lab_run = abs_para.add_run(f"{label.split(';')[0].strip()} — " if "—" not in label else label + " ")
            _set_run_font(lab_run, font_name, font_size, bold=True)
            body_run = abs_para.add_run(abstract)
            _set_run_font(body_run, font_name, font_size)
            self._apply_spacing(abs_para, line_spacing, paragraph_spacing)

        keywords = document.get("keywords") or []
        if keywords:
            kw_label = ((rules.get("keyword_rules") or {}).get("label")) or "Keywords"
            keyword_para = doc.add_paragraph()
            keyword_run = keyword_para.add_run(f"{kw_label}: " + ", ".join(str(item) for item in keywords))
            _set_run_font(keyword_run, font_name, font_size, bold=False)
            self._apply_spacing(keyword_para, line_spacing, paragraph_spacing)

        counters = [0, 0, 0, 0]
        for manuscript_section in document.get("sections", []):
            heading = manuscript_section.get("heading")
            stype = str(manuscript_section.get("type") or "").lower()
            if stype in {"references", "reference", "bibliography"}:
                continue  # rendered separately with journal reference style
            if heading:
                level = min(max(int(manuscript_section.get("level") or 1), 1), 4)
                counters[level - 1] += 1
                for i in range(level, 4):
                    counters[i] = 0
                numbered = _numbered_heading(heading, level, [c or 1 for c in counters], heading_scheme)
                heading_para = doc.add_heading(numbered, level=level)
                for run in heading_para.runs:
                    _set_run_font(run, font_name, font_size + 2 if level == 1 else font_size + 1, bold=True)
            content = manuscript_section.get("content")
            if content:
                body = doc.add_paragraph(content)
                self._apply_spacing(body, line_spacing, paragraph_spacing)
                for run in body.runs:
                    _set_run_font(run, font_name, font_size)

        # Figures (caption below).
        for index, figure in enumerate(document.get("figures") or [], start=1):
            caption = figure.get("caption") or figure.get("id") or f"Figure {index}"
            prefix = "Fig." if fig_style.lower().startswith("fig.") else fig_style.rstrip(".")
            para = doc.add_paragraph(f"{prefix} {index}. {caption}")
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                _set_run_font(run, font_name, max(font_size - 1, 8))

        # Tables (caption above + grid).
        for index, table in enumerate(document.get("tables") or [], start=1):
            caption = table.get("caption") or table.get("id") or f"Table {index}"
            prefix = "TABLE" if tab_style.upper().startswith("TABLE") else tab_style.rstrip(".")
            para = doc.add_paragraph(f"{prefix} {index}. {caption}")
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                _set_run_font(run, font_name, max(font_size - 1, 8))
            rows = table.get("content") or table.get("rows") or []
            if isinstance(rows, list) and rows and isinstance(rows[0], list):
                word_table = doc.add_table(rows=len(rows), cols=len(rows[0]))
                word_table.style = "Table Grid"
                for r_idx, row in enumerate(rows):
                    for c_idx, cell_value in enumerate(row):
                        word_table.rows[r_idx].cells[c_idx].text = str(cell_value)

        # Equations (numbered).
        eq_numbering = ((rules.get("equation_rules") or {}).get("numbering")) or "numbered"
        for index, equation in enumerate(document.get("equations") or [], start=1):
            text = equation.get("latex") or equation.get("text") or equation.get("id") or f"Equation {index}"
            if eq_numbering == "right-aligned":
                para = doc.add_paragraph(f"{text}\t({index})")
            elif eq_numbering == "parenthesized":
                para = doc.add_paragraph(f"({index})  {text}")
            else:
                para = doc.add_paragraph(f"({index})  {text}")
            para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            for run in para.runs:
                _set_run_font(run, font_name, font_size)

        # References with journal-specific style.
        references = document.get("references") or []
        if references:
            heading = doc.add_heading("References", level=1)
            for run in heading.runs:
                _set_run_font(run, font_name, font_size + 2, bold=True)
            for line in format_references(references, rules):
                para = doc.add_paragraph(line)
                self._apply_spacing(para, line_spacing, paragraph_spacing)
                for run in para.runs:
                    _set_run_font(run, font_name, font_size)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        doc.save(output_path)
        return str(output_path)

    def _apply_spacing(self, paragraph, line_spacing: float, paragraph_spacing: int) -> None:
        paragraph.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        paragraph.paragraph_format.line_spacing = line_spacing
        paragraph.paragraph_format.space_after = Pt(paragraph_spacing)
