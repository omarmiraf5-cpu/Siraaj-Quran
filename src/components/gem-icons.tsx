"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";

/**
 * Web port of the Abu Hureira gem tiles (QuickIcon GemTile + ColorGlyph Art).
 * Path data and gradient stops are copied from the React Native sources.
 * Tile radius is 14/48 of the size (~0.29).
 */

export type ArtName =
  | "keypad"
  | "person"
  | "people"
  | "book"
  | "calendar"
  | "calendarCheck"
  | "clock"
  | "mosque"
  | "globe"
  | "cash"
  | "megaphone"
  | "check"
  | "pin"
  | "pen"
  | "mail"
  | "lock"
  | "more";

type Palette = { sky: [string, string, string]; hue: string };

/** Tile skies from ART_PALETTES. calendarCheck shares the calendar sky. */
const PALETTES: Record<ArtName, Palette> = {
  keypad: { sky: ["#141d2c", "#273750", "#43597a"], hue: "#c9d6ea" },
  person: { sky: ["#0a1d48", "#16407e", "#2f72b8"], hue: "#a9d2ff" },
  people: { sky: ["#0a1d48", "#16407e", "#2f72b8"], hue: "#a9d2ff" },
  book: { sky: ["#361b07", "#874611", "#d9862a"], hue: "#ffd79a" },
  calendar: { sky: ["#1c1446", "#35287e", "#5a4cbc"], hue: "#c8bfff" },
  calendarCheck: { sky: ["#1c1446", "#35287e", "#5a4cbc"], hue: "#c8bfff" },
  clock: { sky: ["#2f1a06", "#7a4510", "#c98426"], hue: "#ffdca0" },
  mosque: { sky: ["#0a1d38", "#173f68", "#3a76a0"], hue: "#c8f2d4" },
  globe: { sky: ["#06263a", "#0c4f6a", "#178a9c"], hue: "#9fe8f2" },
  cash: { sky: ["#371a05", "#87470f", "#e0982c"], hue: "#ffe0a0" },
  megaphone: { sky: ["#331305", "#7a3510", "#cc6e20"], hue: "#ffd88f" },
  check: { sky: ["#052a1c", "#0b5a3a", "#1b8f5c"], hue: "#a6f3c6" },
  pin: { sky: ["#2a0d1c", "#6d1a36", "#bf3a52"], hue: "#ffb3bd" },
  pen: { sky: ["#331305", "#7a3510", "#cc6e20"], hue: "#ffd88f" },
  mail: { sky: ["#0a1d48", "#153d7c", "#2d6db6"], hue: "#a9d2ff" },
  lock: { sky: ["#2f1a06", "#7a4510", "#c98426"], hue: "#ffdca0" },
  more: { sky: ["#141d2c", "#273750", "#43597a"], hue: "#c9d6ea" },
};

const GOLD = ["#fff4cf", "#ffc95c", "#d98614"];
const NAVY = "#0d2a42";

function stops(colors: string[]) {
  return colors.map((c, i) => (
    <stop key={i} offset={colors.length === 1 ? 0 : i / (colors.length - 1)} stopColor={c} />
  ));
}

function lg(id: string, colors: string[], x1 = 0, y1 = 0, x2 = 0, y2 = 24) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
      {stops(colors)}
    </linearGradient>
  );
}

