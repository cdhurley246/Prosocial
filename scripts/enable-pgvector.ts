import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Enabling pgvector extension...')
  await sql`CREATE EXTENSION IF NOT EXISTS vector`
  console.log('✓ pgvector enabled')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
