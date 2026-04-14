'use client'
import Link from 'next/link'

const lines = [
  { type: 'title',    text: 'Welcome to Prosocial' },
  { type: 'subtitle', text: 'A tool for socially-focused organizations and individuals\nin the St. Louis area.' },
  { type: 'body',     text: 'Use the chatbot on the next page to tell us about your organization or idea, and we will match you with helpful resources — including template legal documents, similar organizations, and more.' },
  { type: 'body',     text: 'After you have your resources, you can log in to connect with other organizations on the platform.' },
  { type: 'body',     text: 'When your project is ready, you can leave behind your legal documents and other information for the benefit of future change-makers.' },
]

export default function IntroPage() {
  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .intro-wrap {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--cream);
          padding: 3rem 1.5rem 4rem;
        }

        .intro-inner {
          max-width: 580px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .intro-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2rem, 5vw, 3rem);
          font-weight: 700;
          color: var(--ink);
          line-height: 1.15;
          margin: 0;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.1s;
        }

        .intro-subtitle {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          font-weight: 400;
          font-style: italic;
          color: var(--muted);
          margin: 0;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 0.45s;
        }

        .intro-divider {
          width: 48px;
          height: 2px;
          background: var(--red);
          border: none;
          margin: 0;
          opacity: 0;
          animation: fadeUp 0.6s ease forwards;
          animation-delay: 0.75s;
        }

        .intro-body {
          font-size: 1rem;
          line-height: 1.75;
          color: var(--ink);
          margin: 0;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards;
        }

        .intro-body:nth-of-type(1) { animation-delay: 1.0s; }
        .intro-body:nth-of-type(2) { animation-delay: 1.3s; }
        .intro-body:nth-of-type(3) { animation-delay: 1.6s; }

        .intro-btn {
          display: inline-block;
          align-self: flex-start;
          margin-top: 0.5rem;
          padding: 0.75rem 2rem;
          background: var(--ink);
          color: var(--cream);
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          border-radius: 3px;
          text-decoration: none;
          transition: background 0.2s ease, transform 0.15s ease;
          opacity: 0;
          animation: fadeUp 0.7s ease forwards;
          animation-delay: 1.9s;
        }

        .intro-btn:hover {
          background: var(--red);
          transform: translateY(-1px);
        }
      `}</style>

      <div className="intro-wrap">
        <div className="intro-inner">
          <h1 className="intro-title">{lines[0].text}</h1>
          <p className="intro-subtitle" style={{ whiteSpace: 'pre-line' }}>{lines[1].text}</p>
          <hr className="intro-divider" />
          <p className="intro-body">{lines[2].text}</p>
          <p className="intro-body">{lines[3].text}</p>
          <p className="intro-body">{lines[4].text}</p>
          <Link href="/home" className="intro-btn">
            Continue →
          </Link>
        </div>
      </div>
    </>
  )
}
