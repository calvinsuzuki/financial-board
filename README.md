# Dashboard Financeiro

Encrypted personal finance dashboard that runs entirely in the browser — no server required.

## Features

- **AES-256-GCM encryption** — all data is encrypted with your password, unreadable without it
- **Works offline** — open `index.html` directly from your filesystem (`file://`)
- **Three categories** — Renda Fixa, Renda Variável, Crypto
- **Multi-broker tracking** — organize investments by broker/exchange
- **Automatic gain calculation** — monthly returns, accumulated gains, annualized rates
- **Charts** — portfolio evolution and distribution (powered by Chart.js)
- **Data/layout separation** — update the app without losing your data

## Files

| File | Purpose |
|------|---------|
| `index.html` | App structure (HTML) |
| `style.css` | Styling (dark theme) |
| `script.js` | App logic, crypto, rendering |
| `data.js` | Your encrypted data (auto-generated) |

## Usage

1. Open `index.html` in any browser
2. First time: create a password → your data is encrypted with AES-256-GCM
3. Next visits: enter your password to decrypt and view your dashboard
4. Add monthly entries with "+ Novo Mês" — previous month data is cloned for easy updating
5. Each save auto-downloads `data.js` — replace it in this folder to persist changes

## Security

- Password never stored — derived into a key via PBKDF2 (310,000 iterations)
- Random salt + IV per encryption
- All processing happens locally in the browser
- `data.js` contains only an opaque base64 blob
