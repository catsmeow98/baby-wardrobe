/**
 * Goal survey. Turns answers about laundry, weather and daily routine into suggested goal quantities for every size
 * from newborn to 2T.
 *
 * Lifestyle answers (laundry, outfit changes, spare outfits, climate) apply to every size. What baby wears is answered
 * per size, because routines change as baby grows: swaddles give way to sleep sacks, shoes start once walking begins.
 * Sleep, day and dressy answers are lists of combinations, such as "long-sleeve bodysuit + bottoms + socks", each with
 * a days-per-week setting. Outerwear and seasonal clothing is a list of pieces, sized from the months the size covers.
 * A piece is either a built-in key (see CATEGORY_NAMES) or the id of one of the person's own item types.
 *
 * The multipliers, caps and weights below are my own starting guesses, not research. Treat them as a first draft to
 * tune with real parents.
 */
import { dominantClass } from './climate';

export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Temp = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

/** Keys used inside the survey. Each maps to the name of a built-in category in the database. */
export const CATEGORY_NAMES = {
  sbs: 'Short-sleeve bodysuit',
  lsb: 'Long-sleeve bodysuit',
  top: 'Short-sleeve top',
  lst: 'Long-sleeve top',
  dshirt: 'Dress shirt',
  pants: 'Pants',
  shorts: 'Shorts',
  leggings: 'Leggings',
  skirt: 'Skirt',
  dpants: 'Dress pants',
  footy: 'Footy sleeper',
  footless: 'Footless sleeper',
  pjs: 'Pajama set',
  gown: 'Sleep gown',
  sack: 'Sleep sack',
  swaddle: 'Swaddle',
  romper: 'Romper',
  dress: 'Dress',
  ldress: 'Long-sleeve dress',
  lovr: 'Long overalls',
  sovr: 'Short overalls',
  set: 'Matching set',
  sweater: 'Sweater',
  cardigan: 'Cardigan',
  pullover: 'Pullover / hoodie',
  coat: 'Coat',
  jacket: 'Light jacket',
  bunting: 'Bunting',
  snowsuit: 'Snowsuit',
  socks: 'Socks',
  hat: 'Hat',
  mittens: 'Mittens',
  bib: 'Bib',
  shoes: 'Shoes',
  booties: 'Booties',
  boots: 'Boots',
  swim: 'Swimsuit',
  rash: 'Rash guard',
} as const;
export type CatKey = keyof typeof CATEGORY_NAMES;
export const CAT_KEYS = Object.keys(CATEGORY_NAMES) as CatKey[];

/** The names shown on the combination chips. The same as the category names. */
export const CAT_LABELS: Record<CatKey, string> = CATEGORY_NAMES;

/** How the chips are grouped in the combination builder. */
export const CHIP_GROUPS: readonly { label: string; keys: readonly CatKey[] }[] = [
  { label: 'Bodysuits and tops', keys: ['sbs', 'lsb', 'top', 'lst', 'dshirt'] },
  { label: 'Bottoms', keys: ['pants', 'shorts', 'leggings', 'skirt', 'dpants'] },
  { label: 'Sleep', keys: ['footy', 'footless', 'pjs', 'gown', 'sack', 'swaddle'] },
  { label: 'Outfits', keys: ['romper', 'dress', 'ldress', 'lovr', 'sovr', 'set'] },
  { label: 'Outerwear', keys: ['sweater', 'cardigan', 'pullover', 'coat', 'jacket', 'bunting', 'snowsuit'] },
  { label: 'Accessories', keys: ['socks', 'hat', 'mittens', 'bib'] },
  { label: 'Footwear', keys: ['shoes', 'booties', 'boots'] },
  { label: 'Swim', keys: ['swim', 'rash'] },
];

