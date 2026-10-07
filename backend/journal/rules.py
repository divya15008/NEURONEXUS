from __future__ import annotations

from .database import load_journal_rules


def get_available_journals() -> list[dict]:
    return load_journal_rules()


def get_journal_rules(journal_id: str) -> dict:
    key = (journal_id or "").strip().lower()
    for rule in load_journal_rules():
        if rule["journal_id"].lower() == key:
            return rule
    # Accept training-pack ids in any case (e.g. "IEEE_CONFERENCE").
    for rule in load_journal_rules():
        if rule.get("template_id", "").lower() == key:
            return rule
    raise ValueError(f"Unsupported journal: {journal_id}")
