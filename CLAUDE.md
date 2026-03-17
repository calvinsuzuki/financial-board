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

## Key Constraints

- **`file://` protocol**: `fetch()` won't load local files. Data is stored as `var ENCRYPTED_PAYLOAD = "..."` in `data.js` loaded via `<script src>`. External API calls (CoinGecko, brapi.dev) work because they return `Access-Control-Allow-Origin: *`.
- **No ES modules**: All scripts share global scope. Use `var` (not `let`/`const`) for cross-script state in `state.js`.
- **Encryption**: PBKDF2 310k iterations + AES-256-GCM. Random 16-byte salt + 12-byte IV per encryption. Output is base64(salt+iv+ciphertext).
- **Data/layout separation**: `data.js` (encrypted blob) is independent from app code. Users update layout files without touching their data.

## External APIs

- **Binance** (free, no key): crypto prices in BRL+USD — `fetch-prices.js`
- **brapi.dev** (free): Brazilian stock/ETF prices in BRL — `fetch-prices.js`

## Conventions

- UI text is in Portuguese (pt-BR)
- Currency formatting: `fmtR()` for BRL, `fmtUsd()` for USD, `parseR()` to parse Brazilian format
- CSS dark theme with variables (`--bg`, `--card`, `--text`, `--accent`, `--green`, `--red`, etc.)
- Category colors: blue=fixed, orange=variable, yellow=crypto
- Form IDs prefixed with `f-` (e.g., `f-month`, `f-year`, `f-aporte`)
- Chart.js instances stored in `chartEvo` and `chartDist` globals (destroyed before recreation)
