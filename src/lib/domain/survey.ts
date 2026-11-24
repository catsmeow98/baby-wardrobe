/**
 * Goal survey: turns answers about laundry, weather and daily routine into suggested goal quantities per category.
 * The multipliers and weights are my own starting guesses. They are not drawn from research, so treat them as a
 * first draft to tune with real parents.
 */
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type Temp = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

/** Keys used inside the survey. CATEGORY_NAMES maps each to the category name in the database. */
export const CATEGORY_NAMES = {
  sbs: 'Short-sleeve bodysuits',
  lsb: 'Long-sleeve bodysuits',
  tops: 'Tops',
  bot: 'Bottoms',
  footy: 'Footy sleepers',
  footless: 'Footless sleepers',
  sleep: 'Other sleepwear',
  swaddle: 'Swaddles',
  sack: 'Sleep sacks',
  outfit: 'Outfits',
  outer: 'Outerwear',
  acc: 'Accessories',
  shoes: 'Footwear',
  swim: 'Swimwear',
} as const;
export type CatKey = keyof typeof CATEGORY_NAMES;
export const CAT_KEYS = Object.keys(CATEGORY_NAMES) as CatKey[];

export const SLEEP_OPTS = [
  ['footy', 'Footed sleeper'], ['footless', 'Footless sleeper'], ['pjs', 'Two-piece pajamas'], ['gown', 'Sleep gown'],
  ['bodysuit', 'Bodysuit'], ['sack', 'Sleep sack'], ['swaddle', 'Swaddle'],
] as const;
export const DAY_OPTS = [
  ['bodysuit', 'Bodysuit on its own'], ['bodysuitpants', 'Bodysuit with pants or leggings'],
  ['toppants', 'Shirt with pants, shorts, or a skirt'], ['romper', 'Romper or one-piece outfit'], ['dress', 'Dress'],
  ['sleepers', 'Footed sleeper'],
] as const;
export const DRESS_OPTS = [
  ['romper', 'Romper'], ['dress', 'Dress'], ['set', 'Matching set'], ['shirtpants', 'Collared shirt and pants'],
  ['sweaterset', 'Sweater and bottoms'],
] as const;

export interface Answers {
  laundry: number; // days between loads: 1 to 14
  changes: number; // outfit changes per day: 1 to 6
  spare: number; // spare days of clothes
  hot: boolean; // hot summers
  cold: boolean; // cold winters
  season: 'auto' | Season;
  stash: boolean; // keep a spare stash
  outings: 'low' | 'medium' | 'high';
  sleepWear: string[];
  dayWear: string[];
  dressWear: string[];
}

export const DEFAULT_ANSWERS: Answers = {
  laundry: 3, changes: 2, spare: 1, hot: false, cold: false, season: 'auto', stash: false, outings: 'medium',
  sleepWear: ['footy', 'sack'], dayWear: ['bodysuitpants', 'toppants'], dressWear: ['romper'],
};

export const seasonOfMonth = (monthIndex: number): Season =>
  monthIndex === 11 || monthIndex < 2 ? 'winter' : monthIndex < 5 ? 'spring' : monthIndex < 8 ? 'summer' : 'fall';

const TEMP_TEXT: Record<Temp, string> = { hot: 'hot weather', warm: 'warm weather', mild: 'mild weather', cool: 'cool weather', cold: 'cold weather' };
const SLEEP_W: Record<string, Record<Temp, number>> = {
  footy: { hot: 0.2, warm: 0.5, mild: 1, cool: 1.3, cold: 1.5 },
  footless: { hot: 1.5, warm: 1.3, mild: 1, cool: 0.7, cold: 0.5 },
  pjs: { hot: 1, warm: 1, mild: 1, cool: 1, cold: 1 },
  gown: { hot: 1.2, warm: 1.1, mild: 1, cool: 0.8, cold: 0.6 },
  bodysuit: { hot: 1.3, warm: 1, mild: 0.7, cool: 0.4, cold: 0.2 },
};

export interface Suggestion {
  key: CatKey;
  name: string;
  qty: number;
  why: string;
}

