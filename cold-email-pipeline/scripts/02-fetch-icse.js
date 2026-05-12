// 02-fetch-icse.js
// Scrape ICSE schools across target cities via Google Maps.
// Output: output/icse-raw.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './lib/puppeteer-helper.js';
import { scrapeMaps } from './lib/maps-scraper.js';
import { CITY_QUOTAS } from './lib/city-tier.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'output', 'icse-raw.json');

// ICSE schools are sparser — query the top 12 ICSE-strong cities only.
const ICSE_CITIES = CITY_QUOTAS.filter((c) =>
  ['Mumbai', 'Pune', 'Kolkata', 'Bangalore', 'Chennai', 'New Delhi', 'Hyderabad',
   'Indore', 'Lucknow', 'Bhopal', 'Nagpur', 'Coimbatore'].includes(c.city)
);

function buildQueries() {
  return ICSE_CITIES.map(({ city, state }) => ({
    query: `ICSE schools in ${city}, India`,
    city,
    state,
    board: 'ICSE'
  }));
}

async function main() {
  const queries = buildQueries();
  console.log(`[02-icse] Will query Maps for ICSE schools across ${queries.length} cities`);
  const browser = await launchBrowser({ headless: 'new' });
  try {
    const results = await scrapeMaps(browser, queries, {
      onProgress: ({ done, total, city, board, found, error }) => {
        const tag = error ? `ERROR: ${error}` : `${found} schools`;
        console.log(`[02-icse] (${done}/${total}) ${board} ${city} → ${tag}`);
      }
    });
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
    console.log(`[02-icse] Wrote ${results.length} raw ICSE entries → ${OUT}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[02-icse] Fatal:', err);
  process.exit(1);
});
