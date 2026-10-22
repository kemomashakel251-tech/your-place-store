// admin-dashboard.js — sales/profit/stock statistics dashboard.
// (محدّث: المنتج/المقاس/اللون الأكثر مبيعًا، ونسب التأكيد والتسليم والمرتجع،
// وصافي الربح الحقيقي بعد الشحن والمرتجعات ومصاريف الإعلان.)

// أسماء الشهور بالعربي لعرضها في قائمة اختيار الشهر
const AR_MONTHS = ['يناير','فبراير','مارس','ابريل','مايو','يونيو','يوليو','اغسطس','سبتمبر','اكتوبر','نوفمبر','ديسمبر'];

// حالات الطلب اللي بتتحسب "مبيعات فعّالة" (مش ملغي ولا مرتجع ولا لم يرد)
const ACTIVE_STATUSES = ['new','conf','ship','ok'];

// ================= التكاليف (متخزنة في finance/main — للأدمن بس) =================
// shipCost  : اللي بتدفعه فعلاً لشركة الشحن عن كل أوردر (فاضي = نعتبر شحن العميل بيغطيها)
// returnCost: اللي بتخسره على كل أوردر مرتجع (فاضي = نفس تكلفة الشحن)
// adSpend   : مصاريف الإعلان لكل شهر { 'YYYY-MM': رقم }
let FIN = { shipCost: null, returnCost: null, adSpend: {} };

async function loadFinance(){
  if(!db) return;
  try{
    let snap = await getDoc(doc(db, "finance", "main"));
    if(snap.exists()){
      let d = snap.data();
      FIN = { shipCost: d.shipCost ?? null, returnCost: d.returnCost ?? null, adSpend: d.adSpend || {} };
    }
  }catch(e){ console.warn('finance load failed — تأكد إنك نشرت قواعد Firestore الجديدة', e); }
  if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
}

async function saveFinance(){
  let sel = document.getElementById('dashMonthFilter');
  if(!sel) return;
  let monthKey = sel.value;
  let ship = document.getElementById('finShipCost').value.trim();
  let ret = document.getElementById('finReturnCost').value.trim();
  let ad = document.getElementById('finAdSpend').value.trim();

  let next = { shipCost: ship === '' ? null : (+ship || 0), returnCost: ret === '' ? null : (+ret || 0), adSpend: {...FIN.adSpend} };
  if(ad === '') delete next.adSpend[monthKey]; else next.adSpend[monthKey] = +ad || 0;

  try{
    await setDoc(doc(db, "finance", "main"), next);
    FIN = next;
    toast('تم حفظ التكاليف');
    drawDashboard(true);
  }catch(e){
    console.error(e);
    alert('تعذر الحفظ. تأكد إنك نشرت قواعد Firestore الجديدة (فيها collection اسمه finance).');
  }
}

