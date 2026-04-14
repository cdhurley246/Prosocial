'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'

// ── Types ──────────────────────────────────────────────────────────────────

interface OrgResult {
  id: string
  slug: string
  name: string
  mission: string | null
  description: string | null
  org_types: string[] | null
  issue_areas: string[] | null
  city: string | null
  state: string | null
  website: string | null
  ntee_code: string | null
  similarity: number
  is_demo: boolean
}

interface DocResult {
  id: string
  title: string
  doc_type: string
  file_url: string
  notable_clauses: string[] | null
  source_name: string
}

interface ResourceResult {
  id: string
  title: string
  url: string
  description: string | null
  resource_type: string | null
  relevant_org_types: string[] | null
  issue_areas: string[] | null
  is_local: boolean
}

interface Profile {
  org_name?: string | null
  org_types?: string[]
  issue_areas?: string[]
  primary_need?: string
  stage?: string
  search_query?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

type Tab = 'orgs' | 'docs' | 'resources'

// ── Midwest states for filter ───────────────────────────────────────────────

const MIDWEST_STATES = [
  { code: 'IL', label: 'Illinois' },
  { code: 'MO', label: 'Missouri' },
  { code: 'WI', label: 'Wisconsin' },
  { code: 'MN', label: 'Minnesota' },
  { code: 'OH', label: 'Ohio' },
  { code: 'MI', label: 'Michigan' },
  { code: 'IN', label: 'Indiana' },
  { code: 'IA', label: 'Iowa' },
]

// ── Sub-components ─────────────────────────────────────────────────────────

function OrgCard({ org, score }: { org: OrgResult; score: number }) {
  return (
    <Link href={`/orgs/${org.slug}`} className="result-card">
      <div>
        <div className="result-name">
          {org.name}
          {org.is_demo && (
            <span className="tag tag-demo" style={{ marginLeft: 8, verticalAlign: 'middle' }}>
              DEMO
            </span>
          )}
        </div>
        {(org.mission || org.description) && (
          <p className="result-mission">
            {(org.mission || org.description || '').slice(0, 200)}
            {(org.mission || org.description || '').length > 200 ? '…' : ''}
          </p>
        )}
        <div className="result-meta">
          {org.org_types?.map(t => (
            <span key={t} className="tag tag-green">{t.replace(/_/g, ' ')}</span>
          ))}
          {org.issue_areas?.slice(0, 3).map(a => (
            <span key={a} className="tag tag-red">{a.replace(/_/g, ' ')}</span>
          ))}
          {(org.city || org.state) && (
            <span className="result-location">
              {[org.city, org.state].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="match-badge">
        <div className="match-pct">{score}%</div>
        <div className="match-lbl">Match</div>
      </div>
    </Link>
  )
}

function DocCard({ doc }: { doc: DocResult }) {
  return (
    <a
      href={doc.file_url}
      target="_blank"
      rel="noopener noreferrer"
      className="resource-card"
    >
      <div className="resource-card-icon">📄</div>
      <div className="resource-card-body">
        <div className="resource-card-title">{doc.title}</div>
        <div className="resource-card-meta">
          <span className="tag tag-green">{doc.doc_type.replace(/_/g, ' ')}</span>
          <span className="resource-card-source">{doc.source_name}</span>
        </div>
        {doc.notable_clauses && doc.notable_clauses.length > 0 && (
          <ul className="resource-card-clauses">
            {doc.notable_clauses.slice(0, 2).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}
      </div>
      <span className="resource-card-cta">View PDF →</span>
    </a>
  )
}

function ResourceCard({ res }: { res: ResourceResult }) {
  return (
    <a
      href={res.url}
      target="_blank"
      rel="noopener noreferrer"
      className="resource-card"
    >
      <div className="resource-card-icon">🔗</div>
      <div className="resource-card-body">
        <div className="resource-card-title">{res.title}</div>
        <div className="resource-card-meta">
          {res.resource_type && (
            <span className="tag tag-warm">{res.resource_type.replace(/_/g, ' ')}</span>
          )}
          {res.is_local && (
            <span className="tag tag-green">Local</span>
          )}
        </div>
        {res.description && (
          <p className="resource-card-desc">
            {res.description.slice(0, 140)}{res.description.length > 140 ? '…' : ''}
          </p>
        )}
      </div>
      <span className="resource-card-cta">Visit →</span>
    </a>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

function ResultsContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  let profile: Profile | null = null
  try {
    const p = searchParams.get('profile')
    if (p) profile = JSON.parse(p)
  } catch {}

  const [orgs, setOrgs]           = useState<OrgResult[]>([])
  const [documents, setDocuments] = useState<DocResult[]>([])
  const [resources, setResources] = useState<ResourceResult[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('orgs')
  const [hasChosen, setHasChosen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatOpen, setChatOpen]   = useState(false)
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set())

  function chooseTab(tab: Tab) {
    setActiveTab(tab)
    setHasChosen(true)
  }

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('chatMessages')
      if (saved) setChatMessages(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    if (!query) { setLoading(false); return }
    setLoading(true)
    setError('')
    const states = selectedStates.size > 0 ? Array.from(selectedStates) : undefined
    fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8, states, profile }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setOrgs(data.results || [])
          setDocuments(data.documents || [])
          setResources(data.resources || [])
        }
      })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false))
  }, [query, selectedStates])

