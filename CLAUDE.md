# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Encrypted personal finance dashboard (Portuguese/pt-BR) that runs entirely in the browser via `file://` protocol. No server, no build system, no frameworks — vanilla JS with `<script>` tags. All financial data is AES-256-GCM encrypted client-side.

## Development

Open `index.html` directly in a browser. No build step, no dev server. There are no tests or linters.

To test changes, refresh the browser. If `data.js` contains encrypted data, you'll need the password to unlock; otherwise it loads dummy sample data automatically.

## Architecture

**Script load order matters** (defined in index.html):
```
Chart.js CDN → data.js → state.js → crypto.js → helpers.js → auth.js → forms.js → fetch-prices.js → render.js → init()
```

**Screen flow:**
- No `data.js` → skip auth, load dummy data, show dashboard
- `data.js` exists → auth screen (password) → decrypt → dashboard
- Password is only required on save/export, not on startup for new dashboards

**Data model** — `appData.months[]` array, each entry:
```
{ month, year, date, aporte, gain, accGain, categories: { fixed: [...], variable: [...], crypto: [...] } }
```
Each category contains brokers, each broker has investments with `{ name, value, rate, maturity }`. Crypto/variable investments also have optional `ticker`, `quantity`, `priceUsd`.

**Rendering pipeline** — `renderDashboard()` orchestrates: `renderSummary()` → `renderMonthTabs()` → `renderCharts()` → `updateDistChart()` → `renderDetail()` → `renderTable()`.

- `filterCat(cat)` re-renders summary, charts, detail, and table for a single category (or 'all').
- `selectMonth(i)` only calls `updateDistChart()` (optimization — avoids full re-render).

**Key state variables** (in `state.js`, all `var`):
- `APP_PW` — current password (null until login or export)
- `appData` — main data object `{ months: [...] }`
- `selMonth` / `selCat` — currently selected month index and category filter
- `editIdx` / `deleteIdx` — month being edited/deleted (-1 if none)
- `formPrevMonth` — snapshot of previous month during form editing (for gain calc hints)

**Gain recalculation cascade** — when saving any month (`forms.js:saveMonth`), gain and accGain are recalculated for the edited month AND all subsequent months. Editing month 2 of 5 will update months 2–5.

**Form bidirectional binding** — for variable/crypto investments, price × quantity = value. Editing any one field auto-updates the others via `bindPrice()`, `bindQty()`, `bindVal()`.

**Legacy migration** — `auth.js:doLogin()` migrates old `m.brokers` → `m.categories` structure on decrypt.

## Key Constraints

- **`file://` protocol**: `fetch()` won't load local files. Data is stored as `var ENCRYPTED_PAYLOAD = "..."` in `data.js` loaded via `<script src>`. External API calls (CoinGecko, brapi.dev) work because they return `Access-Control-Allow-Origin: *`.
- **No ES modules**: All scripts share global scope. Use `var` (not `let`/`const`) for cross-script state in `state.js`.
- **Encryption**: PBKDF2 310k iterations + AES-256-GCM. Random 16-byte salt + 12-byte IV per encryption. Output is base64(salt+iv+ciphertext).
- **Data/layout separation**: `data.js` (encrypted blob) is independent from app code. Users update layout files without touching their data.

## External APIs

- **CoinGecko** (free, no key): crypto prices in BRL+USD — `fetch-prices.js`. Uses coin IDs (`bitcoin`, `ethereum`, `solana`), not ticker symbols.
- **brapi.dev** (free): Brazilian stock/ETF prices in BRL — `fetch-prices.js`. Uses uppercase tickers (`IVVB11`, `WEGE3`).
- Price fetching requires both `ticker` AND `quantity` to be filled; only applies to variable/crypto investments.

## Conventions

- UI text is in Portuguese (pt-BR)
- Currency formatting: `fmtR()` for BRL, `fmtUsd()` for USD, `parseR()` to parse Brazilian format
- CSS dark theme with variables (`--bg`, `--card`, `--text`, `--accent`, `--green`, `--red`, etc.)
- Category colors: blue=fixed, orange=variable, yellow=crypto
- Form IDs prefixed with `f-` (e.g., `f-month`, `f-year`, `f-aporte`)
- Chart.js instances stored in `chartEvo` and `chartDist` globals (destroyed before recreation)
