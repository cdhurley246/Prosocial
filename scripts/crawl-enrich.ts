/**
 * scripts/crawl-enrich.ts
 *
 * Common Crawl enrichment pipeline — three phases per org:
 *
 *   Phase 1 — CDX Lookup
 *     Query Common Crawl's CDX index for the org's domain.
 *     Write crawl_coverage=true/false back to the orgs table.
 *
 *   Phase 2 — WARC Extraction
 *     For orgs with coverage, fetch up to 5 relevant pages (about, mission,
 *     programs, team, homepage) from WARC records via HTTP Range requests.
 *     Decompress and strip HTML to get plain text.
 *
 *   Phase 3 — Claude Enrichment
 *     Send aggregated text to Claude. Parse the JSON response.
 *     Write raw_text + extracted_fields to the crawl_enrichments table.
 *
 * Run with:
 *   npm run crawl
 *   (or: tsx --env-file .env.local scripts/crawl-enrich.ts)
 *
 * Safe to re-run — already-enriched orgs are skipped.
 */

import { db } from '../lib/db'
import { orgs, crawl_enrichments } from '../lib/db/schema'
import { lookupCDX, filterRelevantPages, fetchWARCText } from '../lib/pipeline/crawl'
import { extractOrgProfile } from '../lib/ai/enrich'
import { isNotNull, eq, notInArray, inArray } from 'drizzle-orm'

// Delay between orgs to avoid hammering Common Crawl and Claude
const ORG_DELAY_MS = 1_500
// Delay between WARC fetches within a single org
const PAGE_DELAY_MS = 600

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    // Strip www. so CDX wildcard matches bare domain and subdomains equally
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

async function main() {
  // ── Find orgs that have a website but haven't been enriched yet ──
  const alreadyDone = await db
    .select({ org_id: crawl_enrichments.org_id })
    .from(crawl_enrichments)

  const doneIds = alreadyDone.map(r => r.org_id)

  const allTargets = await db
    .select({ id: orgs.id, name: orgs.name, website: orgs.website })
    .from(orgs)
    .where(isNotNull(orgs.website))

  const targets = doneIds.length > 0
    ? allTargets.filter(o => !doneIds.includes(o.id))
    : allTargets

  console.log(`Orgs to process: ${targets.length}`)
  if (targets.length === 0) {
    console.log('Nothing to do — all orgs with websites have been enriched.')
    process.exit(0)
  }

  let enriched = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < targets.length; i++) {
    const org = targets[i]
    const prefix = `[${i + 1}/${targets.length}]`

    if (!org.website) { skipped++; continue }

    const domain = extractDomain(org.website)
    if (!domain) {
      console.log(`${prefix} ${org.name} — bad URL, skipping`)
      skipped++
      continue
    }

    console.log(`\n${prefix} ${org.name}  (${domain})`)

    // ── Phase 1: CDX Lookup ──────────────────────────────────
    let records
    try {
      records = await lookupCDX(domain)
    } catch (err) {
      console.error(`  CDX lookup threw:`, err)
      failed++
      await sleep(ORG_DELAY_MS)
      continue
    }

    if (records.length === 0) {
      console.log(`  No Common Crawl coverage — marking false`)
      await db.update(orgs)
        .set({ crawl_coverage: false })
        .where(eq(orgs.id, org.id))
      skipped++
      await sleep(ORG_DELAY_MS)
      continue
    }

    console.log(`  ${records.length} CDX records found`)
    await db.update(orgs)
      .set({ crawl_coverage: true })
      .where(eq(orgs.id, org.id))

    // ── Phase 2: WARC Extraction ─────────────────────────────
    const pages = filterRelevantPages(records)
    console.log(`  Fetching ${pages.length} page(s): ${pages.map(p => p.url).join(', ')}`)

    const textParts: string[] = []
    for (const page of pages) {
      try {
        const text = await fetchWARCText(page)
        if (text && text.length > 50) {
          // Label each page so Claude has URL context
          textParts.push(`=== ${page.url} ===\n${text}`)
        }
      } catch (err) {
        console.error(`  WARC fetch error for ${page.url}:`, err)
      }
      await sleep(PAGE_DELAY_MS)
    }

    if (textParts.length === 0) {
      console.log(`  No usable text extracted`)
      failed++
      await sleep(ORG_DELAY_MS)
      continue
    }

    // Cap total text at 20 000 chars before sending to Claude
    const rawText = textParts.join('\n\n').slice(0, 20_000)
    console.log(`  Extracted ${rawText.length} chars across ${textParts.length} page(s)`)

    // ── Phase 3: Claude Enrichment ───────────────────────────
    const extracted = await extractOrgProfile(rawText, org.name)
    if (!extracted) {
      console.log(`  Extraction returned null`)
      failed++
      await sleep(ORG_DELAY_MS)
      continue
    }

    // ── Phase 4: Write to DB ─────────────────────────────────
    await db.insert(crawl_enrichments).values({
      org_id:           org.id,
      raw_text:         rawText,
      extracted_fields: extracted,
      crawled_at:       new Date(),
    })

    const preview = extracted.mission_summary?.slice(0, 80) ?? '(no mission summary)'
    console.log(`  ✓ Enriched: ${preview}`)
    enriched++

    await sleep(ORG_DELAY_MS)
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Done.  Enriched: ${enriched}  |  Skipped: ${skipped}  |  Failed: ${failed}`)
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
