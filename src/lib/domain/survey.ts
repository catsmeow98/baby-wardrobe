/**
 * Goal survey. Turns answers about laundry, weather and daily routine into suggested goal quantities for every size
 * from newborn to 2T.
 *
 * Lifestyle answers (laundry, outfit changes, spare outfits, climate, dressy frequency) apply to every size. What baby
 * wears is answered per size, because routines change as baby grows: swaddles give way to sleep sacks, shoes start
 * once walking begins. Each answer is a list of combinations, such as "long-sleeve bodysuit + bottoms + socks", each
 * with a how-often setting.
 *
 * The multipliers, caps and weights below are my own starting guesses, not research. Treat them as a first draft to
 * tune with real parents.
 */
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Temp = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

/** Keys used inside the survey. Each maps to the name of a built-in category in the database. */
export const CATEGORY_NAMES = {
  sbs: 'Short-sleeve bodysuit',
  lsb: 'Long-sleeve bodysuit',
  top: 'Top',
  sweater: 'Sweater',
  pants: 'Pants',
  shorts: 'Shorts',
  leggings: 'Leggings',
  footy: 'Footy sleeper',
  footless: 'Footless sleeper',
  pjs: 'Pajama set',
  gown: 'Sleep gown',
  sack: 'Sleep sack',
  swaddle: 'Swaddle',
  romper: 'Romper',
  dress: 'Dress',
  dshirt: 'Dress shirt',
  dpants: 'Dress pants',
  set: 'Matching set',
  coat: 'Coat',
  jacket: 'Light jacket',
  bunting: 'Bunting',
  snowsuit: 'Snowsuit',
  socks: 'Socks',
  hat: 'Hat',
  mittens: 'Mittens',
  bib: 'Bib',
  shoes: 'Shoes',
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
  { label: 'Bodysuits and tops', keys: ['sbs', 'lsb', 'top', 'sweater'] },
  { label: 'Bottoms', keys: ['pants', 'shorts', 'leggings'] },
  { label: 'Sleep', keys: ['footy', 'footless', 'pjs', 'gown', 'sack', 'swaddle'] },
  { label: 'Outfits and dressy', keys: ['romper', 'dress', 'dshirt', 'dpants', 'set'] },
  { label: 'Outerwear', keys: ['coat', 'jacket', 'bunting', 'snowsuit'] },
  { label: 'Accessories', keys: ['socks', 'hat', 'mittens', 'bib'] },
  { label: 'Footwear and swim', keys: ['shoes', 'boots', 'swim', 'rash'] },
];

/* ---- how often ---- */
export type Freq = 'most' | 'some' | 'rare';
export const FREQ: Record<Freq, { label: string; weight: number }> = {
  most: { label: 'Most of the time', weight: 3 },
  some: { label: 'Sometimes', weight: 2 },
  rare: { label: 'Occasionally', weight: 1 },
};
export const FREQ_KEYS = Object.keys(FREQ) as Freq[];

export interface Combo {
  cats: CatKey[];
  freq: Freq;
}
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

/** How often pajamas are changed. Together with the days between laundry loads this decides how many sets are needed. */
export const PJ_CHANGE = {
  daily: { label: 'Every day', days: 1 },
  '2-3': { label: 'Every 2 to 3 days', days: 2.5 },
  '4-plus': { label: 'Every 4 days or more', days: 4 },
} as const;
export type PjKey = keyof typeof PJ_CHANGE;

export const DRESSY = {
  rare: { label: 'Less than once a week', perWeek: 0.5 },
  '1-2': { label: '1 to 2 times', perWeek: 2 },
  '3-4': { label: '3 to 4 times', perWeek: 4 },
  '5-plus': { label: '5 or more times', perWeek: 6 },
} as const;
export type DressyKey = keyof typeof DRESSY;

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface StageAnswers {
  sleep: Combo[];
  day: Combo[];
  dressy: Combo[];
}
export interface Answers {
  laundry: number; // days between loads, 1 to 14
  changes: ChangesKey;
  spare: SpareKey;
  pjChange: PjKey;
  dressyPerWeek: DressyKey;
  hot: boolean; // hot summers
  cold: boolean; // cold winters
  birthMonth: number; // 0 to 11, birth or due month. Decides which months and season each size falls in.
  sizes: number[]; // size orders to plan for, ascending
  stages: Record<number, StageAnswers>; // combinations for every size order, 0 to 7
}

