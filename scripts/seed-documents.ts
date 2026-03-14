import { db } from '../lib/db'
import { documents, orgs } from '../lib/db/schema'
import { eq } from 'drizzle-orm'
import pdf from 'pdf-parse'

const DOCUMENTS = [
  {
    title: 'ICA Group Model Bylaws for Worker Cooperatives',
    url: 'https://institute.coop/sites/default/files/ica-model-bylaws.pdf',
    doc_type: 'bylaws',
    notable_clauses: ['democratic_governance', 'internal_capital_accounts', 'membership', 'board_of_directors'],
    description: 'Model bylaws for cooperative corporations. Developed by the ICA Group. Works for C-corps, S-corps, and single or multiple classes of shares.',
  },
  {
    title: 'California Model Worker Co-op Bylaws (SELC/EBCLC)',
    url: 'https://institute.coop/sites/default/files/SampleWorkerCooperativeBylaws.pdf',
    doc_type: 'bylaws',
    notable_clauses: ['consensus_decision_making', 'democratic_governance', 'membership', 'profit_sharing'],
    description: 'Sample bylaws prepared by SELC and East Bay Community Law Center. Includes modified consensus-based decision making provisions.',
  },
  {
    title: 'LLC with Permanent Capital Member — Sample Operating Agreement',
    url: 'https://institute.coop/sites/default/files/Model_LLC_Agreement_PermanentCapitalMember.pdf',
    doc_type: 'operating_agreement',
    notable_clauses: ['retained_earnings', 'capital_structure', 'membership', 'democratic_governance'],
    description: 'Operating agreement for a worker-owned LLC with a permanent capital member. Allows the LLC to retain earnings while maintaining cooperative tax treatment.',
  },
  {
    title: 'LLC Taxed as T-Corporation — Sample Operating Agreement',
    url: 'https://institute.coop/sites/default/files/LLC%20Taxed%20as%20a%20T%20Corp.pdf',
    doc_type: 'operating_agreement',
    notable_clauses: ['tax_structure', 'democratic_governance', 'membership', 'capital_structure'],
    description: 'Sample operating agreement for an LLC taxed as a T-corp. Adapts ICA Group Model Bylaws for the LLC structure.',
  },
  {
    title: 'Guide to Worker Cooperative Bylaws and Operating Agreements',
    url: 'https://institute.coop/sites/default/files/BylawsandOAs.pdf',
    doc_type: 'legal_guide',
    notable_clauses: ['governance_overview', 'entity_comparison', 'membership', 'capital'],
    description: 'How-to guide explaining what to include in cooperative governing documents. Compares entity types and explains key governance decisions.',
  },
  {
    title: 'EB PREC Housing Cooperative Bylaws (Real Example, 2018)',
    url: 'https://storage.googleapis.com/wzukusers/user-22872016/documents/5c1c13becd05czJWwWae/Adopted%20EB%20PREC%20Bylaws%20Dec%202018.pdf',
    doc_type: 'bylaws',
    notable_clauses: ['housing_coop', 'community_land_trust', 'democratic_governance', 'anti_displacement'],
    description: 'Adopted bylaws of East Bay Permanent Real Estate Cooperative. A real-world example of bylaws for a community-owned housing cooperative focused on anti-displacement.',
  },
  {
    title: 'EB PREC Articles of Incorporation (Real Example)',
    url: 'https://storage.googleapis.com/wzukusers/user-22872016/documents/5c196314930efpBdXOl9/Articles%20of%20Incorporation.pdf',
    doc_type: 'articles_of_incorporation',
    notable_clauses: ['housing_coop', 'community_benefit', 'dissolution_clause'],
    description: 'Articles of incorporation for East Bay Permanent Real Estate Cooperative. Real-world example of articles for a community-owned housing co-op.',
  },
  {
    title: 'People Power Solar Cooperative Bylaws',
    url: 'https://d3n8a8pro7vhmx.cloudfront.net/peoplepowersolar/pages/22/attachments/original/1545838477/People_Power_Bylaws_2018.pdf?1545838477',
    doc_type: 'bylaws',
    notable_clauses: ['energy_coop', 'democratic_governance', 'membership', 'community_benefit'],
    description: 'Bylaws of People Power Solar Cooperative. Useful model for community-owned energy, utility, or multi-stakeholder cooperatives.',
  },
  {
    title: 'Sample Cooperative Bylaws with Outline (UW)',
    url: 'https://resources.uwcc.wisc.edu/Legal/SampleBylaws.pdf',
    doc_type: 'bylaws',
    notable_clauses: ['membership', 'board_of_directors', 'democratic_governance', 'patronage'],
    description: 'Sample bylaws with detailed section outline from the University of Wisconsin Center for Cooperatives. Good general-purpose cooperative bylaws template.',
  },
  {
    title: 'Guidelines and Sample Bylaw Language for Multi-Stakeholder Cooperatives',
    url: 'https://www.icdc.coop/wp-content/uploads/2021/03/Guidelines-and-Sample-Bylaw-Language-for-Multi-stakeholder-Cooperatives.pdf',
    doc_type: 'bylaws',
    notable_clauses: ['multi_stakeholder', 'democratic_governance', 'membership_classes', 'community_benefit'],
    description: 'Bylaw guidance and sample language for cooperatives with multiple classes of members — workers, consumers, community members, and investors.',
  },
]

async function fetchPdfText(url: string): Promise<string> {
  try {
    console.log(`  Fetching PDF from ${url.slice(0, 60)}...`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const data = await pdf(Buffer.from(buffer))
    return data.text.slice(0, 100000)
  } catch (err) {
    console.error(`  Warning: could not extract text:`, err)
    return ''
  }
}

async function seedDocuments() {
  const modelOrg = await db.query.orgs.findFirst({
    where: eq(orgs.slug, 'model-templates')
  })

  if (!modelOrg) {
    console.error('Model org not found. Run seed-model-org.ts first.')
    process.exit(1)
  }

  console.log(`Seeding ${DOCUMENTS.length} documents into org: ${modelOrg.id}`)

  for (const doc of DOCUMENTS) {
    console.log(`\nProcessing: ${doc.title}`)
    const text_content = await fetchPdfText(doc.url)
    console.log(`  Extracted ${text_content.length} characters`)

    await db.insert(documents).values({
      org_id: modelOrg.id,
      doc_type: doc.doc_type,
      title: doc.title,
      text_content,
      file_url: doc.url,
      is_public: true,
      notable_clauses: doc.notable_clauses,
    }).onConflictDoNothing()

    console.log(`  ✓ Saved`)
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\nAll documents seeded successfully.')
  process.exit(0)
}

seedDocuments().catch(console.error)
