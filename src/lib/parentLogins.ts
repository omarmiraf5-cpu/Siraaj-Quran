import "server-only";

import { randomBytes } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import type { NewAccount } from "@/lib/accountWelcome";

// A parent's login from a spreadsheet row: linked if they already have one
// at this school, made (with a temporary password and a welcome to send)
// if they have none, refused if the email is someone else's or another
// school's. Once per email in a batch, however many of their children it has.
// Shared by the student import and the parents import.

type Db = ReturnType<typeof createAdminClient>;

export interface ParentOutcome {
  id: string | null;
  status: "created" | "linked" | "failed";
  reason?: string;
  password?: string;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function parentLoginsFor(admin: Db, schoolId: string) {
  const seen = new Map<string, ParentOutcome>();
  const welcomes: NewAccount[] = [];

  const forEmail = async (rawEmail: string, parentName: string | null | undefined, childName: string) => {
    const email = key(rawEmail);
    const known = seen.get(email);
    if (known) return { email, ...known };
    const { data: holder } = await admin.from("profiles").select("id, role, school_id, full_name").eq("email", email).maybeSingle();
    let result: ParentOutcome;
    if (holder) {
      // A parent here, or one of the school's teachers or its office who is
      // also a parent: their children are linked to the login they have, and
      // they see them in parent mode.
      result =
        holder.school_id === schoolId && ["parent", "teacher", "admin"].includes(holder.role)
          ? { id: holder.id, status: "linked" }
          : {
              id: null,
              status: "failed",
              reason:
                holder.school_id === schoolId
                  ? `${email} is ${holder.full_name || "someone"}'s ${holder.role} login here, so it can't also be a parent's`
                  : `${email} already has a MyDiiwaan login at another school`,
            };
    } else {
      const name = String(parentName ?? "").trim() || `${childName}'s parent`;
      const password = randomBytes(9).toString("base64url");
      const { data, error } = await createProvisionedUser(admin, {
        email,
        password,
        user_metadata: { role: "parent", full_name: name, school_id: schoolId, must_change_password: true },
      });
      if (error || !data.user) {
        result = { id: null, status: "failed", reason: error?.message ?? "Couldn't make their login" };
      } else {
        result = { id: data.user.id, status: "created", password };
        welcomes.push({ userId: data.user.id, name, email, role: "parent", children: [] });
      }
    }
    seen.set(email, result);
    return { email, ...result };
  };

  return { forEmail, welcomes };
}
