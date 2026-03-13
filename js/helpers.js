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

// Date helpers
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

function getPrev(idx) { return idx > 0 ? appData.months[idx-1] : null; }

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