  // Normalise similarity scores to 65–100 range
  const scores = orgs.map(r => r.similarity)
  const minS = Math.min(...scores)
  const maxS = Math.max(...scores)
  const range = maxS - minS
  const normalize = (s: number) =>
    range < 0.001 ? 95 : Math.round(65 + ((s - minS) / range) * 35)

  const orgTypes   = profile?.org_types   || []
  const issueAreas = profile?.issue_areas || []
  const primaryNeed = profile?.primary_need
  const stage = profile?.stage

  const tabCounts: Record<Tab, number> = {
    orgs:      orgs.length,
    docs:      documents.length,
    resources: resources.length,
  }

  const TAB_LABELS: Record<Tab, string> = {
    orgs:      'Organizations',
    docs:      'Templates & Documents',
    resources: 'Resources',
  }

  return (
    <div className="results-layout">

      {/* ── SIDEBAR ── */}
      <aside className="results-sidebar">
        <Link href="/home" className="back-link">← Back to Search</Link>

        {profile && (
          <>
            <p className="sidebar-label">Your Profile</p>
            <div className="profile-card">
              {orgTypes.length > 0 && (
                <div className="profile-row">
                  <strong>Organization Type</strong>
                  <div className="tag-list">
                    {orgTypes.map(t => (
                      <span key={t} className="tag tag-green">{t.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
              {primaryNeed && (
                <div className="profile-row">
                  <strong>Primary Need</strong>
                  <div className="tag-list">
                    <span className="tag tag-red">{primaryNeed.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              )}
              {issueAreas.length > 0 && (
                <div className="profile-row">
                  <strong>Issue Areas</strong>
                  <div className="tag-list">
                    {issueAreas.map(a => (
                      <span key={a} className="tag tag-green">{a.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                </div>
              )}
              {stage && (
                <div className="profile-row">
                  <strong>Stage</strong>
                  <div className="tag-list">
                    <span className="tag tag-warm">{stage}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* State filter — only relevant for orgs tab */}
        {activeTab === 'orgs' && (
          <div className="refine-section">
            <p className="sidebar-label">Filter by State</p>
            <div className="refine-filters">
              {MIDWEST_STATES.map(({ code, label }) => (
                <label key={code} className="filter-label">
                  <input
                    type="checkbox"
                    checked={selectedStates.has(code)}
                    onChange={e => {
                      setSelectedStates(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(code) : next.delete(code)
                        return next
                      })
                    }}
                  />
                  {' '}{label}
                </label>
              ))}
              {selectedStates.size > 0 && (
                <button
                  onClick={() => setSelectedStates(new Set())}
                  style={{
                    marginTop: 6, fontSize: '0.72rem', color: 'var(--red)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, textAlign: 'left',
                  }}
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chat history */}
        {chatMessages.length > 0 && (
          <div className="chat-history">
            <button
              className="chat-history-toggle"
              onClick={() => setChatOpen(o => !o)}
            >
              <span>Intake Conversation</span>
              <span className="chat-history-arrow">{chatOpen ? '▲' : '▼'}</span>
            </button>
            {chatOpen && (
              <div className="chat-history-body">
                {chatMessages.map((m, i) => (
                  <div key={i} className="chat-history-msg">
                    <span className={`chat-msg-label ${m.role === 'user' ? 'user' : 'ai'}`}>
                      {m.role === 'user' ? 'You' : 'Prosocial'}
                    </span>
                    <p className="chat-history-text">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── MAIN ── */}
      <main className="results-main">

        {/* Loading / error */}
        {loading && <div className="loading-state">Finding your matches…</div>}
        {error   && <div className="error-state">{error}</div>}

        {/* ── PICKER — shown before user chooses a category ── */}
        {!loading && !error && !hasChosen && (
          <div className="results-picker">
            <p className="results-picker-heading">Your results are ready. What would you like to see first?</p>
            <div className="results-picker-cards">

              <button className="picker-card" onClick={() => chooseTab('docs')}>
                <span className="picker-card-icon">📄</span>
                <span className="picker-card-title">Legal Document Templates & Examples</span>
                <span className="picker-card-count">{documents.length} matched</span>
                <span className="picker-card-desc">Bylaws, operating agreements, and legal guides relevant to your organization type.</span>
              </button>

              <button className="picker-card" onClick={() => chooseTab('orgs')}>
                <span className="picker-card-icon">🏛</span>
                <span className="picker-card-title">Organizations Similar to Yours</span>
                <span className="picker-card-count">{orgs.length} matched</span>
                <span className="picker-card-desc">Real organizations with similar missions, structures, and issue areas.</span>
              </button>

              <button className="picker-card" onClick={() => chooseTab('resources')}>
                <span className="picker-card-icon">🔗</span>
                <span className="picker-card-title">Other Resources</span>
                <span className="picker-card-count">{resources.length} matched</span>
                <span className="picker-card-desc">Guides, tools, and external organizations that can help you get started.</span>
              </button>

            </div>
          </div>
        )}

        {/* ── TAB BAR — shown after user picks ── */}
        {!loading && !error && hasChosen && (
          <>
            <div className="results-tabs">
              {(['docs', 'orgs', 'resources'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  className={`results-tab${activeTab === tab ? ' results-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {TAB_LABELS[tab]}
                  {tabCounts[tab] > 0 && (
                    <span className="results-tab-count">{tabCounts[tab]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Organizations tab */}
            {activeTab === 'orgs' && (
              <>
                <div className="results-header">
                  <h2 className="results-heading">Similar Organizations</h2>
                  <span className="results-count">{orgs.length} results</span>
                </div>
                {orgs.length === 0 ? (
                  <p className="results-empty">No organizations matched — try clearing the state filter.</p>
                ) : (
                  orgs.map(org => (
                    <OrgCard key={org.id} org={org} score={normalize(org.similarity)} />
                  ))
                )}
              </>
            )}

            {/* Templates & Documents tab */}
            {activeTab === 'docs' && (
              <>
                <div className="results-header">
                  <h2 className="results-heading">Templates & Documents</h2>
                  <span className="results-count">{documents.length} results</span>
                </div>
                {documents.length === 0 ? (
                  <p className="results-empty">No matching documents found.</p>
                ) : (
                  <div className="resource-card-list">
                    {documents.map(doc => (
                      <DocCard key={doc.id} doc={doc} />
                    ))}
                  </div>
                )}
                <p className="results-browse-link">
                  Browse all templates → <Link href="/legal-docs">Legal Documents Library</Link>
                </p>
              </>
            )}

            {/* Resources tab */}
            {activeTab === 'resources' && (
              <>
                <div className="results-header">
                  <h2 className="results-heading">Helpful Resources</h2>
                  <span className="results-count">{resources.length} results</span>
                </div>
                {resources.length === 0 ? (
                  <p className="results-empty">No resources matched your profile.</p>
                ) : (
                  <div className="resource-card-list">
                    {resources.map(res => (
                      <ResourceCard key={res.id} res={res} />
                    ))}
                  </div>
                )}
                <p className="results-browse-link">
                  Browse all resources → <Link href="/resources">Resource Center</Link>
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <>
      <Nav />
      <Suspense fallback={<div className="loading-state">Loading…</div>}>
        <ResultsContent />
      </Suspense>
    </>
  )
}
