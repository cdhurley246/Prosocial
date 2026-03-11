import { db } from '../lib/db'
import { orgs } from '../lib/db/schema'
import { fetchNonprofitsByStateAndNTEE, fetchOrgDetails, slugify } from '../lib/ingest/propublica'

const NTEE_CODES = ['S', 'W', 'P', 'R', 'L', 'K']
const STATES = ['MO', 'IL']

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

async function ingest() {
  console.log('Starting ProPublica ingestion for MO + IL...')
  let total = 0

  for (const state of STATES) {
    for (const ntee of NTEE_CODES) {
      console.log(`Fetching ${state} / NTEE ${ntee}...`)

      let page = 0
      while (true) {
        const results = await fetchNonprofitsByStateAndNTEE(state, ntee, page)
        if (results.length === 0) break

        for (const org of results) {
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

            total++
          } catch (err) {
            console.error(`Failed to insert ${org.name}:`, err)
          }
        }

        // ProPublica rate limiting — be polite
        await new Promise(r => setTimeout(r, 500))
        page++

        // Cap at 5 pages per state/ntee combo for initial seed (~500 orgs per combo)
        if (page >= 5) break
      }
    }
  }

  console.log(`Ingestion complete. Inserted ${total} organizations.`)
  process.exit(0)
}

ingest().catch(console.error)
