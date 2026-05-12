// 05-pattern-emails.js
// Generate pattern email for each top-ranked school using its clean domain.
// Primary email = principal@<domain> (matches K-12 cold-outreach template).
// Output: output/with-emails.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patternEmails } from './lib/domain-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'output', 'top-ranked.json');
const OUT = path.join(__dirname, 'output', 'with-emails.json');

function main() {
  const records = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const enriched = records.map((r) => {
    const candidates = patternEmails(r.cleanDomain);
    return {
      ...r,
      email: candidates[0] || '',
      emailCandidates: candidates,
      email_confidence: r.cleanDomain ? 50 : 0,
      email_source: 'pattern'
    };
  });

  const withEmail = enriched.filter((r) => r.email).length;
  console.log(`[05-emails] Generated pattern emails for ${withEmail}/${enriched.length} schools`);

  fs.writeFileSync(OUT, JSON.stringify(enriched, null, 2));
  console.log(`[05-emails] Wrote → ${OUT}`);
}

main();
