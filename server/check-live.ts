import { config, cleanError } from './config';
import { extractStatements } from './openai';
import { searchCinema, hydrate } from './cinema';
import WebSocket from 'ws';

async function check(name: string, task: () => Promise<unknown>) {
  try { console.log(JSON.stringify({ check: name, ok: true, result: await task() })); }
  catch (error) { console.log(JSON.stringify({ check: name, ok: false, error: cleanError(error) })); process.exitCode = 1; }
}
await check('models',async () => {
  const r = await fetch('https://api.openai.com/v1/models',{ headers: {Authorization: `Bearer ${config.openaiKey}`}, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json() as any;
  return Object.fromEntries([config.model,'gpt-live-transcribe','gpt-4o-transcribe','gpt-4o-mini-transcribe'].map(id => [id,data.data.some((m: any) => m.id === id)]));
});
await check('extraction',async () => {
  const result = await extractStatements({ text: 'Parlons des films réalisés par Jean-Luc Godard.',context: [],liveId: null });
  return result.statements.map(s => ({ operation: s.operation,property: s.property,value: s.value }));
});
await check('catalogue',async () => {
  const result = await searchCinema([{ entity: 'movie',property: 'titre',value: 'Pierrot le fou' }],true,1);
  if (!result.cards.length) throw new Error('Aucune carte reçue.');
  const first = await hydrate(result.cards[0]);
  return { cards: result.cards.length,title: first.title,image: !!first.image,warning: result.warning ?? null };
});
await check('realtime',() => new Promise((resolve,reject) => {
  const ws = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription',{ headers: {Authorization: `Bearer ${config.openaiKey}`} });
  const timeout = setTimeout(() => { ws.close(); reject(new Error('Realtime timeout')); },15000);
  ws.on('open',() => ws.send(JSON.stringify({ type: 'session.update',session: { type: 'transcription',audio: {input: {format: {type: 'audio/pcm',rate: 24000},transcription: {model: config.transcriptionModel},turn_detection: null}}} })));
  ws.on('message',raw => { const event = JSON.parse(raw.toString()); if (event.type === 'session.updated') { clearTimeout(timeout); ws.close(); resolve({ configured: true,model: config.transcriptionModel }); } if (event.type === 'error') { clearTimeout(timeout); ws.close(); reject(new Error(event.error?.message ?? 'Realtime error')); } });
  ws.on('error',e => { clearTimeout(timeout); reject(e); });
}));
