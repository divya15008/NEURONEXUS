import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  Loader2,
  Moon,
  PanelLeft,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { researchApi } from './services/api'

const NAV = [
  { label: 'Dashboard', icon: Gauge, id: 'dashboard' },
  { label: 'Upload', icon: UploadCloud, id: 'upload' },
  { label: 'Document Analysis', icon: FileText, id: 'analysis' },
  { label: 'Citations', icon: BookOpen, id: 'citations' },
  { label: 'Journal Fit', icon: Globe2, id: 'journal' },
  { label: 'Quality', icon: BarChart3, id: 'quality' },
  { label: 'Novelty & Similarity', icon: Sparkles, id: 'novelty' },
  { label: 'Methodology', icon: ClipboardCheck, id: 'methodology' },
  { label: 'Improvements', icon: Zap, id: 'improvements' },
  { label: 'Readiness Report', icon: ShieldCheck, id: 'report' },
  { label: 'Export', icon: FolderOpen, id: 'export' },
  { label: 'Settings', icon: Settings2, id: 'settings' },
]

const MAX_BYTES = 15 * 1024 * 1024
const CORE_SECTIONS = ['introduction', 'methodology', 'results', 'conclusion']

function fmtDate(value) {
  if (!value) return 'Not recorded'
  const parsed = new Date(String(value).replace(' ', 'T') + 'Z')
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function completenessChecks(analysis) {
  if (!analysis) return []
  const types = new Set((analysis.sections || []).map((s) => String(s.type || '').toLowerCase()))
  return [
    { label: 'Title detected', ok: Boolean((analysis.title || '').trim()) },
    { label: 'Authors detected', ok: (analysis.authors || []).length > 0 },
    { label: 'Abstract detected', ok: Boolean((analysis.abstract || '').trim()) },
    { label: 'Keywords detected', ok: (analysis.keywords || []).length > 0 },
    { label: 'Core sections present (introduction, methodology, results, conclusion)', ok: CORE_SECTIONS.every((t) => types.has(t)) },
    { label: 'In-text citations detected', ok: (analysis.citations || []).length > 0 },
    { label: 'Reference list detected', ok: (analysis.references || []).length > 0 },
  ]
}

/* ---------- shared components ---------- */

function PageHeader({ kicker, title, subtitle, action }) {
  return (
    <section className="page-intro">
      <div>
        <p className="kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {action}
    </section>
  )
}

function EmptyState({ title, body, action }) {
  return (
    <section className="panel empty-state">
      <FileText size={28} className="empty-icon" />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </section>
  )
}

function ErrorBox({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="alert alert-error" role="alert">
      <XCircle size={16} />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="text-button" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </div>
  )
}

function LoadingRow({ label }) {
  return (
    <div className="alert alert-info" role="status">
      <Loader2 size={16} className="spin" />
      <span>{label}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const tone = status === 'generated' ? 'good' : status === 'analyzed' || status === 'formatted' ? 'neutral' : 'warn'
  return <span className={`status ${tone}`}>{status || 'unknown'}</span>
}

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={17} /></div>
      <div>
        <span className="stat-label">{label}</span>
        <div className="stat-number">{value}</div>
        <span className="stat-detail">{detail}</span>
      </div>
    </div>
  )
}

