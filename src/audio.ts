import { appUrl, listeningUrl } from './urls';

type Handlers = { partial: (text: string) => void; transcript: (text: string) => void; level: (n: number) => void; error: (message: string) => void };

export async function startAudio(source: 'microphone' | 'tab', handlers: Handlers): Promise<() => void> {
  if (!window.isSecureContext || !navigator.mediaDevices) throw new Error('Le microphone demande localhost ou une connexion HTTPS.');
  const stream = source === 'tab'
    ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true }, video: false });
  let context: AudioContext | undefined;
  let socket: WebSocket | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    stream.getTracks().forEach(t => t.stop()); void context?.close(); handlers.level(0);
    if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({type: 'commit'})); const finalSocket = socket; setTimeout(() => finalSocket.close(),5000); }
    else socket?.close();
  };
  try {
    if (!stream.getAudioTracks().length) throw new Error('Aucun son partagé. Sélectionnez un onglet et cochez « Partager l’audio », ou utilisez le microphone.');
    socket = new WebSocket(listeningUrl());
    const ws = socket;
    const deltas = new Map<string,string>();
    const order: string[] = [];
    const completed = new Map<string,string>();
    const drain = () => {
      while (order.length && completed.has(order[0])) {
        const id = order.shift()!;
        const text = completed.get(id)!;
        completed.delete(id); deltas.delete(id);
        if (text.trim()) handlers.transcript(text.trim());
      }
      handlers.partial([...deltas.values()].join(' '));
    };
    await new Promise<void>((resolve,reject) => {
      const timer = window.setTimeout(() => reject(new Error('La transcription ne répond pas.')),22000);
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Connexion de transcription impossible.')); };
      ws.onmessage = event => {
        const e = JSON.parse(event.data);
        if (e.type === 'ready') { clearTimeout(timer); resolve(); }
        if (e.type === 'committed' && !order.includes(e.itemId)) order.push(e.itemId);
        if (e.type === 'delta') { deltas.set(e.itemId,(deltas.get(e.itemId) ?? '') + e.text); handlers.partial([...deltas.values()].join(' ')); }
        if (e.type === 'transcript') { if (!order.includes(e.itemId)) order.push(e.itemId); completed.set(e.itemId,e.text); drain(); }
        if (e.type === 'error') { clearTimeout(timer); reject(new Error(e.message)); handlers.error(e.message); stop(); }
      };
      ws.onclose = () => { clearTimeout(timer); reject(new Error('La connexion de transcription a été fermée.')); if (!stopped) { handlers.error('Écoute interrompue. Relancez le microphone pour continuer.'); stop(); } };
    });
    context = new AudioContext({ sampleRate: 24000 });
    await context.resume();
    await context.audioWorklet.addModule(appUrl('pcm-worklet.js'));
    const input = context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const processor = new AudioWorkletNode(context,'pcm-capture');
    const silent = context.createGain(); silent.gain.value = 0;
    input.connect(processor).connect(silent).connect(context.destination);
    let speaking = false, quiet = 0, duration = 0;
    let preroll: ArrayBuffer[] = [];
    processor.port.onmessage = event => {
      const { pcm, rms } = event.data as { pcm: ArrayBuffer; rms: number };
      handlers.level(Math.min(1,rms*9));
      if (rms > .012) {
        if (!speaking) { for (const previous of preroll) if (ws.readyState === WebSocket.OPEN) ws.send(previous); preroll = []; }
        speaking = true; quiet = 0;
      } else quiet += .1;
      if (speaking && ws.readyState === WebSocket.OPEN) {
        ws.send(pcm); duration += .1;
        if (quiet > .7 || duration > 12) { ws.send(JSON.stringify({ type: 'commit' })); speaking = false; duration = 0; }
      } else { preroll.push(pcm); if (preroll.length > 2) preroll.shift(); }
    };
    stream.getAudioTracks()[0].onended = () => { if (!stopped) { handlers.error('La source audio a été arrêtée.'); stop(); } };
    return stop;
  } catch (error) { stop(); throw error; }
}
