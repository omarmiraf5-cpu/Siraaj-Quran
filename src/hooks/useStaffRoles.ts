"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAFF_ROLES_CHANGED } from "@/lib/schoolTeachers";

/**
 * Whether the signed-in person runs the school and whether they teach a
 * halaqa, which can both be true: a school's admin who teaches one of its
 * halaqas gets to their teacher's pages from the office's menu, and back.
 * Both false until known, and in the sample portal. Asked again when the
 * office changes who teaches (staffRolesChanged).
 */
export function useStaffRoles(): { admin: boolean; teaches: boolean } {
  const [roles, setRoles] = useState({ admin: false, teaches: false });
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      (async () => {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: profile }, { data: leads }, { data: shares }] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
          supabase.from("classes").select("id").eq("teacher_id", user.id).limit(1),
          // A halaqa they teach alongside its first teacher.
          supabase.from("class_teachers").select("class_id").eq("teacher_id", user.id).limit(1),
        ]);
        if (cancelled) return;
        setRoles({
          admin: profile?.role === "admin",
          teaches: (leads?.length ?? 0) > 0 || (shares?.length ?? 0) > 0,
        });
      })().catch(() => {});
    check();
    window.addEventListener(STAFF_ROLES_CHANGED, check);
    return () => {
      cancelled = true;
      window.removeEventListener(STAFF_ROLES_CHANGED, check);
    };
  }, []);
  return roles;
}
