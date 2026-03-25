import { neon } from '@neondatabase/serverless'

const PROPUBLICA_BASE = 'https://projects.propublica.org/nonprofits/api/v2'

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchWebsite(ein: string): Promise<string | null> {
  const res = await fetch(`${PROPUBLICA_BASE}/organizations/${ein}.json`)
  if (!res.ok) return null
  const data = await res.json()
  const url: string | null = data.organization?.website ?? null
  if (!url || url.trim() === '') return null
  // Normalize: ensure it starts with http
  return url.startsWith('http') ? url.trim() : `https://${url.trim()}`
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  const orgs = await sql`
    SELECT id, name, external_id
    FROM orgs
    WHERE external_id IS NOT NULL
      AND website IS NULL
      AND deleted_at IS NULL
    ORDER BY name
  `

  console.log(`Backfilling websites for ${orgs.length} orgs...\n`)

  let updated = 0, skipped = 0, failed = 0

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    const pct = Math.round(((i + 1) / orgs.length) * 100)

    try {
      const website = await fetchWebsite(org.external_id as string)

      if (website) {
        await sql`UPDATE orgs SET website = ${website}, updated_at = NOW() WHERE id = ${org.id as string}`
        console.log(`  [${pct}%] ✓ ${org.name} — ${website}`)
        updated++
      } else {
        console.log(`  [${pct}%] — ${org.name} — no website`)
        skipped++
      }
    } catch (err) {
      console.error(`  [${pct}%] ✗ ${org.name}:`, err)
      failed++
    }

    await sleep(1000)
  }

  console.log(`\nDone. updated=${updated} no_website=${skipped} failed=${failed}`)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
