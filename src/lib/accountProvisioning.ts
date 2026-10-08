import type { User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";

// Every account this app creates carries this in its app_metadata, which
// only the service role can write. The database trigger that makes a new
// account's profile (handle_new_user in schema.sql) takes the role and
// school from user_metadata only when it's there: anyone can sign
// themselves up through Supabase's public auth API and put whatever they
// like in user_metadata, but not in app_metadata.
export const PROVISIONED = { provisioned: true } as const;

type AdminClient = ReturnType<typeof createAdminClient>;

export interface NewLogin {
  email: string;
  password: string;
  user_metadata: { role: string; full_name: string; school_id: string; [key: string]: unknown };
}

export type NewLoginResult =
  | { data: { user: User }; error: null }
  | { data: { user: null }; error: { message: string; code?: string; status?: number } };

/**
 * A login made by the app, with the profile it's meant to have: its role,
 * name and school.
 *
 * Supabase inserts the new user first and writes its app_metadata (the
 * PROVISIONED mark) a moment later, so the profile trigger only ever sees
 * an ordinary sign-up and makes a parent with no school. The profile is set
 * here, as the service role, straight after; if that fails, the login is
 * removed again rather than left as someone else.
 */
export async function createProvisionedUser(admin: AdminClient, login: NewLogin): Promise<NewLoginResult> {
  const { data, error } = await admin.auth.admin.createUser({
    email: login.email,
    password: login.password,
    email_confirm: true,
    app_metadata: PROVISIONED,
    user_metadata: login.user_metadata,
  });
  if (error || !data.user) {
    return { data: { user: null }, error: { message: error?.message ?? "Couldn't make the login", code: error?.code, status: error?.status } };
  }
  const { role, full_name, school_id } = login.user_metadata;
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id, role, full_name, school_id, email: data.user.email ?? login.email }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { data: { user: null }, error: { message: `Couldn't set up the login: ${profileError.message}` } };
  }
  return { data: { user: data.user }, error: null };
}
