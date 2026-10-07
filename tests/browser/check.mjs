// Browser check: a fake MIDI keyboard drives the real app in Chromium.
// node tests/browser/check.mjs [url] [outdir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'tests/browser/shots';
mkdirSync(out, { recursive: true });
const exe = process.env.CHROME ?? '/opt/pw-browsers/chromium';

// Fake Web MIDI: one input, plus window.__midi.{send, unplug, replug}.
const fakeMidi = () => {
  const listeners = new Set();
  const input = { id: 'kbd-1', name: 'Fake Keys 49', state: 'connected', type: 'input', onmidimessage: null };
  const inputs = new Map([[input.id, input]]);
  const access = { inputs, outputs: new Map(), onstatechange: null, sysexEnabled: false };
  window.__midi = {
    send: (...bytes) => input.onmidimessage?.({ data: new Uint8Array(bytes) }),
    unplug() { inputs.delete(input.id); input.state = 'disconnected'; access.onstatechange?.({ port: input }); },
    replug(newId) { input.state = 'connected'; if (newId) input.id = newId; inputs.set(input.id, input); access.onstatechange?.({ port: input }); },
  };
  navigator.requestMIDIAccess = async () => access;
};

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const vp of [{ name: 'laptop', width: 1280, height: 860 }, { name: 'phone', width: 412, height: 915, isMobile: true, hasTouch: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
  await ctx.addInitScript(fakeMidi);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.waitForSelector('.now-name', { timeout: 15000 });
  const name = () => page.locator('.now-name').innerText();
  const send = (...b) => page.evaluate((b) => window.__midi.send(...b), b);
  const chord = async (notes, gap = 0) => { for (const n of notes) { await send(0x90, n, 100); if (gap) await page.waitForTimeout(gap); } };
  const release = async (notes) => { for (const n of notes) await send(0x80, n, 0); };

  // 1. naming
  let t0 = Date.now();
  await chord([60, 64, 67]);
  await page.waitForFunction(() => document.querySelector('.now-name')?.textContent === 'C', null, { timeout: 2000 });
  check(`${vp.name}: C-E-G shows "C"`, true, `${Date.now() - t0} ms incl. 80 ms settle + round trips`);
  await release([60, 64, 67]);
  await chord([64, 67, 72]);
  await page.waitForTimeout(250);
  check(`${vp.name}: E-G-C shows "C/E"`, (await name()) === 'C/E', await name());
  await release([64, 67, 72]);

  // 2. rolled chord counts once (F, notes 40 ms apart)
  const trailLen = () => page.evaluate(() => window.__chordpal.store.getState().trail.length);
  const before = await trailLen();
  await chord([65, 69, 72], 40);
  await page.waitForTimeout(250);
  check(`${vp.name}: rolled chord registers once`, (await trailLen()) === before + 1 && (await name()) === 'F', `trail +${(await trailLen()) - before}, ${await name()}`);
  await release([65, 69, 72]);

  // 3. sustain pedal holds
  await send(0xb0, 64, 127);
  await chord([67, 71, 74]);
  await page.waitForTimeout(200);
  await release([67, 71, 74]);
  await page.waitForTimeout(200);
  const held = await page.evaluate(() => window.__chordpal.store.getState().held);
  check(`${vp.name}: sustain keeps the chord`, held.length === 3 && (await name()) === 'G', `held ${held}`);
  await send(0xb0, 64, 0);

  // 4. key: C F G C Am -> C major, a stray chord does not change it
  await page.evaluate(() => window.__chordpal.store.getState().clear());
  for (const c of [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67], [57, 60, 64]]) { await chord(c); await page.waitForTimeout(150); await release(c); }
  const keyName = () => page.evaluate(() => { const k = window.__chordpal.store.getState().key; return k && `${k.tonic}:${k.mode}`; });
  check(`${vp.name}: C F G C Am -> C major`, (await keyName()) === '0:major', await keyName());
  await chord([58, 63, 67]); await page.waitForTimeout(150); await release([58, 63, 67]); // E-flat
  check(`${vp.name}: one stray chord keeps C major`, (await keyName()) === '0:major', await keyName());

  // 5. suggestions on screen, ghost keys, cards
  const cards = await page.locator('.cards li').count();
  const ghosts = await page.locator('.keyboard rect[style*="fill"]').count();
  check(`${vp.name}: 8 suggestion cards and ghost keys`, cards === 8 && ghosts > 0, `${cards} cards, ${ghosts} ghost keys`);
  await page.waitForTimeout(700); // let the map's transitions finish
  await page.screenshot({ path: `${out}/${vp.name}-1-map.png`, fullPage: true });

  // 6. Adventure dial and genre change the list
  const list = () => page.locator('.cards .cname').allInnerTexts();
  const a = await list();
  await page.locator('.adventure input').fill('100');
  await page.waitForTimeout(200);
  const b = await list();
  check(`${vp.name}: dial 0 -> 100 changes the list`, a.join() !== b.join(), `${a.slice(0, 4)} -> ${b.slice(0, 4)}`);
  await page.locator('.adventure input').fill('25');

  // 7. Use a card -> trail grows, map re-centres
  const tl = await trailLen();
  await page.locator('.cards .use').first().click();
  await page.waitForTimeout(600);
  check(`${vp.name}: Use adds to the trail`, (await trailLen()) === tl + 1);

  // 7b. key pictures on the cards, the progressions tab
  const pics = await page.locator('.cards .minikeys').count();
  const lit = await page.locator('.cards li').first().locator('.mk-w[style], .mk-b[style]').count();
  check(`${vp.name}: every card shows its keys`, pics === 8 && lit >= 3, `${pics} pictures, ${lit} keys lit on the first`);
  await page.getByRole('tab', { name: 'Progressions' }).click();
  await page.waitForSelector('.prog');
  const progs = await page.locator('.prog').count();
  const first = await page.locator('.prog').first().locator('.pc-name').allInnerTexts();
  check(`${vp.name}: progressions tab lists 8 with key pictures`, progs === 8 && first.length === 4 && (await page.locator('.prog .minikeys').count()) === 32, first.join(' '));
  await page.screenshot({ path: `${out}/${vp.name}-3-progressions.png`, fullPage: true });
  const tlp = await trailLen();
  await page.locator('.prog').first().getByRole('button', { name: 'Use' }).click();
  await page.waitForTimeout(200);
  check(`${vp.name}: Use on a progression adds its chords`, (await trailLen()) === tlp + 3);
  await page.getByRole('tab', { name: 'Map' }).click();

  // 8. library
  await page.getByRole('tab', { name: 'Library' }).click();
  const inKey = await page.locator('.lib-cell.in-key').count();
  await page.locator('.lib-cell', { hasText: 'Am7' }).first().click();
  await page.waitForTimeout(200);
  check(`${vp.name}: library highlights the key and picks a chord`, inKey > 0 && (await name()) === 'Am7', `${inKey} in key, now ${await name()}`);
  await page.screenshot({ path: `${out}/${vp.name}-2-library.png`, fullPage: true });
  await page.getByRole('tab', { name: 'Map' }).click();

  // 9. unplug / replug
  await page.evaluate(() => window.__midi.unplug());
  await page.waitForTimeout(100);
  const warned = await page.locator('.warn').count();
  await page.evaluate(() => window.__midi.replug('kbd-2'));
  await page.waitForTimeout(100);
  await chord([62, 65, 69]);
  await page.waitForTimeout(250);
  check(`${vp.name}: unplug shows a warning, replug reconnects`, warned === 1 && (await name()) === 'Dm', `now ${await name()}`);
  await release([62, 65, 69]);

  // 10. save and reload keeps it
  await page.evaluate(() => window.__chordpal.store.getState().save('test'));
  await page.reload();
  await page.getByRole('button', { name: 'Tap to start' }).click();
  await page.waitForSelector('.now-name');
  const saves = await page.evaluate(() => window.__chordpal.store.getState().saves.length);
  check(`${vp.name}: saved progression survives reload`, saves >= 1);

  // 11. offline (service worker): reload with network off
  if (vp.name === 'laptop') {
    await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(() => {});
    await ctx.setOffline(true);
    await page.reload();
    const ok = await page.getByRole('button', { name: 'Tap to start' }).isVisible().catch(() => false);
    if (ok) await page.getByRole('button', { name: 'Tap to start' }).click();
    await page.waitForSelector('.now-name', { timeout: 15000 }).catch(() => {});
    await chord([60, 64, 67]); await page.waitForTimeout(400);
    const offCards = await page.locator('.cards li').count();
    const loaded = await page.evaluate(() => window.__chordpal.store.getState().tables);
    check('offline: app, piano and tables load from the cache', ok && offCards === 8 && Object.values(loaded).some(Boolean), `${offCards} cards`);
    await ctx.setOffline(false);
  }
  check(`${vp.name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
