# Kanji Puzzle Game

A web puzzle game for learning Japanese kanji by assembling their components.

## Setup

```bash
# Install dependencies
npm install

# Build data files from source
npm run build:data

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173/kanji-puzzle-game/`.

## How to Play

1. Click **Start** to begin.
2. A hint appears: a Japanese word with its reading and meaning.
3. The target kanji is shown with empty slots for its components.
4. For each slot (in stroke order), choose the correct component from 4 options.
5. Once all slots are filled, click **Check** to verify.
6. Green = correct, Red = incorrect. Click **Next Word** to continue.

## Adding Kanji

### 1. Edit the source CSV

Open `data/source/kanji_source.csv` and add rows. Each row defines one kanji with up to 3 components:

```
kanji,layout,comp1_char,comp1_slot,comp1_order,comp1_bx,comp1_by,comp1_bw,comp1_bh,...
```

- **layout**: `single`, `⿰` (left/right), `⿱` (top/bottom), `⿴` (enclosure), `⿺` (bottom-right wrap), `⿸` (top-left wrap), `grid`
- **bounds**: normalized 0..1 coordinates (x, y, width, height)

### 2. Add metadata

Add the kanji to `data/source/kanji_meta.json`:

```json
{ "新": { "reading": "あたらしい / しん", "meaning": "new" } }
```

### 3. Add to word list

Add vocabulary using the kanji in `data/source/words.json`:

```json
{ "id": "w20", "kanji": ["新", "聞"], "reading": "しんぶん", "meaning": "newspaper" }
```

### 4. Add confusables (optional)

Add visually similar characters to `data/source/confusables.json` for better distractors.

### 5. Rebuild data

```bash
npm run build:data
npm run validate:data
```

Any kanji referenced in words but missing from the CSV will be excluded and listed in `missing_kanji.txt`.

### Manual decomposition hook

For kanji not in the CSV, you can register decompositions programmatically:

```typescript
import { registerManualDecomp } from './services/DataLoader';

registerManualDecomp('新', {
  components: [
    { id: 'mc1', char: '立', slot_id: 'top-left', order_index: 0, bounds: { x: 0, y: 0, w: 0.4, h: 0.5 } },
    { id: 'mc2', char: '木', slot_id: 'bottom-left', order_index: 1, bounds: { x: 0, y: 0.5, w: 0.4, h: 0.5 } },
    { id: 'mc3', char: '斤', slot_id: 'right', order_index: 2, bounds: { x: 0.4, y: 0, w: 0.6, h: 1 } },
  ],
  layout: '⿰',
});
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build data + Vite production build |
| `npm run build:data` | Generate JSON from source CSV |
| `npm run validate:data` | Validate generated data |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript compiler check |
| `npm run test` | Run Vitest unit tests |

## Deploying to GitHub Pages

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages on push to `main`.

### Manual deployment:

```bash
npm run build
# The `dist/` directory is ready to be deployed
```

The Vite config sets `base: '/kanji-puzzle-game/'` for GitHub Pages compatibility.

## Architecture

```
src/
  domain/          # Pure data models (no side effects)
  services/        # Data loading, storage, scoring, randomization
  controllers/     # Game state machine
  ui/              # DOM rendering (vanilla TS, no framework)
    screens/       # Boot, Game, Result screens
data/source/       # Source data files
public/data/       # Generated JSON (built by build-data.ts)
scripts/           # Node.js build/validation scripts
tests/             # Vitest unit tests
```

## Privacy & Compliance

- **No cookies** — only localStorage for game progress
- **No analytics** by default
- **No external fetches** — all data served from same origin
- **EU-compliant CMP banner** with equally prominent Accept/Reject buttons
- **No dark patterns** in consent UI
- Game works fully without accepting non-essential storage

## Tech Stack

- TypeScript (strict mode)
- Vite (bundler)
- Vanilla DOM API (no React/Vue)
- Vitest (testing)
- ESLint (linting)
