import fs from 'node:fs';
import { getDb, waitForDb } from '../db.js';
import { parseContentPackage } from '../services/contentPackage.js';
import { applyContentPackage, dryRunContentPackage } from '../services/contentSync.js';

async function main(): Promise<void> {
  const [mode, packagePath] = process.argv.slice(2);
  if ((mode !== '--dry-run' && mode !== '--apply') || !packagePath) {
    console.error('Usage: npx tsx server/scripts/apply-content-package.ts --dry-run|--apply <content-package.zip>');
    process.exit(2);
  }

  if (!fs.existsSync(packagePath)) {
    console.error(`Content package not found: ${packagePath}`);
    process.exit(2);
  }

  await waitForDb();
  const parsed = await parseContentPackage(fs.readFileSync(packagePath));
  const result = mode === '--dry-run'
    ? await dryRunContentPackage(getDb(), parsed)
    : await applyContentPackage(getDb(), parsed);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
