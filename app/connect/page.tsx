'use client'
import Nav from '@/components/Nav'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'

const FEATURES = [
  {
    label: 'Org Profiles',
    title: 'Build your presence',
    body: 'Create a rich profile for your organization — mission, programs, team, and more — so others can find and understand you.',
  },
  {
    label: 'Connections',
    title: 'Find your network',
    body: 'Discover and connect with nonprofits, co-ops, and community organizations working on issues that align with yours.',
  },
  {
    label: 'News & Updates',
    title: "Share what you're building",
    body: 'Post updates, opportunities, and announcements to your network. Keep your community informed and engaged.',
  },
  {
    label: 'Direct Messaging',
    title: 'Reach out directly',
    body: 'Send and receive messages with other organizations. Collaborate on projects, share resources, and build real partnerships.',
  },
]

export default function ConnectPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') return null

  if (session) {
    return (
      <>
        <Nav />
        <main className="connect-main">
          <div className="connect-auth-hero">
            <p className="kicker">Connect</p>
            <h1 className="connect-hero-title">
              Welcome, {session.user?.name?.split(' ')[0]}.
            </h1>
            <p className="connect-hero-sub">
              Your network is waiting. The full Connect experience is coming soon —
              we're building out profiles, feeds, and messaging now.
            </p>
          </div>
          <div className="connect-coming-soon">
            {FEATURES.map((f) => (
              <div key={f.label} className="connect-soon-card">
                <p className="connect-soon-label">{f.label}</p>
                <h3 className="connect-soon-title">{f.title}</h3>
                <p className="connect-soon-body">{f.body}</p>
                <span className="connect-soon-badge">Coming soon</span>
              </div>
            ))}
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Nav />
      <main className="connect-main">
        <div className="connect-hero">
          <p className="kicker">Connect</p>
          <h1 className="connect-hero-title">
            Build real partnerships<br />
            with <em>changemakers</em> like you.
          </h1>
          <p className="connect-hero-sub">
            Prosocial Connect is a network built for nonprofits and cooperatives in
            Missouri and Illinois — find aligned organizations, share what you're
            building, and grow the community around your mission.
          </p>
          <button
            className="connect-cta"
            onClick={() => signIn('google', { callbackUrl: '/connect' })}
          >
            Sign in to connect →
          </button>
          <p className="connect-cta-note">Free for all organizations. No credit card required.</p>
        </div>

        <div className="connect-features">
          {FEATURES.map((f) => (
            <div key={f.label} className="connect-feature-card">
              <p className="connect-feature-label">{f.label}</p>
              <h3 className="connect-feature-title">{f.title}</h3>
              <p className="connect-feature-body">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="connect-bottom-cta">
          <p>Ready to grow your network?</p>
          <button
            className="connect-cta"
            onClick={() => signIn('google', { callbackUrl: '/connect' })}
          >
            Sign in with Google →
          </button>
        </div>
      </main>
    </>
  )
}
