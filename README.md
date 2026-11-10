# Acadza — Report → Fix

Offline-first faculty console for reviewing student reports about JEE/NEET question content.

## What's included

- Faculty dashboard and question-grouped review queue.
- Original question rendering with HTML and native MathML.
- Student comments, taxonomy verdict, evidence and confidence.
- Before/after preview for surgical edits.
- Student reply preview.
- Approve, reject and note actions with a local audit log.
- `results.json` with one triage result for each of the 44 supplied reports.
- `unreported_defects.json` (empty: no additional unreported defect was independently verified in the four unreported records during this pass).
- `PROMPTS.md` and one-page `PRODUCT.md`.
- Offline triage validator/exporter (`triage-engine.js`).
- Node-based data validation tests.

## Important runtime disclosure

The console uses **precomputed triage results**. It does not call a live LLM API. This is intentional so the demo works without API credentials; the header and About panel disclose this. Faculty actions are persisted in browser `localStorage`, not a production database. The app is a functional demo/prototype, not a production deployment with authentication or shared multi-user state.

## Requirements

- Node.js 18 or newer (no npm dependencies required).

## Run locally

```bash
npm start
```

Open `http://localhost:4173`.

Alternatively, use any static server from the project root:

```bash
python -m http.server 4173
```

## Validate the dataset and results

```bash
npm test
npm run triage
```

The tests check:
- 43 source questions and 44 reports/results.
- Unique report IDs and report-to-question mapping.
- Taxonomy verdicts and repair names.
- Repair field scopes and `auto` restrictions.
- Auto-apply items have a concrete edit.
- Prompt-injection and faculty-only trap cases.

## Project structure

```text
project-root/
├── index.html
├── styles.css
├── app.js
├── server.js
├── triage-engine.js
├── package.json
├── data/
│   ├── questions.json
│   ├── reports.json
│   └── taxonomy.json
├── results.json
├── unreported_defects.json
├── PROMPTS.md
├── PRODUCT.md
├── ASSIGNMENT.md
└── tests/
    └── validate-data.js
```

## Deployment

This is a static site. Deploy the project root to Netlify, Vercel (static output), GitHub Pages, or any static hosting provider. Ensure `data/`, `results.json`, `app.js`, and `styles.css` are included at the same relative paths. For Node hosting, run `npm start` and set `PORT` if required.

No live URL or public GitHub repository is claimed by this workspace build; those require the user's hosting/GitHub account and authorization. The app can be deployed without a backend. For a real multi-user release, replace local storage with an authenticated database and add role-based access, server-side audit logging, and an actual LLM provider behind a strict validator.

## Source assignment

`ASSIGNMENT.md` preserves the supplied assignment brief verbatim. The original data files are preserved under `data/`.
