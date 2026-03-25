import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface EnrichedFields {
  mission_summary: string | null
  services_offered: string[] | null
  population_served: string[] | null
  geographic_focus: string | null
  staff_size_signals: string | null
  org_type_indicators: string[] | null
  additional_notes: string | null
}

const SYSTEM_PROMPT = `You extract structured information from nonprofit and cooperative organization website text.
Respond ONLY with valid JSON — no markdown, no explanation, no code fences.`

const USER_TEMPLATE = (orgName: string, text: string) => `Organization: ${orgName}

Website text:
${text.slice(0, 5000)}

Extract the following fields. Use null for anything you cannot determine — do not guess.

{
  "mission_summary": "1-2 sentence description of core mission",
  "services_offered": ["array of specific services or programs"],
  "population_served": ["array of populations served"],
  "geographic_focus": "specific city, region, or state served",
  "staff_size_signals": "any mention of staff count, volunteers, or size",
  "org_type_indicators": ["evidence of nonprofit, co-op, worker-owned, mutual aid, etc."],
  "additional_notes": "anything notable not captured above"
}`

export async function enrichWithClaude(
  orgName: string,
  combinedText: string
): Promise<EnrichedFields> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: USER_TEMPLATE(orgName, combinedText) }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

  return JSON.parse(content.text) as EnrichedFields
}
