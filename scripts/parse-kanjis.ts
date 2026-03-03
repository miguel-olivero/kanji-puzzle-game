/**
 * parse-kanjis.ts — Generates game JSON from data/kanjis_libro/*.txt
 *
 * 1. Parses kanji + word lines from the textbook files
 * 2. Matches against a hand-curated decomposition table (NEVER guesses from Unicode)
 * 3. Outputs public/data/{kanji_decomp,kanji_meta,words,confusables}.json
 * 4. Reports undecomposed kanji to missing_kanji.txt
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ═══════════════════════════════════════════════════════════
// Hand-curated kanji decomposition table
// Layout codes: ⿰ left/right  ⿱ top/bottom  ⿴ enclosure
//               ⿸ top-left wrap  ⿺ bottom-left wrap  grid
// ONLY kanji with 2+ real components belong here.
// ═══════════════════════════════════════════════════════════

interface RawDecomp {
  layout: string;
  parts: { char: string; slot: string; bx: number; by: number; bw: number; bh: number }[];
}

const DECOMP_TABLE: Record<string, RawDecomp> = {
  // ── Lección 5: compuestos iku-ji ──────────────────
  明: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '月', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  休: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '木', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  体: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '本', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  好: { layout: '⿰', parts: [
    { char: '女', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '子', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  男: { layout: '⿱', parts: [
    { char: '田', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.5 },
    { char: '力', slot: 'bottom', bx: 0, by: 0.5, bw: 1, bh: 0.5 },
  ]},
  森: { layout: 'grid', parts: [
    { char: '木', slot: 'top',        bx: 0.25, by: 0, bw: 0.5, bh: 0.5 },
    { char: '木', slot: 'bottom-left', bx: 0, by: 0.5, bw: 0.5, bh: 0.5 },
    { char: '木', slot: 'bottom-right',bx: 0.5, by: 0.5, bw: 0.5, bh: 0.5 },
  ]},
  林: { layout: '⿰', parts: [
    { char: '木', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '木', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  岩: { layout: '⿱', parts: [
    { char: '山', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.4 },
    { char: '石', slot: 'bottom', bx: 0, by: 0.4, bw: 1, bh: 0.6 },
  ]},
  間: { layout: '⿴', parts: [
    { char: '門', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '日', slot: 'inner', bx: 0.25, by: 0.3, bw: 0.5, bh: 0.45 },
  ]},
  畑: { layout: '⿰', parts: [
    { char: '火', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '田', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},

  // ── Lección 7 ─────────────────────────────────────
  花: { layout: '⿱', parts: [
    { char: '艹', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.3 },
    { char: '化', slot: 'bottom', bx: 0, by: 0.3, bw: 1, bh: 0.7 },
  ]},
  茶: { layout: '⿱', parts: [
    { char: '艹', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.25 },
    { char: '余', slot: 'bottom', bx: 0, by: 0.25, bw: 1, bh: 0.75 },
  ]},
  物: { layout: '⿰', parts: [
    { char: '牜', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '勿', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  鳥: { layout: '⿱', parts: [
    { char: '烏', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.55 },
    { char: '灬', slot: 'bottom', bx: 0, by: 0.55, bw: 1, bh: 0.45 },
  ]},
  魚: { layout: '⿱', parts: [
    { char: '⺈', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.25 },
    { char: '田', slot: 'mid',    bx: 0.15, by: 0.25, bw: 0.7, bh: 0.35 },
    { char: '灬', slot: 'bottom', bx: 0, by: 0.6, bw: 1, bh: 0.4 },
  ]},

  // ── Lección 8: adjetivos ──────────────────────────
  新: { layout: '⿰', parts: [
    { char: '立', slot: 'top-left', bx: 0, by: 0, bw: 0.45, bh: 0.5 },
    { char: '木', slot: 'bot-left', bx: 0, by: 0.5, bw: 0.45, bh: 0.5 },
    { char: '斤', slot: 'right',    bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  古: { layout: '⿱', parts: [
    { char: '十', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '口', slot: 'bottom', bx: 0.15, by: 0.45, bw: 0.7, bh: 0.55 },
  ]},
  高: { layout: '⿱', parts: [
    { char: '亠', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.3 },
    { char: '冋', slot: 'bottom', bx: 0, by: 0.3, bw: 1, bh: 0.7 },
  ]},
  安: { layout: '⿱', parts: [
    { char: '宀', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '女', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  暗: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '音', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  短: { layout: '⿰', parts: [
    { char: '矢', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '豆', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  低: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '氐', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},

  // ── Lección 9: verbos de acción ───────────────────
  行: { layout: '⿰', parts: [
    { char: '彳', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '亍', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  帰: { layout: '⿰', parts: [
    { char: '刂', slot: 'left',  bx: 0, by: 0, bw: 0.15, bh: 1 },
    { char: '帚', slot: 'right', bx: 0.15, by: 0, bw: 0.85, bh: 1 },
  ]},
  食: { layout: '⿱', parts: [
    { char: '人', slot: 'top',    bx: 0.15, by: 0, bw: 0.7, bh: 0.35 },
    { char: '良', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  飲: { layout: '⿰', parts: [
    { char: '飠', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '欠', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  見: { layout: '⿱', parts: [
    { char: '目', slot: 'top',    bx: 0.1, by: 0, bw: 0.8, bh: 0.6 },
    { char: '儿', slot: 'bottom', bx: 0.15, by: 0.6, bw: 0.7, bh: 0.4 },
  ]},
  聞: { layout: '⿴', parts: [
    { char: '門', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '耳', slot: 'inner', bx: 0.25, by: 0.25, bw: 0.5, bh: 0.5 },
  ]},
  読: { layout: '⿰', parts: [
    { char: '言', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '売', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  話: { layout: '⿰', parts: [
    { char: '言', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '舌', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  買: { layout: '⿱', parts: [
    { char: '罒', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.4 },
    { char: '貝', slot: 'bottom', bx: 0.1, by: 0.4, bw: 0.8, bh: 0.6 },
  ]},
  教: { layout: '⿰', parts: [
    { char: '孝', slot: 'left',  bx: 0, by: 0, bw: 0.55, bh: 1 },
    { char: '攵', slot: 'right', bx: 0.55, by: 0, bw: 0.45, bh: 1 },
  ]},

  // ── Lección 10: tiempo ────────────────────────────
  朝: { layout: '⿰', parts: [
    { char: '龺', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '月', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  晩: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '免', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  曜: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '翟', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},

  // ── Lección 11 ────────────────────────────────────
  作: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '乍', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  泳: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '永', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  油: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '由', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  海: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '毎', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  酒: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '酉', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  待: { layout: '⿰', parts: [
    { char: '彳', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '寺', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  校: { layout: '⿰', parts: [
    { char: '木', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '交', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  時: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '寺', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  計: { layout: '⿰', parts: [
    { char: '言', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '十', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  語: { layout: '⿰', parts: [
    { char: '言', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '吾', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},

  // ── Lección 12 ────────────────────────────────────
  宅: { layout: '⿱', parts: [
    { char: '宀', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '乇', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  客: { layout: '⿱', parts: [
    { char: '宀', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '各', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  室: { layout: '⿱', parts: [
    { char: '宀', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '至', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  家: { layout: '⿱', parts: [
    { char: '宀', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.3 },
    { char: '豕', slot: 'bottom', bx: 0, by: 0.3, bw: 1, bh: 0.7 },
  ]},
  英: { layout: '⿱', parts: [
    { char: '艹', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.25 },
    { char: '央', slot: 'bottom', bx: 0, by: 0.25, bw: 1, bh: 0.75 },
  ]},
  薬: { layout: '⿱', parts: [
    { char: '艹', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.2 },
    { char: '楽', slot: 'bottom', bx: 0, by: 0.2, bw: 1, bh: 0.8 },
  ]},
  会: { layout: '⿱', parts: [
    { char: '人', slot: 'top',    bx: 0.2, by: 0, bw: 0.6, bh: 0.35 },
    { char: '云', slot: 'bottom', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  雪: { layout: '⿱', parts: [
    { char: '雨', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.55 },
    { char: 'ヨ', slot: 'bottom', bx: 0.2, by: 0.55, bw: 0.6, bh: 0.45 },
  ]},
  雲: { layout: '⿱', parts: [
    { char: '雨', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.5 },
    { char: '云', slot: 'bottom', bx: 0, by: 0.5, bw: 1, bh: 0.5 },
  ]},
  電: { layout: '⿱', parts: [
    { char: '雨', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '電', slot: 'bottom', bx: 0, by: 0.45, bw: 1, bh: 0.55 },
  ]},
  売: { layout: '⿱', parts: [
    { char: '士', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.4 },
    { char: '儿', slot: 'bottom', bx: 0.15, by: 0.4, bw: 0.7, bh: 0.6 },
  ]},

  // ── Lección 13 ────────────────────────────────────
  広: { layout: '⿸', parts: [
    { char: '广', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: 'ム', slot: 'inner', bx: 0.3, by: 0.4, bw: 0.5, bh: 0.5 },
  ]},
  店: { layout: '⿸', parts: [
    { char: '广', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '占', slot: 'inner', bx: 0.25, by: 0.4, bw: 0.6, bh: 0.55 },
  ]},
  度: { layout: '⿸', parts: [
    { char: '广', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '廿', slot: 'inner', bx: 0.2, by: 0.35, bw: 0.65, bh: 0.6 },
  ]},
  病: { layout: '⿸', parts: [
    { char: '疒', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '丙', slot: 'inner', bx: 0.25, by: 0.35, bw: 0.65, bh: 0.6 },
  ]},
  痛: { layout: '⿸', parts: [
    { char: '疒', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '甬', slot: 'inner', bx: 0.25, by: 0.35, bw: 0.65, bh: 0.6 },
  ]},
  国: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '玉', slot: 'inner', bx: 0.2, by: 0.2, bw: 0.6, bh: 0.6 },
  ]},
  回: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '口', slot: 'inner', bx: 0.25, by: 0.25, bw: 0.5, bh: 0.5 },
  ]},
  困: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '木', slot: 'inner', bx: 0.2, by: 0.2, bw: 0.6, bh: 0.6 },
  ]},
  開: { layout: '⿴', parts: [
    { char: '門', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '开', slot: 'inner', bx: 0.25, by: 0.3, bw: 0.5, bh: 0.45 },
  ]},
  閉: { layout: '⿴', parts: [
    { char: '門', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '才', slot: 'inner', bx: 0.25, by: 0.3, bw: 0.5, bh: 0.45 },
  ]},

  // ── Lección 14: movimiento / naturaleza ───────────
  近: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '斤', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  遠: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '袁', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  速: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '束', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  遅: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '犀', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  道: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '首', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  通: { layout: '⿺', parts: [
    { char: '辶', slot: 'outer', bx: 0, by: 0.35, bw: 1, bh: 0.65 },
    { char: '甬', slot: 'inner', bx: 0.2, by: 0, bw: 0.7, bh: 0.7 },
  ]},
  晴: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '青', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  静: { layout: '⿰', parts: [
    { char: '青', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '争', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  持: { layout: '⿰', parts: [
    { char: '扌', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '寺', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  歌: { layout: '⿰', parts: [
    { char: '可', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '欠', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},

  // ── Lección 16 ────────────────────────────────────
  気: { layout: '⿱', parts: [
    { char: '气', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 0.6 },
    { char: '〆', slot: 'inner', bx: 0.2, by: 0.4, bw: 0.6, bh: 0.6 },
  ]},
  有: { layout: '⿱', parts: [
    { char: '十', slot: 'top',   bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '月', slot: 'bottom',bx: 0, by: 0.35, bw: 1, bh: 0.65 },
  ]},
  名: { layout: '⿱', parts: [
    { char: '夕', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '口', slot: 'bottom', bx: 0.15, by: 0.45, bw: 0.7, bh: 0.55 },
  ]},
  親: { layout: '⿰', parts: [
    { char: '辛', slot: 'left-top', bx: 0, by: 0, bw: 0.5, bh: 0.5 },
    { char: '木', slot: 'left-bot', bx: 0, by: 0.5, bw: 0.5, bh: 0.5 },
    { char: '見', slot: 'right',    bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  切: { layout: '⿰', parts: [
    { char: '七', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '刀', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  便: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '更', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  利: { layout: '⿰', parts: [
    { char: '禾', slot: 'left',  bx: 0, by: 0, bw: 0.55, bh: 1 },
    { char: '刂', slot: 'right', bx: 0.55, by: 0, bw: 0.45, bh: 1 },
  ]},

  // ── Lección 17: verbos de movimiento ──────────────
  乗: { layout: '⿱', parts: [
    { char: '禾', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.55 },
    { char: '木', slot: 'bottom', bx: 0.1, by: 0.55, bw: 0.8, bh: 0.45 },
  ]},
  降: { layout: '⿰', parts: [
    { char: '阝', slot: 'left',  bx: 0, by: 0, bw: 0.2, bh: 1 },
    { char: '夅', slot: 'right', bx: 0.2, by: 0, bw: 0.8, bh: 1 },
  ]},
  着: { layout: '⿱', parts: [
    { char: '羊', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '目', slot: 'bottom', bx: 0.1, by: 0.45, bw: 0.8, bh: 0.55 },
  ]},
  渡: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '度', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  走: { layout: '⿱', parts: [
    { char: '土', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '𧺆', slot: 'bottom', bx: 0, by: 0.45, bw: 1, bh: 0.55 },
  ]},
  歩: { layout: '⿱', parts: [
    { char: '止', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '少', slot: 'bottom', bx: 0, by: 0.45, bw: 1, bh: 0.55 },
  ]},
  動: { layout: '⿰', parts: [
    { char: '重', slot: 'left',  bx: 0, by: 0, bw: 0.55, bh: 1 },
    { char: '力', slot: 'right', bx: 0.55, by: 0, bw: 0.45, bh: 1 },
  ]},
  働: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.25, bh: 1 },
    { char: '動', slot: 'right', bx: 0.25, by: 0, bw: 0.75, bh: 1 },
  ]},

  // ── Lección 18: direcciones ───────────────────────
  東: { layout: '⿱', parts: [
    { char: '木', slot: 'frame', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '日', slot: 'inner', bx: 0.2, by: 0.2, bw: 0.6, bh: 0.45 },
  ]},
  駅: { layout: '⿰', parts: [
    { char: '馬', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '尺', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  社: { layout: '⿰', parts: [
    { char: '礻', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '土', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  院: { layout: '⿰', parts: [
    { char: '阝', slot: 'left',  bx: 0, by: 0, bw: 0.2, bh: 1 },
    { char: '完', slot: 'right', bx: 0.2, by: 0, bw: 0.8, bh: 1 },
  ]},

  // ── Lección 19 ────────────────────────────────────
  地: { layout: '⿰', parts: [
    { char: '土', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '也', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  鉄: { layout: '⿰', parts: [
    { char: '金', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '失', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  場: { layout: '⿰', parts: [
    { char: '土', slot: 'left',  bx: 0, by: 0, bw: 0.35, bh: 1 },
    { char: '昜', slot: 'right', bx: 0.35, by: 0, bw: 0.65, bh: 1 },
  ]},
  図: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '㐅', slot: 'inner', bx: 0.2, by: 0.2, bw: 0.6, bh: 0.6 },
  ]},
  館: { layout: '⿰', parts: [
    { char: '飠', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '官', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  園: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '袁', slot: 'inner', bx: 0.15, by: 0.15, bw: 0.7, bh: 0.7 },
  ]},
  住: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '主', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  号: { layout: '⿱', parts: [
    { char: '口', slot: 'top',    bx: 0.15, by: 0, bw: 0.7, bh: 0.5 },
    { char: '丂', slot: 'bottom', bx: 0, by: 0.5, bw: 1, bh: 0.5 },
  ]},

  // ── Lección 21 ────────────────────────────────────
  練: { layout: '⿰', parts: [
    { char: '糸', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '柬', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  習: { layout: '⿱', parts: [
    { char: '羽', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '白', slot: 'bottom', bx: 0.15, by: 0.45, bw: 0.7, bh: 0.55 },
  ]},
  勉: { layout: '⿺', parts: [
    { char: '免', slot: 'left',  bx: 0, by: 0, bw: 0.65, bh: 1 },
    { char: '力', slot: 'right', bx: 0.65, by: 0.3, bw: 0.35, bh: 0.7 },
  ]},
  強: { layout: '⿰', parts: [
    { char: '弓', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '虽', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  研: { layout: '⿰', parts: [
    { char: '石', slot: 'left',  bx: 0, by: 0, bw: 0.45, bh: 1 },
    { char: '开', slot: 'right', bx: 0.45, by: 0, bw: 0.55, bh: 1 },
  ]},
  究: { layout: '⿱', parts: [
    { char: '穴', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.5 },
    { char: '九', slot: 'bottom', bx: 0.15, by: 0.5, bw: 0.7, bh: 0.5 },
  ]},
  質: { layout: '⿱', parts: [
    { char: '斦', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.5 },
    { char: '貝', slot: 'bottom', bx: 0.1, by: 0.5, bw: 0.8, bh: 0.5 },
  ]},
  問: { layout: '⿴', parts: [
    { char: '門', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '口', slot: 'inner', bx: 0.3, by: 0.3, bw: 0.4, bh: 0.4 },
  ]},
  題: { layout: '⿰', parts: [
    { char: '是', slot: 'left',  bx: 0, by: 0, bw: 0.55, bh: 1 },
    { char: '頁', slot: 'right', bx: 0.55, by: 0, bw: 0.45, bh: 1 },
  ]},
  答: { layout: '⿱', parts: [
    { char: '竹', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.4 },
    { char: '合', slot: 'bottom', bx: 0, by: 0.4, bw: 1, bh: 0.6 },
  ]},

  // ── Lección 22 ────────────────────────────────────
  政: { layout: '⿰', parts: [
    { char: '正', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '攵', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  治: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '台', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  経: { layout: '⿰', parts: [
    { char: '糸', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '圣', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  済: { layout: '⿰', parts: [
    { char: '氵', slot: 'left',  bx: 0, by: 0, bw: 0.3, bh: 1 },
    { char: '斉', slot: 'right', bx: 0.3, by: 0, bw: 0.7, bh: 1 },
  ]},
  歴: { layout: '⿸', parts: [
    { char: '厂', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '秝', slot: 'inner', bx: 0.15, by: 0.25, bw: 0.75, bh: 0.7 },
  ]},
  育: { layout: '⿱', parts: [
    { char: '亠', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.35 },
    { char: '月', slot: 'bottom', bx: 0.1, by: 0.35, bw: 0.8, bh: 0.65 },
  ]},
  化: { layout: '⿰', parts: [
    { char: '亻', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '匕', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  理: { layout: '⿰', parts: [
    { char: '王', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '里', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  科: { layout: '⿰', parts: [
    { char: '禾', slot: 'left',  bx: 0, by: 0, bw: 0.5, bh: 1 },
    { char: '斗', slot: 'right', bx: 0.5, by: 0, bw: 0.5, bh: 1 },
  ]},
  数: { layout: '⿰', parts: [
    { char: '婁', slot: 'left',  bx: 0, by: 0, bw: 0.55, bh: 1 },
    { char: '攵', slot: 'right', bx: 0.55, by: 0, bw: 0.45, bh: 1 },
  ]},
  医: { layout: '⿸', parts: [
    { char: '匚', slot: 'outer', bx: 0, by: 0, bw: 1, bh: 1 },
    { char: '矢', slot: 'inner', bx: 0.15, by: 0.15, bw: 0.7, bh: 0.75 },
  ]},

  // ── Extra: Libro 2 (252-500) ──────────────────────
  映: { layout: '⿰', parts: [
    { char: '日', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '央', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  画: { layout: '⿴', parts: [
    { char: '囗', slot: 'outer', bx: 0, by: 0.15, bw: 1, bh: 0.85 },
    { char: '田', slot: 'inner', bx: 0.2, by: 0.3, bw: 0.6, bh: 0.5 },
  ]},
  写: { layout: '⿱', parts: [
    { char: '冖', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.3 },
    { char: '与', slot: 'bottom', bx: 0, by: 0.3, bw: 1, bh: 0.7 },
  ]},
  音: { layout: '⿱', parts: [
    { char: '立', slot: 'top',    bx: 0, by: 0, bw: 1, bh: 0.45 },
    { char: '日', slot: 'bottom', bx: 0.1, by: 0.45, bw: 0.8, bh: 0.55 },
  ]},
  楽: { layout: '⿱', parts: [
    { char: '白', slot: 'top',    bx: 0.2, by: 0, bw: 0.6, bh: 0.45 },
    { char: '木', slot: 'bottom', bx: 0, by: 0.45, bw: 1, bh: 0.55 },
  ]},
  組: { layout: '⿰', parts: [
    { char: '糸', slot: 'left',  bx: 0, by: 0, bw: 0.4, bh: 1 },
    { char: '且', slot: 'right', bx: 0.4, by: 0, bw: 0.6, bh: 1 },
  ]},
  思: { layout: '⿱', parts: [
    { char: '田', slot: 'top',    bx: 0.1, by: 0, bw: 0.8, bh: 0.55 },
    { char: '心', slot: 'bottom', bx: 0, by: 0.55, bw: 1, bh: 0.45 },
  ]},
};

// ═══════════════════════════════════════════════════════════
// Word dictionary: real readings & meanings for common words
// ═══════════════════════════════════════════════════════════

interface WordDef {
  kanji: string[];
  reading: string;
  meaning: string;
  /** Per-kanji kana segments, same order as kanji[]. */
  readingParts: string[];
}

