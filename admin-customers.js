// admin-customers.js — العملاء: قايمة عملاء مبنية من الطلبات، تاريخ العميل على كارت الطلب،
// رسايل واتساب جاهزة، وتصدير CSV. (من غير أي قراءة إضافية من Firestore: كله من ORD.)

// ---------- أدوات مساعدة (متاحة للاختبارات الآلية كمان) ----------

// بيوحّد شكل رقم الموبايل المصري: 01012345678 / +201012345678 / 201012345678 / 1012345678 -> 01012345678
function normalizePhone(p){
  let d = String(p == null ? '' : p).replace(/\D/g, '');
  if(d.startsWith('0020')) d = d.slice(4);
  else if(d.startsWith('20') && d.length >= 12) d = d.slice(2);
  if(d.length === 10 && d.startsWith('1')) d = '0' + d;
  return d;
}

// رابط واتساب (الرقم الدولي المصري = 2 + الرقم المحلي اللي بيبدأ بـ 0)
function waLink(phone, text){
  let d = normalizePhone(phone);
  if(!d) return '';
  let intl = d.startsWith('0') ? '2' + d : d;
  return 'https://wa.me/' + intl + (text ? '?text=' + encodeURIComponent(text) : '');
}

// رسايل جاهزة — {name} {store} {items} {total}
const WA_TEMPLATES = {
  confirm: { label: 'تأكيد طلب جديد',
    text: 'أهلاً {name} 👋 معاك {store}. طلبك ({items}) بإجمالي {total} جنيه وصلنا. تحب نأكده ونشحنه على العنوان المسجل؟' },
  noans: { label: 'متابعة (لم يرد)',
    text: 'أهلاً {name}، حاولنا نتواصل معاك لتأكيد طلبك من {store}. ينفع نأكده دلوقتي؟' },
  shipped: { label: 'الطلب اتشحن',
    text: 'أهلاً {name}، طلبك من {store} اتشحن ✅ ومندوب الشحن هيتواصل معاك قريب. يا ريت تكون متاح على الرقم ده.' },
  review: { label: 'طلب رأي بعد التسليم',
    text: 'أهلاً {name}، نتمنى القطعة تكون عجبتك 🤍 لو تحب تبعتلنا صورة أو رأيك هيفرق معانا جدًا.' },
  repeat: { label: 'عرض لعميل سابق',
    text: 'أهلاً {name}، فيه جديد في {store} ✨ وكعميل سابق ليك خصم خاص على طلبك الجاي. تحب نبعتلك التفاصيل؟' }
};

function fillTemplate(text, vars){
  return String(text).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined) ? vars[k] : m);
}

function orderItemsSummary(o){
  return (o.items || []).map(i => {
    let opts = [];
    if(i.sizes) Object.keys(i.sizes).forEach(k => { if(i.sizes[k]) opts.push(k); });
    if(i.colors) Object.keys(i.colors).forEach(k => { if(i.colors[k]) opts.push(k); });
    return `${i.n || ''}${opts.length ? ' ' + opts.join('/') : ''} x${i.q || 1}`;
  }).join('، ');
}

// رابط واتساب مناسب لحالة الطلب (جديد/لم يرد/مؤكد → تأكيد، اتشحن → شحن، تم التسليم → رأي)
function orderWaLink(o){
  if(!o || !o.c || !o.c.p) return '';
  let key = o.st === 'ship' ? 'shipped' : (o.st === 'ok' ? 'review' : (o.st === 'noans' ? 'noans' : 'confirm'));
  let storeName = (typeof SET !== 'undefined' && SET && SET.name) ? SET.name : 'المتجر';
  let text = fillTemplate(WA_TEMPLATES[key].text, {
    name: o.c.n || '', store: storeName, items: orderItemsSummary(o), total: Number(o.tot || 0).toFixed(0)
  });
  return waLink(o.c.p, text);
}

// ---------- بناء قايمة العملاء ----------
// بيجمّع الطلبات حسب رقم الموبايل (أو الاسم لو مفيش رقم)
function buildCustomers(orders){
  let map = {};
  (orders || []).forEach(o => {
    let c = o.c || {};
    let phone = normalizePhone(c.p);
    let key = phone || ('name:' + String(c.n || '').trim().toLowerCase());
    if(key === 'name:') return;
    let cu = map[key];
    if(!cu){
      cu = map[key] = { key, name: c.n || '', phone: phone || c.p || '', phone2: c.p2 || '', gov: c.g || '', address: c.a || '',
        orders: 0, ok: 0, ret: 0, cancel: 0, noans: 0, active: 0, spent: 0, last: null, first: null, lastOrder: null };
    }
    cu.orders++;
    if(o.st === 'ok'){ cu.ok++; cu.spent += Number(o.tot || 0); }
    else if(o.st === 'ret') cu.ret++;
    else if(o.st === 'cancel') cu.cancel++;
    else if(o.st === 'noans') cu.noans++;
    else cu.active++;
    let d = (typeof getOrderDate === 'function') ? getOrderDate(o) : null;
    if(d && (!cu.last || d > cu.last)){
      cu.last = d; cu.lastOrder = o;
      cu.name = c.n || cu.name; cu.gov = c.g || cu.gov; cu.address = c.a || cu.address; cu.phone2 = c.p2 || cu.phone2;
    }
    if(d && (!cu.first || d < cu.first)) cu.first = d;
    if(!d && !cu.lastOrder){ cu.lastOrder = o; }
  });
  let list = Object.values(map);
  list.forEach(cu => { cu.tags = customerTags(cu); });
  return list;
}

