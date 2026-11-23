import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, isPublicPath } from './redirect';

test('safeNext keeps same-site paths', () => {
  assert.equal(safeNext('/children'), '/children');
  assert.equal(safeNext('/closet?filter=active'), '/closet?filter=active');
});

test('safeNext rejects anything that could leave the site', () => {
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '', null, undefined, '/a\nb']) {
    assert.equal(safeNext(bad as string | null | undefined), '/children', String(bad));
  }
  assert.equal(safeNext('//evil.example', '/home'), '/home');
});

test('public paths', () => {
  assert.ok(isPublicPath('/login'));
  assert.ok(isPublicPath('/auth/callback'));
  assert.ok(!isPublicPath('/children'));
  assert.ok(!isPublicPath('/loginx'));
});