const WORD_DICTIONARY: Record<string, WordDef> = {
  '日本':   { kanji: ['日','本'], reading: 'にほん', meaning: 'Japón', readingParts: ['に','ほん'] },
  '火山':   { kanji: ['火','山'], reading: 'かざん', meaning: 'volcán', readingParts: ['か','ざん'] },
  '入口':   { kanji: ['入','口'], reading: 'いりぐち', meaning: 'entrada', readingParts: ['いり','ぐち'] },
  '出口':   { kanji: ['出','口'], reading: 'でぐち', meaning: 'salida', readingParts: ['で','ぐち'] },
  '人口':   { kanji: ['人','口'], reading: 'じんこう', meaning: 'población', readingParts: ['じん','こう'] },
  '電車':   { kanji: ['電','車'], reading: 'でんしゃ', meaning: 'tren eléctrico', readingParts: ['でん','しゃ'] },
  '専門':   { kanji: ['専','門'], reading: 'せんもん', meaning: 'especialidad', readingParts: ['せん','もん'] },
  '水田':   { kanji: ['水','田'], reading: 'すいでん', meaning: 'arrozal', readingParts: ['すい','でん'] },
  '土木':   { kanji: ['土','木'], reading: 'どぼく', meaning: 'ingeniería civil', readingParts: ['ど','ぼく'] },
  '学校':   { kanji: ['学','校'], reading: 'がっこう', meaning: 'escuela', readingParts: ['がっ','こう'] },
  '大学':   { kanji: ['大','学'], reading: 'だいがく', meaning: 'universidad', readingParts: ['だい','がく'] },
  '先生':   { kanji: ['先','生'], reading: 'せんせい', meaning: 'profesor', readingParts: ['せん','せい'] },
  '千人':   { kanji: ['千','人'], reading: 'せんにん', meaning: 'mil personas', readingParts: ['せん','にん'] },
  '万国':   { kanji: ['万','国'], reading: 'ばんこく', meaning: 'todos los países', readingParts: ['ばん','こく'] },
  '来年':   { kanji: ['来','年'], reading: 'らいねん', meaning: 'el año que viene', readingParts: ['らい','ねん'] },
  '今年':   { kanji: ['今','年'], reading: 'ことし', meaning: 'este año', readingParts: ['こ','とし'] },
  '中心':   { kanji: ['中','心'], reading: 'ちゅうしん', meaning: 'centro', readingParts: ['ちゅう','しん'] },
  '本日':   { kanji: ['本','日'], reading: 'ほんじつ', meaning: 'hoy', readingParts: ['ほん','じつ'] },
  '半分':   { kanji: ['半','分'], reading: 'はんぶん', meaning: 'mitad', readingParts: ['はん','ぶん'] },
  '休日':   { kanji: ['休','日'], reading: 'きゅうじつ', meaning: 'día libre', readingParts: ['きゅう','じつ'] },
  '体力':   { kanji: ['体','力'], reading: 'たいりょく', meaning: 'fuerza física', readingParts: ['たい','りょく'] },
  '体育':   { kanji: ['体','育'], reading: 'たいいく', meaning: 'educación física', readingParts: ['たい','いく'] },
  '時間':   { kanji: ['時','間'], reading: 'じかん', meaning: 'tiempo', readingParts: ['じ','かん'] },
  '米国':   { kanji: ['米','国'], reading: 'べいこく', meaning: 'Estados Unidos', readingParts: ['べい','こく'] },
  '石油':   { kanji: ['石','油'], reading: 'せきゆ', meaning: 'petróleo', readingParts: ['せき','ゆ'] },
  '化石':   { kanji: ['化','石'], reading: 'かせき', meaning: 'fósil', readingParts: ['か','せき'] },
  '文学':   { kanji: ['文','学'], reading: 'ぶんがく', meaning: 'literatura', readingParts: ['ぶん','がく'] },
  '文字':   { kanji: ['文','字'], reading: 'もじ', meaning: 'carácter', readingParts: ['も','じ'] },
  '生物':   { kanji: ['生','物'], reading: 'せいぶつ', meaning: 'ser vivo', readingParts: ['せい','ぶつ'] },
  '白鳥':   { kanji: ['白','鳥'], reading: 'はくちょう', meaning: 'cisne', readingParts: ['はく','ちょう'] },
  '金魚':   { kanji: ['金','魚'], reading: 'きんぎょ', meaning: 'pez dorado', readingParts: ['きん','ぎょ'] },
  '新車':   { kanji: ['新','車'], reading: 'しんしゃ', meaning: 'coche nuevo', readingParts: ['しん','しゃ'] },
  '新聞':   { kanji: ['新','聞'], reading: 'しんぶん', meaning: 'periódico', readingParts: ['しん','ぶん'] },
  '新年':   { kanji: ['新','年'], reading: 'しんねん', meaning: 'año nuevo', readingParts: ['しん','ねん'] },
  '長男':   { kanji: ['長','男'], reading: 'ちょうなん', meaning: 'hijo mayor', readingParts: ['ちょう','なん'] },
  '高校':   { kanji: ['高','校'], reading: 'こうこう', meaning: 'instituto', readingParts: ['こう','こう'] },
  '安心':   { kanji: ['安','心'], reading: 'あんしん', meaning: 'tranquilidad', readingParts: ['あん','しん'] },
  '安全':   { kanji: ['安','全'], reading: 'あんぜん', meaning: 'seguridad', readingParts: ['あん','ぜん'] },
  '少年':   { kanji: ['少','年'], reading: 'しょうねん', meaning: 'muchacho', readingParts: ['しょう','ねん'] },
  '少女':   { kanji: ['少','女'], reading: 'しょうじょ', meaning: 'muchacha', readingParts: ['しょう','じょ'] },
  '食事':   { kanji: ['食','事'], reading: 'しょくじ', meaning: 'comida', readingParts: ['しょく','じ'] },
  '夕食':   { kanji: ['夕','食'], reading: 'ゆうしょく', meaning: 'cena', readingParts: ['ゆう','しょく'] },
  '朝食':   { kanji: ['朝','食'], reading: 'ちょうしょく', meaning: 'desayuno', readingParts: ['ちょう','しょく'] },
  '読書':   { kanji: ['読','書'], reading: 'どくしょ', meaning: 'lectura', readingParts: ['どく','しょ'] },
  '会話':   { kanji: ['会','話'], reading: 'かいわ', meaning: 'conversación', readingParts: ['かい','わ'] },
  '電話':   { kanji: ['電','話'], reading: 'でんわ', meaning: 'teléfono', readingParts: ['でん','わ'] },
  '教室':   { kanji: ['教','室'], reading: 'きょうしつ', meaning: 'aula', readingParts: ['きょう','しつ'] },
  '教育':   { kanji: ['教','育'], reading: 'きょういく', meaning: 'educación', readingParts: ['きょう','いく'] },
  '朝日':   { kanji: ['朝','日'], reading: 'あさひ', meaning: 'sol de la mañana', readingParts: ['あさ','ひ'] },
  '今夜':   { kanji: ['今','夜'], reading: 'こんや', meaning: 'esta noche', readingParts: ['こん','や'] },
  '毎日':   { kanji: ['毎','日'], reading: 'まいにち', meaning: 'cada día', readingParts: ['まい','にち'] },
  '午前':   { kanji: ['午','前'], reading: 'ごぜん', meaning: 'mañana (AM)', readingParts: ['ご','ぜん'] },
  '午後':   { kanji: ['午','後'], reading: 'ごご', meaning: 'tarde (PM)', readingParts: ['ご','ご'] },
  '作品':   { kanji: ['作','品'], reading: 'さくひん', meaning: 'obra', readingParts: ['さく','ひん'] },
  '作文':   { kanji: ['作','文'], reading: 'さくぶん', meaning: 'redacción', readingParts: ['さく','ぶん'] },
  '水泳':   { kanji: ['水','泳'], reading: 'すいえい', meaning: 'natación', readingParts: ['すい','えい'] },
  '海外':   { kanji: ['海','外'], reading: 'かいがい', meaning: 'extranjero', readingParts: ['かい','がい'] },
  '海水':   { kanji: ['海','水'], reading: 'かいすい', meaning: 'agua de mar', readingParts: ['かい','すい'] },
  '時計':   { kanji: ['時','計'], reading: 'とけい', meaning: 'reloj', readingParts: ['と','けい'] },
  '言語':   { kanji: ['言','語'], reading: 'げんご', meaning: 'idioma', readingParts: ['げん','ご'] },
  '日本語': { kanji: ['日','本','語'], reading: 'にほんご', meaning: 'japonés', readingParts: ['に','ほん','ご'] },
  '自宅':   { kanji: ['自','宅'], reading: 'じたく', meaning: 'domicilio', readingParts: ['じ','たく'] },
  '家族':   { kanji: ['家','族'], reading: 'かぞく', meaning: 'familia', readingParts: ['か','ぞく'] },
  '英国':   { kanji: ['英','国'], reading: 'えいこく', meaning: 'Reino Unido', readingParts: ['えい','こく'] },
  '会社':   { kanji: ['会','社'], reading: 'かいしゃ', meaning: 'empresa', readingParts: ['かい','しゃ'] },
  '雪国':   { kanji: ['雪','国'], reading: 'ゆきぐに', meaning: 'país de nieve', readingParts: ['ゆき','ぐに'] },
  '電気':   { kanji: ['電','気'], reading: 'でんき', meaning: 'electricidad', readingParts: ['でん','き'] },
  '病気':   { kanji: ['病','気'], reading: 'びょうき', meaning: 'enfermedad', readingParts: ['びょう','き'] },
  '病院':   { kanji: ['病','院'], reading: 'びょういん', meaning: 'hospital', readingParts: ['びょう','いん'] },
  '近所':   { kanji: ['近','所'], reading: 'きんじょ', meaning: 'vecindario', readingParts: ['きん','じょ'] },
  '歩道':   { kanji: ['歩','道'], reading: 'ほどう', meaning: 'acera', readingParts: ['ほ','どう'] },
  '水道':   { kanji: ['水','道'], reading: 'すいどう', meaning: 'cañería', readingParts: ['すい','どう'] },
  '青年':   { kanji: ['青','年'], reading: 'せいねん', meaning: 'joven', readingParts: ['せい','ねん'] },
  '晴天':   { kanji: ['晴','天'], reading: 'せいてん', meaning: 'cielo despejado', readingParts: ['せい','てん'] },
  '国歌':   { kanji: ['国','歌'], reading: 'こっか', meaning: 'himno nacional', readingParts: ['こっ','か'] },
  '友人':   { kanji: ['友','人'], reading: 'ゆうじん', meaning: 'amigo', readingParts: ['ゆう','じん'] },
  '父母':   { kanji: ['父','母'], reading: 'ふぼ', meaning: 'padres', readingParts: ['ふ','ぼ'] },
  '兄弟':   { kanji: ['兄','弟'], reading: 'きょうだい', meaning: 'hermanos', readingParts: ['きょう','だい'] },
  '元気':   { kanji: ['元','気'], reading: 'げんき', meaning: 'energía / salud', readingParts: ['げん','き'] },
  '天気':   { kanji: ['天','気'], reading: 'てんき', meaning: 'clima', readingParts: ['てん','き'] },
  '有名':   { kanji: ['有','名'], reading: 'ゆうめい', meaning: 'famoso', readingParts: ['ゆう','めい'] },
  '親切':   { kanji: ['親','切'], reading: 'しんせつ', meaning: 'amable', readingParts: ['しん','せつ'] },
  '便利':   { kanji: ['便','利'], reading: 'べんり', meaning: 'conveniente', readingParts: ['べん','り'] },
  '外出':   { kanji: ['外','出'], reading: 'がいしゅつ', meaning: 'salir', readingParts: ['がい','しゅつ'] },
  '入学':   { kanji: ['入','学'], reading: 'にゅうがく', meaning: 'ingreso escolar', readingParts: ['にゅう','がく'] },
  '交通':   { kanji: ['交','通'], reading: 'こうつう', meaning: 'tráfico', readingParts: ['こう','つう'] },
  '動物':   { kanji: ['動','物'], reading: 'どうぶつ', meaning: 'animal', readingParts: ['どう','ぶつ'] },
  '自動車': { kanji: ['自','動','車'], reading: 'じどうしゃ', meaning: 'automóvil', readingParts: ['じ','どう','しゃ'] },
  '東京':   { kanji: ['東','京'], reading: 'とうきょう', meaning: 'Tokio', readingParts: ['とう','きょう'] },
  '外国':   { kanji: ['外','国'], reading: 'がいこく', meaning: 'extranjero', readingParts: ['がい','こく'] },
  '部屋':   { kanji: ['部','屋'], reading: 'へや', meaning: 'habitación', readingParts: ['へ','や'] },
  '地下鉄': { kanji: ['地','下','鉄'], reading: 'ちかてつ', meaning: 'metro', readingParts: ['ち','か','てつ'] },
  '図書館': { kanji: ['図','書','館'], reading: 'としょかん', meaning: 'biblioteca', readingParts: ['と','しょ','かん'] },
  '公園':   { kanji: ['公','園'], reading: 'こうえん', meaning: 'parque', readingParts: ['こう','えん'] },
  '番号':   { kanji: ['番','号'], reading: 'ばんごう', meaning: 'número', readingParts: ['ばん','ごう'] },
  '練習':   { kanji: ['練','習'], reading: 'れんしゅう', meaning: 'práctica', readingParts: ['れん','しゅう'] },
  '勉強':   { kanji: ['勉','強'], reading: 'べんきょう', meaning: 'estudio', readingParts: ['べん','きょう'] },
  '研究':   { kanji: ['研','究'], reading: 'けんきゅう', meaning: 'investigación', readingParts: ['けん','きゅう'] },
  '質問':   { kanji: ['質','問'], reading: 'しつもん', meaning: 'pregunta', readingParts: ['しつ','もん'] },
  '問題':   { kanji: ['問','題'], reading: 'もんだい', meaning: 'problema', readingParts: ['もん','だい'] },
  '宿題':   { kanji: ['宿','題'], reading: 'しゅくだい', meaning: 'deberes', readingParts: ['しゅく','だい'] },
  '政治':   { kanji: ['政','治'], reading: 'せいじ', meaning: 'política', readingParts: ['せい','じ'] },
  '経済':   { kanji: ['経','済'], reading: 'けいざい', meaning: 'economía', readingParts: ['けい','ざい'] },
  '歴史':   { kanji: ['歴','史'], reading: 'れきし', meaning: 'historia', readingParts: ['れき','し'] },
  '文化':   { kanji: ['文','化'], reading: 'ぶんか', meaning: 'cultura', readingParts: ['ぶん','か'] },
  '科学':   { kanji: ['科','学'], reading: 'かがく', meaning: 'ciencia', readingParts: ['か','がく'] },
  '化学':   { kanji: ['化','学'], reading: 'かがく', meaning: 'química', readingParts: ['か','がく'] },
  '数学':   { kanji: ['数','学'], reading: 'すうがく', meaning: 'matemáticas', readingParts: ['すう','がく'] },
  '医学':   { kanji: ['医','学'], reading: 'いがく', meaning: 'medicina', readingParts: ['い','がく'] },
  '物理':   { kanji: ['物','理'], reading: 'ぶつり', meaning: 'física', readingParts: ['ぶつ','り'] },
  '地理':   { kanji: ['地','理'], reading: 'ちり', meaning: 'geografía', readingParts: ['ち','り'] },
  '映画':   { kanji: ['映','画'], reading: 'えいが', meaning: 'película', readingParts: ['えい','が'] },
  '写真':   { kanji: ['写','真'], reading: 'しゃしん', meaning: 'fotografía', readingParts: ['しゃ','しん'] },
  '料理':   { kanji: ['料','理'], reading: 'りょうり', meaning: 'cocina', readingParts: ['りょう','り'] },
  '番組':   { kanji: ['番','組'], reading: 'ばんぐみ', meaning: 'programa (TV)', readingParts: ['ばん','ぐみ'] },
  '社会':   { kanji: ['社','会'], reading: 'しゃかい', meaning: 'sociedad', readingParts: ['しゃ','かい'] },
  '主人':   { kanji: ['主','人'], reading: 'しゅじん', meaning: 'esposo / dueño', readingParts: ['しゅ','じん'] },
  '島国':   { kanji: ['島','国'], reading: 'しまぐに', meaning: 'país insular', readingParts: ['しま','ぐに'] },
};

