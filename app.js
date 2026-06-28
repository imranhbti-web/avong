const SHOP = {
  name: 'Avon Traders',
  address: 'Campbell Road, Balaganj, Lucknow',
  phone: '9369553111',
  terms: 'Items will not be returned after purchase.'
};

const DEFAULT_ITEMS = [
  ['Narial rassi','bundle',0,0,0,5,false],
  ['Plastic tassla','pcs',0,0,0,10,false],
  ['Lohe ka tassla','pcs',0,0,0,10,false],
  ['Kaccha taar','kg',0,0,0,5,false],
  ['Steel taar','kg',0,0,0,5,false],
  ['Aakudi','pcs',0,0,0,20,false],
  ['Allen key bolt - all types','pcs',0,0,0,50,true],
  ['GI pipe - all types','length',0,0,0,5,true],
  ['GI fittings - all types','pcs',0,0,0,25,true]
];

let state = loadState();
let quote = [];
let invoice = [];
let editingItemId = null;
let deferredInstallPrompt = null;

function loadState(){
  const saved = localStorage.getItem('avon_traders_data');
  if(saved){
    try { return JSON.parse(saved); } catch(e) {}
  }
  return {
    items: DEFAULT_ITEMS.map((x,i)=>({id:Date.now()+i,name:x[0],unit:x[1],buyRate:x[2],sellRate:x[3],stockQty:x[4],minStock:x[5],featured:x[6]})),
    sales: [],
    lastBackup: null
  };
}
function saveState(){ localStorage.setItem('avon_traders_data', JSON.stringify(state)); }
function money(n){ return '₹' + Number(n || 0).toFixed(2); }
function today(){ return new Date().toLocaleDateString('en-IN'); }
function cleanPhone(p){ return String(p||'').replace(/\D/g,''); }
function waUrl(phone,msg){ const p=cleanPhone(phone); return `https://wa.me/${p ? '91'+p.slice(-10) : ''}?text=${encodeURIComponent(msg)}`; }

function showTab(id){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===id));
  document.getElementById(id).classList.add('active');
  renderAll();
}

function renderAll(){ renderItems(); renderSelects(); renderQuote(); renderInvoice(); renderSales(); renderStock(); checkBackupDue(); }

function renderItems(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const box=document.getElementById('itemList');
  const items=state.items.filter(i => [i.name,i.unit,i.sellRate,i.buyRate].join(' ').toLowerCase().includes(q));
  box.innerHTML = items.map(i=>`<div class="card">
    <h3>${i.name}</h3>
    <span class="badge">Sell ${money(i.sellRate)} / ${i.unit}</span>
    <span class="badge">Buy ${money(i.buyRate)}</span>
    <span class="badge ${i.stockQty<=i.minStock?'warn':'ok'}">Stock ${i.stockQty} ${i.unit}</span>
    ${i.featured?'<span class="badge feature">Shop Specialty</span>':''}
    <p class="muted">Min trigger: ${i.minStock} ${i.unit}</p>
    <button class="secondary" onclick="editItem(${i.id})">Edit</button>
    <button class="danger" onclick="deleteItem(${i.id})">Delete</button>
  </div>`).join('') || '<p class="muted">No item found.</p>';
}

function renderSelects(){
  ['quoteItem','invoiceItem'].forEach(id=>{
    const sel=document.getElementById(id); if(!sel) return;
    sel.innerHTML=state.items.map(i=>`<option value="${i.id}">${i.name} — ${money(i.sellRate)} / ${i.unit}</option>`).join('');
  });
}

