import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Gauge,
  Globe2,
  LogOut,
  Moon,
  PanelLeft,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  Zap,
} from 'lucide-react'
import AuthScreen from './AuthScreen'
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
  { label: 'Contribution', icon: BarChart3, id: 'contribution' },
  { label: 'Writing', icon: FileText, id: 'writing' },
  { label: 'Improvements', icon: Zap, id: 'improvements' },
  { label: 'Report', icon: ShieldCheck, id: 'report' },
  { label: 'Formatting', icon: FileText, id: 'formatting' },
  { label: 'Export', icon: FolderOpen, id: 'export' },
  { label: 'Settings', icon: Settings2, id: 'settings' },
]

const defaultAnalysis = {
  document_id: '',
  title: '',
  authors: [],
  abstract: '',
  keywords: [],
  sections: [],
  figures: [],
  tables: [],
  equations: [],
  citations: [],
  references: [],
  metadata: {},
}

const citationIssueCategories = [
  'missing_references',
  'uncited_references',
  'duplicate_references',
  'duplicate_reference_numbers',
  'numbering_issues',
  'duplicate_citation_numbers',
  'malformed_references',
  'invalid_structure',
  'missing_dois',
  'invalid_dois',
  'author_year_mismatches',
  'references_wrong_order',
  'style_mismatches',
  'inconsistent_authors',
  'inconsistent_years',
  'inconsistent_title_formatting',
  'inconsistent_doi_formatting',
]

