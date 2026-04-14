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
  const { query, limit = 5, states } = await req.json()

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const embedding = await generateQueryEmbedding(query)
    const embeddingStr = JSON.stringify(embedding)

    const results = (states?.length)
      ? await sql`
          SELECT
            o.id, o.slug, o.name, o.mission, o.description,
            o.org_types, o.issue_areas, o.city, o.state, o.website, o.ntee_code, o.is_demo,
            1 - (oe.embedding <=> ${embeddingStr}::vector) as similarity
          FROM orgs o
          JOIN org_embeddings oe ON o.id = oe.org_id
          WHERE o.deleted_at IS NULL
            AND o.state = ANY(${states}::text[])
          ORDER BY oe.embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `
      : await sql`
          SELECT
            o.id, o.slug, o.name, o.mission, o.description,
            o.org_types, o.issue_areas, o.city, o.state, o.website, o.ntee_code, o.is_demo,
            1 - (oe.embedding <=> ${embeddingStr}::vector) as similarity
          FROM orgs o
          JOIN org_embeddings oe ON o.id = oe.org_id
          WHERE o.deleted_at IS NULL
          ORDER BY oe.embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}
        `

    const docResults = await sql`
      SELECT
        d.id,
        d.title,
        d.doc_type,
        d.file_url,
        d.notable_clauses,
        o.name as source_name
      FROM documents d
      JOIN orgs o ON d.org_id = o.id
      JOIN doc_embeddings de ON d.id = de.doc_id
      WHERE d.is_public = true
        AND d.deleted_at IS NULL
      ORDER BY de.embedding <=> ${embeddingStr}::vector
      LIMIT 4
    `

    return Response.json({ results, documents: docResults })
  } catch (err) {
    console.error('Match error:', err)
    return Response.json({ error: 'Match failed' }, { status: 500 })
  }
}
