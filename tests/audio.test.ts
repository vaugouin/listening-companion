import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('le worklet produit du PCM mono 24 kHz et ne rejoue aucun son',() => {
  for (const rate of [24000,48000]) {
    let Processor: any;
    const frames: {pcm: ArrayBuffer;rms: number}[] = [];
    runInNewContext(readFileSync('public/pcm-worklet.js','utf8'),{ sampleRate: rate,Int16Array,Math,AudioWorkletProcessor: class { port = { postMessage: (frame: any) => frames.push(frame) }; },registerProcessor: (_name: string,value: any) => Processor = value });
    const p = new Processor();
    const samples = new Float32Array(128).fill(.25);
    for (let i=0;i<Math.ceil(rate/128);i++) p.process([[samples]]);
    assert.ok(frames.length >= 10);
    assert.equal(new Int16Array(frames[0].pcm).length,2400);
    assert.equal(new Int16Array(frames[0].pcm)[0],8191);
    assert.equal(frames[0].rms,.25);
  }
});
