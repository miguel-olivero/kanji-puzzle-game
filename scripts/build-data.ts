/**
 * build-data.ts — Build step: generates JSON data files from source data.
 *
 * Reads: data/source/kanji_source.csv, data/source/kanji_meta.json, data/source/words.json, data/source/confusables.json
 * Generates: public/data/kanji_decomp.json, public/data/kanji_meta.json, public/data/words.json, public/data/confusables.json
 * Reports: missing_kanji.txt (kanji referenced in words but missing decomposition)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Types ───────────────────────────────────────

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ComponentData {
  id: string;
  char: string;
  slot_id: string;
  order_index: number;
  bounds: Bounds;
}

interface DecompEntry {
  components: ComponentData[];
  layout: string;
}

interface WordEntry {
  id: string;
  kanji: string[];
  reading: string;
  meaning: string;
}

interface MetaEntry {
  reading: string;
  meaning: string;
}

// ─── Paths ───────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'data', 'source');
const OUTPUT_DIR = path.join(ROOT, 'public', 'data');

const CSV_PATH = path.join(SOURCE_DIR, 'kanji_source.csv');
const META_PATH = path.join(SOURCE_DIR, 'kanji_meta.json');
const WORDS_PATH = path.join(SOURCE_DIR, 'words.json');
const CONFUSABLES_PATH = path.join(SOURCE_DIR, 'confusables.json');

const OUT_DECOMP = path.join(OUTPUT_DIR, 'kanji_decomp.json');
const OUT_META = path.join(OUTPUT_DIR, 'kanji_meta.json');
const OUT_WORDS = path.join(OUTPUT_DIR, 'words.json');
const OUT_CONFUSABLES = path.join(OUTPUT_DIR, 'confusables.json');
const MISSING_FILE = path.join(ROOT, 'missing_kanji.txt');

// ─── CSV Parser ──────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

// ─── Build Decompositions ────────────────────────

function buildDecompositions(rows: Record<string, string>[]): Record<string, DecompEntry> {
  const decomps: Record<string, DecompEntry> = {};

  for (const row of rows) {
    const kanji = row['kanji'];
    if (!kanji) continue;

    const layout = row['layout'] || 'single';
    const components: ComponentData[] = [];

    // Parse up to 3 components from CSV columns
    for (let i = 1; i <= 3; i++) {
      const char = row[`comp${i}_char`];
      if (!char) continue;

      const slot_id = row[`comp${i}_slot`] || `slot${i}`;
      const order_index = parseInt(row[`comp${i}_order`] || '0', 10);
      const bx = parseFloat(row[`comp${i}_bx`] || '0');
      const by = parseFloat(row[`comp${i}_by`] || '0');
      const bw = parseFloat(row[`comp${i}_bw`] || '1');
      const bh = parseFloat(row[`comp${i}_bh`] || '1');

      components.push({
        id: `${kanji}_c${i}`,
        char,
        slot_id,
        order_index,
        bounds: { x: bx, y: by, w: bw, h: bh },
      });
    }

    if (components.length > 0) {
      decomps[kanji] = { components, layout };
    }
  }

  return decomps;
}

// ─── Main ────────────────────────────────────────

function main(): void {
  console.log('=== Kanji Puzzle Game: Build Data ===\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Parse CSV source
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: Source file not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} kanji entries from CSV`);

  // 2. Build decompositions
  const decomps = buildDecompositions(rows);
  const decompKeys = Object.keys(decomps);
  console.log(`Built decompositions for ${decompKeys.length} kanji`);

  // 3. Load meta
  let meta: Record<string, MetaEntry> = {};
  if (fs.existsSync(META_PATH)) {
    meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8')) as Record<string, MetaEntry>;
    console.log(`Loaded meta for ${Object.keys(meta).length} kanji`);
  } else {
    console.warn('WARNING: kanji_meta.json not found, proceeding without meta');
  }

  // 4. Load words
  let words: WordEntry[] = [];
  if (fs.existsSync(WORDS_PATH)) {
    words = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf-8')) as WordEntry[];
    console.log(`Loaded ${words.length} words`);
  } else {
    console.warn('WARNING: words.json not found');
  }

  // 5. Load confusables
  let confusables: Record<string, string[]> = {};
  if (fs.existsSync(CONFUSABLES_PATH)) {
    confusables = JSON.parse(fs.readFileSync(CONFUSABLES_PATH, 'utf-8')) as Record<string, string[]>;
    console.log(`Loaded confusables for ${Object.keys(confusables).length} characters`);
  }

  // 6. Validate: find kanji in words that are missing decompositions
  const missingKanji = new Set<string>();
  const validWords: WordEntry[] = [];

  for (const word of words) {
    let allValid = true;
    for (const k of word.kanji) {
      if (!decomps[k]) {
        missingKanji.add(k);
        allValid = false;
      }
    }
    if (allValid) {
      validWords.push(word);
    }
  }

  if (missingKanji.size > 0) {
    const missingList = Array.from(missingKanji).sort();
    console.warn(`\nWARNING: ${missingList.length} kanji missing decomposition:`);
    for (const k of missingList) {
      console.warn(`  - ${k}`);
    }

    // Write missing_kanji.txt
    const report = [
      '# Missing Kanji Report',
      `# Generated: ${new Date().toISOString()}`,
      `# Total missing: ${missingList.length}`,
      '',
      'The following kanji are referenced in words.json but have no decomposition',
      'in kanji_source.csv. They have been excluded from the game.',
      '',
      'To fix: add these kanji to data/source/kanji_source.csv or use',
      'registerManualDecomp() in DataLoader.ts',
      '',
      ...missingList.map((k) => `${k}\t(meta: ${meta[k] ? meta[k].meaning : 'unknown'})`),
    ].join('\n');

    fs.writeFileSync(MISSING_FILE, report, 'utf-8');
    console.log(`\nWrote missing kanji report to: ${MISSING_FILE}`);
  }

  // 7. Filter meta to only include kanji we have
  const filteredMeta: Record<string, MetaEntry> = {};
  for (const k of decompKeys) {
    if (meta[k]) {
      filteredMeta[k] = meta[k];
    }
  }

  // 8. Write output files
  fs.writeFileSync(OUT_DECOMP, JSON.stringify(decomps, null, 2), 'utf-8');
  fs.writeFileSync(OUT_META, JSON.stringify(filteredMeta, null, 2), 'utf-8');
  fs.writeFileSync(OUT_WORDS, JSON.stringify(validWords, null, 2), 'utf-8');
  fs.writeFileSync(OUT_CONFUSABLES, JSON.stringify(confusables, null, 2), 'utf-8');

  console.log(`\n=== Output ===`);
  console.log(`  ${OUT_DECOMP} (${decompKeys.length} kanji)`);
  console.log(`  ${OUT_META} (${Object.keys(filteredMeta).length} entries)`);
  console.log(`  ${OUT_WORDS} (${validWords.length} words, ${words.length - validWords.length} excluded)`);
  console.log(`  ${OUT_CONFUSABLES}`);
  console.log(`\nBuild complete!`);
}

main();
