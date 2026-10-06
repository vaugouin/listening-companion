import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'node:http';
import { config, cleanError } from './config';

export function attachRealtime(server: Server, originAllowed: (origin?: string) => boolean) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 100000 });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== `${config.basePath}listen` || !originAllowed(req.headers.origin) || !config.openaiKey) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client));
  });
  wss.on('connection', client => {
    const heartbeat = setInterval(() => { if (client.readyState === WebSocket.OPEN) client.ping(); }, 30000);
    client.once('close', () => clearInterval(heartbeat));
    const upstream = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription', { headers: { Authorization: `Bearer ${config.openaiKey}` } });
    let ready = false;
    let frames = 0;
    const send = (data: unknown) => { if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data)); };
    const timeout = setTimeout(() => { send({ type: 'error', message: 'La connexion de transcription a expiré.' }); client.close(); }, 20000);
    upstream.on('open', () => upstream.send(JSON.stringify({ type: 'session.update', session: {
      type: 'transcription', audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: config.transcriptionModel, ...(config.transcriptionModel === 'gpt-live-transcribe' ? { languages: ['fr','en'], delay: 'low' } : { language: 'fr' }), prompt: 'Conversation et podcast cinéma : réalisateurs, acteurs, titres de films.' }, turn_detection: null } },
    } })));
    upstream.on('message', raw => {
      let e: any;
      try { e = JSON.parse(raw.toString()); } catch { return; }
      if (e.type === 'session.updated' || e.type === 'transcription_session.updated') {
        ready = true; clearTimeout(timeout); send({ type: 'ready' });
      } else if (e.type === 'input_audio_buffer.committed') {
        send({ type: 'committed', itemId: e.item_id, previousItemId: e.previous_item_id });
      } else if (e.type === 'conversation.item.input_audio_transcription.delta') {
        send({ type: 'delta', itemId: e.item_id, text: e.delta });
      } else if (e.type === 'conversation.item.input_audio_transcription.completed') {
        send({ type: 'transcript', itemId: e.item_id, text: e.transcript });
      } else if (e.type === 'error' || e.type === 'conversation.item.input_audio_transcription.failed') {
        send({ type: 'error', message: cleanError(new Error(e.error?.message ?? 'La transcription a échoué.')) });
        if (!ready) client.close();
      }
    });
    client.on('message', (raw, isBinary) => {
      if (!ready || upstream.readyState !== WebSocket.OPEN) return;
      if (isBinary) {
        const bytes = Buffer.from(raw as Buffer);
        frames += bytes.length / 2;
        upstream.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: bytes.toString('base64') }));
      } else {
        try { const event = JSON.parse(raw.toString()); if (event.type === 'commit' && frames > 4800) { upstream.send(JSON.stringify({ type: 'input_audio_buffer.commit' })); frames = 0; } } catch { /* Ignore invalid controls. */ }
      }
    });
    upstream.on('error', error => { send({ type: 'error', message: cleanError(error) }); client.close(); });
    upstream.on('close', () => client.close());
    client.on('close', () => { clearTimeout(timeout); upstream.close(); });
    client.on('error', () => upstream.close());
  });
  return wss;
}
