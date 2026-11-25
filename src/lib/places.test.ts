import test from 'node:test';
import assert from 'node:assert/strict';
import { searchIn, type PlaceRow } from './places';
import { powerToDaily } from './weather';

const rows: PlaceRow[] = [
  ['Boston', 'Boston', 'Massachusetts', 'MA', 'United States', 42.36, -71.06, 675647],
  ['Boston', 'Boston', 'England', 'ENG', 'United Kingdom', 52.97, -0.02, 35124],
  ['Bostonia', 'Bostonia', 'California', 'CA', 'United States', 32.8, -116.9, 16000],
  ['São Paulo', 'Sao Paulo', 'São Paulo', '27', 'Brazil', -23.55, -46.64, 10021295],
  ['Austin', 'Austin', 'Texas', 'TX', 'United States', 30.27, -97.74, 961855],
];

test('exact names come before longer ones, biggest first', () => {
  const r = searchIn(rows, 'boston');
  assert.deepEqual(r.map((p) => p.label), ['Boston, Massachusetts, United States', 'Boston, England, United Kingdom', 'Bostonia, California, United States']);
});
test('text after a comma narrows by state code, state name or country', () => {
  assert.equal(searchIn(rows, 'Boston, MA').length, 1);
  assert.equal(searchIn(rows, 'Boston, Massachusetts').length, 1);
  assert.equal(searchIn(rows, 'Boston, united king')[0].label, 'Boston, England, United Kingdom');
  assert.equal(searchIn(rows, 'Boston, Texas').length, 0);
});
test('accents and case are ignored; short or numeric text finds nothing', () => {
  assert.equal(searchIn(rows, 'SAO pau')[0].latitude, -23.55);
  assert.equal(searchIn(rows, 'sã')[0].label.startsWith('São'), true);
  assert.deepEqual(searchIn(rows, 'b'), []);
  assert.deepEqual(searchIn(rows, '02108'), []);
});
test('POWER daily highs convert to Fahrenheit and skip missing values', () => {
  const d = powerToDaily({ properties: { parameter: { T2M_MAX: { '20240101': 0, '20240102': 100, '20240103': -999 } } } });
  assert.deepEqual(d, [
    { date: '2024-01-01', highF: 32 },
    { date: '2024-01-02', highF: 212 },
    { date: '2024-01-03', highF: null },
  ]);
  assert.deepEqual(powerToDaily({}), []);
});