/* ---- how often: days per week ---- */
export type Freq = 'lt1' | '1-2' | '3-4' | '5-6' | '7';
export const FREQ: Record<Freq, { label: string; days: number }> = {
  lt1: { label: 'Less than once a week', days: 0.5 },
  '1-2': { label: '1 to 2 days', days: 1.5 },
  '3-4': { label: '3 to 4 days', days: 3.5 },
  '5-6': { label: '5 to 6 days', days: 5.5 },
  '7': { label: 'Every day', days: 7 },
};
// Listed by hand: an object puts the integer-like key '7' first.
export const FREQ_KEYS: readonly Freq[] = ['lt1', '1-2', '3-4', '5-6', '7'];
/** Links saved before the days-per-week scale used these words. */
const LEGACY_FREQ: Record<string, Freq> = { most: '7', some: '3-4', rare: '1-2' };

/** A piece is a built-in key or the id of one of the person's own item types. */
export type ItemKey = string;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isItemKey = (k: string): boolean => (CAT_KEYS as string[]).includes(k) || UUID.test(k);

export interface Combo {
  cats: ItemKey[];
  freq: Freq;
}

/** A choice in a picker: what is stored, what it is called, and the item category it sits under. */
export interface PickOption {
  key: ItemKey;
  name: string;
  group: string;
}
export const defaultOptions = (): PickOption[] => CHIP_GROUPS.flatMap((g) => g.keys.map((k) => ({ key: k, name: CATEGORY_NAMES[k], group: g.label })));
/** Built-in pieces that depend on the weather, offered in the outerwear and seasonal question. */
export const GEAR_KEYS: readonly CatKey[] = ['coat', 'jacket', 'cardigan', 'pullover', 'bunting', 'snowsuit', 'mittens', 'hat', 'swim', 'rash'];
export const defaultGearOptions = (): PickOption[] => defaultOptions().filter((o) => (GEAR_KEYS as readonly string[]).includes(o.key));

export type Occasion = 'sleep' | 'day' | 'dressy';
export const OCCASIONS: readonly (readonly [Occasion, string])[] = [
  ['sleep', 'What does baby wear to sleep?'],
  ['day', 'What does baby wear on an average day?'],
  ['dressy', 'What does baby wear for a dressy outfit?'],
];

/* ---- sizes ---- */
/** Size group orders covered by the survey: Newborn to 2T. */
export const SURVEY_SIZES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];

/** The sizes worth planning for: the current size and up, or all of them when there is no current size. */
export const defaultSizes = (current: number | null): number[] => {
  const list = SURVEY_SIZES.filter((x) => current === null || x >= current);
  return list.length ? list : [SURVEY_SIZES[SURVEY_SIZES.length - 1]];
};

/* ---- lifestyle choices ---- */
export const CHANGES = {
  one: { label: '1', n: 1 },
  'one-two': { label: '1 to 2', n: 2 },
  'two-three': { label: '2 to 3', n: 3 },
  'three-plus': { label: '3 or more', n: 4 },
} as const;
export type ChangesKey = keyof typeof CHANGES;

/** Extra outfits on top of the laundry cycle, for daycare, grandparents' houses, blowouts and so on. */
export const SPARE = {
  none: { label: 'None', n: 0 },
  few: { label: 'A few (1 to 3)', n: 2 },
  several: { label: 'Several (4 to 6)', n: 5 },
  many: { label: 'A lot (7 or more)', n: 8 },
} as const;
export type SpareKey = keyof typeof SPARE;

/** How many nights one set of pajamas is worn before it goes in the wash. With the laundry gap this decides how many sets are needed. */
export const PJ_CHANGE = {
  daily: { label: 'A clean set every night', days: 1 },
  '2-3': { label: 'The same set for 2 to 3 nights', days: 2.5 },
  '4-plus': { label: 'The same set for 4 nights or more', days: 4 },
} as const;
export type PjKey = keyof typeof PJ_CHANGE;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface StageAnswers {
  sleep: Combo[];
  day: Combo[];
  dressy: Combo[];
  /** Nights one set of pajamas is worn. */
  pj: PjKey;
  /** Outerwear and seasonal pieces baby will wear in this size. */
  gear: ItemKey[];
}
export interface Answers {
  laundry: number; // days between loads, 1 to 14
  changes: ChangesKey;
  spare: SpareKey;
  hot: boolean; // hot summers
  cold: boolean; // cold winters
  birthMonth: number; // 0 to 11, birth or due month. Decides which months and season each size falls in.
  sizes: number[]; // size orders to plan for, ascending
  /** How each calendar month feels at the person's location, January first. Set by the server from their settings, never from the link. */
  months?: readonly MonthClass[] | null;
  stages: Record<number, StageAnswers>; // answers for every size order, 0 to 7
}

