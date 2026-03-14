export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { neon } from '@neondatabase/serverless'

interface Org {
  id: string
  slug: string
  name: string
  mission: string | null
  org_types: string[] | null
  issue_areas: string[] | null
  city: string | null
  state: string | null
}

export default async function BrowsePage() {
  const sql = neon(process.env.DATABASE_URL!)

  const orgs = await sql`
    SELECT id, slug, name, mission, org_types, issue_areas, city, state
    FROM orgs
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  ` as Org[]

  // Group by first letter for alphabetical index
  const letters = [...new Set(orgs.map(o => o.name[0].toUpperCase()))].sort()

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          Pro<span>social</span>
        </Link>
        <ul className="nav-links">
          <li><a href="/resources">Resources</a></li>
          <li><a href="/browse" style={{ color: 'var(--ink)' }}>Browse</a></li>
          <li><a href="/about">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <div className="browse-layout">
        <aside className="browse-sidebar">
          <p className="sidebar-label">Jump to</p>
          <div className="browse-alpha">
            {letters.map(l => (
              <a key={l} href={`#letter-${l}`} className="browse-alpha-link">{l}</a>
            ))}
          </div>

          <div style={{ marginTop: '2rem' }}>
            <p className="sidebar-label">Total</p>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.25rem' }}>
              {orgs.length}
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Organizations
            </p>
          </div>

          <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--rule)' }}>
            <p className="sidebar-label">Find your match</p>
            <Link href="/matching" className="browse-match-cta">
              AI-powered matching →
            </Link>
          </div>
        </aside>

        <main className="browse-main">
          <div className="browse-header">
            <h1 className="browse-title">All Organizations</h1>
            <span className="results-count">{orgs.length} orgs</span>
          </div>

          {letters.map(letter => {
            const group = orgs.filter(o => o.name[0].toUpperCase() === letter)
            return (
              <div key={letter} id={`letter-${letter}`} className="browse-group">
                <div className="browse-group-label">{letter}</div>
                {group.map(org => (
                  <Link key={org.id} href={`/orgs/${org.slug}`} className="browse-card">
                    <div className="browse-card-body">
                      <div className="result-name">{org.name}</div>
                      {org.mission && (
                        <p className="result-mission">
                          {org.mission.slice(0, 160)}{org.mission.length > 160 ? '…' : ''}
                        </p>
                      )}
                      <div className="result-meta">
                        {org.org_types?.map(t => (
                          <span key={t} className="tag tag-green">{t.replace(/_/g, ' ')}</span>
                        ))}
                        {org.issue_areas?.slice(0, 3).map(a => (
                          <span key={a} className="tag tag-red">{a}</span>
                        ))}
                        {(org.city || org.state) && (
                          <span className="result-location">
                            {[org.city, org.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="browse-card-arrow">→</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </main>
      </div>
    </>
  )
}
