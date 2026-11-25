import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecast } from './forecast';
import { forecastWindows, windowFromDates } from './windows';

test('windowFromDates: months run from the start month to the month before the next size starts', () => {
  const w = windowFromDates('2027-04-10', '2027-07-01');
  assert.equal(w.short, 'Apr-Jun');
  assert.equal(w.months, 'April to June');
  assert.equal(w.season, 'spring');
  assert.equal(w.source, 'forecast');
});
test('windowFromDates: a window that ends on the 1st excludes that month; one that ends later includes it', () => {
  assert.equal(windowFromDates('2027-04-10', '2027-07-02').short, 'Apr-Jul');
  assert.equal(windowFromDates('2027-04-10', '2027-05-01').short, 'Apr');
});
test('windowFromDates: a year or more is all year, and the year can wrap', () => {
  assert.equal(windowFromDates('2027-04-10', '2028-06-01').short, 'All year');
  assert.equal(windowFromDates('2027-11-05', '2028-02-20').short, 'Nov-Feb');
});
test('windowFromDates: season follows the middle of the window', () => {
  assert.equal(windowFromDates('2027-11-05', '2028-02-20').season, 'winter');
  assert.equal(windowFromDates('2027-06-05', '2027-09-01').season, 'summer');
});
test('windowFromDates: the current size says "Now"', () => {
  assert.match(windowFromDates('2027-04-10', '2027-07-01', true).age, /^Expected Now to /);
});
test('forecastWindows: no forecast means no windows; sizes before the current size are left to the age guide', () => {
  assert.deepEqual(forecastWindows(null, '2027-01-01', 2), {});
  const f = forecast('girls', '2026-10-01', [{ date: '2026-11-01', lengthIn: 22 }], '2026-11-25', 36);
  assert.ok(f);
  const w = forecastWindows(f, '2026-11-25', 1);
  assert.equal(w[0], undefined);
  assert.ok(w[1]);
  assert.match(w[1].age, /^Expected Now to /);
});
