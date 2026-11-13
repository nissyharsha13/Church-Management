import { NextResponse, type NextRequest } from "next/server";
import { generateText } from "ai";

/**
 * Telugu typed in English letters ("yesu prabhuvu") -> Telugu script ("యేసు ప్రభువు").
 * Runs an AI model through Vercel AI Gateway (OIDC auth on Vercel; AI_GATEWAY_API_KEY elsewhere).
 * Protected by src/proxy.ts like every other API route. See docs/DECISIONS.md D-011.
 */
const MODEL = process.env.AI_GATEWAY_MODEL || "anthropic/claude-haiku-5.5";
const MAX_CHARS = 4000;

const INSTRUCTIONS = `You convert romanized Telugu ("Tenglish") into Telugu script for a church sermon planner.

Rules:
- Transliterate Telugu words written in Latin letters into correct Telugu script, using the spelling a native speaker would expect (e.g. "devudu" -> "దేవుడు", "yesu prabhuvu" -> "యేసు ప్రభువు", "prardhana" -> "ప్రార్థన", "vishvasam" -> "విశ్వాసం").
- Do NOT translate. Keep the meaning and words exactly; only change the script.
- Keep genuine English words, names of Bible books written in English, numbers, verse references (e.g. "John 3:16", "Mark 4:35-41"), punctuation, bullet characters, emoji and line breaks exactly as they are.
- Text that is already in Telugu script stays unchanged.
- Output only the converted text — no quotes, notes or explanations.`;

export async function POST(req: NextRequest) {
  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    /* empty body */
  }
  if (!text.trim()) return NextResponse.json({ text: "" });
  if (text.length > MAX_CHARS) {
    return NextResponse.json({ error: "too_long", max: MAX_CHARS }, { status: 413 });
  }
  // Nothing to convert if there are no Latin letters.
  if (!/[A-Za-z]/.test(text)) return NextResponse.json({ text });

  try {
    const result = await generateText({
      model: MODEL,
      instructions: INSTRUCTIONS,
      prompt: text,
      maxOutputTokens: Math.min(8000, text.length * 4 + 200),
      temperature: 0,
    });
    return NextResponse.json({ text: result.text.trim() });
  } catch (e) {
    const name = (e as Error)?.name ?? "";
    const message = (e as Error)?.message ?? "";
    console.error("transliterate failed:", name, message);
    if (/auth/i.test(name) || /auth|api key|oidc/i.test(message)) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }
    if (/credit|fund|budget|payment/i.test(name + message)) {
      return NextResponse.json({ error: "no_credits" }, { status: 402 });
    }
    if (/rate/i.test(name + message)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "failed" }, { status: 502 });
  }
}
