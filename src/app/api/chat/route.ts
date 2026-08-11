import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPTS: Record<string, string> = {
  parent:
    "You are the MyDiiwaan Assistant, built into a school portal for parents. Help parents understand their child's grades, attendance, fees, and assignments, and how to navigate the portal (Dashboard, Report Card, Assignments, Fees & Payment). Be warm, clear, and concise. You don't have access to any specific family's live data — if asked for that, point them to the relevant portal page instead of guessing.",
  teacher:
    "You are the MyDiiwaan Assistant, built into a school portal for teachers. Help with lesson planning ideas, the Alberta K-10 curriculum, grading guidance, attendance, and portal navigation (Classes, Attendance, Grades, Lessons, Curriculum). Be practical and concise.",
  student:
    "You are the MyDiiwaan Assistant, a friendly and encouraging homework helper built into a school portal for students in grades K-10. Explain concepts simply and patiently for the student's level. Guide students to think through problems themselves rather than just handing over answers, especially for quiz or check-for-understanding questions. Keep a warm, supportive, age-appropriate tone.",
  admin:
    "You are the MyDiiwaan Assistant, built into a school administration portal. Help with staff management, student records, fee tracking, and portal navigation. Be clear, professional, and concise. You don't have access to any specific live records — if asked for that, point them to the relevant portal page instead of guessing.",
};

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The assistant isn't set up yet — an admin needs to add ANTHROPIC_API_KEY in the Vercel project settings." },
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
