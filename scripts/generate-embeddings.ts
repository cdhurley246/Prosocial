import { db } from '../lib/db'
import { orgs, org_embeddings } from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-large-2',
      input: [text.slice(0, 4000)],
      input_type: 'document',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage API error ${response.status}: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

function buildOrgText(org: typeof orgs.$inferSelect): string {
  return [
    org.name,
    org.mission,
    org.description,
    org.org_types?.join(', '),
    org.issue_areas?.join(', '),
    org.ntee_code,
    org.city,
    org.state,
  ].filter(Boolean).join(' | ')
}

async function generateEmbeddings() {
  console.log('Generating embeddings via Voyage AI...')

  const allOrgs = await db.select().from(orgs).limit(500)
  console.log(`Found ${allOrgs.length} orgs to process`)

  let count = 0
  let skipped = 0

  for (const org of allOrgs) {
    try {
      const existing = await db.select().from(org_embeddings)
        .where(eq(org_embeddings.org_id, org.id))
        .limit(1)

      if (existing.length > 0) {
        skipped++
        continue
      }

      const text = buildOrgText(org)
      const embedding = await generateEmbedding(text)

      await sql`
        INSERT INTO org_embeddings (org_id, embedding, model)
        VALUES (${org.id}, ${JSON.stringify(embedding)}::vector, 'voyage-large-2')
        ON CONFLICT DO NOTHING
      `

      count++
      if (count % 10 === 0) console.log(`Embedded ${count} orgs (skipped ${skipped} existing)...`)

      // Voyage AI rate limit: ~300 RPM on free tier
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`Failed to embed ${org.name}:`, err)
    }
  }

  console.log(`\nDone. Generated ${count} embeddings, skipped ${skipped} existing.`)
  process.exit(0)
}

generateEmbeddings().catch(console.error)
