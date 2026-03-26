import {
  pgTable, text, boolean, timestamp, integer,
  jsonb, uuid, index, customType
} from 'drizzle-orm/pg-core'

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)'
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value)
  },
  fromDriver(value: string): number[] {
    if (typeof value === 'string') {
      return JSON.parse(value.replace('[', '[').replace(']', ']'))
    }
    return value as unknown as number[]
  },
})

// ─── ORGANIZATIONS ───────────────────────────────────────────

export const orgs = pgTable('orgs', {
  id:               uuid('id').primaryKey().defaultRandom(),
  slug:             text('slug').notNull().unique(),
  name:             text('name').notNull(),

  // Classification
  org_types:        text('org_types').array(),
  ntee_code:        text('ntee_code'),
  issue_areas:      text('issue_areas').array(),
  legal_structure:  text('legal_structure'),
  governance_model: text('governance_model'),

  // Details
  mission:          text('mission'),
  description:      text('description'),
  founding_year:    integer('founding_year'),
  size_staff:       integer('size_staff'),
  size_members:     integer('size_members'),
  budget_range:     text('budget_range'),

  // Location
  city:             text('city'),
  state:            text('state'),
  county:           text('county'),

  // Contact
  website:          text('website'),
  email:            text('email'),
  phone:            text('phone'),

  // Data provenance
  source:           text('source'),
  external_id:      text('external_id'),
  verified:         boolean('verified').default(false),

  // Common Crawl enrichment
  crawl_coverage:   text('crawl_coverage'),

  // Soft delete + timestamps
  deleted_at:       timestamp('deleted_at'),
  created_at:       timestamp('created_at').defaultNow(),
  updated_at:       timestamp('updated_at').defaultNow(),
}, (table) => ({
  stateIdx: index('orgs_state_idx').on(table.state),
  slugIdx:  index('orgs_slug_idx').on(table.slug),
}))

// ─── ORG EMBEDDINGS ──────────────────────────────────────────
// Note: vector column added manually via Neon SQL editor after enabling pgvector
// ALTER TABLE org_embeddings ADD COLUMN embedding vector(1536);
// CREATE INDEX ON org_embeddings USING hnsw (embedding vector_cosine_ops);

export const org_embeddings = pgTable('org_embeddings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  org_id:     uuid('org_id').references(() => orgs.id).notNull(),
  embedding:  vector('embedding').notNull(),
  model:      text('model').default('claude'),
  created_at: timestamp('created_at').defaultNow(),
})

// ─── DOCUMENTS ───────────────────────────────────────────────

export const documents = pgTable('documents', {
  id:               uuid('id').primaryKey().defaultRandom(),
  org_id:           uuid('org_id').references(() => orgs.id).notNull(),
  doc_type:         text('doc_type'),
  title:            text('title'),
  text_content:     text('text_content'),
  file_url:         text('file_url'),
  is_public:        boolean('is_public').default(false),
  notable_clauses:  text('notable_clauses').array(),
  deleted_at:       timestamp('deleted_at'),
  created_at:       timestamp('created_at').defaultNow(),
})

// ─── DOCUMENT EMBEDDINGS ─────────────────────────────────────
// Note: table + vector column created via Neon SQL editor:
// CREATE TABLE doc_embeddings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), doc_id UUID NOT NULL REFERENCES documents(id), embedding vector(1536), model TEXT DEFAULT 'voyage-large-2', created_at TIMESTAMPTZ DEFAULT NOW());
// CREATE INDEX ON doc_embeddings USING hnsw (embedding vector_cosine_ops);

export const doc_embeddings = pgTable('doc_embeddings', {
  id:         uuid('id').primaryKey().defaultRandom(),
  doc_id:     uuid('doc_id').references(() => documents.id).notNull(),
  embedding:  vector('embedding').notNull(),
  model:      text('model').default('voyage-large-2'),
  created_at: timestamp('created_at').defaultNow(),
})

// ─── RESOURCES ───────────────────────────────────────────────

export const resources = pgTable('resources', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  title:                text('title').notNull(),
  url:                  text('url').notNull(),
  description:          text('description'),
  resource_type:        text('resource_type'),
  relevant_org_types:   text('relevant_org_types').array(),
  issue_areas:          text('issue_areas').array(),
  is_local:             boolean('is_local').default(false),
  deleted_at:           timestamp('deleted_at'),
  created_at:           timestamp('created_at').defaultNow(),
})

// ─── CRAWL ENRICHMENTS ───────────────────────────────────────

export const crawl_enrichments = pgTable('crawl_enrichments', {
  id:               uuid('id').primaryKey().defaultRandom(),
  org_id:           uuid('org_id').references(() => orgs.id).notNull(),
  raw_text:         text('raw_text'),
  extracted_fields: jsonb('extracted_fields'),
  crawled_at:       timestamp('crawled_at').defaultNow(),
  created_at:       timestamp('created_at').defaultNow(),
})

// ─── INTAKE SESSIONS ─────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  messages:          jsonb('messages').notNull(),
  extracted_profile: jsonb('extracted_profile'),
  match_results:     jsonb('match_results'),
  user_left_info:    boolean('user_left_info').default(false),
  contact_info:      jsonb('contact_info'),
  created_at:        timestamp('created_at').defaultNow(),
})

// ─── USERS ───────────────────────────────────────────────────

export const users = pgTable('users', {
  id:         uuid('id').primaryKey().defaultRandom(),
  email:      text('email').notNull().unique(),
  name:       text('name'),
  image:      text('image'),
  role:       text('role').default('user'),
  created_at: timestamp('created_at').defaultNow(),
})

// ─── SAVED RESULTS ───────────────────────────────────────────

export const saved_results = pgTable('saved_results', {
  id:         uuid('id').primaryKey().defaultRandom(),
  user_id:    uuid('user_id').references(() => users.id).notNull(),
  session_id: uuid('session_id').references(() => sessions.id).notNull(),
  label:      text('label'),
  created_at: timestamp('created_at').defaultNow(),
})

// ─── SAVED RESOURCES ─────────────────────────────────────────

export const saved_resources = pgTable('saved_resources', {
  id:          uuid('id').primaryKey().defaultRandom(),
  user_id:     uuid('user_id').references(() => users.id).notNull(),
  resource_id: uuid('resource_id').references(() => resources.id).notNull(),
  created_at:  timestamp('created_at').defaultNow(),
})
