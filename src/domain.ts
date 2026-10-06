export type Entity = 'movie' | 'serie' | 'person' | 'collection' | 'list' | 'topic' | 'movement' | 'technical' | 'genre' | 'group' | 'death' | 'award' | 'nomination' | 'location';
export type Ref = { entity: Entity; id: string };
export type Card = Ref & { title: string; image: string | null; subtitle: string; score: number | null; weighted: number; popularity: number; description?: string; mosaic?: string[]; missing?: boolean };
export type Criterion = { entity: 'movie' | 'serie' | 'person' | 'other'; property: string; value: string };
export type Statement = Criterion & { operation: 'new' | 'refine' | 'fork' | 'back'; label: string; topic: string; evidence: string; targetId: string | null; named: boolean };
export type Layer = { id: string; pileId: string; parentId: string | null; label: string; topic: string; statement: Statement; criteria: Criterion[]; speaker: string; heard: string; createdAt: string; refs: Ref[]; page: number; hasMore: boolean; status: 'loading' | 'ready' | 'error'; error?: string; warning?: string; answer?: string; query: string };
export type Session = { id: string; title: string; createdAt: string; updatedAt: string; liveId: string | null; layers: Layer[]; transcripts: { id: string; text: string; speaker: string; at: string }[]; demo?: boolean };
export type Forest = { version: 1; sessions: Session[]; activeSessionId: string | null; retentionDays: number };
export type SearchResult = { cards: Card[]; hasMore: boolean; answer: string; warning?: string; query: string };

export function newSession(title = 'Une conversation cinéma'): Session {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, createdAt: now, updatedAt: now, liveId: null, layers: [], transcripts: [] };
}
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const refKey = (r: Ref) => `${r.entity}:${r.id}`;

export function ancestors(session: Session, id: string | null): Layer[] {
  const result: Layer[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const layer = session.layers.find(l => l.id === id);
    if (!layer) break;
    result.unshift(layer);
    id = layer.parentId;
  }
  return result;
}

export function buildQuestion(criteria: Criterion[], named: boolean): string {
  const directQuestion = criteria.find(c => c.property === 'question');
  if (directQuestion) return directQuestion.value;
  const kind = criteria.at(-1)?.entity ?? 'movie';
  const subject = kind === 'person' ? 'les personnes' : kind === 'serie' ? 'les séries' : 'les films';
  const conditions = criteria.map(c => `${c.property} : ${c.value}`).join(' ET ');
  const order = kind === 'person' ? 'popularité décroissante' : 'note IMDb pondérée décroissante';
  return `Trouve ${subject} satisfaisant toutes ces conditions : ${conditions}. ${named ? 'Il s’agit du titre ou du nom explicitement cité : retourne uniquement cette entité exacte, pas ses œuvres associées. ' : ''}Classe par ${order}. Fournis les identifiants, titres ou noms, images, dates et notes IMDb.`;
}

/** One layer per statement. Viewing history never changes the live processing head. */
export function appendStatement(session: Session, statement: Statement, speaker: string, heard: string, id: string = crypto.randomUUID()): { session: Session; layer: Layer } {
  let parent = session.layers.find(l => l.id === session.liveId) ?? null;
  const previousHead = parent;
  if (statement.operation === 'back') {
    parent = session.layers.find(l => l.id === statement.targetId) ?? [...session.layers].reverse().find(l =>
      normalize(l.statement.value) === normalize(statement.value) || normalize(l.label) === normalize(statement.topic)
    ) ?? null;
  }
  if (statement.operation === 'new') parent = null;
  if (statement.operation === 'fork' && parent) {
    const conflict = ancestors(session, parent.id).reverse().find(l => l.statement.property === statement.property);
    if (conflict) parent = session.layers.find(l => l.id === conflict.parentId) ?? null;
  }
  const inherited = parent?.criteria ?? [];
  const criterion: Criterion = { entity: statement.entity, property: statement.property, value: statement.value };
  // An explicitly named work is its own one-card query. Its parent remains navigable.
  const criteria = statement.named ? [criterion] : [...inherited.filter(c => c.property !== criterion.property), criterion];
  const pileId = parent?.pileId ?? (statement.operation === 'fork' ? previousHead?.pileId : undefined) ?? id;
  const topic = parent?.topic ?? (statement.operation === 'fork' ? previousHead?.topic : undefined) ?? statement.topic;
  const layer: Layer = { id, pileId, parentId: parent?.id ?? null, label: statement.label, topic, statement, criteria, speaker, heard, createdAt: new Date().toISOString(), refs: [], page: 0, hasMore: false, status: 'loading', query: buildQuestion(criteria, statement.named) };
  return { layer, session: { ...session, liveId: id, updatedAt: layer.createdAt, layers: [...session.layers, layer] } };
}

