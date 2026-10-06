import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStatementPolicy } from '../server/statement-policy';
import { demoTurns } from '../src/demo';

test('régression réelle : chez Godard affine le sujet au lieu de créer une biographie',() => {
  const candidate = {...demoTurns[1].statements[0],entity: 'person' as const,property: 'nom',named: true,operation: 'new' as const};
  const [s] = applyStatementPolicy({text: demoTurns[1].text,context: [],liveId: 'wave'},[candidate]);
  assert.equal(s.entity,'movie'); assert.equal(s.property,'réalisateur'); assert.equal(s.named,false); assert.equal(s.operation,'refine');
});
test('régression réelle : Nolan, son film puis réalisateur dupliqué restent deux couches',() => {
  const person = {...demoTurns[4].statements[0],entity: 'person' as const,property: 'nom',named: true};
  const role = demoTurns[4].statements[0];
  const result = applyStatementPolicy({text: demoTurns[4].text,context: [],liveId: 'wave'},[person,demoTurns[4].statements[1],role]);
  assert.equal(result.length,2); assert.equal(result[0].operation,'new'); assert.equal(result[1].operation,'refine'); assert.equal(result[0].property,'réalisateur');
});
test('un retour vocal cible le critère retrouvé, puis le film affine cette branche',() => {
  const result = applyStatementPolicy({text: demoTurns[5].text,liveId: 'nolan',context: [{id: 'godard',parentId: 'wave',property: 'réalisateur',value: 'Jean-Luc Godard',topic: 'Nouvelle Vague',label: 'Godard'}]},[{...demoTurns[5].statements[0],property: 'nom',entity: 'person',named: true},demoTurns[5].statements[1]]);
  assert.equal(result[0].targetId,'godard'); assert.equal(result[0].named,false); assert.equal(result[1].operation,'refine');
});
