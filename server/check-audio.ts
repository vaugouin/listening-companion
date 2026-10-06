import { readFileSync } from 'node:fs';
import { transcribeFile } from './transcribe';
import { config, cleanError } from './config';
import WebSocket from 'ws';

const wav = readFileSync('tests/sample-cinema.wav');
let offset = 12, sourceRate = 0, channels = 0, bitDepth = 0, data = Buffer.alloc(0);
while (offset+8 < wav.length) {
  const kind = wav.toString('ascii',offset,offset+4),length = wav.readUInt32LE(offset+4);
  if (kind === 'fmt ') { channels = wav.readUInt16LE(offset+10); sourceRate = wav.readUInt32LE(offset+12); bitDepth = wav.readUInt16LE(offset+22); }
  if (kind === 'data') data = wav.subarray(offset+8,offset+8+length);
  offset += 8+length+(length%2);
}
if (!data.length || bitDepth !== 16 || !sourceRate) throw new Error('Le test attend un WAV PCM16 non vide.');
const samples = Math.floor(data.length/2/channels), count = Math.floor(samples*24000/sourceRate);
const pcm = Buffer.alloc(count*2);
for (let i=0;i<count;i++) { const index = Math.min(samples-1,Math.floor(i*sourceRate/24000)); pcm.writeInt16LE(data.readInt16LE(index*channels*2),i*2); }
try {
  const file = await transcribeFile(wav,'sample-cinema.wav','audio/wav');
  console.log(JSON.stringify({check: 'audio-file',ok: true,text: file.text,voices: [...new Set(file.segments?.map((s: any) => s.speaker) ?? [])]}));
  const transcript = await new Promise<string>((resolve,reject) => {
    const ws = new WebSocket('wss://api.openai.com/v1/realtime?intent=transcription',{headers: {Authorization: `Bearer ${config.openaiKey}`}});
    const timeout = setTimeout(() => { ws.close(); reject(new Error('Aucune transcription PCM reçue.')); },30000);
    ws.on('open',() => ws.send(JSON.stringify({type: 'session.update',session: {type: 'transcription',audio: {input: {format: {type: 'audio/pcm',rate: 24000},transcription: {model: config.transcriptionModel,languages: ['fr','en'],delay: 'low'},turn_detection: null}}}})));
    ws.on('message',raw => {
      const e = JSON.parse(raw.toString());
      if (e.type === 'session.updated') { for (let i=0;i<pcm.length;i+=4800) ws.send(JSON.stringify({type: 'input_audio_buffer.append',audio: pcm.subarray(i,i+4800).toString('base64')})); ws.send(JSON.stringify({type: 'input_audio_buffer.commit'})); }
      if (e.type === 'conversation.item.input_audio_transcription.completed') { clearTimeout(timeout); ws.close(); resolve(e.transcript); }
      if (e.type === 'error') { clearTimeout(timeout); ws.close(); reject(new Error(e.error?.message)); }
    });
    ws.on('error',e => {clearTimeout(timeout);reject(e);});
  });
  if (!transcript.trim()) throw new Error('Transcription PCM vide.');
  console.log(JSON.stringify({check: 'audio-pcm',ok: true,text: transcript}));
} catch (error) { console.log(JSON.stringify({check: 'audio',ok: false,error: cleanError(error)})); process.exitCode = 1; }
