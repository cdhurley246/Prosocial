import Link from 'next/link'

export default function ResourcesPage() {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          Pro<span>social</span>
        </Link>
        <ul className="nav-links">
          <li><a href="/resources" style={{ color: 'var(--ink)' }}>Resources</a></li>
          <li><a href="/browse">Browse</a></li>
          <li><a href="/about">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <div className="resources-hub">
        <div className="resources-hub-header">
          <p className="kicker">Resource Center</p>
          <h1 className="resources-hub-title">Tools for building<br /><em>better organizations</em></h1>
          <p className="resources-hub-sub">
            Free legal templates, AI-powered matching, and curated resources for nonprofits,
            cooperatives, and civic organizations in Missouri and Illinois.
          </p>
        </div>

        <div className="resources-hub-cards">
          <Link href="/legal-docs" className="resources-hub-card">
            <p className="resources-card-label">Documents</p>
            <h2 className="resources-card-title">Legal Documents<br />&amp; Templates</h2>
            <p className="resources-card-body">
              10 open-license bylaws, operating agreements, and legal guides from DAWI, SELC,
              and the University of Wisconsin — real models used by real organizations.
            </p>
            <div className="resources-card-tags">
              <span className="tag tag-green">Bylaws</span>
              <span className="tag tag-green">Operating Agreements</span>
              <span className="tag tag-green">Legal Guides</span>
            </div>
            <span className="resources-card-cta">Browse Documents →</span>
          </Link>

          <Link href="/matching" className="resources-hub-card resources-hub-card-dark">
            <p className="resources-card-label-dark">AI Matching</p>
            <h2 className="resources-card-title-dark">Find Your<br />Match</h2>
            <p className="resources-card-body-dark">
              Describe your organization and what you&apos;re trying to build — our AI will match
              you with similar organizations, relevant documents, and resources.
            </p>
            <div className="resources-card-tags-dark">
              <span className="tag-dark">Org Matching</span>
              <span className="tag-dark">Document Recs</span>
              <span className="tag-dark">AI-Powered</span>
            </div>
            <span className="resources-card-cta-dark">Start Matching →</span>
          </Link>
        </div>

        <div className="resources-hub-links">
          <p className="resources-hub-links-label">External Resources</p>
          <div className="resources-external-grid">
            {[
              { label: 'DAWI', name: 'Democracy at Work Institute', url: 'https://institute.coop' },
              { label: 'SELC', name: 'Sustainable Economies Law Center', url: 'https://www.theselc.org' },
              { label: 'USFWC', name: 'US Federation of Worker Cooperatives', url: 'https://www.usworker.coop' },
              { label: 'CoopLaw', name: 'Worker Cooperative Legal Library', url: 'https://www.cooplaw.org' },
            ].map(r => (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="resources-external-card">
                <span className="resources-external-label">{r.label}</span>
                <span className="resources-external-name">{r.name} →</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
