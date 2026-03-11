import { config } from 'dotenv'
config({ path: '.env.local' })

import { db } from '../lib/db'
import { orgs } from '../lib/db/schema'
import { fetchNonprofitsByState, slugify } from '../lib/ingest/propublica'

// NTEE major-group letters most relevant to our use case
// S=Community Improvement, W=Public Benefit, P=Human Services, R=Civil Rights,
// L=Housing, K=Food, E=Health, F=Mental Health, Q=International
const RELEVANT_NTEE_PREFIXES = ['S', 'W', 'P', 'R', 'L', 'K', 'E', 'F', 'Q']
const STATES = ['MO', 'IL']

// Cap pages per state — 25 orgs/page × 20 pages × 2 states = up to 1,000 orgs
const MAX_PAGES_PER_STATE = 20

async function makeUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug
  let count = 1
  while (true) {
    const existing = await db.query.orgs.findFirst({
      where: (orgs, { eq }) => eq(orgs.slug, slug)
    })
    if (!existing) return slug
    slug = `${baseSlug}-${count++}`
  }
}

function isRelevantNTEE(nteeCode: string | null): boolean {
  if (!nteeCode) return false
  return RELEVANT_NTEE_PREFIXES.some(prefix => nteeCode.startsWith(prefix))
}

async function ingest() {
  console.log('Starting ProPublica ingestion for MO + IL...')
  console.log(`Filtering for NTEE codes: ${RELEVANT_NTEE_PREFIXES.join(', ')}`)
  let inserted = 0
  let skipped = 0

  for (const state of STATES) {
    console.log(`\nFetching ${state}...`)
    let page = 0

    while (page < MAX_PAGES_PER_STATE) {
      const results = await fetchNonprofitsByState(state, page)
      if (results.length === 0) break

      for (const org of results) {
        if (!isRelevantNTEE(org.ntee_code)) {
          skipped++
          continue
        }

        try {
          const baseSlug = await slugify(org.name)
          const slug = await makeUniqueSlug(baseSlug)

          await db.insert(orgs).values({
            slug,
            name: org.name,
            org_types: ['nonprofit'],
            ntee_code: org.ntee_code,
            city: org.city,
            state: org.state,
            external_id: org.ein,
            source: 'propublica',
            verified: false,
          }).onConflictDoNothing()

          inserted++
        } catch (err) {
          console.error(`Failed to insert ${org.name}:`, err)
        }
      }

      console.log(`  Page ${page + 1}: +${results.filter(o => isRelevantNTEE(o.ntee_code)).length} relevant (${inserted} total inserted)`)

      // ProPublica rate limiting — be polite
      await new Promise(r => setTimeout(r, 500))
      page++
    }
  }

  console.log(`\nIngestion complete. Inserted: ${inserted} | Skipped (irrelevant NTEE): ${skipped}`)
  process.exit(0)
}

ingest().catch(console.error)
