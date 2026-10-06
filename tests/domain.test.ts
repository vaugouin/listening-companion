import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendStatement, finishLayer, hexSpiral, newSession, pruneForest, validateSession, type Session, type Statement } from '../src/domain';
import { demoTurns, demoCards } from '../src/demo';
import { parseImport, snapshot, encodeShare, decodeShare } from '../src/storage';
const put = (session: Session, statement: Statement, id: string) => appendStatement(session,statement,'Claire',statement.evidence,id).session;

test('six passages : ET, film seul, contradiction sœur et retour à Godard',() => {
  let s = newSession(); let count = 0;
  for (const turn of demoTurns) for (const statement of turn.statements) s = put(s,statement,`node-${count++}`);
  assert.equal(s.layers.length,9);
  const [wave,godard,pierrot,truffaut,coups,nolan,odyssee,back,breath] = s.layers;
  assert.equal(godard.parentId,wave.id);
  assert.deepEqual(godard.criteria.map(c => c.value),['Nouvelle Vague','Jean-Luc Godard']);
  assert.equal(pierrot.criteria.length,1);
  assert.equal(truffaut.parentId,godard.parentId);
  assert.equal(truffaut.pileId,godard.pileId);
  assert.deepEqual(truffaut.criteria.map(c => c.value),['Nouvelle Vague','François Truffaut']);
  assert.equal(coups.parentId,truffaut.id);
  assert.notEqual(nolan.pileId,wave.pileId);
  assert.equal(odyssee.parentId,nolan.id);
  assert.equal(back.parentId,godard.id);
  assert.equal(breath.pileId,wave.pileId);
  assert.equal(s.liveId,breath.id);
  assert.equal(godard.statement.value,'Jean-Luc Godard');
  assert.ok(validateSession(s));
});

test('une contradiction sur la racine reste dans la même pile',() => {
  const godard = { ...demoTurns[1].statements[0],operation: 'new' as const };
  let s = put(newSession(),godard,'godard');
  s = put(s,demoTurns[3].statements[0],'truffaut');
  assert.equal(s.layers[0].pileId,s.layers[1].pileId);
  assert.equal(s.layers[1].parentId,null);
});

test('spirale : centre, anneaux de 6k positions et aucune duplication',() => {
  const points = hexSpiral(61);
  assert.equal(new Set(points.map(p => `${p.q},${p.r}`)).size,61);
  const ring = (q: number,r: number) => Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));
  for (let k=1;k<=4;k++) assert.equal(points.filter(p => ring(p.q,p.r) === k).length,6*k);
});

test('pagination conserve les identifiants ordonnés sans figer les titres',() => {
  let s = put(newSession(),demoTurns[0].statements[0],'wave');
  const result = { cards: demoCards.slice(0,2),hasMore: true,answer: '',query: 'critères' };
  s = finishLayer(s,'wave',result);
  s = finishLayer(s,'wave',{ ...result,cards: demoCards.slice(1,3) },2);
  assert.equal(s.layers[0].refs.length,3);
  assert.deepEqual(Object.keys(s.layers[0].refs[0]).sort(),['entity','id']);
  assert.deepEqual(s.layers[0].refs.map(r => r.id),demoCards.slice(0,3).map(c => c.id));
});

test('export fige l’apparence, import refuse les cycles, partage conserve les accents',() => {
  let s = put(newSession('Cinéma français'),demoTurns[0].statements[0],'wave');
  s = put(s,demoTurns[1].statements[0],'godard');
  const data = snapshot(s,{'movie:269': demoCards[0]});
  assert.equal(parseImport(data).appearance['movie:269'].title,'À bout de souffle');
  assert.deepEqual(decodeShare(encodeShare(data)),data);
  const corrupt = structuredClone(data);
  corrupt.session.layers[0].parentId = 'godard';
  assert.throws(() => parseImport(corrupt));
});

test('conservation réglable garde la séance active',() => {
  const old = { ...newSession(),updatedAt: '2020-01-01T00:00:00Z' };
  const active = { ...old,id: 'active' };
  const forest = { version: 1 as const,sessions: [old,active],activeSessionId: active.id,retentionDays: 7 };
  assert.deepEqual(pruneForest(forest).sessions,[active]);
  assert.equal(pruneForest({ ...forest,retentionDays: 0 }).sessions.length,2);
});
