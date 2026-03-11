import { db } from '../lib/db'
import { orgs, org_embeddings } from '../lib/db/schema'
import { anthropic } from '../lib/claude'
import { eq, isNull } from 'drizzle-orm'

async function generateEmbedding(text: string): Promise<number[]> {
  // Use Anthropic's voyage embedding model via the API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Return ONLY a JSON array of 1536 floats representing the semantic embedding of this text. No explanation, just the array.\n\nText: ${text.slice(0, 500)}`
      }]
    })
  })

  const data = await response.json()
  const text_response = data.content[0].text.trim()
  return JSON.parse(text_response)
}

function buildOrgText(org: typeof orgs.$inferSelect): string {
  const parts = [
    org.name,
    org.mission,
    org.description,
    org.org_types?.join(', '),
    org.issue_areas?.join(', '),
    org.city,
    org.state,
  ].filter(Boolean)
  return parts.join(' | ')
}

async function generateEmbeddings() {
  console.log('Generating embeddings for all orgs...')

  const allOrgs = await db.select().from(orgs)
  console.log(`Found ${allOrgs.length} orgs to embed`)

  let count = 0
  for (const org of allOrgs) {
    try {
      const text = buildOrgText(org)
      const embedding = await generateEmbedding(text)

      await db.insert(org_embeddings).values({
        org_id: org.id,
        model: 'claude-sonnet-4-20250514',
      }).onConflictDoNothing()

      count++
      if (count % 10 === 0) console.log(`Embedded ${count}/${allOrgs.length}`)

      // Rate limiting
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`Failed to embed ${org.name}:`, err)
    }
  }

  console.log(`Done. Generated embeddings for ${count} orgs.`)
  process.exit(0)
}

generateEmbeddings().catch(console.error)