const c = (freq: Freq, ...cats: CatKey[]): Combo => ({ cats, freq });

export const cloneStage = (x: StageAnswers): StageAnswers => ({
  sleep: x.sleep.map((y) => ({ cats: [...y.cats], freq: y.freq })),
  day: x.day.map((y) => ({ cats: [...y.cats], freq: y.freq })),
  dressy: x.dressy.map((y) => ({ cats: [...y.cats], freq: y.freq })),
  pj: x.pj,
  gear: [...x.gear],
});

/** Typical routines, used as the starting point for each size and as a fallback when a section is left empty. */
const TYPICAL: readonly StageAnswers[] = [
  { // newborn and 0-3M
    sleep: [c('7', 'footy', 'swaddle')],
    day: [c('7', 'sbs', 'pants', 'socks'), c('3-4', 'footy')],
    dressy: [c('1-2', 'romper')],
    pj: 'daily', gear: [],
  },
  { // 3-9M
    sleep: [c('7', 'footy', 'sack')],
    day: [c('7', 'sbs', 'pants', 'socks'), c('3-4', 'top', 'pants')],
    dressy: [c('1-2', 'romper')],
    pj: 'daily', gear: [],
  },
  { // 9-18M
    sleep: [c('7', 'footless', 'sack')],
    day: [c('7', 'top', 'pants', 'socks'), c('3-4', 'sbs', 'pants')],
    dressy: [c('1-2', 'romper')],
    pj: 'daily', gear: [],
  },
  { // 18M-2T
    sleep: [c('7', 'pjs')],
    day: [c('7', 'top', 'pants', 'socks')],
    dressy: [c('1-2', 'dress')],
    pj: 'daily', gear: [],
  },
];
const typicalFor = (size: number): StageAnswers => cloneStage(TYPICAL[size <= 1 ? 0 : size <= 3 ? 1 : size <= 5 ? 2 : 3]);

export const defaultStages = (): Record<number, StageAnswers> => Object.fromEntries(SURVEY_SIZES.map((size) => [size, typicalFor(size)]));

export const defaultAnswers = (birthMonth = 0, sizes: readonly number[] = SURVEY_SIZES): Answers => ({
  laundry: 3,
  changes: 'one-two',
  spare: 'few',
  hot: false,
  cold: false,
  birthMonth,
  sizes: [...sizes],
  stages: defaultStages(),
});

/* ---- seasons ---- */
export const seasonOfMonth = (monthIndex: number): Season =>
  monthIndex === 11 || monthIndex < 2 ? 'winter' : monthIndex < 5 ? 'spring' : monthIndex < 8 ? 'summer' : 'fall';

/** Age in months at which a typical baby starts each size. A rough guide, used only to pick a season. */
const START_AGE = [0, 1, 3, 6, 9, 12, 18, 24, 30, 36];

/** The season baby is likely to wear a size, from the birth or due month. Assumes a month into the size. */
export const seasonForSize = (birthMonth: number, size: number): Season =>
  seasonOfMonth((((birthMonth + (START_AGE[size] ?? 36) + 1) % 12) + 12) % 12);

const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