document.getElementById('itemForm').addEventListener('submit', e=>{
  e.preventDefault();
  const item={
    id: editingItemId || Date.now(),
    name:itemName.value.trim(), unit:itemUnit.value.trim(), buyRate:+buyRate.value,
    sellRate:+sellRate.value, stockQty:+stockQty.value, minStock:+minStock.value,
    featured:featured.checked
  };
  const idx=state.items.findIndex(x=>x.id===item.id);
  if(idx>=0) state.items[idx]=item; else state.items.push(item);
  editingItemId=null; e.target.reset(); saveState(); renderAll();
});
function editItem(id){
  const i=state.items.find(x=>x.id===id); if(!i) return;
  editingItemId=id; itemName.value=i.name; itemUnit.value=i.unit; buyRate.value=i.buyRate; sellRate.value=i.sellRate; stockQty.value=i.stockQty; minStock.value=i.minStock; featured.checked=!!i.featured; window.scrollTo({top:0,behavior:'smooth'});
}
function deleteItem(id){ if(confirm('Delete this item?')){ state.items=state.items.filter(i=>i.id!==id); saveState(); renderAll(); } }

function addLine(arr, itemId, qty, rate){
  const item=state.items.find(i=>i.id===+itemId); if(!item) return;
  arr.push({itemId:item.id,name:item.name,unit:item.unit,qty:+qty,rate:+rate,total:+qty*+rate});
}

document.getElementById('quoteItem').addEventListener('change',()=>{ const i=state.items.find(x=>x.id===+quoteItem.value); if(i) quoteRate.value=i.sellRate; });
document.getElementById('invoiceItem').addEventListener('change',()=>{ const i=state.items.find(x=>x.id===+invoiceItem.value); if(i) invoiceRate.value=i.sellRate; });

document.getElementById('quoteForm').addEventListener('submit', e=>{ e.preventDefault(); addLine(quote, quoteItem.value, quoteQty.value, quoteRate.value); quoteQty.value=''; renderQuote(); });
document.getElementById('invoiceForm').addEventListener('submit', e=>{ e.preventDefault(); addLine(invoice, invoiceItem.value, invoiceQty.value, invoiceRate.value); invoiceQty.value=''; renderInvoice(); });

function tableHtml(lines){
  const total=lines.reduce((s,l)=>s+l.total,0);
  return `<table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th class="right">Total</th></tr></thead><tbody>${lines.map(l=>`<tr><td>${l.name}</td><td>${l.qty} ${l.unit}</td><td>${money(l.rate)}</td><td class="right">${money(l.total)}</td></tr>`).join('')}<tr><th colspan="3">Grand Total</th><th class="right">${money(total)}</th></tr></tbody></table>`;
}
function renderQuote(){ quoteLines.innerHTML = quote.length ? tableHtml(quote) : '<p class="muted">No quote items added.</p>'; }
function renderInvoice(){ invoiceLines.innerHTML = invoice.length ? tableHtml(invoice) : '<p class="muted">No invoice items added.</p>'; }
function clearQuote(){ quote=[]; renderQuote(); }
function clearInvoice(){ invoice=[]; renderInvoice(); }

function docMessage(type, lines, customer, paid=0){
  const total=lines.reduce((s,l)=>s+l.total,0), due=total-Number(paid||0);
  const list=lines.map((l,i)=>`${i+1}. ${l.name} - ${l.qty} ${l.unit} x ${money(l.rate)} = ${money(l.total)}`).join('\n');
  return `${SHOP.name}\n${SHOP.address}\nPH: ${SHOP.phone}\n\n${type.toUpperCase()} Date: ${today()}\nCustomer: ${customer || '-'}\n\n${list}\n\nTotal: ${money(total)}${type==='invoice'?`\nPaid: ${money(paid)}\nBalance Due: ${money(due)}`:''}\n\nHome delivery available.\nSpecial: Allen Key Bolts, GI Pipes and GI Fittings.\n\nTerms: ${SHOP.terms}`;
}
function shareQuoteWhatsapp(){ window.open(waUrl(quotePhone.value, docMessage('quote', quote, quoteCustomer.value)), '_blank'); }
function shareInvoiceWhatsapp(){ window.open(waUrl(invoicePhone.value, docMessage('invoice', invoice, invoiceCustomer.value, paidAmount.value)), '_blank'); }

