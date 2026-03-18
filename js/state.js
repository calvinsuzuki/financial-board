// ENCRYPTED_PAYLOAD is set by data.js (loaded via <script> tag before this file)
if (typeof ENCRYPTED_PAYLOAD === 'undefined') var ENCRYPTED_PAYLOAD = null;

const MONTHS = ['Janeiro','Fevereiro','Mar\u00e7o','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const CATEGORIES = [
  { id: 'fixed', name: 'Renda Fixa', color: '#0984e3' },
  { id: 'variable', name: 'Renda Vari\u00e1vel', color: '#e17055' },
  { id: 'crypto', name: 'Crypto', color: '#fdcb6e' }
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const defaultBrokerColors = ['#8B10AE','#00b894','#e17055','#0984e3','#fdcb6e','#fd79a8','#00cec9','#e84393'];

var APP_PW = null;
var BRAPI_TOKEN = '';
var USD_BRL_RATE = 0;
var appData = { months: [] };
/*
  appData.months[i] = {
    month: 0-11, year: 2026, date: "dd/mm/aaaa",
    aporte: 1500, gain: 600, accGain: 2533.48,
    categories: {
      fixed:    [{ name: "PicPay", total: 52535.76, investments: [{ name, value, rate, maturity, currency?: "USD" }] }],
      variable: [{ name: "XP HB", total: 5000, investments: [...] }],
      crypto:   [{ name: "Binance", total: 3434.97, investments: [...] }]
    }
  }
  // currency: "USD" = investment entered in USD, but value is always stored as BRL (qty × câmbio).
  // Fixed investments with rate "Variável" count toward Renda Variável in distribution.
*/
var selMonth = 0;
var selCat = 'all';
var editIdx = -1;
var deleteIdx = -1;
var chartEvo = null, chartDist = null;
var formPrevMonth = null;
