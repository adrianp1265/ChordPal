// Downloads the Salamander Grand Piano samples (CC BY 3.0, Alexander Holm) into
// public/samples/salamander once. Runs before dev and build.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const dir = 'public/samples/salamander';
const base = 'https://raw.githubusercontent.com/Tonejs/audio/master/salamander/';
const files = ['A0.mp3', 'C8.mp3'];
for (let o = 1; o <= 7; o++) for (const n of ['C', 'Ds', 'Fs', 'A']) files.push(`${n}${o}.mp3`);

mkdirSync(dir, { recursive: true });
let fetched = 0;
for (const f of files) {
  const path = `${dir}/${f}`;
  if (existsSync(path)) continue;
  const r = await fetch(base + f);
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
  fetched++;
}
console.log(`piano samples: ${files.length - fetched} cached, ${fetched} downloaded`);
