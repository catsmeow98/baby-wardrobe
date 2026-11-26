/**
 * The goal survey as a list of screens. What is asked depends on the answers so far: the climate screen is skipped when the
 * person has a location, and every size they pick adds its own four screens. Screen ids are short and safe to put in an address.
 */
import { SURVEY_SIZES, type Occasion } from './domain/survey';

export type StepKind = 'laundry' | 'changes' | 'climate' | 'sizes' | Occasion | 'gear';

export interface FlowStep {
  id: string;
  kind: StepKind;
  /** The size a per-size screen is about. */
  size?: number;
}

export const SIZE_KINDS: readonly StepKind[] = ['sleep', 'day', 'dressy', 'gear'];

export const sizeStepId = (size: number, kind: StepKind): string => `s${size}_${kind}`;

export function buildSteps(sizes: readonly number[], opts: { hasLocation: boolean }): FlowStep[] {
  const steps: FlowStep[] = [{ id: 'laundry', kind: 'laundry' }, { id: 'changes', kind: 'changes' }];
  if (!opts.hasLocation) steps.push({ id: 'climate', kind: 'climate' });
  steps.push({ id: 'sizes', kind: 'sizes' });
  const picked = [...new Set(sizes)].filter((s) => SURVEY_SIZES.includes(s)).sort((a, b) => a - b);
  for (const size of picked) for (const kind of SIZE_KINDS) steps.push({ id: sizeStepId(size, kind), kind, size });
  return steps;
}

/** The screen to open on: the one asked for when it exists in this flow, otherwise the first. */
export function startStepId(raw: unknown, steps: readonly FlowStep[]): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return steps.some((s) => s.id === v) ? (v as string) : steps[0].id;
}

/** The first screen of the next size after this one, or null when it is the last size. */
export function nextSizeStart(steps: readonly FlowStep[], size: number): string | null {
  const later = steps.find((s) => s.size !== undefined && s.size > size);
  return later ? later.id : null;
}

/** The size before this one in the flow, or null for the first. */
export function previousSize(sizes: readonly number[], size: number): number | null {
  const picked = [...new Set(sizes)].sort((a, b) => a - b);
  const i = picked.indexOf(size);
  return i > 0 ? picked[i - 1] : null;
}
