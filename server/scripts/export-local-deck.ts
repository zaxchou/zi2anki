import { getDb, waitForDb } from '../db.js';
import { buildContentPackage } from '../services/contentPackage.js';
import fs from 'node:fs';

await waitForDb();
const db = getDb();
const decks = await db.query("SELECT id, name FROM decks WHERE name ILIKE '%瘦金%'");
console.log('Decks found:', decks.rows.length);
for (const deck of decks.rows) {
  console.log(`  ${deck.id}  ${deck.name}`);
  const { filename, buffer } = await buildContentPackage(db, deck.id);
  const outPath = `/tmp/${filename}`;
  fs.writeFileSync(outPath, buffer);
  console.log(`  Exported to ${outPath} (${(buffer.length/1024/1024).toFixed(1)}MB)`);
}
process.exit(0);
