#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSE_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const AL_SADI_GAPS = ["2:107","2:109","2:111","2:286","6:105","6:106","6:107","12:111","16:64","19:81","19:82","21:110","22:18","26:144","26:180","26:183","29:18","37:82","37:96","37:176","37:179","38:85","43:14","44:14","44:44","44:46","44:47","44:48","50:43","53:12","54:26","54:39","54:40","55:22","56:30","56:48","56:60","56:61","64:15","69:15","74:17","74:36","77:4","77:9","77:14","77:37","77:47","78:11","79:10","79:33","79:46","83:19","83:20","86:2","88:18","89:3","91:8","96:10","109:4"].sort();

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function main(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--corpus-dir');
  if (index < 0 || !argv[index + 1]) throw new Error('--corpus-dir is required');
  const root = path.resolve(argv[index + 1]);
  const coverageIndex = argv.indexOf('--coverage-report');
  const coveragePath = coverageIndex >= 0 && argv[coverageIndex + 1]
    ? path.resolve(argv[coverageIndex + 1])
    : path.join(root, 'corpus-coverage.json');
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  const summary = { files: {}, aggregateSha256: {} };
  for (const source of [{ key: 'ibn_kathir', count: 6236, gaps: [] }, { key: 'al_sadi', count: 6177, gaps: AL_SADI_GAPS }]) {
    const files = [];
    const actualKeys = [];
    for (let surah = 1; surah <= 114; surah += 1) {
      const file = path.join(root, source.key, `surah_${String(surah).padStart(3, '0')}.json`);
      const bytes = fs.readFileSync(file);
      const decoded = bytes.toString('utf8');
      if (decoded.includes('\uFFFD')) throw new Error(`${file}: contains U+FFFD`);
      const json = JSON.parse(decoded);
      for (const [key, value] of Object.entries(json.verses || {})) {
        const verse = Number(key);
        if (!Number.isInteger(verse) || verse < 1 || verse > VERSE_COUNTS[surah - 1]) throw new Error(`${file}: invalid verse ${key}`);
        if (!value || typeof value.text !== 'string' || !value.text.trim()) throw new Error(`${file}: empty text for ${key}`);
        if (!Array.isArray(value.range) || value.range.length !== 2 || value.range[0] > verse || value.range[1] < verse) throw new Error(`${file}: invalid range for ${key}`);
        actualKeys.push(`${surah}:${verse}`);
      }
      files.push({ path: file, sha256: sha256(bytes) });
    }
    if (new Set(actualKeys).size !== actualKeys.length || actualKeys.length !== source.count) throw new Error(`${source.key}: mapping count drift (${actualKeys.length})`);
    const all = [];
    VERSE_COUNTS.forEach((count, s) => { for (let v = 1; v <= count; v += 1) all.push(`${s + 1}:${v}`); });
    const actual = new Set(actualKeys);
    const gaps = all.filter(key => !actual.has(key)).sort();
    if (JSON.stringify(gaps) !== JSON.stringify(source.gaps)) throw new Error(`${source.key}: gap set drift`);
    const manifestSource = coverage.sources.find(item => item.source === (source.key === 'ibn_kathir' ? 'ibn_kathir_en_abridged' : 'al_sadi_ar'));
    if (!manifestSource || manifestSource.mappingCount !== source.count || JSON.stringify([...manifestSource.missingVerseKeys].sort()) !== JSON.stringify(source.gaps)) throw new Error(`${source.key}: coverage report drift`);
    summary.files[source.key] = files;
    const payload = files.map(file => `${path.relative(process.cwd(), file.path)}\0${file.sha256}\n`).sort().join('');
    summary.aggregateSha256[source.key] = sha256(Buffer.from(payload, 'utf8'));
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.message); process.exit(1); } }
module.exports = { AL_SADI_GAPS, main };