/** Masjid an-Nabawi silhouette, copied from TabGlyph. */
function NabawiArt({ id }: { id: string }) {
  const g = (n: string) => `url(#${id}${n})`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}ndome`} x1="8" y1="5" x2="16" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7fe39a" />
          <stop offset="0.5" stopColor="#2fb565" />
          <stop offset="1" stopColor="#127a43" />
        </linearGradient>
        <linearGradient id={`${id}nwall`} x1="0" y1="13" x2="0" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ead3a6" />
        </linearGradient>
        <linearGradient id={`${id}nmin`} x1="0" y1="5" x2="0" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e3cfa6" />
        </linearGradient>
      </defs>
      {[3.3, 20.7].map((x) => (
        <g key={x}>
          <rect x={x - 1.05} y="8.2" width="2.1" height="12.8" rx="0.5" fill={g("nmin")} />
          <rect x={x - 1.75} y="11.2" width="3.5" height="1.2" rx="0.5" fill="#e7b64a" />
          <rect x={x - 1.45} y="15.6" width="2.9" height="1" rx="0.45" fill="#e7b64a" fillOpacity={0.85} />
          <path d={`M${x - 1.05} 8.4L${x} 4.4L${x + 1.05} 8.4Z`} fill="#2fb565" />
          <circle cx={x} cy="3.7" r="0.6" fill="#ffc94a" />
        </g>
      ))}
      <rect x="5.4" y="14.2" width="13.2" height="6.8" rx="0.8" fill={g("nwall")} />
      <path d="M7.1 21V18.2A0.95 0.95 0 0 1 9 18.2V21Z" fill="#c9893a" fillOpacity={0.75} />
      <path d="M10.6 21V17.6A1.4 1.4 0 0 1 13.4 17.6V21Z" fill="#ffb02e" />
      <path d="M15 21V18.2A0.95 0.95 0 0 1 16.9 18.2V21Z" fill="#c9893a" fillOpacity={0.75} />
      <rect x="8.3" y="11.4" width="7.4" height="3" rx="0.5" fill="#1d9455" />
      <path d="M7.9 11.8C7.9 8.6 9.8 6.6 12 5.3C14.2 6.6 16.1 8.6 16.1 11.8Z" fill={g("ndome")} />
      <path d="M9.6 10.4C9.8 8.9 10.6 7.7 11.6 6.9" stroke="#c9f5d4" strokeOpacity={0.8} strokeWidth={0.8} strokeLinecap="round" fill="none" />
      <path d="M12 5.3V3.4" stroke="#ffc94a" strokeWidth={0.9} strokeLinecap="round" />
      <path d="M12.5 0.9A1.35 1.35 0 1 0 12.5 3.5A1.05 1.05 0 0 1 12.5 0.9Z" fill="#ffc94a" />
    </g>
  );
}

function calendarPage(id: string, withCheck: boolean) {
  return (
    <g>
      <defs>
        {lg(`${id}pg`, ["#ffffff", "#d3e2f6"], 3, 5, 21, 21)}
        {withCheck && (
          <linearGradient id={`${id}ck`} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#6ff0a6" />
            <stop offset="0.5" stopColor="#18a35a" />
            <stop offset="1" stopColor="#0d7a42" />
          </linearGradient>
        )}
      </defs>
      <rect x="3" y="4.6" width="18" height="16.4" rx="3" fill={`url(#${id}pg)`} />
      <path d="M6 4.6H18A3 3 0 0 1 21 7.6V9.8H3V7.6A3 3 0 0 1 6 4.6Z" fill="#7a5cf0" />
      <rect x="7" y="2.6" width="2" height="4" rx="1" fill="#3d2a9e" />
      <rect x="15" y="2.6" width="2" height="4" rx="1" fill="#3d2a9e" />
      <rect x="6.2" y="12.4" width="2.8" height="2.4" rx="0.6" fill="#6a7fc0" fillOpacity={0.45} />
      <rect x="10.6" y="12.4" width="2.8" height="2.4" rx="0.6" fill="#6a7fc0" fillOpacity={0.45} />
      <rect x="6.2" y="16.4" width="2.8" height="2.4" rx="0.6" fill="#6a7fc0" fillOpacity={0.45} />
      {withCheck ? (
        <g transform="translate(11.8 11.6) scale(0.5)">
          <circle cx="12" cy="12" r="9.6" fill={`url(#${id}ck)`} />
          <path d="M7.4 12.4L10.6 15.4L16.8 8.8" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      ) : (
        <circle cx="16.4" cy="16.2" r="2.8" fill="#ffb627" />
      )}
    </g>
  );
}

