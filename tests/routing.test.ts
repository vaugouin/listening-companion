import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedOrigin, normalizeBasePath } from '../server/routing';

test('les chemins racine et VPS sont normalisés sans chemin ambigu', () => {
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('/hors-champ'), '/hors-champ/');
  assert.equal(normalizeBasePath('/hors-champ/'), '/hors-champ/');
  for (const path of ['https://example.com/', '/a/../b', '/a?b', '/%2e%2e/', 'hors-champ']) {
    assert.throws(() => normalizeBasePath(path));
  }
});

test('seule l’origine publique exacte est autorisée en plus des origines locales', () => {
  assert.equal(allowedOrigin('https://www.vaugouin.com', 4310, 'https://www.vaugouin.com'), true);
  assert.equal(allowedOrigin('https://www.vaugouin.com.evil.test', 4310, 'https://www.vaugouin.com'), false);
  assert.equal(allowedOrigin('https://evil.test', 4310, 'https://www.vaugouin.com'), false);
  assert.equal(allowedOrigin('http://127.0.0.1:4310', 4310, ''), true);
});
