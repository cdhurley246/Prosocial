import { db } from '../lib/db'
import { documents } from '../lib/db/schema'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// Same rate-limit as org embeddings: 3 RPM free tier
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
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding)
}

function buildDocText(doc: typeof documents.$inferSelect): string {
  return [
    doc.title,
    doc.doc_type,
    doc.notable_clauses?.join(', '),
    // First 3000 chars of extracted text gives enough signal without hitting token limits
    doc.text_content?.slice(0, 3000),
  ].filter(Boolean).join(' | ')
}

async function generateDocEmbeddings() {
  console.log('Generating document embeddings via Voyage AI (batched)...')

  const allDocs = await db.select().from(documents)
  console.log(`Found ${allDocs.length} documents`)

  // Filter to those without embeddings yet
  const toEmbed: typeof allDocs = []
  for (const doc of allDocs) {
    const existing = await sql`
      SELECT id FROM doc_embeddings WHERE doc_id = ${doc.id} LIMIT 1
    `
    if (existing.length === 0) toEmbed.push(doc)
  }
  console.log(`${toEmbed.length} need embeddings, ${allDocs.length - toEmbed.length} already done`)

  let count = 0
  const batches = Math.ceil(toEmbed.length / BATCH_SIZE)

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`\nBatch ${batchNum}/${batches} (${batch.length} docs)...`)

    try {
      const texts = batch.map(buildDocText)
      const embeddings = await generateEmbeddingsBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        await sql`
          INSERT INTO doc_embeddings (doc_id, embedding, model)
          VALUES (${batch[j].id}, ${JSON.stringify(embeddings[j])}::vector, 'voyage-large-2')
          ON CONFLICT DO NOTHING
        `
      }

      count += batch.length
      console.log(`  ✓ ${count}/${toEmbed.length} embedded`)
    } catch (err) {
      console.error(`  Batch ${batchNum} failed:`, err)
    }

    if (i + BATCH_SIZE < toEmbed.length) {
      console.log(`  Waiting ${DELAY_MS / 1000}s for rate limit...`)
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  console.log(`\nDone. Embedded ${count} documents.`)
  process.exit(0)
}

generateDocEmbeddings().catch(console.error)
