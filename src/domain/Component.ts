import type { Bounds01 } from './Bounds';

/** A visual element (component) of a kanji character */
export interface Component {
  readonly id: string;
  /** The component character, e.g. 氵, 木, 門 */
  readonly char: string;
  /** Pedagogical label in Spanish, e.g. "agua", "árbol", "puerta" */
  readonly label: string;
  /** Pedagogical label in English, e.g. "water", "tree", "gate" */
  readonly label_en: string;
  readonly slot_id: string;
  readonly order_index: number;
  readonly bounds: Bounds01;
}
