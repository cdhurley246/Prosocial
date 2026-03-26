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

export default function MatchingPage() {
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

      <div className="matching-page">
        <div className="matching-sidebar">
          <Link href="/resources" className="back-link-light">← Resources</Link>
          <p className="matching-sidebar-label">AI-Powered Intake</p>
          <h1 className="matching-sidebar-title">
            Tell us about your<br />organization
          </h1>
          <p className="matching-sidebar-body">
            Describe your mission and what you&apos;re trying to build. We&apos;ll match you with
            similar organizations, relevant bylaws, and resources.
          </p>
          <div className="matching-how">
            <div className="matching-how-step">
              <span className="matching-step-num">01</span>
              <p>Describe your situation in plain language</p>
            </div>
            <div className="matching-how-step">
              <span className="matching-step-num">02</span>
              <p>Get matched with similar organizations</p>
            </div>
            <div className="matching-how-step">
              <span className="matching-step-num">03</span>
              <p>Browse relevant documents and resources</p>
            </div>
          </div>
        </div>

        <div className="matching-chat-panel">
          <p className="panel-label">Start the conversation</p>
          <h2 className="panel-heading">What are you building?</h2>
          <p className="panel-sub">
            No jargon required — just describe your situation and goals.
          </p>

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

          <div className="chat-window matching-chat-window" ref={chatRef}>
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
                placeholder="Describe your organization…"
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
      </div>
    </>
  )
}
