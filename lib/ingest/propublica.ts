const PROPUBLICA_BASE = 'https://projects.propublica.org/nonprofits/api/v2'

// NTEE codes most relevant to our use case
const RELEVANT_NTEE_CODES = ['S', 'W', 'P', 'Q', 'R', 'E', 'F', 'L', 'K']
const TARGET_STATES = ['MO', 'IL']

export interface ProPublicaOrg {
  ein: string
  name: string
  city: string
  state: string
  ntee_code: string | null
  subsection_code: string
  filing_requirement_code: string
}

export async function fetchNonprofitsByStateAndNTEE(
  state: string,
  nteeCode: string,
  page = 0
): Promise<ProPublicaOrg[]> {
  const url = `${PROPUBLICA_BASE}/search.json?state[id]=${state}&ntee[id]=${nteeCode}&c_code[id]=3&page=${page}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`ProPublica fetch failed: ${res.status}`)

  const data = await res.json()
  return data.organizations || []
}

export async function fetchOrgDetails(ein: string) {
  const url = `${PROPUBLICA_BASE}/organizations/${ein}.json`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.organization || null
}

export async function slugify(name: string): Promise<string> {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
