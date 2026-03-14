export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { neon } from '@neondatabase/serverless'

const DOC_TYPE_LABELS: Record<string, string> = {
  bylaws: 'Bylaws',
  operating_agreement: 'Operating Agreements',
  legal_guide: 'Legal Guides',
  articles_of_incorporation: 'Articles of Incorporation',
}

interface Doc {
  id: string
  title: string
  doc_type: string
  file_url: string
  notable_clauses: string[] | null
  source_name: string
}

export default async function LegalDocsPage() {
  const sql = neon(process.env.DATABASE_URL!)

  const docs = await sql`
    SELECT
      d.id,
      d.title,
      d.doc_type,
      d.file_url,
      d.notable_clauses,
      o.name as source_name
    FROM documents d
    JOIN orgs o ON d.org_id = o.id
    WHERE d.is_public = true
      AND d.deleted_at IS NULL
    ORDER BY d.doc_type, d.title
  ` as Doc[]

  // Group by doc_type
  const grouped = docs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const key = doc.doc_type || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  const docTypeOrder = ['bylaws', 'operating_agreement', 'legal_guide', 'articles_of_incorporation']
  const orderedGroups = [
    ...docTypeOrder.filter(k => grouped[k]),
    ...Object.keys(grouped).filter(k => !docTypeOrder.includes(k)),
  ]

  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          Pro<span>social</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#">Browse</a></li>
          <li><a href="/resources">Resources</a></li>
          <li><a href="/about">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <div className="legal-docs-layout">
        <div className="legal-docs-header">
          <Link href="/resources" className="back-link" style={{ marginBottom: '2rem', display: 'inline-flex' }}>
            ← Resources
          </Link>
          <p className="kicker">Legal Documents</p>
          <h1 className="legal-docs-title">Bylaws &amp; Legal Templates</h1>
          <p className="legal-docs-sub">
            {docs.length} open-license documents from DAWI, SELC, and the University of Wisconsin.
            These are starting points — not legal advice.
          </p>
        </div>

        <div className="legal-docs-body">
          {orderedGroups.map(type => (
            <div key={type} className="doc-group">
              <h2 className="doc-group-label">
                {DOC_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                <span className="doc-group-count">{grouped[type].length}</span>
              </h2>
              <div className="doc-group-list">
                {grouped[type].map(doc => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-card"
                  >
                    <div className="doc-card-main">
                      <p className="doc-card-source">{doc.source_name}</p>
                      <h3 className="doc-card-title">{doc.title}</h3>
                      {doc.notable_clauses && doc.notable_clauses.length > 0 && (
                        <div className="doc-card-clauses">
                          {doc.notable_clauses.slice(0, 4).map(c => (
                            <span key={c} className="tag tag-green">
                              {c.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="doc-card-cta">View PDF →</span>
                  </a>
                ))}
              </div>
            </div>
          ))}

          {docs.length === 0 && (
            <div className="org-empty-notice">
              <p className="org-empty-heading">No documents yet</p>
              <p>Run <code>npm run seed:docs</code> to populate the document library.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="site-footer">
        <p className="footer-disclaimer">
          Nothing on this site constitutes legal advice. These documents are provided for informational
          and educational purposes only. Always consult a licensed attorney before adopting bylaws or
          forming a legal entity. For free legal assistance, contact the{' '}
          <a href="https://law.wustl.edu/clinics/entrepreneurship-and-nonprofit-law-clinic/" target="_blank" rel="noopener noreferrer">
            WashU Entrepreneurship &amp; Nonprofit Law Clinic
          </a>.
        </p>
      </footer>
    </>
  )
}
