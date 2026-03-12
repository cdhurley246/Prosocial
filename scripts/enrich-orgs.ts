/**
 * enrich-orgs.ts
 *
 * Fetches ProPublica Nonprofit Explorer detail records for each org in the DB
 * and backfills: founding_year, budget_range (from asset/income codes).
 *
 * Run with:
 *   npm run enrich
 *   (or: tsx --env-file .env.local scripts/enrich-orgs.ts)
 */

import { neon } from '@neondatabase/serverless'

const PROPUBLICA_BASE = 'https://projects.propublica.org/nonprofits/api/v2'

// IRS asset/income codes → human-readable budget range
const ASSET_CODE_MAP: Record<string, string> = {
  '1': '$0',
  '2': 'Under $10K',
  '3': '$10K – $25K',
  '4': '$25K – $100K',
  '5': '$100K – $500K',
  '6': '$500K – $1M',
  '7': '$1M – $5M',
  '8': '$5M – $10M',
  '9': '$10M+',
}

function budgetLabel(assetCode: string | null, revenueAmount: number | null): string | null {
  if (assetCode && ASSET_CODE_MAP[assetCode]) return ASSET_CODE_MAP[assetCode]
  if (revenueAmount != null) {
    if (revenueAmount === 0) return '$0'
    if (revenueAmount < 10_000) return 'Under $10K'
    if (revenueAmount < 25_000) return '$10K – $25K'
    if (revenueAmount < 100_000) return '$25K – $100K'
    if (revenueAmount < 500_000) return '$100K – $500K'
    if (revenueAmount < 1_000_000) return '$500K – $1M'
    if (revenueAmount < 5_000_000) return '$1M – $5M'
    if (revenueAmount < 10_000_000) return '$5M – $10M'
    return '$10M+'
  }
  return null
}

function foundingYear(rulingDate: string | null): number | null {
  if (!rulingDate) return null
  const year = parseInt(rulingDate.slice(0, 4), 10)
  return isNaN(year) || year < 1800 || year > new Date().getFullYear() ? null : year
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchOrgDetails(ein: string) {
  const url = `${PROPUBLICA_BASE}/organizations/${ein}.json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.organization || null
}

async function enrich() {
  const sql = neon(process.env.DATABASE_URL!)

  // Get all orgs that have an EIN and haven't been enriched yet
  const orgs = await sql`
    SELECT id, name, external_id, founding_year, budget_range
    FROM orgs
    WHERE external_id IS NOT NULL
      AND deleted_at IS NULL
    ORDER BY name
  `

  console.log(`\nEnriching ${orgs.length} orgs from ProPublica...\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    const pct = Math.round(((i + 1) / orgs.length) * 100)

    try {
      const details = await fetchOrgDetails(org.external_id as string)

      if (!details) {
        console.log(`  [${pct}%] ${org.name} — not found`)
        failed++
        await sleep(500)
        continue
      }

      const newFoundingYear = foundingYear(details.ruling_date)
      const newBudgetRange = budgetLabel(
        details.asset_code?.toString() ?? null,
        details.revenue_amount ? Number(details.revenue_amount) : null
      )

      // Only update fields that are currently null and we now have data for
      const updates: string[] = []
      if (newFoundingYear && !org.founding_year) updates.push(`founding_year=${newFoundingYear}`)
      if (newBudgetRange && !org.budget_range) updates.push(`budget_range`)

      if (newFoundingYear || newBudgetRange) {
        await sql`
          UPDATE orgs SET
            founding_year = COALESCE(founding_year, ${newFoundingYear}),
            budget_range  = COALESCE(budget_range,  ${newBudgetRange}),
            updated_at    = NOW()
          WHERE id = ${org.id as string}
        `
        console.log(`  [${pct}%] ✓ ${org.name} — year: ${newFoundingYear ?? '—'}, budget: ${newBudgetRange ?? '—'}`)
        updated++
      } else {
        console.log(`  [${pct}%] — ${org.name} — no new data`)
        skipped++
      }
    } catch (err) {
      console.error(`  [${pct}%] ✗ ${org.name}:`, err)
      failed++
    }

    // Be polite to ProPublica — 1 request per second
    await sleep(1000)
  }

  console.log(`\n─────────────────────────────────`)
  console.log(`Enrichment complete.`)
  console.log(`  Updated:  ${updated}`)
  console.log(`  No data:  ${skipped}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`─────────────────────────────────\n`)
  process.exit(0)
}

enrich().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
