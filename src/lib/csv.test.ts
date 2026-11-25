import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvRows } from './csv';

test('csvCell quotes commas, quotes and line breaks', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(3), '3');
});
test('csvCell defuses spreadsheet formulas', () => {
  for (const bad of ['=SUM(A1)', '+1', '-1', '@cmd']) assert.equal(csvCell(bad), `'${bad}`);
});
test('csvRows joins rows with CRLF and starts with a byte order mark for Excel', () => {
  assert.equal(csvRows([['a', 'b'], [1, 2]]), '﻿a,b\r\n1,2\r\n');
});
