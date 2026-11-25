import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackShift, isUsable, parseTagRange, resolveFitRange, shiftRange } from './index';

test('tag ranges map onto the size groups they cover', () => {
  assert.deepEqual(parseTagRange('6-12'), { label: '6-12M', fitFrom: 3, fitTo: 4 });
  assert.deepEqual(parseTagRange('0-9'), { label: '0-9M', fitFrom: 1, fitTo: 3 });
  assert.deepEqual(parseTagRange('3-12'), { label: '3-12M', fitFrom: 2, fitTo: 4 });
  assert.deepEqual(parseTagRange('12-24'), { label: '12-24M', fitFrom: 5, fitTo: 6 });
  assert.deepEqual(parseTagRange('0-3'), { label: '0-3M', fitFrom: 1, fitTo: 1 });
  assert.deepEqual(parseTagRange('6-9'), { label: '6-9M', fitFrom: 3, fitTo: 3 });
  assert.deepEqual(parseTagRange('18-36'), { label: '18-36M', fitFrom: 6, fitTo: 7 });
});

test('tag ranges accept common ways of writing them', () => {
  for (const t of ['6-12', ' 6 - 12 ', '6–12', '6 to 12', '6-12M', '6-12 months', '6-12mo']) {
    assert.deepEqual(parseTagRange(t), { label: '6-12M', fitFrom: 3, fitTo: 4 }, t);
  }
});

test('tag ranges reject nonsense', () => {
  for (const t of ['', 'abc', '6', '12-6', '6-6', '6-12 weeks', '-3', '1-99', '3T']) {
    assert.ok('error' in parseTagRange(t), t);
  }
});

test('ran small shifts the fit down a size, ran large shifts it up, and both stop at the ends', () => {
  assert.equal(feedbackShift('-1'), -1);
  assert.equal(feedbackShift('1'), 1);
  assert.equal(feedbackShift('0'), 0);
  assert.equal(feedbackShift(''), 0);
  assert.deepEqual(shiftRange(3, 3, -1, 9), { from: 2, to: 2 });
  assert.deepEqual(shiftRange(3, 4, 1, 9), { from: 4, to: 5 });
  assert.deepEqual(shiftRange(0, 1, -1, 9), { from: 0, to: 0 });
  assert.deepEqual(shiftRange(8, 9, 1, 9), { from: 9, to: 9 });
});

test('a custom tag range fills the fit range unless a size is picked', () => {
  assert.deepEqual(resolveFitRange(3, null, null, 4), { fitFrom: 3, fitTo: 4 });
  assert.deepEqual(resolveFitRange(3, 3, null, 4), { fitFrom: 3, fitTo: 3 }, 'picking "from" alone means one size');
  assert.deepEqual(resolveFitRange(3, null, 5, 4), { fitFrom: 3, fitTo: 5 });
  assert.deepEqual(resolveFitRange(3, null, null), { fitFrom: 3, fitTo: 3 });
});

test('spares at daycare count as kept and usable, outgrown and donated do not', () => {
  assert.equal(isUsable({ status: 'daycare', condition: 'good' }), true);
  assert.equal(isUsable({ status: 'daycare', condition: 'unusable' }), false);
  assert.equal(isUsable({ status: 'donated', condition: 'good' }), false);
});