// ═══════════════════════════════════════════════════════════
// Confusables table: visually similar radicals / components
// ═══════════════════════════════════════════════════════════

const CONFUSABLES: Record<string, string[]> = {
  '亻': ['彳', '人', '入'],
  '氵': ['シ', '冫', '水'],
  '扌': ['才', '手', '寸'],
  '言': ['計', '記', '訓'],
  '日': ['目', '白', '田', '月'],
  '月': ['日', '円', '用'],
  '目': ['日', '田', '自'],
  '口': ['日', '田', '囗'],
  '木': ['本', '未', '末', '禾'],
  '田': ['口', '日', '由', '甲'],
  '門': ['間', '開', '関'],
  '囗': ['口', '回', '国'],
  '土': ['士', '王', '工'],
  '力': ['刀', '方', '万'],
  '女': ['安', '好', '母'],
  '金': ['全', '合', '令'],
  '石': ['右', '左', '岩'],
  '火': ['水', '木', '灬'],
  '雨': ['雪', '雲', '電'],
  '宀': ['冖', '穴', '广'],
  '广': ['厂', '宀', '疒'],
  '疒': ['广', '厂', '病'],
  '糸': ['系', '紙', '線'],
  '心': ['必', '思', '忘'],
  '辶': ['込', '近', '道'],
  '艹': ['花', '草', '英'],
  '竹': ['答', '笑', '筆'],
  '貝': ['頁', '見', '目'],
  '攵': ['文', '交', '放'],
  '刂': ['刀', '力', '切'],
  '阝': ['院', '降', '隣'],
  '飠': ['食', '飲', '館'],
  '馬': ['駅', '鳥', '烏'],
  '欠': ['次', '飲', '歌'],
  '寺': ['時', '待', '持'],
  '青': ['晴', '静', '清'],
  '見': ['目', '貝', '買'],
};

