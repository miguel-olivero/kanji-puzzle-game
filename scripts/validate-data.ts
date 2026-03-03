/**
 * validate-data.ts — Validates that all kanji referenced in words have decompositions.
 * Reports missing kanji and data inconsistencies.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');

interface ComponentData {
  id: string;
  char: string;
  slot_id: string;
  order_index: number;
  bounds: { x: number; y: number; w: number; h: number };
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

function main(): void {
  console.log('=== Kanji Puzzle Game: Data Validation ===\n');

  let errors = 0;
  let warnings = 0;

  // Load files
  const decompPath = path.join(DATA_DIR, 'kanji_decomp.json');
  const metaPath = path.join(DATA_DIR, 'kanji_meta.json');
  const wordsPath = path.join(DATA_DIR, 'words.json');

  if (!fs.existsSync(decompPath)) {
    console.error('ERROR: kanji_decomp.json not found. Run `npm run build:data` first.');
    process.exit(1);
  }

  const decomps = JSON.parse(fs.readFileSync(decompPath, 'utf-8')) as Record<string, DecompEntry>;
  const meta = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Record<string, MetaEntry>)
    : {};
  const words = fs.existsSync(wordsPath)
    ? (JSON.parse(fs.readFileSync(wordsPath, 'utf-8')) as WordEntry[])
    : [];

  console.log(`Decompositions: ${Object.keys(decomps).length}`);
  console.log(`Meta entries: ${Object.keys(meta).length}`);
  console.log(`Words: ${words.length}\n`);

  // 1. Check each decomposition
  for (const [kanji, entry] of Object.entries(decomps)) {
    if (!entry.components || entry.components.length === 0) {
      console.error(`ERROR: ${kanji} has no components`);
      errors++;
    }

    for (const comp of entry.components) {
      if (!comp.char) {
        console.error(`ERROR: ${kanji} component ${comp.id} has no char`);
        errors++;
      }
      if (comp.bounds.w <= 0 || comp.bounds.h <= 0) {
        console.warn(`WARNING: ${kanji} component ${comp.id} has zero/negative bounds`);
        warnings++;
      }
      if (comp.bounds.x < 0 || comp.bounds.y < 0 || comp.bounds.x + comp.bounds.w > 1.01 || comp.bounds.y + comp.bounds.h > 1.01) {
        console.warn(`WARNING: ${kanji} component ${comp.id} bounds exceed 0..1 range`);
        warnings++;
      }
    }

    // Check for duplicate order_index
    const indices = entry.components.map((c) => c.order_index);
    const uniqueIndices = new Set(indices);
    if (indices.length !== uniqueIndices.size) {
      console.warn(`WARNING: ${kanji} has duplicate order_index values`);
      warnings++;
    }
  }

  // 2. Check words reference valid kanji
  const missingInWords = new Set<string>();
  for (const word of words) {
    for (const k of word.kanji) {
      if (!decomps[k]) {
        missingInWords.add(k);
        console.error(`ERROR: Word "${word.id}" references kanji ${k} with no decomposition`);
        errors++;
      }
    }
  }

  // 3. Check meta coverage
  const missingMeta: string[] = [];
  for (const k of Object.keys(decomps)) {
    if (!meta[k]) {
      missingMeta.push(k);
    }
  }
  if (missingMeta.length > 0) {
    console.warn(`WARNING: ${missingMeta.length} kanji have decomposition but no meta: ${missingMeta.join(', ')}`);
    warnings++;
  }

  // Summary
  console.log(`\n=== Validation Summary ===`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Warnings: ${warnings}`);

  if (errors > 0) {
    console.error('\nValidation FAILED. Fix errors above.');
    process.exit(1);
  } else {
    console.log('\nValidation PASSED.');
  }
}

main();
