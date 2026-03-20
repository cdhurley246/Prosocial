/**
 * lib/pipeline/crawl.ts
 *
 * Common Crawl utilities:
 *   1. CDX lookup  — checks if a domain was crawled and returns record metadata
 *   2. WARC fetch  — downloads a specific compressed WARC record via HTTP Range,
 *                    decompresses it, strips HTML, and returns plain text
 *
 * Public data, no credentials required.
 * WARC records are individually gzip-compressed within the .warc.gz file, so a
 * Range request returns a complete, self-contained gzip stream.
 */

import zlib from 'node:zlib'
import { promisify } from 'node:util'

const gunzip = promisify(zlib.gunzip)

// Use the most recent crawl index; fall back to previous if no results
const CRAWL_INDICES = [
  'CC-MAIN-2025-08',
  'CC-MAIN-2024-51',
  'CC-MAIN-2024-46',
]

const CDX_BASE = 'https://index.commoncrawl.org'
const CC_DATA_BASE = 'https://data.commoncrawl.org'

// Path segments that typically contain org mission / program content
const RELEVANT_PATHS = [
  'about', 'mission', 'programs', 'team', 'services',
  'who-we-are', 'what-we-do', 'our-work', 'our-mission',
  'impact', 'story', 'vision', 'values', 'work',
]

export interface CDXRecord {
  url: string
  timestamp: string
  filename: string
  offset: number
  length: number
}

// ─── CDX Lookup ───────────────────────────────────────────────

/**
 * Queries the Common Crawl CDX API for all HTML pages under a domain.
 * Tries crawl indices in order and returns records from the first one with results.
 */
export async function lookupCDX(domain: string): Promise<CDXRecord[]> {
  for (const crawl of CRAWL_INDICES) {
    const params = new URLSearchParams({
      url: `${domain}/*`,
      output: 'json',
      fl: 'url,timestamp,filename,offset,length,status,mime',
      filter: 'statuscode:200',
      // Second filter param — CDX API accepts repeated keys
      limit: '30',
    })
    // Add mime filter separately (CDX API supports repeated filter keys via raw URL)
    const url =
      `${CDX_BASE}/${crawl}-index?${params.toString()}&filter=mime:text/html`

    let res: Response
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    } catch {
      continue
    }

    if (!res.ok) continue

    const text = await res.text()
    const records = parseNDJSON(text)
    if (records.length > 0) return records
  }

  return []
}

function parseNDJSON(body: string): CDXRecord[] {
  const records: CDXRecord[] = []
  for (const line of body.trim().split('\n')) {
    if (!line.trim()) continue
    try {
      const e = JSON.parse(line)
      if (!e.filename || !e.offset || !e.length) continue
      records.push({
        url: e.url,
        timestamp: e.timestamp,
        filename: e.filename,
        offset: parseInt(e.offset, 10),
        length: parseInt(e.length, 10),
      })
    } catch {
      // skip malformed lines
    }
  }
  return records
}

// ─── Page Filtering ───────────────────────────────────────────

/**
 * Picks up to 5 pages most likely to contain mission/program text,
 * de-duplicates URLs, and prefers the most recent snapshot.
 */
export function filterRelevantPages(records: CDXRecord[]): CDXRecord[] {
  // Score each record: homepage = 1, relevant path = 2, else 0
  const scored = records.map(r => {
    let score = 0
    try {
      const path = new URL(r.url).pathname.toLowerCase()
      if (path === '/' || path === '') {
        score = 1
      } else if (RELEVANT_PATHS.some(p => path.includes(p))) {
        score = 2
      }
    } catch {
      // malformed URL — skip
    }
    return { record: r, score }
  })

  // Keep only scored pages, sort by score desc then timestamp desc
  const filtered = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || b.record.timestamp.localeCompare(a.record.timestamp))

  // De-duplicate by URL
  const seen = new Set<string>()
  const deduped: CDXRecord[] = []
  for (const { record } of filtered) {
    if (!seen.has(record.url)) {
      seen.add(record.url)
      deduped.push(record)
    }
    if (deduped.length >= 5) break
  }

  return deduped
}

// ─── WARC Fetch + Text Extraction ────────────────────────────

/**
 * Fetches a single WARC record from Common Crawl using an HTTP Range request,
 * decompresses the gzip stream, parses the WARC/HTTP envelope, and returns
 * stripped plain text (capped at 120 KB of HTML to avoid runaway memory use).
 */
export async function fetchWARCText(record: CDXRecord): Promise<string> {
  const rangeEnd = record.offset + record.length - 1
  let res: Response
  try {
    res = await fetch(`${CC_DATA_BASE}/${record.filename}`, {
      headers: { Range: `bytes=${record.offset}-${rangeEnd}` },
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    return ''
  }

  if (res.status !== 206 && res.status !== 200) return ''

  const buf = Buffer.from(await res.arrayBuffer())

  let decompressed: Buffer
  try {
    decompressed = await gunzip(buf)
  } catch {
    return ''
  }

  return extractTextFromWARC(decompressed)
}

/**
 * Parses the WARC envelope:
 *   WARC headers → blank line → HTTP headers → blank line → HTML body
 * Returns stripped plain text.
 */
function extractTextFromWARC(buf: Buffer): string {
  const raw = buf.toString('utf-8')

  // WARC header block ends at first double CRLF
  const warcEnd = raw.indexOf('\r\n\r\n')
  if (warcEnd === -1) return ''

  // HTTP response headers end at the next double CRLF
  const httpEnd = raw.indexOf('\r\n\r\n', warcEnd + 4)
  if (httpEnd === -1) return ''

  // HTML body — cap at 120 KB
  const html = raw.slice(httpEnd + 4, httpEnd + 4 + 120_000)
  return stripHtml(html)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