const c = (freq: Freq, ...cats: CatKey[]): Combo => ({ cats, freq });

const cloneAnswers = (x: StageAnswers): StageAnswers => ({
  sleep: x.sleep.map((y) => ({ cats: [...y.cats], freq: y.freq })),
  day: x.day.map((y) => ({ cats: [...y.cats], freq: y.freq })),
  dressy: x.dressy.map((y) => ({ cats: [...y.cats], freq: y.freq })),
});

/** Typical routines, used as the starting point for each size and as a fallback when a section is left empty. */
const TYPICAL: readonly StageAnswers[] = [
  { // newborn and 0-3M
    sleep: [c('most', 'footy', 'swaddle')],
    day: [c('most', 'sbs', 'pants', 'socks'), c('some', 'footy')],
    dressy: [c('most', 'romper')],
  },
  { // 3-9M
    sleep: [c('most', 'footy', 'sack')],
    day: [c('most', 'sbs', 'pants', 'socks'), c('some', 'top', 'pants')],
    dressy: [c('most', 'romper')],
  },
  { // 9-18M
    sleep: [c('most', 'footless', 'sack')],
    day: [c('most', 'top', 'pants', 'socks'), c('some', 'sbs', 'pants')],
    dressy: [c('most', 'romper')],
  },
  { // 18M-2T
    sleep: [c('most', 'pjs')],
    day: [c('most', 'top', 'pants', 'socks')],
    dressy: [c('most', 'dress')],
  },
];
const typicalFor = (size: number): StageAnswers => cloneAnswers(TYPICAL[size <= 1 ? 0 : size <= 3 ? 1 : size <= 5 ? 2 : 3]);

export const defaultStages = (): Record<number, StageAnswers> => Object.fromEntries(SURVEY_SIZES.map((size) => [size, typicalFor(size)]));

