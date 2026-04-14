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
  const { query, limit = 5, states, profile } = await req.json()

  if (!query) {
    return Response.json({ error: 'Query is required' }, { status: 400 })
  }

  try {
    const sql = neon(process.env.DATABASE_URL!)
    const embedding = await generateQueryEmbedding(query)
    const embeddingStr = JSON.stringify(embedding)

    // ── Org results (vector similarity) ──────────────────────────────────
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

    // ── Document results (vector similarity) ─────────────────────────────
    const documents = await sql`
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
      LIMIT 6
    `

    // ── Resource results (issue_area + org_type overlap) ─────────────────
    // Resources don't have embeddings, so we rank by overlap with the
    // profile's issue_areas and org_types, falling back to all resources.
    const profileIssues: string[] = profile?.issue_areas ?? []
    const profileTypes: string[]  = profile?.org_types  ?? []

    let resources
    if (profileIssues.length > 0 || profileTypes.length > 0) {
      resources = await sql`
        SELECT
          id, title, url, description, resource_type,
          relevant_org_types, issue_areas, is_local
        FROM resources
        WHERE deleted_at IS NULL
          AND (
            issue_areas        && ${profileIssues}::text[]
            OR relevant_org_types && ${profileTypes}::text[]
          )
        ORDER BY
          (
            COALESCE(array_length(
              ARRAY(SELECT unnest(issue_areas) INTERSECT SELECT unnest(${profileIssues}::text[])),
              1
            ), 0)
            +
            COALESCE(array_length(
              ARRAY(SELECT unnest(relevant_org_types) INTERSECT SELECT unnest(${profileTypes}::text[])),
              1
            ), 0)
          ) DESC
        LIMIT 6
      `
    } else {
      // No profile — return a broad set
      resources = await sql`
        SELECT id, title, url, description, resource_type,
               relevant_org_types, issue_areas, is_local
        FROM resources
        WHERE deleted_at IS NULL
        LIMIT 6
      `
    }

    return Response.json({ results, documents, resources })
  } catch (err) {
    console.error('Match error:', err)
    return Response.json({ error: 'Match failed' }, { status: 500 })
  }
}