// علامات العميل (للتأكيد التليفوني وقرار الشحن الكاش)
function customerTags(cu){
  let tags = [];
  if(cu.ok >= 2) tags.push('repeat');
  if(cu.ret >= 2 || (cu.ret >= 1 && cu.ok === 0)) tags.push('risky');
  else if(cu.ret === 1) tags.push('warn');
  if(cu.noans >= 2) tags.push('noans');
  if(cu.orders === 1 && cu.ok === 0 && cu.ret === 0) tags.push('new');
  return tags;
}
const TAG_LABELS = {
  repeat: { t: '⭐ متكرر', bg: '#fff3cd', c: '#856404' },
  risky:  { t: '⚠️ مرتجعات كتير', bg: '#f8d7da', c: '#842029' },
  warn:   { t: '↩️ عنده مرتجع', bg: '#ffe5d0', c: '#9a4b00' },
  noans:  { t: '📵 مش بيرد', bg: '#ffe5d0', c: '#9a4b00' },
  new:    { t: '🆕 جديد', bg: '#e7f1ff', c: '#084298' }
};

// فهرس العملاء بيتبني مرة واحدة لكل نسخة من ORD
let __custIdxFor = null, __custIdx = null;
function getCustomerIndex(){
  if(__custIdxFor !== ORD || !__custIdx){
    __custIdxFor = ORD;
    __custIdx = {};
    buildCustomers(ORD).forEach(cu => { __custIdx[cu.key] = cu; });
  }
  return __custIdx;
}

// شارة تاريخ العميل على كارت الطلب: "عميل سابق: ٣ طلبات (٢ مُسلَّم، ١ مرتجع)"
// بتحسب الطلبات التانية بس لنفس الرقم (من غير الطلب الحالي).
function customerHistoryChip(o){
  try{
    let c = o.c || {};
    let key = normalizePhone(c.p) || ('name:' + String(c.n || '').trim().toLowerCase());
    let cu = getCustomerIndex()[key];
    if(!cu || cu.orders <= 1) return '';
    let others = { orders: cu.orders - 1, ok: cu.ok, ret: cu.ret, cancel: cu.cancel, noans: cu.noans };
    if(o.st === 'ok') others.ok--; else if(o.st === 'ret') others.ret--; else if(o.st === 'cancel') others.cancel--; else if(o.st === 'noans') others.noans--;
    let bad = others.ret > 0;
    let parts = [];
    if(others.ok) parts.push(`${others.ok} مُسلَّم`);
    if(others.ret) parts.push(`${others.ret} مرتجع`);
    if(others.cancel) parts.push(`${others.cancel} ملغي`);
    if(others.noans) parts.push(`${others.noans} لم يرد`);
    let detail = parts.length ? ` (${parts.join('، ')})` : '';
    return `<div style="margin:6px 0;padding:6px 10px;border-radius:8px;font-size:13px;font-weight:700;background:${bad ? '#f8d7da' : '#e7f1ff'};color:${bad ? '#842029' : '#084298'}">${bad ? '⚠️' : '👤'} عميل سابق: ${others.orders} طلب تاني${esc(detail)}</div>`;
  }catch(e){ return ''; }
}

