function getDummyData() {
  return {
    months: [
      {
        month: 0, year: 2026, date: '15/01/2026',
        aporte: 0, gain: 0, accGain: 0,
        categories: {
          fixed: [
            { name: 'PicPay', total: 4200, investments: [
              { name: 'CDB 100% CDI', value: 3000, rate: '100% CDI', maturity: 'Liq. Di\u00e1ria' },
              { name: 'LCA Prefixada', value: 1200, rate: '12.4% a.a.', maturity: '20/11/2027' }
            ]},
            { name: 'Nubank', total: 2800, investments: [
              { name: 'RDB', value: 2800, rate: '100% CDI', maturity: 'Liq. Di\u00e1ria' }
            ]},
            { name: 'Inter', total: 3000, investments: [
              { name: 'Tesouro Selic 2029', value: 3000, rate: 'Selic', maturity: '01/03/2029' }
            ]}
          ],
          variable: [
            { name: 'XP', total: 5000, investments: [
              { name: 'IVVB11', value: 2200, rate: '', maturity: '', ticker: 'IVVB11', quantity: 10 },
              { name: 'BOVA11', value: 1600, rate: '', maturity: '', ticker: 'BOVA11', quantity: 12 },
              { name: 'WEGE3', value: 1200, rate: '', maturity: '', ticker: 'WEGE3', quantity: 25 }
            ]}
          ],
          crypto: [
            { name: 'Binance', total: 5000, investments: [
              { name: 'Bitcoin', value: 3000, rate: '', maturity: '', ticker: 'BTC', quantity: 0.005 },
              { name: 'Ethereum', value: 1400, rate: '', maturity: '', ticker: 'ETH', quantity: 0.08 },
              { name: 'Solana', value: 600, rate: '', maturity: '', ticker: 'SOL', quantity: 3.5 }
            ]}
          ]
        }
      },
      {
        month: 1, year: 2026, date: '15/02/2026',
        aporte: 0, gain: 637, accGain: 637,
        categories: {
          fixed: [
            { name: 'PicPay', total: 4247, investments: [
              { name: 'CDB 100% CDI', value: 3035, rate: '100% CDI', maturity: 'Liq. Di\u00e1ria' },
              { name: 'LCA Prefixada', value: 1212, rate: '12.4% a.a.', maturity: '20/11/2027' }
            ]},
            { name: 'Nubank', total: 2833, investments: [
              { name: 'RDB', value: 2833, rate: '100% CDI', maturity: 'Liq. Di\u00e1ria' }
            ]},
            { name: 'Inter', total: 3037, investments: [
              { name: 'Tesouro Selic 2029', value: 3037, rate: 'Selic', maturity: '01/03/2029' }
            ]}
          ],
          variable: [
            { name: 'XP', total: 5340, investments: [
              { name: 'IVVB11', value: 2370, rate: '', maturity: '', ticker: 'IVVB11', quantity: 10 },
              { name: 'BOVA11', value: 1635, rate: '', maturity: '', ticker: 'BOVA11', quantity: 12 },
              { name: 'WEGE3', value: 1335, rate: '', maturity: '', ticker: 'WEGE3', quantity: 25 }
            ]}
          ],
          crypto: [
            { name: 'Binance', total: 5180, investments: [
              { name: 'Bitcoin', value: 3125, rate: '', maturity: '', ticker: 'BTC', quantity: 0.005 },
              { name: 'Ethereum', value: 1455, rate: '', maturity: '', ticker: 'ETH', quantity: 0.08 },
              { name: 'Solana', value: 600, rate: '', maturity: '', ticker: 'SOL', quantity: 3.5 }
            ]}
          ]
        }
      }
    ]
  };
}

async function init() {
  var sel = document.getElementById('f-month');
  MONTHS.forEach(function(m, i) { var o = document.createElement('option'); o.value = i; o.textContent = m; sel.appendChild(o); });
  document.getElementById('login-pw').addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  document.getElementById('export-pw2').addEventListener('keydown', function(e) { if (e.key === 'Enter') manualDownload(); });
  document.querySelectorAll('.modal-overlay').forEach(function(el) { if (el.id === 'modal-month') return; el.addEventListener('click', function(e) { if (e.target === el) el.classList.remove('show'); }); });

  showAuthScreen();
}

function startFresh() {
  ENCRYPTED_PAYLOAD = null;
  APP_PW = null;
  appData = getDummyData();
  showScreen('dashboard');
  renderDashboard();
}