function finalizeSale(){
  if(!invoice.length) return alert('Add invoice items first.');
  const total=invoice.reduce((s,l)=>s+l.total,0), paid=Number(paidAmount.value||0);
  invoice.forEach(l=>{ const item=state.items.find(i=>i.id===l.itemId); if(item) item.stockQty = Number(item.stockQty||0) - Number(l.qty||0); });
  state.sales.unshift({id:Date.now(),date:today(),customer:invoiceCustomer.value||'-',phone:invoicePhone.value,total,paid,due:total-paid,lines:invoice});
  saveState(); alert('Sale saved and stock updated.'); clearInvoice(); invoiceCustomer.value=''; invoicePhone.value=''; paidAmount.value=''; renderAll(); showTab('sales');
}

function renderSales(){
  const q=(salesSearch?.value||'').toLowerCase();
  const list=state.sales.filter(s=>[s.customer,s.phone,JSON.stringify(s.lines)].join(' ').toLowerCase().includes(q));
  salesList.innerHTML=list.map(s=>`<div class="card"><h3>${s.customer}</h3><p>${s.date} • ${s.phone||'No phone'}</p><span class="badge">Total ${money(s.total)}</span><span class="badge ok">Paid ${money(s.paid)}</span><span class="badge ${s.due>0?'warn':'ok'}">Due ${money(s.due)}</span><p>${s.lines.map(l=>l.name).join(', ')}</p><button class="secondary" onclick="sendDueReminder(${s.id})">WhatsApp Due Reminder</button></div>`).join('') || '<p class="muted">No sales record.</p>';
}
function sendDueReminder(id){
  const s=state.sales.find(x=>x.id===id); if(!s) return;
  const msg=`Avon Traders payment reminder\nDear ${s.customer}, balance due is ${money(s.due)} for purchase dated ${s.date}. Kindly clear the balance.\nPH: ${SHOP.phone}`;
  window.open(waUrl(s.phone,msg),'_blank');
}

function renderStock(){
  const items=[...state.items].sort((a,b)=>(a.stockQty>a.minStock)-(b.stockQty>b.minStock));
  stockList.innerHTML=items.map(i=>`<div class="card"><h3>${i.name}</h3><span class="badge ${i.stockQty<=i.minStock?'warn':'ok'}">${i.stockQty<=i.minStock?'Reorder Needed':'Stock OK'}</span><p>Current: ${i.stockQty} ${i.unit}<br>Minimum: ${i.minStock} ${i.unit}</p><button class="secondary" onclick="editItem(${i.id});showTab('items')">Update Stock</button></div>`).join('');
}

function printDocument(type){
  const lines=type==='quote'?quote:invoice;
  const customer=type==='quote'?quoteCustomer.value:invoiceCustomer.value;
  const paid=type==='quote'?0:paidAmount.value;
  const text=docMessage(type, lines, customer, paid).replace(/\n/g,'<br>');
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>${type}</title><style>body{font-family:Arial;padding:24px;line-height:1.5}</style></head><body>${text}<script>window.print()<\/script></body></html>`);
}

function exportBackup(){
  state.lastBackup=new Date().toISOString(); saveState();
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`avon-traders-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  backupStatus.textContent='Backup exported. Save the downloaded file safely.'; checkBackupDue();
}
function importBackup(file){
  const reader=new FileReader();
  reader.onload=()=>{ try{ state=JSON.parse(reader.result); saveState(); backupStatus.textContent='Backup imported successfully.'; renderAll(); } catch(e){ backupStatus.textContent='Invalid backup file.'; } };
  reader.readAsText(file);
}
function checkBackupDue(){
  const last=state.lastBackup ? new Date(state.lastBackup) : null;
  const due=!last || ((Date.now()-last.getTime())/(1000*60*60*24) >= 7);
  backupAlert.classList.toggle('hidden', !due);
}

exportBtn.addEventListener('click', exportBackup);
quickBackupBtn.addEventListener('click', exportBackup);
importFile.addEventListener('change', e=> e.target.files[0] && importBackup(e.target.files[0]));
shopWhatsapp.href=waUrl(SHOP.phone,'Hello Avon Traders, I want to enquire about building material/hardware items.');

window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredInstallPrompt=e; installBtn.classList.remove('hidden'); });
installBtn.addEventListener('click', async()=>{ if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); deferredInstallPrompt=null; installBtn.classList.add('hidden'); }});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js'); }
renderAll();
