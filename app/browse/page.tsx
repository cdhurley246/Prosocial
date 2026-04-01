export const dynamic = 'force-dynamic'

import Nav from '@/components/Nav'
import { neon } from '@neondatabase/serverless'
import BrowseClient from './BrowseClient'

interface Org {
  id: string
  slug: string
  name: string
  mission: string | null
  org_types: string[] | null
  issue_areas: string[] | null
  city: string | null
  state: string | null
}

export default async function BrowsePage() {
  const sql = neon(process.env.DATABASE_URL!)

  const orgs = await sql`
    SELECT id, slug, name, mission, org_types, issue_areas, city, state
    FROM orgs
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  ` as Org[]

  return (
    <>
      <Nav />
      <BrowseClient orgs={orgs} />
    </>
  )
}
