export const CRAWL_ID = process.env.CRAWL_ID ?? 'CC-MAIN-2025-05'

export interface CDXRecord {
  url: string
  filename: string
  offset: string
  length: string
  status: string
  mime: string
}

// Priority path segments for mission-relevant pages
const PRIORITY_PATHS = ['about', 'mission', 'programs', 'services', 'who-we-are', 'what-we-do']

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  baseDelayMs = 1000,
): Promise<Response> {
  let lastErr: Error = new Error('Unknown error')
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt - 1)))
    }
    try {
      const res = await fetch(url, options)
      if (res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      return res
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastErr
}

export async function lookupDomain(websiteUrl: string): Promise<CDXRecord[]> {
  const domain = websiteUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')

  const query = new URLSearchParams({
    url: `${domain}/*`,
    output: 'json',
    limit: '20',
    fl: 'url,filename,offset,length,status,mime',
    filter: 'status:200',
  })

  const res = await fetchWithRetry(
    `https://index.commoncrawl.org/${CRAWL_ID}-index?${query}`
  )

  if (res.status === 404) return []
  if (!res.ok) throw new Error(`CDX API error ${res.status} for ${domain}`)

  const text = await res.text()
  const records: CDXRecord[] = []

  for (const line of text.trim().split('\n')) {
    if (!line) continue
    try {
      const record = JSON.parse(line) as CDXRecord
      if (record.mime?.includes('text/html')) records.push(record)
    } catch {
      // skip malformed lines
    }
  }

  return records
}

export function pickBestPages(records: CDXRecord[]): CDXRecord[] {
  const priority = records.filter(r =>
    PRIORITY_PATHS.some(p => r.url.toLowerCase().includes(`/${p}`))
  )
  const rest = records.filter(r =>
    !PRIORITY_PATHS.some(p => r.url.toLowerCase().includes(`/${p}`))
  )
  // Take up to 3: prioritize mission-relevant pages, fill with homepage/other
  return [...priority, ...rest].slice(0, 3)
}
