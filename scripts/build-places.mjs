// Builds src/data/places.json from GeoNames (https://www.geonames.org, CC BY 4.0, credit shown on the Account page).
//
//   node scripts/build-places.mjs            downloads the three files from download.geonames.org
//   node scripts/build-places.mjs <folder>   uses cities15000.zip, admin1CodesASCII.txt and countryInfo.txt already in <folder>
//
// Run it once, commit src/data/places.json, and rerun only when you want fresh data.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';

const BASE = 'https://download.geonames.org/export/dump/';
const dir = process.argv[2];

async function load(name) {
  if (dir) {
    const p = join(dir, name);
    if (!existsSync(p)) throw new Error(`Missing ${p}`);
    return readFileSync(p);
  }
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Text of the first file in a zip (stored or deflated). */
function unzipFirst(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== 0x02014b50) throw new Error('Bad zip directory');
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const local = buf.readUInt32LE(cd + 42);
  const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const body = buf.subarray(start, start + size);
  return (method === 0 ? body : inflateRawSync(body)).toString('utf8');
}

const lines = (t) => t.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));

const cities = lines(unzipFirst(await load('cities15000.zip')));
const regions = new Map(lines((await load('admin1CodesASCII.txt')).toString('utf8')).map((l) => { const c = l.split('\t'); return [c[0], c[1]]; }));
const countries = new Map(lines((await load('countryInfo.txt')).toString('utf8')).map((l) => { const c = l.split('\t'); return [c[0], c[4]]; }));

const rows = [];
for (const l of cities) {
  const c = l.split('\t');
  const [, name, ascii, , lat, lon, , , cc, , a1] = c;
  const pop = Number(c[14]);
  if (!name || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) continue;
  rows.push([name, ascii || name, regions.get(`${cc}.${a1}`) ?? '', a1 ?? '', countries.get(cc) ?? cc, Number(Number(lat).toFixed(2)), Number(Number(lon).toFixed(2)), pop || 0]);
}
rows.sort((a, b) => b[7] - a[7]);
writeFileSync(new URL('../src/data/places.json', import.meta.url), JSON.stringify(rows));
console.log(`Wrote ${rows.length} places to src/data/places.json`);
