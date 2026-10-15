import type { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";

type Db = ReturnType<typeof createClient>;

/**
 * The school the signed-in person is in now, by its id. Not "the one
 * school I can see": an admin can also see a school one of their teachers
 * works at, and then that question has no single answer.
 */
export async function mySchool<T = Record<string, unknown>>(supabase: Db, columns: string): Promise<T | null> {
  const user = await sessionUser(supabase);
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("school_id").eq("id", user.id).maybeSingle();
  if (!me?.school_id) return null;
  const { data } = await supabase.from("schools").select(columns).eq("id", me.school_id).maybeSingle();
  return (data as T | null) ?? null;
}
