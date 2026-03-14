import { db } from '../lib/db'
import { orgs } from '../lib/db/schema'

async function seedModelOrg() {
  console.log('Seeding model org...')

  await db.insert(orgs).values({
    slug: 'model-templates',
    name: 'Model & Template Documents',
    org_types: ['template'],
    issue_areas: ['cooperative_law', 'nonprofit_law', 'governance'],
    mission: 'A curated collection of model bylaws, operating agreements, and legal templates from trusted open-license sources including DAWI, SELC, and the University of Wisconsin Center for Cooperatives. These are starting points — not legal advice.',
    description: 'Publicly available legal templates for worker cooperatives, nonprofits, housing cooperatives, and other democratic organizations. Published under open licenses.',
    city: 'National',
    state: 'MO',
    source: 'manual',
    verified: true,
  }).onConflictDoNothing()

  console.log('Done.')
  process.exit(0)
}

seedModelOrg().catch(console.error)
