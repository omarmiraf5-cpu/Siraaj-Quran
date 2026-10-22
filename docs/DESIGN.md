# MyDiiwaan design rules

One person owns the portal's look at a time, so changes do not undo each other.
Before changing colours, icons, headers, cards or spacing, read this. If a change
breaks a rule, change the rule here first, in the same commit, and say why.

## The idea

Quiet, classical, trustworthy: the crest's navy and gold on a warm cream ground.
A school office, a teacher on a phone and a parent should all feel calm. Nothing
shouts. Colour is used to mean something, never for decoration.

## Rules

1. **Colour.** Navy for structure, cream for the page, gold for emphasis only
   (one gold accent per screen area). Green, amber and red mean present/late/absent
   and good/warning/problem, and nothing else. No purple, pink or orange tiles.
2. **One icon family.** The same style everywhere: the gem tiles for navigation,
   cards and buttons (`gem-icons.tsx`). Do not mix flat line icons beside them.
3. **One way to do each thing per screen.** A page does not repeat the same
   actions in two rows (a header's buttons and a tile row below it). Pick one.
4. **Effects are rare.** At most one soft shadow level. No glow on every card, no
   gradient buttons except the single main action on a screen.
5. **Every state is designed.** Loading shows a skeleton the shape of the content
   within a moment; empty says what to do next; an error says what happened and
   offers a retry. Never a bare "Please sign in again" or a blank card.
6. **Phone first.** Tap targets at least 44px, no text cut off, no sideways scroll,
   checked at 390px wide and on an iPad.
7. **Words.** Plain words a child or a parent understands. Arabic and Somali for
   every visible string (`npm run i18n:check` must show 0 missing).
8. **Students are different, on purpose.** The student portal may be brighter and
   friendlier, but follows rules 1 to 3 and 5 to 7.
9. **Speed is part of the design.** A page that takes seconds to show content is a
   design defect. Show cached content first, then refresh.

## Before pushing a visual change

- A screenshot on a phone and on an iPad, in light and dark mode.
- `npx tsc --noEmit`, `npm run i18n:check`, and a production build.
