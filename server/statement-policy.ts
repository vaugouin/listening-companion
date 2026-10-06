import { normalize, type Statement } from '../src/domain';

type Context = { id: string; parentId: string | null; property: string; value: string; topic: string; label: string };
/** The model identifies facts. Explicit speech cues control the application's topology. */
export function applyStatementPolicy(input: {text: string; context: Context[]; liveId: string | null}, candidates: Statement[]): Statement[] {
  const text = normalize(input.text);
  const change = /changeons de sujet|autre sujet|passons (?:a|au)|parlons maintenant|change (?:the )?subject|moving on/.test(text);
  const back = /reven(?:ons|ir)|revenir|retournons|pour revenir|back to|return to/.test(text);
  const correction = /^\s*(non\b|plutot\b|au contraire\b|je voulais dire\b|no\b|rather\b)/.test(text);
  const continuation = /^\s*(et\b|mais\b|aussi\b|je pense\b|par exemple\b|chez\b|and\b|for example\b)/.test(text);
  const seen = new Set<string>();
  const result: Statement[] = [];
  for (const candidate of candidates) {
    const s = { ...candidate };
    const suppliedRole = candidates.find(c => c.property === 'réalisateur' && normalize(c.value) === normalize(s.value));
    if (s.entity === 'person' && s.property === 'nom' && (suppliedRole || /chez\b|films? de\b|montage|prepare\b/.test(text))) {
      s.entity = 'movie'; s.property = 'réalisateur'; s.named = false;
    }
    const key = `${s.entity}:${s.property}:${normalize(s.value)}`;
    if (seen.has(key)) continue;
    seen.add(key); result.push(s);
  }
  for (const [index,s] of result.entries()) {
    if (change) s.operation = index === 0 ? 'new' : 'refine';
    else if (back) {
      if (index === 0) {
        const target = [...input.context].reverse().find(c => normalize(c.value) === normalize(s.value));
        s.operation = 'back'; s.targetId = target?.id ?? null;
        if (target) { s.property = target.property; s.named = target.property === 'titre' || target.property === 'nom'; }
      } else s.operation = 'refine';
    } else if (correction) s.operation = index === 0 ? 'fork' : 'refine';
    else if (!input.liveId) s.operation = index === 0 ? 'new' : 'refine';
    else if (continuation || (s.named && s.property === 'titre')) s.operation = 'refine';
  }
  return result;
}