/* ---------- main app ---------- */

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('paperpilot-theme') || 'light')
  const [active, setActive] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [backendOk, setBackendOk] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [journalList, setJournalList] = useState([])
  const [manuscripts, setManuscripts] = useState([])
  const [libraryError, setLibraryError] = useState('')

  const [documentId, setDocumentId] = useState(() => localStorage.getItem('paperpilot-doc') || '')
  const [analysis, setAnalysis] = useState(null)
  const [docMeta, setDocMeta] = useState(null)
  const [citationReport, setCitationReport] = useState(null)
  const [selectedJournalId, setSelectedJournalId] = useState(() => localStorage.getItem('paperpilot-journal') || 'nature_like')

  const [quality, setQuality] = useState(null)
  const [novelty, setNovelty] = useState(null)
  const [methodology, setMethodology] = useState(null)
  const [contribution, setContribution] = useState(null)
  const [writing, setWriting] = useState(null)
  const [improvements, setImprovements] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [journalMatch, setJournalMatch] = useState(null)
  const [report, setReport] = useState(null)

  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})
  const [uploadState, setUploadState] = useState({ phase: 'idle', message: '' })
  const [exportState, setExportState] = useState({ phase: 'idle', message: 'Format and generate the submission package.', error: '' })

  const setBusyKey = (key, value) => setBusy((prev) => ({ ...prev, [key]: value }))
  const setErrorKey = (key, value) => setErrors((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('paperpilot-theme', theme)
  }, [theme])

  const refreshLibrary = useCallback(async () => {
    try {
      const body = await researchApi.listDocuments()
      setManuscripts(body.documents || [])
      setLibraryError('')
    } catch (error) {
      setLibraryError(error.message || 'Unable to load the manuscript library.')
    }
  }, [])

  const loadManuscript = useCallback(async (id, journalListRef) => {
    if (!id) return
    setBusyKey('loading-doc', true)
    setErrorKey('loading-doc', '')
    try {
      const doc = await researchApi.getDocument(id)
      const stored = doc.analysis || null
      setDocumentId(id)
      localStorage.setItem('paperpilot-doc', id)
      setDocMeta({ filename: doc.filename, status: doc.status })
      setAnalysis(stored)
      setQuality(null); setNovelty(null); setMethodology(null)
      setContribution(null); setWriting(null); setImprovements(null)
      setJournalMatch(null); setReport(null); setCitationReport(null)
      if (stored) {
        const [cites, decs] = await Promise.all([
          researchApi.getCitations(id).catch(() => null),
          researchApi.getDecisions(id).catch(() => ({ decisions: [] })),
        ])
        if (cites) setCitationReport(cites)
        setDecisions(decs.decisions || [])
        const lists = journalListRef && journalListRef.length ? journalListRef : journalList
        const preferred = stored.selected_journal_id || doc.selected_journal_id || localStorage.getItem('paperpilot-journal')
        const valid = lists.some((j) => j.journal_id === preferred) ? preferred : 'nature_like'
        setSelectedJournalId(valid)
      }
    } catch (error) {
      setErrorKey('loading-doc', error.message || 'Unable to load the manuscript.')
    } finally {
      setBusyKey('loading-doc', false)
    }
  }, [journalList])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await researchApi.getHealth()
        if (!cancelled) setBackendOk(true)
      } catch {
        if (!cancelled) setBackendOk(false)
      }
      try {
        const ai = await researchApi.getAiStatus()
        if (!cancelled) setAiStatus(ai)
      } catch {
        if (!cancelled) setAiStatus(null)
      }
      let journals = []
      try {
        const body = await researchApi.getJournals()
        journals = body.journals || []
        if (!cancelled) setJournalList(journals)
      } catch {
        if (!cancelled) setJournalList([])
      }
      try {
        const lib = await researchApi.listDocuments()
        if (!cancelled) setManuscripts(lib.documents || [])
      } catch (error) {
        if (!cancelled) setLibraryError(error.message || 'Unable to load the manuscript library.')
      }
      const saved = localStorage.getItem('paperpilot-doc')
      if (saved && !cancelled) {
        try {
          const doc = await researchApi.getDocument(saved)
          if (!cancelled && doc) {
            setDocumentId(saved)
            setDocMeta({ filename: doc.filename, status: doc.status })
            setAnalysis(doc.analysis || null)
            if (doc.analysis) {
              const cites = await researchApi.getCitations(saved).catch(() => null)
              if (!cancelled && cites) setCitationReport(cites)
              const decs = await researchApi.getDecisions(saved).catch(() => ({ decisions: [] }))
              if (!cancelled) setDecisions(decs.decisions || [])
              const preferred = doc.analysis.selected_journal_id || localStorage.getItem('paperpilot-journal')
              if (journals.some((j) => j.journal_id === preferred)) setSelectedJournalId(preferred)
            }
          }
        } catch {
          if (!cancelled) localStorage.removeItem('paperpilot-doc')
        }
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  const go = (page) => {
    setActive(page)
    setSidebarOpen(false)
  }

  const runAssessment = async (key, fn) => {
    if (!documentId || !analysis) return null
    setBusyKey(key, true)
    setErrorKey(key, '')
    try {
      const result = await fn()
      return result
    } catch (error) {
      setErrorKey(key, error.message || 'Assessment failed.')
      return null
    } finally {
      setBusyKey(key, false)
    }
  }

  const handleFiles = async (files) => {
    const file = files && files[0]
    if (!file || uploadState.phase === 'uploading') return
    if (!file.name.toLowerCase().endsWith('.docx')) {
      setUploadState({ phase: 'error', message: 'Only DOCX manuscripts are supported.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadState({ phase: 'error', message: 'File exceeds the configured 15 MB limit.' })
      return
    }
    setUploadState({ phase: 'uploading', message: `Uploading ${file.name}...` })
    try {
      const uploaded = await researchApi.uploadDocument(file)
      const id = uploaded.document_id
      setUploadState({ phase: 'uploading', message: 'Parsing document structure...' })
      const analyzed = await researchApi.analyzeDocument(id, { journal_id: selectedJournalId })
      const payload = { ...analyzed, document_id: id }
      setDocumentId(id)
      localStorage.setItem('paperpilot-doc', id)
      setDocMeta({ filename: uploaded.filename, status: 'analyzed' })
      setAnalysis(payload)
      setQuality(null); setNovelty(null); setMethodology(null); setContribution(null)
      setWriting(null); setImprovements(null); setJournalMatch(null); setReport(null)
      setUploadState({ phase: 'uploading', message: 'Checking citations...' })
      const cites = await researchApi.getCitations(id).catch(() => null)
      if (cites) setCitationReport(cites)
      setUploadState({ phase: 'uploading', message: 'Running pre-submission assessments...' })
      const settled = await Promise.allSettled([
        researchApi.analyze('quality', { document_id: id, analysis: payload }),
        researchApi.analyze('novelty', { document_id: id, analysis: payload }),
        researchApi.analyze('methodology', { document_id: id, analysis: payload }),
        researchApi.analyze('contribution', { document_id: id, analysis: payload }),
        researchApi.analyze('writing', { document_id: id, analysis: payload }),
        researchApi.matchJournal({ document_id: id, analysis: payload, journal_id: selectedJournalId }),
        researchApi.generateImprovement({ document_id: id, analysis: payload, focus: 'research quality' }),
      ])
      const [q, n, m, c, w, j, imp] = settled.map((r) => (r.status === 'fulfilled' ? r.value : null))
      if (q) setQuality(q)
      if (n) setNovelty(n)
      if (m) setMethodology(m)
      if (c) setContribution(c)
      if (w) setWriting(w)
      if (j) setJournalMatch(j)
      if (imp) setImprovements(imp)
      if (q) {
        const rep = await researchApi.generateReport({
          document_id: id, analysis: payload, quality_analysis: q, selected_journal: selectedJournalId,
        }).catch(() => null)
        if (rep) setReport(rep)
      }
      const failed = settled.filter((r) => r.status === 'rejected').length
      await refreshLibrary()
      setUploadState({
        phase: 'done',
        message: failed === 0
          ? 'Upload and assessment complete.'
          : `${7 - failed} of 7 assessments completed. Re-run any missing assessment from its page.`,
      })
      go('analysis')
    } catch (error) {
      setUploadState({ phase: 'error', message: error.message || 'Upload or analysis failed.' })
    }
  }

  const selectedJournal = useMemo(
    () => journalList.find((item) => item.journal_id === selectedJournalId) || null,
    [journalList, selectedJournalId],
  )

  const assessedCount = [quality, novelty, methodology, contribution, writing].filter(Boolean).length
  const currentTitle = NAV.find((item) => item.id === active)?.label || 'Dashboard'

  return (
    <div className="app-shell">
      <div
        className={sidebarOpen ? 'sidebar-scrim visible' : 'sidebar-scrim'}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'} aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div>
            <strong>PaperPilot</strong>
            <small>Manuscript preparation</small>
          </div>
        </div>
        <nav>
          {NAV.map(({ label, icon: Icon, id }) => (
            <button
              type="button"
              key={id}
              className={active === id ? 'nav-item active' : 'nav-item'}
              aria-current={active === id ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={backendOk === true ? 'conn good' : backendOk === false ? 'conn bad' : 'conn'}>
            <span className="conn-dot" aria-hidden="true" />
            {backendOk === true ? 'Backend connected' : backendOk === false ? 'Backend unavailable' : 'Checking backend...'}
          </span>
          {aiStatus && <small className="muted">{aiStatus.label}</small>}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button type="button" className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <PanelLeft size={18} />
          </button>
          <div className="breadcrumbs">
            <span>PaperPilot</span>
            <span aria-hidden="true">/</span>
            <strong>{currentTitle}</strong>
          </div>
          <div className="top-actions">
            <button type="button" className="outline-button small" onClick={() => setShowHelp((v) => !v)} aria-expanded={showHelp}>
              Help
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </header>

        {showHelp && (
          <div className="help-popover" role="dialog" aria-label="Help">
            <div>
              <strong>About this workspace</strong>
              <span>Prepare a DOCX manuscript, review assessments, apply a journal template, and export a submission package. You remain responsible for scientific correctness, citations, originality, ethics, and final compliance with the journal's official author guidelines.</span>
            </div>
            <button type="button" className="icon-button" aria-label="Close help" onClick={() => setShowHelp(false)}><X size={14} /></button>
          </div>
        )}

        <div className="page-container">
          <ErrorBox message={errors['loading-doc']} />
          {busy['loading-doc'] && <LoadingRow label="Loading manuscript..." />}

          {active === 'dashboard' && (
            <Dashboard
              manuscripts={manuscripts}
              libraryError={libraryError}
              assessedCount={assessedCount}
              onOpen={(id) => { loadManuscript(id); go('analysis') }}
              onUpload={() => go('upload')}
              onRefresh={refreshLibrary}
            />
          )}
          {active === 'upload' && (
            <UploadPage uploadState={uploadState} onFiles={handleFiles} hasDocument={Boolean(documentId)} />
          )}
          {active === 'analysis' && (
            <AnalysisPage analysis={analysis} docMeta={docMeta} documentId={documentId} citationReport={citationReport} onGoUpload={() => go('upload')} onNext={() => go('citations')} />
          )}
          {active === 'citations' && (
            <CitationPage
              analysis={analysis}
              documentId={documentId}
              citationReport={citationReport}
              busy={busy.citations}
              error={errors.citations}
              onRecheck={async () => {
                const data = await runAssessment('citations', () => researchApi.getCitations(documentId))
                if (data) setCitationReport(data)
              }}
              onGoUpload={() => go('upload')}
              onNext={() => go('journal')}
            />
          )}
          {active === 'journal' && (
            <JournalPage
              analysis={analysis}
              documentId={documentId}
              journalList={journalList}
              selectedJournalId={selectedJournalId}
              selectedJournal={selectedJournal}
              journalMatch={journalMatch}
              busy={busy.journal}
              error={errors.journal}
              onSelect={async (next) => {
                setSelectedJournalId(next)
                localStorage.setItem('paperpilot-journal', next)
                if (!documentId || !analysis) return
                setBusyKey('journal', true)
                setErrorKey('journal', '')
                try {
                  const match = await researchApi.matchJournal({ document_id: documentId, analysis, journal_id: next })
                  setJournalMatch(match)
                } catch (error) {
                  setJournalMatch(null)
                  setErrorKey('journal', (error.message || 'Journal-fit assessment failed.') + ' Previous results were cleared.')
                } finally {
                  setBusyKey('journal', false)
                }
              }}
              onGoUpload={() => go('upload')}
              onNext={() => go('quality')}
            />
          )}
          {active === 'quality' && (
            <QualityPage
              data={quality} contribution={contribution}
              busy={busy.quality} error={errors.quality}
              hasDocument={Boolean(analysis)}
              onRun={async () => {
                const q = await runAssessment('quality', () => researchApi.analyze('quality', { document_id: documentId, analysis }))
                if (q) setQuality(q)
                const c = await runAssessment('quality', () => researchApi.analyze('contribution', { document_id: documentId, analysis }))
                if (c) setContribution(c)
              }}
              onGoUpload={() => go('upload')} onNext={() => go('novelty')}
            />
          )}
          {active === 'novelty' && (
            <NoveltyPage
              data={novelty} busy={busy.novelty} error={errors.novelty} hasDocument={Boolean(analysis)}
              onRun={async () => {
                const n = await runAssessment('novelty', () => researchApi.analyze('novelty', { document_id: documentId, analysis }))
                if (n) setNovelty(n)
              }}
              onGoUpload={() => go('upload')} onNext={() => go('methodology')}
            />
          )}
          {active === 'methodology' && (
            <MethodologyPage
              data={methodology} busy={busy.method} error={errors.method} hasDocument={Boolean(analysis)}
              onRun={async () => {
                const m = await runAssessment('method', () => researchApi.analyze('methodology', { document_id: documentId, analysis }))
                if (m) setMethodology(m)
              }}
              onGoUpload={() => go('upload')} onNext={() => go('improvements')}
            />
          )}
          {active === 'improvements' && (
            <ImprovementsPage
              documentId={documentId}
              analysis={analysis}
              improvements={improvements}
              decisions={decisions}
              busy={busy.improvements}
              error={errors.improvements}
              onGenerate={async () => {
                const imp = await runAssessment('improvements', () => researchApi.generateImprovement({ document_id: documentId, analysis, focus: 'research quality' }))
                if (imp) {
                  setImprovements(imp)
                  const decs = await researchApi.getDecisions(documentId).catch(() => ({ decisions: [] }))
                  setDecisions(decs.decisions || [])
                }
              }}
              onDecide={async (suggestionId, decision, editedText) => {
                await researchApi.saveDecision({ document_id: documentId, suggestion_id: suggestionId, decision, edited_text: editedText ?? null })
                const decs = await researchApi.getDecisions(documentId).catch(() => ({ decisions: [] }))
                setDecisions(decs.decisions || [])
              }}
              onGoUpload={() => go('upload')} onNext={() => go('report')}
            />
          )}
          {active === 'report' && (
            <ReportPage
              analysis={analysis} docMeta={docMeta} documentId={documentId}
              selectedJournal={selectedJournal} citationReport={citationReport}
              quality={quality} novelty={novelty} methodology={methodology}
              writing={writing} journalMatch={journalMatch}
              improvements={improvements} decisions={decisions}
              hasGenerated={manuscripts.some((m) => m.document_id === documentId && m.has_generated)}
              report={report} busy={busy.report} error={errors.report}
              onGenerate={async () => {
                const rep = await runAssessment('report', () => researchApi.generateReport({
                  document_id: documentId, analysis, quality_analysis: quality, selected_journal: selectedJournalId,
                }))
                if (rep) setReport(rep)
              }}
              needsQuality={Boolean(analysis) && !quality}
              onGoUpload={() => go('upload')} onNext={() => go('export')}
            />
          )}
          {active === 'export' && (
            <ExportPage
              analysis={analysis} documentId={documentId}
              selectedJournal={selectedJournal} selectedJournalId={selectedJournalId}
              exportState={exportState} setExportState={setExportState}
              onGenerated={refreshLibrary} onGoUpload={() => go('upload')}
            />
          )}
          {active === 'settings' && (
            <SettingsPage
              theme={theme} setTheme={setTheme}
              journalList={journalList} selectedJournalId={selectedJournalId}
              onDefaultJournal={(id) => { setSelectedJournalId(id); localStorage.setItem('paperpilot-journal', id) }}
              aiStatus={aiStatus} backendOk={backendOk}
            />
          )}
        </div>
      </main>
    </div>
  )
}

/* ---------- pages ---------- */

function Dashboard({ manuscripts, libraryError, assessedCount, onOpen, onUpload, onRefresh }) {
  const total = manuscripts.length
  const analyzed = manuscripts.filter((m) => m.has_analysis).length
  const generated = manuscripts.filter((m) => m.has_generated).length
  return (
    <>
      <PageHeader
        kicker="PAPERPILOT"
        title="Research workspace"
        subtitle="Review manuscripts, citation integrity, journal fit, and submission readiness."
        action={<button type="button" className="primary-button" onClick={onUpload}><UploadCloud size={16} /> Upload manuscript</button>}
      />
      <ErrorBox message={libraryError} onRetry={onRefresh} />
      <section className="stats-grid" aria-label="Workspace statistics">
        <StatCard label="Manuscripts" value={total} detail={total === 1 ? '1 uploaded document' : 'uploaded documents'} icon={FileText} />
        <StatCard label="Analyzed" value={analyzed} detail="with parsed structure" icon={Gauge} />
        <StatCard label="Submission packages" value={generated} detail="generated outputs" icon={FolderOpen} />
        <StatCard label="Assessments this session" value={assessedCount} detail="of 5 review modules" icon={BarChart3} />
      </section>

      <section className="section-heading">
        <div>
          <p className="kicker">MANUSCRIPT LIBRARY</p>
          <h2>Manuscripts</h2>
        </div>
        <button type="button" className="text-button" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button>
      </section>

      {total === 0 ? (
        <EmptyState
          title="No manuscript uploaded"
          body="Upload a DOCX to begin document analysis."
          action={<button type="button" className="primary-button" onClick={onUpload}>Upload manuscript</button>}
        />
      ) : (
        <div className="manuscript-list" role="list">
          {manuscripts.map((doc) => (
            <div className="manuscript-row" key={doc.document_id} role="listitem">
              <div className="doc-type" aria-hidden="true"><FileText size={18} /></div>
              <div className="doc-name">
                <strong>{doc.filename}</strong>
                <span>{doc.document_id} · {fmtDate(doc.created_at)}</span>
              </div>
              <StatusBadge status={doc.status} />
              <span className="muted small">{doc.has_generated ? 'Package generated' : doc.has_analysis ? 'Analyzed' : 'Uploaded'}</span>
              <button type="button" className="outline-button small" onClick={() => onOpen(doc.document_id)}>
                Open <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function UploadPage({ uploadState, onFiles, hasDocument }) {
  const [dragActive, setDragActive] = useState(false)
  const dragCount = useRef(0)
  const inputRef = useRef(null)
  const busy = uploadState.phase === 'uploading'

  return (
    <>
      <PageHeader
        kicker="SUBMISSION PREPARATION"
        title="Upload manuscript"
        subtitle="DOCX only · maximum 15 MB. The original file is preserved; formatting creates separate outputs."
      />
      {uploadState.phase === 'uploading' && <LoadingRow label={uploadState.message} />}
      {uploadState.phase === 'done' && (
        <div className="alert alert-success" role="status"><CheckCircle2 size={16} /><span>{uploadState.message}</span></div>
      )}
      {uploadState.phase === 'error' && (
        <div className="alert alert-error" role="alert"><XCircle size={16} /><span>{uploadState.message}</span></div>
      )}
      <section className="panel">
        <div
          className={dragActive ? 'dropzone active' : 'dropzone'}
          role="button"
          tabIndex={0}
          aria-label="Manuscript drop zone. Press Enter to browse for a DOCX file."
          onClick={() => inputRef.current && inputRef.current.click()}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current && inputRef.current.click() } }}
          onDragEnter={(event) => { event.preventDefault(); dragCount.current += 1; setDragActive(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { event.preventDefault(); dragCount.current -= 1; if (dragCount.current <= 0) { dragCount.current = 0; setDragActive(false) } }}
          onDrop={(event) => {
            event.preventDefault()
            dragCount.current = 0
            setDragActive(false)
            if (!busy) onFiles(event.dataTransfer.files)
          }}
        >
          <UploadCloud size={30} aria-hidden="true" />
          <span>{busy ? 'Processing manuscript...' : 'Drag and drop your DOCX manuscript here'}</span>
          <strong>{busy ? uploadState.message : 'or click to browse files'}</strong>
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="visually-hidden"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => { onFiles(event.target.files); event.target.value = '' }}
          />
        </div>
        <p className="supporting-text">
          After upload, the system parses the structure, checks citation consistency, and runs quality,
          similarity, methodology, writing, and journal-fit assessments.
          {hasDocument ? ' Uploading a new file starts a new manuscript record.' : ''}
        </p>
      </section>
    </>
  )
}

function AnalysisPage({ analysis, docMeta, documentId, citationReport, onGoUpload, onNext }) {
  if (!analysis) {
    return (
      <>
        <PageHeader kicker="DOCUMENT INTELLIGENCE" title="Document analysis" subtitle="Detected manuscript structure and metadata." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }
  const checks = completenessChecks(analysis)
  const passed = checks.filter((c) => c.ok).length
  const counts = {
    sections: (analysis.sections || []).length,
    figures: (analysis.figures || []).length,
    tables: (analysis.tables || []).length,
    equations: (analysis.equations || []).length,
    citations: (analysis.citations || []).length,
    references: (analysis.references || []).length,
  }
  return (
    <>
      <PageHeader
        kicker="DOCUMENT INTELLIGENCE"
        title="Document analysis"
        subtitle="Detected manuscript structure and metadata. Values shown as “Not detected” could not be reliably extracted."
        action={<button type="button" className="primary-button" onClick={onNext}>Check citations <ArrowRight size={16} /></button>}
      />
      <section className="panel">
        <p className="kicker">MANUSCRIPT</p>
        <h2 className="doc-title">{analysis.title || docMeta?.filename || 'Untitled manuscript'}</h2>
        <p className="muted small">{documentId} · {docMeta?.filename || ''} · Status: {docMeta?.status || 'analyzed'}</p>
        <div className="info-list">
          <p><strong>Authors:</strong> {(analysis.authors || []).join(', ') || 'Not detected'}</p>
          <p><strong>Abstract:</strong> {analysis.abstract || 'Not detected'}</p>
          <p><strong>Keywords:</strong> {(analysis.keywords || []).join(', ') || 'Not detected'}</p>
          {citationReport && <p><strong>Citation check:</strong> {citationReport.total_citations} in-text citations / {citationReport.total_references} references</p>}
        </div>
      </section>

      <section className="stats-grid compact-grid" aria-label="Detected element counts">
        <StatCard label="Sections" value={counts.sections} detail="manuscript headings" icon={FileText} />
        <StatCard label="Figures" value={counts.figures} detail="visual elements" icon={BarChart3} />
        <StatCard label="Tables" value={counts.tables} detail="data panels" icon={BookOpen} />
        <StatCard label="Equations" value={counts.equations} detail="math objects" icon={Gauge} />
        <StatCard label="Citations" value={counts.citations} detail="in-text references" icon={Sparkles} />
        <StatCard label="References" value={counts.references} detail="bibliography entries" icon={ShieldCheck} />
      </section>

      <div className="detail-grid two-col">
        <section className="panel">
          <p className="kicker">DOCUMENT COMPLETENESS</p>
          <h2>{passed} of {checks.length} checks</h2>
          <p className="supporting-text">Counts how many expected manuscript elements the parser detected. It does not measure scientific quality.</p>
          <ul className="check-list">
            {checks.map((check) => (
              <li key={check.label} className={check.ok ? 'ok' : 'missing'}>
                <span aria-hidden="true">{check.ok ? <Check size={14} /> : <AlertTriangle size={14} />}</span>
                {check.label}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <p className="kicker">SECTION MAP</p>
          <h2>Detected structure</h2>
          <div className="finding-list scrollable">
            {(analysis.sections || []).length === 0 && <p className="muted">No sections detected.</p>}
            {(analysis.sections || []).map((section, index) => (
              <div className="finding" key={`${section.heading}-${index}`}>
                <span className="finding-mark good"><Check size={14} /></span>
                <div><strong>{section.heading || 'Untitled section'}</strong><span>{section.type || 'unknown'}</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function CitationPage({ analysis, documentId, citationReport, busy, error, onRecheck, onGoUpload, onNext }) {
  if (!analysis) {
    return (
      <>
        <PageHeader kicker="REFERENCE INTEGRITY" title="Citation check" subtitle="Consistency between in-text citations and the reference list." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }
  const issues = [
    ...(citationReport?.missing_references || []).map((i, idx) => ({ ...i, key: `missing-${idx}` })),
    ...(citationReport?.uncited_references || []).map((i, idx) => ({ ...i, key: `uncited-${idx}` })),
    ...(citationReport?.duplicate_references || []).map((i, idx) => ({ ...i, key: `dup-${idx}` })),
    ...(citationReport?.numbering_issues || []).map((i, idx) => ({ ...i, key: `num-${idx}` })),
  ]
  return (
    <>
      <PageHeader
        kicker="REFERENCE INTEGRITY"
        title="Citation check"
        subtitle="This checks consistency between detected in-text citations and the detected reference list. It is not a guarantee that every citation is scientifically appropriate."
        action={<span className="button-row">
          <button type="button" className="outline-button" onClick={onRecheck} disabled={busy}>{busy ? 'Rechecking...' : 'Recheck'}</button>
          <button type="button" className="primary-button" onClick={onNext}>Journal fit <ArrowRight size={16} /></button>
        </span>}
      />
      {busy && <LoadingRow label="Rechecking citations..." />}
      <ErrorBox message={error} onRetry={onRecheck} />
      <section className="stats-grid compact-grid" aria-label="Citation statistics">
        <StatCard label="In-text citations" value={citationReport?.total_citations ?? '—'} detail="detected" icon={BookOpen} />
        <StatCard label="References" value={citationReport?.total_references ?? '—'} detail="bibliography entries" icon={FileText} />
        <StatCard label="Missing refs" value={(citationReport?.missing_references || []).length} detail="cited but not listed" icon={AlertTriangle} />
        <StatCard label="Uncited refs" value={(citationReport?.uncited_references || []).length} detail="listed but never cited" icon={Sparkles} />
      </section>
      <div className="detail-grid two-col">
        <section className="panel">
          <p className="kicker">ISSUES</p>
          <h2>Reference problems</h2>
          {!citationReport ? (
            <p className="muted">Citation data has not been retrieved yet. Use Recheck to load it.</p>
          ) : issues.length === 0 ? (
            <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>No consistency issues detected</strong><span>In-text citations and the reference list align.</span></div></div>
          ) : (
            <div className="finding-list scrollable">
              {issues.map((issue) => (
                <div className="finding" key={issue.key}>
                  <span className="finding-mark warning">!</span>
                  <div><strong>{issue.citation || issue.type || 'Citation issue'}</strong><span>{issue.message}</span></div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <p className="kicker">BIBLIOGRAPHY</p>
          <h2>Detected references ({(analysis.references || []).length})</h2>
          <div className="finding-list scrollable">
            {(analysis.references || []).length === 0 && <p className="muted">No references detected.</p>}
            {(analysis.references || []).map((ref, index) => (
              <div className="finding" key={ref.id || index}>
                <span className="finding-mark neutral">{ref.id || index + 1}</span>
                <div><strong>{ref.id ? `[${ref.id}]` : `#${index + 1}`}</strong><span>{ref.raw_text || ref.text || 'Empty entry'}</span></div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <p className="supporting-text">Document: {documentId}. No plagiarism detection is performed.</p>
    </>
  )
}

function JournalPage({ analysis, documentId, journalList, selectedJournalId, selectedJournal, journalMatch, busy, error, onSelect, onGoUpload, onNext }) {
  if (!analysis) {
    return (
      <>
        <PageHeader kicker="SCOPE SUITABILITY" title="Journal fit" subtitle="Topic alignment between the manuscript and the selected journal." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }
  return (
    <>
      <PageHeader
        kicker="SCOPE SUITABILITY"
        title="Journal fit"
        subtitle="A journal-fit assessment based on manuscript terms and the journal's configured scope. It is not an acceptance prediction."
        action={<button type="button" className="primary-button" onClick={onNext}>Review quality <ArrowRight size={16} /></button>}
      />
      {busy && <LoadingRow label="Assessing journal fit..." />}
      <ErrorBox message={error} />
      <section className="panel">
        <p className="kicker">SELECTED JOURNAL</p>
        <div className="journal-select-row">
          <label className="visually-hidden" htmlFor="journal-select">Select journal</label>
          <select id="journal-select" value={selectedJournalId} onChange={(event) => onSelect(event.target.value)} disabled={busy}>
            {journalList.map((journal) => (
              <option key={journal.journal_id} value={journal.journal_id}>{journal.journal_name}</option>
            ))}
          </select>
          {journalMatch && <div className="score-badge">{Math.round((journalMatch.score || 0) * 100)}% fit</div>}
        </div>
        {!journalMatch && !busy && !error && <p className="muted">Select a journal to run the fit assessment.</p>}
        {journalMatch && (
          <div className="finding-list">
            <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>Relevant topics</strong><span>{(journalMatch.relevant_topics || []).join(', ') || 'None identified'}</span></div></div>
            <div className="finding"><span className="finding-mark warning">!</span><div><strong>Scope gaps</strong><span>{(journalMatch.scope_gaps || []).join(' ') || 'No major gaps detected.'}</span></div></div>
            <div className="finding"><span className="finding-mark neutral">•</span><div><strong>Explanation</strong><span>{journalMatch.explanation}</span></div></div>
            <div className="finding"><span className="finding-mark neutral">•</span><div><strong>Suitability</strong><span>{journalMatch.suitable ? 'Broadly suitable for scope — researcher review still required.' : 'Weak scope alignment — consider another venue or reframing.'}</span></div></div>
          </div>
        )}
      </section>
      {selectedJournal && (
        <section className="panel">
          <p className="kicker">FORMATTING RULES</p>
          <h2>{selectedJournal.template_name || selectedJournal.journal_name}</h2>
          <div className="info-list">
            <p><strong>Publisher/style:</strong> {selectedJournal.publisher || '—'} · {selectedJournal.style || '—'}</p>
            <p><strong>Layout:</strong> {selectedJournal.page_size || '—'} · {(selectedJournal.columns || '—')}-column</p>
            <p><strong>Font:</strong> {selectedJournal.font || '—'} {selectedJournal.font_size ? `${selectedJournal.font_size}pt body` : ''}</p>
            <p><strong>Citations/references:</strong> {selectedJournal.citation_style || '—'} / {selectedJournal.reference_style || '—'}</p>
          </div>
          <p className="supporting-text">Journal rules are based on the application's configured template data. Always verify the latest official author guidelines before submission.</p>
        </section>
      )}
      <p className="supporting-text">Document: {documentId}. The selected journal is stored with the manuscript on formatting.</p>
    </>
  )
}

function AssessmentShell({ kicker, title, subtitle, data, busy, error, hasDocument, onRun, onGoUpload, onNext, nextLabel, emptyHint, children }) {
  if (!hasDocument) {
    return (
      <>
        <PageHeader kicker={kicker} title={title} subtitle={subtitle} />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }
  return (
    <>
      <PageHeader
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        action={<span className="button-row">
          <button type="button" className="outline-button" onClick={onRun} disabled={busy}>{busy ? 'Running...' : data ? 'Re-run assessment' : 'Run assessment'}</button>
          <button type="button" className="primary-button" onClick={onNext}>{nextLabel} <ArrowRight size={16} /></button>
        </span>}
      />
      {busy && <LoadingRow label="Running assessment..." />}
      <ErrorBox message={error} onRetry={onRun} />
      {!data && !busy && !error && <p className="muted">{emptyHint}</p>}
      {data && children}
    </>
  )
}

function QualityPage({ data, contribution, busy, error, hasDocument, onRun, onGoUpload, onNext }) {
  return (
    <AssessmentShell
      kicker="RESEARCH QUALITY REVIEW" title="Quality" subtitle="Assessment findings on completeness, contribution, and writing. Review these findings with your supervisor/co-author."
      data={data} busy={busy} error={error} hasDocument={hasDocument} onRun={onRun} onGoUpload={onGoUpload} onNext={onNext} nextLabel="Novelty & similarity"
      emptyHint="No quality assessment has been run for this manuscript in this session."
    >
      <div className="detail-grid two-col">
        <section className="panel">
          <p className="kicker">FINDINGS</p>
          <h2>Assessment</h2>
          <div className="finding-list">
            <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>Research gap</strong><span>{data.research_gap}</span></div></div>
            <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>Technical contribution</strong><span>{data.technical_contribution}</span></div></div>
            <div className="finding"><span className="finding-mark warning">!</span><div><strong>Methodology issues</strong><span>{(data.methodology_issues || []).join(' ') || 'None flagged'}</span></div></div>
            <div className="finding"><span className="finding-mark neutral">•</span><div><strong>Missing sections</strong><span>{(data.missing_sections || []).join(', ') || 'None detected'}</span></div></div>
            <div className="finding"><span className="finding-mark neutral">•</span><div><strong>Writing issues</strong><span>{(data.writing_issues || []).join(' ') || 'None flagged'}</span></div></div>
          </div>
        </section>
        <section className="panel">
          <p className="kicker">ACTIONS</p>
          <h2>Suggestions</h2>
          <ul className="mini-list">
            {(data.suggestions || []).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
          </ul>
          {contribution && (
            <>
              <p className="kicker">CONTRIBUTION SUMMARY</p>
              <p className="supporting-text"><strong>Problem:</strong> {contribution.problem}</p>
              <p className="supporting-text"><strong>Contribution:</strong> {contribution.contribution}</p>
            </>
          )}
        </section>
      </div>
    </AssessmentShell>
  )
}

function NoveltyPage({ data, busy, error, hasDocument, onRun, onGoUpload, onNext }) {
  return (
    <AssessmentShell
      kicker="SIMILARITY SIGNALS" title="Novelty & similarity assessment"
      subtitle="Related-work similarity signals for researcher review. No external scholarly search is performed."
      data={data} busy={busy} error={error} hasDocument={hasDocument} onRun={onRun} onGoUpload={onGoUpload} onNext={onNext} nextLabel="Methodology"
      emptyHint="No similarity assessment has been run for this manuscript in this session."
    >
      <div className="detail-grid two-col">
        <section className="panel">
          <p className="kicker">SIMILAR ITEMS</p>
          <h2>Related research</h2>
          <div className="finding-list">
            {(data.similar_papers || []).map((paper, idx) => (
              <div className="finding" key={`${paper.title}-${idx}`}>
                <span className="finding-mark neutral">{idx + 1}</span>
                <div><strong>{paper.title}</strong><span>{[paper.venue, paper.year].filter(Boolean).join(' · ')}{paper.similarity != null ? ` · similarity signal ${paper.similarity}` : ''}</span></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <p className="kicker">RECOMMENDATION</p>
          <h2>What to improve</h2>
          <p className="supporting-text">{data.comparative_summary}</p>
          <ul className="mini-list">
            {(data.potential_differentiators || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="supporting-text">Similarity is evidence for review, not a verdict. No plagiarism detection or originality certification is provided.</p>
        </section>
      </div>
    </AssessmentShell>
  )
}

function MethodologyPage({ data, busy, error, hasDocument, onRun, onGoUpload, onNext }) {
  return (
    <AssessmentShell
      kicker="REPRODUCIBILITY" title="Methodology"
      subtitle="Whether the manuscript reports enough technical detail to be trusted and repeated. Completeness is assessed, not scientific validity."
      data={data} busy={busy} error={error} hasDocument={hasDocument} onRun={onRun} onGoUpload={onGoUpload} onNext={onNext} nextLabel="Improvements"
      emptyHint="No methodology assessment has been run for this manuscript in this session."
    >
      <div className="detail-grid two-col">
        <section className="panel">
          <p className="kicker">DETECTED</p>
          <h2>Method details present</h2>
          <ul className="mini-list">
            {(data.detected_information || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          {(data.strengths || []).map((item) => <p className="supporting-text" key={item}>{item}</p>)}
        </section>
        <section className="panel">
          <p className="kicker">GAPS</p>
          <h2>Missing / weak</h2>
          <p className="supporting-text">{data.potential_weakness}</p>
          <ul className="mini-list">
            {(data.missing_information || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="supporting-text"><strong>Suggested action:</strong> {data.actionable_suggestion}</p>
        </section>
      </div>
    </AssessmentShell>
  )
}

function ImprovementsPage({ documentId, analysis, improvements, decisions, busy, error, onGenerate, onDecide, onGoUpload, onNext }) {
  const [savingId, setSavingId] = useState('')
  const [saveError, setSaveError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editText, setEditText] = useState('')
  const decisionById = useMemo(() => {
    const map = {}
    for (const d of decisions || []) map[d.suggestion_id] = d
    return map
  }, [decisions])

  if (!analysis) {
    return (
      <>
        <PageHeader kicker="RESEARCHER REVIEW" title="Improvements" subtitle="Suggested improvements with persistent review decisions." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }

  const decide = async (suggestionId, decision, editedText) => {
    setSavingId(suggestionId)
    setSaveError('')
    try {
      await onDecide(suggestionId, decision, editedText)
      setEditingId('')
    } catch (err) {
      setSaveError(err.message || 'Could not save the review decision.')
    } finally {
      setSavingId('')
    }
  }

  const suggestions = improvements?.suggestions || []
  const decidedCount = suggestions.filter((s) => decisionById[s.id]).length

  return (
    <>
      <PageHeader
        kicker="RESEARCHER REVIEW"
        title="Improvements"
        subtitle={suggestions.length ? `${decidedCount} of ${suggestions.length} suggestions reviewed. Decisions are stored on the server.` : 'Suggested improvements for researcher review. Decisions are stored on the server.'}
        action={<span className="button-row">
          <button type="button" className="outline-button" onClick={onGenerate} disabled={busy}>{busy ? 'Generating...' : improvements ? 'Regenerate' : 'Generate suggestions'}</button>
          <button type="button" className="primary-button" onClick={onNext}>Readiness report <ArrowRight size={16} /></button>
        </span>}
      />
      {busy && <LoadingRow label="Generating suggestions..." />}
      <ErrorBox message={error} onRetry={onGenerate} />
      {saveError && <div className="alert alert-error" role="alert"><XCircle size={16} /><span>{saveError}</span></div>}
      {suggestions.length === 0 && !busy && <p className="muted">No suggestions generated yet for {documentId}.</p>}
      <div className="improvement-list">
        {suggestions.map((item) => {
          const decision = decisionById[item.id]
          const isEditing = editingId === item.id
          return (
            <div key={item.id} className="panel improvement-card">
              <div className="improvement-header">
                <span>{item.section}{decision ? ` · ${decision.decision}` : ' · pending review'}</span>
                <div className="button-row">
                  <button type="button" className="chip accept" aria-pressed={decision?.decision === 'accepted'} disabled={savingId === item.id} onClick={() => decide(item.id, 'accepted', null)}>Accept</button>
                  <button type="button" className="chip reject" aria-pressed={decision?.decision === 'rejected'} disabled={savingId === item.id} onClick={() => decide(item.id, 'rejected', null)}>Reject</button>
                  <button
                    type="button" className="chip edit" aria-pressed={decision?.decision === 'edited'} disabled={savingId === item.id}
                    onClick={() => { setEditingId(item.id); setEditText(decision?.edited_text || item.suggested || '') }}
                  >Edit</button>
                </div>
              </div>
              {savingId === item.id && <p className="muted small">Saving decision...</p>}
              <div className="comparison-grid">
                <div>
                  <p className="field-label">Original</p>
                  <p>{item.original}</p>
                </div>
                <div>
                  <p className="field-label">Suggested improvement</p>
                  {isEditing ? (
                    <>
                      <label className="visually-hidden" htmlFor={`edit-${item.id}`}>Edited suggestion text</label>
                      <textarea
                        id={`edit-${item.id}`}
                        className="edit-area"
                        rows={4}
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                      />
                      <div className="button-row">
                        <button type="button" className="primary-button small" disabled={!editText.trim() || savingId === item.id} onClick={() => decide(item.id, 'edited', editText.trim())}>Save edited text</button>
                        <button type="button" className="outline-button small" onClick={() => setEditingId('')}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <p>{decision?.decision === 'edited' && decision.edited_text ? decision.edited_text : item.suggested}</p>
                  )}
                  <p className="muted small">{item.reason}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ReportPage({ analysis, docMeta, documentId, selectedJournal, citationReport, quality, novelty, methodology, writing, journalMatch, improvements, decisions, hasGenerated, report, busy, error, onGenerate, needsQuality, onGoUpload, onNext }) {
  if (!analysis) {
    return (
      <>
        <PageHeader kicker="PRE-SUBMISSION ASSESSMENT" title="Readiness report" subtitle="Advisory assessment compiled from actual analysis results." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }
  const decided = (decisions || []).length
  const totalSuggestions = (improvements?.suggestions || []).length
  return (
    <>
      <PageHeader
        kicker="PRE-SUBMISSION ASSESSMENT"
        title={report?.title || 'Pre-Submission Readiness Assessment'}
        subtitle={report?.summary || 'An advisory assessment. It does not guarantee publication or acceptance.'}
        action={<span className="button-row">
          <button type="button" className="outline-button" onClick={onGenerate} disabled={busy || needsQuality}>{busy ? 'Generating...' : report ? 'Regenerate report' : 'Generate report'}</button>
          <button type="button" className="primary-button" onClick={onNext}>Export <ArrowRight size={16} /></button>
        </span>}
      />
      {needsQuality && <p className="muted">Run the Quality assessment first — the report builds on it.</p>}
      {busy && <LoadingRow label="Generating readiness report..." />}
      <ErrorBox message={error} onRetry={onGenerate} />
      {!report && !busy && (
        <EmptyState title="No report generated" body="Generate the readiness report once the quality assessment is available." action={null} />
      )}
      {report && (
        <>
          <section className="panel">
            <p className="kicker">MANUSCRIPT</p>
            <div className="info-list">
              <p><strong>Document:</strong> {documentId} · {docMeta?.filename || ''}</p>
              <p><strong>Selected journal:</strong> {selectedJournal?.journal_name || 'Not selected'}</p>
              <p><strong>Structure:</strong> {(analysis.sections || []).length} sections · {(analysis.figures || []).length} figures · {(analysis.tables || []).length} tables · {(analysis.equations || []).length} equations</p>
              <p><strong>Citations:</strong> {citationReport ? `${citationReport.total_citations} in-text / ${citationReport.total_references} references · ${(citationReport.missing_references || []).length} missing · ${(citationReport.uncited_references || []).length} uncited` : 'Citation check not retrieved yet.'}</p>
              <p><strong>Quality:</strong> {quality ? (quality.research_gap || 'Assessed.') : 'Not assessed this session.'}</p>
              <p><strong>Similarity:</strong> {novelty ? (novelty.comparative_summary || 'Assessed.') : 'Not assessed this session.'}</p>
              <p><strong>Methodology:</strong> {methodology ? (methodology.potential_weakness || 'Assessed.') : 'Not assessed this session.'}</p>
              <p><strong>Writing:</strong> {writing ? (writing.clarity || 'Assessed.') : 'Not assessed this session.'}</p>
              <p><strong>Journal fit:</strong> {journalMatch ? `${Math.round((journalMatch.score || 0) * 100)}% fit for ${journalMatch.journal_id}` : 'Not assessed this session.'}</p>
              <p><strong>Improvement review:</strong> {totalSuggestions ? `${decided} of ${totalSuggestions} suggestions reviewed` : 'No suggestions generated yet.'}</p>
              <p><strong>Submission package:</strong> {hasGenerated ? 'Generated — see Export.' : 'Not generated yet.'}</p>
            </div>
          </section>
          <div className="detail-grid two-col">
            <section className="panel">
              <p className="kicker">ASSESSMENT SECTIONS</p>
              <h2>Findings</h2>
              <div className="finding-list">
                {(report.sections || []).map((section) => (
                  <div className="finding" key={section.name}>
                    <span className="finding-mark neutral">•</span>
                    <div><strong>{section.name} — {section.status}</strong><span>{typeof section.details === 'string' ? section.details : JSON.stringify(section.details)}</span></div>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <p className="kicker">FINAL CHECKLIST</p>
              <h2>Before submission</h2>
              <ul className="mini-list">
                {(report.final_checklist || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          </div>
          <p className="supporting-text">This report is an advisory assessment. It does not guarantee publication, acceptance, scientific correctness, originality, or compliance with the latest official journal instructions.</p>
        </>
      )}
    </>
  )
}

function ExportPage({ analysis, documentId, selectedJournal, selectedJournalId, exportState, setExportState, onGenerated, onGoUpload }) {
  const phase = exportState.phase

  const runExport = async () => {
    if (!documentId || !analysis) return
    if (phase === 'working') return
    setExportState({ phase: 'working', message: 'Applying journal template...', error: '' })
    try {
      await researchApi.formatDocument(documentId, { journal_id: selectedJournalId })
      setExportState({ phase: 'working', message: 'Generating DOCX, PDF, and readiness report...', error: '' })
      await researchApi.generateDocument(documentId, { journal_id: selectedJournalId })
      setExportState({ phase: 'ready', message: 'Submission package is ready.', error: '' })
      await onGenerated()
    } catch (error) {
      setExportState({ phase: 'error', message: 'Submission package generation failed. Review the error and retry.', error: error.message || 'Export failed.' })
    }
  }

  const downloadFile = async (format) => {
    try {
      const blob = await researchApi.download(documentId, format)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const names = { pdf: 'final_manuscript.pdf', report: 'readiness_report.pdf', zip: 'submission_package.zip', docx: 'final_manuscript.docx' }
      link.download = names[format] || `manuscript.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportState((prev) => ({ ...prev, error: error.message || `Could not download ${format.toUpperCase()}.` }))
    }
  }

  if (!analysis) {
    return (
      <>
        <PageHeader kicker="SUBMISSION PREPARATION" title="Export" subtitle="Journal-formatted outputs and the submission package." />
        <EmptyState title="No manuscript uploaded" body="Upload a DOCX manuscript to begin." action={<button type="button" className="primary-button" onClick={onGoUpload}>Go to upload</button>} />
      </>
    )
  }

  const ready = phase === 'ready'
  return (
    <>
      <PageHeader kicker="SUBMISSION PREPARATION" title="Export" subtitle="Prepared using the configured journal template/rules. Always verify the latest official author guidelines before submission." />
      <section className="panel">
        <p className="kicker">PUBLICATION PACKAGE</p>
        <div className="status-box">
          <strong>
            {phase === 'working' ? 'Generating...' : phase === 'ready' ? 'Ready for download' : phase === 'error' ? 'Generation failed' : 'Not generated yet'}
          </strong>
          <p>{exportState.error || exportState.message}</p>
          <p>Manuscript: {analysis.title || documentId} · Journal: {selectedJournal?.journal_name || selectedJournalId}</p>
          <p className="muted small">The original upload is preserved. Formatting creates separate output files.</p>
        </div>
        <div className="button-row export-buttons">
          <button type="button" className="primary-button" onClick={runExport} disabled={phase === 'working'}>
            {phase === 'working' ? 'Generating...' : ready ? 'Regenerate package' : 'Generate submission package'}
          </button>
          <button type="button" className="outline-button" onClick={() => downloadFile('docx')} disabled={!ready}>Download DOCX</button>
          <button type="button" className="outline-button" onClick={() => downloadFile('pdf')} disabled={!ready}>Download PDF</button>
          <button type="button" className="outline-button" onClick={() => downloadFile('report')} disabled={!ready}>Readiness report</button>
          <button type="button" className="outline-button" onClick={() => downloadFile('zip')} disabled={!ready}>Submission ZIP</button>
        </div>
      </section>
    </>
  )
}

function SettingsPage({ theme, setTheme, journalList, selectedJournalId, onDefaultJournal, aiStatus, backendOk }) {
  return (
    <>
      <PageHeader kicker="APPLICATION" title="Settings" subtitle="Workspace preferences and service information." />
      <section className="panel">
        <p className="kicker">APPEARANCE</p>
        <h2>Theme</h2>
        <div className="button-row" role="group" aria-label="Theme selection">
          <button type="button" className={theme === 'light' ? 'outline-button active' : 'outline-button'} onClick={() => setTheme('light')}>Light</button>
          <button type="button" className={theme === 'light' ? 'outline-button' : 'outline-button active'} onClick={() => setTheme('dark')}>Dark</button>
        </div>
        <p className="supporting-text">The theme is stored in this browser only.</p>
      </section>
      <section className="panel">
        <p className="kicker">DEFAULTS</p>
        <h2>Default journal</h2>
        <label className="visually-hidden" htmlFor="default-journal">Default journal</label>
        <select id="default-journal" value={selectedJournalId} onChange={(event) => onDefaultJournal(event.target.value)}>
          {journalList.map((journal) => (
            <option key={journal.journal_id} value={journal.journal_id}>{journal.journal_name}</option>
          ))}
        </select>
        <p className="supporting-text">Used for new uploads. Each manuscript stores its own selected journal on formatting.</p>
      </section>
      <section className="panel">
        <p className="kicker">SERVICES</p>
        <h2>Service status</h2>
        <div className="info-list">
          <p><strong>Backend:</strong> {backendOk === true ? 'Connected' : backendOk === false ? 'Unavailable — check that the API server is running.' : 'Checking...'}</p>
          <p><strong>Analysis mode:</strong> {aiStatus ? aiStatus.label : 'Unknown'}</p>
          <p className="supporting-text">{aiStatus ? aiStatus.note : 'Manuscript processing stays within the application/server unless an external provider is configured.'}</p>
        </div>
      </section>
      <section className="panel">
        <p className="kicker">ABOUT</p>
        <h2>PaperPilot</h2>
        <p className="supporting-text">Research manuscript preparation and pre-submission review. This tool provides advisory assessments and formatting preparation; it does not guarantee publication, verify scientific truth, detect plagiarism, or certify originality. The author remains responsible for scientific correctness, citations, originality, ethics, and final compliance with the selected journal's official instructions.</p>
      </section>
    </>
  )
}

export default App
