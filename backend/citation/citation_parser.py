import re
from collections.abc import Iterable


CITATION_PATTERNS = [
    ("numeric", re.compile(r"\[(\d+(?:\s*[-,]\s*\d+)*)\]")),
    # Parenthetical author-year: (Smith, 2024), (Smith & Jones, 2023), (Smith et al., 2024)
    ("author_year", re.compile(r"\(([A-Z][A-Za-z\-]+(?:\s+(?:et al\.|&|and)\s+[A-Z][A-Za-z\-]+)?(?:\s+et al\.)?,\s*\d{4}[a-z]?)\)")),
    # Narrative author-year: Smith et al. (2024), Smith and Johnson (2024)
    ("author_year", re.compile(r"\b([A-Z][A-Za-z-]+(?:\s+et al\.)?)\s*\((\d{4}[a-z]?)\)")),
    # Bare author-year: Smith et al. 2024 is not cited; require comma form "Brown, 2023"
    ("author_year", re.compile(r"\b([A-Z][A-Za-z-]+(?:\s+et al\.)?,\s*\d{4}[a-z]?)\b")),
]


def extract_citations(paragraphs: Iterable[str]) -> list[dict]:
    citations: list[dict] = []
    position = 0
    seen_spans: set[tuple[int, int, int]] = set()
    for para_index, paragraph in enumerate(paragraphs):
        for citation_type, pattern in CITATION_PATTERNS:
            for match in pattern.finditer(paragraph):
                span = (para_index, match.start(), match.end())
                if span in seen_spans:
                    continue
                seen_spans.add(span)
                position += 1
                text = match.group(0)
                ref_ids = []
                if citation_type == "numeric":
                    raw = match.group(1)
                    for token in re.split(r"\s*,\s*", raw):
                        if "-" in token:
                            try:
                                start, end = [int(part.strip()) for part in token.split("-", 1)]
                            except ValueError:
                                continue
                            ref_ids.extend(str(i) for i in range(start, end + 1))
                        elif token.strip().isdigit():
                            ref_ids.append(token.strip())
                citations.append({
                    "text": text,
                    "citation_type": citation_type,
                    "location": f"paragraph:{para_index + 1}",
                    "position": position,
                    "reference_ids": ref_ids,
                })
    citations.sort(key=lambda item: item["position"])
    for index, item in enumerate(citations, start=1):
        item["position"] = index
    return citations
