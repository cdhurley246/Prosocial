'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const CHIPS = [
  'Starting a co-op',
  'Nonprofit bylaws',
  'Finding funders',
  'Governance help',
  'Worker ownership',
  'Housing co-op',
]

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: "Tell me about the organization you're building or trying to start — what's your mission, and what kind of help are you looking for?",
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [matchUrl, setMatchUrl] = useState<string | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, loading])

  async function sendMessage() {
    if (!input.trim() || loading || matchUrl) return

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: input },
    ]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Exclude the pre-seeded greeting from the API payload
    const apiMessages = newMessages.filter(m => !(m.role === 'assistant' && m === INITIAL_MESSAGE))

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      const data = await res.json()

      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: `Something went wrong: ${data.error}` }])
        return
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: data.message }]
      setMessages(finalMessages)

      if (data.profile) {
        const params = new URLSearchParams()
        params.set('q', data.profile.search_query)
        params.set('profile', JSON.stringify(data.profile))
        // Save chat history so results page can show it
        sessionStorage.setItem('chatMessages', JSON.stringify(finalMessages))
        setMatchUrl(`/results?${params.toString()}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Nav />

      <main className="home">
        <div className="home-intro">
          <p className="kicker">St. Louis Cooperative Resource Network</p>
          <h1 className="hero-title">
            Building <em>better</em><br />
            organizations,<br />
            together.
          </h1>
          <p className="hero-body">
            A shared resource commons for nonprofits, co-ops, and socially-focused organizations
            across Missouri and Illinois — connecting you with the knowledge, models, and
            partners you need to succeed.
          </p>
        </div>

        <div className="home-chat">
          {!matchUrl && (
            <div className="chips">
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  className="chip"
                  onClick={() => setInput(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="chat-window" ref={chatRef}>
            {messages.map((m, i) => (
              <div key={i} className="chat-msg">
                <span className={`chat-msg-label ${m.role === 'user' ? 'user' : 'ai'}`}>
                  {m.role === 'user' ? 'You' : 'Prosocial'}
                </span>
                <p className="chat-msg-text">{m.content}</p>
              </div>
            ))}
            {loading && (
              <div className="chat-msg">
                <span className="chat-msg-label ai">Prosocial</span>
                <p className="chat-msg-text chat-typing">···</p>
              </div>
            )}
          </div>

          {matchUrl ? (
            <div className="match-ready">
              <p className="match-ready-label">Your matches are ready</p>
              <Link href={matchUrl} className="match-ready-btn">
                View similar organizations →
              </Link>
            </div>
          ) : (
            <div className="chat-input-row">
              <input
                className="chat-input"
                type="text"
                placeholder="Continue the conversation…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                disabled={loading}
              />
              <button
                className="chat-send"
                onClick={sendMessage}
                disabled={loading}
              >
                {loading ? '…' : 'Send'}
              </button>
            </div>
          )}
        </div>
      </main>

      <div className="home-below">
        <div className="stat-strip">
          <div className="stat">
            <div className="stat-n">400+</div>
            <div className="stat-l">Local Orgs</div>
          </div>
          <div className="stat">
            <div className="stat-n">MO &amp; IL</div>
            <div className="stat-l">Coverage</div>
          </div>
          <div className="stat">
            <div className="stat-n">Free</div>
            <div className="stat-l">Always</div>
          </div>
        </div>
      </div>

      <section className="how">
        <div className="how-step">
          <span className="step-num">01</span>
          <h3>Describe your situation</h3>
          <p>Tell us about your organization, your goals, and the challenges you&apos;re facing — in plain language, no legal jargon required.</p>
        </div>
        <div className="how-step">
          <span className="step-num">02</span>
          <h3>Get matched instantly</h3>
          <p>Our AI finds similar organizations, relevant documents, and resources from across the St. Louis region that fit your specific context.</p>
        </div>
        <div className="how-step">
          <span className="step-num">03</span>
          <h3>Pay it forward</h3>
          <p>Leave your knowledge behind — upload your bylaws, share what worked — so the next organization benefits from your experience.</p>
        </div>
      </section>

      <footer className="site-footer">
        <p className="footer-disclaimer">
          Nothing on this site constitutes legal advice. Content is provided for informational purposes only.
          All parties should consult a licensed attorney before taking any significant steps, including signing paperwork or forming a legal entity.
          For low-cost legal assistance, contact the{' '}
          <a href="https://law.wustl.edu/clinics/entrepreneurship-and-nonprofit-law-clinic/" target="_blank" rel="noopener noreferrer">
            WashU Entrepreneurship &amp; Nonprofit Law Clinic
          </a>.
        </p>
      </footer>
    </>
  )
}