// ================= واجهة فلتر الشهر =================
// بتضيف بوكس فلتر الشهر تحت الإجمالي الكلي — مرة واحدة بس، أول ما الداشبورد يترسم
function ensureMonthFilterUI(){
  if(document.getElementById('dashMonthFilter')) return;
  let dashboardEl = document.getElementById('dashboard');
  if(!dashboardEl) return;
  let box = document.createElement('div');
  box.className = 'box';
  box.innerHTML = `
    <h4>📅 إحصائيات شهر معين</h4>
    <select id="dashMonthFilter" style="max-width:260px"></select>
    <div class="stats-grid" style="margin-top:16px">
      <div class="stat-card">
        <h3>مبيعات الشهر</h3>
        <p id="statMonthSales">0 جنيه</p>
      </div>
      <div class="stat-card">
        <h3>ربح المنتجات (قبل الشحن والإعلانات)</h3>
        <p id="statMonthProfit" style="color:var(--green)">0 جنيه</p>
      </div>
      <div class="stat-card">
        <h3>القطع المباعة بالشهر</h3>
        <p id="statMonthQty" style="color:#0d6efd">0 قطعة</p>
      </div>
    </div>

    <h4 style="margin-top:26px">📊 الأداء والربح الحقيقي للشهر</h4>
    <div class="stats-grid" style="margin-top:12px">
      <div class="stat-card"><h3>إجمالي الطلبات</h3><p id="finOrders" style="color:#0d6efd">0</p></div>
      <div class="stat-card"><h3>نسبة التأكيد</h3><p id="finConfRate">—</p></div>
      <div class="stat-card"><h3>نسبة التسليم (من المحسوم)</h3><p id="finDeliveryRate" style="color:var(--green)">—</p></div>
      <div class="stat-card"><h3>نسبة المرتجع</h3><p id="finReturnRate" style="color:var(--red)">—</p></div>
      <div class="stat-card"><h3>تكلفة الطلب الإعلانية (CPA)</h3><p id="finCPA">—</p></div>
      <div class="stat-card"><h3>تكلفة الأوردر المسلَّم</h3><p id="finCPD">—</p></div>
      <div class="stat-card"><h3>ROAS (على المسلَّم)</h3><p id="finROAS">—</p></div>
      <div class="stat-card"><h3>🏆 الأكثر مبيعًا هذا الشهر</h3><p id="finBest" style="font-size:18px;color:#d97706">—</p><small id="finBestQty" style="color:var(--muted)"></small></div>
      <div class="stat-card" style="border:2px solid var(--green)"><h3>صافي الربح الحقيقي</h3><p id="finNet">0 جنيه</p></div>
    </div>
    <small id="finNote" style="display:block;color:var(--muted);margin:8px 0 14px"></small>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px" class="responsive-grid-3">
      <div><label><b>مصاريف الإعلان لهذا الشهر (جنيه)</b></label>
        <input id="finAdSpend" type="number" min="0" inputmode="decimal" placeholder="مثال: 3000"></div>
      <div><label><b>تكلفة الشحن عليك لكل أوردر (جنيه)</b></label>
        <input id="finShipCost" type="number" min="0" inputmode="decimal" placeholder="فاضي = شحن العميل بيغطيها"></div>
      <div><label><b>خسارة كل أوردر مرتجع (جنيه)</b></label>
        <input id="finReturnCost" type="number" min="0" inputmode="decimal" placeholder="فاضي = نفس تكلفة الشحن"></div>
    </div>
    <button class="btn" style="margin-top:8px;max-width:260px" onclick="saveFinance()">💾 حفظ التكاليف</button>`;
  let existingStatsGrid = dashboardEl.querySelector('.stats-grid');
  if(existingStatsGrid) existingStatsGrid.insertAdjacentElement('afterend', box);
  else dashboardEl.insertBefore(box, dashboardEl.firstChild);
  document.getElementById('dashMonthFilter').addEventListener('change', () => drawDashboard(true));
}

