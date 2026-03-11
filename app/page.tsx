'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  async function sendMessage() {
    if (!input.trim() || loading) return

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: input }
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
        setProfile(data.profile)
        // Automatically redirect to results once a profile is extracted
        const query = encodeURIComponent(data.profile.search_query)
        router.push(`/results?q=${query}`)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8, color: '#a51417' }}>Prosocial</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        A resource platform for nonprofits and co-ops in the St. Louis region.
        Describe your organization and we&apos;ll find similar ones.
      </p>

      <div style={{
        border: '1px solid #ddd', borderRadius: 8, padding: 20,
        minHeight: 300, marginBottom: 16, background: 'white'
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#999' }}>
            Tell us about your organization or what you&apos;re trying to build...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <strong style={{ color: m.role === 'user' ? '#1a1a18' : '#a51417' }}>
              {m.role === 'user' ? 'You' : 'Prosocial'}:
            </strong>
            <p style={{ marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{m.content}</p>
          </div>
        ))}
        {loading && <p style={{ color: '#999', fontStyle: 'italic' }}>Finding matches...</p>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              sendMessage()
            }
          }}
          placeholder="e.g. We're a group of restaurant workers looking to convert to a worker co-op..."
          style={{
            flex: 1, padding: 10, borderRadius: 6,
            border: '1px solid #ddd', resize: 'none', height: 80,
            fontFamily: 'sans-serif', fontSize: '0.95rem'
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            padding: '0 20px', background: '#a51417', color: 'white',
            border: 'none', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, fontFamily: 'sans-serif', fontSize: '0.95rem'
          }}
        >
          Send
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: '0.8rem', color: '#999' }}>
        Press Enter to send · Shift+Enter for new line
      </p>
    </main>
  )
}
