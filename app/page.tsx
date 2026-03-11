'use client'
import { useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function Home() {
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
      if (data.profile) setProfile(data.profile)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: 8 }}>Prosocial</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>
        A resource platform for nonprofits and co-ops in the St. Louis region.
      </p>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 20, minHeight: 300, marginBottom: 16 }}>
        {messages.length === 0 && (
          <p style={{ color: '#999' }}>
            Tell us about your organization or what you&apos;re trying to build...
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <strong>{m.role === 'user' ? 'You' : 'Prosocial'}:</strong>
            <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{m.content}</p>
          </div>
        ))}
        {loading && <p style={{ color: '#999' }}>Thinking...</p>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }}}
          placeholder="Describe your organization..."
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #ddd', resize: 'none', height: 80 }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: '0 20px', background: '#a51417', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Send
        </button>
      </div>

      {profile && (
        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <strong>Extracted Profile:</strong>
          <pre style={{ marginTop: 8, fontSize: 13 }}>{JSON.stringify(profile, null, 2)}</pre>
        </div>
      )}
    </main>
  )
}
