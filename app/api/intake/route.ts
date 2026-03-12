import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `You are an intake assistant for Prosocial, a resource platform for nonprofits, cooperatives, and socially-focused organizations in the St. Louis region (Missouri and Illinois).

Your job is to have a brief, focused conversation to understand who someone is and what they need. Ask one clarifying question at a time to learn:
- What kind of organization they are or want to create
- What their mission is
- What they need help with (bylaws, governance, funding, legal structure, etc.)
- Where they are in the process (just starting, already formed, etc.)

Tone and style rules you must follow strictly:
- Keep every response to 2-3 sentences maximum
- Warm but professional — no cheerleading or excessive positivity
- No emojis under any circumstances
- No asterisks, no markdown formatting of any kind
- Plain prose only

After 2-3 exchanges, when you have enough information, write a brief closing sentence and then end your response with a JSON block wrapped in <profile> tags like this:

<profile>
{
  "org_name": "string or null",
  "org_types": ["nonprofit", "worker_coop", etc],
  "issue_areas": ["housing", "food", "labor", etc],
  "primary_need": "bylaws | funding | governance | legal_structure | other",
  "stage": "forming | early | established",
  "search_query": "natural language description for finding similar orgs"
}
</profile>`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return Response.json({ error: 'Unexpected response type' }, { status: 500 })
    }

    // Check if a profile was extracted
    const profileMatch = content.text.match(/<profile>([\s\S]*?)<\/profile>/)
    const profile = profileMatch ? JSON.parse(profileMatch[1]) : null
    const displayText = content.text.replace(/<profile>[\s\S]*?<\/profile>/, '').trim()

    // Always return a non-empty message — empty content breaks the next API call
    const message = displayText || (profile ? "I have what I need. Finding similar organizations for you now." : "")

    return Response.json({ message, profile })
  } catch (err: any) {
    console.error('Intake error:', err)
    return Response.json({ error: err.message ?? 'Request failed' }, { status: 500 })
  }
}
