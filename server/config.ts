import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';
import { normalizeBasePath } from './routing';

// Deliberately do not inject unrelated database credentials into process.env.
const local = existsSync('.env.local') ? parse(readFileSync('.env.local')) : {};
const externalPath = process.env.EXTERNAL_ENV_FILE ?? local.EXTERNAL_ENV_FILE;
let external: Record<string, string> = {};
if (externalPath && existsSync(resolve(externalPath))) external = parse(readFileSync(resolve(externalPath)));
const setting = (key: string, fallback = '') => process.env[key] ?? local[key] ?? external[key] ?? fallback;
const root = setting('TEXT2SQL_API_URL', 'http://www.vaugouin.com');
const base = new URL(root);
if (!base.port && base.protocol === 'http:') base.port = setting('API_PORT_GREEN', '8187');

export const config = {
  port: Number(setting('PORT', '4310')),
  host: setting('HOST', '127.0.0.1'),
  basePath: normalizeBasePath(setting('BASE_PATH', '/')),
  publicOrigin: setting('PUBLIC_ORIGIN') ? new URL(setting('PUBLIC_ORIGIN')).origin : '',
  openaiKey: setting('OPENAI_API_KEY'),
  cinemaKey: setting('TEXT2SQL_API_KEY'),
  cinemaBase: setting('TEXT2SQL_BASE_URL', base.toString()).replace(/\/$/, ''),
  model: setting('OPENAI_MODEL', 'gpt-4.1-mini'),
  transcriptionModel: setting('TRANSCRIPTION_MODEL', 'gpt-live-transcribe'),
  fileTranscriptionModel: setting('FILE_TRANSCRIPTION_MODEL', 'gpt-4o-transcribe-diarize'),
};

export function cleanError(error: unknown): string {
  let message = error instanceof Error ? error.message : 'Une erreur est survenue.';
  for (const secret of [config.openaiKey, config.cinemaKey]) if (secret) message = message.replaceAll(secret, '[masqué]');
  return message.replace(/sk-[A-Za-z0-9_-]+/g, '[masqué]').slice(0, 600);
}
