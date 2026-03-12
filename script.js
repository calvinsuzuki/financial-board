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

let APP_PW = null;
let appData = { months: [] };
/*
  appData.months[i] = {
    month: 0-11, year: 2026, date: "dd/mm/aaaa",
    aporte: 1500, gain: 600, accGain: 2533.48,
    categories: {
      fixed:    [{ name: "PicPay", total: 52535.76, investments: [{ name, value, rate, maturity }] }],
      variable: [{ name: "XP HB", total: 5000, investments: [...] }],
      crypto:   [{ name: "Binance", total: 3434.97, investments: [...] }]
    }
  }
*/
let selMonth = 0;
let selCat = 'all';
let editIdx = -1;
let deleteIdx = -1;
let chartEvo = null, chartDist = null;

// ========================= CRYPTO =========================
async function deriveKey(pw, salt) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name:"PBKDF2", salt, iterations:310000, hash:"SHA-256" }, km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
}
async function enc(text, pw) {
  const s = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await deriveKey(pw, s);
  const ct = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, k, new TextEncoder().encode(text));
  const b = new Uint8Array(28 + ct.byteLength); b.set(s,0); b.set(iv,16); b.set(new Uint8Array(ct),28);
  return btoa(String.fromCharCode(...b));
}
async function dec(b64, pw) {
  const b = Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
  const k = await deriveKey(pw, b.slice(0,16));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:b.slice(16,28) }, k, b.slice(28)));
}
async function saveData() {
  ENCRYPTED_PAYLOAD = await enc(JSON.stringify(appData), APP_PW);
  // Auto-download data.json every save
  downloadDataFile();
}

