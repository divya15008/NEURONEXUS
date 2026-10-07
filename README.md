# PaperPilot (NEURONEXUS)

PaperPilot is a **research manuscript preparation and pre-submission review** application. Upload a DOCX manuscript, review its structure and citation consistency, run quality/similarity/methodology/writing/journal-fit assessments, record improvement decisions, and export a journal-formatted submission package (DOCX + PDF + readiness report + ZIP).

> Advisory tool only. PaperPilot does **not** guarantee publication or acceptance, verify scientific truth, detect plagiarism, certify originality, perform external scholarly literature searches, or certify compliance with any publisher. The author remains responsible for scientific correctness, citations, originality, ethics, and final compliance with the selected journal's official author guidelines.

## Architecture

- `backend/` — FastAPI + SQLite. DOCX parsing (`document/`), citation validation (`citation/`), journal template rules (`journal/`), formatting (`formatting/`), DOCX/PDF/package generation (`generator/`), heuristic or provider-backed assessments (`ai_service.py`), REST API (`api/`).
- `frontend/` — React + Vite single-page workspace (`src/App.jsx`, `src/services/api.js`).
- `Research_Paper_Journal_Template_Training_Pack/` — training template specs mirrored in `backend/journal/database.py` (12 templates + `nature`/`ieee` aliases).
- `NEURONEXUS_TEST_DATASET_90/` — optional local synthetic QA/test manuscripts (not real research; excluded from GitHub).

## Features

- DOCX upload (15 MB limit), structure extraction (sections, figures, tables, equations, citations, references)
- Citation/reference consistency checks (missing, uncited, duplicates, numbering)
- Assessments: quality, contribution, novelty/similarity signals, methodology, writing, journal fit, improvement suggestions, readiness report
- Persistent improvement decisions (accept / reject / edit with saved text)
- Journal-specific formatting across 14 configured journal entries and submission-package export
- Light/dark theme (browser-persisted), manuscript library backed by SQLite

## Limitations

- Similarity assessment uses only the supplied manuscript text/bibliography; **no external scholarly search** is performed.
- Journal rules come from bundled template data; always verify the journal's current official guidelines.
- Generated documents use approximated layouts (e.g. two-column via DOCX section settings).

## Backend setup

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --port 8000
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/health

## Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 (dev proxy forwards `/api` and `/health` to the backend). Production build: `npm run build`.

## Environment configuration

Copy `.env.example` to `.env`. Supported AI modes via `NEURONEXUS_AI_MODE`:

| Mode | Meaning |
|------|---------|
| `local` (default when no key is set) | Deterministic heuristic assessments; manuscript stays in the app/server |
| `groq` / `grok` / `gemini` | External provider analysis; selected manuscript data may be sent to that provider |

Provider keys (`GROQ_API_KEY`, `GROK_API_KEY`/`XAI_API_KEY`, `GEMINI_API_KEY`) are server-side only and never exposed to the frontend. Provider failures fall back safely: transient errors use the local assessment, auth errors return HTTP 502 with a clear message.

## Typical workflow

Upload → Document Analysis → Citations → Journal Fit → Quality → Novelty & Similarity → Methodology → Improvements (accept/reject/edit, persisted) → Readiness Report → Export (generate, then download DOCX/PDF/report/ZIP).

## Testing

```powershell
python -m pytest backend\tests -q
```

Covers upload validation, parsing, citations, journals, all assessment modules, improvement decisions, formatting, generation, downloads, and error paths. Optional dataset benchmark: `python benchmark_dataset.py` (needs `NEURONEXUS_API_URL`, default `http://127.0.0.1:8000`, and `NEURONEXUS_DATASET_DIR`).

## Privacy

- Local mode: manuscript processing stays within the application/server.
- External provider mode: selected manuscript information may be sent to the configured third-party AI provider.
- Manuscript contents are not written to logs; credentials are never stored in source code.