/** Illustrations on a 24×24 grid. Paths and stops match ColorGlyph Art. */
export function Art({ name, id }: { name: ArtName; id: string }): ReactNode {
  const u = (n: string) => `url(#${id}${n})`;
  switch (name) {
    case "clock":
      return (
        <g>
          <defs>
            {lg(`${id}r`, GOLD, 4, 3, 20, 21)}
            {lg(`${id}f`, ["#ffffff", "#e6edf7"], 0, 5, 0, 19)}
          </defs>
          <circle cx="12" cy="12" r="9.6" fill={u("r")} />
          <circle cx="12" cy="12" r="7.4" fill={u("f")} />
          <path d="M12 7.4V12L15.2 13.9" stroke="#1d3a5c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="12" cy="12" r="1.1" fill="#e2483c" />
        </g>
      );
    case "pin":
      return (
        <g>
          <defs>{lg(`${id}p`, ["#ff8a9a", "#e8344e", "#b51d3a"], 6, 2, 18, 20)}</defs>
          <ellipse cx="12" cy="21" rx="5.4" ry="1.6" fill="#1b8f5c" fillOpacity={0.75} />
          <path d="M12 21.2C12 21.2 4.6 14.4 4.6 9.4A7.4 7.4 0 0 1 19.4 9.4C19.4 14.4 12 21.2 12 21.2Z" fill={u("p")} />
          <circle cx="12" cy="9.4" r="3" fill="#ffffff" />
          <path d="M7.6 7.4A4.8 4.8 0 0 1 10 4.8" stroke="#ffd0d8" strokeWidth={1.2} strokeLinecap="round" fill="none" />
        </g>
      );
    case "person":
      return (
        <g>
          <defs>
            {lg(`${id}b`, ["#7fb6ff", "#2f6fd0"], 0, 13, 0, 22)}
            {lg(`${id}h`, ["#ffe6c8", "#f0b882"], 0, 3, 0, 12)}
          </defs>
          <path d="M3.8 21.4C3.8 16.6 7.4 13.6 12 13.6C16.6 13.6 20.2 16.6 20.2 21.4Z" fill={u("b")} />
          <circle cx="12" cy="7.8" r="4.4" fill={u("h")} />
          <path d="M7.8 7.2C8 4.6 9.8 3.2 12 3.2C14.4 3.2 16.2 4.8 16.2 7.2C14.6 6 12.6 5.6 7.8 7.2Z" fill="#3b2a1e" />
        </g>
      );
    case "people":
      return (
        <g>
          <defs>
            {lg(`${id}b`, ["#7fb6ff", "#2f6fd0"], 0, 13, 0, 22)}
            {lg(`${id}c`, ["#7ff0cf", "#17917a"], 0, 12, 0, 21)}
          </defs>
          <path d="M12.6 20.6C12.6 16.8 15 14.4 18 14.4C21 14.4 23.2 16.8 23.2 20.6Z" fill={u("c")} />
          <circle cx="18" cy="9.6" r="3.2" fill="#f2c08c" />
          <path d="M1.4 21.4C1.4 16.8 4.6 13.8 8.6 13.8C12.6 13.8 15.8 16.8 15.8 21.4Z" fill={u("b")} />
          <circle cx="8.6" cy="8" r="4" fill="#ffe0bd" />
        </g>
      );
    case "calendar":
      return calendarPage(id, false);
    case "calendarCheck":
      return calendarPage(id, true);
    case "megaphone":
      return (
        <g>
          <defs>{lg(`${id}m`, ["#ffb35c", "#f06a1e"], 4, 5, 18, 18)}</defs>
          <path d="M3 9.6H7L16.4 4.4V19.6L7 14.4H3Z" fill={u("m")} />
          <rect x="2.2" y="9" width="4.6" height="6" rx="1.4" fill="#fff1d6" />
          <path d="M7.4 14.6L8.8 20H11L10 15.8" fill="#f3c08a" />
          <path d="M19 8.6A4.4 4.4 0 0 1 19 15.4M21.2 6.4A7.6 7.6 0 0 1 21.2 17.6" stroke="#ffd36b" strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </g>
      );
    case "check":
      return (
        <g>
          <defs>{lg(`${id}c`, ["#6ff0a6", "#18a35a", "#0d7a42"], 4, 3, 20, 21)}</defs>
          <circle cx="12" cy="12" r="9.6" fill={u("c")} />
          <path d="M7.4 12.4L10.6 15.4L16.8 8.8" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M6.4 7.6A7 7 0 0 1 10 5.2" stroke="#c9ffe0" strokeOpacity={0.7} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        </g>
      );
    case "mail":
      return (
        <g>
          <defs>{lg(`${id}e`, ["#ffffff", "#dbe6f6"], 0, 5, 0, 19)}</defs>
          <rect x="2.4" y="5.4" width="19.2" height="13.6" rx="2.4" fill={u("e")} />
          <path d="M3 6.6L12 13.2L21 6.6" stroke="#3f7fe0" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" fill="none" />
          <path d="M3.4 18.2L9.4 12.4M20.6 18.2L14.6 12.4" stroke="#9db8e0" strokeWidth={1.1} strokeLinecap="round" />
          <circle cx="18.6" cy="6.4" r="3" fill="#ff5f7e" stroke="#ffffff" strokeWidth={1} />
        </g>
      );
    case "lock":
      return (
        <g>
          <defs>{lg(`${id}b`, GOLD, 4, 10, 20, 22)}</defs>
          <path d="M7.4 10.6V7.6A4.6 4.6 0 0 1 16.6 7.6V10.6" stroke="#b9c6d8" strokeWidth={2.4} fill="none" />
          <rect x="4" y="10" width="16" height="11.4" rx="2.6" fill={u("b")} />
          <circle cx="12" cy="14.8" r="1.7" fill="#5a3305" />
          <rect x="11.3" y="15.4" width="1.4" height="3" rx="0.7" fill="#5a3305" />
        </g>
      );
    case "globe":
      return (
        <g>
          <defs>
            <radialGradient id={`${id}s`} cx="9" cy="8" r="13" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#9fe2ff" />
              <stop offset="1" stopColor="#2a7fd0" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="9.6" fill={u("s")} />
          <path d="M6.4 6.4C8.4 6 9.6 7.4 9 9C8.4 10.4 6.6 10.2 6.2 12C5.8 13.6 7.4 14.2 7 16.4C5 15 3.6 12.6 3.6 10.4C4.2 8.6 5.2 7.2 6.4 6.4ZM13.4 3.8C15.6 4.2 17.6 5.4 18.8 7.2C17.4 8 15.4 7.4 14.6 8.8C13.8 10.2 15.6 11.4 15 13.2C14.4 15 12.4 14.6 12 16.6C11.8 18 12.6 19.6 13.6 20.2C17.6 19.4 20.6 16 20.6 12C20.6 11.4 20.4 10.4 20.2 9.8C19 10.6 17.6 10 17.2 11.2" fill="#3fcf7a" />
          <circle cx="12" cy="12" r="9.6" fill="none" stroke="#d6f2ff" strokeOpacity={0.7} strokeWidth={0.8} />
        </g>
      );
    case "book":
      return (
        <g>
          <path d="M1.6 6.6V19.6C5 18.6 8.6 18.8 12 20.6C15.4 18.8 19 18.6 22.4 19.6V6.6Z" fill="#9a4a12" />
          <path d="M12 6.8C9.2 4.8 5.6 4.4 2.6 5.4V18.2C5.6 17.2 9.2 17.6 12 19.6Z" fill="#fff6e4" />
          <path d="M12 6.8C14.8 4.8 18.4 4.4 21.4 5.4V18.2C18.4 17.2 14.8 17.6 12 19.6Z" fill="#f3dcb2" />
          <path d="M5 9.2C6.6 8.8 8.2 8.9 9.8 9.6M5 12.4C6.6 12 8.2 12.1 9.8 12.8M14.2 9.6C15.8 8.9 17.4 8.8 19 9.2M14.2 12.8C15.8 12.1 17.4 12 19 12.4" stroke="#c98a3c" strokeWidth={1.1} strokeLinecap="round" fill="none" />
        </g>
      );
    case "mosque":
      return <NabawiArt id={`${id}n`} />;
    case "cash":
      return (
        <g>
          <g transform="rotate(-12 10 10)">
            <rect x="1.4" y="4.4" width="17" height="10" rx="1.8" fill="#4cc271" />
            <rect x="2.8" y="5.8" width="14.2" height="7.2" rx="1" fill="none" stroke="#e6ffe9" strokeOpacity={0.7} strokeWidth={0.8} />
            <circle cx="9.9" cy="9.4" r="2.2" fill="#1f7a44" fillOpacity={0.5} />
          </g>
          <circle cx="16.4" cy="16.2" r="5.6" fill="#ffc23a" stroke="#7a3d08" strokeWidth={1.2} />
          <path d="M17.9 14.6C17.6 14.1 17.1 13.9 16.4 13.9C15.6 13.9 15 14.3 15 14.9C15 16.3 17.9 15.8 17.9 17.4C17.9 18 17.3 18.5 16.4 18.5C15.7 18.5 15.2 18.2 14.9 17.8M16.4 13V19.4" stroke="#7a3d08" strokeWidth={1} strokeLinecap="round" fill="none" />
        </g>
      );
    case "pen":
      return (
        <g>
          <rect x="3" y="4" width="13" height="16.4" rx="2" fill="#f4f7fc" />
          <path d="M5.8 8.4H13M5.8 11.6H11M5.8 14.8H9" stroke="#8aa0c0" strokeWidth={1.3} strokeLinecap="round" />
          <g transform="rotate(40 16 12)">
            <rect x="14.4" y="3" width="3.6" height="14" rx="0.6" fill="#ffc23a" />
            <rect x="14.4" y="3" width="3.6" height="2.8" rx="0.6" fill="#ff7b9c" />
            <path d="M14.4 17L16.2 20.6L18 17Z" fill="#f3d2a6" />
            <path d="M15.6 19.2L16.2 20.6L16.8 19.2Z" fill="#3b2a1e" />
          </g>
        </g>
      );
    case "keypad":
      return (
        <g>
          {[0, 1, 2].map((r) =>
            [0, 1, 2].map((c) => (
              <circle key={`${r}${c}`} cx={6 + c * 6} cy={5 + r * 6} r="2.2" fill={["#5b95e6", "#2fbf9f", "#ffb53a"][(r + c) % 3]} />
            )),
          )}
          <circle cx="12" cy="21" r="2" fill="#ff7b9c" />
        </g>
      );
    case "more":
      return (
        <g>
          <rect x="3" y="3" width="8" height="8" rx="2.4" fill="#2fbf9f" />
          <rect x="13" y="3" width="8" height="8" rx="2.4" fill="#ff7b9c" />
          <rect x="3" y="13" width="8" height="8" rx="2.4" fill="#5b95e6" />
          <rect x="13" y="13" width="8" height="8" rx="2.4" fill="#ffb53a" />
          <rect x="4" y="4" width="6" height="3" rx="1.4" fill="#ffffff" fillOpacity={0.3} />
          <rect x="14" y="4" width="6" height="3" rx="1.4" fill="#ffffff" fillOpacity={0.3} />
          <rect x="4" y="14" width="6" height="3" rx="1.4" fill="#ffffff" fillOpacity={0.3} />
          <rect x="14" y="14" width="6" height="3" rx="1.4" fill="#ffffff" fillOpacity={0.3} />
        </g>
      );
  }
}