export interface SizeWindow {
  startAge: number;
  endAge: number;
  /** "Age 3 to 6 months" */
  age: string;
  /** "July to September" */
  months: string;
  /** "Jul-Sep" */
  short: string;
  /** The calendar months (0 to 11) the size covers, in order. */
  monthIdx: number[];
  /** Where the months came from. Absent means the age-based guide. */
  source?: 'forecast';
}

/**
 * The ages (and so the calendar months) in which a typical baby wears a size, from the birth or due month.
 * A baby born in April wears Newborn in April and 0-3M in May and June. Real babies vary, so this is a guide.
 */
export function sizeWindow(birthMonth: number, size: number): SizeWindow {
  const startAge = START_AGE[size] ?? 36;
  const endAge = START_AGE[size + 1] ?? startAge + 6;
  const span = endAge - startAge;
  const month = (n: number) => (((birthMonth + n) % 12) + 12) % 12;
  const first = month(startAge);
  const last = month(endAge - 1);
  const age = startAge === 0 ? `Birth to ${endAge} month${endAge === 1 ? '' : 's'}` : `Age ${startAge} to ${endAge} months`;
  const monthIdx = Array.from({ length: Math.min(span, 12) }, (_, i) => month(startAge + i));
  if (span >= 12) return { startAge, endAge, age, months: 'All year', short: 'All year', monthIdx: Array.from({ length: 12 }, (_, i) => month(startAge + i)) };
  if (span === 1) return { startAge, endAge, age, months: MONTH_NAMES[first], short: MONTH_SHORT[first], monthIdx };
  return { startAge, endAge, age, months: `${MONTH_NAMES[first]} to ${MONTH_NAMES[last]}`, short: `${MONTH_SHORT[first]}-${MONTH_SHORT[last]}`, monthIdx };
}

/* ---- the engine ---- */
/** A sleep sack or swaddle is worn one at a time, so a few spares are enough however often it is used. */
const CAPPED: readonly string[] = ['sack', 'swaddle'];
const CAP = 3;
const MAX_GOAL = 99;

/** How a calendar month feels, for sizing outerwear and seasonal clothing. A hot summer widens warm, a cold winter widens cold. */
export type MonthClass = 'cold' | 'cool' | 'mild' | 'warm';
export function monthClass(month: number, hot = false, cold = false, table?: readonly MonthClass[] | null): MonthClass {
  if (table && table.length === 12) return table[((month % 12) + 12) % 12]; // the person's own weather, when they gave a location
  if (month === 11 || month < 2) return 'cold'; // December to February
  if (month >= 5 && month <= 7) return 'warm'; // June to August
  if (month === 2 || month === 3 || month === 9 || month === 10) return cold && (month === 2 || month === 10) ? 'cold' : 'cool'; // March, April, October, November
  return hot ? 'warm' : 'mild'; // May and September
}

/** The kinds of month each built-in piece is worn in. A piece not listed here has no season rule. */
const GEAR: Partial<Record<CatKey, readonly MonthClass[]>> = {
  coat: ['cold', 'cool'],
  jacket: ['cool', 'mild'],
  cardigan: ['cool', 'cold'], // cool-weather layers
  pullover: ['cool', 'cold'],
  bunting: ['cold'],
  snowsuit: ['cold'],
  mittens: ['cold'],
  hat: ['cold', 'cool', 'warm'],
  swim: ['warm'],
  rash: ['warm'],
};
const CLASS_TEXT: Record<MonthClass, string> = { cold: 'cold', cool: 'cool', mild: 'mild', warm: 'warm' };

/**
 * How many of a seasonal piece to own. A piece that was chosen is always at least 1. It is 2 when it is in season for 3
 * or more months of the window (one is usually in the wash or drying), and 3 when it is in season for 5 or more.
 */
export function gearQty(monthsInSeason: number): number {
  if (monthsInSeason >= 5) return 3;
  return monthsInSeason >= 3 ? 2 : 1;
}

