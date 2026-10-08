import type { createClient } from "@/lib/supabase/client";
import { gradeLabel } from "@/lib/grades";

type Db = ReturnType<typeof createClient>;

/** One of a school's sites, with where staff sign in at it. */
export interface Campus {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_m: number;
}

/**
 * Whether the school keeps its students in grades, and its campuses. A
 * database the grades update hasn't reached yet answers with errors for
 * both, and the school is then what every school was: a Qur'an school with
 * one site.
 */
export async function loadSchoolShape(supabase: Db, schoolId: string | null): Promise<{ graded: boolean; campuses: Campus[] }> {
  const [{ data: school, error: schoolError }, campuses] = await Promise.all([
    schoolId
      ? supabase.from("schools").select("organised_by_grade").eq("id", schoolId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadCampuses(supabase),
  ]);
  return { graded: !schoolError && school?.organised_by_grade === true, campuses };
}

export async function loadCampuses(supabase: Db): Promise<Campus[]> {
  const { data, error } = await supabase
    .from("campuses")
    .select("id, name, latitude, longitude, geofence_radius_m")
    .order("name");
  if (error) return [];
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    latitude: c.latitude,
    longitude: c.longitude,
    radius_m: c.geofence_radius_m,
  }));
}

/**
 * A halaqa as the office names it outside its own grade's list: "North ·
 * Grade 3 · Halaqa A", or just its name in a Qur'an school.
 */
export function halaqaTitle(
  h: { name: string; grade?: number; campusId?: string | null },
  graded: boolean,
  campuses: Campus[]
): string {
  if (!graded) return h.name;
  const campus = campuses.find((c) => c.id === h.campusId)?.name;
  return [campus, gradeLabel(h.grade ?? 0), h.name].filter(Boolean).join(" · ");
}