function importDataFile(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    var text = reader.result.trim();
    if (!text) { alert('Arquivo vazio.'); return; }
    var m = text.match(/^var\s+ENCRYPTED_PAYLOAD\s*=\s*"(.+)"\s*;?\s*$/s);
    if (m) text = m[1];
    ENCRYPTED_PAYLOAD = text;
    var status = document.getElementById('auth-status');
    status.textContent = 'Dados importados (' + Math.round(ENCRYPTED_PAYLOAD.length / 1024) + 'KB)';
    status.style.color = 'var(--green)';
    showScreen('screen-auth');
    document.getElementById('login-pw').focus();
  };
  reader.readAsText(file);
  input.value = '';
}

async function doLogin() {
  var pw = document.getElementById('login-pw').value;
  if (!pw) return;
  document.getElementById('login-btn').textContent = 'Descriptografando...';
  try {
    appData = JSON.parse(await dec(ENCRYPTED_PAYLOAD, pw));
    APP_PW = pw;
    try { var t = localStorage.getItem('brapiToken'); if (t) BRAPI_TOKEN = t; } catch(e) {}
    appData.months.forEach(function(m) {
      if (m.brokers && !m.categories) {
        m.categories = { fixed: m.brokers, variable: [], crypto: [] };
        delete m.brokers;
        m.totalInvested = undefined;
      }
    });
    showScreen('dashboard');
    renderDashboard();
  } catch(e) {
    document.getElementById('login-err').style.display = 'block';
    document.getElementById('login-btn').textContent = 'Desbloquear';
  }
}

function showAuthScreen() {
  var hasData = !!ENCRYPTED_PAYLOAD;
  document.getElementById('auth-login').style.display = hasData ? 'block' : 'none';
  document.getElementById('auth-welcome').style.display = hasData ? 'none' : 'block';
  document.getElementById('auth-desc').textContent = hasData
    ? 'Dados encontrados. Digite sua senha para acessar.'
    : 'Bem-vindo! Crie um novo dashboard ou carregue seus dados.';
  if (hasData) {
    var status = document.getElementById('auth-status');
    status.textContent = 'Dados encontrados (' + Math.round(ENCRYPTED_PAYLOAD.length / 1024) + 'KB criptografados)';
    status.style.color = 'var(--green)';
    document.getElementById('login-pw').focus();
  } else {
    document.getElementById('auth-status').textContent = '';
  }
  showScreen('screen-auth');
}

function doClearBoard() {
  if (!confirm('Isso vai limpar todos os dados do dashboard atual. Deseja continuar?')) return;
  APP_PW = null;
  appData = { months: [] };
  selMonth = 0;
  selCat = 'all';
  renderDashboard();
}

function doLogout() {
  if (!confirm('Dados não salvos serão perdidos. Deseja sair?')) return;
  APP_PW = null;
  appData = { months: [] };
  selMonth = 0;
  selCat = 'all';
  editIdx = -1;
  document.getElementById('login-pw').value = '';
  document.getElementById('login-err').style.display = 'none';
  document.getElementById('login-btn').textContent = 'Desbloquear';
  showAuthScreen();
}

function openExport() {
  hideErr(document.getElementById('export-err'));
  hideErr(document.getElementById('export-ok'));
  document.getElementById('export-pw').value = '';
  document.getElementById('export-pw2').value = '';
  document.getElementById('payload-preview').textContent = appData.months.length + ' m\u00eas(es) de dados ser\u00e3o criptografados.';
  openModal('modal-export');
  document.getElementById('export-pw').focus();
}

function downloadDataFile() {
  if (!ENCRYPTED_PAYLOAD) return;
  var content = 'var ENCRYPTED_PAYLOAD = ' + JSON.stringify(ENCRYPTED_PAYLOAD) + ';\n';
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/javascript' }));
  a.download = 'data.js';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function manualDownload() {
  var pw = document.getElementById('export-pw').value;
  var pw2 = document.getElementById('export-pw2').value;
  var err = document.getElementById('export-err');
  hideErr(err);

  if (!pw || pw.length < 4) { showErr(err, 'Senha deve ter pelo menos 4 caracteres.'); return; }
  if (pw !== pw2) { showErr(err, 'As senhas n\u00e3o coincidem.'); return; }

  APP_PW = pw;
  ENCRYPTED_PAYLOAD = await enc(JSON.stringify(appData), APP_PW);
  downloadDataFile();

  var ok = document.getElementById('export-ok');
  ok.textContent = 'data.js baixado! Substitua no reposit\u00f3rio.';
  ok.style.display = 'block';
}
