#!/usr/bin/env node
/**
 * download_tafsir.js — Fetch tafsir data from Quran.com API and save as bundled JSON.
 *
 * Sources:
 *   - Ibn Kathir (Abridged) English: resource_id 169
 *   - Al-Sa'di Arabic: resource_id 91
 *
 * Output structure:
 *   src/features/tafsir/data/tafsir/ibn_kathir/surah_001.json
 *   src/features/tafsir/data/tafsir/al_sadi/surah_001.json
 *
 * Each file: { "verses": { "1": "commentary text...", "2": "...", ... } }
 *
 * Usage: node scripts/download_tafsir.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { decodeUtf8Chunks } = require('./tafsir-download-utils');

// ── Config ──
const SOURCES = [
    { key: 'ibn_kathir', resourceId: 169, name: 'Ibn Kathir (English)' },
    { key: 'al_sadi', resourceId: 91, name: 'Al-Sa\'di (Arabic)' },
];

const BASE_URL = 'https://api.quran.com/api/v4';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'features', 'tafsir', 'data', 'tafsir');

// Verse count per surah (114 surahs)
const VERSE_COUNTS = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6,
];

/**
 * Simple HTTPS GET that returns a Promise<string>.
 */
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const data = decodeUtf8Chunks(chunks);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Strip HTML tags from text.
 */
function stripHtml(html) {
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
 * Fetch tafsir for a specific surah, one ayah at a time.
 * Falls back to by_chapter if by_ayah times out.
 */
async function fetchSurahTafsir(resourceId, surahNumber, verseCount) {
    const verses = {};

    // Try fetching entire chapter at once first (more efficient)
    try {
        const url = `${BASE_URL}/tafsirs/${resourceId}/by_chapter/${surahNumber}`;
        const raw = await httpGet(url);
        const json = JSON.parse(raw);

        if (json.tafsirs && Array.isArray(json.tafsirs)) {
            for (const entry of json.tafsirs) {
                const vn = entry.verse_number || entry.verse_id;
                if (vn) {
                    // verse_number could be like "1:3" or just 3
                    const verseNum = String(vn).includes(':') ? String(vn).split(':')[1] : String(vn);
                    const text = stripHtml(entry.text || '');
                    if (text) {
                        verses[verseNum] = text;
                    }
                }
            }
        }

        // If we got reasonable data, return it
        if (Object.keys(verses).length > 0) {
            return verses;
        }
    } catch (e) {
        console.warn(`  [WARN] by_chapter failed for surah ${surahNumber}: ${e.message}, trying by_ayah...`);
    }

    // Fallback: fetch verse-by-verse
    for (let v = 1; v <= verseCount; v++) {
        try {
            const url = `${BASE_URL}/tafsirs/${resourceId}/by_ayah/${surahNumber}:${v}`;
            const raw = await httpGet(url);
            const json = JSON.parse(raw);

            let text = '';
            if (json.tafsir && json.tafsir.text) {
                text = stripHtml(json.tafsir.text);
            } else if (json.tafsirs && Array.isArray(json.tafsirs)) {
                text = json.tafsirs.map(t => stripHtml(t.text || '')).join('\n\n');
            }

            if (text) {
                verses[String(v)] = text;
            }

            // Rate limiting: be respectful to the API
            await new Promise(r => setTimeout(r, 100));
        } catch (e) {
            console.warn(`  [WARN] Failed to fetch ${surahNumber}:${v}: ${e.message}`);
        }
    }

    return verses;
}

/**
 * Main entry point.
 */
async function main() {
    console.log('🕌 Tafsir Downloader — Fetching from Quran.com API\n');

    for (const source of SOURCES) {
        console.log(`\n📖 Downloading ${source.name} (resource ID: ${source.resourceId})...`);

        const dir = path.join(OUTPUT_DIR, source.key);
        fs.mkdirSync(dir, { recursive: true });

        let totalVerses = 0;
        let totalSurahs = 0;

        for (let surah = 1; surah <= 114; surah++) {
            const padded = String(surah).padStart(3, '0');
            const outFile = path.join(dir, `surah_${padded}.json`);

            // Skip if already downloaded
            if (fs.existsSync(outFile)) {
                const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
                const count = Object.keys(existing.verses || {}).length;
                if (count > 0) {
                    totalVerses += count;
                    totalSurahs++;
                    process.stdout.write(`  ✅ Surah ${surah} (cached: ${count} verses)\n`);
                    continue;
                }
            }

            const verseCount = VERSE_COUNTS[surah - 1];
            const verses = await fetchSurahTafsir(source.resourceId, surah, verseCount);
            const count = Object.keys(verses).length;

            fs.writeFileSync(outFile, JSON.stringify({ verses }, null, 2), 'utf8');

            totalVerses += count;
            totalSurahs++;

            process.stdout.write(`  📄 Surah ${surah}: ${count}/${verseCount} verses\n`);

            // Rate limiting between surahs
            await new Promise(r => setTimeout(r, 200));
        }

        console.log(`\n  📊 ${source.name}: ${totalSurahs} surahs, ${totalVerses} verses total`);
    }

    console.log('\n✅ Done! Tafsir data saved to src/features/tafsir/data/tafsir/');
}

main().catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
});
