import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { WebSocket } from 'ws';

const base = 'http://127.0.0.1:4329';
const child = spawn(process.execPath, ['dist-server/index.js'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: '4329', BASE_PATH: '/hors-champ/', PUBLIC_ORIGIN: 'https://www.vaugouin.com' },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let diagnostics = '';
child.stderr.on('data', data => { diagnostics += data.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(`${base}/hors-champ/api/health`)).ok) { ready = true; break; } } catch {}
    await pause(100);
  }
  assert(ready, `Le serveur n'a pas démarré : ${diagnostics}`);
  const redirect = await fetch(`${base}/hors-champ?essai=1`, { redirect: 'manual' });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/hors-champ/?essai=1');
  const page = await fetch(`${base}/hors-champ/`);
  assert.equal(page.status, 200);
  const html = await page.text();
  const asset = html.match(/src="(\/hors-champ\/assets\/[^\"]+\.js)"/);
  assert(asset, 'La compilation Vite doit utiliser BASE_PATH=/hors-champ/.');
  assert.equal((await fetch(base + asset[1])).status, 200);
  assert.equal((await fetch(`${base}/hors-champ/pcm-worklet.js`)).status, 200);
  assert.equal((await fetch(`${base}/api/health`)).status, 404);
  assert.equal((await fetch(`${base}/hors-champ/api/health`, { headers: { Origin: 'https://evil.test' } })).status, 403);
  assert.equal((await fetch(`${base}/hors-champ/api/health`, { headers: { Origin: 'https://www.vaugouin.com' } })).status, 200);
  console.log('VPS : préfixe, redirection, assets, worklet et origines vérifiés.');

  if (process.argv.includes('--live')) {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${base.replace('http:', 'ws:')}/hors-champ/listen`, { headers: { Origin: 'https://www.vaugouin.com' } });
      const timeout = setTimeout(() => { ws.terminate(); reject(new Error('Transcription en direct indisponible.')); }, 25000);
      ws.on('message', raw => {
        const event = JSON.parse(raw.toString());
        if (event.type === 'ready') { clearTimeout(timeout); ws.close(); resolve(); }
        if (event.type === 'error') { clearTimeout(timeout); ws.close(); reject(new Error(event.message)); }
      });
      ws.on('error', error => { clearTimeout(timeout); reject(error); });
    });
    console.log('VPS : WebSocket préfixé connecté à la transcription OpenAI.');
  }
} finally {
  child.kill();
}
