import { promisify } from 'util'
import { gunzip } from 'zlib'

const gunzipAsync = promisify(gunzip)

const CC_BASE = 'https://data.commoncrawl.org'
const MAX_TEXT_CHARS = 8000

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

export async function fetchPageText(
  filename: string,
  offset: number,
  length: number
): Promise<string> {
  const res = await fetchWithRetry(`${CC_BASE}/${filename}`, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}` },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${filename}`)

  const buffer = Buffer.from(await res.arrayBuffer())
  const decompressed = await gunzipAsync(buffer)
  const raw = decompressed.toString('utf-8')

  return extractText(raw)
}

function extractText(warc: string): string {
  // WARC record: WARC headers → \r\n\r\n → HTTP response headers → \r\n\r\n → body
  const warcEnd = warc.indexOf('\r\n\r\n')
  if (warcEnd === -1) return ''

  const afterWarc = warc.slice(warcEnd + 4)
  const httpEnd = afterWarc.indexOf('\r\n\r\n')
  if (httpEnd === -1) return ''

  const html = afterWarc.slice(httpEnd + 4)
  return stripHtml(html).slice(0, MAX_TEXT_CHARS)
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim()
}
