// Builds public/data (the next-chord tables) unless they already exist.
// Without Chordonomicon: JazzStandards (downloaded) + the starter lists.
// With it: CHORDONOMICON=path/to/chordonomicon_v2.csv npm run data
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const force = process.argv.includes('--force');
if (existsSync('public/data/index.json') && !force) {
  console.log('tables: public/data already built (npm run data to rebuild)');
} else {
  const args = ['pipeline/build_tables.py', '--jazz', 'auto'];
  if (process.env.CHORDONOMICON) args.push('--chordonomicon', process.env.CHORDONOMICON);
  execFileSync(process.env.PYTHON ?? 'python3', args, { stdio: 'inherit' });
}