/** The built-in outerwear and seasonal pieces worth suggesting for a window: those in season for at least 2 of its months. */
export function suggestGear(monthIdx: readonly number[], size: number, hot = false, cold = false, table?: readonly MonthClass[] | null): CatKey[] {
  const young = size <= 3;
  const classes = monthIdx.map((m) => monthClass(m, hot, cold, table));
  return GEAR_KEYS.filter((k) => {
    if (k === 'rash' || k === 'cardigan' || k === 'pullover') return false; // offered, but left for the person to choose
    if (k === 'bunting' && !young) return false;
    if (k === 'snowsuit' && young) return false;
    if (k === 'swim' && size < 2) return false;
    return classes.filter((x) => GEAR[k]!.includes(x)).length >= 2;
  });
}

export interface Suggestion {
  key: ItemKey;
  name: string;
  qty: number;
  why: string;
}
export interface SizeSuggestion {
  size: number;
  window: SizeWindow;
  season: Season;
  temp: Temp;
  rows: Suggestion[];
  notes: string[];
}

export const comboText = (combo: Combo, labels: Record<string, string> = {}): string =>
  combo.cats.map((k) => labels[k] ?? (k in CATEGORY_NAMES ? CATEGORY_NAMES[k as CatKey] : 'Item')).join(' + ');

/**
 * size is a size group order (0 to 7). season is the season in which baby is expected to wear that size. window says which
 * months that is (the age-based guide when omitted). labels names the person's own item types by key.
 */
