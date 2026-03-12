'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  content: "Hello! Tell me about the organization you're building or trying to start. What's your mission, and what kind of help are you looking for?",
}

export default function Home() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, loading])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: input },
    ]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.message }])

      if (data.profile) {
        const params = new URLSearchParams()
        params.set('q', data.profile.search_query)
        params.set('profile', JSON.stringify(data.profile))
        router.push(`/results?${params.toString()}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <nav className="nav">
        <a href="/" className="nav-logo">
          Pro<span>social</span>
        </a>
        <ul className="nav-links">
          <li><a href="#">Organizations</a></li>
          <li><a href="#">Resources</a></li>
          <li><a href="#">About</a></li>
        </ul>
        <a href="#" className="nav-cta">Clinic Login →</a>
      </nav>

      <section className="hero">
        <div className="hero-left">
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

        <div className="hero-divider" />

        <div className="hero-right">
          <p className="panel-label">AI-Powered Intake</p>
          <h2 className="panel-heading">
            Tell us about your<br />organization
          </h2>
          <p className="panel-sub">
            Describe your mission and what you&apos;re trying to build — we&apos;ll match you with
            similar organizations, relevant bylaws, and resources.
          </p>

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
        </div>
      </section>

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
    </>
  )
}
