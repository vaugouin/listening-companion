import { pruneForest, validateSession, type Forest, type Card, type Session } from './domain';
const KEY = 'hors-champ-forest-v1';
const empty = (): Forest => ({ version: 1, sessions: [], activeSessionId: null, retentionDays: 0 });
export function loadForest(): Forest {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!value || value.version !== 1 || !Array.isArray(value.sessions)) return empty();
    const sessions: Session[] = value.sessions.filter(validateSession).map((s: Session) => ({ ...s,layers: s.layers.map(l => l.status === 'loading' ? { ...l,status: 'error',error: 'Recherche interrompue. Rejouez cette couche pour la reprendre.' } : l) }));
    const activeSessionId = sessions.some(s => s.id === value.activeSessionId) ? value.activeSessionId : sessions.at(-1)?.id ?? null;
    return pruneForest({ ...value,sessions,activeSessionId,retentionDays: Number.isFinite(value.retentionDays) && value.retentionDays >= 0 ? value.retentionDays : 0 });
  } catch { return empty(); }
}
export function saveForest(forest: Forest) { localStorage.setItem(KEY,JSON.stringify(forest)); }
export function snapshot(session: Session, cards: Record<string,Card>) { return { format: 'hors-champ-snapshot', version: 1, exportedAt: new Date().toISOString(), session, appearance: cards }; }
export function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{ type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
export function parseImport(data: any): { session: Session; appearance: Record<string,Card> } {
  if (data?.version !== 1 || !validateSession(data?.session)) throw new Error('Ce fichier n’est pas une séance Hors Champ valide.');
  const appearance: Record<string,Card> = {};
  for (const [key,c] of Object.entries(data.appearance ?? {})) {
    const card = c as Card;
    if (card && typeof card.title === 'string' && typeof card.id === 'string' && typeof card.entity === 'string') appearance[key] = card;
  }
  return { session: data.session, appearance };
}
export function encodeShare(data: unknown) { return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data)))); }
export function decodeShare(encoded: string) { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c => c.charCodeAt(0)))); }
