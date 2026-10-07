from __future__ import annotations

from pydantic import BaseModel


class FormattingResult(BaseModel):
    document_id: str
    journal_id: str
    applied_rules: dict
    warnings: list[str] = []


def _word_count(document: dict) -> int:
    words = len(str(document.get("title") or "").split())
    words += len(str(document.get("abstract") or "").split())
    for section in document.get("sections") or []:
        if isinstance(section, dict):
            words += len(str(section.get("content") or "").split())
    for para in document.get("paragraphs") or []:
        words += len(str(para).split())
    return words


def apply_formatting(document: dict, journal_rules: dict) -> FormattingResult:
    """Map a parsed manuscript + journal rules to an applied-formatting record.

    Covers all 6 platform requirements: layout, fonts, margins, headings,
    spacing, numbering and reference-style normalization.
    """
    warnings: list[str] = []
    journal_id = journal_rules.get("journal_id", "nature")

    applied_rules = {
        "template_id": journal_rules.get("template_id"),
        "template_name": journal_rules.get("template_name"),
        "publisher": journal_rules.get("publisher"),
        "style": journal_rules.get("style"),
        "page_size": journal_rules.get("page_size"),
        "margins": journal_rules.get("margins"),
        "columns": journal_rules.get("columns"),
        "font": journal_rules.get("font"),
        "font_size": journal_rules.get("font_size"),
        "title_size_pt": journal_rules.get("title_size_pt"),
        "line_spacing": journal_rules.get("line_spacing"),
        "paragraph_spacing": journal_rules.get("paragraph_spacing"),
        "heading_styles": journal_rules.get("heading_styles"),
        "heading_numbering": journal_rules.get("heading_numbering"),
        "figure_rules": journal_rules.get("figure_rules"),
        "table_rules": journal_rules.get("table_rules"),
        "equation_rules": journal_rules.get("equation_rules"),
        "citation_style": journal_rules.get("citation_style"),
        "reference_style": journal_rules.get("reference_style"),
        "abstract_requirements": journal_rules.get("abstract_requirements"),
        "keyword_rules": journal_rules.get("keyword_rules"),
        "numbering_rules": journal_rules.get("numbering_rules"),
        "word_limit": journal_rules.get("word_limit"),
    }

    # Word-limit check.
    word_limit = journal_rules.get("word_limit")
    if word_limit:
        total = _word_count(document)
        applied_rules["estimated_word_count"] = total
        if total > int(word_limit):
            warnings.append(f"Manuscript (~{total} words) exceeds the {journal_id} guideline of {word_limit} words.")

    # Abstract check.
    abstract = str(document.get("abstract") or "")
    max_words = (journal_rules.get("abstract_requirements") or {}).get("max_words")
    if max_words and len(abstract.split()) > int(max_words):
        warnings.append(f"Abstract ({len(abstract.split())} words) exceeds the {max_words}-word limit for {journal_id}.")

    # Keywords check.
    if (journal_rules.get("keyword_rules") or {}).get("required") and not document.get("keywords"):
        warnings.append("Keywords are required by this journal but none were detected.")

    # Two-column notice.
    if journal_rules.get("columns") == 2:
        warnings.append("Two-column layout applied (approximated with balanced single-flow sections in DOCX).")

    # Reference-style notice.
    ref_style = journal_rules.get("reference_style")
    cit_style = journal_rules.get("citation_style")
    if ref_style or cit_style:
        applied_rules["reference_normalization"] = f"citations={cit_style}; references={ref_style}"

    if not document.get("sections"):
        warnings.append("No sections detected; heading hierarchy could not be normalized.")

    return FormattingResult(
        document_id=document.get("document_id", "unknown"),
        journal_id=journal_id,
        applied_rules=applied_rules,
        warnings=warnings,
    )
