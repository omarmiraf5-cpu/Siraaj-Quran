import { COUNTRY_TIME_ZONES } from "@/data/countryTimeZones";

/** A country's name from its ISO code, in `lang`; the code itself if the runtime can't name it. */
export function countryName(code: string | null | undefined, lang = "en"): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every country there's a time zone for, alphabetical by name. */
export function countriesByName(lang = "en"): Array<{ code: string; name: string }> {
  return Object.keys(COUNTRY_TIME_ZONES)
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

/**
 * A zone's offset from UTC right now, in minutes, or null if this browser
 * doesn't know the zone (an older one may not have the newest names).
 */
function offsetMinutes(timeZone: string): number | null {
  try {
    const name =
      new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    if (name === "GMT") return 0;
    const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(name);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : null;
  } catch {
    return null;
  }
}

/** A zone the way a person picks it: "Edmonton (GMT−06:00)", "Indianapolis, Indiana (GMT−04:00)". */
export function timeZoneLabel(timeZone: string): string {
  const [, ...rest] = timeZone.split("/");
  const words = rest.map((s) => s.replace(/_/g, " "));
  const place = words.length > 1 ? `${words[words.length - 1]}, ${words.slice(0, -1).join(", ")}` : words[0] ?? timeZone;
  const offset = offsetMinutes(timeZone);
  if (offset === null) return place;
  const abs = Math.abs(offset);
  return `${place} (GMT${offset < 0 ? "−" : "+"}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")})`;
}

/** A country's zones, west to east. */
export function countryTimeZones(code: string): string[] {
  return [...(COUNTRY_TIME_ZONES[code] ?? [])].sort(
    (a, b) => (offsetMinutes(a) ?? 0) - (offsetMinutes(b) ?? 0) || timeZoneLabel(a).localeCompare(timeZoneLabel(b))
  );
}

/** The country a zone belongs to, if it's one of the listed ones. */
export function countryOfTimeZone(timeZone: string): string | null {
  for (const [code, zones] of Object.entries(COUNTRY_TIME_ZONES)) {
    if (zones.includes(timeZone)) return code;
  }
  return null;
}

/** Whether the runtime accepts this as a time zone. */
export function isTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** "Edmonton, AB, Canada": whichever of the three are known. */
export function placeLabel(
  city: string | null | undefined,
  province: string | null | undefined,
  country: string | null | undefined,
  lang = "en"
): string {
  return [city ?? "", province ?? "", countryName(country, lang)]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}