// ---------- CSV ----------
function csvCell(v){
  let s = (v === null || v === undefined) ? '' : String(v);
  if(/^[=+\-@]/.test(s)) s = "'" + s;           // حماية من حقن صيغ Excel
  return '"' + s.replace(/"/g, '""') + '"';
}
function toCSV(rows){ return rows.map(r => r.map(csvCell).join(',')).join('\r\n'); }
function downloadFile(filename, content, mime, noBom){
  // BOM عشان Excel يقرا العربي صح (من غير BOM لملفات JSON)
  let blob = new Blob([(noBom ? '' : '\uFEFF') + content], { type: (mime || 'text/csv') + ';charset=utf-8' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function fmtDate(d){ return d ? d.toLocaleDateString('en-GB') : ''; }

function exportCustomersCSV(){
  let list = buildCustomers(ORD);
  if(!list.length) return toast('مفيش عملاء لسه');
  let rows = [['الاسم','الموبايل','موبايل تاني','المحافظة','العنوان','عدد الطلبات','مُسلَّم','مرتجع','ملغي','لم يرد','إجمالي ما دفعه','أول طلب','آخر طلب']];
  list.forEach(c => rows.push([c.name, c.phone, c.phone2, c.gov, c.address, c.orders, c.ok, c.ret, c.cancel, c.noans, c.spent, fmtDate(c.first), fmtDate(c.last)]));
  downloadFile('customers-' + new Date().toISOString().slice(0,10) + '.csv', toCSV(rows));
}

// ---------- صفحة العملاء ----------
let CUST_FILTER = 'all';
function setCustFilter(f){ CUST_FILTER = f; drawCustomers(); }

function drawCustomers(){
  let box = document.getElementById('custList');
  if(!box) return;
  let q = (document.getElementById('custSearch') ? document.getElementById('custSearch').value : '').trim().toLowerCase();
  let sortBy = document.getElementById('custSort') ? document.getElementById('custSort').value : 'last';
  let tplKey = document.getElementById('custTpl') ? document.getElementById('custTpl').value : 'repeat';

  let all = buildCustomers(ORD);
  let list = all.filter(c => {
    if(CUST_FILTER === 'repeat' && !c.tags.includes('repeat')) return false;
    if(CUST_FILTER === 'risky' && !(c.tags.includes('risky') || c.tags.includes('warn') || c.tags.includes('noans'))) return false;
    if(q && !(String(c.name).toLowerCase().includes(q) || normalizePhone(c.phone).includes(normalizePhone(q) || q))) return false;
    return true;
  });
  list.sort((a, b) => {
    if(sortBy === 'spent') return b.spent - a.spent;
    if(sortBy === 'orders') return b.orders - a.orders;
    return (b.last ? b.last.getTime() : 0) - (a.last ? a.last.getTime() : 0);
  });

  let repeatCount = all.filter(c => c.tags.includes('repeat')).length;
  let riskyCount = all.filter(c => c.tags.includes('risky')).length;
  let sumEl = document.getElementById('custSummary');
  if(sumEl) sumEl.innerHTML = `
    <div class="stat-card"><h3>إجمالي العملاء</h3><p>${all.length}</p></div>
    <div class="stat-card"><h3>عملاء متكررين</h3><p style="color:#d97706">${repeatCount}</p></div>
    <div class="stat-card"><h3>نسبة التكرار</h3><p style="color:var(--green)">${all.length ? Math.round(repeatCount / all.length * 1000) / 10 + '%' : '—'}</p></div>
    <div class="stat-card"><h3>مرتجعات كتير</h3><p style="color:var(--red)">${riskyCount}</p></div>`;

  ['all','repeat','risky'].forEach(k => {
    let b = document.getElementById('custFilterBtn-' + k);
    if(b) b.className = k === CUST_FILTER ? 'btn small' : 'btn small gray';
  });

  if(!list.length){ box.innerHTML = '<p style="text-align:center;color:var(--muted)">مفيش عملاء مطابقين</p>'; return; }

  let storeName = (SET && SET.name) ? SET.name : 'المتجر';
  let tpl = WA_TEMPLATES[tplKey] || WA_TEMPLATES.repeat;
  let shown = list.slice(0, 300);
  box.innerHTML = `<div style="overflow-x:auto"><table>
    <thead><tr><th>العميل</th><th>الموبايل</th><th>المحافظة</th><th>طلبات</th><th>مُسلَّم / مرتجع</th><th>إجمالي ما دفعه</th><th>آخر طلب</th><th>علامات</th><th>واتساب</th></tr></thead>
    <tbody>` + shown.map(c => {
      let tags = c.tags.map(t => `<span style="display:inline-block;padding:3px 8px;margin:2px;border-radius:12px;font-size:12px;font-weight:700;background:${TAG_LABELS[t].bg};color:${TAG_LABELS[t].c}">${TAG_LABELS[t].t}</span>`).join('');
      let link = waLink(c.phone, fillTemplate(tpl.text, { name: c.name, store: storeName, items: '', total: '' }));
      return `<tr>
        <td><b>${esc(c.name)}</b></td>
        <td dir="ltr">${esc(c.phone)}</td>
        <td>${esc(c.gov)}</td>
        <td>${c.orders}</td>
        <td><span style="color:var(--green);font-weight:700">${c.ok}</span> / <span style="color:var(--red);font-weight:700">${c.ret}</span></td>
        <td>${c.spent}</td>
        <td>${esc(fmtDate(c.last))}</td>
        <td>${tags}</td>
        <td>${link ? `<a class="btn small green" style="margin:0" href="${esc(link)}" target="_blank" rel="noopener">💬</a>` : '-'}</td>
      </tr>`;
    }).join('') + `</tbody></table></div>` +
    (list.length > shown.length ? `<p style="color:var(--muted);text-align:center">معروض أول ${shown.length} من ${list.length} — استخدم البحث أو صدّر CSV للكل.</p>` : '');
}

function initCustomersPage(){
  let sel = document.getElementById('custTpl');
  if(sel && !sel.options.length){
    sel.innerHTML = Object.keys(WA_TEMPLATES).map(k => `<option value="${k}">${WA_TEMPLATES[k].label}</option>`).join('');
    sel.value = 'repeat';
  }
  ['custSearch'].forEach(id => { let el = document.getElementById(id); if(el && !el.__bound){ el.addEventListener('input', drawCustomers); el.__bound = true; } });
}
