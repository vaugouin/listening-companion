import { config } from './config';

export async function transcribeFile(bytes: Buffer, filename: string, contentType: string) {
  if (!config.openaiKey) throw new Error('La clé OpenAI est absente côté serveur.');
  if (!bytes.length || bytes.length > 25e6) throw new Error('Le fichier audio est vide ou dépasse 25 Mo.');
  const extension = filename.split('.').at(-1)?.toLowerCase();
  if (!['wav','mp3','mp4','m4a','webm','mpeg','mpga','ogg','flac'].includes(extension ?? '')) throw new Error('Format audio non reconnu. Utilisez WAV, MP3, M4A, WebM ou Ogg.');
  const form = new FormData();
  form.append('file',new Blob([new Uint8Array(bytes)],{type: contentType}),`audio.${extension}`);
  form.append('model',config.fileTranscriptionModel);
  const diarized = config.fileTranscriptionModel.includes('diarize');
  form.append('response_format',diarized ? 'diarized_json' : 'json');
  if (diarized) form.append('chunking_strategy','auto');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions',{ method: 'POST',headers: {Authorization: `Bearer ${config.openaiKey}`},body: form,signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Transcription du fichier indisponible (HTTP ${response.status}).`);
  const data = await response.json() as any;
  return { text: String(data.text ?? ''),segments: data.segments?.map((s: any) => ({text: String(s.text ?? ''),speaker: String(s.speaker ?? 'A'),start: s.start,end: s.end})) };
}
