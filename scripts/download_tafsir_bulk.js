#!/usr/bin/env node
/**
 * download_tafsir_bulk.js — Bulk download tafsir data from jsDelivr CDN.
 *
 * Uses spa5k/tafsir_api GitHub repo served via jsDelivr CDN (no rate limits).
 * Downloads 114 surah files per source in parallel batches.
 *
 * Sources:
 *   - Ibn Kathir (English): en-tafisr-ibn-kathir
 *   - Al-Sa'di (Arabic): ar-tafseer-al-saddi
 *
 * Output:
 *   src/features/tafsir/data/tafsir/ibn_kathir/surah_001.json
 *   src/features/tafsir/data/tafsir/al_sadi/surah_001.json
 *
 * Each output file: { "verses": { "1": "text...", "2": "...", ... } }
 *
 * Usage: node scripts/download_tafsir_bulk.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { decodeUtf8Chunks } = require('./tafsir-download-utils');

// ── Config ──
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir';
const SOURCES = [
    { key: 'ibn_kathir', slug: 'en-tafisr-ibn-kathir', name: 'Ibn Kathir (English)' },
    { key: 'al_sadi', slug: 'ar-tafseer-al-saddi', name: 'Al-Sa\'di (Arabic)' },
];
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'features', 'tafsir', 'data', 'tafsir');
const BATCH_SIZE = 10; // parallel downloads per batch
const TOTAL_SURAHS = 114;

/**
 * HTTPS GET returning a Promise<string>.
 */
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpGet(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = decodeUtf8Chunks(chunks);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Strip HTML tags.
 */
function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Download a single surah's tafsir and save to disk.
 */
async function downloadSurah(source, surahNumber) {
    const url = `${CDN_BASE}/${source.slug}/${surahNumber}.json`;
    const padded = String(surahNumber).padStart(3, '0');
    const outFile = path.join(OUTPUT_DIR, source.key, `surah_${padded}.json`);

    try {
        const raw = await httpGet(url);
        const json = JSON.parse(raw);

        // Convert from { ayahs: [{ ayah, text }] } → { verses: { "1": "text", ... } }
        const verses = {};
        if (json.ayahs && Array.isArray(json.ayahs)) {
            for (const entry of json.ayahs) {
                const text = stripHtml(entry.text || '');
                if (text) {
                    verses[String(entry.ayah)] = text;
                }
            }
        }

        fs.writeFileSync(outFile, JSON.stringify({ verses }, null, 2), 'utf8');
        return Object.keys(verses).length;
    } catch (e) {
        console.warn(`  ⚠️  Surah ${surahNumber}: ${e.message}`);
        return 0;
    }
}

/**
 * Download all surahs for a source in parallel batches.
 */
async function downloadSource(source) {
    const dir = path.join(OUTPUT_DIR, source.key);
    fs.mkdirSync(dir, { recursive: true });

    let totalVerses = 0;
    const startTime = Date.now();

    // Process in batches
    for (let batch = 0; batch < Math.ceil(TOTAL_SURAHS / BATCH_SIZE); batch++) {
        const start = batch * BATCH_SIZE + 1;
        const end = Math.min(start + BATCH_SIZE, TOTAL_SURAHS + 1);

        const promises = [];
        for (let s = start; s < end; s++) {
            promises.push(downloadSurah(source, s));
        }

        const results = await Promise.all(promises);
        totalVerses += results.reduce((a, b) => a + b, 0);

        const pct = Math.round((end / TOTAL_SURAHS) * 100);
        process.stdout.write(`  📥 ${pct}% (surahs ${start}-${end - 1})\n`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ✅ ${source.name}: 114 surahs, ${totalVerses} verses in ${elapsed}s\n`);
    return totalVerses;
}

async function main() {
    console.log('🕌 Tafsir Bulk Download — via jsDelivr CDN (no rate limits)\n');

    let grandTotal = 0;
    for (const source of SOURCES) {
        console.log(`📖 Downloading ${source.name}...`);
        grandTotal += await downloadSource(source);
    }

    console.log(`\n🎉 Done! Total: ${grandTotal} verses across both sources`);
    console.log(`   Data saved to: src/features/tafsir/data/tafsir/`);
}

main().catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
});
