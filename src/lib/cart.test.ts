import test from 'node:test';
import assert from 'node:assert/strict';
import { cartKey, cartLines, cartPieces, leftToFind, parseCart, setInCart, splitKey } from './cart';

test('cart: set, clamp, remove', () => {
  const k = cartKey('top', 's1');
  let c = setInCart({}, k, 3);
  assert.deepEqual(c, { 'top|s1': 3 });
  c = setInCart(c, k, 500);
  assert.equal(c[k], 99);
  c = setInCart(c, k, -2);
  assert.deepEqual(c, {});
  assert.deepEqual(setInCart({}, k, Number.NaN), {});
});

test('cart: left to find, pieces, lines', () => {
  assert.equal(leftToFind(4, 3), 1);
  assert.equal(leftToFind(2, 3), 0);
  const c = { 'top|s1': 3, 'pants|s2': 2 };
  assert.equal(cartPieces(c), 5);
  assert.deepEqual(cartLines(c), [{ categoryId: 'top', sizeId: 's1', qty: 3 }, { categoryId: 'pants', sizeId: 's2', qty: 2 }]);
  assert.equal(splitKey('a|b|c'), null);
});

test('cart: parse drops junk', () => {
  assert.deepEqual(parseCart(null), {});
  assert.deepEqual(parseCart('not json'), {});
  assert.deepEqual(parseCart('[1,2]'), {});
  assert.deepEqual(parseCart('{"top|s1":3,"bad":2,"x|y":"4","hat|s2":0}'), { 'top|s1': 3 });
});
