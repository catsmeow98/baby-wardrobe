/**
 * Goal survey. Turns answers about laundry, weather and daily routine into suggested goal quantities for every size
 * from newborn to 2T.
 *
 * Lifestyle answers (laundry, outfit changes, spare outfits, climate, dressy frequency) apply to every size. What baby
 * wears is answered per stage, because routines change as baby grows: swaddles give way to sleep sacks, shoes start
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

/* ---- stages ---- */
export type StageId = 's1' | 's2' | 's3' | 's4';
export interface Stage {
  id: StageId;
  label: string;
  /** Size group orders (see sizes.ts). */
  sizes: readonly number[];
}
export const STAGES: readonly Stage[] = [
  { id: 's1', label: 'Newborn to 3 months', sizes: [0, 1] },
  { id: 's2', label: '3 to 9 months', sizes: [2, 3] },
  { id: 's3', label: '9 to 18 months', sizes: [4, 5] },
  { id: 's4', label: '18 months to 2T', sizes: [6, 7] },
];
export const SURVEY_SIZES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];
export const stageOfSize = (size: number): Stage => STAGES.find((s) => s.sizes.includes(size)) ?? STAGES[STAGES.length - 1];

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
  dressyPerWeek: DressyKey;
  hot: boolean; // hot summers
  cold: boolean; // cold winters
  birthMonth: number; // 0 to 11, birth or due month. Decides which season each size falls in.
  stages: Record<StageId, StageAnswers>;
}

const c = (freq: Freq, ...cats: CatKey[]): Combo => ({ cats, freq });

/** Typical routines for each stage, used as the starting point and as a fallback when a section is left empty. */
export const defaultStages = (): Record<StageId, StageAnswers> => ({
  s1: {
    sleep: [c('most', 'footy', 'swaddle')],
    day: [c('most', 'sbs', 'pants', 'socks'), c('some', 'footy')],
    dressy: [c('most', 'romper')],
  },
  s2: {
    sleep: [c('most', 'footy', 'sack')],
    day: [c('most', 'sbs', 'pants', 'socks'), c('some', 'top', 'pants')],
    dressy: [c('most', 'romper')],
  },
  s3: {
    sleep: [c('most', 'footless', 'sack')],
    day: [c('most', 'top', 'pants', 'socks'), c('some', 'sbs', 'pants')],
    dressy: [c('most', 'romper')],
  },
  s4: {
    sleep: [c('most', 'pjs')],
    day: [c('most', 'top', 'pants', 'socks')],
    dressy: [c('most', 'dress')],
  },
});

export const defaultAnswers = (birthMonth = 0): Answers => ({
  laundry: 3,
  changes: 'one-two',
  spare: 'few',
  dressyPerWeek: 'rare',
  hot: false,
  cold: false,
  birthMonth,
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
  stage: StageId;
  season: Season;
  temp: Temp;
  rows: Suggestion[];
  notes: string[];
}

export const comboText = (combo: Combo): string => combo.cats.map((k) => CAT_LABELS[k]).join(' + ');

/** size is a size group order (0 to 7). season is the season in which baby is expected to wear that size. */
export function suggest(a: Answers, size: number, season: Season): SizeSuggestion {
  const stage = stageOfSize(size);
  const defaults = defaultStages()[stage.id];
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

  const st = a.stages[stage.id];
  const sleepCombos = st.sleep.length ? st.sleep : (notes.push('No sleep combinations were chosen for this stage, so typical ones were used.'), defaults.sleep);
  const dayCombos = st.day.length ? st.day : (notes.push('No daytime combinations were chosen for this stage, so typical ones were used.'), defaults.day);

  const dayOutfits = Math.ceil(L * changes) + spare;
  place(dayCombos, dayOutfits, `${dayOutfits} daytime outfits`);

  const nights = L + (changes >= 3 ? 1 : 0);
  place(sleepCombos, nights, `${nights} nights`);

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
  const young = stage.id === 's1' || stage.id === 's2';
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
    stage: stage.id,
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

export function suggestAll(a: Answers, sizes: readonly number[], seasonOf: (size: number) => Season): SizeSuggestion[] {
  return sizes.map((s) => suggest(a, s, seasonOf(s)));
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

export const stageKey = (stage: StageId, occasion: Occasion): string => `${stage}_${occasion}`;

export function answersToParams(a: Answers): URLSearchParams {
  const p = new URLSearchParams({
    touched: '1',
    laundry: String(a.laundry),
    changes: a.changes,
    spare: a.spare,
    dressy: a.dressyPerWeek,
    hot: a.hot ? 'yes' : 'no',
    cold: a.cold ? 'yes' : 'no',
    birth: String(a.birthMonth),
  });
  for (const stage of STAGES) for (const [occ] of OCCASIONS) for (const x of a.stages[stage.id][occ]) if (x.cats.length) p.append(stageKey(stage.id, occ), comboToString(x));
  return p;
}

/**
 * Reads answers from a query string. Anything missing or invalid falls back to a default, numbers are clamped, and
 * unknown categories are dropped. On the first visit (no "touched" field) the stage combinations are the typical ones.
 */
export function parseAnswers(get: (k: string) => string | null, getAll: (k: string) => string[], fallbackBirthMonth = 0): Answers {
  const D = defaultAnswers(fallbackBirthMonth);
  const num = (k: string, d: number, lo: number, hi: number) => {
    const raw = get(k);
    const v = Number(raw);
    return raw !== null && raw !== '' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => ((allowed as readonly string[]).includes(get(k) ?? '') ? (get(k) as T) : d);
  const touched = get('touched') !== null;
  const stages = defaultStages();
  if (touched) {
    for (const stage of STAGES) {
      for (const [occ] of OCCASIONS) {
        stages[stage.id][occ] = getAll(stageKey(stage.id, occ))
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
    dressyPerWeek: pick('dressy', Object.keys(DRESSY) as DressyKey[], D.dressyPerWeek),
    hot: get('hot') === 'yes',
    cold: get('cold') === 'yes',
    birthMonth: num('birth', D.birthMonth, 0, 11),
    stages,
  };
}