export function suggest(a: Answers, size: number, season: Season, window?: SizeWindow, labels: Record<string, string> = {}): SizeSuggestion {
  const defaults = typicalFor(size);
  const win = window ?? sizeWindow(a.birthMonth, size);
  const notes: string[] = [];
  const L = a.laundry;
  const changes = CHANGES[a.changes].n;
  const spare = SPARE[a.spare].n;
  const classes = win.monthIdx.map((m) => monthClass(m, a.hot, a.cold, a.months));
  // With a location the weather label is the one most of the size's months share. Without, it follows the season and the climate answers.
  const temp: Temp = a.months
    ? dominantClass(classes)
    : season === 'summer' ? (a.hot ? 'hot' : 'warm') : season === 'winter' ? (a.cold ? 'cold' : 'cool') : 'mild';
  const nameOf = (k: string) => labels[k] ?? (k in CATEGORY_NAMES ? CATEGORY_NAMES[k as CatKey] : 'Item');

  const qty: Record<string, number> = {};
  const why: Record<string, string[]> = {};
  const add = (cat: string, n: number, w: string) => {
    if (n <= 0) return;
    qty[cat] = (qty[cat] ?? 0) + n;
    (why[cat] ??= []).push(w);
  };

  /** Days per week of each combination, scaled down together if they add up to more than a week. */
  const scaled = (combos: Combo[]) => {
    const denom = Math.max(7, combos.reduce((t, x) => t + FREQ[x.freq].days, 0));
    return combos.map((x) => ({ x, days: (FREQ[x.freq].days / denom) * 7 }));
  };

  /** Shares a total number of outfits across combinations by the days per week each is worn, and adds each piece. */
  const place = (combos: Combo[], total: number, label: string) => {
    for (const { x, days } of scaled(combos)) {
      const n = Math.max(1, Math.ceil((total * days) / 7));
      for (const cat of x.cats) {
        const m = CAPPED.includes(cat) ? Math.min(n, CAP) : n;
        add(cat, m, `${m} for ${label} (${comboText(x, labels)}, ${FREQ[x.freq].label.toLowerCase()}).`);
      }
    }
  };

  const st = a.stages[size] ?? defaults;
  const sleepCombos = st.sleep.length ? st.sleep : (notes.push('No sleep combinations were chosen for this size, so typical ones were used.'), defaults.sleep);
  const dayCombos = st.day.length ? st.day : (notes.push('No daytime combinations were chosen for this size, so typical ones were used.'), defaults.day);

  const dayOutfits = Math.ceil(L * changes) + spare;
  place(dayCombos, dayOutfits, `${dayOutfits} daytime outfits`);

  // Pajamas: the nights worn between laundry loads, divided by nights per set, plus a set in the wash for anything worn often.
  const perSet = PJ_CHANGE[st.pj].days;
  for (const { x, days } of scaled(sleepCombos)) {
    const nights = (L * days) / 7;
    const sets = Math.max(1, Math.ceil(nights / perSet)) + (days >= 3.5 ? 1 : 0);
    for (const cat of x.cats) {
      const m = CAPPED.includes(cat) ? Math.min(sets, CAP) : sets;
      add(cat, m, `${m} for sleep (${comboText(x, labels)}, ${FREQ[x.freq].label.toLowerCase()}): ${Math.max(1, Math.ceil(nights / perSet))} to wear between loads${days >= 3.5 ? ', plus 1 in the wash' : ''}.`);
    }
  }

  // Dressy outfits: days per week over the laundry gap. Several outfit changes a day raise this by half as much as day clothes.
  const dressyFactor = 1 + (changes - 1) * 0.5;
  for (const { x, days } of scaled(st.dressy)) {
    const n = Math.max(1, Math.ceil(((days * L) / 7) * dressyFactor));
    for (const cat of x.cats) add(cat, n, `${n} for dressy outfits (${comboText(x, labels)}, ${FREQ[x.freq].label.toLowerCase()}).`);
  }

  // Outerwear and seasonal clothing: sized from how many months of this size's window the piece is in season. A chosen piece is at least 1.
  const ensure = (cat: string, n: number, w: string) => {
    if (n > (qty[cat] ?? 0)) {
      qty[cat] = n;
      why[cat] = [w];
    }
  };
  if (st.gear.length === 0) notes.push('No outerwear or seasonal clothing was chosen for this size.');
  for (const k of st.gear) {
    const profile = k in GEAR ? GEAR[k as CatKey] : undefined;
    if (!profile) {
      ensure(k, 1, 'You chose this. It has no season rule, so 1 is suggested.');
      continue;
    }
    const inSeason = classes.filter((x) => profile.includes(x)).length;
    const kinds = profile.map((x) => CLASS_TEXT[x]).join(' or ');
    ensure(
      k,
      gearQty(inSeason),
      inSeason === 0
        ? `You chose this, so at least 1, though ${win.months.toLowerCase()} has no ${kinds} months.`
        : `${inSeason} ${kinds} month${inSeason === 1 ? '' : 's'} in ${win.months.toLowerCase()}${gearQty(inSeason) === 1 && inSeason > 0 ? ': 1 is enough' : ''}.`,
    );
  }

  // Shoes only make sense once walking starts, whatever the combinations say.
  if (size <= 3) {
    if (qty.shoes || qty.boots) notes.push('Shoes and boots were left out: they are not needed before walking.');
    for (const k of ['shoes', 'boots'] as const) {
      qty[k] = 0;
      why[k] = ['Not needed before walking.'];
    }
  }

  const extra = Object.keys(qty).filter((k) => !(CAT_KEYS as string[]).includes(k));
  return {
    size,
    window: win,
    season,
    temp,
    notes,
    rows: [...CAT_KEYS, ...extra].map((key) => ({
      key,
      name: nameOf(key),
      qty: Math.min(MAX_GOAL, Math.max(0, Math.round(qty[key] ?? 0))),
      why: (why[key] ?? ['Not part of your answers.']).join(' '),
    })),
  };
}

export function suggestAll(
  a: Answers,
  sizes: readonly number[],
  seasonOf: (size: number) => Season,
  windowOf?: (size: number) => SizeWindow | undefined,
  labels: Record<string, string> = {},
): SizeSuggestion[] {
  return sizes.map((s) => suggest(a, s, seasonOf(s), windowOf?.(s), labels));
}

/* ---- reading and writing answers as a query string ---- */
const MAX_COMBOS = 6;
const MAX_PIECES = 8;
const MAX_GEAR = 12;

