import { neon } from '@neondatabase/serverless'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { notFound } from 'next/navigation'

interface Document {
  id: string
  doc_type: string | null
  title: string | null
  text_content: string | null
  file_url: string | null
  is_public: boolean
  notable_clauses: string[] | null
}

// NTEE major group descriptions
const NTEE_GROUPS: Record<string, string> = {
  A: 'Arts, Culture & Humanities',
  B: 'Education',
  C: 'Environmental Quality & Protection',
  D: 'Animal Related',
  E: 'Health Care',
  F: 'Mental Health & Crisis Intervention',
  G: 'Diseases, Disorders & Medical Research',
  H: 'Medical Research',
  I: 'Crime & Legal Services',
  J: 'Employment',
  K: 'Food, Agriculture & Nutrition',
  L: 'Housing & Shelter',
  M: 'Public Safety & Disaster Relief',
  N: 'Recreation & Sports',
  O: 'Youth Development',
  P: 'Human Services',
  Q: 'International & Foreign Affairs',
  R: 'Civil Rights, Social Action & Advocacy',
  S: 'Community Improvement & Capacity Building',
  T: 'Philanthropy & Voluntarism',
  U: 'Science & Technology',
  V: 'Social Science',
  W: 'Public & Societal Benefit',
  X: 'Religion Related',
  Y: 'Mutual & Membership Benefit',
  Z: 'Unknown',
}

function nteeDescription(code: string | null): string | null {
  if (!code) return null
  const major = code[0]?.toUpperCase()
  return NTEE_GROUPS[major] ?? null
}

interface CrawlEnrichment {
  mission_summary?: string | null
  services_offered?: string[] | null
  population_served?: string[] | null
  geographic_focus?: string | null
  org_type_indicators?: string[] | null
  additional_notes?: string | null
  // crawl-poc schema fields
  mission?: string | null
  sector?: string | null
  services?: string[] | null
}

interface Org {
  id: string
  slug: string
  name: string
  external_id: string | null
  org_types: string[] | null
  ntee_code: string | null
  issue_areas: string[] | null
  legal_structure: string | null
  governance_model: string | null
  mission: string | null
  description: string | null
  founding_year: number | null
  size_staff: number | null
  size_members: number | null
  budget_range: string | null
  city: string | null
  state: string | null
  county: string | null
  website: string | null
  email: string | null
  phone: string | null
  source: string | null
  verified: boolean
  documents: Document[]
  enrichment: CrawlEnrichment | null
}

