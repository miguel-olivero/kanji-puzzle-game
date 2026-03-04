# Kanji Puzzle Game

A web puzzle game for learning Japanese kanji by assembling their components.

## Setup

```bash
# Install dependencies
npm install

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

## Data

The playable dataset is pre-generated and committed in `public/data/`.

- Runtime reads only same-origin JSON from `public/data/`.
- Raw textbook source files are intentionally excluded from this repository.
- If you keep private generation tooling locally, run `npm run validate:data` before publishing updates.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build Vite production bundle |
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
public/data/       # Pre-generated JSON data used by the game
scripts/           # Validation and maintenance scripts
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
