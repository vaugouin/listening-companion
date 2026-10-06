import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSearch, imageUrl, mapCard } from '../server/cinema';
import { statementSchema, extractionRequest } from '../server/openai';

test('contrat result[].data : notes pondérées, ordre et affiche TMDb',() => {
  const r = decodeSearch({ result_entity: 'movie',result: [
    { data: { ID_MOVIE: 1,MOVIE_TITLE: 'A',IMDB_RATING: 9,IMDB_RATING_WEIGHTED: 7,POSTER_PATH: '/a.jpg' } },
    { data: { ID_MOVIE: 2,MOVIE_TITLE: 'B',IMDB_RATING: 8,IMDB_RATING_WEIGHTED: 8,DAT_RELEASE: '1965-03-01' } },
  ] },'query');
  assert.deepEqual(r.cards.map(c => c.id),['2','1']);
  assert.equal(r.cards[1].image,'https://image.tmdb.org/t/p/w342/a.jpg');
  assert.equal(r.cards[0].subtitle,'1965');
  assert.equal(r.hasMore,false);
});
test('personnes triées par popularité et dates de vie',() => {
  const r = decodeSearch({ result_entity: 'person',result: [
    { data: { ID_PERSON: 1,PERSON_NAME: 'A',POPULARITY: 3,BIRTH_YEAR: 1930,DEATH_YEAR: 2022 } },
    { data: { ID_PERSON: 2,PERSON_NAME: 'B',POPULARITY: 10 } },
  ] },'query');
  assert.equal(r.cards[0].title,'B'); assert.equal(r.cards[1].subtitle,'1930 · 2022');
});
test('HTTP 200 peut être une erreur ; critère abandonné et homonyme restent visibles',() => {
  assert.throws(() => decodeSearch({error: 'provider failed',result: []},'query'),/provider failed/);
  const r = decodeSearch({ result: [],result_entity: 'movie',dropped_clause: 'année',name_ambiguity: {candidates: []} },'query');
  assert.match(r.warning!,/année/); assert.match(r.warning!,/homonymes/);
});
test('une ligne scalaire ne devient pas une carte avec un faux identifiant',() => {
  const r = decodeSearch({ result_entity: 'movie',result: [{ data: {count: 42} }] },'query');
  assert.equal(r.cards.length,0); assert.match(r.warning!,/identifiants/);
  assert.equal(mapCard({ ID_GENRE: 12,GENRE_NAME: 'Aventure',POSTER_PATH: '/not-tmdb.png' },'genre')?.image,null);
  assert.equal(imageUrl('javascript:alert(1)'),null);
});
test('page pleine propose une suite sans inventer un total',() => {
  const result = Array.from({length: 50},(_,i) => ({ data: {ID_MOVIE: i,MOVIE_TITLE: `Film ${i}`} }));
  assert.equal(decodeSearch({ result,result_entity: 'movie' },'query').hasMore,true);
  assert.equal(decodeSearch({ result,result_entity: 'movie' },'query',true).cards.length,1);
  assert.equal(decodeSearch({ result,result_entity: 'movie' },'query',true).hasMore,false);
});
test('extraction structurée refuse opérations et entrée invalides',() => {
  assert.throws(() => statementSchema.parse({ operation: 'delete' }));
  assert.throws(() => extractionRequest.parse({text: '',context: [],liveId: null}));
});
