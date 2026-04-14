'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'

interface Org {
  id: string
  slug: string
  name: string
  mission: string | null
  org_types: string[] | null
  issue_areas: string[] | null
  city: string | null
  state: string | null
  is_demo: boolean
}

interface Props {
  orgs: Org[]
}

function toLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function FilterSection({
  label,
  options,
  selected,
  onToggle,
  formatOption = (s: string) => s,
}: {
  label: string
  options: string[]
  selected: Set<string>
  onToggle: (val: string) => void
  formatOption?: (s: string) => string
}) {
  if (options.length === 0) return null
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <p className="sidebar-label">
        {label}
        {selected.size > 0 && (
          <span style={{ color: 'var(--red)', fontWeight: 400, marginLeft: 6 }}>
            ({selected.size})
          </span>
        )}
      </p>
      <div className="refine-filters">
        {options.map(opt => (
          <label key={opt} className="filter-label">
            <input
              type="checkbox"
              checked={selected.has(opt)}
              onChange={() => onToggle(opt)}
            />
            {' '}{formatOption(opt)}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function BrowseClient({ orgs }: Props) {
  const [search, setSearch] = useState('')
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())

  // Derive filter options from full dataset
  const stateOptions = useMemo(() => {
    const s = new Set<string>()
    orgs.forEach(o => { if (o.state) s.add(o.state) })
    return [...s].sort()
  }, [orgs])

  const typeOptions = useMemo(() => {
    const s = new Set<string>()
    orgs.forEach(o => o.org_types?.forEach(t => s.add(t)))
    return [...s].sort()
  }, [orgs])

  const issueOptions = useMemo(() => {
    const counts = new Map<string, number>()
    orgs.forEach(o => o.issue_areas?.forEach(a => {
      counts.set(a, (counts.get(a) ?? 0) + 1)
    }))
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([a]) => a)
  }, [orgs])

  // Apply filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter(o => {
      if (q && !o.name.toLowerCase().includes(q)) return false
      if (selectedStates.size > 0 && (!o.state || !selectedStates.has(o.state))) return false
      if (selectedTypes.size > 0 && !o.org_types?.some(t => selectedTypes.has(t))) return false
      if (selectedIssues.size > 0 && !o.issue_areas?.some(a => selectedIssues.has(a))) return false
      return true
    })
  }, [orgs, search, selectedStates, selectedTypes, selectedIssues])

  const hasFilters = !!search.trim() || selectedStates.size > 0 || selectedTypes.size > 0 || selectedIssues.size > 0
  const letters = [...new Set(filtered.map(o => o.name[0]?.toUpperCase()).filter(Boolean))].sort() as string[]

  function toggle(set: Set<string>, val: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    setter(prev => {
      const next = new Set(prev)
      next.has(val) ? next.delete(val) : next.add(val)
      return next
    })
  }

  function clearAll() {
    setSearch('')
    setSelectedStates(new Set())
    setSelectedTypes(new Set())
    setSelectedIssues(new Set())
  }

  return (
    <div className="browse-layout">
      <aside className="browse-sidebar">

        {/* ── Name search ── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="sidebar-label">Search</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name…"
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--rule)',
              borderRadius: 4,
              fontSize: '0.85rem',
              color: 'var(--ink)',
              background: 'white',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* ── State ── */}
        <FilterSection
          label="State"
          options={stateOptions}
          selected={selectedStates}
          onToggle={val => toggle(selectedStates, val, setSelectedStates)}
        />

        {/* ── Org Type ── */}
        <FilterSection
          label="Org Type"
          options={typeOptions}
          selected={selectedTypes}
          onToggle={val => toggle(selectedTypes, val, setSelectedTypes)}
          formatOption={toLabel}
        />

        {/* ── Issue Area ── */}
        <FilterSection
          label="Issue Area"
          options={issueOptions}
          selected={selectedIssues}
          onToggle={val => toggle(selectedIssues, val, setSelectedIssues)}
          formatOption={toLabel}
        />

        {/* ── Clear all ── */}
        {hasFilters && (
          <button
            onClick={clearAll}
            style={{
              marginBottom: '1.5rem',
              fontSize: '0.75rem',
              color: 'var(--red)',
              background: 'none',
              border: '1px solid rgba(165,20,23,0.25)',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '4px 10px',
              width: '100%',
            }}
          >
            Clear all filters
          </button>
        )}

        {/* ── Alpha jump (reflects filtered set) ── */}
        <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
          <p className="sidebar-label">Jump to</p>
          <div className="browse-alpha">
            {letters.map(l => (
              <a key={l} href={`#letter-${l}`} className="browse-alpha-link">{l}</a>
            ))}
          </div>
        </div>

        {/* ── Count ── */}
        <div style={{ marginBottom: '2rem' }}>
          <p className="sidebar-label">Showing</p>
          <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', fontWeight: 700, lineHeight: 1, marginBottom: '0.25rem' }}>
            {filtered.length}
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {hasFilters ? `of ${orgs.length} ` : ''}Organizations
          </p>
        </div>

        {/* ── CTA ── */}
        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--rule)' }}>
          <p className="sidebar-label">Find your match</p>
          <Link href="/matching" className="browse-match-cta">
            AI-powered matching →
          </Link>
        </div>
      </aside>

      <main className="browse-main">
        <div className="browse-header">
          <h1 className="browse-title">All Organizations</h1>
          <span className="results-count">
            {hasFilters ? `${filtered.length} of ${orgs.length}` : `${orgs.length}`} orgs
          </span>
        </div>

        {filtered.length === 0 && (
          <div className="org-empty">
            <div className="org-empty-notice">
              <p className="org-empty-heading">No results</p>
              <p>Try adjusting your filters or <button onClick={clearAll} style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>clearing all filters</button>.</p>
            </div>
          </div>
        )}

        {letters.map(letter => {
          const group = filtered.filter(o => o.name[0]?.toUpperCase() === letter)
          return (
            <div key={letter} id={`letter-${letter}`} className="browse-group">
              <div className="browse-group-label">{letter}</div>
              {group.map(org => (
                <Link key={org.id} href={`/orgs/${org.slug}`} className="browse-card">
                  <div className="browse-card-body">
                    <div className="result-name">
                      {org.name}
                      {org.is_demo && <span className="tag tag-demo" style={{ marginLeft: 8, verticalAlign: 'middle' }}>DEMO</span>}
                    </div>
                    {org.mission && (
                      <p className="result-mission">
                        {org.mission.slice(0, 160)}{org.mission.length > 160 ? '…' : ''}
                      </p>
                    )}
                    <div className="result-meta">
                      {org.org_types?.map(t => (
                        <span key={t} className="tag tag-green">{t.replace(/_/g, ' ')}</span>
                      ))}
                      {org.issue_areas?.slice(0, 3).map(a => (
                        <span key={a} className="tag tag-red">{a}</span>
                      ))}
                      {(org.city || org.state) && (
                        <span className="result-location">
                          {[org.city, org.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="browse-card-arrow">→</span>
                </Link>
              ))}
            </div>
          )
        })}
      </main>
    </div>
  )
}
