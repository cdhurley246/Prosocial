import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const sql = neon(process.env.DATABASE_URL!)

    // Accept either a UUID or a slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

    const rows = await sql`
      SELECT
        o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id',              d.id,
              'doc_type',        d.doc_type,
              'title',           d.title,
              'text_content',    d.text_content,
              'file_url',        d.file_url,
              'is_public',       d.is_public,
              'notable_clauses', d.notable_clauses
            )
          ) FILTER (WHERE d.id IS NOT NULL AND d.deleted_at IS NULL AND d.is_public = true),
          '[]'
        ) AS documents
      FROM orgs o
      LEFT JOIN documents d ON d.org_id = o.id
      WHERE ${isUuid ? sql`o.id = ${id}` : sql`o.slug = ${id}`}
        AND o.deleted_at IS NULL
      GROUP BY o.id
    `

    if (!rows[0]) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return Response.json(rows[0])
  } catch (err) {
    console.error('Org fetch error:', err)
    return Response.json({ error: 'Failed to fetch organization' }, { status: 500 })
  }
}
