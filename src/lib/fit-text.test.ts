import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactRange, tagFitText } from './fit-text.ts';

test('compactRange joins sizes into one short range', () => {
  assert.equal(compactRange('6-9M', '9-12M'), '6-12M');
  assert.equal(compactRange('6-9M', '6-9M'), '6-9M');
  assert.equal(compactRange('Newborn', '3-6M'), 'Newborn-6M');
  assert.equal(compactRange('18-24M', '2T'), '18M-2T');
  assert.equal(compactRange('2T', '3T'), '2T-3T');
});

test('tagFitText says true to size, or what it fits', () => {
  const names = ['Newborn', '0-3M', '3-6M', '6-9M', '9-12M'];
  const n = (o: number) => names[o];
  assert.equal(tagFitText('6-9M', { from: 3, to: 3 }, { from: 3, to: 3 }, n), 'Tag 6-9M, true to size');
  assert.equal(tagFitText('6-9M', { from: 3, to: 3 }, { from: 3, to: 4 }, n), 'Tag 6-9M, fits 6-12M');
  assert.equal(tagFitText('3-9M', { from: 2, to: 3 }, { from: 2, to: 3 }, n), 'Tag 3-9M, true to size');
  assert.equal(tagFitText(undefined, { from: null, to: null }, { from: 1, to: 2 }, n), 'Tag not set, fits 0-6M');
  assert.equal(tagFitText('6M', { from: 2, to: 2 }, { from: null, to: null }, n), 'Tag 6M, fit unknown');
});
