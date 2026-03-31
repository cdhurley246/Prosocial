'use strict';

// ============================================================================
// Common Crawl enrichment PoC — end-to-end test for worker co-op URLs
// Run: node --env-file=.env.local lib/pipeline/crawl-poc.js
//      OR: npx tsx --env-file=.env.local lib/pipeline/crawl-poc.js
// ============================================================================

const { promisify } = require('util');
const { gunzip } = require('zlib');
const fs = require('fs');
const path = require('path');

// Load .env.local if running directly (tsx --env-file handles this too)
try {
  require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
} catch {
  // dotenv optional if env vars are already set
}

// Anthropic SDK — supports CJS require
const AnthropicModule = require('@anthropic-ai/sdk');
const Anthropic = AnthropicModule.default ?? AnthropicModule;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const gunzipAsync = promisify(gunzip);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CDX_INDEX = 'CC-MAIN-2024-10';
const CC_BASE = 'https://data.commoncrawl.org';
const MAX_TEXT_CHARS = 8000;
const OUTPUT_PATH = path.join(__dirname, 'crawl-poc-results.json');

// ---------------------------------------------------------------------------
// Geographic filter — set to an array of state codes to limit output,
// or null to include all orgs.
// Example: ['MO', 'IL'] or ['WI'] or null
// ---------------------------------------------------------------------------

const FILTER_STATES = null; // set to e.g. ['IL', 'MO'] to filter

// ---------------------------------------------------------------------------
// Input: worker co-op URLs across the Midwest
// Sources: USFWC member directory, DAWI co-op map, IWCA, state co-op associations
// Each entry: { url, state, note }
// ---------------------------------------------------------------------------

const COOP_URLS = [
  // Illinois
  { url: 'https://chifreshkitchen.com',            state: 'IL', note: 'ChiFresh Kitchen — food/catering, formerly incarcerated workers (Chicago)' },
  { url: 'https://newerawindows.com',              state: 'IL', note: 'New Era Windows — manufacturing co-op (Chicago)' },
  { url: 'https://chicommons.coop',                state: 'IL', note: 'ChiCommons — co-op tech & business services (Chicago)' },
  { url: 'https://cooperationracine.com',          state: 'IL', note: 'Cooperation Racine — disability justice co-op' },
  { url: 'https://centrodetrabajadoresunidos.org', state: 'IL', note: 'Centro de Trabajadores Unidos — worker co-op incubator (Chicago)' },
  { url: 'https://newprairieconstruction.com',     state: 'IL', note: 'New Prairie Construction — worker-owned construction (Urbana)' },

  // Missouri
  { url: 'https://manaiacollective.com',           state: 'MO', note: 'Manaia Collective — worker-owned restaurant group (Kansas City)' },
  { url: 'https://communitywealth.wustl.edu',      state: 'MO', note: 'WashU Brown School — co-op development support (St. Louis)' },

  // Wisconsin
  { url: 'https://union-cab.com',                  state: 'WI', note: 'Union Cab — worker-owned taxi co-op (Madison)' },
  { url: 'https://isthmuseng.com',                 state: 'WI', note: 'Isthmus Engineering — precision manufacturing co-op (Madison)' },
  { url: 'https://justcoffee.coop',                state: 'WI', note: 'Just Coffee — fair trade worker co-op (Madison)' },
  { url: 'https://swannconsulting.net',            state: 'WI', note: 'Swann Consulting — worker co-op (Milwaukee)' },

  // Minnesota
  { url: 'https://northcountryfoodalliance.org',   state: 'MN', note: 'North Country Food Alliance — food systems co-op (Minneapolis)' },
  { url: 'https://minutemanpress.com',             state: 'MN', note: 'Agate Housing & Services — (placeholder, swap if better MN co-op found)' },
  { url: 'https://selbyavejazz.com',               state: 'MN', note: 'Selby Jazz — arts worker co-op (St. Paul)' },

  // Ohio
  { url: 'https://evergreencoop.com',              state: 'OH', note: 'Evergreen Cooperatives — network of worker co-ops (Cleveland)' },
  { url: 'https://cincinnatibagelry.com',          state: 'OH', note: 'Cincinnati Bagelry — worker-owned food (Cincinnati)' },

  // Michigan
  { url: 'https://localsprintshop.com',            state: 'MI', note: 'Local Sprintshop — worker-owned print shop (Ann Arbor)' },
  { url: 'https://people.coop',                    state: 'MI', note: 'People\'s Food Co-op — worker co-op (Ann Arbor/Kalamazoo)' },
];

// ---------------------------------------------------------------------------
// Step 1: CDX Lookup
// ---------------------------------------------------------------------------

/**
 * Query the Common Crawl CDX API for recent crawls of a domain.
 * Returns an array of CDX records (may be empty if not crawled).
 */
async function cdxLookup(websiteUrl) {
  const domain = websiteUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  const query = new URLSearchParams({
    url: `${domain}/*`,
    output: 'json',
    limit: '5',
    fl: 'url,filename,offset,length,status,mime,timestamp',
    filter: 'status:200',
  });

  const res = await fetch(
    `https://index.commoncrawl.org/${CDX_INDEX}-index?${query}`
  );

  if (res.status === 404 || res.status === 204) return [];
  if (!res.ok) throw new Error(`CDX API error ${res.status} for ${domain}`);

  const text = await res.text();
  const records = [];

  for (const line of text.trim().split('\n')) {
    if (!line) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // skip malformed JSON lines
    }
  }

  return records;
}