function ThemeToggle({ theme, setTheme }) {
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

function ResearchWorkspace({ user, onSignOut }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('paperpilot-theme') || 'light')
  const [active, setActive] = useState('dashboard')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [selectedJournalId, setSelectedJournalId] = useState(() => localStorage.getItem('paperpilot-journal') || 'nature')
  const [journalList, setJournalList] = useState([])
  const [dashboardSummary, setDashboardSummary] = useState(null)
  const [aiStatus, setAiStatus] = useState({ status: 'limited_analysis', message: 'Checking analysis configuration.' })
  const [manuscripts, setManuscripts] = useState([])
  const [isLoadingManuscripts, setIsLoadingManuscripts] = useState(true)
  const [manuscriptError, setManuscriptError] = useState('')
  const [document, setDocument] = useState(defaultAnalysis)
  const [citationReport, setCitationReport] = useState({ total_citations: 0, total_references: 0 })
  const [qualityAnalysis, setQualityAnalysis] = useState({})
  const [noveltyAnalysis, setNoveltyAnalysis] = useState({})
  const [methodologyAnalysis, setMethodologyAnalysis] = useState({})
  const [contributionAnalysis, setContributionAnalysis] = useState({})
  const [completenessAnalysis, setCompletenessAnalysis] = useState({})
  const [writingAnalysis, setWritingAnalysis] = useState({})
  const [journalMatch, setJournalMatch] = useState({})
  const [improvements, setImprovements] = useState({ suggestions: [] })
  const [report, setReport] = useState({
    title: 'Pre-Submission Readiness Assessment',
    summary: 'Upload or open an analyzed manuscript to calculate readiness.',
    sections: [],
    final_checklist: [],
  })
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [statusMessage, setStatusMessage] = useState('Ready for upload')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('paperpilot-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('paperpilot-journal', selectedJournalId)
  }, [selectedJournalId])

  const refreshManuscripts = async () => {
    setIsLoadingManuscripts(true)
    try {
      const [body, summary] = await Promise.all([
        researchApi.getDocuments(),
        researchApi.getDashboardSummary(),
      ])
      setManuscripts(body.documents || [])
      setDashboardSummary(summary)
      setManuscriptError('')
    } catch (error) {
      setManuscriptError(error.message || 'Could not load manuscripts.')
    } finally {
      setIsLoadingManuscripts(false)
    }
  }

  useEffect(() => {
    refreshManuscripts()
    researchApi.getJournals().then((body) => setJournalList(body.journals || [])).catch(() => setJournalList([]))
    researchApi.getAiStatus().then(setAiStatus).catch(() => setAiStatus({ status: 'unavailable', message: 'Provider configuration unavailable.' }))
  }, [])

  const loadAnalysisModules = async (documentId, analysisPayload) => {
    const request = { document_id: documentId, analysis: analysisPayload, journal_id: selectedJournalId }
    const loadSavedOrCompute = async (module, compute) => {
      try {
        const saved = await researchApi.getSavedAnalysis(documentId, module)
        return saved.result
      } catch (error) {
        if (error.status !== 404) throw error
        return compute()
      }
    }

    // Recompute profile-dependent results because saved payloads do not identify their journal.
    const [quality, novelty, methodology, contribution, completeness, journal, writing, improvement] = await Promise.all([
      researchApi.analyze('quality', request),
      loadSavedOrCompute('novelty', () => researchApi.analyze('novelty', request)),
      loadSavedOrCompute('methodology', () => researchApi.analyze('methodology', request)),
      loadSavedOrCompute('contribution', () => researchApi.analyze('contribution', request)),
      researchApi.analyze('completeness', request),
      researchApi.matchJournal({ ...request, journal_id: selectedJournalId }),
      loadSavedOrCompute('writing', () => researchApi.analyze('writing', request)),
      researchApi.generateImprovement({ ...request, focus: 'research quality' }),
    ])
    const reportDetails = await researchApi.generateReport({
      ...request,
      quality_analysis: quality,
      selected_journal: selectedJournalId,
    })
    setQualityAnalysis(quality)
    setNoveltyAnalysis(novelty)
    setMethodologyAnalysis(methodology)
    setContributionAnalysis(contribution)
    setCompletenessAnalysis(completeness)
    setWritingAnalysis(writing)
    setJournalMatch(journal)
    setImprovements(improvement)
    setReport(reportDetails)
  }

  const openManuscript = async (documentId) => {
    setManuscriptError('')
    try {
      const record = await researchApi.getDocument(documentId)
      const analysis = record.analysis || await researchApi.analyzeDocument(documentId, { journal_id: selectedJournalId })
      const analysisPayload = { ...defaultAnalysis, ...analysis, document_id: documentId, title: analysis.title || record.filename }
      setDocument(analysisPayload)
      const citationData = await researchApi.getCitations(documentId)
      setCitationReport(citationData)
      await loadAnalysisModules(documentId, analysisPayload)
      setActive('analysis')
    } catch (error) {
      setManuscriptError(error.message || 'Could not open this manuscript.')
      setActive('manuscripts')
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['docx', 'pdf'].includes(extension)) {
      setUploadError('Choose a DOCX or text-based PDF manuscript.')
      return
    }

    setUploadError('')
    setIsUploading(true)
    setStatusMessage('Uploading and analyzing manuscript...')

    let documentCreated = false
    try {
      const uploaded = await researchApi.uploadDocument(file)
      documentCreated = true
      const articleId = uploaded.document_id
      const analyzed = await researchApi.analyzeDocument(articleId, { journal_id: selectedJournalId })
      const analysisPayload = { ...defaultAnalysis, ...analyzed, document_id: articleId }
      setDocument(analysisPayload)
      const citationData = await researchApi.getCitations(articleId)
      setCitationReport(citationData)
      await refreshManuscripts()
      setActive('analysis')
      setStatusMessage('Document uploaded, parsed, and analyzed successfully.')

      await loadAnalysisModules(articleId, analysisPayload)
      setActive('report')
    } catch (error) {
      setUploadError(error.message || 'The upload or analysis request failed.')
      setStatusMessage(documentCreated ? 'Document uploaded, but analysis failed.' : 'Upload failed — please retry.')
      if (documentCreated) await refreshManuscripts()
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const selectedJournal = useMemo(
    () => journalList.find((item) => item.journal_id === selectedJournalId) || journalList[0] || { journal_name: 'No journal selected', journal_id: '' },
    [journalList, selectedJournalId],
  )

  const currentTitle = navigation.find((item) => item.id === active)?.label
    || ({ manuscripts: 'All manuscripts', settings: 'Settings' }[active] || 'Dashboard')
  const userInitials = (user.name || user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  return (
    <div className="app-shell">
      <aside id="sidebar-navigation" className={showMobileMenu ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <div>
            <strong>PaperPilot</strong>
            <small>Manuscript preparation</small>
          </div>
        </div>

        <div className="account-identity">
          <div className="avatar">{userInitials}</div>
          <div>
            <span>{user.name}</span>
            <small>{user.email}</small>
          </div>
        </div>

        <p className="nav-label">MANUSCRIPT TOOLS</p>
        <nav>
          {NAV.map(({ label, icon: Icon, id }) => (
            <button
              type="button"
              key={id}
              className={active === id ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActive(id)
                setShowMobileMenu(false)
              }}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={active === 'manuscripts' ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setActive('manuscripts')
              setShowMobileMenu(false)
            }}
          >
            <FolderOpen size={17} />
            <span>All manuscripts</span>
          </button>
          <button
            type="button"
            className={active === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setActive('settings')
              setShowMobileMenu(false)
            }}
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <div className="sidebar-footer">
            <div>
              <span>Analysis configuration</span>
              <small className="status-dot">{aiStatus.message}</small>
            </div>
          </div>
        </div>
      </aside>
      {showMobileMenu && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <button
            type="button"
            className="mobile-menu"
            aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
            aria-controls="sidebar-navigation"
            aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <PanelLeft size={18} />
          </button>
          <div className="breadcrumbs">
            <span>PaperPilot</span>
            <ChevronRight size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="top-actions">
            <ThemeToggle theme={theme} setTheme={setTheme} />
            <div className="top-avatar" title={user.email}>{userInitials}</div>
            <button type="button" className="signout-button" onClick={onSignOut} title="Sign out">
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="page-container">
          <ErrorBox message={errors['loading-doc']} />
          {busy['loading-doc'] && <LoadingRow label="Loading manuscript..." />}

          {active === 'dashboard' && (
            <Dashboard
              manuscripts={manuscripts}
              dashboardSummary={dashboardSummary}
              isLoadingManuscripts={isLoadingManuscripts}
              manuscriptError={manuscriptError}
              setActive={setActive}
              onOpenManuscript={openManuscript}
              onUpload={handleFileUpload}
              statusMessage={statusMessage}
              uploadError={uploadError}
            />
          )}

          {active === 'manuscripts' && (
            <ManuscriptsPage
              manuscripts={manuscripts}
              isLoading={isLoadingManuscripts}
              error={manuscriptError}
              onRefresh={refreshManuscripts}
              onOpen={openManuscript}
              onUpload={() => setActive('upload')}
            />
          )}
          {active === 'settings' && (
            <SettingsPage
              theme={theme}
              setTheme={setTheme}
              selectedJournalId={selectedJournalId}
              setSelectedJournalId={setSelectedJournalId}
              journalList={journalList}
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

          {active === 'analysis' && <AnalysisPage document={document} setActive={setActive} citationReport={citationReport} report={report} />}
          {active === 'citations' && <CitationPage citationReport={citationReport} document={document} setActive={setActive} />}
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
          {active === 'quality' && <QualityPage qualityAnalysis={qualityAnalysis} completenessAnalysis={completenessAnalysis} setActive={setActive} />}
          {active === 'novelty' && <NoveltyPage noveltyAnalysis={noveltyAnalysis} setActive={setActive} />}
          {active === 'methodology' && <MethodologyPage methodologyAnalysis={methodologyAnalysis} setActive={setActive} />}
          {active === 'contribution' && <ContributionPage contributionAnalysis={contributionAnalysis} setActive={setActive} />}
          {active === 'writing' && <WritingPage writingAnalysis={writingAnalysis} setActive={setActive} />}
          {active === 'improvements' && <ImprovementsPage improvements={improvements} setActive={setActive} />}
          {active === 'report' && <ReportPage report={report} setActive={setActive} />}
          {active === 'formatting' && <FormattingPage document={document} selectedJournalId={selectedJournalId} selectedJournal={selectedJournal} setActive={setActive} />}
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

function ManuscriptsPage({ manuscripts, isLoading, error, onRefresh, onOpen, onUpload }) {
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const filteredManuscripts = manuscripts.filter((manuscript) => (
    `${manuscript.title} ${manuscript.filename} ${manuscript.document_id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  ))

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">YOUR LIBRARY</p>
          <h1>All manuscripts<span className="period">.</span></h1>
          <p className="subtitle">Browse uploaded manuscripts and open their analysis.</p>
        </div>
        <div className="button-row">
          <button type="button" className="outline-button" onClick={onRefresh} disabled={isLoading}>Refresh</button>
          <button type="button" className="primary-button" onClick={onUpload}>Upload manuscript <Plus size={16} /></button>
        </div>
      </section>
      <label className="manuscript-search">
        <span>Search manuscripts</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, filename, or ID"
        />
      </label>
      <ManuscriptList
        manuscripts={filteredManuscripts.slice(0, visibleCount)}
        isLoading={isLoading}
        error={error}
        onOpen={onOpen}
        emptyMessage={search ? 'No manuscripts match your search.' : 'No manuscripts yet. Upload a DOCX to start your library.'}
      />
      {!isLoading && !error && filteredManuscripts.length > visibleCount && (
        <button type="button" className="outline-button load-more" onClick={() => setVisibleCount(visibleCount + 25)}>
          Show more ({filteredManuscripts.length - visibleCount} remaining)
        </button>
      )}
    </>
  )
}

function ManuscriptList({ manuscripts, isLoading, error, onOpen, emptyMessage = 'No manuscripts yet. Upload a DOCX to start your library.' }) {
  if (isLoading) return <div className="status-box">Loading manuscripts...</div>
  if (error) return <div className="status-box error-box" role="alert">{error}</div>
  if (manuscripts.length === 0) {
    return <div className="status-box">{emptyMessage}</div>
  }

  return (
    <div className="manuscript-list">
      {manuscripts.map((manuscript) => (
        <button
          type="button"
          className="manuscript-row"
          key={manuscript.document_id}
          onClick={() => onOpen(manuscript.document_id)}
        >
          <div className="doc-type"><FileText size={18} /></div>
          <div className="doc-name">
            <strong>{manuscript.title || manuscript.filename}</strong>
            <span>{manuscript.document_id} · {manuscript.filename}</span>
          </div>
          <span className={`status ${manuscript.status === 'analyzed' ? 'green' : 'blue'}`}>
            {manuscript.status}
          </span>
          <ChevronRight size={17} className="row-arrow" />
        </button>
      ))}
    </div>
  )
}

function SettingsPage({ theme, setTheme, selectedJournalId, setSelectedJournalId, journalList }) {
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">PREFERENCES</p>
          <h1>Settings<span className="period">.</span></h1>
          <p className="subtitle">Choose how PaperPilot looks and which journal to use by default.</p>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-field">
          <div>
            <strong>Appearance</strong>
            <span>Choose a light or dark color theme.</span>
          </div>
          <select aria-label="Appearance theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="settings-field">
          <div>
            <strong>Default journal</strong>
            <span>Used when analyzing newly uploaded manuscripts.</span>
          </div>
          <select
            aria-label="Default journal"
            value={selectedJournalId}
            onChange={(event) => setSelectedJournalId(event.target.value)}
          >
            {journalList.length === 0 && <option value={selectedJournalId}>Nature</option>}
            {journalList.map((journal) => (
              <option key={journal.journal_id} value={journal.journal_id}>{journal.journal_name}</option>
            ))}
          </select>
        </div>
        <p className="settings-note">Your preferences are saved in this browser.</p>
      </section>
    </>
  )
}

function Dashboard({ manuscripts, dashboardSummary, isLoadingManuscripts, manuscriptError, setActive, onOpenManuscript, onUpload, statusMessage, uploadError }) {
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">WORKSPACE OVERVIEW</p>
          <h1>Research readiness dashboard<span className="period">.</span></h1>
          <p className="subtitle">Track manuscript status, AI quality checks, and publication readiness from one place.</p>
        </div>
        <label className="primary-button upload-trigger">
          <Plus size={17} />
          Upload manuscript
          <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={onUpload} />
        </label>
      </section>

      <section className="upload-banner" role={uploadError ? 'alert' : 'status'} aria-live="polite">
        <div className="upload-icon"><UploadCloud size={23} /></div>
        <div>
          <strong>{statusMessage}</strong>
          <span>{uploadError || 'Upload a DOCX or text-based PDF and the system will structure the manuscript, check citations, and run the research quality evaluation.'}</span>
        </div>
      </section>

      <section className="stats-grid">
        <Stat label="Manuscripts" value={dashboardSummary?.manuscript_count ?? '—'} detail="stored documents" icon={FileText} />
        <Stat label="Readiness" value={dashboardSummary?.readiness_average ?? '—'} suffix={dashboardSummary?.readiness_average == null ? '' : '/100'} detail={dashboardSummary?.analyzed_count ? `average across ${dashboardSummary.analyzed_count} analyzed` : 'No analyzed manuscripts'} icon={Gauge} green />
        <Stat
          label="Recommendations"
          value={dashboardSummary?.open_suggestions ?? '—'}
          detail={dashboardSummary
            ? `${dashboardSummary.high_priority_suggestions} critical or high priority`
            : isLoadingManuscripts ? 'Loading summary...' : 'Summary unavailable'}
          icon={Sparkles}
        />
      </section>

      <section className="section-heading">
        <div>
          <p className="kicker">MANUSCRIPT LIBRARY</p>
          <h2>Manuscripts</h2>
        </div>
        <button type="button" className="text-button" onClick={() => setActive('manuscripts')}>View all <ArrowUpRight size={15} /></button>
      </section>

      <ManuscriptList
        manuscripts={manuscripts.slice(0, 5)}
        isLoading={isLoadingManuscripts}
        error={manuscriptError}
        onOpen={onOpenManuscript}
      />

      <section className="section-heading modules-heading">
        <div>
          <p className="kicker">INTELLIGENCE LAYERS</p>
          <h2>Review modules</h2>
        </div>
        <span className="muted-label">Select a module to explore</span>
      </section>

      <div className="module-grid">
        <ModuleCard title="Research quality" eyebrow="01 / Completeness" text="Core sections detected across analyzed manuscripts." value={dashboardSummary?.dimension_averages?.research_completeness ?? '—'} unit="/100" tone="lavender" icon={BarChart3} onClick={() => setActive('quality')} />
        <ModuleCard title="Novelty framing" eyebrow="02 / Internal analysis" text="Measures clarity of novelty claims; no external similarity search is configured." value={dashboardSummary?.dimension_averages?.novelty_framing ?? '—'} unit="/100" tone="mint" icon={Sparkles} onClick={() => setActive('novelty')} />
        <ModuleCard title="Methodology" eyebrow="03 / Reproducibility" text="Dataset, setup, metrics, baselines, and reproducibility evidence." value={dashboardSummary?.dimension_averages?.methodology ?? '—'} unit="/100" tone="peach" icon={ClipboardCheck} onClick={() => setActive('methodology')} />
      </div>
    </>
  )
}

function UploadPage({ onUpload, isUploading, statusMessage, uploadError }) {
  return (
    <section className="panel upload-panel">
      <p className="kicker">UPLOAD</p>
      <h1>Upload manuscript</h1>
      <p className="subtitle">DOCX and text-based PDF are supported. Scanned PDFs require OCR, which is not enabled.</p>
      <label className="dropzone">
        <UploadCloud size={32} />
        <span>Select a DOCX or text-based PDF manuscript</span>
        <strong>Choose a file</strong>
        <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onUpload} />
      </label>
      <div className="status-box">
        <strong>{isUploading ? 'Processing...' : 'Status'}</strong>
        <p>{uploadError || statusMessage}</p>
      </div>
    </section>
  )
}

function AnalysisPage({ document, setActive, citationReport, report }) {
  if (!document?.document_id) return <AnalysisRequired setActive={setActive} />

  const counts = {
    sections: document.sections?.length || 0,
    figures: document.figures?.length || 0,
    tables: document.tables?.length || 0,
    equations: document.equations?.length || 0,
    citations: document.citations?.length || 0,
    references: document.references?.length || 0,
  }

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">DOCUMENT INTELLIGENCE</p>
          <h1>Document analysis<span className="period">.</span></h1>
          <p className="subtitle">Extracted manuscript structure and metadata.</p>
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

      <section className="analysis-hero">
        <div className="analysis-score">
          {report?.document_id === document.document_id && typeof report.overall_readiness === 'number' && (
            <span className="score-ring">{report.overall_readiness}<small>/100</small></span>
          )}
          <div>
            <span className="eyebrow">{document.document_id}</span>
            <h2>{document.title}</h2>
            <p>{document.abstract || 'The manuscript abstract is available after upload and analysis.'}</p>
          </div>
        </div>
        <div className="analysis-meta">
          <div><span>Authors</span><strong>{(document.authors || []).join(', ') || 'Not detected'}</strong></div>
          <div><span>Keywords</span><strong>{(document.keywords || []).join(', ') || 'Not detected'}</strong></div>
          <div><span>Citation report</span><strong>{citationReport.total_citations} citations / {citationReport.total_references} references</strong></div>
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

function CitationPage({ citationReport, document, setActive }) {
  if (!document?.document_id) return <AnalysisRequired setActive={setActive} />
  const allIssues = citationIssueCategories.flatMap((key) => (
    (citationReport[key] || []).map((issue, index) => ({ key, issue, index }))
  ))
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
          <div className="panel-heading">
            <div><p className="kicker">ISSUES</p><h2>Reference problems</h2></div>
          </div>
          <div className="finding-list">
            {allIssues.length === 0 ? (
              <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>No major citation issues detected</strong><span>Reference integrity looks consistent in the current draft.</span></div></div>
            ) : (
              allIssues.map(({ key, issue, index }) => (
                <div className="finding" key={`${key}-${index}`}>
                  <span className="finding-mark warning">!</span>
                  <div>
                    <strong>{issue.citation || issue.type?.replaceAll('_', ' ') || key.replaceAll('_', ' ')}</strong>
                    <span>{issue.message} {issue.suggestion}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div><p className="kicker">BIBLIOGRAPHY</p><h2>Detected references</h2></div>
          </div>
          <div className="finding-list">
            {(document.references || []).length === 0 ? (
              <div className="finding"><span className="finding-mark neutral">•</span><div><strong>No references detected</strong><span>Upload and analyze a manuscript to populate this list.</span></div></div>
            ) : (
              (document.references || []).slice(0, 8).map((ref) => (
                <div className="finding" key={ref.id || ref.raw_text}>
                  <span className="finding-mark good"><Check size={14} /></span>
                  <div><strong>[{ref.id}]</strong><span>{ref.raw_text}</span></div>
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

function JournalPage({ document, selectedJournalId, setSelectedJournalId, journalList, journalMatch, setJournalMatch, setActive }) {
  const [matchError, setMatchError] = useState('')
  const handleSelect = async (event) => {
    const nextJournal = event.target.value
    setSelectedJournalId(nextJournal)
    if (!document?.document_id) {
      setJournalMatch({})
      return
    }
    try {
      const match = await researchApi.matchJournal({
        document_id: document.document_id,
        analysis: document,
        journal_id: nextJournal,
      })
      setJournalMatch(match)
      setMatchError('')
    } catch (error) {
      setMatchError(error.message || 'Journal matching could not be completed.')
    }
  }
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">SCOPE SUITABILITY</p>
          <h1>Journal fit analysis<span className="period">.</span></h1>
          <p className="subtitle">Assess manuscript topic alignment against the selected profile's configured scope.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('quality')}>Review quality <ArrowUpRight size={16} /></button>
      </section>

      <section className="panel">
        <p className="kicker">SELECTED JOURNAL</p>
        <div className="journal-select-row">
          <label className="visually-hidden" htmlFor="journal-select">Select journal</label>
          <select id="journal-select" value={selectedJournalId} onChange={(event) => onSelect(event.target.value)} disabled={busy}>
            {journalList.map((journal) => (
              <option key={journal.journal_id} value={journal.journal_id}>{journal.journal_name}</option>
            ))}
          </select>
          <div className="score-badge">{journalMatch.score == null ? 'Not evaluated' : `${Math.round(journalMatch.score * 100)}% match`}</div>
        </div>
        {matchError && <div className="status-box error-box" role="alert">{matchError}</div>}
        <div className="finding-list">
          <div className="finding">
            <span className="finding-mark good"><Check size={14} /></span>
            <div><strong>Relevant topics</strong><span>{(journalMatch.relevant_topics || []).join(', ') || 'Run a match after opening a manuscript.'}</span></div>
          </div>
          <div className="finding">
            <span className="finding-mark warning">!</span>
            <div><strong>Scope gaps</strong><span>{(journalMatch.scope_gaps || []).join(' ') || (journalMatch.score == null ? 'Not evaluated.' : 'No scope gaps were detected by the configured term matcher.')}</span></div>
          </div>
          <div className="finding">
            <span className="finding-mark neutral">•</span>
            <div><strong>Explanation</strong><span>{journalMatch.explanation || 'Open an analyzed manuscript to calculate topic alignment.'}</span></div>
          </div>
        </div>
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

function AnalysisRequired({ setActive }) {
  return (
    <section className="status-box">
      <strong>No manuscript analysis loaded.</strong>
      <p>Upload a DOCX or text-based PDF, or open a saved manuscript to view analysis results.</p>
      <button type="button" className="outline-button" onClick={() => setActive('upload')}>Upload manuscript</button>
    </section>
  )
}

function QualityPage({ qualityAnalysis, completenessAnalysis, setActive }) {
  if (!qualityAnalysis?.document_id) return <AnalysisRequired setActive={setActive} />
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
        {completenessAnalysis?.document_id && (
          <section className="panel">
            <div className="panel-heading"><div><p className="kicker">SELECTED JOURNAL PROFILE</p><h2>Research completeness</h2></div><span className="score-badge">{completenessAnalysis.score}/100</span></div>
            <p className="supporting-text">{completenessAnalysis.analysis_scope}</p>
            <div className="finding-list">
              <div className="finding">
                <span className={`finding-mark ${completenessAnalysis.word_limit_exceeded ? 'warning' : 'good'}`}>
                  {completenessAnalysis.word_limit_exceeded ? '!' : <Check size={14} />}
                </span>
                <div>
                  <strong>Manuscript length</strong>
                  <span>
                    {completenessAnalysis.word_limit
                      ? `${completenessAnalysis.word_count} / ${completenessAnalysis.word_limit} words`
                      : `${completenessAnalysis.word_count} words; no profile limit configured`}
                  </span>
                </div>
              </div>
              {completenessAnalysis.abstract_word_limit && (
                <div className="finding">
                  <span className={`finding-mark ${completenessAnalysis.abstract_limit_exceeded ? 'warning' : 'good'}`}>
                    {completenessAnalysis.abstract_limit_exceeded ? '!' : <Check size={14} />}
                  </span>
                  <div>
                    <strong>Abstract length</strong>
                    <span>{completenessAnalysis.abstract_word_count} / {completenessAnalysis.abstract_word_limit} words</span>
                  </div>
                </div>
              )}
              {completenessAnalysis.page_limit && (
                <div className="finding">
                  <span className="finding-mark neutral">•</span>
                  <div><strong>Page limit</strong><span>Configured limit: {completenessAnalysis.page_limit} pages; page count is not assessed from the parsed DOCX.</span></div>
                </div>
              )}
              {(completenessAnalysis.missing_required || []).map((section) => (
                <div className="finding" key={`required-${section}`}>
                  <span className="finding-mark warning">!</span>
                  <div><strong>Missing required section</strong><span>{section.replaceAll('_', ' ')}</span></div>
                </div>
              ))}
              {(completenessAnalysis.missing_figure_captions || []).map((figure) => (
                <div className="finding" key={`figure-${figure}`}>
                  <span className="finding-mark warning">!</span>
                  <div><strong>Missing figure caption</strong><span>{figure}</span></div>
                </div>
              ))}
              {(completenessAnalysis.missing_table_captions || []).map((table) => (
                <div className="finding" key={`table-${table}`}>
                  <span className="finding-mark warning">!</span>
                  <div><strong>Missing table caption</strong><span>{table}</span></div>
                </div>
              ))}
              {(completenessAnalysis.unnumbered_equations || []).map((equation) => (
                <div className="finding" key={`equation-${equation}`}>
                  <span className="finding-mark warning">!</span>
                  <div><strong>Equation numbering needs review</strong><span>{equation}</span></div>
                </div>
              ))}
              {!(completenessAnalysis.missing_required || []).length
                && !(completenessAnalysis.missing_figure_captions || []).length
                && !(completenessAnalysis.missing_table_captions || []).length
                && !(completenessAnalysis.unnumbered_equations || []).length
                && !completenessAnalysis.word_limit_exceeded
                && !completenessAnalysis.abstract_limit_exceeded
                && <div className="finding"><span className="finding-mark good"><Check size={14} /></span><div><strong>No configured completeness gaps detected</strong><span>Optional sections are not treated as required.</span></div></div>}
            </div>
          </section>
        )}
      </div>
    </AssessmentShell>
  )
}

function NoveltyPage({ noveltyAnalysis, setActive }) {
  if (!noveltyAnalysis?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">INTERNAL CLAIM ANALYSIS</p>
          <h1>Novelty analysis<span className="period">.</span></h1>
          <p className="subtitle">Novelty score: {noveltyAnalysis.novelty_score}/100. External scholarly search is not configured; this is not a plagiarism or global originality check.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('methodology')}>Review methodology <ArrowUpRight size={16} /></button>
      </section>
      <div className="detail-grid two-col">
        <section className="panel">
          <div className="panel-heading"><div><p className="kicker">ORIGINALITY STATUS</p><h2>External comparison</h2></div></div>
          <p className="supporting-text">{noveltyAnalysis.analysis_scope}</p>
          <p className="supporting-text">Originality score: {noveltyAnalysis.originality_score ?? 'Not configured'}</p>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="kicker">RECOMMENDATION</p><h2>What to improve</h2></div></div>
          <p className="supporting-text">{noveltyAnalysis.explanation}</p>
          <ul className="mini-list">
            {(noveltyAnalysis.improvement_suggestions || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="supporting-text">Similarity is evidence for review, not a verdict. No plagiarism detection or originality certification is provided.</p>
        </section>
      </div>
    </AssessmentShell>
  )
}

function MethodologyPage({ methodologyAnalysis, setActive }) {
  if (!methodologyAnalysis?.document_id) return <AnalysisRequired setActive={setActive} />
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

function ContributionPage({ contributionAnalysis, setActive }) {
  if (!contributionAnalysis?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">TECHNICAL EVIDENCE</p>
          <h1>Contribution analysis<span className="period">.</span></h1>
          <p className="subtitle">Evidence-presence assessment, not a determination of scientific importance.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('methodology')}>Review methodology <ArrowUpRight size={16} /></button>
      </section>
      <section className="analysis-hero">
        <div className="analysis-score">
          <div className="score-ring">{contributionAnalysis.technical_contribution_score}<small>/100</small></div>
          <div><p className="kicker">TECHNICAL CONTRIBUTION SCORE</p><p>{contributionAnalysis.analysis_scope}</p></div>
        </div>
      </section>
      <div className="detail-grid two-col">
        <section className="panel"><h2>Evidence detected</h2><ul className="mini-list">{(contributionAnalysis.strengths || []).map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className="panel"><h2>Missing evidence</h2><ul className="mini-list">{(contributionAnalysis.recommendations || []).map((item) => <li key={item}>{item}</li>)}</ul></section>
      </div>
    </>
  )
}

function WritingPage({ writingAnalysis, setActive }) {
  if (!writingAnalysis?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">ACADEMIC WRITING</p>
          <h1>Writing quality<span className="period">.</span></h1>
          <p className="subtitle">Rule-based checks only. Grammar and spelling proofing are not configured.</p>
        </div>
      </section>
      <section className="stats-grid compact-grid">
        <Stat label="Writing signals" value={writingAnalysis.score ?? '—'} suffix="/100" detail="heuristic indicators" icon={FileText} />
        <Stat label="Flagged sentences" value={writingAnalysis.sentence_findings?.length ?? 0} detail="review individually" icon={Sparkles} />
        <Stat label="Other issues" value={writingAnalysis.issues?.length ?? 0} detail="rule-based checks" icon={ClipboardCheck} />
      </section>
      {(writingAnalysis.sentence_findings || []).length === 0 ? (
        <div className="status-box">No sentence-level issues were detected by the configured checks. This is not a grammar or spelling verification.</div>
      ) : (
        <div className="improvement-list">
          {writingAnalysis.sentence_findings.map((finding, index) => (
            <section className="panel improvement-card" key={`${finding.original}-${index}`}>
              <div className="comparison-grid">
                <div><label>Original sentence</label><p>{finding.original}</p></div>
                <div><label>Suggested improvement</label><p>{finding.suggested_improvement}</p></div>
              </div>
              <div className="finding-list">
                <div className="finding"><div><strong>Problem</strong><span>{finding.problem}</span></div></div>
                <div className="finding"><div><strong>Reason</strong><span>{finding.reason}</span></div></div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function FormattingPage({ document, selectedJournalId, selectedJournal, setActive }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const checkFormatting = async () => {
    if (!document?.document_id) return
    setError('')
    setIsChecking(true)
    try {
      setResult(await researchApi.formatDocument(document.document_id, { journal_id: selectedJournalId }))
    } catch (requestError) {
      setError(requestError.message || 'Formatting check failed.')
    } finally {
      setIsChecking(false)
    }
  }

  if (!document?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">JOURNAL RULE CHECK</p>
          <h1>Formatting review<span className="period">.</span></h1>
          <p className="subtitle">{selectedJournal?.journal_name || 'Selected profile'} · {selectedJournal?.profile_basis || 'Generic profile; verify publisher instructions.'}</p>
        </div>
        <button type="button" className="primary-button" onClick={checkFormatting} disabled={isChecking}>{isChecking ? 'Checking...' : 'Check formatting rules'}</button>
      </section>
      {error && <div className="status-box error-box" role="alert">{error}</div>}
      {result && (
        <div className="detail-grid two-col">
          <section className="panel"><h2>Applied rule values</h2><pre className="rules-output">{JSON.stringify(result.applied_rules, null, 2)}</pre></section>
          <section className="panel"><h2>Warnings</h2>{result.warnings?.length ? <ul className="mini-list">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="supporting-text">No formatter warnings were reported.</p>}</section>
        </div>
      )}
      {!result && !error && <div className="status-box">Run the profile check to see the rules currently recognized by the formatter.</div>}
    </>
  )
}

function ImprovementsPage({ improvements, setActive }) {
  if (!improvements?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">RESEARCHER CONTROL</p>
          <h1>AI improvement suggestions<span className="period">.</span></h1>
          <p className="subtitle">Suggestions are advisory and do not modify the uploaded manuscript.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('report')}>Open readiness report <ArrowUpRight size={16} /></button>
      </section>
      <div className="improvement-list">
        {(improvements.suggestions || []).map((item) => (
          <div key={item.id} className="panel improvement-card">
            <div className="improvement-header">
              <span>{item.section}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ReportPage({ report, setActive }) {
  if (!report?.document_id) return <AnalysisRequired setActive={setActive} />
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">PRE-SUBMISSION ASSESSMENT</p>
          <h1>{report.title}<span className="period">.</span></h1>
          <p className="subtitle">Overall readiness: {report.overall_readiness}/100. {report.summary}</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('export')}>Generate final manuscript <ArrowUpRight size={16} /></button>
      </section>
      <div className="detail-grid">
        <section className="panel report-panel">
          <div className="panel-heading"><div><p className="kicker">REPORT</p><h2>Assessment sections</h2></div></div>
          <div className="finding-list">
            {(report.sections || []).map((section) => (
              <div className="finding" key={section.name}>
                <span className="finding-mark good"><Check size={14} /></span>
                <div><strong>{section.name}</strong><span>{section.details}</span></div>
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

function ExportPage({ document, selectedJournal, selectedJournalId, setActive }) {
  const [exportStatus, setExportStatus] = useState('idle')
  const [exportMessage, setExportMessage] = useState('Format and generate the journal-aligned submission package.')
  const [exportError, setExportError] = useState('')
  const [exportWarnings, setExportWarnings] = useState([])

  const runExport = async () => {
    if (!document?.document_id) {
      setExportError('Upload and analyze a manuscript before exporting.')
      return
    }
    setExportError('')
    setExportStatus('working')
    setExportMessage('Applying journal template and building submission package...')
    try {
      const generated = await researchApi.generateDocument(document.document_id, { journal_id: selectedJournalId })
      setExportWarnings(generated.formatting_warnings || [])
      setExportStatus('ready')
      setExportMessage(`Submission package is ready. ${generated.pdf_rendering?.message || ''}`)
    } catch (error) {
      setExportState({ phase: 'error', message: 'Submission package generation failed. Review the error and retry.', error: error.message || 'Export failed.' })
    }
  }

  const downloadFile = async (format) => {
    try {
      const names = {
        pdf: 'final_manuscript.pdf',
        report: 'readiness_report.pdf',
        zip: 'submission_package.zip',
        docx: 'final_manuscript.docx',
      }
      const fileName = names[format] || `manuscript.${format}`
      const blob = await researchApi.download(document.document_id, format)
      const url = URL.createObjectURL(blob)
      const link = globalThis.document.createElement('a')
      link.href = url
      link.download = fileName
      link.rel = 'noopener'
      link.style.display = 'none'
      globalThis.document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        link.remove()
        URL.revokeObjectURL(url)
      }, 1500)
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
      <section className="page-intro">
        <div>
          <p className="kicker">FINAL MANUSCRIPT</p>
          <h1>Generate & export<span className="period">.</span></h1>
          <p className="subtitle">Create a journal-aligned manuscript package and download the final outputs.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setActive('dashboard')}>Back to overview <ArrowUpRight size={16} /></button>
      </section>
      <section className="panel export-panel">
        <div className="panel-heading"><div><p className="kicker">OUTPUT</p><h2>Publication package</h2></div></div>
        <div className={exportStatus === 'ready' ? 'status-box success-box' : 'status-box'}>
          <strong>{exportStatus === 'working' ? 'Generating...' : exportStatus === 'ready' ? 'Ready for export' : 'Generate outputs'}</strong>
          <p>{exportError || exportMessage}</p>
          <p>Manuscript: {document.title || 'Untitled'} · Journal: {selectedJournal?.journal_name || 'Not selected'}</p>
        </div>
        {exportWarnings.length > 0 && (
          <div className="status-box" role="status">
            <strong>Formatting warnings</strong>
            <ul className="mini-list">{exportWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        )}
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

function App() {
  const [user, setUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [authNotice, setAuthNotice] = useState('')

  useEffect(() => {
    if (!researchApi.hasStoredAuth()) {
      setIsCheckingSession(false)
      return undefined
    }
    researchApi.getCurrentUser()
      .then(setUser)
      .catch(() => {
        researchApi.clearAuth()
        setUser(null)
      })
      .finally(() => setIsCheckingSession(false))
    return undefined
  }, [])

  const signOut = async () => {
    let notice = ''
    try {
      await researchApi.signOut()
    } catch (error) {
      notice = `Signed out on this device, but server session revocation failed: ${error.message}`
    } finally {
      researchApi.clearAuth()
      setUser(null)
      setAuthNotice(notice)
    }
  }

  if (isCheckingSession) {
    return <main className="auth-loading" role="status">Checking your session…</main>
  }
  if (!user) {
    return <AuthScreen onAuthenticated={setUser} notice={authNotice} />
  }
  return <ResearchWorkspace user={user} onSignOut={signOut} />
}

export default App