// ═══════════════════════════════════════════════════════════
// Kanji metadata: reading + meaning for each known kanji
// ═══════════════════════════════════════════════════════════

const KANJI_META: Record<string, { reading: string; meaning: string }> = {
  日: { reading: 'ひ / にち', meaning: 'sol, día' },
  月: { reading: 'つき / げつ', meaning: 'luna, mes' },
  木: { reading: 'き / もく', meaning: 'árbol' },
  山: { reading: 'やま / さん', meaning: 'montaña' },
  川: { reading: 'かわ / せん', meaning: 'río' },
  田: { reading: 'た / でん', meaning: 'campo de arroz' },
  人: { reading: 'ひと / じん', meaning: 'persona' },
  口: { reading: 'くち / こう', meaning: 'boca' },
  車: { reading: 'くるま / しゃ', meaning: 'coche' },
  門: { reading: 'もん / かど', meaning: 'puerta' },
  火: { reading: 'ひ / か', meaning: 'fuego' },
  水: { reading: 'みず / すい', meaning: 'agua' },
  金: { reading: 'かね / きん', meaning: 'dinero, oro' },
  土: { reading: 'つち / ど', meaning: 'tierra' },
  子: { reading: 'こ / し', meaning: 'niño' },
  女: { reading: 'おんな / じょ', meaning: 'mujer' },
  学: { reading: 'まなぶ / がく', meaning: 'estudiar' },
  生: { reading: 'いきる / せい', meaning: 'vida, nacer' },
  先: { reading: 'さき / せん', meaning: 'antes, primero' },
  私: { reading: 'わたし / し', meaning: 'yo, privado' },
  上: { reading: 'うえ / じょう', meaning: 'arriba' },
  下: { reading: 'した / か', meaning: 'abajo' },
  中: { reading: 'なか / ちゅう', meaning: 'dentro, medio' },
  大: { reading: 'おおきい / だい', meaning: 'grande' },
  小: { reading: 'ちいさい / しょう', meaning: 'pequeño' },
  本: { reading: 'もと / ほん', meaning: 'libro, origen' },
  半: { reading: 'なかば / はん', meaning: 'mitad' },
  分: { reading: 'わける / ぶん', meaning: 'dividir, parte' },
  力: { reading: 'ちから / りょく', meaning: 'fuerza' },
  明: { reading: 'あかるい / めい', meaning: 'brillante' },
  休: { reading: 'やすむ / きゅう', meaning: 'descansar' },
  体: { reading: 'からだ / たい', meaning: 'cuerpo' },
  好: { reading: 'すき / こう', meaning: 'gustar' },
  男: { reading: 'おとこ / だん', meaning: 'hombre' },
  森: { reading: 'もり / しん', meaning: 'bosque' },
  林: { reading: 'はやし / りん', meaning: 'arboleda' },
  岩: { reading: 'いわ / がん', meaning: 'roca' },
  間: { reading: 'あいだ / かん', meaning: 'intervalo' },
  花: { reading: 'はな / か', meaning: 'flor' },
  茶: { reading: 'ちゃ / さ', meaning: 'té' },
  物: { reading: 'もの / ぶつ', meaning: 'cosa' },
  新: { reading: 'あたらしい / しん', meaning: 'nuevo' },
  古: { reading: 'ふるい / こ', meaning: 'viejo' },
  高: { reading: 'たかい / こう', meaning: 'alto, caro' },
  安: { reading: 'やすい / あん', meaning: 'barato, seguro' },
  暗: { reading: 'くらい / あん', meaning: 'oscuro' },
  短: { reading: 'みじかい / たん', meaning: 'corto' },
  低: { reading: 'ひくい / てい', meaning: 'bajo' },
  行: { reading: 'いく / こう', meaning: 'ir' },
  帰: { reading: 'かえる / き', meaning: 'volver' },
  食: { reading: 'たべる / しょく', meaning: 'comer' },
  飲: { reading: 'のむ / いん', meaning: 'beber' },
  見: { reading: 'みる / けん', meaning: 'ver' },
  聞: { reading: 'きく / ぶん', meaning: 'oír, preguntar' },
  読: { reading: 'よむ / どく', meaning: 'leer' },
  話: { reading: 'はなす / わ', meaning: 'hablar' },
  買: { reading: 'かう / ばい', meaning: 'comprar' },
  教: { reading: 'おしえる / きょう', meaning: 'enseñar' },
  朝: { reading: 'あさ / ちょう', meaning: 'mañana' },
  晩: { reading: 'ばん', meaning: 'noche' },
  曜: { reading: 'よう', meaning: 'día de la semana' },
  作: { reading: 'つくる / さく', meaning: 'crear' },
  泳: { reading: 'およぐ / えい', meaning: 'nadar' },
  油: { reading: 'あぶら / ゆ', meaning: 'aceite' },
  海: { reading: 'うみ / かい', meaning: 'mar' },
  酒: { reading: 'さけ / しゅ', meaning: 'sake, alcohol' },
  待: { reading: 'まつ / たい', meaning: 'esperar' },
  校: { reading: 'こう', meaning: 'escuela' },
  時: { reading: 'とき / じ', meaning: 'tiempo, hora' },
  計: { reading: 'はかる / けい', meaning: 'medir, contar' },
  語: { reading: 'かたる / ご', meaning: 'idioma, hablar' },
  宅: { reading: 'たく', meaning: 'residencia' },
  客: { reading: 'きゃく', meaning: 'cliente, invitado' },
  室: { reading: 'しつ / むろ', meaning: 'habitación' },
  家: { reading: 'いえ / か', meaning: 'casa, familia' },
  英: { reading: 'えい', meaning: 'inglés, excelente' },
  薬: { reading: 'くすり / やく', meaning: 'medicina' },
  会: { reading: 'あう / かい', meaning: 'reunión, encontrar' },
  今: { reading: 'いま / こん', meaning: 'ahora' },
  雪: { reading: 'ゆき / せつ', meaning: 'nieve' },
  雲: { reading: 'くも / うん', meaning: 'nube' },
  電: { reading: 'でん', meaning: 'electricidad' },
  売: { reading: 'うる / ばい', meaning: 'vender' },
  広: { reading: 'ひろい / こう', meaning: 'ancho' },
  店: { reading: 'みせ / てん', meaning: 'tienda' },
  度: { reading: 'たび / ど', meaning: 'vez, grado' },
  病: { reading: 'やまい / びょう', meaning: 'enfermedad' },
  痛: { reading: 'いたい / つう', meaning: 'dolor' },
  国: { reading: 'くに / こく', meaning: 'país' },
  回: { reading: 'まわる / かい', meaning: 'girar, vez' },
  困: { reading: 'こまる / こん', meaning: 'estar en apuros' },
  開: { reading: 'あける / かい', meaning: 'abrir' },
  閉: { reading: 'しめる / へい', meaning: 'cerrar' },
  近: { reading: 'ちかい / きん', meaning: 'cerca' },
  遠: { reading: 'とおい / えん', meaning: 'lejos' },
  速: { reading: 'はやい / そく', meaning: 'rápido' },
  道: { reading: 'みち / どう', meaning: 'camino' },
  通: { reading: 'とおる / つう', meaning: 'pasar' },
  晴: { reading: 'はれる / せい', meaning: 'despejado' },
  静: { reading: 'しずか / せい', meaning: 'tranquilo' },
  持: { reading: 'もつ / じ', meaning: 'tener, llevar' },
  歌: { reading: 'うた / か', meaning: 'canción' },
  気: { reading: 'き / け', meaning: 'espíritu, aire' },
  有: { reading: 'ある / ゆう', meaning: 'tener, existir' },
  名: { reading: 'な / めい', meaning: 'nombre' },
  親: { reading: 'おや / しん', meaning: 'padre/madre' },
  切: { reading: 'きる / せつ', meaning: 'cortar' },
  便: { reading: 'たより / べん', meaning: 'conveniente' },
  利: { reading: 'り', meaning: 'beneficio' },
  乗: { reading: 'のる / じょう', meaning: 'montar' },
  降: { reading: 'おりる / こう', meaning: 'bajar, caer' },
  着: { reading: 'つく / ちゃく', meaning: 'llegar, vestir' },
  渡: { reading: 'わたる / と', meaning: 'cruzar' },
  走: { reading: 'はしる / そう', meaning: 'correr' },
  歩: { reading: 'あるく / ほ', meaning: 'caminar' },
  動: { reading: 'うごく / どう', meaning: 'mover' },
  働: { reading: 'はたらく / どう', meaning: 'trabajar' },
  東: { reading: 'ひがし / とう', meaning: 'este' },
  駅: { reading: 'えき', meaning: 'estación' },
  社: { reading: 'やしろ / しゃ', meaning: 'compañía, santuario' },
  院: { reading: 'いん', meaning: 'institución' },
  地: { reading: 'ち / じ', meaning: 'tierra, suelo' },
  鉄: { reading: 'てつ', meaning: 'hierro' },
  場: { reading: 'ば / じょう', meaning: 'lugar' },
  図: { reading: 'ず / と', meaning: 'diagrama, mapa' },
  館: { reading: 'かん', meaning: 'edificio público' },
  園: { reading: 'その / えん', meaning: 'jardín, parque' },
  住: { reading: 'すむ / じゅう', meaning: 'vivir' },
  号: { reading: 'ごう', meaning: 'número' },
  練: { reading: 'ねる / れん', meaning: 'practicar' },
  習: { reading: 'ならう / しゅう', meaning: 'aprender' },
  勉: { reading: 'べん', meaning: 'esfuerzo' },
  強: { reading: 'つよい / きょう', meaning: 'fuerte' },
  研: { reading: 'けん', meaning: 'pulir, investigar' },
  究: { reading: 'きゅう', meaning: 'investigar' },
  質: { reading: 'しつ / しち', meaning: 'calidad' },
  問: { reading: 'とう / もん', meaning: 'preguntar' },
  題: { reading: 'だい', meaning: 'tema, título' },
  答: { reading: 'こたえる / とう', meaning: 'respuesta' },
  政: { reading: 'まつりごと / せい', meaning: 'gobierno' },
  治: { reading: 'なおす / ち', meaning: 'gobernar, curar' },
  経: { reading: 'へる / けい', meaning: 'pasar por' },
  済: { reading: 'すむ / さい', meaning: 'terminar, ahorrar' },
  歴: { reading: 'れき', meaning: 'historial' },
  育: { reading: 'そだてる / いく', meaning: 'criar' },
  化: { reading: 'ばける / か', meaning: 'transformar' },
  理: { reading: 'り', meaning: 'razón, lógica' },
  科: { reading: 'か', meaning: 'sección, ciencia' },
  数: { reading: 'かず / すう', meaning: 'número, contar' },
  医: { reading: 'い', meaning: 'medicina' },
  映: { reading: 'うつる / えい', meaning: 'reflejar, proyectar' },
  画: { reading: 'が / かく', meaning: 'imagen, trazo' },
  写: { reading: 'うつす / しゃ', meaning: 'copiar, foto' },
  音: { reading: 'おと / おん', meaning: 'sonido' },
  楽: { reading: 'たのしい / がく', meaning: 'divertido, música' },
  組: { reading: 'くむ / そ', meaning: 'grupo, conjunto' },
  思: { reading: 'おもう / し', meaning: 'pensar' },
};