// Priority path segments — pages more likely to contain mission/services info
const PRIORITY_PATHS = ['about', 'mission', 'programs', 'services', 'team', 'history', 'who-we-are', 'what-we-do'];

/**
 * Pick the highest-value page from CDX results.
 * Prefers mission/about pages; falls back to the first result (usually homepage).
 */
function pickBestRecord(records) {
  if (!records.length) return null;
  const priority = records.find(r =>
    PRIORITY_PATHS.some(p => (r.url ?? '').toLowerCase().includes(`/${p}`))
  );
  return priority ?? records[0];
}

// ---------------------------------------------------------------------------
// Step 2: WET Text Fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a specific byte range from a Common Crawl WARC file, decompress it,
 * and return stripped plain text.
 */
async function fetchPageText(filename, offset, length) {
  const res = await fetch(`${CC_BASE}/${filename}`, {
    headers: { Range: `bytes=${offset}-${offset + length - 1}` },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching byte range from ${filename}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const decompressed = await gunzipAsync(buffer);
  const raw = decompressed.toString('utf-8');

  return extractWarcText(raw);
}

/**
 * Parse a WARC response record and return plain text body content.
 *
 * WARC record structure:
 *   WARC header lines
 *   \r\n\r\n
 *   HTTP response status + headers
 *   \r\n\r\n
 *   HTML body
 */
function extractWarcText(warc) {
  const warcEnd = warc.indexOf('\r\n\r\n');
  if (warcEnd === -1) return '';

  const afterWarc = warc.slice(warcEnd + 4);
  const httpEnd = afterWarc.indexOf('\r\n\r\n');
  if (httpEnd === -1) return '';

  const html = afterWarc.slice(httpEnd + 4);
  return stripHtml(html).slice(0, MAX_TEXT_CHARS);
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Step 3: Claude Extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract structured information from worker cooperative website text.
Respond ONLY with valid JSON — no markdown, no explanation, no code fences.`;

const USER_TEMPLATE = (url, text) => `Website URL: ${url}

Website text:
${text}

Extract the following fields as a JSON object. Use null for any field you cannot determine — do not guess.

{
  "name": "string",
  "mission": "string, 1-2 sentences",
  "sector": "string, e.g. food retail, home care, design, manufacturing",
  "services": ["array of strings"],
  "population_served": "string",
  "geographic_focus": "string",
  "worker_owner_count": "number or null",
  "founding_year": "number or null",
  "governance_notes": "string or null",
  "website_url": "string"
}`;

/**
 * Send extracted text to Claude and return structured enrichment fields.
 */
async function extractWithClaude(url, text) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_TEMPLATE(url, text) }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected non-text response from Claude');

  return JSON.parse(content.text);
}

// ---------------------------------------------------------------------------
// Step 4: Pipeline runner
// ---------------------------------------------------------------------------

async function processUrl({ url, state, note }) {
  console.log(`\n[→] ${url} (${state})`);

  const result = {
    url,
    state,
    coverage: false,
    crawl_timestamp: null,
    extracted: null,
    error: null,
  };

  try {
    // 1. CDX Lookup
    const records = await cdxLookup(url);

    if (!records.length) {
      console.log(`    no CDX coverage in ${CDX_INDEX}`);
      return result;
    }

    result.coverage = true;
    const record = pickBestRecord(records);
    result.crawl_timestamp = record.timestamp ?? null;
    console.log(`    CDX hit: ${record.url}  (ts: ${record.timestamp})`);

    // 2. Fetch and decompress WARC byte range
    const offset = parseInt(record.offset, 10);
    const length = parseInt(record.length, 10);
    const text = await fetchPageText(record.filename, offset, length);

    if (!text.trim()) {
      result.error = 'Empty text after WARC extraction';
      console.log(`    empty text after extraction`);
      return result;
    }

    console.log(`    text: ${text.length} chars`);

    // 3. Claude extraction
    result.extracted = await extractWithClaude(url, text);
    console.log(`    extracted: ${result.extracted?.name ?? '(no name field)'}`);
  } catch (err) {
    result.error = err.message;
    console.error(`    error: ${err.message}`);
  }

  return result;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Set it or run with --env-file=.env.local');
    process.exit(1);
  }

  const filtered = FILTER_STATES
    ? COOP_URLS.filter(org => FILTER_STATES.includes(org.state))
    : COOP_URLS;

  console.log('Common Crawl enrichment PoC');
  console.log(`CDX index:  ${CDX_INDEX}`);
  console.log(`Filter:     ${FILTER_STATES ? FILTER_STATES.join(', ') : 'all states'}`);
  console.log(`URLs:       ${filtered.length} / ${COOP_URLS.length} total`);
  console.log(`Output:     ${OUTPUT_PATH}`);

  const results = [];

  for (const org of filtered) {
    const result = await processUrl(org);
    results.push(result);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  const covered = results.filter(r => r.coverage).length;
  const extracted = results.filter(r => r.extracted).length;
  const errors = results.filter(r => r.error).length;

  console.log('\n--- Summary ---');
  console.log(`Total:     ${results.length}`);
  console.log(`Covered:   ${covered} / ${results.length}`);
  console.log(`Extracted: ${extracted} / ${covered}`);
  console.log(`Errors:    ${errors}`);
  console.log(`\nResults written to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
