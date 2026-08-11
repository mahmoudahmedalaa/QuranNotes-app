const assert = require('node:assert/strict');
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
