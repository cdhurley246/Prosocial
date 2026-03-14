import { db } from '../lib/db'
import { resources } from '../lib/db/schema'

const RESOURCES = [
  // Legal guides
  {
    title: 'DAWI: Bylaw and Operating Agreement Templates',
    url: 'https://institute.coop/bylaw-and-operating-agreement-templates',
    description: 'Free model bylaws and operating agreements for worker cooperatives from the Democracy at Work Institute.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop', 'consumer_coop', 'housing_coop'],
    issue_areas: ['governance', 'legal_structure'],
    is_local: false,
  },
  {
    title: 'SELC: Legal Templates for Cooperatives and Nonprofits',
    url: 'https://www.theselc.org/templates',
    description: 'Free legal templates from the Sustainable Economies Law Center including bylaws, operating agreements, and employee handbooks. CC BY-SA licensed.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop', 'nonprofit', 'housing_coop', 'mutual_aid'],
    issue_areas: ['governance', 'legal_structure'],
    is_local: false,
  },
  {
    title: 'SELC: Mutual Aid Legal Toolkit',
    url: 'https://www.theselc.org/mutual_aid_toolkit',
    description: 'Comprehensive legal toolkit for mutual aid groups including sample bylaws, tax Q&A, and case studies.',
    resource_type: 'legal_guide',
    relevant_org_types: ['mutual_aid', 'nonprofit'],
    issue_areas: ['governance', 'legal_structure', 'community'],
    is_local: false,
  },
  {
    title: 'CoopLaw.org: Worker Cooperative Legal Resource Library',
    url: 'https://www.cooplaw.org',
    description: 'Comprehensive plain-language legal resource library for worker cooperatives in every US state, maintained by SELC.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop'],
    issue_areas: ['governance', 'legal_structure'],
    is_local: false,
  },
  {
    title: 'DAWI: Starting a Worker Cooperative',
    url: 'https://institute.coop/starting-worker-cooperative',
    description: 'Step-by-step guide to starting a worker cooperative from the Democracy at Work Institute.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop'],
    issue_areas: ['legal_structure', 'governance', 'startup'],
    is_local: false,
  },
  {
    title: 'Becoming Employee Owned: Business Conversion Resources',
    url: 'https://becomingemployeeowned.org',
    description: 'National resource hub for businesses and workers interested in converting to worker cooperative or employee ownership.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop'],
    issue_areas: ['conversion', 'legal_structure', 'startup'],
    is_local: false,
  },
  // Government / registration
  {
    title: 'IRS: Apply for 501(c)(3) Tax-Exempt Status',
    url: 'https://www.irs.gov/charities-non-profits/application-for-recognition-of-exemption',
    description: 'Official IRS guidance and forms for applying for 501(c)(3) status for nonprofits.',
    resource_type: 'government',
    relevant_org_types: ['nonprofit'],
    issue_areas: ['legal_structure', 'tax'],
    is_local: false,
  },
  {
    title: 'Missouri Secretary of State: Business & Nonprofit Registration',
    url: 'https://www.sos.mo.gov/business/corporations',
    description: 'Official Missouri portal for registering nonprofits, cooperatives, and other business entities.',
    resource_type: 'government',
    relevant_org_types: ['nonprofit', 'worker_coop', 'consumer_coop'],
    issue_areas: ['legal_structure'],
    is_local: true,
  },
  {
    title: 'Illinois Secretary of State: Business Services',
    url: 'https://www.ilsos.gov/departments/business_services/home.html',
    description: 'Official Illinois portal for registering nonprofits, Limited Worker Cooperative Associations (LWCA), and other entities.',
    resource_type: 'government',
    relevant_org_types: ['nonprofit', 'worker_coop'],
    issue_areas: ['legal_structure'],
    is_local: true,
  },
  // Local funders
  {
    title: 'St. Louis Community Foundation',
    url: 'https://stlgives.org',
    description: 'Regional community foundation offering grants to nonprofits and social enterprises in the St. Louis region.',
    resource_type: 'funder',
    relevant_org_types: ['nonprofit'],
    issue_areas: ['funding'],
    is_local: true,
  },
  {
    title: 'Missouri Foundation for Health: Grants',
    url: 'https://mffh.org/grants/',
    description: 'Major regional funder focused on health equity in Missouri. Supports nonprofits working on health, food access, and community wellbeing.',
    resource_type: 'funder',
    relevant_org_types: ['nonprofit'],
    issue_areas: ['funding', 'health', 'food'],
    is_local: true,
  },
  {
    title: 'United Way of Greater St. Louis',
    url: 'https://www.stl.unitedway.org/nonprofits',
    description: 'Regional United Way offering funding and capacity-building support to nonprofits in the St. Louis area.',
    resource_type: 'funder',
    relevant_org_types: ['nonprofit'],
    issue_areas: ['funding'],
    is_local: true,
  },
  {
    title: 'USFWC: Financing for Worker Cooperatives',
    url: 'https://www.usworker.coop/resources/financing/',
    description: 'Guide to financing options for worker cooperatives including CDFI loans, grants, and member investment.',
    resource_type: 'legal_guide',
    relevant_org_types: ['worker_coop'],
    issue_areas: ['funding', 'capital'],
    is_local: false,
  },
  // Regional support
  {
    title: 'Illinois Worker Cooperative Alliance (IWCA)',
    url: 'https://www.iwca.coop',
    description: 'Illinois-based alliance supporting worker cooperative development for low-wage workers. Regional technical assistance available.',
    resource_type: 'support_org',
    relevant_org_types: ['worker_coop'],
    issue_areas: ['technical_assistance', 'governance', 'startup'],
    is_local: true,
  },
  {
    title: 'DAWI: Democratic Management Resources',
    url: 'https://institute.coop/topics/democratic-management',
    description: 'Tools and guides for running democratically managed workplaces: meeting facilitation, conflict resolution, and governance.',
    resource_type: 'tool',
    relevant_org_types: ['worker_coop', 'nonprofit', 'mutual_aid'],
    issue_areas: ['governance', 'management'],
    is_local: false,
  },
]

async function seedResources() {
  console.log(`Seeding ${RESOURCES.length} resources...`)

  for (const resource of RESOURCES) {
    await db.insert(resources).values(resource).onConflictDoNothing()
    console.log(`  ✓ ${resource.title}`)
  }

  console.log('\nResources seeding complete.')
  process.exit(0)
}

seedResources().catch(console.error)
