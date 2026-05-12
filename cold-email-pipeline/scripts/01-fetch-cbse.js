// 01-fetch-cbse.js
// Scrape CBSE schools across target cities via Google Maps.
// Output: output/cbse-raw.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/puppeteer-helper.js';
import { scrapeMaps } from './lib/maps-scraper.js';
import { CITY_QUOTAS } from './lib/city-tier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'output', 'cbse-raw.json');

function buildQueries() {
  return CITY_QUOTAS.map(({ city, state }) => ({
    query: `CBSE schools in ${city}, India`,
    city,
    state,
    board: 'CBSE'
  }));
}

async function main() {
  const queries = buildQueries();
  console.log(`[01-cbse] Will query Maps for CBSE schools across ${queries.length} cities`);
  const browser = await launchBrowser({ headless: 'new' });
  try {
    const results = await scrapeMaps(browser, queries, {
      onProgress: ({ done, total, city, board, found, error }) => {
        const tag = error ? `ERROR: ${error}` : `${found} schools`;
        console.log(`[01-cbse] (${done}/${total}) ${board} ${city} → ${tag}`);
      }
    });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`[01-cbse] Wrote ${results.length} raw CBSE entries → ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[01-cbse] Fatal:', err);
  process.exit(1);
});
