/**
 * The setup guide. Which steps there are, what each one explains, and how far along a person is. Progress is worked out
 * from the person's data every time, never stored, so it cannot drift: add a location in Account and the step is done.
 * The only thing stored is when the person dismissed the guide (user_settings.setup_dismissed_at).
 */
export const STEP_ORDER = ['welcome', 'location', 'child', 'measure', 'goals', 'closet'] as const;
export type StepId = (typeof STEP_ORDER)[number];
/** The steps that ask for something. "welcome" only introduces them. */
export const TASK_STEPS = ['location', 'child', 'measure', 'goals', 'closet'] as const;
export type TaskStep = (typeof TASK_STEPS)[number];

export const STEP_TITLE: Record<StepId, string> = {
  welcome: 'Welcome',
  location: 'Where you live',
  child: 'Your child',
  measure: 'First measurement',
  goals: 'Clothing goals',
  closet: 'Your closet',
};

/** One line on how each step helps. Shown at the top of its screen. */
export const STEP_WHY: Record<TaskStep, string> = {
  location: 'Your local weather shows which months are cold, cool or warm, so we can work out how many coats, hats and swimsuits each size needs.',
  child: 'A birth date and growth chart let us predict when your child moves up a size. The current size decides which sizes to plan for.',
  measure: 'A recent length places your child on the growth chart. That predicts when each size starts and ends, which decides which seasons you are buying for.',
  goals: 'A few questions about laundry and daily routine become a target number for every item type in every size, so you can see what is missing.',
  closet: 'Once your closet has items, goals and shopping lists show what you have, what fits, and what to buy next.',
};

export interface SetupFacts {
  placeName: string | null;
  children: number;
  measurements: number;
  goals: number;
  items: number;
  dismissed: boolean;
}

export interface SetupState {
  done: Record<TaskStep, boolean>;
  doneCount: number;
  total: number;
  /** The first step not yet done, or null when everything is. */
  next: TaskStep | null;
  complete: boolean;
}

export function setupState(f: SetupFacts): SetupState {
  const done: Record<TaskStep, boolean> = {
    location: Boolean(f.placeName),
    child: f.children > 0,
    // A measurement needs a child to belong to.
    measure: f.children > 0 && f.measurements > 0,
    goals: f.goals > 0,
    closet: f.items > 0,
  };
  const doneCount = TASK_STEPS.filter((s) => done[s]).length;
  const next = TASK_STEPS.find((s) => !done[s]) ?? null;
  return { done, doneCount, total: TASK_STEPS.length, next, complete: next === null };
}

/** Whether to nudge the person from the dashboard. */
export const showSetupBanner = (f: SetupFacts): boolean => !f.dismissed && !setupState(f).complete;

/** Reads the step from an address. Anything unknown opens the welcome screen. */
export function parseStep(raw: unknown): StepId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (STEP_ORDER as readonly string[]).includes(v as string) ? (v as StepId) : 'welcome';
}

export const stepPath = (s: StepId): string => (s === 'welcome' ? '/welcome' : `/welcome?step=${s}`);

export function neighbours(s: StepId): { prev: StepId | null; next: StepId | null } {
  const i = STEP_ORDER.indexOf(s);
  return { prev: i > 0 ? STEP_ORDER[i - 1] : null, next: i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null };
}

/** How far through the screens the person is, 0 to 1. The welcome screen is the first of six. */
export const stepFraction = (s: StepId): number => (STEP_ORDER.indexOf(s) + 1) / STEP_ORDER.length;
