function autoFillDate() {
  const m = parseInt(document.getElementById('f-month').value);
  const y = parseInt(document.getElementById('f-year').value);
  const now = new Date();
  let day;
  if (m === now.getMonth() && y === now.getFullYear()) {
    day = now.getDate();
  } else {
    day = new Date(y, m + 1, 0).getDate();
  }
  const dd = String(day).padStart(2, '0');
  const mm = String(m + 1).padStart(2, '0');
  document.getElementById('f-date').value = dd + '/' + mm + '/' + y;
  recalcForm();
}

function openAddMonth() {
  editIdx = -1;
  document.getElementById('modal-month-title').textContent = 'Adicionar M\u00eas';
  hideErr(document.getElementById('month-err'));
  document.getElementById('brokers-all').innerHTML = '';

  const prev = appData.months.length > 0 ? appData.months[appData.months.length - 1] : null;
  formPrevMonth = prev;

  if (prev) {
    let nm = prev.month + 1, ny = prev.year;
    if (nm > 11) { nm = 0; ny++; }
    document.getElementById('f-month').value = nm;
    document.getElementById('f-year').value = ny;
    document.getElementById('f-aporte').value = '';

    CATEGORIES.forEach(cat => {
      (prev.categories[cat.id]||[]).forEach(b => {
        addBrokerSection(cat.id, b.name);
        const container = document.getElementById('brokers-all');
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
    document.getElementById('f-aporte').value = '';
    addBrokerSection();
    formPrevMonth = null;
  }

  autoFillDate();
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
  const container = document.getElementById('brokers-all');
  container.innerHTML = '';
  CATEGORIES.forEach(cat => {
    (m.categories[cat.id]||[]).forEach(b => {
      addBrokerSection(cat.id, b.name);
      const sec = container.lastElementChild;
      sec.querySelector('.broker-name-input').value = b.name;
      const rows = sec.querySelector('.inv-rows');
      rows.innerHTML = '';
      (b.investments||[]).forEach(inv => {
        const pi = findPrevInv(formPrevMonth, cat.id, b.name, inv.name);
        addInvRow(rows, inv, pi ? pi.value : null);
      });
    });
  });
  recalcForm();
  openModal('modal-month');
}

function addBrokerSection(catId, name) {
  const container = document.getElementById('brokers-all');
  const div = document.createElement('div');
  div.className = 'form-section';
  catId = catId || '';
  div.innerHTML = `
    <h4>
      <span style="display:flex;align-items:center;gap:8px;">
        <input type="text" class="broker-name-input" value="${name||''}" placeholder="Nome da corretora" oninput="this.classList.remove('invalid')" style="background:transparent;border:none;border-bottom:1px dashed var(--border);color:var(--text);font-size:15px;font-weight:700;padding:0 0 2px;width:160px;outline:none;">
        <div class="cat-pills">
          <button type="button" class="cat-pill ${catId==='fixed'?'active':''}" data-cat="fixed" onclick="pickCat(this)">FIXA</button>
          <button type="button" class="cat-pill ${catId==='variable'?'active':''}" data-cat="variable" onclick="pickCat(this)">VAR</button>
          <button type="button" class="cat-pill ${catId==='crypto'?'active':''}" data-cat="crypto" onclick="pickCat(this)">CRYPTO</button>
        </div>
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

function pickCat(btn) {
  const pills = btn.closest('.cat-pills');
  pills.classList.remove('invalid');
  const wasActive = btn.classList.contains('active');
  pills.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  if (!wasActive) btn.classList.add('active');
}

function calcBrokerTotal(sec) {
  let sum = 0;
  sec.querySelectorAll('.inv-val').forEach(inp => { sum += parseR(inp.value); });
  return sum;
}

function updateBrokerTotals() {
  document.querySelectorAll('#brokers-all .form-section').forEach(sec => {
    const total = calcBrokerTotal(sec);
    const el = sec.querySelector('.broker-auto-total');
    if (el) el.textContent = fmtR(total);
  });
}

function addInvRow(container, d, prevValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'inv-entry';
  const pv = prevValue != null ? prevValue : '';

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
      <div class="input-group"><label>Valor (R$)</label><input type="text" class="inv-val" value="${d?fmtI(d.value):''}" placeholder="1.000,49" data-prev="${pv}" oninput="this.classList.remove('invalid');recalcForm()">
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
        <input type="text" class="inv-mat" value="${matVal || 'Liq. Di\u00e1ria'}" placeholder="Liq. Di\u00e1ria" style="padding:7px 10px;font-size:12px;">
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

function clearValidation() {
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.form-section.has-errors').forEach(el => el.classList.remove('has-errors'));
}

function validateForm() {
  clearValidation();
  var valid = true;

  document.querySelectorAll('#brokers-all .form-section').forEach(sec => {
    var secHasError = false;
    // Broker name
    var nameInput = sec.querySelector('.broker-name-input');
    if (!nameInput.value.trim()) {
      nameInput.classList.add('invalid');
      secHasError = true;
    }
    // Category tag
    var catPills = sec.querySelector('.cat-pills');
    if (!catPills.querySelector('.cat-pill.active')) {
      catPills.classList.add('invalid');
      secHasError = true;
    }
    // Investments
    sec.querySelectorAll('.inv-entry').forEach(entry => {
      var valInput = entry.querySelector('.inv-val');
      if (!valInput.value.trim() || parseR(valInput.value) <= 0) {
        valInput.classList.add('invalid');
        secHasError = true;
      }
    });
    if (secHasError) {
      sec.classList.add('has-errors');
      valid = false;
    }
  });
  return valid;
}

function recalcForm() {
  updateBrokerTotals();
  const bar = document.getElementById('calc-bar');
  if (!formPrevMonth) { bar.style.display='none'; return; }

  const aporte = parseR(document.getElementById('f-aporte').value);
  const date = document.getElementById('f-date').value.trim();

  let currentTotal = 0;
  document.querySelectorAll('#brokers-all .form-section').forEach(sec => {
    currentTotal += calcBrokerTotal(sec);
  });

  const prevTotal = getMonthTotal(formPrevMonth, 'all');
  const gain = currentTotal - prevTotal - aporte;
  const prevAcc = formPrevMonth.accGain || 0;
  const accGain = prevAcc + gain;
  const pctMonth = prevTotal > 0 ? (gain / prevTotal * 100) : 0;

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

  if (!validateForm()) {
    showErr(err, 'Preencha os campos destacados em vermelho.');
    return;
  }
  hideErr(err);

  const month = parseInt(document.getElementById('f-month').value);
  const year = parseInt(document.getElementById('f-year').value);
  const date = document.getElementById('f-date').value.trim();
  const aporte = parseR(document.getElementById('f-aporte').value);

  const categories = { fixed: [], variable: [], crypto: [] };
  let currentTotal = 0;
  document.querySelectorAll('#brokers-all .form-section').forEach(sec => {
    const bName = sec.querySelector('.broker-name-input').value.trim();
    const activeCat = sec.querySelector('.cat-pill.active');
    const catId = activeCat.dataset.cat;
    const investments = [];
    let bTotal = 0;
    sec.querySelectorAll('.inv-entry').forEach(entry => {
      const name = entry.querySelector('.inv-name').value.trim();
      const value = parseR(entry.querySelector('.inv-val').value);
      const rate = readInvRate(entry);
      const mat = entry.querySelector('.inv-mat');
      const maturity = mat && mat.value.trim() ? mat.value.trim() : 'Liq. Di\u00e1ria';
      if (name || value) { investments.push({ name, value, rate, maturity }); bTotal += value; }
    });
    currentTotal += bTotal;
    categories[catId].push({ name: bName, total: bTotal, investments });
  });

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
