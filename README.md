# Claw Portfolio

Un portfolio giocabile: una macchina artigliatrice (UFO catcher) in 3D costruita con Three.js e Rapier. Sei progetti nascosti tra le capsule; miri, fai scendere l'artiglio e quando ne afferri uno si apre la scheda del progetto.

## Come si gioca su iPhone

Apri il sito in Safari (meglio in verticale). Trascina sullo schermo per spostare l'artiglio, poi tocca il pulsante per farlo scendere. Se aggiungi la pagina alla schermata Home, parte a tutto schermo senza barre del browser (`apple-mobile-web-app-capable`).

## Avvio in locale

Serve Node 24 o superiore.

```bash
npm i
npm run dev      # http://localhost:5173, accessibile anche da iPhone sulla LAN
npm test         # unit test Vitest
npm run build    # typecheck + build in dist/
npm run preview  # serve dist/ su http://localhost:4173
```

La build usa `base: './'`, quindi `dist/` funziona sia in root sia in una sottocartella (GitHub Pages compreso).

## Smoke test

```bash
npm run smoke
```

Lo script apre Chrome di sistema in modalità **headful** di default: il WebGL headless gira a circa 15 fps e falserebbe il test. Carica la pagina in emulazione iPhone 13, aspetta `window.__claw.ready`, esegue `window.__claw.testGrab('magicwall')`, attende la prize card, salva `artifacts/iphone-prize.png` ed esce con codice 1 (con dettaglio dell'errore) se qualcosa fallisce.

Variabili d'ambiente:

| Variabile     | Default                  | Uso                                                        |
| ------------- | ------------------------ | ---------------------------------------------------------- |
| `URL`         | `http://localhost:4173/` | URL da testare                                             |
| `TIMEOUT`     | `120000`                 | timeout globale in ms (e dei singoli wait)                 |
| `HEADLESS=1`  | off                      | forza headless in CI; il gate sugli fps viene disattivato  |
| `MIN_FPS`     | `30`                     | soglia fps in headful, `0` per disabilitarla               |
| `CHROME_PATH` | Chrome di sistema        | percorso esplicito dell'eseguibile                         |

Prima dello smoke serve una build servita: `npm run build && npm run preview`, poi in un altro terminale `npm run smoke`.

## Struttura

```
index.html            canvas, HUD, card premio
src/
  main.ts             bootstrap, game loop, API window.__claw (ready, testGrab, debug…)
  contracts.ts        tipi condivisi tra i moduli
  game/               roster progetti, RNG, logica di grab, layout, macchina a stati
  scene/              studio e HDRI, cabinet, artiglio, capsule, fisica Rapier, materiali, giocattoli
  ui/                 HUD, controlli touch, prize card, audio
  styles.css
tests/                unit test Vitest (grab, layout, machine, roster)
scripts/              smoke.mjs, screenshot, perf e debug
public/env/           HDRI equirettangolare per l'illuminazione
artifacts/            screenshot generati dai test (gitignored)
.github/workflows/    deploy su GitHub Pages
```

## Deploy

Il workflow `.github/workflows/deploy.yml` parte a ogni push su `main`: installa con `npm ci`, esegue `npm run build`, carica `dist/` come artifact Pages e pubblica con `actions/deploy-pages`. Su GitHub va abilitato Pages con source "GitHub Actions".

## HDRI e crediti

L'HDRI `public/env/studio_small_08_1k.hdr` è **Studio Small 08** di [Poly Haven](https://polyhaven.com/), distribuito con licenza **CC0**: nessuna attribuzione richiesta, il credito è comunque doveroso. Se il file non si carica, la scena ripiega su un ambiente "room" generato proceduralmente.

Stack: [Three.js](https://threejs.org/) (MIT), [Rapier](https://rapier.rs/) (Apache-2.0), [Vite](https://vite.dev/) (MIT), [Vitest](https://vitest.dev/) (MIT), [Playwright](https://playwright.dev/) (Apache-2.0) per lo smoke.