export const defaultAnswers = (birthMonth = 0, sizes: readonly number[] = SURVEY_SIZES): Answers => ({
  laundry: 3,
  changes: 'one-two',
  spare: 'few',
  pjChange: 'daily',
  dressyPerWeek: 'rare',
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
  if (span >= 12) return { startAge, endAge, age, months: 'All year', short: 'All year' };
  if (span === 1) return { startAge, endAge, age, months: MONTH_NAMES[first], short: MONTH_SHORT[first] };
  return { startAge, endAge, age, months: `${MONTH_NAMES[first]} to ${MONTH_NAMES[last]}`, short: `${MONTH_SHORT[first]}-${MONTH_SHORT[last]}` };
}

/* ---- the engine ---- */
const TEMP_TEXT: Record<Temp, string> = { hot: 'hot weather', warm: 'warm weather', mild: 'mild weather', cool: 'cool weather', cold: 'cold weather' };
/** A sleep sack or swaddle is worn one at a time, so a few spares are enough however often it is used. */
const CAPPED: readonly CatKey[] = ['sack', 'swaddle'];
const CAP = 3;
const MAX_GOAL = 99;

export interface Suggestion {
  key: CatKey;
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

export const comboText = (combo: Combo): string => combo.cats.map((k) => CAT_LABELS[k]).join(' + ');

/** size is a size group order (0 to 7). season is the season in which baby is expected to wear that size. */
export function suggest(a: Answers, size: number, season: Season, window?: SizeWindow): SizeSuggestion {
  const defaults = typicalFor(size);
  const notes: string[] = [];
  const L = a.laundry;
  const changes = CHANGES[a.changes].n;
  const spare = SPARE[a.spare].n;
  const temp: Temp = season === 'summer' ? (a.hot ? 'hot' : 'warm') : season === 'winter' ? (a.cold ? 'cold' : 'cool') : 'mild';
  const T = TEMP_TEXT[temp];

  const qty: Partial<Record<CatKey, number>> = {};
  const why: Partial<Record<CatKey, string[]>> = {};
  const add = (cat: CatKey, n: number, w: string) => {
    if (n <= 0) return;
    qty[cat] = (qty[cat] ?? 0) + n;
    (why[cat] ??= []).push(w);
  };

  /** Shares a total number of outfits across combinations by how often each is worn, and adds each piece. */
  const place = (combos: Combo[], total: number, label: string) => {
    const sum = combos.reduce((t, x) => t + FREQ[x.freq].weight, 0);
    for (const x of combos) {
      const n = Math.ceil((total * FREQ[x.freq].weight) / sum);
      for (const cat of x.cats) {
        const m = CAPPED.includes(cat) ? Math.min(n, CAP) : n;
        add(cat, m, `${m} for ${label} (${comboText(x)}).`);
      }
    }
  };

  const st = a.stages[size] ?? defaults;
  const sleepCombos = st.sleep.length ? st.sleep : (notes.push('No sleep combinations were chosen for this size, so typical ones were used.'), defaults.sleep);
  const dayCombos = st.day.length ? st.day : (notes.push('No daytime combinations were chosen for this size, so typical ones were used.'), defaults.day);

  const dayOutfits = Math.ceil(L * changes) + spare;
  place(dayCombos, dayOutfits, `${dayOutfits} daytime outfits`);

  // One pajama set per change between laundry loads: changed daily means a set for every day between loads.
  const nights = Math.max(1, Math.ceil(L / PJ_CHANGE[a.pjChange].days));
  place(sleepCombos, nights, `${nights} pajama change${nights > 1 ? 's' : ''} between loads`);

  if (st.dressy.length) {
    const dressyOutfits = Math.max(1, Math.ceil((DRESSY[a.dressyPerWeek].perWeek * L) / 7));
    place(st.dressy, dressyOutfits, `${dressyOutfits} dressy outfit${dressyOutfits > 1 ? 's' : ''}`);
  }

  // Weather decides outerwear, mittens, hats and swimwear. For outerwear, mittens and swimwear it is whichever is
  // larger: what the combinations ask for, or what the weather needs.
  const ensure = (cat: CatKey, n: number, w: string) => {
    if (n > (qty[cat] ?? 0)) {
      qty[cat] = n;
      why[cat] = [w];
    }
  };
  const young = size <= 3;
  if (temp === 'cold') {
    ensure('coat', 1, 'A coat for cold winters.');
    ensure(young ? 'bunting' : 'snowsuit', 1, young ? 'A bunting keeps a small baby warm outdoors.' : 'A snowsuit for playing in the cold.');
    ensure('mittens', 1, 'Mittens for cold winters.');
  } else if (temp === 'cool') ensure('jacket', 1, 'A light jacket for cool weather.');
  else if (temp === 'mild') ensure('jacket', 1, 'A light jacket for changeable weather.');
  const swim = size >= 2 ? ({ hot: 2, warm: 1 } as Partial<Record<Temp, number>>)[temp] ?? 0 : 0;
  ensure('swim', swim, 'Warm weather means water play.');
  const hats = { cold: 2, cool: 1, mild: 0, warm: 1, hot: 1 }[temp];
  add('hat', hats, `${hats} hat${hats > 1 ? 's' : ''} for ${T}.`);

  // Shoes only make sense once walking starts, whatever the combinations say.
  if (young) {
    if (qty.shoes || qty.boots) notes.push('Shoes and boots were left out: they are not needed before walking.');
    for (const k of ['shoes', 'boots'] as const) {
      qty[k] = 0;
      why[k] = ['Not needed before walking.'];
    }
  }

  return {
    size,
    window: window ?? sizeWindow(a.birthMonth, size),
    season,
    temp,
    notes,
    rows: CAT_KEYS.map((key) => ({
      key,
      name: CATEGORY_NAMES[key],
      qty: Math.min(MAX_GOAL, Math.max(0, Math.round(qty[key] ?? 0))),
      why: (why[key] ?? ['Not part of your answers.']).join(' '),
    })),
  };
}

export function suggestAll(a: Answers, sizes: readonly number[], seasonOf: (size: number) => Season, windowOf?: (size: number) => SizeWindow | undefined): SizeSuggestion[] {
  return sizes.map((s) => suggest(a, s, seasonOf(s), windowOf?.(s)));
}

/* ---- reading and writing answers as a query string ---- */
const MAX_COMBOS = 6;
const MAX_PIECES = 8;

export const comboToString = (x: Combo): string => `${x.cats.join('.')}~${x.freq}`;

export function parseCombo(s: string): Combo | null {
  const [pieces, freq = 'most'] = s.split('~');
  if (!(FREQ_KEYS as string[]).includes(freq)) return null;
  const cats = [...new Set(pieces.split('.'))].filter((k): k is CatKey => (CAT_KEYS as string[]).includes(k)).slice(0, MAX_PIECES);
  return cats.length ? { cats, freq: freq as Freq } : null;
}

export const stageKey = (size: number, occasion: Occasion): string => `z${size}_${occasion}`;

export function answersToParams(a: Answers): URLSearchParams {
  const p = new URLSearchParams({
    touched: '1',
    laundry: String(a.laundry),
    changes: a.changes,
    spare: a.spare,
    pj: a.pjChange,
    dressy: a.dressyPerWeek,
    hot: a.hot ? 'yes' : 'no',
    cold: a.cold ? 'yes' : 'no',
    birth: String(a.birthMonth),
  });
  for (const size of a.sizes) p.append('size', String(size));
  for (const size of a.sizes) for (const [occ] of OCCASIONS) for (const x of a.stages[size][occ]) if (x.cats.length) p.append(stageKey(size, occ), comboToString(x));
  return p;
}

/**
 * Reads answers from a query string. Anything missing or invalid falls back to a default, numbers are clamped, and
 * unknown categories are dropped. On the first visit (no "touched" field) the combinations are the typical ones.
 */
export function parseAnswers(get: (k: string) => string | null, getAll: (k: string) => string[], fallbackBirthMonth = 0, fallbackSizes: readonly number[] = SURVEY_SIZES): Answers {
  const D = defaultAnswers(fallbackBirthMonth, fallbackSizes);
  const num = (k: string, d: number, lo: number, hi: number) => {
    const raw = get(k);
    const v = Number(raw);
    return raw !== null && raw !== '' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => ((allowed as readonly string[]).includes(get(k) ?? '') ? (get(k) as T) : d);
  const touched = get('touched') !== null;
  const chosen = touched ? [...new Set(getAll('size').map(Number))].filter((n) => SURVEY_SIZES.includes(n)).sort((x, y) => x - y) : [];
  const sizes = chosen.length ? chosen : [...D.sizes];
  const stages = defaultStages();
  // A planned size reads exactly what was submitted (empty means empty). Sizes left out keep the typical answers.
  if (touched) {
    for (const size of sizes) {
      for (const [occ] of OCCASIONS) {
        stages[size][occ] = getAll(stageKey(size, occ))
          .slice(0, MAX_COMBOS)
          .map(parseCombo)
          .filter((x): x is Combo => x !== null);
      }
    }
  }
  return {
    laundry: num('laundry', D.laundry, 1, 14),
    changes: pick('changes', Object.keys(CHANGES) as ChangesKey[], D.changes),
    spare: pick('spare', Object.keys(SPARE) as SpareKey[], D.spare),
    pjChange: pick('pj', Object.keys(PJ_CHANGE) as PjKey[], D.pjChange),
    dressyPerWeek: pick('dressy', Object.keys(DRESSY) as DressyKey[], D.dressyPerWeek),
    hot: get('hot') === 'yes',
    cold: get('cold') === 'yes',
    birthMonth: num('birth', D.birthMonth, 0, 11),
    sizes,
    stages,
  };
}
