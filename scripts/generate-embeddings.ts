import { db } from '../lib/db'
import { orgs, org_embeddings } from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// Free tier: 3 RPM, 10K TPM. Batch 20 orgs per request, sleep 21s between batches.
const BATCH_SIZE = 20
const DELAY_MS = 21_000

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-large-2',
      input: texts,
      input_type: 'document',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage API error ${response.status}: ${error}`)
  }

  const data = await response.json()
  // Sort by index to guarantee order matches input
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)
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
  console.log('Generating embeddings via Voyage AI (batched)...')

  const allOrgs = await db.select().from(orgs).limit(500)
  console.log(`Found ${allOrgs.length} orgs`)

  // Filter out orgs that already have embeddings
  const toEmbed: typeof allOrgs = []
  for (const org of allOrgs) {
    const existing = await db.select().from(org_embeddings)
      .where(eq(org_embeddings.org_id, org.id)).limit(1)
    if (existing.length === 0) toEmbed.push(org)
  }
  console.log(`${toEmbed.length} need embeddings, ${allOrgs.length - toEmbed.length} already done`)

  let count = 0
  const batches = Math.ceil(toEmbed.length / BATCH_SIZE)

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`\nBatch ${batchNum}/${batches} (${batch.length} orgs)...`)

    try {
      const texts = batch.map(buildOrgText)
      const embeddings = await generateEmbeddingsBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        await sql`
          INSERT INTO org_embeddings (org_id, embedding, model)
          VALUES (${batch[j].id}, ${JSON.stringify(embeddings[j])}::vector, 'voyage-large-2')
          ON CONFLICT DO NOTHING
        `
      }

      count += batch.length
      console.log(`  ✓ ${count}/${toEmbed.length} embedded`)
    } catch (err) {
      console.error(`  Batch ${batchNum} failed:`, err)
    }

    // Respect 3 RPM free-tier limit (skip delay after last batch)
    if (i + BATCH_SIZE < toEmbed.length) {
      console.log(`  Waiting ${DELAY_MS / 1000}s for rate limit...`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\nDone. Embedded ${count} orgs.`)
  process.exit(0)
}

generateEmbeddings().catch(console.error)
