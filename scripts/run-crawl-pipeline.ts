import { db } from '../lib/db'
import { orgs, crawl_enrichments } from '../lib/db/schema'
import { eq, isNotNull, isNull, and } from 'drizzle-orm'
import { lookupDomain, pickBestPages, CRAWL_ID } from '../lib/pipeline/cdx-lookup'
import { fetchPageText } from '../lib/pipeline/wet-extract'
import { enrichWithClaude } from '../lib/pipeline/claude-enrichment'

const LIMIT = parseInt(process.env.CRAWL_LIMIT ?? '50')
const DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log(`Starting Common Crawl enrichment pipeline (crawl: ${CRAWL_ID}, limit: ${LIMIT})`)

  const rows = await db
    .select({ id: orgs.id, name: orgs.name, website: orgs.website })
    .from(orgs)
    .leftJoin(crawl_enrichments, eq(orgs.id, crawl_enrichments.org_id))
    .where(and(isNotNull(orgs.website), isNull(crawl_enrichments.id)))
    .limit(LIMIT)

  console.log(`Found ${rows.length} orgs with websites and no existing enrichment\n`)

  let success = 0, skipped = 0, failed = 0

  for (const org of rows) {
    if (!org.website) { skipped++; continue }

    try {
      // ── Phase 1: CDX lookup ───────────────────────────────────
      process.stdout.write(`[${org.name}] CDX lookup... `)
      const records = await lookupDomain(org.website)
      await sleep(DELAY_MS)

      if (records.length === 0) {
        console.log('no coverage, skipping')
        skipped++
        continue
      }

      console.log(`${records.length} records found`)

      await db.update(orgs)
        .set({ crawl_coverage: CRAWL_ID })
        .where(eq(orgs.id, org.id))

      // ── Phase 2: WET/WARC extraction ──────────────────────────
      const pages = pickBestPages(records)
      const textParts: string[] = []

      for (const page of pages) {
        try {
          process.stdout.write(`  Fetching ${page.url} ... `)
          const text = await fetchPageText(
            page.filename,
            parseInt(page.offset),
            parseInt(page.length)
          )
          if (text.length > 100) {
            textParts.push(`[${page.url}]\n${text}`)
            console.log(`${text.length} chars`)
          } else {
            console.log('too short, skipping')
          }
        } catch (err) {
          console.log(`error: ${err instanceof Error ? err.message : err}`)
        }
        await sleep(500)
      }

      if (textParts.length === 0) {
        console.log('  No usable text extracted, skipping enrichment')
        skipped++
        continue
      }

      const combinedText = textParts.join('\n\n---\n\n')

      // ── Phase 3: Claude enrichment ────────────────────────────
      process.stdout.write(`  Claude enrichment... `)
      const extracted = await enrichWithClaude(org.name, combinedText)

      await db.insert(crawl_enrichments).values({
        org_id: org.id,
        raw_text: combinedText.slice(0, 50000),
        extracted_fields: extracted,
      })

      console.log(`done`)
      console.log(`  mission: ${extracted.mission_summary?.slice(0, 100) ?? 'n/a'}`)
      success++

    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`)
      failed++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\nDone. success=${success} skipped=${skipped} failed=${failed}`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
