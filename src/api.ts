import type { Card, Criterion, Ref, SearchResult, Session, Statement } from './domain';
import { appUrl } from './urls';

export async function api<T>(path: string, data?: unknown): Promise<T> {
  const r = await fetch(appUrl(`api/${path}`), data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? `Erreur HTTP ${r.status}`);
  return body;
}
export const extract = (text: string, session: Session) => api<{statements: Statement[]}>('extract', { text, liveId: session.liveId, context: session.layers.slice(-80).map(l => ({ id: l.id, parentId: l.parentId, label: l.label, topic: l.topic, property: l.statement.property, value: l.statement.value })) });
export const search = (criteria: Criterion[], named: boolean, page: number) => api<SearchResult>('search', { criteria, named, page });
export const hydrateCards = (refs: Ref[]) => api<{cards: Card[]}>('hydrate', { refs });
