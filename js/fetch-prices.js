// Auto-fetch prices for crypto (CoinGecko) and variable/stocks (brapi.dev)

async function fetchCryptoPrices(coinIds) {
  if (!coinIds.length) return {};
  var ids = coinIds.join(',');
  var url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids) + '&vs_currencies=brl,usd';
  var resp = await fetch(url);
  if (!resp.ok) throw new Error('CoinGecko: ' + resp.status);
  var data = await resp.json();
  var result = {};
  Object.keys(data).forEach(function(id) {
    if (data[id].brl) result[id.toLowerCase()] = { brl: data[id].brl, usd: data[id].usd || 0 };
  });
  return result;
}

async function fetchStockPrices(tickers) {
  if (!tickers.length) return {};
  var symbols = tickers.join(',');
  var url = 'https://brapi.dev/api/quote/' + encodeURIComponent(symbols);
  var resp = await fetch(url);
  if (!resp.ok) throw new Error('brapi: ' + resp.status);
  var data = await resp.json();
  var result = {};
  (data.results || []).forEach(function(r) {
    if (r.symbol && r.regularMarketPrice) {
      result[r.symbol.toUpperCase()] = r.regularMarketPrice;
    }
  });
  return result;
}

async function fetchAllPrices() {
  var cryptoIds = [];
  var stockTickers = [];
  var entries = [];

  document.querySelectorAll('#brokers-all .form-section').forEach(function(sec) {
    var activeCat = sec.querySelector('.cat-pill.active');
    if (!activeCat) return;
    var catId = activeCat.dataset.cat;
    if (catId === 'fixed') return;

    sec.querySelectorAll('.inv-entry').forEach(function(entry) {
      var tickerInput = entry.querySelector('.inv-ticker');
      var qtyInput = entry.querySelector('.inv-qty');
      if (!tickerInput || !qtyInput) return;
      var ticker = tickerInput.value.trim();
      var qty = parseFloat(qtyInput.value.replace(',', '.')) || 0;
      if (!ticker || !qty) return;

      if (catId === 'crypto') {
        cryptoIds.push(ticker.toLowerCase());
        entries.push({ entry: entry, ticker: ticker.toLowerCase(), qty: qty, type: 'crypto' });
      } else if (catId === 'variable') {
        stockTickers.push(ticker.toUpperCase());
        entries.push({ entry: entry, ticker: ticker.toUpperCase(), qty: qty, type: 'stock' });
      }
    });
  });

  if (!entries.length) return { updated: 0, errors: [] };

  var cryptoPrices = {};
  var stockPrices = {};
  var errors = [];

  var uniqueCrypto = [...new Set(cryptoIds)];
  var uniqueStocks = [...new Set(stockTickers)];

  if (uniqueCrypto.length) {
    try {
      cryptoPrices = await fetchCryptoPrices(uniqueCrypto);
    } catch(e) {
      errors.push('Crypto: ' + e.message);
    }
  }

  if (uniqueStocks.length) {
    try {
      stockPrices = await fetchStockPrices(uniqueStocks);
    } catch(e) {
      errors.push('A\u00e7\u00f5es: ' + e.message);
    }
  }

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
      var valInput = e.entry.querySelector('.inv-val');
      valInput.value = fmtI(value);
      valInput.classList.remove('invalid');
      // Store USD price for crypto
      if (priceUsd) valInput.dataset.priceUsd = priceUsd;
      // Flash green briefly
      valInput.style.background = 'rgba(0,184,148,0.15)';
      setTimeout(function() { valInput.style.background = ''; }, 1500);
      updated++;
    } else {
      notFound.push(e.ticker);
    }
  });

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
      setTimeout(function() { btn.textContent = origText; btn.style.color = ''; }, 2000);
      return;
    }
  } catch(e) {
    alert('Erro: ' + e.message);
  }

  btn.textContent = origText;
  btn.disabled = false;
}
