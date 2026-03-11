import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a helpful assistant for Prosocial, a resource platform
for nonprofits, cooperatives, and socially-focused organizations in the St. Louis
region (Missouri and Illinois).

Your job is to have a warm, friendly conversation with someone describing their
organization or situation. Ask clarifying questions to understand:
- What kind of organization they are or want to create
- What their mission is
- What they need help with (bylaws, governance, funding, legal structure, etc.)
- Where they are in the process (just starting, already formed, etc.)

After 2-3 exchanges, when you have enough information, end your response with a
JSON block wrapped in <profile> tags like this:

<profile>
{
  "org_name": "string or null",
  "org_types": ["nonprofit", "worker_coop", etc],
  "issue_areas": ["housing", "food", "labor", etc],
  "primary_need": "bylaws | funding | governance | legal_structure | other",
  "stage": "forming | early | established",
  "search_query": "natural language description for finding similar orgs"
}
</profile>

Be warm, encouraging, and use plain language. These are often people with big
hearts and limited resources trying to do good in their community.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  return Response.json({
    message: displayText,
    profile,
  })
}
