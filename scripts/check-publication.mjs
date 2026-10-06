import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const local = existsSync('.env.local') ? parse(readFileSync('.env.local')) : {};
const external = local.EXTERNAL_ENV_FILE && existsSync(local.EXTERNAL_ENV_FILE) ? parse(readFileSync(local.EXTERNAL_ENV_FILE)) : {};
const secrets = [process.env.OPENAI_API_KEY, process.env.TEXT2SQL_API_KEY, external.OPENAI_API_KEY, external.TEXT2SQL_API_KEY].filter(Boolean);
const patterns = [/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const failures = [];
for (const path of paths) {
  if (/^\.env(?:\.|$)/.test(path) && path !== '.env.example') failures.push(path);
  if (/^(?:node_modules|dist|dist-server)\//.test(path) || /\.(?:pem|key|wav)$/.test(path)) failures.push(path);
  const content = execFileSync('git', ['show', `:${path}`], { maxBuffer: 5 * 1024 * 1024 }).toString('utf8');
  if (secrets.some(secret => content.includes(secret)) || patterns.some(pattern => pattern.test(content))) failures.push(path);
}
if (failures.length) {
  console.error('Publication bloquée : vérifier ces fichiers sans afficher les valeurs :');
  console.error([...new Set(failures)].join('\n'));
  process.exit(1);
}
console.log(`Publication : ${paths.length} fichiers contrôlés, aucune clé ni fichier privé détecté.`);