async function getOrg(slug: string): Promise<Org | null> {
  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`
    SELECT
      o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id',              d.id,
            'doc_type',        d.doc_type,
            'title',           d.title,
            'text_content',    d.text_content,
            'file_url',        d.file_url,
            'is_public',       d.is_public,
            'notable_clauses', d.notable_clauses
          )
        ) FILTER (WHERE d.id IS NOT NULL AND d.deleted_at IS NULL AND d.is_public = true),
        '[]'
      ) AS documents,
      (
        SELECT ce.extracted_fields
        FROM crawl_enrichments ce
        WHERE ce.org_id = o.id
        ORDER BY ce.crawled_at DESC
        LIMIT 1
      ) AS enrichment
    FROM orgs o
    LEFT JOIN documents d ON d.org_id = o.id
    WHERE o.slug = ${slug}
      AND o.deleted_at IS NULL
    GROUP BY o.id
  `
  if (!rows[0]) return null
  return rows[0] as Org
}

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await getOrg(slug)

  if (!org) notFound()

  const location = [org.city, org.state].filter(Boolean).join(', ')
  const hasMeta = org.founding_year || org.size_staff || org.size_members ||
    org.budget_range || org.legal_structure || org.governance_model
  const nteeDesc = nteeDescription(org.ntee_code)
  const propublicaUrl = org.external_id
    ? `https://projects.propublica.org/nonprofits/organizations/${org.external_id}`
    : null
  const e = org.enrichment
  const enrichedMission = e?.mission_summary ?? e?.mission ?? null
  const enrichedServices = e?.services_offered ?? e?.services ?? null
  const enrichedPopulation = Array.isArray(e?.population_served)
    ? (e.population_served as string[]).join(', ')
    : (e?.population_served as string | null | undefined) ?? null
  const hasRichContent = org.mission || org.description || org.documents?.length > 0 || enrichedMission

  return (
    <>
      <Nav />

      {/* ── ORG HEADER BANNER ── */}
      <header className="org-header">
        <div className="org-header-meta">
          <Link href="/results" className="back-link">← Back to Results</Link>
          <div className="org-header-tags">
            {org.org_types?.map(t => (
              <span key={t} className="tag tag-green">{t.replace(/_/g, ' ')}</span>
            ))}
            {org.verified && (
              <span className="tag tag-verified">✓ Verified</span>
            )}
          </div>
        </div>

        <h1 className="org-name">{org.name}</h1>

        <div className="org-header-footer">
          {location && (
            <span className="org-location">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {location}
            </span>
          )}
          {org.website && (
            <a href={org.website} target="_blank" rel="noopener noreferrer" className="org-website-btn">
              Visit Website →
            </a>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="org-body">
        {/* ── MAIN CONTENT ── */}
        <main className="org-main">
          {org.mission && (
            <section className="org-section">
              <p className="org-section-label">Mission</p>
              <blockquote className="org-mission">{org.mission}</blockquote>
            </section>
          )}

          {org.description && (
            <section className="org-section">
              <p className="org-section-label">About</p>
              <div className="org-description">{org.description}</div>
            </section>
          )}

          {/* ── CRAWL ENRICHMENT ── */}
          {e && (enrichedMission || enrichedServices?.length || enrichedPopulation || e.geographic_focus) && (
            <section className="org-section">
              <p className="org-section-label">
                Web Profile
                <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
                  from Common Crawl
                </span>
              </p>

              {!org.mission && enrichedMission && (
                <blockquote className="org-mission">{enrichedMission}</blockquote>
              )}

              {enrichedServices && enrichedServices.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
                    Services
                  </p>
                  <div className="tag-list">
                    {enrichedServices.map((s: string) => (
                      <span key={s} className="tag tag-green">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {enrichedPopulation && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                    Population Served
                  </p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>{enrichedPopulation}</p>
                </div>
              )}

              {e.geographic_focus && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>
                    Geographic Focus
                  </p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>{e.geographic_focus}</p>
                </div>
              )}
            </section>
          )}

          {org.issue_areas && org.issue_areas.length > 0 && (
            <section className="org-section">
              <p className="org-section-label">Issue Areas</p>
              <div className="tag-list">
                {org.issue_areas.map(a => (
                  <span key={a} className="tag tag-red">{a}</span>
                ))}
              </div>
            </section>
          )}

          {/* ── DOCUMENTS ── */}
          {org.documents && org.documents.length > 0 && (
            <section className="org-section">
              <p className="org-section-label">Documents</p>
              <div className="org-docs">
                {org.documents.map(doc => (
                  <div key={doc.id} className="org-doc-card">
                    <div className="org-doc-header">
                      <div>
                        {doc.doc_type && (
                          <span className="org-doc-type">{doc.doc_type.replace(/_/g, ' ')}</span>
                        )}
                        {doc.title && (
                          <p className="org-doc-title">{doc.title}</p>
                        )}
                      </div>
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="org-doc-link"
                        >
                          View →
                        </a>
                      )}
                    </div>
                    {doc.notable_clauses && doc.notable_clauses.length > 0 && (
                      <div className="org-doc-clauses">
                        <p className="org-doc-clauses-label">Notable provisions</p>
                        <ul className="org-doc-clauses-list">
                          {doc.notable_clauses.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {doc.text_content && (
                      <details className="org-doc-text">
                        <summary>View document text</summary>
                        <pre>{doc.text_content}</pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!hasRichContent && (
            <div className="org-empty">
              <div className="org-empty-notice">
                <p className="org-empty-heading">Profile in progress</p>
                <p>
                  We have basic registration data for this organization from IRS public records,
                  but haven&apos;t yet added a full profile with mission, description, or documents.
                </p>
                {propublicaUrl && (
                  <a
                    href={propublicaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="org-propublica-link"
                  >
                    View IRS filing history on ProPublica Nonprofit Explorer →
                  </a>
                )}
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="org-propublica-link">
                    Visit their website →
                  </a>
                )}
              </div>
            </div>
          )}
        </main>

        {/* ── SIDEBAR ── */}
        <aside className="org-sidebar">
          {/* Always show basic IRS data card — we always have ntee_code + org_types */}
          <div className="org-meta-card">
            <p className="sidebar-label">Organization Details</p>

            {org.org_types && org.org_types.length > 0 && (
              <div className="org-meta-row">
                <span className="org-meta-key">Type</span>
                <span className="org-meta-val">{org.org_types.map(t => t.replace(/_/g, ' ')).join(', ')}</span>
              </div>
            )}
            {org.ntee_code && (
              <>
                <div className="org-meta-row">
                  <span className="org-meta-key">NTEE Code</span>
                  <span className="org-meta-val org-meta-mono">{org.ntee_code}</span>
                </div>
                {nteeDesc && (
                  <div className="org-meta-row">
                    <span className="org-meta-key">Sector</span>
                    <span className="org-meta-val">{nteeDesc}</span>
                  </div>
                )}
              </>
            )}
            {org.founding_year && (
              <div className="org-meta-row">
                <span className="org-meta-key">Founded</span>
                <span className="org-meta-val">{org.founding_year}</span>
              </div>
            )}
            {org.legal_structure && (
              <div className="org-meta-row">
                <span className="org-meta-key">Legal Structure</span>
                <span className="org-meta-val">{org.legal_structure}</span>
              </div>
            )}
            {org.governance_model && (
              <div className="org-meta-row">
                <span className="org-meta-key">Governance</span>
                <span className="org-meta-val">{org.governance_model}</span>
              </div>
            )}
            {org.size_staff != null && (
              <div className="org-meta-row">
                <span className="org-meta-key">Staff</span>
                <span className="org-meta-val">{org.size_staff}</span>
              </div>
            )}
            {org.size_members != null && (
              <div className="org-meta-row">
                <span className="org-meta-key">Members</span>
                <span className="org-meta-val">{org.size_members.toLocaleString()}</span>
              </div>
            )}
            {org.budget_range && (
              <div className="org-meta-row">
                <span className="org-meta-key">Budget Range</span>
                <span className="org-meta-val">{org.budget_range}</span>
              </div>
            )}
            {location && (
              <div className="org-meta-row">
                <span className="org-meta-key">Location</span>
                <span className="org-meta-val">{location}</span>
              </div>
            )}
          </div>

          {propublicaUrl && (
            <a
              href={propublicaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="org-propublica-card"
            >
              <span className="org-propublica-label">IRS Filing History</span>
              <span className="org-propublica-cta">View on ProPublica Nonprofit Explorer →</span>
            </a>
          )}

          {(org.email || org.phone || org.county) && (
            <div className="org-meta-card">
              <p className="sidebar-label">Contact & Location</p>
              {org.county && (
                <div className="org-meta-row">
                  <span className="org-meta-key">County</span>
                  <span className="org-meta-val">{org.county}</span>
                </div>
              )}
              {org.email && (
                <div className="org-meta-row">
                  <span className="org-meta-key">Email</span>
                  <a href={`mailto:${org.email}`} className="org-meta-link">{org.email}</a>
                </div>
              )}
              {org.phone && (
                <div className="org-meta-row">
                  <span className="org-meta-key">Phone</span>
                  <span className="org-meta-val">{org.phone}</span>
                </div>
              )}
            </div>
          )}

          <div className="org-disclaimer">
            <p>
              Information sourced from public records. Nothing on this page constitutes legal advice.
              For legal guidance, contact the{' '}
              <a href="https://law.washu.edu/academics/clinical-programs/entrepreneurship-clinic/" target="_blank" rel="noopener noreferrer">
                WashU Entrepreneurship &amp; Nonprofit Law Clinic
              </a>.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
