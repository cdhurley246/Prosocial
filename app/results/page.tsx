'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

interface OrgResult {
  id: string
  slug: string
  name: string
  mission: string | null
  description: string | null
  org_types: string[] | null
  issue_areas: string[] | null
  city: string | null
  state: string | null
  website: string | null
  ntee_code: string | null
  similarity: number
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState<OrgResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query) return
    fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 8 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setResults(data.results || [])
      })
      .catch(() => setError('Something went wrong'))
      .finally(() => setLoading(false))
  }, [query])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
      Finding similar organizations...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a51417' }}>
      {error}
    </div>
  )

  return (
    <div>
      <p style={{ color: '#666', marginBottom: 32, fontSize: '0.95rem' }}>
        Found {results.length} organizations matching your description
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {results.map(org => (
          <div key={org.id} style={{
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: 20,
            background: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: 6, color: '#1a1a18' }}>
                {org.website ? (
                  <a href={org.website} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#a51417', textDecoration: 'none' }}>
                    {org.name}
                  </a>
                ) : org.name}
              </h2>
              <span style={{
                fontSize: '0.75rem',
                background: '#f5f0e8',
                padding: '2px 8px',
                borderRadius: 999,
                color: '#666',
                whiteSpace: 'nowrap',
                marginLeft: 12,
              }}>
                {Math.round(org.similarity * 100)}% match
              </span>
            </div>

            {org.mission && (
              <p style={{ fontSize: '0.9rem', color: '#444', marginBottom: 10, lineHeight: 1.6 }}>
                {org.mission.slice(0, 200)}{org.mission.length > 200 ? '...' : ''}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {org.org_types?.map(t => (
                <span key={t} style={{
                  fontSize: '0.75rem', padding: '2px 8px',
                  borderRadius: 999, background: '#e8f0e8', color: '#3d5c3a'
                }}>{t}</span>
              ))}
              {org.issue_areas?.map(a => (
                <span key={a} style={{
                  fontSize: '0.75rem', padding: '2px 8px',
                  borderRadius: 999, background: '#f0e8e8', color: '#a51417'
                }}>{a}</span>
              ))}
              {(org.city || org.state) && (
                <span style={{
                  fontSize: '0.75rem', padding: '2px 8px',
                  borderRadius: 999, background: '#f5f5f5', color: '#666'
                }}>{[org.city, org.state].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32 }}>
        <Link href="/" style={{ color: '#a51417', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Start over
        </Link>
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <main style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 4, color: '#a51417' }}>Prosocial</h1>
      </Link>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 400, color: '#666', marginBottom: 32 }}>
        Organizations similar to yours
      </h2>

      <Suspense fallback={<div>Loading...</div>}>
        <ResultsContent />
      </Suspense>
    </main>
  )
}
