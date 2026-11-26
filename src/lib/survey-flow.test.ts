import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSteps, nextSizeStart, previousSize, sizeStepId, startStepId } from './survey-flow';

const ids = (sizes: number[], hasLocation: boolean) => buildSteps(sizes, { hasLocation }).map((s) => s.id);

test('the basic screens come first, climate only without a location', () => {
  assert.deepEqual(ids([], true), ['laundry', 'changes', 'sizes']);
  assert.deepEqual(ids([], false), ['laundry', 'changes', 'climate', 'sizes']);
});

test('each picked size adds sleep, day, dressy and outerwear screens, in size order', () => {
  assert.deepEqual(ids([4, 3], true), ['laundry', 'changes', 'sizes', 's3_sleep', 's3_day', 's3_dressy', 's3_gear', 's4_sleep', 's4_day', 's4_dressy', 's4_gear']);
});

test('sizes outside the survey and repeats are ignored', () => {
  assert.deepEqual(ids([3, 3, 99, -1], true).filter((i) => i.startsWith('s')).length, 4 + 1); // 4 screens for size 3, plus "sizes"
});

test('screen ids carry the size', () => {
  const steps = buildSteps([2], { hasLocation: true });
  assert.equal(steps.find((s) => s.id === 's2_gear')!.size, 2);
  assert.equal(sizeStepId(5, 'sleep'), 's5_sleep');
});

test('starting screen: a known id opens there, anything else opens the first', () => {
  const steps = buildSteps([3], { hasLocation: true });
  assert.equal(startStepId('s3_day', steps), 's3_day');
  assert.equal(startStepId(['s3_gear', 'x'], steps), 's3_gear');
  for (const bad of [undefined, '', 's9_day', 'climate', '../x', 7]) assert.equal(startStepId(bad, steps), 'laundry', String(bad));
});

test('next and previous size', () => {
  const steps = buildSteps([2, 4, 6], { hasLocation: true });
  assert.equal(nextSizeStart(steps, 2), 's4_sleep');
  assert.equal(nextSizeStart(steps, 6), null);
  assert.equal(previousSize([2, 4, 6], 4), 2);
  assert.equal(previousSize([2, 4, 6], 2), null);
  assert.equal(previousSize([6, 2], 6), 2);
});
