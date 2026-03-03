import type { Bounds01 } from './Bounds';

/** A visual component (radical) of a kanji character */
export interface Component {
  readonly id: string;
  readonly char: string;
  readonly slot_id: string;
  readonly order_index: number;
  readonly bounds: Bounds01;
}