// ═══════════════════════════════════════════════════════════
//  MAIN: parse + merge + output
// ═══════════════════════════════════════════════════════════

function main(): void {
  console.log('=== parse-kanjis.ts ===\n');

  // ── 1. Parse kanji from txt files ──────────────────
  const kanjisFile1 = path.join(ROOT, 'data', 'kanjis_libro', 'Kanjis 1-251.txt');
  const kanjisFile2 = path.join(ROOT, 'data', 'kanjis_libro', 'Kanjis 252 - 500.txt');
  const allKanjiSet = new Set<string>();

  for (const f of [kanjisFile1, kanjisFile2]) {
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const line of text.split('\n')) {
      if (line.match(/漢字[：:]/)) {
        const part = line.split(/[：:]/)[1] || '';
        for (const ch of part.trim()) {
          if (/[\u4E00-\u9FFF]/.test(ch)) allKanjiSet.add(ch);
        }
      }
    }
  }
  console.log(`Parsed ${allKanjiSet.size} unique kanji from txt files`);

  // ── 2. Build decompositions ────────────────────────
  const decompOut: Record<string, any> = {};
  const missing: string[] = [];

  for (const k of allKanjiSet) {
    const raw = DECOMP_TABLE[k];
    if (raw && raw.parts.length >= 2) {
      decompOut[k] = {
        layout: raw.layout,
        components: raw.parts.map((p, i) => ({
          id: `${k}_c${i}`,
          char: p.char,
          slot_id: p.slot,
          order_index: i,
          bounds: { x: p.bx, y: p.by, w: p.bw, h: p.bh },
        })),
      };
    } else {
      // single-char "decomposition" — still needed so words validate
      decompOut[k] = {
        layout: 'single',
        components: [
          { id: `${k}_c0`, char: k, slot_id: 'center', order_index: 0,
            bounds: { x: 0, y: 0, w: 1, h: 1 } },
        ],
      };
      if (!raw) missing.push(k);
    }
  }

  const multiCount = Object.values(decompOut).filter(
    (d: any) => d.components.length >= 2,
  ).length;
  console.log(`Decompositions: ${multiCount} multi-component, ${Object.keys(decompOut).length - multiCount} single`);

  // ── 3. Build word list ─────────────────────────────
  const wordsOut: { id: string; kanji: string[]; reading: string; meaning: string; readingParts: string[] }[] = [];
  let wid = 1;
  for (const [text, def] of Object.entries(WORD_DICTIONARY)) {
    // check every kanji in the word is known
    const allKnown = def.kanji.every((k) => allKanjiSet.has(k));
    // require at least one kanji to have a multi-component decomposition
    const hasMulti = def.kanji.some(
      (k) => decompOut[k] && decompOut[k].components.length >= 2,
    );
    if (allKnown && hasMulti) {
      wordsOut.push({ id: `w${wid++}`, ...def });
    }
  }
  console.log(`Words: ${wordsOut.length} playable (with multi-component kanji)`);

  // ── 4. Build kanji meta ────────────────────────────
  const metaOut: Record<string, { reading: string; meaning: string }> = {};
  for (const k of allKanjiSet) {
    if (KANJI_META[k]) metaOut[k] = KANJI_META[k];
    else metaOut[k] = { reading: k, meaning: '' };
  }

  // ── 5. Write outputs ──────────────────────────────
  const outDir = path.join(ROOT, 'public', 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'kanji_decomp.json'),  JSON.stringify(decompOut, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'kanji_meta.json'),    JSON.stringify(metaOut, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'words.json'),         JSON.stringify(wordsOut, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'confusables.json'),   JSON.stringify(CONFUSABLES, null, 2), 'utf8');

  // ── 6. Missing report ─────────────────────────────
  if (missing.length > 0) {
    const report = [
      '# Missing kanji decompositions',
      `# ${new Date().toISOString()}`,
      `# ${missing.length} kanji have no multi-component decomposition`,
      '',
      ...missing.sort(),
    ].join('\n');
    fs.writeFileSync(path.join(ROOT, 'missing_kanji.txt'), report, 'utf8');
    console.log(`\nWrote ${missing.length} missing kanji to missing_kanji.txt`);
  }

  console.log('\nDone!');
}

main();
