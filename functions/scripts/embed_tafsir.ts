import * as fs from 'fs';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Requires GOOGLE_APPLICATION_CREDENTIALS in environment
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("❌ Missing GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'qurannotes-9f7a1'
});
const db = admin.firestore();

// Initialize unified Gen AI SDK using Vertex AI backend
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'qurannotes-9f7a1',
  location: 'us-central1'
});

// The existing Tafsir dataset
const TAFSIR_DIR = path.resolve(__dirname, '../../src/features/tafsir/data/tafsir/ibn_kathir/');

async function run() {
  console.log('🚀 Starting Vectorization of Ibn Kathir Tafsir via Gemini & Firestore...');
  const files = fs.readdirSync(TAFSIR_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const surahMatch = file.match(/surah_(\d+)\.json/);
    if (!surahMatch) continue;
    
    const surahId = parseInt(surahMatch[1], 10);
    console.log(`\n📚 Processing Surah ${surahId}...`);

    const data = JSON.parse(fs.readFileSync(path.join(TAFSIR_DIR, file), 'utf8'));
    const verses = data.verses;

    for (const key of Object.keys(verses)) {
      const entry = verses[key];
      const text = entry.text;
      const range = entry.range;

      const cleanText = text.replace(/\\n/g, ' ').substring(0, 8000); 
      const docId = `surah_${surahId}_verseRange_${range[0]}_${range[1]}_key_${key}`;

      try {
        const result = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: cleanText
        });
        if (!result.embeddings || !result.embeddings[0].values) throw new Error('No embedding returned');
        const embedding = result.embeddings[0].values;
        
        // Upsert into Firestore using FieldValue.vector (requires firebase-admin ^12.0.0 and a Vector indexed collection)
        await db.collection('tafsir_embeddings').doc(docId).set({
          surah: surahId,
          verse_start: range[0],
          verse_end: range[1],
          text: cleanText,
          embedding: FieldValue.vector(embedding) // Firebase native vector storage
        });
        
        console.log(`  ✅ Upserted ${docId}`);
      } catch (err) {
        console.error(`  ❌ Failed on ${docId}`, err);
      }
    }
  }
}

run().then(() => console.log('\n🎉 Finished vectorizing to Firestore!')).catch(console.error);
