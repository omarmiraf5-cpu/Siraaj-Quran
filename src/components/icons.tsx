// Phosphor at a light weight, with a filled twin stacked behind it.
// A badge paints the light one in a gold gradient. The active tab
// fades that out and brings the filled gold one forward.

import {
  ArrowRight,
  Book,
  BookOpen,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  ChartLine,
  ChatCircle,
  Check,
  ClipboardText,
  Clock,
  CreditCard,
  DotsThree,
  Flame,
  House,
  Lock,
  Medal,
  Megaphone,
  Microphone,
  Notebook,
  Palette,
  Path,
  PencilLine,
  Play,
  SignOut,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Star,
  Stop,
  Target,
  User,
  Users,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

interface IconProps {
  size?: number;
  className?: string;
}

/** `mirrored` icons point the way the text reads, so they flip in Arabic. */
function duo(Glyph: Icon, defaultSize = 16, mirrored = false) {
  return function DuoIcon({ size = defaultSize, className }: IconProps) {
    const flip = mirrored ? "rtl:-scale-x-100" : "";
    return (
      <span className={`icon-duo ${flip} ${className ?? ""}`}>
        <Glyph size={size} weight="light" className="icon-duo-off" aria-hidden="true" />
        <Glyph size={size} weight="fill" className="icon-duo-on" aria-hidden="true" />
      </span>
    );
  };
}

export const IconBook = duo(Book);
export const IconHome = duo(House);
export const IconPen = duo(PencilLine);
export const IconCalendar = duo(CalendarCheck);
export const IconCalendarBlank = duo(CalendarBlank);
export const IconSparkle = duo(Sparkle);
export const IconArrow = duo(ArrowRight, 16, true);
export const IconChart = duo(ChartLine);
export const IconCheck = duo(Check);
export const IconClipboard = duo(ClipboardText);
export const IconClock = duo(Clock);
export const IconFlame = duo(Flame);
export const IconTarget = duo(Target);
export const IconUsers = duo(Users);
export const IconPalette = duo(Palette);
export const IconPlay = duo(Play);
export const IconBookOpen = duo(BookOpen);
export const IconX = duo(X);
export const IconStar = duo(Star);
export const IconNote = duo(Notebook);
export const IconMic = duo(Microphone);
export const IconStop = duo(Stop);
export const IconSpeaker = duo(SpeakerHigh);
export const IconGrid = duo(SquaresFour);
export const IconCard = duo(CreditCard);
export const IconMegaphone = duo(Megaphone);
export const IconUser = duo(User);
export const IconBuildings = duo(Buildings);
export const IconChat = duo(ChatCircle);
export const IconPath = duo(Path);
export const IconMedal = duo(Medal);
export const IconLock = duo(Lock);
export const IconSignOut = duo(SignOut);
export const IconDots = duo(DotsThree);

/** A circular medallion: cream ground, fine gold ring, the icon centred. */
export function IconBadge({
  children,
  size = "md",
  onNavy = false,
}: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  onNavy?: boolean;
}) {
  return (
    <span className={`icon-badge icon-badge-${size}${onNavy ? " icon-badge-on-navy" : ""}`}>
      {children}
    </span>
  );
}
