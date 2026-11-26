import test from 'node:test';
import assert from 'node:assert/strict';
import { currentUrl, safeBack, withParams } from './back';

test('currentUrl keeps filters and drops one-time messages', () => {
  assert.equal(currentUrl('/closet', { group: 'g1', q: 'bib', error: 'x', added: '3' }), '/closet?group=g1&q=bib');
  assert.equal(currentUrl('/closet', {}), '/closet');
  assert.equal(currentUrl('/closet', { color: undefined }), '/closet');
});
test('safeBack accepts only addresses under the base path', () => {
  assert.equal(safeBack('/closet?cat=a&sort=name', '/closet'), '/closet?cat=a&sort=name');
  assert.equal(safeBack('/closet', '/closet'), '/closet');
  assert.equal(safeBack('/closetx?a=1', '/closet'), '/closet');
  assert.equal(safeBack('//evil.com', '/closet'), '/closet');
  assert.equal(safeBack('https://evil.com', '/closet'), '/closet');
  assert.equal(safeBack('/account?x=1', '/closet'), '/closet');
  assert.equal(safeBack('/closet?a=1\nSet-Cookie:x', '/closet'), '/closet');
  assert.equal(safeBack(null, '/closet'), '/closet');
  assert.equal(safeBack(undefined, '/shopping'), '/shopping');
});
test('safeBack drops one-time messages that were saved in the address', () => {
  assert.equal(safeBack('/closet?cat=a&error=bad&back=%2Fx', '/closet'), '/closet?cat=a');
});
test('withParams sets and replaces values', () => {
  assert.equal(withParams('/goals?size=2&group=g', { size: '4', saved: '1' }), '/goals?size=4&group=g&saved=1');
  assert.equal(withParams('/shopping', { ok: 'Done.' }), '/shopping?ok=Done.');
  assert.equal(withParams('/shopping?ok=a', { ok: undefined }), '/shopping');
});
