import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const sql = neon(process.env.DATABASE_URL!)

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `Return ONLY a valid JSON array of exactly 1536 numbers between -1 and 1, representing a semantic embedding of this text. No explanation, no markdown, just the raw JSON array.

Text: "${query.slice(0, 400)}"`
    }]
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  try {
    return JSON.parse(raw)
  } catch {
    return new Array(1536).fill(0)
  }
}

export async function POST(req: NextRequest) {
  const { query, limit = 5 } = await req.json()

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const embedding = await generateQueryEmbedding(query)
    const embeddingStr = JSON.stringify(embedding)

    // Vector similarity search using pgvector cosine distance
    const results = await sql`
      SELECT
        o.id,
        o.slug,
        o.name,
        o.mission,
        o.description,
        o.org_types,
        o.issue_areas,
        o.city,
        o.state,
        o.website,
        o.ntee_code,
        1 - (oe.embedding <=> ${embeddingStr}::vector) as similarity
      FROM orgs o
      JOIN org_embeddings oe ON o.id = oe.org_id
      WHERE o.deleted_at IS NULL
      ORDER BY oe.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `

    return Response.json({ results })
  } catch (err) {
    console.error('Match error:', err)
    return Response.json({ error: 'Match failed' }, { status: 500 })
  }
}
