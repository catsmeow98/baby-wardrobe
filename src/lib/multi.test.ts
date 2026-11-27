import test from 'node:test';
import assert from 'node:assert/strict';
import { listOf, listQs } from './multi';

test('listOf: single, repeated, blank and missing values', () => {
  assert.deepEqual(listOf(undefined), []);
  assert.deepEqual(listOf(''), []);
  assert.deepEqual(listOf('a'), ['a']);
  assert.deepEqual(listOf(['a', '', 'b', 'a']), ['a', 'b']);
  assert.equal(listQs('cat', ['a', 'b c']), '&cat=a&cat=b%20c');
  assert.equal(listQs('cat', []), '');
});
