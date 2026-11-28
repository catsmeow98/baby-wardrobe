import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags } from './tags.ts';

test('parseTags tidies, dedupes and merges shared tags', () => {
  assert.deepEqual(parseTags(JSON.stringify([' Christmas ', 'christmas', 'Hand-me-down', '', 3])), ['Christmas', 'Hand-me-down']);
  assert.deepEqual(parseTags(JSON.stringify(['Summer']), ['summer', 'Gift']), ['Summer', 'Gift']);
  assert.deepEqual(parseTags('not json'), []);
  assert.deepEqual(parseTags(undefined), []);
  assert.equal(parseTags(JSON.stringify(['x'.repeat(40)]))[0].length, 30);
  assert.equal(parseTags(JSON.stringify(Array.from({ length: 30 }, (_, i) => `t${i}`))).length, 20);
});