export const comboToString = (x: Combo): string => `${x.cats.join('.')}~${x.freq}`;

export function parseCombo(s: string): Combo | null {
  const [pieces, raw = '7'] = s.split('~');
  const freq = (FREQ_KEYS as string[]).includes(raw) ? (raw as Freq) : LEGACY_FREQ[raw];
  if (!freq) return null;
  const cats = [...new Set(pieces.split('.'))].filter(isItemKey).slice(0, MAX_PIECES);
  return cats.length ? { cats, freq } : null;
}

export const stageKey = (size: number, occasion: Occasion): string => `z${size}_${occasion}`;
export const pjKey = (size: number): string => `z${size}_pj`;
export const gearKey = (size: number): string => `z${size}_gear`;

export function answersToParams(a: Answers): URLSearchParams {
  const p = new URLSearchParams({
    touched: '1',
    laundry: String(a.laundry),
    changes: a.changes,
    spare: a.spare,
    hot: a.hot ? 'yes' : 'no',
    cold: a.cold ? 'yes' : 'no',
    birth: String(a.birthMonth),
  });
  for (const size of a.sizes) p.append('size', String(size));
  for (const size of a.sizes) {
    for (const [occ] of OCCASIONS) for (const x of a.stages[size][occ]) if (x.cats.length) p.append(stageKey(size, occ), comboToString(x));
    p.append(pjKey(size), a.stages[size].pj);
    for (const k of a.stages[size].gear) p.append(gearKey(size), k);
  }
  return p;
}

/**
 * Reads answers from a query string. Anything missing or invalid falls back to a default, numbers are clamped, and
 * unknown pieces are dropped. On the first visit (no "touched" field) the answers are the typical ones. Links saved before
 * the days-per-week scale are still understood: old how-often words are mapped, and the old single pajama answer ("pj")
 * is used for every size that has none of its own.
 */
export function parseAnswers(get: (k: string) => string | null, getAll: (k: string) => string[], fallbackBirthMonth = 0, fallbackSizes: readonly number[] = SURVEY_SIZES): Answers {
  const D = defaultAnswers(fallbackBirthMonth, fallbackSizes);
  const num = (k: string, d: number, lo: number, hi: number) => {
    const raw = get(k);
    const v = Number(raw);
    return raw !== null && raw !== '' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => ((allowed as readonly string[]).includes(get(k) ?? '') ? (get(k) as T) : d);
  const pjKeys = Object.keys(PJ_CHANGE) as PjKey[];
  const touched = get('touched') !== null;
  const chosen = touched ? [...new Set(getAll('size').map(Number))].filter((n) => SURVEY_SIZES.includes(n)).sort((x, y) => x - y) : [];
  const sizes = chosen.length ? chosen : [...D.sizes];
  const stages = defaultStages();
  // A planned size reads exactly what was submitted (empty means empty). Sizes left out keep the typical answers.
  if (touched) {
    const legacyPj = pick('pj', pjKeys, 'daily');
    for (const size of sizes) {
      for (const [occ] of OCCASIONS) {
        stages[size][occ] = getAll(stageKey(size, occ))
          .slice(0, MAX_COMBOS)
          .map(parseCombo)
          .filter((x): x is Combo => x !== null);
      }
      const pj = get(pjKey(size));
      stages[size].pj = (pjKeys as string[]).includes(pj ?? '') ? (pj as PjKey) : legacyPj;
      stages[size].gear = [...new Set(getAll(gearKey(size)))].filter(isItemKey).slice(0, MAX_GEAR);
    }
  }
  return {
    laundry: num('laundry', D.laundry, 1, 14),
    changes: pick('changes', Object.keys(CHANGES) as ChangesKey[], D.changes),
    spare: pick('spare', Object.keys(SPARE) as SpareKey[], D.spare),
    hot: get('hot') === 'yes',
    cold: get('cold') === 'yes',
    birthMonth: num('birth', D.birthMonth, 0, 11),
    sizes,
    stages,
  };
}
