// How a person is greeted: by their first name — with the title in front of
// it when their name starts with one, so "Ustadha Eman Bekhwagy" is greeted
// as "Ustadha Eman", never as just "Ustadha".
const TITLE =
  /^(ustadh|ustadha|ustaadh|ustaadha|ustaz|ustaza|ustadhah|sheikh|shaykh|sheekh|shaikh|moallim|mualim|mu'allim|macallin|macallimad|imam|hafiz|hafidh|mr|mrs|ms|miss|dr|br|sr|brother|sister)\.?$/i;

export function greetingName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && TITLE.test(words[0])) return `${words[0]} ${words[1]}`;
  return words[0] ?? "";
}