/** size is a size group order (0 to 9). season is the season in which the child will wear that size. */
export function suggest(a: Answers, size: number, season: Season): { temp: Temp; rows: Suggestion[] } {
  const L = a.laundry;
  const spare = a.spare;
  const C = a.changes;
  const D = L + spare; // days of clothes to cover
  const temp: Temp = season === 'summer' ? (a.hot ? 'hot' : 'warm') : season === 'winter' ? (a.cold ? 'cold' : 'cool') : 'mild';
  const T = TEMP_TEXT[temp];
  const short = { hot: 0.9, warm: 0.7, mild: 0.5, cool: 0.3, cold: 0.15 }[temp];
  const layers = Math.min(20, Math.ceil(D * C));
  const r: Partial<Record<CatKey, number>> = {};
  const why: Partial<Record<CatKey, string[]>> = {};
  const add = (cat: CatKey, q: number, w?: string) => {
    const n = Math.max(0, Math.round(q));
    r[cat] = (r[cat] ?? 0) + n;
    if (n && w) (why[cat] ??= []).push(w);
  };
  const set = (cat: CatKey, q: number, w: string) => {
    r[cat] = Math.max(0, Math.round(q));
    why[cat] = [w];
  };
  const body = (n: number, w: string) => {
    add('sbs', Math.ceil(n * short), `${w} ${Math.round(short * 100)}% short sleeve for ${T}.`);
    add('lsb', Math.ceil(n * (1 - short)), w);
  };

  // everyday clothes
  let dayOpts = a.dayWear.filter((o) => !(size >= 7 && (o === 'bodysuit' || o === 'bodysuitpants')));
  const dayFallback = dayOpts.length === 0;
  if (dayFallback) dayOpts = size >= 7 ? ['toppants'] : size <= 4 ? ['bodysuitpants'] : ['bodysuitpants', 'toppants'];
  const pn = Math.ceil(layers / dayOpts.length);
  const fb = dayFallback ? ' (chosen by age)' : '';
  for (const o of dayOpts) {
    if (o === 'bodysuit') body(pn, `${pn} bodysuit-only outfits across ${D} days${fb}.`);
    else if (o === 'bodysuitpants') {
      body(pn, `${pn} bodysuit outfits across ${D} days${fb}.`);
      add('bot', pn, `Pants to go with ${pn} bodysuit outfits.`);
    } else if (o === 'toppants') {
      add('tops', pn, `${pn} shirt outfits across ${D} days${fb}.`);
      add('bot', pn, `Bottoms to go with ${pn} shirt outfits.`);
    } else if (o === 'romper' || o === 'dress') add('outfit', pn, `${pn} everyday ${o === 'dress' ? (pn > 1 ? 'dresses' : 'dress') : pn > 1 ? 'rompers' : 'romper'}.`);
    else if (o === 'sleepers') add('footy', pn, `${pn} footed sleeper${pn > 1 ? 's' : ''} worn as daywear.`);
  }
  if (a.stash) {
    if (dayOpts.some((o) => o === 'bodysuit' || o === 'bodysuitpants')) body(2, '2 extra for the spare stash.');
    else add('tops', 2, '2 extra for the spare stash.');
    add('bot', 1, '1 extra pair for the spare stash.');
  }

  // sleep
  const N = D + (C >= 3 ? 1 : 0);
  let sleepOpts = a.sleepWear.filter((o) => SLEEP_W[o]);
  const sleepFallback = sleepOpts.length === 0;
  if (sleepFallback) sleepOpts = size >= 7 ? ['pjs'] : temp === 'hot' || temp === 'warm' ? ['footless'] : temp === 'mild' ? ['footy', 'footless'] : ['footy'];
  const wsum = sleepOpts.reduce((t, o) => t + SLEEP_W[o][temp], 0);
  for (const o of sleepOpts) {
    const n = Math.ceil((N * SLEEP_W[o][temp]) / wsum);
    const w = `${n} of ${N} nights${sleepFallback ? ' (chosen by age and weather)' : ''}, weighted for ${T}.`;
    if (o === 'footy') add('footy', n, w);
    else if (o === 'footless') add('footless', n, w);
    else if (o === 'pjs' || o === 'gown') add('sleep', n, w);
    else body(n, `${n} bodysuit nights.`);
  }
  if (a.sleepWear.includes('sack')) set('sack', size <= 6 ? (L >= 7 ? 3 : 2) : 0, size <= 6 ? 'One to wear and spares for washing.' : 'Usually outgrown by this size.');
  else set('sack', 0, 'Not part of your sleep routine.');
  if (a.sleepWear.includes('swaddle')) set('swaddle', size <= 3 ? (L >= 7 ? 3 : 2) : 0, size <= 3 ? 'One to use and spares for washing.' : 'Most babies outgrow swaddles by this size.');
  else set('swaddle', 0, 'Not part of your sleep routine.');

  // dressy
  const dr = a.dressWear.length ? a.dressWear : ['romper'];
  const base = { low: 1, medium: 2, high: 4 }[a.outings] + (a.stash ? 1 : 0);
  const dper = Math.ceil(base / dr.length);
  const NAMES: Record<string, [string, string]> = {
    romper: ['romper', 'rompers'], dress: ['dress', 'dresses'], set: ['matching set', 'matching sets'], sweaterset: ['sweater set', 'sweater sets'],
  };
  for (const o of dr) {
    if (o === 'shirtpants') {
      add('tops', dper, `${dper} collared shirt${dper > 1 ? 's' : ''} for dressy days.`);
      add('bot', dper, `${dper} dressy bottom${dper > 1 ? 's' : ''}.`);
    } else if (NAMES[o]) add('outfit', dper, `${dper} dressy ${NAMES[o][dper > 1 ? 1 : 0]}.`);
  }

  // weather and age driven
  set('outer', { cold: 2, cool: 1, mild: 1, warm: 0, hot: 0 }[temp],
    temp === 'cold' ? 'A coat and a warmer layer for cold winters.' : temp === 'hot' || temp === 'warm' ? 'Not needed in warm weather.' : 'A light jacket or coat.');
  const socks = Math.ceil(D * { cold: 1.2, cool: 1, mild: 0.8, warm: 0.5, hot: 0.3 }[temp]);
  const hats = temp === 'cold' ? 2 : 1;
  set('acc', Math.max(3, Math.min(16, socks + hats)), `${socks} pairs of socks for ${D} days plus ${hats} hat${hats > 1 ? 's' : ''}.`);
  set('shoes', size >= 5 ? (a.cold && season === 'winter' ? 2 : 1) : 0, size >= 5 ? 'Walking begins around this size.' : 'Not needed before walking.');
  const sw = ({ hot: 2, warm: 1 } as Partial<Record<Temp, number>>)[temp] ?? 0;
  set('swim', size >= 2 ? sw : 0, size >= 2 && sw ? 'Warm weather means water play.' : 'Not needed for this season.');

  return {
    temp,
    rows: CAT_KEYS.map((key) => ({ key, name: CATEGORY_NAMES[key], qty: r[key] ?? 0, why: (why[key] ?? ['Not part of your answers.']).join(' ') })),
  };
}

