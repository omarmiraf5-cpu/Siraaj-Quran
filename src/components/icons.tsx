// One icon set for the whole product. The portals used emoji for this — 📖 for
// a book, ✅ for attendance — which rendered differently on every platform and
// was most of why the parent and student screens read as a template next to the
// teacher's. These inherit currentColor and size, so a caller styles them like
// text rather than fighting a fixed glyph.

interface IconProps {
  size?: number;
  className?: string;
}

function icon(path: React.ReactNode, defaultSize = 16) {
  return function Icon({ size = defaultSize, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {path}
      </svg>
    );
  };
}

export const IconBook = icon(
  <>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </>
);

export const IconHome = icon(
  <>
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />
  </>
);

export const IconPen = icon(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>
);

export const IconCalendar = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
  </>
);

export const IconSparkle = icon(
  <>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M12 8.5 13.4 11l2.6 1-2.6 1-1.4 2.5L10.6 13 8 12l2.6-1Z" />
  </>
);

export const IconArrow = icon(
  <>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </>
);

export const IconChart = icon(
  <>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3 3 5-7" />
  </>
);

export const IconCheck = icon(
  <>
    <path d="M20 6 9 17l-5-5" />
  </>
);

export const IconClock = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);

export const IconFlame = icon(
  <>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />
  </>
);

export const IconTarget = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" />
  </>
);

export const IconUsers = icon(
  <>
    <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />
  </>
);

export const IconPalette = icon(
  <>
    <path d="M12 21a9 9 0 1 1 9-9c0 1.7-1.3 3-3 3h-1.5a2 2 0 0 0-1.4 3.4A2 2 0 0 1 13.7 21Z" />
    <circle cx="7.5" cy="12" r="1" fill="currentColor" />
    <circle cx="10" cy="8" r="1" fill="currentColor" />
    <circle cx="15" cy="8.5" r="1" fill="currentColor" />
  </>
);

export const IconX = icon(
  <>
    <path d="M18 6 6 18M6 6l12 12" />
  </>
);

export const IconStar = icon(
  <>
    <path d="M12 3.2l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8Z" />
  </>
);

export const IconNote = icon(
  <>
    <path d="M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </>
);
