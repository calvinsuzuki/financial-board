async function init() {
  const sel = document.getElementById('f-month');
  MONTHS.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; sel.appendChild(o); });
  document.getElementById('setup-pw2').addEventListener('keydown', e=>{ if(e.key==='Enter') doSetup(); });
  document.getElementById('login-pw').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.querySelectorAll('.modal-overlay').forEach(el=>{ el.addEventListener('click',e=>{ if(e.target===el) el.classList.remove('show'); }); });

  const status = document.getElementById('auth-status');

  if (ENCRYPTED_PAYLOAD) {
    status.textContent = 'Dados encontrados (' + Math.round(ENCRYPTED_PAYLOAD.length / 1024) + 'KB criptografados)';
    status.style.color = 'var(--green)';
  } else {
    status.textContent = 'Nenhum data.js detectado. Importe ou crie um novo.';
    status.style.color = 'var(--text-muted)';
  }

  showScreen('screen-auth');
  setAuthMode(ENCRYPTED_PAYLOAD ? 'login' : 'setup');
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('auth-icon').innerHTML = isLogin ? '&#128274;' : '&#128272;';
  document.getElementById('auth-desc').textContent = isLogin
    ? 'Digite sua senha para acessar seus dados financeiros'
    : 'Crie uma senha para proteger seus dados com criptografia AES-256.';
  document.getElementById('auth-login').style.display = isLogin ? 'block' : 'none';
  document.getElementById('auth-setup').style.display = isLogin ? 'none' : 'block';
  document.getElementById('import-label').textContent = isLogin ? 'Carregar outro data.js' : 'Importar data.js existente';
  const lbl = document.getElementById('import-label');
  if (!lbl.querySelector('input')) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.js,.json'; inp.style.display = 'none';
    inp.onchange = function() { importDataFile(this); };
    lbl.appendChild(inp);
  }
  if (isLogin) document.getElementById('login-pw').focus();
  else document.getElementById('setup-pw').focus();
}

function importDataFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    let text = reader.result.trim();
    if (!text) { alert('Arquivo vazio.'); return; }
    const m = text.match(/^var\s+ENCRYPTED_PAYLOAD\s*=\s*"(.+)"\s*;?\s*$/s);
    if (m) text = m[1];
    ENCRYPTED_PAYLOAD = text;
    setAuthMode('login');
  };
  reader.readAsText(file);
  input.value = '';
}

async function doSetup() {
  const pw=document.getElementById('setup-pw').value, pw2=document.getElementById('setup-pw2').value, err=document.getElementById('setup-err');
  if(!pw||pw.length<4){showErr(err,'Senha deve ter pelo menos 4 caracteres.');return;}
  if(pw!==pw2){showErr(err,'As senhas n\u00e3o coincidem.');return;}
  APP_PW=pw; appData={months:[]};
  ENCRYPTED_PAYLOAD = await enc(JSON.stringify(appData), APP_PW);
  showScreen('dashboard'); renderDashboard();
}
async function doLogin() {
  const pw=document.getElementById('login-pw').value; if(!pw) return;
  document.getElementById('login-btn').textContent='Descriptografando...';
  try {
    appData=JSON.parse(await dec(ENCRYPTED_PAYLOAD,pw)); APP_PW=pw;
    appData.months.forEach(m => {
      if (m.brokers && !m.categories) {
        m.categories = { fixed: m.brokers, variable: [], crypto: [] };
        delete m.brokers;
        m.totalInvested = undefined;
      }
    });
    showScreen('dashboard'); renderDashboard();
  } catch(e) {
    document.getElementById('login-err').style.display='block';
    document.getElementById('login-btn').textContent='Desbloquear';
  }
}

function openExport() {
  hideErr(document.getElementById('export-ok'));
  const prev = document.getElementById('payload-preview');
  if (ENCRYPTED_PAYLOAD) {
    prev.textContent = ENCRYPTED_PAYLOAD.slice(0, 200) + '... (' + ENCRYPTED_PAYLOAD.length + ' chars)';
  } else {
    prev.textContent = '(sem dados)';
  }
  openModal('modal-export');
}
function downloadDataFile() {
  if (!ENCRYPTED_PAYLOAD) return;
  const content = 'var ENCRYPTED_PAYLOAD = ' + JSON.stringify(ENCRYPTED_PAYLOAD) + ';\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/javascript' }));
  a.download = 'data.js'; a.click();
  URL.revokeObjectURL(a.href);
}
function manualDownload() {
  downloadDataFile();
  const ok = document.getElementById('export-ok');
  ok.textContent = 'data.js baixado! Substitua no reposit\u00f3rio.'; ok.style.display = 'block';
}
