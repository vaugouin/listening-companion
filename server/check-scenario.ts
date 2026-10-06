import assert from 'node:assert/strict';
import { extractStatements } from './openai';
import { appendStatement, newSession } from '../src/domain';
import { demoTurns } from '../src/demo';
import { cleanError } from './config';

let session = newSession();
try {
  for (const [i,turn] of demoTurns.entries()) {
    const result = await extractStatements({text: turn.text,liveId: session.liveId,context: session.layers.map(l => ({id: l.id,parentId: l.parentId,label: l.label,topic: l.topic,property: l.statement.property,value: l.statement.value}))});
    for (const statement of result.statements) session = appendStatement(session,statement,turn.speaker,turn.text).session;
    console.log(JSON.stringify({passage: i+1,statements: result.statements.map(s => ({operation: s.operation,property: s.property,value: s.value,named: s.named}))}));
  }
  const godard = session.layers.find(l => l.statement.property === 'réalisateur' && l.statement.value.includes('Godard'));
  const truffaut = session.layers.find(l => l.statement.value.includes('Truffaut') && l.statement.operation === 'fork');
  const back = session.layers.find(l => l.statement.operation === 'back');
  assert.ok(godard && truffaut && back);
  assert.equal(truffaut.parentId,godard.parentId);
  assert.equal(back.pileId,godard.pileId);
  assert.ok(session.layers.some(l => l.statement.named && l.statement.value.includes('Pierrot')));
  console.log(JSON.stringify({check: 'scenario-extraction',ok: true,layers: session.layers.length}));
} catch (error) { console.log(JSON.stringify({check: 'scenario-extraction',ok: false,error: cleanError(error)})); process.exitCode = 1; }
