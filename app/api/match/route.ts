import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'voyage-large-2',
      input: [query.slice(0, 4000)],
      input_type: 'query',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Voyage API error ${response.status}: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function POST(req: NextRequest) {
  const { query, limit = 5 } = await req.json()

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const embedding = await generateQueryEmbedding(query)
    const embeddingStr = JSON.stringify(embedding)

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
