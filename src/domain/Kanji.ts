import type { Component } from './Component';

/** Kanji character with its decomposition data */
export interface Kanji {
  readonly char: string;
  readonly reading: string;
  readonly meaning: string;
}

/** Layout type for kanji decomposition */
export type LayoutType = '⿰' | '⿱' | '⿴' | '⿺' | '⿸' | 'single' | 'grid';

/** Full kanji decomposition with components and layout */
export interface KanjiDecomposition {
  readonly components: readonly Component[];
  readonly layout: LayoutType;
}
