/**
 * lib/ai/enrich.ts
 *
 * Sends org website text to Claude and extracts structured profile fields
 * as a typed JSON object.
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL = 'claude-sonnet-4-20250514'

// ─── Types ────────────────────────────────────────────────────

export interface EnrichedProfile {
  mission_summary:        string | null
  services_offered:       string[]
  population_served:      string[]
  geographic_focus:       string | null
  staff_size_signal:      string | null
  org_type_indicators:    string[]
  issue_areas_detected:   string[]
  notable_programs:       string[]
}

// ─── Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You extract structured information from nonprofit and cooperative organization websites.
Given the organization name and scraped website text, return ONLY a valid JSON object — no markdown, no explanation.

Required fields:
- mission_summary: 1–3 sentence summary of the organization's mission (string or null if not found)
- services_offered: specific services or programs the org provides (array of strings)
- population_served: who they serve, e.g. "low-income families", "youth", "rural farmers" (array of strings)
- geographic_focus: primary geography, e.g. "St. Louis, MO", "Statewide Missouri" (string or null)
- staff_size_signal: any signal about staff, volunteer, or member count (string or null)
- org_type_indicators: org structure signals, e.g. "worker-owned", "501(c)(3)", "housing cooperative", "mutual aid network" (array of strings)
- issue_areas_detected: issue areas addressed, e.g. "affordable housing", "food access", "workforce development" (array of strings)
- notable_programs: names of specific programs or initiatives mentioned (array of strings)

Use null for absent strings and [] for absent arrays. Respond only with the JSON object.`

// ─── Extraction ───────────────────────────────────────────────

/**
 * Sends text to Claude and returns extracted structured fields.
 * Returns null if text is too short, Claude fails, or response cannot be parsed.
 */
export async function extractOrgProfile(
  text: string,
  orgName: string,
): Promise<EnrichedProfile | null> {
  if (!text || text.length < 80) return null

  // Truncate to ~8 000 chars — enough for thorough extraction without excess tokens
  const truncated = text.slice(0, 8_000)

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Organization: ${orgName}\n\nWebsite text:\n${truncated}`,
        },
      ],
    })
  } catch (err) {
    console.error(`  Claude API error for "${orgName}":`, err)
    return null
  }

  const block = response.content[0]
  if (block.type !== 'text') return null

  // Handle potential markdown fences (```json ... ```)
  const jsonMatch = block.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.error(`  No JSON object found in Claude response for "${orgName}"`)
    return null
  }

  try {
    return JSON.parse(jsonMatch[0]) as EnrichedProfile
  } catch {
    console.error(`  JSON parse failed for "${orgName}"`)
    return null
  }
}
