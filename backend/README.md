# PaperPilot backend

FastAPI service for authenticated manuscript upload, analysis, journal-profile checks, formatting, and output generation.

## Run locally

From the repository root:

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.main:app --reload --port 8000
```

The SQLite database is initialized on startup. API documentation is available at http://localhost:8000/docs and the health endpoint is `/health`.

## Main API areas

- `/api/auth/` — account registration, sign-in, optional Google sign-in, current user, and sign-out.
- `/api/documents` — authenticated upload, listing, dashboard summary, document retrieval, parsing/analysis, structure, and saved analysis results.
- `/api/citations` — citation consistency checks and a document's saved citation report.
- `/api/journals` and `/api/journal` — configured journal profiles, rules, and manuscript-fit assessment.
- `/api/quality`, `/api/novelty`, `/api/methodology`, `/api/contribution`, `/api/completeness`, `/api/writing`, `/api/improvement`, and `/api/report` — assessment and recommendation routes.
- `/api/documents/{document_id}/format` and `/generate` — profile formatting checks and output generation.
- `/api/documents/{document_id}/download/{format}` — generated DOCX, PDF, readiness report, and ZIP downloads.
- `/api/ai/status` — reports the configured analysis mode; it is configuration information, not a provider uptime check.

## Files and supported inputs

- Uploads accept DOCX and text-based PDF files up to 15 MiB. Scanned/image-only PDFs need OCR, which is not configured.
- Uploaded sources and the SQLite database are stored under `backend/data/`.
- Generated files are stored under `backend/outputs/`, separately from the original upload.
- PDF parsing and reconstruction may not preserve source layout, figures, or tables. Generated PDF rendering is text-based and does not guarantee office-layout fidelity.

Document routes enforce ownership using the authenticated account. The backend can run deterministic local assessments without an external AI provider. Provider-assisted analysis is optional; when enabled, manuscript-derived data may be sent to that configured provider. Store credentials only in the ignored repository-root `.env`, never in source control.

Run the backend tests from the repository root:

```powershell
python -m pytest backend\tests -q
```
