export function normalizeBasePath(value = '/'): string {
  if (value === '/') return '/';
  const segments = value.split('/').filter(Boolean);
  if (!value.startsWith('/') || !segments.length || segments.some(segment => !/^[a-z0-9-]+$/.test(segment))) {
    throw new Error('BASE_PATH doit être un chemin comme /hors-champ/.');
  }
  return `/${segments.join('/')}/`;
}

export function allowedOrigin(origin: string | undefined, port: number, publicOrigin: string): boolean {
  if (!origin) return true;
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, 'http://127.0.0.1:5178', 'http://localhost:5178', publicOrigin].includes(origin);
}
