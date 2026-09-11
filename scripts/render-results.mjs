import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output || process.argv.length !== 4) {
  console.error('Usage: node scripts/render-results.mjs <search.json> <results.html>');
  process.exit(1);
}

try {
  if (resolve(input) === resolve(output)) throw new Error('Input and output must differ.');
  const { listings, meta } = JSON.parse(readFileSync(input, 'utf8'));
  if (!Array.isArray(listings) || !meta || typeof meta !== 'object' || Array.isArray(meta)) {
    throw new Error('Expected { "meta": { ... }, "listings": [ ... ] }.');
  }
  for (const item of listings) {
    if (!item || !['yad2', 'facebook'].includes(item.source)) {
      throw new Error('Each listing must have a yad2 or facebook source.');
    }
    for (const key of ['year', 'km', 'hand', 'price', 'kmPerYear']) {
      if (item[key] != null && (!Number.isFinite(item[key]) || item[key] < 0)) {
        throw new Error(`Listing ${key} must be a non-negative number or null.`);
      }
    }
  }
  const embed = value => JSON.stringify(value).replace(/</g, '\\u003c');
  const payloads = { __DATA__: embed(listings), __META__: embed(meta) };
  const template = readFileSync(new URL('../template/results.html', import.meta.url), 'utf8');
  // Replace in one pass so user text containing a placeholder stays literal.
  const html = template.replace(/__DATA__|__META__/g, token => payloads[token]);
  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(output, html, { flag: 'wx' });
  console.log(resolve(output));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