/** Shared gem chrome: navy ground, sky gradient, inner glow, sheen, hue rim. */
export function GemTile({
  palette,
  size = 42,
  glow = true,
  muted = false,
  render,
}: {
  palette: Palette;
  size?: number;
  glow?: boolean;
  muted?: boolean;
  render: (id: string) => ReactNode;
}) {
  const rawId = useId();
  const id = `qi${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = 14;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: (size * r) / 48,
        opacity: muted ? 0.5 : 1,
        boxShadow: glow && !muted ? `0px ${Math.round(size / 12)}px ${Math.round(size / 3)}px ${palette.hue}2e` : undefined,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 48 48">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={palette.sky[0]} />
            <stop offset="0.55" stopColor={palette.sky[1]} />
            <stop offset="1" stopColor={palette.sky[2]} />
          </linearGradient>
          <radialGradient id={`${id}inner`} cx="24" cy="26" r="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={palette.hue} stopOpacity={0.22} />
            <stop offset="1" stopColor={palette.hue} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}spec`} x1="0" y1="0" x2="0" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.2} />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="48" height="48" rx={r} fill={NAVY} />
        <rect x="0" y="0" width="48" height="48" rx={r} fill={`url(#${id}sky)`} />
        <rect x="0" y="0" width="48" height="48" rx={r} fill={`url(#${id}inner)`} />
        {render(id)}
        <rect x="1" y="1" width="46" height="25" rx={r - 1} fill={`url(#${id}spec)`} />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx={r - 0.75} fill="none" stroke={palette.hue} strokeOpacity={0.38} strokeWidth={1.5} />
      </svg>
    </span>
  );
}

