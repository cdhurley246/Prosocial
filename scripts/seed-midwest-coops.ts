import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

import { db } from '../lib/db'
import { orgs, crawl_enrichments } from '../lib/db/schema'

interface ExtractedFields {
  name: string | null
  mission: string | null
  sector: string | null
  services: string[] | null
  population_served: string | null
  geographic_focus: string | null
  worker_owner_count: number | null
  founding_year: number | null
  governance_notes: string | null
  website_url: string | null
}

interface CrawlResult {
  url: string
  state: string
  coverage: boolean
  crawl_timestamp: string | null
  extracted: ExtractedFields | null
  error: string | null
}

function makeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '')
}

function parseCity(geographicFocus: string | null): string | null {
  if (!geographicFocus) return null
  return geographicFocus.split(',')[0].trim() || null
}

function parseCrawlTimestamp(ts: string | null): Date {
  if (!ts) return new Date()
  // Format: YYYYMMDDHHmmss
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/)
  if (!m) return new Date()
  return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
}

async function main() {
  const resultsPath = path.join(__dirname, '../lib/pipeline/crawl-poc-results.json')

  if (!fs.existsSync(resultsPath)) {
    console.error(`Results file not found: ${resultsPath}`)
    console.error('Run: node lib/pipeline/crawl-poc.js first')
    process.exit(1)
  }

  const results: CrawlResult[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
  const covered = results.filter(r => r.extracted !== null)

  console.log(`Seeding Midwest co-ops from crawl results`)
  console.log(`Total results: ${results.length} | With extracted data: ${covered.length}\n`)

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const result of covered) {
    const e = result.extracted!
    const name = e.name ?? result.url
    const slug = makeSlug(name)

    const description = [
      e.sector          ? `Sector: ${e.sector}` : null,
      e.services?.length ? `Services: ${e.services.join(', ')}` : null,
      e.population_served ? `Population served: ${e.population_served}` : null,
    ].filter(Boolean).join('\n') || null

    try {
      const rows = await db
        .insert(orgs)
        .values({
          slug,
          name,
          mission:          e.mission,
          description,
          founding_year:    e.founding_year,
          size_members:     e.worker_owner_count,
          governance_model: e.governance_notes,
          website:          result.url,
          state:            result.state,
          city:             parseCity(e.geographic_focus),
          org_types:        ['worker_cooperative'],
          legal_structure:  'cooperative',
          source:           'common-crawl',
          verified:         false,
        })
        .onConflictDoNothing()
        .returning({ id: orgs.id })

      if (!rows[0]) {
        console.log(`  ~ ${name} — already exists, skipped`)
        skipped++
        continue
      }

      await db.insert(crawl_enrichments).values({
        org_id:           rows[0].id,
        extracted_fields: e as unknown as Record<string, unknown>,
        crawled_at:       parseCrawlTimestamp(result.crawl_timestamp),
      })

      console.log(`  ✓ ${name} (${result.state})`)
      inserted++
    } catch (err) {
      console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`)
      errors++
    }
  }

  console.log(`\n─── Summary ───────────────────────────`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Errors:   ${errors}`)
  console.log(`\nNext step: npx tsx scripts/generate-embeddings.ts`)
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
