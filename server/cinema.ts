import { config } from './config';
import { buildQuestion, type Card, type Criterion, type Entity, type Ref, type SearchResult } from '../src/domain';

const fields: Record<Entity, [string, string, string]> = {
  movie: ['ID_MOVIE','MOVIE_TITLE','movies'], serie: ['ID_SERIE','SERIE_TITLE','series'], person: ['ID_PERSON','PERSON_NAME','persons'],
  collection: ['ID_T2S_COLLECTION','COLLECTION_NAME','collections'], list: ['ID_T2S_LIST','LIST_NAME','lists'], topic: ['ID_TOPIC','TOPIC_NAME','topics'], movement: ['ID_MOVEMENT','MOVEMENT_NAME','movements'],
  technical: ['ID_TECHNICAL','DESCRIPTION','technicals'], genre: ['ID_GENRE','GENRE_NAME','genres'], group: ['ID_GROUP','GROUP_NAME','groups'], death: ['ID_DEATH','DEATH_NAME','deaths'], award: ['ID_AWARD','AWARD_NAME','awards'], nomination: ['ID_NOMINATION','NOMINATION_NAME','nominations'], location: ['ID_LOCATION','LOCATION_NAME','locations'],
};
const number = (n: unknown): number | null => n === null || n === undefined || n === '' || !Number.isFinite(Number(n)) ? null : Number(n);
const year = (v: unknown) => String(v ?? '').slice(0, 4);
export function imageUrl(path: unknown, tmdb = true): string | null {
  if (typeof path !== 'string' || !path) return null;
  if (/^https:\/\//i.test(path)) return path;
  return tmdb && path.startsWith('/') ? `https://image.tmdb.org/t/p/w342${path}` : null;
}

export function mapCard(row: Record<string, unknown>, entity: Entity): Card | null {
  const f = fields[entity];
  if (!f || row[f[0]] === undefined || row[f[0]] === null) return null;
  const dates = entity === 'person' ? [year(row.BIRTH_YEAR), year(row.DEATH_YEAR)].filter(Boolean).join(' · ') : year(row.DAT_RELEASE ?? row.DAT_FIRST_AIR);
  const image = entity === 'person' ? row.PROFILE_PATH : row.POSTER_PATH;
  return { entity, id: String(row[f[0]]), title: String(row[f[1]] ?? 'Sans titre'), image: imageUrl(image, ['movie','serie','person'].includes(entity)) ?? imageUrl(row.WIKIPEDIA_IMAGE_PATH, false), subtitle: dates, score: number(row.IMDB_RATING), weighted: number(row.IMDB_RATING_WEIGHTED) ?? number(row.IMDB_RATING) ?? 0, popularity: number(row.POPULARITY) ?? 0, description: String(row.OVERVIEW ?? row.BIOGRAPHY ?? '') };
}

export function decodeSearch(body: any, query: string, named = false): SearchResult {
  if (body.error) throw new Error(`Recherche cinéma : ${body.error}${body.retry_after_seconds ? ` (réessayer dans ${body.retry_after_seconds} s)` : ''}`);
  const entity = body.result_entity as Entity;
  const rows: Record<string, unknown>[] = (body.result ?? []).map((r: any) => r.data);
  const cards = rows.map(row => mapCard(row, entity)).filter((c): c is Card => c !== null);
  cards.sort((a,b) => entity === 'person' ? b.popularity-a.popularity : b.weighted-a.weighted);
  const warnings = [body.dropped_clause ? `Critère non appliqué par le catalogue : ${body.dropped_clause}` : '', body.name_ambiguity ? 'Plusieurs homonymes sont possibles. Précisez le nom ou la date dans un nouvel énoncé.' : '', rows.length && !cards.length ? 'La réponse ne contient pas d’identifiants de cartes ; le texte reste consultable.' : ''].filter(Boolean);
  return { cards: named ? cards.slice(0,1) : cards, hasMore: !named && rows.length >= 50, answer: String(body.answer ?? ''), query, warning: warnings.join(' ') || undefined };
}

export async function cinemaFetch(path: string, init?: RequestInit): Promise<any> {
  if (!config.cinemaKey) throw new Error('La clé d’accès au catalogue cinéma est absente côté serveur.');
  const response = await fetch(`${config.cinemaBase}${path}`, { ...init, headers: { 'X-API-Key': config.cinemaKey, ...init?.headers }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Catalogue cinéma indisponible (HTTP ${response.status}).`);
  return response.json();
}

export async function searchCinema(criteria: Criterion[], named: boolean, page: number): Promise<SearchResult> {
  const query = buildQuestion(criteria, named);
  const body = await cinemaFetch('/search/text2sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: query, page, rows_per_page: 50, ui_language: 'fr', retrieve_from_cache: true, store_to_cache: false, complex_question_processing: false }) });
  return decodeSearch(body, query, named);
}

export async function hydrate(ref: Ref): Promise<Card> {
  const route = fields[ref.entity]?.[2];
  if (!route || !/^\d+$/.test(ref.id)) return { ...ref, title: 'Pas de résultat', subtitle: 'Identifiant introuvable', image: null, score: null, weighted: 0, popularity: 0, missing: true };
  try {
    const row = await cinemaFetch(`/${route}/${ref.id}?ui_language=fr`);
    const card = mapCard(row, ref.entity);
    if (!card) throw new Error('Identifiant introuvable.');
    if (!card.image && ['movement','collection','list','topic'].includes(ref.entity)) {
      const posters = Object.values(row).filter(Array.isArray).flat().map((item: any) => imageUrl(item?.POSTER_PATH)).filter((url): url is string => !!url).slice(0,4);
      if (posters.length) card.mosaic = posters;
    }
    return card;
  } catch (error) {
    // Only a genuinely absent entity becomes a missing card. Connectivity errors stay visible.
    if (error instanceof Error && /HTTP 404|Identifiant introuvable/.test(error.message)) return { ...ref, title: 'Pas de résultat', subtitle: 'Entité supprimée ou fusionnée', image: null, score: null, weighted: 0, popularity: 0, missing: true };
    throw error;
  }
}