// بتجمع كل الشهور اللي فيها طلبات فعلاً + الشهر الحالي، وترتبهم من الأحدث للأقدم
function populateMonthOptions(){
  let sel = document.getElementById('dashMonthFilter');
  if(!sel) return;
  let months = new Set();
  ORD.forEach(o => {
    let d = getOrderDate(o);
    if(d) months.add(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  });
  let now = new Date();
  months.add(now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0'));

  let sorted = Array.from(months).sort().reverse();
  let prevValue = sel.value;
  sel.innerHTML = sorted.map(k => {
    let [y,m] = k.split('-');
    return `<option value="${k}">${AR_MONTHS[+m-1]} ${y}</option>`;
  }).join('');
  sel.value = sorted.includes(prevValue) ? prevValue : sorted[0];
}

function orderMonthKey(o){
  let d = getOrderDate(o);
  return d ? d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') : null;
}

// بتحسب المبيعات/الأرباح/القطع المباعة للشهر المختار بس (نفس منطق الإجمالي
// الكلي تحت، بس مفلتر بالشهر)
function computeMonthlyStats(monthKey){
  let monthSales = 0, monthProfit = 0, monthQty = 0;
  ORD.forEach(order => {
    if(order.st !== 'ok') return;
    if(orderMonthKey(order) !== monthKey) return;
    (order.items || []).forEach(item => {
      let qty = item.q;
      let revenue = item.v * qty;
      let cost = (item.cost || 0) * qty;
      monthSales += revenue;
      monthProfit += revenue - cost;
      monthQty += qty;
    });
  });
  return {monthSales, monthProfit, monthQty};
}

// الأداء والربح الحقيقي للشهر:
// صافي الربح = (مبيعات المسلَّم بعد الكوبون − تكلفة المنتجات)
//             + (شحن العميل − تكلفة الشحن عليك، لو دخّلت تكلفة الشحن)
//             − خسارة المرتجعات − مصاريف الإعلان
function computeMonthPerformance(monthKey){
  let r = { total:0, noans:0, confirmed:0, delivered:0, returned:0, cancelled:0,
            revenue:0, productCost:0, shipNet:0, returnLoss:0, qty:0 };
  let shipCost = FIN.shipCost;
  let returnCost = (FIN.returnCost !== null && FIN.returnCost !== undefined) ? FIN.returnCost : (shipCost || 0);

  ORD.forEach(o => {
    if(orderMonthKey(o) !== monthKey) return;
    r.total++;
    if(['conf','ship','ok','ret'].includes(o.st)) r.confirmed++;
    if(o.st === 'noans') r.noans++;
    if(o.st === 'cancel') r.cancelled++;
    if(o.st === 'ret'){ r.returned++; r.returnLoss += returnCost; }
    if(o.st === 'ok'){
      r.delivered++;
      let items = o.items || [];
      let sub = items.reduce((t,i) => t + (Number(i.v)||0) * (Number(i.q)||0), 0);
      r.revenue += sub - (Number(o.coupon)||0);
      r.productCost += items.reduce((t,i) => t + (Number(i.cost)||0) * (Number(i.q)||0), 0);
      r.qty += items.reduce((t,i) => t + (Number(i.q)||0), 0);
      if(shipCost !== null && shipCost !== undefined) r.shipNet += (Number(o.ship)||0) - shipCost;
    }
  });
  r.adSpend = +(FIN.adSpend[monthKey]) || 0;
  r.net = r.revenue - r.productCost + r.shipNet - r.returnLoss - r.adSpend;
  return r;
}

// المنتج / المقاس / اللون الأكثر مبيعًا.
// mode 'active' = كل الطلبات الفعّالة (جديد + مؤكد + اتشحن + تم التسليم)
// mode 'ok'     = المُسلَّمة فقط
function computeBest(mode, monthKey){
  let allowed = mode === 'ok' ? ['ok'] : ACTIVE_STATUSES;
  let prods = {}, sizes = {}, colors = {};
  ORD.forEach(o => {
    if(!allowed.includes(o.st)) return;
    if(monthKey && orderMonthKey(o) !== monthKey) return;
    (o.items || []).forEach(i => {
      let q = Number(i.q) || 0;
      if(!q) return;
      let key = i.id || i.n;
      prods[key] = prods[key] || { n: i.n, q: 0 };
      prods[key].q += q;
      Object.entries(i.sizes || {}).forEach(([k,v]) => { if(+v) sizes[k] = (sizes[k] || 0) + (+v); });
      Object.entries(i.colors || {}).forEach(([k,v]) => { if(+v) colors[k] = (colors[k] || 0) + (+v); });
    });
  });
  let top = obj => {
    let entries = Object.entries(obj);
    if(!entries.length) return null;
    entries.sort((a,b) => (b[1].q !== undefined ? b[1].q : b[1]) - (a[1].q !== undefined ? a[1].q : a[1]));
    let [k, v] = entries[0];
    return v.q !== undefined ? { name: v.n, q: v.q } : { name: k, q: v };
  };
  return { product: top(prods), size: top(sizes), color: top(colors) };
}

function pct(a, b){ return b > 0 ? (Math.round(a / b * 1000) / 10) + '%' : '—'; }
function money(n){ return (Math.round(n * 10) / 10) + ' جنيه'; }

// بتحط قيم التكاليف في الخانات (من غير ما تمسح اللي المستخدم بيكتبه دلوقتي)
function syncFinanceInputs(force){
  let monthKey = document.getElementById('dashMonthFilter').value;
  let fields = {
    finAdSpend: FIN.adSpend[monthKey] !== undefined ? FIN.adSpend[monthKey] : '',
    finShipCost: FIN.shipCost !== null && FIN.shipCost !== undefined ? FIN.shipCost : '',
    finReturnCost: FIN.returnCost !== null && FIN.returnCost !== undefined ? FIN.returnCost : ''
  };
  Object.entries(fields).forEach(([id, val]) => {
    let el = document.getElementById(id);
    if(!el) return;
    if(!force && document.activeElement === el) return;
    el.value = val;
  });
}

function drawDashboard(forceSync){
  ensureMonthFilterUI();
  populateMonthOptions();

  let selectedMonth = document.getElementById('dashMonthFilter').value;
  let m = computeMonthlyStats(selectedMonth);
  statMonthSales.innerText = m.monthSales + ` ${i18n[LANG].currency}`;
  statMonthProfit.innerText = m.monthProfit + ` ${i18n[LANG].currency}`;
  statMonthQty.innerText = m.monthQty + ` ${i18n[LANG].pcs}`;

  // ---- الأداء والربح الحقيقي للشهر ----
  let perf = computeMonthPerformance(selectedMonth);
  let resolved = perf.delivered + perf.returned;
  finOrders.innerText = perf.total;
  finConfRate.innerText = pct(perf.confirmed, perf.total);
  finDeliveryRate.innerText = pct(perf.delivered, resolved);
  finReturnRate.innerText = pct(perf.returned, resolved);
  finCPA.innerText = perf.adSpend > 0 && perf.total > 0 ? money(perf.adSpend / perf.total) : '—';
  finCPD.innerText = perf.adSpend > 0 && perf.delivered > 0 ? money(perf.adSpend / perf.delivered) : '—';
  finROAS.innerText = perf.adSpend > 0 ? (Math.round(perf.revenue / perf.adSpend * 100) / 100) + 'x' : '—';
  finNet.innerText = money(perf.net);
  finNet.style.color = perf.net >= 0 ? 'var(--green)' : 'var(--red)';

  let bestMonth = computeBest(document.getElementById('bestMode') ? bestMode.value : 'active', selectedMonth);
  finBest.innerText = bestMonth.product ? bestMonth.product.name : '—';
  finBestQty.innerText = bestMonth.product ? `${bestMonth.product.q} ${i18n[LANG].pcs}` : '';

  let notes = [];
  if(!perf.adSpend) notes.push('لسه ماسجلتش مصاريف الإعلان للشهر ده، فصافي الربح ده بدونها.');
  if(FIN.shipCost === null || FIN.shipCost === undefined) notes.push('تكلفة الشحن فاضية: بنفترض إن شحن العميل بيغطي شركة الشحن بالظبط.');
  notes.push('الربح بيتحسب على الطلبات "تم التسليم" بس، والمرتجع بيتسجل كخسارة.');
  finNote.innerText = notes.join(' ');

  syncFinanceInputs(forceSync === true);

  // ---- الإجمالي الكلي (كل الأوقات) ----
  let totalSales = 0; let totalProfits = 0; let totalSoldQty = 0; let productStats = {};
  PROD.forEach(p => { productStats[p.id] = { n: p.n, currentStock: p.stock, soldQty: 0, revenue: 0, profit: 0 }; });

  ORD.forEach(order => {
    if(order.st === 'ok'){
      (order.items || []).forEach(item => {
        let qty = item.q;
        let revenue = item.v * qty; 
        let cost = (item.cost || 0) * qty;
        let profit = revenue - cost;
        totalSales += revenue; totalProfits += profit; totalSoldQty += qty;

        if(productStats[item.id]){
          productStats[item.id].soldQty += qty;
          productStats[item.id].revenue += revenue;
          productStats[item.id].profit += profit;
        } else {
          productStats[item.id] = { n: item.n + " (Deleted)", currentStock: 0, soldQty: qty, revenue: revenue, profit: profit };
        }
      });
    }
  });

  statSales.innerText = totalSales + ` ${i18n[LANG].currency}`;
  statProfProfits.innerText = totalProfits + ` ${i18n[LANG].currency}`;
  statSoldQty.innerText = totalSoldQty + ` ${i18n[LANG].pcs}`;
  statVisits.innerText = STORE_VISITS + ' زيارة';

  // ---- الأكثر مبيعًا (كل الأوقات) ----
  let best = computeBest(document.getElementById('bestMode') ? bestMode.value : 'active');
  let setBest = (nameId, qtyId, item) => {
    let nameEl = document.getElementById(nameId), qtyEl = document.getElementById(qtyId);
    if(!nameEl) return;
    nameEl.innerText = item ? item.name : '—';
    if(qtyEl) qtyEl.innerText = item ? `${item.q} ${i18n[LANG].pcs}` : 'لسه مفيش مبيعات';
  };
  setBest('statBestProduct', 'statBestProductQty', best.product);
  setBest('statBestSize', 'statBestSizeQty', best.size);
  setBest('statBestColor', 'statBestColorQty', best.color);

  // الجدول مترتب بالأكثر مبيعًا (المُسلَّم) الأول
  let sortedIds = Object.keys(productStats).sort((a,b) => productStats[b].soldQty - productStats[a].soldQty);
  dashTable.innerHTML = sortedIds.map(id => {
    let s = productStats[id];
    let isRealProduct = PROD.some(p => p.id == id);
    let stockEditHtml = isRealProduct ? `
      <div style="display:flex;gap:6px;justify-content:center;align-items:center">
        <input type="number" id="stockEdit-${id}" value="${s.currentStock}" style="width:70px;padding:6px;margin:0">
        <button class="btn small" style="margin:0" onclick="updateStockFromDash('${id}')">تحديث</button>
      </div>` : '-';
    return `<tr>
      <td><b>${esc(s.n)}</b></td>
      <td>${s.currentStock} ${i18n[LANG].pcs}</td>
      <td>${stockEditHtml}</td>
      <td style="color:#0d6efd"><b>${s.soldQty}</b></td>
      <td>${s.revenue}</td>
      <td style="color:var(--green)"><b>${s.profit}</b></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">-</td></tr>';

  let colorRows = [];
  let sizeRows = [];
  PROD.forEach(p => {
    if(p.stockByColor){
      Object.entries(p.stockByColor).forEach(([c,q]) => {
        colorRows.push(`<tr><td><b>${esc(p.n)}</b></td><td>${esc(c)}</td><td style="color:${q<5?'var(--red)':'var(--green)'};font-weight:700">${q}</td></tr>`);
      });
    }
    if(p.stockBySize){
      Object.entries(p.stockBySize).forEach(([s,q]) => {
        sizeRows.push(`<tr><td><b>${esc(p.n)}</b></td><td>${esc(s)}</td><td style="color:${q<5?'var(--red)':'var(--green)'};font-weight:700">${q}</td></tr>`);
      });
    }
  });
  dashColorStockTable.innerHTML = colorRows.join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">لا يوجد مخزون ألوان مسجل</td></tr>';
  dashSizeStockTable.innerHTML = sizeRows.join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">لا يوجد مخزون مقاسات مسجل</td></tr>';
}

async function updateStockFromDash(id){
  let input = document.getElementById('stockEdit-' + id);
  if(!input) return;
  let newStock = +input.value;
  if(isNaN(newStock) || newStock < 0) return toast('من فضلك ادخل رقم صحيح');
  let p = PROD.find(x => x.id == id);
  if(!p) return;
  p.stock = newStock;
  try {
    await setDoc(doc(db, "products", id), p);
    drawDashboard();
    if(document.getElementById('products').classList.contains('on')) drawP();
    toast('تم تحديث المخزون بنجاح');
  } catch(error) {
    console.error(error);
    alert('حدث خطأ أثناء تحديث المخزون');
  }
}
