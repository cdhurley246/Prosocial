import { config } from 'dotenv'
config({ path: '.env.local' })

import { db } from '../lib/db'
import { orgs, org_embeddings } from '../lib/db/schema'
import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const sql = neon(process.env.DATABASE_URL!)

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `Return ONLY a valid JSON array of exactly 1536 numbers between -1 and 1, representing a semantic embedding of this text. No explanation, no markdown, just the raw JSON array.

Text: "${text.slice(0, 400)}"`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  try {
    return JSON.parse(raw)
  } catch {
    console.error('Failed to parse embedding response:', raw.slice(0, 100))
    // Return a zero vector as fallback
    return new Array(1536).fill(0)
  }
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
  console.log('Generating embeddings for all orgs...')

  // Get orgs that don't have embeddings yet
  const allOrgs = await db.select().from(orgs).limit(500)
  console.log(`Found ${allOrgs.length} orgs to process`)

  let count = 0
  let skipped = 0

  for (const org of allOrgs) {
    try {
      // Check if embedding already exists
      const existing = await db.select().from(org_embeddings)
        .where(eq(org_embeddings.org_id, org.id))
        .limit(1)

      if (existing.length > 0) {
        skipped++
        continue
      }

      const text = buildOrgText(org)
      const embedding = await generateEmbedding(text)

      // Insert directly via raw SQL to handle the vector type
      await sql`
        INSERT INTO org_embeddings (org_id, embedding, model)
        VALUES (${org.id}, ${JSON.stringify(embedding)}::vector, 'claude-haiku')
        ON CONFLICT DO NOTHING
      `

      count++
      if (count % 10 === 0) console.log(`Embedded ${count} orgs (skipped ${skipped})...`)

      // Rate limiting — be gentle with the API
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`Failed to embed ${org.name}:`, err)
    }
  }

  console.log(`Done. Generated ${count} embeddings, skipped ${skipped} existing.`)
  process.exit(0)
}

generateEmbeddings().catch(console.error)
