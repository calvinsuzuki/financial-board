function filterCat(cat) {
  selCat = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === cat));
  renderSummary();
  renderCharts();
  renderDetail();
  renderTable();
}

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
  if(selMonth===0 || selMonth>=m.length) selMonth=m.length-1;
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

  const eff = getEffectiveTotals(cur);
  const fixedTotal = eff.fixed + eff.fixedUsd;
  const varTotal = eff.variable + eff.variableUsd;
  const cryptoTotal = eff.crypto;

  function usdSub(usd) { return usd > 0 ? `<div class="sub" style="color:var(--green);font-size:11px;">USD: ${fmtR(usd)}</div>` : ''; }

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
      ${usdSub(eff.fixedUsd)}
    </div>
    <div class="summary-card">
      <div class="label">Renda Vari\u00e1vel</div>
      <div class="value" style="color:var(--orange)">${fmtR(varTotal)}</div>
      <div class="sub" style="color:var(--text-muted)">${total?(varTotal/total*100).toFixed(1)+'%':'0%'} do total</div>
      ${usdSub(eff.variableUsd)}
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
    title = 'Distribui\u00e7\u00e3o por Categoria';
    var eff = getEffectiveTotals(cur);
    data = [];
    if (eff.fixed > 0) data.push({ name: 'Renda Fixa', value: eff.fixed, color: '#0984e3' });
    if (eff.fixedUsd > 0) data.push({ name: 'Renda Fixa USD', value: eff.fixedUsd, color: '#0984e380' });
    if (eff.variable > 0) data.push({ name: 'Renda Vari\u00e1vel', value: eff.variable, color: '#e17055' });
    if (eff.variableUsd > 0) data.push({ name: 'Renda Var. USD', value: eff.variableUsd, color: '#e1705580' });
    if (eff.crypto > 0) data.push({ name: 'Crypto', value: eff.crypto, color: '#fdcb6e' });
  } else {
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
      responsive:true, maintainAspectRatio:false, cutout:'65%', aspectRatio:1,
      plugins:{
        legend:{position:'bottom',labels:{color:'#8b8fa3',padding:16,usePointStyle:true}},
        tooltip:{callbacks:{label:function(c){var t=c.dataset.data.reduce(function(a,b){return a+b;},0);return c.label+': '+fmtR(c.parsed)+' ('+(c.parsed/t*100).toFixed(1)+'%)';}}}
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

  var detailEff = getEffectiveTotals(cur);
  var detailEffMap = { fixed: detailEff.fixed + detailEff.fixedUsd, variable: detailEff.variable + detailEff.variableUsd, crypto: detailEff.crypto };

  catsToShow.forEach(cat => {
    const brokers = cur.categories[cat.id] || [];
    if (!brokers.length || !brokers.some(b=>b.total>0)) return;

    html += `<div class="section-title">${cat.name} <span class="section-badge" style="background:${cat.color}22;color:${cat.color}">${fmtR(detailEffMap[cat.id])}</span></div>`;
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

        var unitPriceStr = '';
        if (inv.ticker && inv.quantity) {
          unitPriceStr = inv.quantity+' \u00d7 '+(inv.currency==='USD'&&inv.priceUsd?fmtUsd(inv.priceUsd):fmtR(inv.value/inv.quantity))+'/un';
        }
        var usdBadge = inv.currency==='USD' ? '<span style="font-size:10px;color:var(--green);margin-left:4px;">USD</span>' : '';

        html += `<div class="investment-row">
          <div>
            <div class="inv-name">${inv.name}${usdBadge}${pi?`<span class="gain-badge ${invGain>=0?'pos':'neg'}">${fmtPct(invPct)}</span>`:''}</div>
            <div class="inv-details">${unitPriceStr} ${inv.rate?'| '+inv.rate:''}${inv.maturity?' | Venc: '+inv.maturity:''}</div>
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

    var tEff = getEffectiveTotals(m);

    html += `<tr>
      <td><strong>${MONTHS[m.month].slice(0,3)}/${m.year}</strong></td>
      <td style="font-size:12px;color:var(--text-muted)">${m.date||'-'}</td>
      <td><strong>${fmtR(total)}</strong></td>`;
    html += `<td>${fmtR(tEff.fixed + tEff.fixedUsd)}</td>`;
    html += `<td>${fmtR(tEff.variable + tEff.variableUsd)}</td>`;
    html += `<td>${fmtR(tEff.crypto)}</td>`;
    html += `<td class="${m.gain>=0?'positive':'negative'}">${fmtR(m.gain)}</td>`;
    html += `<td class="${pctMonth>=0?'positive':'negative'}">${prev?fmtPct(pctMonth):'-'}</td>`;
    html += `<td style="color:var(--text-muted)">${days>0?fmtPct(annPct):'-'}</td>`;
    html += `<td class="positive">${fmtR(m.accGain)}</td></tr>`;
  });
  html += '</tbody></table>';
  document.getElementById('comparison-table').innerHTML = html;
}
