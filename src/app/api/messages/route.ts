import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");

  if (!studentId) {
    return NextResponse.json(
      { error: "student_id is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: data });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const body = await req.json();
    const { student_id, kind, body: text, absence_date } = body;

    if (!student_id || !text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const KINDS = ["message", "absence"];
    const kindValue = kind ?? "message";
    if (!KINDS.includes(kindValue)) {
      return NextResponse.json(
        { error: `kind must be one of: ${KINDS.join(", ")}` },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "parent" && profile.role !== "teacher")) {
      return NextResponse.json(
        { error: "Only parents and teachers can send messages" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        student_id,
        school_id: profile.school_id,
        author_id: user.id,
        author_role: profile.role,
        kind: kindValue,
        body: text,
        absence_date: kindValue === "absence" ? absence_date : null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
