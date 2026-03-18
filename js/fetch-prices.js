// Auto-fetch prices for crypto (Binance) and variable/stocks (brapi.dev)

async function fetchCryptoPrices(symbols) {
  if (!symbols.length) return {};
  var result = {};

  await Promise.all(symbols.map(async function(sym) {
    try {
      var responses = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=' + sym + 'BRL'),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=' + sym + 'USDT')
      ]);
      var entry = {};
      if (responses[0].ok) entry.brl = parseFloat((await responses[0].json()).price);
      if (responses[1].ok) entry.usd = parseFloat((await responses[1].json()).price);
      if (entry.brl || entry.usd) result[sym] = entry;
    } catch(e) { /* skip failed ticker */ }
  }));

  return result;
}

async function fetchStockPrices(tickers) {
  if (!tickers.length) return {};
  if (!BRAPI_TOKEN) {
    var token = prompt('brapi.dev requer um token gratuito para cota\u00e7\u00f5es de a\u00e7\u00f5es.\nCrie em: https://brapi.dev (gr\u00e1tis)\n\nCole seu token:');
    if (!token) throw new Error('Token brapi n\u00e3o informado');
    BRAPI_TOKEN = token.trim();
    try { localStorage.setItem('brapiToken', BRAPI_TOKEN); } catch(e) {}
  }
  var result = {};
  var gotAuth = false;

  await Promise.all(tickers.map(async function(ticker) {
    try {
      var resp = await fetch('https://brapi.dev/api/quote/' + ticker + '?token=' + encodeURIComponent(BRAPI_TOKEN));
      if (resp.status === 401) { gotAuth = true; return; }
      if (!resp.ok) return;
      var data = await resp.json();
      (data.results || []).forEach(function(r) {
        if (r.symbol && r.regularMarketPrice) {
          result[r.symbol.toUpperCase()] = r.regularMarketPrice;
        }
      });
    } catch(e) { /* skip failed ticker */ }
  }));

  if (gotAuth) { BRAPI_TOKEN = ''; try { localStorage.removeItem('brapiToken'); } catch(e) {} throw new Error('Token brapi inv\u00e1lido'); }
  return result;
}

async function fetchAllPrices() {
  var cryptoSymbols = [];
  var stockTickers = [];
  var entries = [];

  document.querySelectorAll('#brokers-all .form-section').forEach(function(sec) {
    var activeCat = sec.querySelector('.cat-pill.active');
    if (!activeCat) return;
    var catId = activeCat.dataset.cat;
    if (catId === 'fixed') return;

    sec.querySelectorAll('.inv-entry').forEach(function(entry) {
      var vc = entry.querySelector('.inv-row-varcrp');
      if (!vc) return;
      var tickerInput = vc.querySelector('.inv-ticker');
      var qtyInput = vc.querySelector('.inv-qty');
      if (!tickerInput || !qtyInput) return;
      var ticker = tickerInput.value.trim();
      var qty = parseFloat(qtyInput.value.replace(',', '.')) || 0;
      if (!ticker || !qty) return;

      if (catId === 'crypto') {
        var sym = ticker.toUpperCase();
        cryptoSymbols.push(sym);
        entries.push({ entry: entry, ticker: sym, qty: qty, type: 'crypto' });
      } else if (catId === 'variable') {
        stockTickers.push(ticker.toUpperCase());
        entries.push({ entry: entry, ticker: ticker.toUpperCase(), qty: qty, type: 'stock' });
      }
    });
  });

  var usdWraps = document.querySelectorAll('#brokers-all .inv-usd-wrap');
  var hasUsdFixed = false;
  usdWraps.forEach(function(w) { if (w.style.display !== 'none') hasUsdFixed = true; });
  if (!entries.length && !hasUsdFixed) return { updated: 0, errors: [] };

  var cryptoPrices = {};
  var stockPrices = {};
  var errors = [];

  var uniqueCrypto = [...new Set(cryptoSymbols)];
  var uniqueStocks = [...new Set(stockTickers)];

  var fetches = [];
  // Always fetch USD/BRL rate
  fetches.push(
    fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL')
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) { if (d && d.price) USD_BRL_RATE = parseFloat(d.price); })
      .catch(function() {})
  );
  if (uniqueCrypto.length) {
    fetches.push(fetchCryptoPrices(uniqueCrypto).then(function(r) { cryptoPrices = r; }).catch(function(e) { errors.push('Crypto: ' + e.message); }));
  }
  if (uniqueStocks.length) {
    fetches.push(fetchStockPrices(uniqueStocks).then(function(r) { stockPrices = r; }).catch(function(e) { errors.push('A\u00e7\u00f5es: ' + e.message); }));
  }
  await Promise.all(fetches);

  var updated = 0;
  var notFound = [];

  entries.forEach(function(e) {
    var priceBrl = null;
    var priceUsd = null;

    if (e.type === 'crypto') {
      var cp = cryptoPrices[e.ticker];
      if (cp) { priceBrl = cp.brl; priceUsd = cp.usd; }
    } else {
      priceBrl = stockPrices[e.ticker];
    }

    if (priceBrl != null) {
      var value = e.qty * priceBrl;
      var vc = e.entry.querySelector('.inv-row-varcrp');
      var priceInput = vc.querySelector('.inv-price');
      priceInput.value = fmtI(priceBrl);
      if (priceUsd) priceInput.dataset.priceUsd = priceUsd;
      var valInput = vc.querySelector('.inv-val');
      valInput.value = fmtI(value);
      valInput.classList.remove('invalid');
      priceInput.style.background = 'rgba(0,184,148,0.15)';
      valInput.style.background = 'rgba(0,184,148,0.15)';
      setTimeout(function() { priceInput.style.background = ''; valInput.style.background = ''; }, 1500);
      updated++;
    } else {
      notFound.push(e.ticker);
    }
  });

  // Update câmbio fields in USD fixed entries
  if (USD_BRL_RATE) {
    document.querySelectorAll('#brokers-all .inv-usd-wrap').forEach(function(wrap) {
      if (wrap.style.display === 'none') return;
      var cambioInput = wrap.querySelector('.inv-cambio');
      cambioInput.value = fmtI(USD_BRL_RATE);
      var usdAmt = parseR(wrap.querySelector('.inv-usd-amt').value);
      if (usdAmt) {
        wrap.querySelector('.inv-val').value = fmtI(USD_BRL_RATE * usdAmt);
      }
      cambioInput.style.background = 'rgba(0,184,148,0.15)';
      setTimeout(function() { cambioInput.style.background = ''; }, 1500);
      updated++;
    });
  }

  return { updated: updated, errors: errors, notFound: notFound };
}

async function doFetchPrices() {
  var btn = document.getElementById('fetch-prices-btn');
  var origText = btn.textContent;
  btn.textContent = 'Buscando...';
  btn.disabled = true;

  try {
    var result = await fetchAllPrices();
    recalcForm();

    if (result.errors.length) {
      alert('Erros ao buscar: ' + result.errors.join('; '));
    } else if (result.notFound && result.notFound.length) {
      alert(result.updated + ' atualizado(s). N\u00e3o encontrado: ' + result.notFound.join(', '));
    } else if (result.updated === 0) {
      alert('Nenhum investimento com ticker e quantidade preenchidos.');
    } else {
      btn.textContent = result.updated + ' atualizado(s)!';
      btn.style.color = 'var(--green)';
      btn.disabled = false;
      setTimeout(function() { btn.textContent = origText; btn.style.color = ''; }, 2000);
      return;
    }
  } catch(e) {
    alert('Erro: ' + e.message);
  }

  btn.textContent = origText;
  btn.disabled = false;
}
