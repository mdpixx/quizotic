#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Quizotic lead pipeline — full run ==="
echo "Step 1/6: Fetch CBSE schools"
node 01-fetch-cbse.js

echo "Step 2/6: Fetch ICSE schools"
node 02-fetch-icse.js

echo "Step 3/6: Dedupe + normalize"
node 03-dedupe.js

echo "Step 4/6: Score and rank → top 500"
node 04-score-and-rank.js

echo "Step 5/6: Generate pattern emails"
node 05-pattern-emails.js

echo "Step 6/6: Write CSVs"
node 06-write-csv.js

echo ""
echo "=== Run complete ==="
echo "Inspect output/leads-raw.csv and output/leads-enriched.csv"
echo "When ready, push to sheet:"
echo "    node 07-push-to-sheet.js              # dry-run"
echo "    node 07-push-to-sheet.js --confirm    # live append"
