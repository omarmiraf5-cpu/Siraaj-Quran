import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, schoolAccount } from "@/lib/adminAccounts";
import { removeSchool, setActiveAt } from "@/lib/schoolMemberships";

// One teacher's or parent's account, from the office's Teachers and Parents
// pages: renaming it, switching it off or back on, and deleting it.

/** How long Supabase refuses a switched-off account: until it's switched back on. */
const SWITCHED_OFF = "876000h"; // a hundred years

/**
 * PATCH { full_name?, active? }. Switching an account off locks it out
 * everywhere: the database's rules give a switched-off account nothing
 * (my_role, my_school_id and the rest in schema.sql), and Supabase is told
 * to refuse its sign-ins and stop renewing a session it already has.
 * Switching it back on lifts both.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const patch: { full_name?: string; active?: boolean } = {};
  if (body.full_name !== undefined) {
    const name = typeof body.full_name === "string" ? body.full_name.replace(/\s+/g, " ").trim() : "";
    if (!name) return NextResponse.json({ error: "Enter their name." }, { status: 400 });
    patch.full_name = name.slice(0, 120);
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return NextResponse.json({ error: "active must be true or false" }, { status: 400 });
    patch.active = body.active;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const found = await schoolAccount(admin, auth.caller, id);
    if (found.error) return found.error;
    const { target } = found;

    // A teacher at other schools too: their name is theirs everywhere, but
    // switched on or off is this school's own say. Their login is locked
    // out only once no school has them on.
    if (found.member) {
      if (patch.full_name !== undefined) {
        const { error } = await admin.from("profiles").update({ full_name: patch.full_name }).eq("id", id);
        if (error) throw error;
      }
      if (patch.active !== undefined && patch.active !== target.active) {
        const outcome = await setActiveAt(admin, id, auth.caller.school_id as string, patch.active);
        if (outcome?.lockedOut || outcome?.unlocked) {
          const { error: banError } = await admin.auth.admin.updateUserById(id, {
            ban_duration: outcome.unlocked ? "none" : SWITCHED_OFF,
          });
          if (banError) console.error("Accounts: Supabase didn't take the switch", banError);
        }
      }
      return NextResponse.json({
        id,
        full_name: patch.full_name ?? target.full_name,
        active: patch.active ?? target.active,
      });
    }

    // The profile first: switched off there, the database's rules lock the
    // account out at once.
    const { data: updated, error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .select("id, full_name, active")
      .single();
    if (error) throw error;

    if (patch.active !== undefined && patch.active !== target.active) {
      const { error: banError } = await admin.auth.admin.updateUserById(id, {
        ban_duration: patch.active ? "none" : SWITCHED_OFF,
      });
      if (banError) {
        console.error("Accounts: Supabase didn't take the switch", banError);
        return NextResponse.json(
          {
            error: patch.active
              ? `Switched back on, but they still can't sign in: ${banError.message}. Please try again.`
              : `Switched off, but Supabase still lets them sign in: ${banError.message}. Please try again.`,
          },
          { status: 502 }
        );
      }
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Accounts: could not update", error);
    return NextResponse.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }
}

/**
 * DELETE: the login and profile go for good. What they recorded about the
 * children (register, lessons, recitations, plans, messages) stays with
 * the school without their name, and a teacher's halaqas wait for another
 * (the foreign keys in schema.sql set their id to null).
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  try {
    const admin = createAdminClient();
    const found = await schoolAccount(admin, auth.caller, id);
    if (found.error) return found.error;
    // A teacher at other schools too leaves this one only: their login,
    // and everything at their other schools, stay.
    if (found.member) {
      const left = await removeSchool(admin, id, auth.caller.school_id as string);
      if (left?.lockedOut) {
        await admin.auth.admin.updateUserById(id, { ban_duration: SWITCHED_OFF });
      }
      return NextResponse.json({ deleted: true, name: found.target.full_name, keptElsewhere: true });
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
    return NextResponse.json({ deleted: true, name: found.target.full_name });
  } catch (error) {
    console.error("Accounts: could not delete", error);
    return NextResponse.json({ error: "That account couldn't be deleted. Please try again." }, { status: 500 });
  }
}
