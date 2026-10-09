# PaperPilot (NEURONEXUS)

PaperPilot is a research-manuscript preparation prototype. Users can create an account, upload a DOCX or text-based PDF, inspect extracted structure and citation findings, review journal-fit and manuscript assessments, and generate formatted DOCX/PDF and report/package outputs.

Assessments are intended to support researcher review. They do not verify scientific truth, establish global originality, predict acceptance, or replace a journal's current author instructions. Journal-fit matching uses configured profiles and text matching; external scholarly search is not configured. PDF extraction and reconstructed exports may not preserve the source layout, figures, or tables. Scanned/image-only PDFs are not supported because OCR is not enabled.

## Requirements

- Python with the packages in `backend/requirements.txt`
- Node.js/npm compatible with the Vite version in `frontend/package.json`

## Run locally

From the repository root, install backend dependencies and start the API:

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --port 8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/health` to the backend on port 8000. Interactive API documentation is available at http://localhost:8000/docs.

Create an account with a name, valid email address, and password of at least 10 characters. Document endpoints require authentication and limit manuscript access to the owning account. Google sign-in is optional and requires a Google Identity Services Web OAuth client ID configured as `GOOGLE_CLIENT_ID` in the repository-root `.env`.

Uploads are limited to DOCX and text-based PDF files up to 15 MiB. Uploaded files and the SQLite database are stored under `backend/data/`; generated artifacts are stored under `backend/outputs/`. These are local application data and should not be committed.

## Typical workflow

1. Create an account or sign in.
2. Upload a DOCX or text-based PDF manuscript.
3. Review extracted metadata, sections, figures, tables, equations, citations, and references.
4. Review citation consistency, configured journal fit, and quality, completeness, methodology, contribution, novelty-framing, and writing assessments.
5. Review advisory recommendations and the readiness report.
6. Select a journal profile, check formatting rules, generate outputs, and download available files.

Generated PDF rendering is text-based and does not guarantee office-layout fidelity. Review generated files and verify all requirements against the publisher's current instructions before submission.

## AI configuration and privacy

Without a configured external provider, the backend uses deterministic local analysis. Set `PAPERPILOT_AI_PROVIDER` to `openai`, `groq`, `grok`, or `gemini` and configure that provider's API key in the ignored repository-root `.env` to enable structured assessments. The legacy `NEURONEXUS_AI_MODE` setting is still accepted. In external-provider mode, manuscript-derived content is sent to the configured provider; do not enable it for confidential work unless the provider's data terms and your institutional requirements permit it. Never commit real credentials.

Improvement suggestions are advisory. Accept, reject, and edited-text decisions are saved per account and manuscript, restored when the manuscript is reopened, and summarized in the readiness report. They never alter the uploaded source file.

## Tests and build

From the repository root:

```powershell
python -m pytest backend\tests -q
```

Build the frontend from its directory:

```powershell
cd frontend
npm run build
```

The backend tests cover selected authentication, analysis, and document-pipeline behavior; they are not a substitute for full end-to-end or publisher compliance testing.
Tests use temporary database, upload, and output directories so they do not modify local application data.

## Project layout

- `backend/api/` — authenticated FastAPI routes for accounts, documents, analysis, journals, citations, formatting, and downloads.
- `backend/document/`, `backend/citation/`, `backend/journal/`, `backend/formatting/`, `backend/generator/` — parsing, checks, profiles, formatting, and artifact generation.
- `backend/tests/` — automated backend tests.
- `frontend/src/` — React application, authentication screen, shared API client, and styles.
- Backend tests build synthetic manuscripts for their upload and analysis scenarios; no real research manuscripts are needed to run the suite.
