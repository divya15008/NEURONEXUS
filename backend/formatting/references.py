from __future__ import annotations


def _format_single_reference(raw: str, index: int, style: str | None) -> str:
    raw = (raw or "").strip()
    if not raw:
        return f"[{index}]"
    style = (style or "numbered").lower()
    if style in {"apa"}:
        # APA entries are already author-year; keep text, strip any leading [n].
        import re
        return re.sub(r"^\s*\[\d+\]\s*", "", raw)
    if style in {"vancouver", "numbered", "springer_numeric", "elsevier_numeric"}:
        import re
        body = re.sub(r"^\s*\[\d+\]\s*", "", raw)
        return f"[{index}] {body}"
    if style in {"ieee"}:
        import re
        body = re.sub(r"^\s*\[\d+\]\s*", "", raw)
        return f"[{index}]\t{body}"
    if style in {"acm"}:
        import re
        body = re.sub(r"^\s*\[\d+\]\s*", "", raw)
        return f"[{index}] {body}"
    import re
    body = re.sub(r"^\s*\[\d+\]\s*", "", raw)
    return f"[{index}] {body}"


def format_references(references: list[dict], journal_rules: dict) -> list[str]:
    style = (journal_rules or {}).get("reference_style")
    citation_style = (journal_rules or {}).get("citation_style")
    # APA: alphabetical by raw text; numbered styles: keep order, renumber sequentially.
    refs = list(references or [])
    if style == "apa" or citation_style == "author_year":
        refs = sorted(refs, key=lambda r: str(r.get("raw_text") or r.get("text") or ""))
    formatted: list[str] = []
    for index, ref in enumerate(refs, start=1):
        raw = ref.get("raw_text") or ref.get("text") or ""
        formatted.append(_format_single_reference(raw, index, style))
    return formatted


def format_reference_rules(journal_rules: dict) -> dict:
    return {
        "citation_style": journal_rules.get("citation_style"),
        "reference_style": journal_rules.get("reference_style"),
    }
