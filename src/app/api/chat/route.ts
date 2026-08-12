import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  parent:
    "You are the Siraaj Quran Assistant, built into a Quranic school portal for parents. Help parents understand their child's Quranic progress, memorization assignments, and Tajweed learning. Guide them through the portal (Dashboard, Quranic Progress). Be warm, clear, and concise.",
  teacher:
    "You are the Siraaj Quran Assistant, built into a Quranic school portal for teachers. Help with creating Quranic assignments, Tajweed rules, Surah selection, and managing student progress. Be practical and concise.",
  student:
    "You are the Siraaj Quran Assistant, a friendly and encouraging helper for Quranic students. Help with Quran memorization tips, Tajweed rules (Qalqalah, Ghunna, Idgham, Iqlab, Istihaaza, Tafkhim, Hamza, Madda), and understanding Quranic Arabic. Keep a warm, supportive, age-appropriate tone.",
};

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant isn't set up yet — ANTHROPIC_API_KEY needs to be added in the Vercel project settings." },
      { status: 503 }
    );
  }

  let body: { messages?: { role: string; content: string }[]; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { messages, role } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const system = SYSTEM_PROMPTS[role ?? ""] ?? SYSTEM_PROMPTS.parent;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: messages.slice(-20).map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error:", res.status, errText);
    return NextResponse.json({ error: "The assistant is having trouble responding right now. Please try again." }, { status: 502 });
  }

  const data = await res.json();
  const reply: string = data.content?.[0]?.text ?? "I'm not sure how to respond to that.";

  return NextResponse.json({ reply });
}