export function finishLayer(session: Session, id: string, result: SearchResult, page = 1): Session {
  return { ...session, updatedAt: new Date().toISOString(), layers: session.layers.map(l => {
    if (l.id !== id) return l;
    const refs = page === 1 ? [] : [...l.refs];
    const seen = new Set(refs.map(refKey));
    for (const card of result.cards) if (!seen.has(refKey(card))) { refs.push({ entity: card.entity, id: card.id }); seen.add(refKey(card)); }
    return { ...l, refs, page, hasMore: result.hasMore, status: 'ready', answer: result.answer, warning: result.warning, error: undefined, query: result.query };
  }) };
}

/** Axial hexagonal spiral: fixed placement reflects order; the lens controls size. */
export function hexSpiral(count: number): { q: number; r: number }[] {
  const points = [{ q: 0, r: 0 }];
  const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  for (let ring = 1; points.length < count; ring++) {
    let q = 0, r = -ring;
    for (const [dq, dr] of directions) for (let step = 0; step < ring && points.length < count; step++) {
      points.push({ q, r }); q += dq; r += dr;
    }
  }
  return points.slice(0, count);
}

export function pruneForest(forest: Forest, now = Date.now()): Forest {
  if (!forest.retentionDays) return forest;
  const sessions = forest.sessions.filter(s => s.id === forest.activeSessionId || now - Date.parse(s.updatedAt) < forest.retentionDays * 86400000);
  return { ...forest, sessions };
}

export function validateSession(input: unknown): input is Session {
  if (!input || typeof input !== 'object') return false;
  const s = input as Session;
  if (typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.createdAt !== 'string' || typeof s.updatedAt !== 'string' || !Array.isArray(s.layers) || !Array.isArray(s.transcripts) || s.layers.length > 2000) return false;
  if (s.layers.some(l => !l || typeof l !== 'object')) return false;
  const ids = new Set(s.layers.map(l => l.id));
  if (ids.size !== s.layers.length) return false;
  if (s.liveId !== null && !ids.has(s.liveId)) return false;
  if (!s.layers.every(l => typeof l.id === 'string' && typeof l.label === 'string' && typeof l.pileId === 'string' && typeof l.topic === 'string' && typeof l.query === 'string' && (l.parentId === null || ids.has(l.parentId)) && l.parentId !== l.id && Array.isArray(l.criteria) && l.criteria.every(c => c && typeof c.property === 'string' && typeof c.value === 'string') && Array.isArray(l.refs) && l.refs.every(r => r && typeof r.id === 'string' && typeof r.entity === 'string') && l.statement && typeof l.statement.property === 'string' && typeof l.statement.value === 'string' && typeof l.speaker === 'string' && ['loading','ready','error'].includes(l.status))) return false;
  for (const start of s.layers) {
    const visited = new Set<string>();
    let current: Layer | undefined = start;
    while (current) { if (visited.has(current.id)) return false; visited.add(current.id); current = s.layers.find(l => l.id === current?.parentId); }
  }
  return s.transcripts.every(t => t && typeof t.id === 'string' && typeof t.text === 'string' && typeof t.speaker === 'string');
}
