'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

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
}

interface DocResult {
  id: string
  title: string
  doc_type: string
  file_url: string
  notable_clauses: string[] | null
  source_name: string
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

function ResultsContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  let profile: Profile | null = null
  try {
    const p = searchParams.get('profile')
    if (p) profile = JSON.parse(p)
  } catch {}

  const [results, setResults] = useState<OrgResult[]>([])
  const [documents, setDocuments] = useState<DocResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('chatMessages')
      if (saved) setChatMessages(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    if (!query) {
      setLoading(false)
      return
    }
    fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else {
          setResults(data.results || [])
          setDocuments(data.documents || [])
        }
      })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false))
  }, [query])

  const orgTypes = profile?.org_types || []
  const issueAreas = profile?.issue_areas || []
  const primaryNeed = profile?.primary_need
  const stage = profile?.stage

  return (
    <div className="results-layout">
      <aside className="results-sidebar">
        <Link href="/" className="back-link">← Back to Search</Link>

        {profile && (
          <>
            <p className="sidebar-label">Your Profile</p>
            <div className="profile-card">
              {orgTypes.length > 0 && (
                <div className="profile-row">
                  <strong>Organization Type</strong>
                  <div className="tag-list">
                    {orgTypes.map(t => (
                      <span key={t} className="tag tag-green">
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {primaryNeed && (
                <div className="profile-row">
                  <strong>Primary Need</strong>
                  <div className="tag-list">
                    <span className="tag tag-red">
                      {primaryNeed.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              )}
              {issueAreas.length > 0 && (
                <div className="profile-row">
                  <strong>Issue Areas</strong>
                  <div className="tag-list">
                    {issueAreas.map(a => (
                      <span key={a} className="tag tag-green">{a}</span>
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

        <div className="refine-section">
          <p className="sidebar-label">Refine Search</p>
          <div className="refine-filters">
            <label className="filter-label">
              <input type="checkbox" defaultChecked /> Worker Co-ops
            </label>
            <label className="filter-label">
              <input type="checkbox" /> Nonprofits
            </label>
            <label className="filter-label">
              <input type="checkbox" /> Consumer Co-ops
            </label>
            <div className="filter-divider" />
            <label className="filter-label">
              <input type="checkbox" defaultChecked /> Missouri
            </label>
            <label className="filter-label">
              <input type="checkbox" defaultChecked /> Illinois
            </label>
          </div>
        </div>

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

      <main className="results-main">
        <div className="results-header">
          <h2 className="results-heading">Similar Organizations</h2>
          {!loading && !error && (
            <span className="results-count">{results.length} results</span>
          )}
        </div>

        {loading && (
          <div className="loading-state">Finding similar organizations…</div>
        )}

        {error && (
          <div className="error-state">{error}</div>
        )}

        {!loading && !error && (() => {
          // Min-max normalize scores so the spread is legible
          const scores = results.map(r => r.similarity)
          const minS = Math.min(...scores)
          const maxS = Math.max(...scores)
          const range = maxS - minS

          const normalize = (s: number) => {
            if (range < 0.001) return 95 // all identical — show 95%
            // Map to 65–100 range so even last place shows a reasonable score
            return Math.round(65 + ((s - minS) / range) * 35)
          }

          return (
            <>
              {results.map(org => (
                <Link key={org.id} href={`/orgs/${org.slug}`} className="result-card">
                  <div>
                    <div className="result-name">{org.name}</div>
                    {(org.mission || org.description) && (
                      <p className="result-mission">
                        {(org.mission || org.description || '').slice(0, 200)}
                        {(org.mission || org.description || '').length > 200 ? '…' : ''}
                      </p>
                    )}
                    <div className="result-meta">
                      {org.org_types?.map(t => (
                        <span key={t} className="tag tag-green">{t}</span>
                      ))}
                      {org.issue_areas?.map(a => (
                        <span key={a} className="tag tag-red">{a}</span>
                      ))}
                      {(org.city || org.state) && (
                        <span className="result-location">
                          {[org.city, org.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="match-badge">
                    <div className="match-pct">{normalize(org.similarity)}%</div>
                    <div className="match-lbl">Match</div>
                  </div>
                </Link>
              ))}

              {documents.length > 0 && (
                <div style={{ marginTop: 40 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display, serif)',
                    fontSize: '1.1rem',
                    marginBottom: 16,
                    paddingBottom: 12,
                    borderBottom: '1px solid var(--rule)',
                    color: 'var(--ink)',
                  }}>
                    Relevant Documents & Templates
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {documents.map(doc => (
                      <a
                        key={doc.id}
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '14px 18px',
                          border: '1px solid var(--rule)',
                          borderRadius: 4,
                          textDecoration: 'none',
                          background: 'white',
                          transition: 'border-color 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(165,20,23,0.3)'
                          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(28,26,23,0.06)'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--rule)'
                          ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
                        }}
                      >
                        <div>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: 'var(--ink)',
                            marginBottom: 3
                          }}>
                            {doc.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {doc.source_name} · {doc.doc_type.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.78rem',
                          color: 'var(--red)',
                          marginLeft: 16,
                          whiteSpace: 'nowrap',
                          fontWeight: 500,
                        }}>
                          View PDF →
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </main>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          Pro<span>social</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#">Browse</a></li>
          <li><a href="#">Resources</a></li>
          <li><a href="/about">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <Suspense fallback={<div className="loading-state">Loading…</div>}>
        <ResultsContent />
      </Suspense>
    </>
  )
}
