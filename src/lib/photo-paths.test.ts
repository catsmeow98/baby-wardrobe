import test from 'node:test';
import assert from 'node:assert/strict';
import { joinPhotoField, pathsOf, splitPhotoField, validPhotoPath } from './photo-paths';

test('join and split a photo field', () => {
  assert.equal(joinPhotoField('u/c/a.png'), 'u/c/a.png');
  assert.equal(joinPhotoField('u/c/a.png', 'u/c/a-o.jpg'), 'u/c/a.png|u/c/a-o.jpg');
  assert.deepEqual(splitPhotoField('u/c/a.png'), { path: 'u/c/a.png' });
  assert.deepEqual(splitPhotoField('u/c/a.png|u/c/a-o.jpg'), { path: 'u/c/a.png', originalPath: 'u/c/a-o.jpg' });
  assert.deepEqual(pathsOf(splitPhotoField('u/c/a.png|u/c/a-o.jpg')), ['u/c/a.png', 'u/c/a-o.jpg']);
  assert.deepEqual(pathsOf({ path: 'x.jpg' }), ['x.jpg']);
  assert.deepEqual(pathsOf({ path: 'x.jpg', originalPath: 'x.jpg' }), ['x.jpg'], 'the same file is listed once');
});

test('validPhotoPath', () => {
  const prefix = 'u1/c1/';
  assert.equal(validPhotoPath('u1/c1/a.png', prefix), true);
  assert.equal(validPhotoPath('u1/c1/a-o.jpg', prefix), true);
  assert.equal(validPhotoPath('u2/c1/a.png', prefix), false);
  assert.equal(validPhotoPath('u1/c1/../u2/a.png', prefix), false);
  assert.equal(validPhotoPath('u1/c1/a.gif', prefix), false);
  assert.equal(validPhotoPath('u1/c1/a.png|b.jpg', prefix), false);
  assert.equal(validPhotoPath(`u1/c1/${'x'.repeat(200)}.png`, prefix), false);
});