// ========================= HELPERS =========================
function parseR(s) { if(!s) return 0; s=String(s).replace('R$','').replace(/\s/g,'').replace(/\./g,'').replace(',','.'); return parseFloat(s)||0; }
function fmtR(v) { return 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtI(v) { if(!v&&v!==0) return ''; return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(v) { return (v>=0?'+':'')+v.toFixed(2)+'%'; }
function showErr(el,m) { el.textContent=m; el.style.display='block'; }
function hideErr(el) { el.style.display='none'; }
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function showScreen(id) {
  document.querySelectorAll('.screen,.screen-center').forEach(e=>e.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Date helpers: parse "dd/mm/yyyy" -> Date, and days between two dates
function parseDate(s) {
  if(!s) return null;
  const p=s.split('/'); if(p.length!==3) return null;
  const d=new Date(parseInt(p[2]),parseInt(p[1])-1,parseInt(p[0]));
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(d1,d2) { return Math.round(Math.abs(d2-d1)/(1000*60*60*24)); }
function annualize(pct, days) { if(!days||days<=0) return 0; return (Math.pow(1+pct/100, 365/days)-1)*100; }

function getMonthTotal(m, cat) {
  if (cat === 'all') return CATEGORIES.reduce((sum, c) => sum + (m.categories[c.id]||[]).reduce((s,b)=>s+b.total,0), 0);
  return (m.categories[cat]||[]).reduce((s,b)=>s+b.total,0);
}

// Find previous month entry for a given month entry (by index in sorted array)
function getPrev(idx) { return idx > 0 ? appData.months[idx-1] : null; }

// Find matching previous investment by broker name + investment name
function findPrevInv(prev, catId, brokerName, invName) {
  if(!prev) return null;
  const broker = (prev.categories[catId]||[]).find(b=>b.name===brokerName);
  if(!broker) return null;
  return (broker.investments||[]).find(i=>i.name===invName) || null;
}
function findPrevBroker(prev, catId, brokerName) {
  if(!prev) return null;
  return (prev.categories[catId]||[]).find(b=>b.name===brokerName) || null;
}

// Track which month we're cloning from in the form
let formPrevMonth = null;

// ========================= INIT =========================
async function init() {
  const sel = document.getElementById('f-month');
  MONTHS.forEach((m,i) => { const o=document.createElement('option'); o.value=i; o.textContent=m; sel.appendChild(o); });
  document.getElementById('setup-pw2').addEventListener('keydown', e=>{ if(e.key==='Enter') doSetup(); });
  document.getElementById('login-pw').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  document.querySelectorAll('.modal-overlay').forEach(el=>{ el.addEventListener('click',e=>{ if(e.target===el) el.classList.remove('show'); }); });

  // ENCRYPTED_PAYLOAD is loaded via <script src="data.js"> (works on file:// and https://)
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
  // Re-add the hidden file input since textContent wipes it
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

// ========================= IMPORT =========================
function importDataFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function() {
    let text = reader.result.trim();
    if (!text) { alert('Arquivo vazio.'); return; }
    // Handle data.js format: extract payload from var assignment
    const m = text.match(/^var\s+ENCRYPTED_PAYLOAD\s*=\s*"(.+)"\s*;?\s*$/s);
    if (m) text = m[1];
    ENCRYPTED_PAYLOAD = text;
    setAuthMode('login');
  };
  reader.readAsText(file);
  input.value = '';
}

// ========================= SETUP & LOGIN =========================
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
    // Migrate old data format (brokers -> categories)
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

// ========================= CATEGORY FILTER =========================
function filterCat(cat) {
  selCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  renderSummary();
  renderCharts();
  renderDetail();
  renderTable();
}

// ========================= ADD/EDIT MONTH =========================
function openAddMonth() {
  editIdx = -1;
  document.getElementById('modal-month-title').textContent = 'Adicionar M\u00eas';
  hideErr(document.getElementById('month-err'));
  ['fixed','variable','crypto'].forEach(c => document.getElementById('brokers-'+c).innerHTML = '');

  const prev = appData.months.length > 0 ? appData.months[appData.months.length - 1] : null;
  formPrevMonth = prev;

  if (prev) {
    // Auto-advance to next month
    let nm = prev.month + 1, ny = prev.year;
    if (nm > 11) { nm = 0; ny++; }
    document.getElementById('f-month').value = nm;
    document.getElementById('f-year').value = ny;
    document.getElementById('f-date').value = '';
    document.getElementById('f-aporte').value = '';

    // Clone all brokers/investments from previous month
    CATEGORIES.forEach(cat => {
      (prev.categories[cat.id]||[]).forEach(b => {
        addBrokerSection(cat.id, b.name);
        const container = document.getElementById('brokers-'+cat.id);
        const sec = container.lastElementChild;
        sec.querySelector('.broker-name-input').value = b.name;
        const rows = sec.querySelector('.inv-rows');
        rows.innerHTML = '';
        (b.investments||[]).forEach(inv => addInvRow(rows, inv, inv.value));
      });
    });
  } else {
    document.getElementById('f-month').value = new Date().getMonth();
    document.getElementById('f-year').value = new Date().getFullYear();
    document.getElementById('f-date').value = '';
    document.getElementById('f-aporte').value = '';
    ['Nubank','PicPay','Inter','XP'].forEach(b => addBrokerSection('fixed', b));
    addBrokerSection('variable', '');
    addBrokerSection('crypto', '');
    formPrevMonth = null;
  }

  recalcForm();
  openModal('modal-month');
}

function openEditMonth(idx) {
  editIdx = idx;
  const m = appData.months[idx];
  formPrevMonth = getPrev(idx);
  document.getElementById('modal-month-title').textContent = 'Editar '+MONTHS[m.month]+' '+m.year;
  document.getElementById('f-month').value = m.month;
  document.getElementById('f-year').value = m.year;
  document.getElementById('f-date').value = m.date||'';
  document.getElementById('f-aporte').value = fmtI(m.aporte);
  hideErr(document.getElementById('month-err'));
  ['fixed','variable','crypto'].forEach(catId => {
    const container = document.getElementById('brokers-'+catId);
    container.innerHTML = '';
    (m.categories[catId]||[]).forEach(b => {
      addBrokerSection(catId, b.name);
      const sec = container.lastElementChild;
      sec.querySelector('.broker-name-input').value = b.name;
      const rows = sec.querySelector('.inv-rows');
      rows.innerHTML = '';
      (b.investments||[]).forEach(inv => {
        const pi = findPrevInv(formPrevMonth, catId, b.name, inv.name);
        addInvRow(rows, inv, pi ? pi.value : null);
      });
    });
  });
  recalcForm();
  openModal('modal-month');
}

function addBrokerSection(catId, name) {
  const container = document.getElementById('brokers-'+catId);
  const div = document.createElement('div');
  div.className = 'form-section';
  const label = catId==='crypto'?'Exchange':'Corretora';
  div.innerHTML = `
    <h4>
      <span style="display:flex;align-items:center;gap:8px;">
        <span>${label}:</span>
        <input type="text" class="broker-name-input" value="${name||''}" placeholder="Ex: Nubank" style="background:transparent;border:none;color:var(--text);font-size:15px;font-weight:700;padding:0;width:140px;outline:none;">
        <span class="broker-auto-total" style="font-size:13px;color:var(--green);font-weight:700;margin-left:auto;white-space:nowrap;">R$ 0,00</span>
      </span>
      <button class="btn-sm danger" onclick="this.closest('.form-section').remove();recalcForm();" style="width:auto;">&times;</button>
    </h4>
    <div class="inv-rows"></div>
    <button class="add-inv-btn" onclick="addInvRow(this.previousElementSibling)">+ Adicionar investimento</button>
  `;
  container.appendChild(div);
  addInvRow(div.querySelector('.inv-rows'));
}

function calcBrokerTotal(sec) {
  let sum = 0;
  sec.querySelectorAll('.inv-val').forEach(inp => { sum += parseR(inp.value); });
  return sum;
}

function updateBrokerTotals() {
  document.querySelectorAll('#broker-forms .form-section, #brokers-fixed .form-section, #brokers-variable .form-section, #brokers-crypto .form-section').forEach(sec => {
    const total = calcBrokerTotal(sec);
    const el = sec.querySelector('.broker-auto-total');
    if (el) el.textContent = fmtR(total);
  });
}

function addInvRow(container, d, prevValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'inv-entry';
  const pv = prevValue != null ? prevValue : '';

  // Parse existing rate to detect type
  let rateType = '', rateVal = '', matVal = d?.maturity||'';
  if (d && d.rate) {
    const r = d.rate;
    if (/ipca/i.test(r)) { rateType = 'ipca'; rateVal = r.replace(/.*IPCA\s*\+?\s*/i,'').replace('%','').trim(); }
    else if (/%\s*CDI/i.test(r) || /p[oó]s/i.test(r)) { rateType = 'pos'; rateVal = r.replace(/%?\s*CDI.*/i,'').trim(); }
    else if (/vari[aá]vel/i.test(r) || rateType === '') {
      if (/\d/.test(r) && /%/.test(r) && !/CDI/i.test(r) && !/IPCA/i.test(r)) { rateType = 'pre'; rateVal = r.replace(/%.*$/,'').replace(/a\.a\.?/i,'').trim(); }
      else if (/vari[aá]vel/i.test(r)) { rateType = 'var'; }
      else { rateType = 'pos'; rateVal = r.replace(/%?\s*CDI.*/i,'').trim(); }
    }
  }

  const uid = 'inv-' + Math.random().toString(36).slice(2,8);

  wrapper.innerHTML = `
    <div class="inv-form-row">
      <div class="input-group"><label>Nome</label><input type="text" class="inv-name" value="${d?.name||''}" placeholder="CDB, LCI, A\u00e7\u00e3o..."></div>
      <div class="input-group"><label>Valor (R$)</label><input type="text" class="inv-val" value="${d?fmtI(d.value):''}" placeholder="16.186,49" data-prev="${pv}" oninput="recalcForm()">
        ${pv!==''?`<div class="prev-hint">Anterior: <span class="prev-val">${fmtR(pv)}</span></div>`:''}</div>
      <button class="btn-sm danger" onclick="this.closest('.inv-entry').remove();recalcForm();" style="margin-bottom:0;">&times;</button>
    </div>
    <div class="inv-form-extra">
      <div class="rate-pills" data-uid="${uid}">
        <button type="button" class="rate-pill ${rateType==='pre'?'active':''}" data-t="pre" onclick="pickRate(this)" title="Pr\u00e9-fixado">PR\u00c9</button>
        <button type="button" class="rate-pill ${rateType==='pos'?'active':''}" data-t="pos" onclick="pickRate(this)" title="P\u00f3s-fixado (CDI)">P\u00d3S</button>
        <button type="button" class="rate-pill ${rateType==='ipca'?'active':''}" data-t="ipca" onclick="pickRate(this)" title="IPCA+">IPCA</button>
        <button type="button" class="rate-pill ${rateType==='var'?'active':''}" data-t="var" onclick="pickRate(this)" title="Vari\u00e1vel">VAR</button>
      </div>
      <div class="input-group" style="margin:0;" id="${uid}-rate-wrap">
        ${rateType==='var'?'':`<input type="text" class="inv-rate-val" value="${rateVal}" placeholder="${ratePlaceholder(rateType)}" style="padding:7px 10px;font-size:12px;">`}
      </div>
      <div class="input-group" style="margin:0;">
        <input type="text" class="inv-mat" value="${matVal}" placeholder="Venc. 07/2027" style="padding:7px 10px;font-size:12px;">
      </div>
    </div>
  `;
  container.appendChild(wrapper);
}

function ratePlaceholder(t) {
  if(t==='pre') return '% a.a. (ex: 14,36)';
  if(t==='pos') return '% CDI (ex: 102)';
  if(t==='ipca') return 'IPCA + % (ex: 6,5)';
  return '';
}

function pickRate(btn) {
  const pills = btn.closest('.rate-pills');
  const uid = pills.dataset.uid;
  const wasActive = btn.classList.contains('active');
  pills.querySelectorAll('.rate-pill').forEach(p=>p.classList.remove('active'));

  const wrap = document.getElementById(uid+'-rate-wrap');
  if (wasActive) {
    // Deselect
    wrap.innerHTML = '<input type="text" class="inv-rate-val" value="" placeholder="Taxa" style="padding:7px 10px;font-size:12px;">';
    return;
  }

  btn.classList.add('active');
  const t = btn.dataset.t;
  if (t==='var') {
    wrap.innerHTML = '<span style="font-size:11px;color:var(--text-muted);padding:4px;">Sem taxa fixa</span>';
  } else {
    const prev = wrap.querySelector('.inv-rate-val');
    const prevVal = prev ? prev.value : '';
    wrap.innerHTML = `<input type="text" class="inv-rate-val" value="${prevVal}" placeholder="${ratePlaceholder(t)}" style="padding:7px 10px;font-size:12px;">`;
  }
}

function readInvRate(entry) {
  const pills = entry.querySelector('.rate-pills');
  const active = pills ? pills.querySelector('.rate-pill.active') : null;
  const valInput = entry.querySelector('.inv-rate-val');
  const rv = valInput ? valInput.value.trim() : '';
  if (!active) return rv || '';
  const t = active.dataset.t;
  if (t==='pre') return rv ? rv+'% a.a.' : 'Pr\u00e9-fixado';
  if (t==='pos') return rv ? rv+'% CDI' : 'P\u00f3s-fixado';
  if (t==='ipca') return rv ? 'IPCA + '+rv+'%' : 'IPCA+';
  if (t==='var') return 'Vari\u00e1vel';
  return rv;
}

// Real-time form recalculation
function recalcForm() {
  updateBrokerTotals();
  const bar = document.getElementById('calc-bar');
  if (!formPrevMonth) { bar.style.display='none'; return; }

  const aporte = parseR(document.getElementById('f-aporte').value);
  const date = document.getElementById('f-date').value.trim();

  // Sum current totals from investment values
  let currentTotal = 0;
  CATEGORIES.forEach(cat => {
    document.querySelectorAll('#brokers-'+cat.id+' .form-section').forEach(sec => {
      currentTotal += calcBrokerTotal(sec);
    });
  });

  const prevTotal = getMonthTotal(formPrevMonth, 'all');
  const gain = currentTotal - prevTotal - aporte;
  const prevAcc = formPrevMonth.accGain || 0;
  const accGain = prevAcc + gain;
  const pctMonth = prevTotal > 0 ? (gain / prevTotal * 100) : 0;

  // Days-based annualization
  const curDate = parseDate(date);
  const prevDate = parseDate(formPrevMonth.date);
  const days = (curDate && prevDate) ? daysBetween(prevDate, curDate) : 0;
  const annPct = days > 0 ? annualize(pctMonth, days) : 0;

  document.getElementById('calc-gain').textContent = fmtR(gain);
  document.getElementById('calc-gain').style.color = gain >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('calc-acc').textContent = fmtR(accGain);
  document.getElementById('calc-pct').textContent = fmtPct(pctMonth);
  document.getElementById('calc-ann').textContent = days > 0 ? fmtPct(annPct) : '--';
  document.getElementById('calc-days').textContent = days > 0
    ? `Calculado com base em ${days} dias entre ${formPrevMonth.date} e ${date}`
    : 'Preencha a data de refer\u00eancia para calcular retorno anualizado';
  bar.style.display = 'block';
}

async function saveMonth() {
  const err = document.getElementById('month-err');
  const month = parseInt(document.getElementById('f-month').value);
  const year = parseInt(document.getElementById('f-year').value);
  const date = document.getElementById('f-date').value.trim();
  const aporte = parseR(document.getElementById('f-aporte').value);

  const categories = {};
  let currentTotal = 0;
  CATEGORIES.forEach(cat => {
    categories[cat.id] = [];
    document.querySelectorAll('#brokers-'+cat.id+' .form-section').forEach(sec => {
      const bName = sec.querySelector('.broker-name-input').value.trim();
      if (!bName) return;
      const investments = [];
      let bTotal = 0;
      sec.querySelectorAll('.inv-entry').forEach(entry => {
        const name = entry.querySelector('.inv-name').value.trim();
        const value = parseR(entry.querySelector('.inv-val').value);
        const rate = readInvRate(entry);
        const mat = entry.querySelector('.inv-mat');
        const maturity = mat ? mat.value.trim() : '';
        if (name || value) { investments.push({ name, value, rate, maturity }); bTotal += value; }
      });
      currentTotal += bTotal;
      categories[cat.id].push({ name: bName, total: bTotal, investments });
    });
  });

  // Auto-calculate gain and accumulated gain
  let gain = 0, accGain = 0;
  if (formPrevMonth) {
    const prevTotal = getMonthTotal(formPrevMonth, 'all');
    gain = currentTotal - prevTotal - aporte;
    accGain = (formPrevMonth.accGain || 0) + gain;
  }

  const entry = { month, year, date, aporte, gain, accGain, categories };

  if (editIdx >= 0) {
    appData.months[editIdx] = entry;
  } else {
    if (appData.months.some(m => m.month===month && m.year===year)) {
      showErr(err, 'J\u00e1 existe registro para '+MONTHS[month]+'/'+year+'.'); return;
    }
    appData.months.push(entry);
  }
  appData.months.sort((a,b) => (a.year*12+a.month)-(b.year*12+b.month));

  // Recalculate accumulated gains for all months after this one
  for (let i = 1; i < appData.months.length; i++) {
    const cur = appData.months[i], prev = appData.months[i-1];
    const curT = getMonthTotal(cur, 'all'), prevT = getMonthTotal(prev, 'all');
    cur.gain = curT - prevT - (cur.aporte||0);
    cur.accGain = (prev.accGain||0) + cur.gain;
  }

  await saveData();
  closeModal('modal-month');
  selMonth = appData.months.findIndex(m => m.month===month && m.year===year);
  if (selMonth < 0) selMonth = appData.months.length - 1;
  renderDashboard();
}

function openDeleteMonth(idx) {
  deleteIdx = idx; const m = appData.months[idx];
  document.getElementById('delete-msg').textContent = 'Excluir '+MONTHS[m.month]+' '+m.year+'?';
  openModal('modal-delete');
}
async function confirmDelete() {
  if(deleteIdx>=0) { appData.months.splice(deleteIdx,1); await saveData(); selMonth=Math.max(0,appData.months.length-1); renderDashboard(); }
  closeModal('modal-delete');
}

// ========================= EXPORT =========================
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

// ========================= RENDER =========================
function renderDashboard() {
  const m = appData.months;
  if (!m.length) {
    ['summary-grid','month-tabs','detail-area','comparison-table'].forEach(id=>document.getElementById(id).innerHTML='');
    document.getElementById('charts-area').style.display='none';
    document.getElementById('table-area').style.display='none';
    document.getElementById('empty-state').style.display='block';
    return;
  }
  document.getElementById('empty-state').style.display='none';
  document.getElementById('charts-area').style.display='';
  document.getElementById('table-area').style.display='';
  if(selMonth>=m.length) selMonth=m.length-1;
  renderSummary(); renderMonthTabs(); renderCharts(); renderDetail(); renderTable();
}

function renderSummary() {
  const m = appData.months, cur = m[selMonth], prev = getPrev(selMonth);
  const total = getMonthTotal(cur, selCat);
  const prevTotal = prev ? getMonthTotal(prev, selCat) : 0;
  const growth = prev && prevTotal ? ((total-prevTotal)/prevTotal*100) : 0;

  const curDate = parseDate(cur.date);
  const prevDate = prev ? parseDate(prev.date) : null;
  const days = (curDate && prevDate) ? daysBetween(prevDate, curDate) : 0;
  const gainPct = prevTotal > 0 ? (cur.gain / prevTotal * 100) : 0;
  const annPct = days > 0 ? annualize(gainPct, days) : 0;

  const fixedTotal = (cur.categories.fixed||[]).reduce((s,b)=>s+b.total,0);
  const varTotal = (cur.categories.variable||[]).reduce((s,b)=>s+b.total,0);
  const cryptoTotal = (cur.categories.crypto||[]).reduce((s,b)=>s+b.total,0);

  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-card">
      <div class="label">${selCat==='all'?'Total Investido':CAT_MAP[selCat].name}</div>
      <div class="value">${fmtR(total)}</div>
      ${prev?`<div class="sub ${growth>=0?'positive':'negative'}">${growth>=0?'\u25B2':'\u25BC'} ${Math.abs(growth).toFixed(2)}% vs anterior</div>`:''}
    </div>
    <div class="summary-card">
      <div class="label">Rendimento Mensal</div>
      <div class="value ${cur.gain>=0?'positive':'negative'}">${fmtR(cur.gain)}</div>
      <div class="sub ${gainPct>=0?'positive':'negative'}">${prev?fmtPct(gainPct):''}</div>
    </div>
    <div class="summary-card">
      <div class="label">Retorno Anualizado</div>
      <div class="value ${annPct>=0?'positive':'negative'}">${days>0?fmtPct(annPct):'--'}</div>
      <div class="sub" style="color:var(--text-muted)">${days>0?days+' dias | '+cur.date:cur.date||'Sem data'}</div>
    </div>
    <div class="summary-card">
      <div class="label">Renda Fixa</div>
      <div class="value" style="color:var(--blue)">${fmtR(fixedTotal)}</div>
      <div class="sub" style="color:var(--text-muted)">${total?(fixedTotal/total*100).toFixed(1)+'%':'0%'} do total</div>
    </div>
    <div class="summary-card">
      <div class="label">Renda Vari&aacute;vel</div>
      <div class="value" style="color:var(--orange)">${fmtR(varTotal)}</div>
      <div class="sub" style="color:var(--text-muted)">${total?(varTotal/total*100).toFixed(1)+'%':'0%'} do total</div>
    </div>
    <div class="summary-card">
      <div class="label">Crypto</div>
      <div class="value" style="color:var(--yellow)">${fmtR(cryptoTotal)}</div>
      <div class="sub" style="color:var(--text-muted)">${total?(cryptoTotal/total*100).toFixed(1)+'%':'0%'} do total</div>
    </div>
    <div class="summary-card">
      <div class="label">Aporte</div>
      <div class="value" style="color:var(--accent-light)">${fmtR(cur.aporte)}</div>
      <div class="sub" style="color:var(--text-muted)">Acum: ${fmtR(cur.accGain)}</div>
    </div>
  `;
}

function renderMonthTabs() {
  document.getElementById('month-tabs').innerHTML = appData.months.map((m,i) =>
    `<button class="month-tab ${i===selMonth?'active':''}" onclick="selectMonth(${i})">${MONTHS[m.month].slice(0,3)}/${m.year}</button>`
  ).join('') +
  `<button class="month-tab" style="color:var(--accent-light);border-style:dashed;" onclick="openEditMonth(${selMonth})">Editar</button>
   <button class="month-tab" style="color:var(--red);border-style:dashed;" onclick="openDeleteMonth(${selMonth})">Excluir</button>`;
}

function selectMonth(i) { selMonth=i; renderSummary(); renderMonthTabs(); updateDistChart(); renderDetail(); }

function renderCharts() {
  const ctx1 = document.getElementById('chart-evolution').getContext('2d');
  if(chartEvo) chartEvo.destroy();
  const labels = appData.months.map(m=>MONTHS[m.month].slice(0,3)+'/'+m.year);

  const datasets = [];
  if (selCat==='all') {
    datasets.push({
      label:'Total', data: appData.months.map(m=>getMonthTotal(m,'all')),
      borderColor:'#6c5ce7', backgroundColor:'rgba(108,92,231,0.1)', fill:true, tension:0.3, pointRadius:5, borderWidth:3
    });
    CATEGORIES.forEach(c => {
      datasets.push({
        label:c.name, data: appData.months.map(m=>getMonthTotal(m,c.id)),
        borderColor:c.color, backgroundColor:'transparent', tension:0.3, pointRadius:4, borderWidth:2, borderDash:[5,5]
      });
    });
  } else {
    datasets.push({
      label:CAT_MAP[selCat].name, data: appData.months.map(m=>getMonthTotal(m,selCat)),
      borderColor:CAT_MAP[selCat].color, backgroundColor:CAT_MAP[selCat].color+'22', fill:true, tension:0.3, pointRadius:5, borderWidth:3
    });
  }

  chartEvo = new Chart(ctx1, {
    type:'line', data:{labels, datasets},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:'#8b8fa3',padding:16}}, tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmtR(c.parsed.y)}} },
      scales:{
        x:{ticks:{color:'#8b8fa3'},grid:{color:'rgba(255,255,255,0.05)'}},
        y:{ticks:{color:'#8b8fa3',callback:v=>fmtR(v)},grid:{color:'rgba(255,255,255,0.05)'}}
      }
    }
  });
  updateDistChart();
}

function updateDistChart() {
  const ctx2 = document.getElementById('chart-brokers').getContext('2d');
  if(chartDist) chartDist.destroy();
  const cur = appData.months[selMonth];

  let data, title;
  if (selCat==='all') {
    // Show category distribution
    title = 'Distribui\u00e7\u00e3o por Categoria';
    data = CATEGORIES.map(c => ({ name:c.name, value:getMonthTotal(cur,c.id), color:c.color })).filter(d=>d.value>0);
  } else {
    // Show broker distribution within category
    title = 'Distribui\u00e7\u00e3o por Corretora';
    data = (cur.categories[selCat]||[]).filter(b=>b.total>0).map((b,i)=>({
      name:b.name, value:b.total, color:defaultBrokerColors[i%defaultBrokerColors.length]
    }));
  }
  document.getElementById('chart-dist-title').textContent = title;

  if(!data.length) { chartDist=null; return; }
  chartDist = new Chart(ctx2, {
    type:'doughnut',
    data:{ labels:data.map(d=>d.name), datasets:[{data:data.map(d=>d.value),backgroundColor:data.map(d=>d.color),borderColor:'#1a1d2e',borderWidth:3,hoverOffset:8}] },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'65%',
      plugins:{
        legend:{position:'bottom',labels:{color:'#8b8fa3',padding:16,usePointStyle:true}},
        tooltip:{callbacks:{label:c=>{const t=c.dataset.data.reduce((a,b)=>a+b,0);return c.label+': '+fmtR(c.parsed)+' ('+(c.parsed/t*100).toFixed(1)+'%)';}}}
      }
    }
  });
}

function renderDetail() {
  const cur = appData.months[selMonth];
  const prev = getPrev(selMonth);
  const curDate = parseDate(cur.date);
  const prevDate = prev ? parseDate(prev.date) : null;
  const days = (curDate && prevDate) ? daysBetween(prevDate, curDate) : 0;
  const area = document.getElementById('detail-area');
  let html = '';

  const catsToShow = selCat==='all' ? CATEGORIES : [CAT_MAP[selCat]];

  catsToShow.forEach(cat => {
    const brokers = cur.categories[cat.id] || [];
    if (!brokers.length || !brokers.some(b=>b.total>0)) return;

    html += `<div class="section-title">${cat.name} <span class="section-badge" style="background:${cat.color}22;color:${cat.color}">${fmtR(getMonthTotal(cur,cat.id))}</span></div>`;
    html += '<div class="broker-grid">';

    brokers.forEach((b,i) => {
      if(b.total<=0) return;
      const color = defaultBrokerColors[i%defaultBrokerColors.length];
      const prevB = findPrevBroker(prev, cat.id, b.name);
      const brokerGain = prevB ? b.total - prevB.total : 0;
      const brokerPct = prevB && prevB.total > 0 ? (brokerGain / prevB.total * 100) : 0;
      const brokerAnn = days > 0 ? annualize(brokerPct, days) : 0;

      html += `<div class="broker-card" style="border-top:3px solid ${color}">
        <div class="broker-header">
          <div><span class="broker-name">${b.name}</span>
            ${prevB ? `<div class="broker-gain">${brokerGain>=0?'+':''}${fmtR(brokerGain)} (${fmtPct(brokerPct)}${days>0?' | '+fmtPct(brokerAnn)+' a.a.':''})</div>` : ''}
          </div>
          <span class="broker-total">${fmtR(b.total)}</span>
        </div>`;

      (b.investments||[]).forEach(inv => {
        if(!inv.name&&!inv.value) return;
        const pi = findPrevInv(prev, cat.id, b.name, inv.name);
        const invGain = pi ? inv.value - pi.value : 0;
        const invPct = pi && pi.value > 0 ? (invGain / pi.value * 100) : 0;
        const invAnn = (pi && days > 0) ? annualize(invPct, days) : 0;

        html += `<div class="investment-row">
          <div>
            <div class="inv-name">${inv.name}${pi?`<span class="gain-badge ${invGain>=0?'pos':'neg'}">${fmtPct(invPct)}</span>`:''}</div>
            <div class="inv-details">${inv.rate||''}${inv.maturity?' | Venc: '+inv.maturity:''}</div>
          </div>
          <div>
            <div class="inv-value">${fmtR(inv.value)}</div>
            ${pi?`<div class="inv-gain"><span class="pct ${invGain>=0?'positive':'negative'}">${invGain>=0?'+':''}${fmtR(invGain)}</span>${days>0?`<div class="ann">${fmtPct(invAnn)} a.a.</div>`:''}</div>`:''}
          </div>
        </div>`;
      });
      html += '</div>';
    });
    html += '</div>';
  });

  area.innerHTML = html;
}

function renderTable() {
  const months = appData.months;
  let html = '<table><thead><tr><th>M\u00eas</th><th>Data</th><th>Total</th>';
  CATEGORIES.forEach(c => html += `<th style="color:${c.color}">${c.name}</th>`);
  html += '<th>Rend. R$</th><th>Rend. %</th><th>% a.a.</th><th>Acum.</th></tr></thead><tbody>';

  months.forEach((m, idx) => {
    const total = getMonthTotal(m,'all');
    const prev = getPrev(idx);
    const prevTotal = prev ? getMonthTotal(prev,'all') : 0;
    const pctMonth = prevTotal > 0 ? (m.gain / prevTotal * 100) : 0;
    const curDate = parseDate(m.date);
    const prevDate = prev ? parseDate(prev.date) : null;
    const days = (curDate && prevDate) ? daysBetween(prevDate, curDate) : 0;
    const annPct = days > 0 ? annualize(pctMonth, days) : 0;

    html += `<tr>
      <td><strong>${MONTHS[m.month].slice(0,3)}/${m.year}</strong></td>
      <td style="font-size:12px;color:var(--text-muted)">${m.date||'-'}</td>
      <td><strong>${fmtR(total)}</strong></td>`;
    CATEGORIES.forEach(c => html += `<td>${fmtR(getMonthTotal(m,c.id))}</td>`);
    html += `<td class="${m.gain>=0?'positive':'negative'}">${fmtR(m.gain)}</td>`;
    html += `<td class="${pctMonth>=0?'positive':'negative'}">${prev?fmtPct(pctMonth):'-'}</td>`;
    html += `<td style="color:var(--text-muted)">${days>0?fmtPct(annPct):'-'}</td>`;
    html += `<td class="positive">${fmtR(m.accGain)}</td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('comparison-table').innerHTML = html;
}

init();
