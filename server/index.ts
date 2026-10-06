import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { z } from 'zod';
import { config, cleanError } from './config';
import { extractStatements, extractionRequest } from './openai';
import { searchCinema, hydrate } from './cinema';
import { attachRealtime } from './realtime';
import { transcribeFile } from './transcribe';
import { allowedOrigin } from './routing';

const app = express();
const hostApp = express();
hostApp.enable('strict routing');
if (config.basePath !== '/') {
  hostApp.get('/', (_req, res) => res.redirect(308, config.basePath));
  hostApp.get(config.basePath.slice(0, -1), (req, res) => res.redirect(308, config.basePath + req.url.slice(req.path.length)));
}
hostApp.use(config.basePath === '/' ? '/' : config.basePath.slice(0, -1), app);
const server = createServer(hostApp);
export const originAllowed = (origin?: string) => allowedOrigin(origin, config.port, config.publicOrigin);
app.use((req, res, next) => {
  if (!originAllowed(req.headers.origin)) { res.status(403).json({ error: 'Origine non autorisée.' }); return; }
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-store');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', (_req,res) => res.json({ ok: true, openai: !!config.openaiKey, cinema: !!config.cinemaKey, model: config.model, transcriptionModel: config.transcriptionModel }));
app.post('/api/extract', async (req,res) => res.json(await extractStatements(extractionRequest.parse(req.body))));
app.post('/api/transcribe',express.raw({type: ['audio/*','application/octet-stream','video/mp4','video/webm'],limit: '25mb'}),async (req,res) => {
  if (!Buffer.isBuffer(req.body)) { res.status(400).json({ error: 'Un fichier audio est attendu.' }); return; }
  const filename = decodeURIComponent(req.header('X-Audio-Filename') ?? 'audio.wav');
  res.json(await transcribeFile(req.body,filename,req.header('Content-Type') ?? 'audio/wav'));
});
const criteria = z.array(z.object({ entity: z.enum(['movie','serie','person','other']), property: z.string().min(1).max(120), value: z.string().min(1).max(800) })).min(1).max(30);
app.post('/api/search', async (req,res) => {
  const input = z.object({ criteria, named: z.boolean(), page: z.number().int().min(1).max(100) }).parse(req.body);
  res.json(await searchCinema(input.criteria, input.named, input.page));
});
const entity = z.enum(['movie','serie','person','collection','list','topic','movement','technical','genre','group','death','award','nomination','location']);
app.post('/api/hydrate', async (req,res) => {
  const refs = z.array(z.object({ entity, id: z.string().regex(/^\d+$/) })).max(1000).parse(req.body.refs);
  const cards: unknown[] = [];
  // A small concurrency window prevents a restored forest from flooding the catalogue.
  for (let i = 0; i < refs.length; i += 8) cards.push(...await Promise.all(refs.slice(i,i+8).map(hydrate)));
  res.json({ cards });
});
app.use('/api', (_req,res) => res.status(404).json({ error: 'Route introuvable.' }));
app.use(express.static(resolve('dist'), { dotfiles: 'deny' }));
app.get('/{*path}', (_req,res) => res.sendFile(resolve('dist/index.html')));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const badInput = error instanceof z.ZodError || error instanceof SyntaxError;
  res.status(badInput ? 400 : 502).json({ error: badInput ? 'Données de requête invalides.' : cleanError(error) });
});
attachRealtime(server, originAllowed);
server.listen(config.port, config.host, () => console.log(`Hors Champ : http://${config.host}:${config.port}${config.basePath} · clés ${config.openaiKey && config.cinemaKey ? 'configurées' : 'incomplètes'}`));
