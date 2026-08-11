#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const { decodeUtf8Chunks } = require('./tafsir-download-utils');

const SOURCES = [
  { key: 'ibn_kathir', resourceId: 169, source: 'ibn_kathir_en_abridged', sourceTitle: 'Ibn Kathir (Abridged)' },
  { key: 'al_sadi', resourceId: 91, source: 'al_sadi_ar', sourceTitle: "السعدي Al-Sa'di" },
];
const VERSE_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];
const PRODUCTION_DIR = path.resolve(__dirname, '..', 'src', 'features', 'tafsir', 'data', 'tafsir');
const RETRIES = 2;
const IBN_KATHIR_GAPS = new Set(['105:1', '105:2', '105:3', '105:4', '105:5']);

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim();
}

function httpGet(url, retries = RETRIES) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const request = () => {
      attempt += 1;
      https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = decodeUtf8Chunks(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body);
          if (attempt <= retries) return setTimeout(request, 250 * attempt);
          reject(new Error(`HTTP ${res.statusCode} after ${attempt} attempts: ${url}`));
        });
      }).on('error', error => {
        if (attempt <= retries) return setTimeout(request, 250 * attempt);
        reject(error);
      });
    };
    request();
  });
}

function parseOutputDirectory(argv) {
  const index = argv.indexOf('--output-dir');
  if (index < 0 || !argv[index + 1]) throw new Error('--output-dir is required; direct corpus overwrite is disabled');
  const outputDir = path.resolve(argv[index + 1]);
  if (outputDir === PRODUCTION_DIR) throw new Error('output directory must be a staging directory, not the production corpus');
  return outputDir;
}

async function mapWithConcurrency(items, concurrency, worker) {
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
}

async function downloadSurah(source, surah, outputDir) {
  const raw = await httpGet(`https://api.quran.com/api/v4/tafsirs/${source.resourceId}/by_chapter/${surah}?per_page=300`);
  const response = JSON.parse(raw);
  if (!Array.isArray(response.tafsirs)) throw new Error(`${source.key} ${surah}: missing tafsirs array`);
  const rows = response.tafsirs;
  const verseCount = VERSE_COUNTS[surah - 1];
  const verses = {};

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.resource_id !== source.resourceId) throw new Error(`${source.key} ${surah}: resource ID drift`);
    const match = new RegExp(`^${surah}:(\\d+)$`).exec(row.verse_key);
    if (!match) throw new Error(`${source.key} ${surah}: invalid verse_key ${row.verse_key}`);
    const verse = Number(match[1]);
    const text = stripHtml(row.text || '');

    if (source.key === 'al_sadi') {
      if (!text) throw new Error(`${source.key} ${row.verse_key}: empty text`);
      verses[String(verse)] = { text, range: [verse, verse] };
      continue;
    }
    if (!text) continue;
    let rangeEnd = verse;
    for (let cursor = index + 1; cursor < rows.length && !stripHtml(rows[cursor].text || ''); cursor += 1) {
      rangeEnd = Number(rows[cursor].verse_key.split(':')[1]);
    }
    for (let covered = verse; covered <= rangeEnd; covered += 1) {
      verses[String(covered)] = { text, range: [verse, rangeEnd] };
    }
  }

  const sourceGaps = source.key === 'ibn_kathir'
    ? Array.from({ length: verseCount }, (_, index) => `${surah}:${index + 1}`).filter(key => IBN_KATHIR_GAPS.has(key)).length
    : 0;
  const expected = source.key === 'ibn_kathir' ? verseCount - sourceGaps : rows.length;
  if (Object.keys(verses).length !== expected) {
    throw new Error(`${source.key} ${surah}: expected ${expected} mappings, received ${Object.keys(verses).length}`);
  }
  const target = path.join(outputDir, source.key, `surah_${String(surah).padStart(3, '0')}.json`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify({ verses }, null, 2)}\n`, 'utf8');
  return {
    mappings: Object.keys(verses).map(verse => `${surah}:${verse}`),
  };
}

async function main(argv = process.argv.slice(2)) {
  const outputDir = parseOutputDirectory(argv);
  fs.mkdirSync(outputDir, { recursive: true });
  const report = { schemaVersion: 1, retrievedAt: new Date().toISOString().slice(0, 10), sources: [] };
  for (const source of SOURCES) {
    const mappings = [];
    await mapWithConcurrency(Array.from({ length: 114 }, (_, index) => index + 1), 8, async surah => {
      const result = await downloadSurah(source, surah, outputDir);
      mappings.push(...result.mappings);
    });
    const expectedKeys = [];
    VERSE_COUNTS.forEach((count, index) => {
      for (let verse = 1; verse <= count; verse += 1) expectedKeys.push(`${index + 1}:${verse}`);
    });
    const mapped = new Set(mappings);
    report.sources.push({
      source: source.source,
      sourceTitle: source.sourceTitle,
      resourceId: source.resourceId,
      fileCount: 114,
      mappingCount: mappings.length,
      missingVerseKeys: expectedKeys.filter(key => !mapped.has(key)),
    });
  }
  fs.writeFileSync(path.join(outputDir, 'corpus-coverage.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1); });

module.exports = { downloadSurah, httpGet, main, parseOutputDirectory, stripHtml };