/** Reads answers from query-string style input, falling back to defaults and clamping every number. */
export function parseAnswers(get: (k: string) => string | null, getAll: (k: string) => string[]): Answers {
  const num = (k: string, d: number, lo: number, hi: number) => {
    const v = Number(get(k));
    return get(k) !== null && get(k) !== '' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d;
  };
  const pick = <T extends string>(k: string, allowed: readonly T[], d: T): T => (allowed as readonly string[]).includes(get(k) ?? '') ? (get(k) as T) : d;
  const multi = (k: string, opts: readonly (readonly [string, string])[], d: string[]) => {
    if (get('touched') === null) return d; // first visit: show the defaults
    const ok = new Set(opts.map((o) => o[0]));
    return getAll(k).filter((v) => ok.has(v));
  };
  const D = DEFAULT_ANSWERS;
  return {
    laundry: num('laundry', D.laundry, 1, 14),
    changes: num('changes', D.changes, 1, 6),
    spare: num('spare', D.spare, 0, 7),
    hot: get('hot') === 'yes',
    cold: get('cold') === 'yes',
    season: pick('season', ['auto', 'spring', 'summer', 'fall', 'winter'] as const, 'auto'),
    stash: get('stash') === 'yes',
    outings: pick('outings', ['low', 'medium', 'high'] as const, 'medium'),
    sleepWear: multi('sleep', SLEEP_OPTS, D.sleepWear),
    dayWear: multi('day', DAY_OPTS, D.dayWear),
    dressWear: multi('dress', DRESS_OPTS, D.dressWear),
  };
}
