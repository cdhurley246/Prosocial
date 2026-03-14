import Link from 'next/link'

export default function AboutPage() {
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-logo">
          Pro<span>social</span>
        </Link>
        <ul className="nav-links">
          <li><a href="/resources">Resources</a></li>
          <li><a href="/browse">Browse</a></li>
          <li><a href="/about">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <div className="about-content">
        <div className="about-main">
          <p className="about-kicker">About the Platform</p>
          <h1 className="about-title">A shared commons for St. Louis civic organizations</h1>
          <div className="about-body">
            <p>
              Prosocial is a free resource platform for nonprofits, worker cooperatives, consumer co-ops,
              and other socially-focused organizations across Missouri and Illinois. We help organizations
              find peers, share governance knowledge, and connect with the legal and operational resources
              they need to succeed.
            </p>
            <p>
              Our AI-powered intake tool asks a few questions about your organization, then matches you
              with similar organizations in our database — giving you access to real-world examples of
              bylaws, governance structures, and organizational models from groups who have navigated the
              same challenges you're facing.
            </p>
            <p>
              The platform is free to use and always will be. It is built and maintained by the
              St. Louis Cooperative Resource Network in partnership with local civic organizations.
            </p>
          </div>
        </div>

        <div className="about-divider" />

        <div className="about-aside">
          <p className="about-section-label">Legal Notice</p>
          <div className="about-notice">
            <p>
              Nothing on this site constitutes legal advice. All content is provided for informational
              and educational purposes only. Prosocial does not provide legal representation or legal
              counsel of any kind.
            </p>
            <p>
              Before taking any significant organizational steps — including forming a legal entity,
              adopting bylaws, signing contracts, or making governance decisions — you should consult
              a licensed attorney familiar with nonprofit and cooperative law.
            </p>
          </div>

          <p className="about-section-label" style={{ marginTop: '2rem' }}>Free Legal Help</p>
          <div className="about-clinic-card">
            <p className="clinic-label">Washington University School of Law</p>
            <p className="clinic-name">Entrepreneurship &amp; Nonprofit Law Clinic</p>
            <p className="clinic-desc">
              The WashU clinic provides free legal services to qualifying nonprofits, startups,
              and social enterprises in the St. Louis region. Students work under the supervision
              of licensed attorneys.
            </p>
            <a
              className="clinic-link"
              href="https://law.wustl.edu/clinics/entrepreneurship-and-nonprofit-law-clinic/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Learn more →
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