/** Illustration inside the gem, scaled the same way as ColorTile. */
export function ColorTile({
  name,
  size = 42,
  glow = true,
  muted = false,
}: {
  name: ArtName;
  size?: number;
  glow?: boolean;
  muted?: boolean;
}) {
  return (
    <GemTile
      palette={PALETTES[name]}
      size={size}
      glow={glow}
      muted={muted}
      render={(id) => (
        <g>
          <defs>
            <radialGradient id={`${id}aglow`} cx="24" cy="24" r="17" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="24" cy="24" r="17" fill={`url(#${id}aglow)`} />
          <g transform="translate(9.6 9.6) scale(1.2)">
            <Art name={name} id={`${id}a`} />
          </g>
        </g>
      )}
    />
  );
}

/** Bare glyph for buttons, where a full tile would be too large. */
export function ColorGlyph({ name, size = 18 }: { name: ArtName; size?: number }) {
  const rawId = useId();
  const id = `cg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <Art name={name} id={id} />
    </svg>
  );
}

/** Quick-action row: gem tile, label, 12px radius, cream card. */
export function QuickActions({
  items,
}: {
  items: { href: string; art: ArtName; label: string }[];
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center gap-2 rounded-xl border border-[#E4E2DC] bg-white px-1.5 py-3 text-center shadow-[0_8px_20px_-16px_rgba(16,42,86,0.45)] hover:bg-[#F9F8F3]"
        >
          <ColorTile name={item.art} size={44} />
          <span className="text-[12px] font-semibold text-[#102A56] leading-tight line-clamp-2">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
