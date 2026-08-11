const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

let decodeUtf8Chunks;
try {
  ({ decodeUtf8Chunks } = require('./tafsir-download-utils'));
} catch {
  // RED: the shared byte-safe decoder does not exist yet.
}

test('decodes Arabic and salawat when UTF-8 bytes are split across chunks', () => {
  assert.equal(typeof decodeUtf8Chunks, 'function');

  const expected = 'عَلَى ﷺ';
  const bytes = Buffer.from(expected, 'utf8');
  const chunks = Array.from(bytes, (byte) => Buffer.from([byte]));

  assert.equal(decodeUtf8Chunks(chunks), expected);
  assert.equal(decodeUtf8Chunks(chunks).includes('\uFFFD'), false);
});

test('does not accept misrouted Al-Humazah commentary as Surah Al-Fil', () => {
  const corpus = path.join(__dirname, '..', 'src', 'features', 'tafsir', 'data', 'tafsir', 'ibn_kathir');
  const surah104 = JSON.parse(fs.readFileSync(path.join(corpus, 'surah_104.json'), 'utf8'));
  const surah105 = JSON.parse(fs.readFileSync(path.join(corpus, 'surah_105.json'), 'utf8'));
  const surah104Texts = new Set(Object.values(surah104.verses).map(verse => verse.text));

  for (const verse of Object.values(surah105.verses)) {
    assert.equal(surah104Texts.has(verse.text), false);
    assert.equal(verse.text.includes('end of the Tafsir of Surat Al-Humazah'), false);
  }
});
