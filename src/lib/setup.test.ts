import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP_ORDER, TASK_STEPS, STEP_WHY, STEP_TITLE, neighbours, parseStep, setupState, showSetupBanner, stepFraction, stepPath, type SetupFacts } from './setup';

const empty: SetupFacts = { placeName: null, children: 0, measurements: 0, goals: 0, items: 0, dismissed: false };

test('a new account has nothing done and starts at the location step', () => {
  const s = setupState(empty);
  assert.equal(s.doneCount, 0);
  assert.equal(s.total, 5);
  assert.equal(s.next, 'location');
  assert.equal(s.complete, false);
});

test('progress follows the data, in any order', () => {
  const s = setupState({ ...empty, children: 1, items: 3 });
  assert.deepEqual(s.done, { location: false, child: true, measure: false, goals: false, closet: true });
  assert.equal(s.doneCount, 2);
  assert.equal(s.next, 'location'); // the first one still open
});

test('a measurement does not count without a child', () => {
  assert.equal(setupState({ ...empty, measurements: 2 }).done.measure, false);
  assert.equal(setupState({ ...empty, children: 1, measurements: 1 }).done.measure, true);
});

test('everything done is complete, with no next step', () => {
  const s = setupState({ placeName: 'Boston, MA', children: 1, measurements: 1, goals: 4, items: 9, dismissed: false });
  assert.equal(s.complete, true);
  assert.equal(s.next, null);
  assert.equal(s.doneCount, 5);
});

test('the banner shows only while unfinished and not dismissed', () => {
  assert.equal(showSetupBanner(empty), true);
  assert.equal(showSetupBanner({ ...empty, dismissed: true }), false);
  assert.equal(showSetupBanner({ placeName: 'x', children: 1, measurements: 1, goals: 1, items: 1, dismissed: false }), false);
});

test('step names from an address: unknown or odd values open the welcome screen', () => {
  assert.equal(parseStep('goals'), 'goals');
  assert.equal(parseStep(['child', 'goals']), 'child');
  for (const bad of [undefined, null, '', 'GOALS', 'admin', '../x', 42, {}]) assert.equal(parseStep(bad), 'welcome', String(bad));
});

test('steps chain in order, with no step before the first or after the last', () => {
  assert.deepEqual(neighbours('welcome'), { prev: null, next: 'location' });
  assert.deepEqual(neighbours('child'), { prev: 'location', next: 'measure' });
  assert.deepEqual(neighbours('closet'), { prev: 'goals', next: null });
  const walked: string[] = ['welcome'];
  for (let s = neighbours('welcome').next; s; s = neighbours(s).next) walked.push(s);
  assert.deepEqual(walked, [...STEP_ORDER]);
});

test('paths and the progress bar', () => {
  assert.equal(stepPath('welcome'), '/welcome');
  assert.equal(stepPath('measure'), '/welcome?step=measure');
  assert.equal(stepFraction('welcome'), 1 / 6);
  assert.equal(stepFraction('closet'), 1);
});

test('every step has a title and every task step says how it helps', () => {
  for (const s of STEP_ORDER) assert.ok(STEP_TITLE[s].length > 0);
  for (const s of TASK_STEPS) assert.ok(STEP_WHY[s].length > 40);
});
