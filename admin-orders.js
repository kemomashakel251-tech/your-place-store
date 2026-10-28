// admin-orders.js — orders list, filters, search, invoice printing,
// price-tampering warnings, and order status transitions (ship / deliver /
// cancel + stock return).

// كل حالات الطلب في مكان واحد (الاسم + لون الشارة) — بتتستخدم في القايمة والفاتورة والتقارير.
// conf = تم التأكيد تليفونيًا، noans = لم يرد، ret = مرتجع بعد الشحن
const ORDER_STATUS = {
  new:    { label: 'جديد',       cls: 'new' },
  noans:  { label: 'لم يرد',     cls: 'noans' },
  conf:   { label: 'تم التأكيد', cls: 'conf' },
  ship:   { label: 'اتشحن',      cls: 'ship' },
  ok:     { label: 'تم التسليم', cls: 'ok' },
  ret:    { label: 'مرتجع',      cls: 'ret' },
  cancel: { label: 'ملغي',       cls: 'cancel' }
};
function statusLabel(st){ return (ORDER_STATUS[st] || { label: st || '-' }).label; }
function statusClass(st){ return (ORDER_STATUS[st] || { cls: 'cancel' }).cls; }

// عنوان الصفحة الأصلي (بنضيف عليه عدد الطلبات الجديدة: "(3) لوحة التحكم")
const BASE_TITLE = document.title;

// النقطة الحمرا فوق "الطلبات": عدد الطلبات الجديدة (اللي لسه ماتأكدتش/ماتعاملتش).
// بتفضل ظاهرة طول ما فيه طلبات جديدة، حتى وإنت جوه صفحة الطلبات.
function updateNewOrderBadge(){
  let newCount = ORD.filter(o => o.st === 'new').length;
  let badge = document.getElementById('newOrderBadge');
  if(badge){
    if(newCount > 0){
      badge.innerText = newCount > 99 ? '99+' : newCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
  document.title = newCount > 0 ? `(${newCount > 99 ? '99+' : newCount}) ${BASE_TITLE}` : BASE_TITLE;
}
function clearNewOrderBadge(){ updateNewOrderBadge(); }

// ================= إشعار الطلب الجديد (صوت + بانر + إشعار متصفح) =================
// بيشتغل طول ما لوحة التحكم مفتوحة (حتى في تبويب تاني). لو اللوحة مقفولة مفيش إشعار —
// ده محتاج Cloud Functions (خطة Blaze) أو واتساب/تيليجرام، وده مش موجود دلوقتي.
function orderAlertsMuted(){
  try{ return localStorage.getItem('orderSound') === 'off'; }catch(e){ return false; }
}

let __audioCtx = null;
function getAudioCtx(){
  if(!__audioCtx){
    let AC = window.AudioContext || window.webkitAudioContext;
    if(AC) __audioCtx = new AC();
  }
  return __audioCtx;
}

// نغمتين قصيرتين (من غير ملف صوت)
function playOrderSound(){
  if(orderAlertsMuted()) return;
  try{
    let ctx = getAudioCtx();
    if(!ctx) return;
    if(ctx.state === 'suspended' && ctx.resume) ctx.resume();
    [[880, 0], [1175, 0.22]].forEach(([freq, delay]) => {
      let osc = ctx.createOscillator();
      let gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      let t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + 0.32);
    });
  }catch(e){ console.warn('sound failed', e); }
}

// بانر أحمر فوق الصفحة (بيضغط عليه تروح للطلبات)
function showNewOrderBanner(text){
  let el = document.getElementById('newOrderBanner');
  if(!el){
    el = document.createElement('div');
    el.id = 'newOrderBanner';
    el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10000;background:#dc3545;color:#fff;padding:12px 22px;border-radius:12px;font-weight:700;font-size:16px;box-shadow:0 6px 24px #0005;cursor:pointer;max-width:92vw;text-align:center';
    el.onclick = () => { el.style.display = 'none'; go('orders'); };
    document.body.appendChild(el);
  }
  el.innerText = text + ' — اضغط للعرض';
  el.style.display = 'block';
  clearTimeout(el.__timer);
  el.__timer = setTimeout(() => { el.style.display = 'none'; }, 12000);
}

// إشعار نظام (بيظهر بس لو التبويب مش قدامك وإنت وافقت على الإذن)
function showBrowserNotification(title, body){
  try{
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    if(!document.hidden) return;
    let n = new Notification(title, { body });
    n.onclick = () => { window.focus(); go('orders'); n.close(); };
  }catch(e){}
}

function notifyNewOrder(data){
  let name = data && data.c && data.c.n ? data.c.n : '';
  let total = Math.round(Number(data && data.tot || 0));
  let text = `🔔 طلب جديد${name ? ' من ' + name : ''} — ${total} جنيه`;
  showNewOrderBanner(text);
  playOrderSound();
  showBrowserNotification('طلب جديد 🔔', `${name ? name + ' — ' : ''}${total} جنيه`);
}

// بتتنده مع كل تحديث من Firestore: أول تحميل بيتسكت (مش طلبات جديدة)، وبعد كده
// أي طلب "اتضاف" وحالته جديد بييجي منه إشعار.
let __ordersSnapshotSeen = false;
function handleOrderChanges(snapshot){
  if(__ordersSnapshotSeen){
    snapshot.docChanges().forEach(ch => {
      if(ch.type !== 'added') return;
      if(ch.doc.metadata && ch.doc.metadata.hasPendingWrites) return; // اتكتب من اللوحة نفسها (زي استرجاع نسخة احتياطية)
      let d = ch.doc.data();
      if(d && d.st === 'new') notifyNewOrder(d);
    });
  }
  __ordersSnapshotSeen = true;
}

// زرار 🔔 في القايمة: أول ضغطة بتطلب إذن الإشعارات وبتشغّل الصوت، وبعدها بيكتم/يفتح الصوت
function updateAlertBtn(){
  let b = document.getElementById('alertBtn');
  if(!b) return;
  b.innerText = orderAlertsMuted() ? '🔕' : '🔔';
  b.title = orderAlertsMuted() ? 'صوت الإشعارات مكتوم (اضغط للتشغيل)' : 'صوت إشعارات الطلبات شغّال (اضغط للكتم)';
}
function toggleOrderAlerts(){
  let canAsk = ('Notification' in window) && Notification.permission === 'default';
  if(canAsk){
    try{ localStorage.setItem('orderSound', 'on'); }catch(e){}
    Notification.requestPermission();
    playOrderSound();
    toast('🔔 الإشعارات شغّالة — وافق على إذن المتصفح عشان توصلك والصفحة في الخلفية');
  } else if(orderAlertsMuted()){
    try{ localStorage.setItem('orderSound', 'on'); }catch(e){}
    playOrderSound();
    toast('🔔 تم تشغيل صوت الإشعارات');
  } else {
    try{ localStorage.setItem('orderSound', 'off'); }catch(e){}
    toast('🔕 تم كتم صوت الإشعارات');
  }
  updateAlertBtn();
}
// المتصفحات بتمنع الصوت لحد أول ضغطة من المستخدم — أول ضغطة (زي تسجيل الدخول) بتفتحه
document.addEventListener('click', () => {
  let c = getAudioCtx();
  if(c && c.state === 'suspended' && c.resume) c.resume();
}, { once: true });
updateAlertBtn();

let ORDER_FILTER = 'all';
function setOrderFilter(f){
  ORDER_FILTER = f;
  ['all','new','noans','conf','ship','ok','ret','cancel'].forEach(k => {
    let btn = document.getElementById('filterBtn-'+k);
    if(btn) btn.className = k === f ? 'btn small' : 'btn small gray';
  });
  drawO();
}

function drawO(){
  const search = document.getElementById('searchOrder').value.toLowerCase();
  
  const filteredORD = ORD.filter(o => {
    let matchesStatus = ORDER_FILTER === 'all' || o.st === ORDER_FILTER;
    let matchesSearch = o.id.toString().includes(search) || 
           (o.orderNum && o.orderNum.toString().includes(search)) ||
           (o.c && o.c.n && o.c.n.toLowerCase().includes(search)) ||
           (o.c && o.c.p && o.c.p.includes(search));
    return matchesStatus && matchesSearch;
  });

  if(!filteredORD.length){
    oList.innerHTML=`<p style="text-align:center;color:var(--muted)">${i18n[LANG].no_orders}</p>`;
    return;
  }
  
  let html = '';
  filteredORD.forEach(o=>{
    let itemsHtml = (o.items || []).map(i=>{
      let sizesText = '';
      if(i.sizes && Object.keys(i.sizes).length){
        sizesText = Object.entries(i.sizes).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
        sizesText = `<div style="margin-right:15px;color:#555">المقاسات: ${sizesText}</div>`;
      }
      let colorsText = '';
      if(i.colors && Object.keys(i.colors).length){
        colorsText = Object.entries(i.colors).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
        colorsText = `<div style="margin-right:15px;color:#555">الوان: ${colorsText}</div>`;
      }
      let customText = '';
      if(i.custom && Object.keys(i.custom).length){
        customText = Object.entries(i.custom).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
        customText = `<div style="margin-right:15px;color:#555">${customText}</div>`;
      }
      return `<div style="margin-bottom:10px"><b>${esc(i.n)}</b> x${esc(i.q)} ${sizesText} ${colorsText} ${customText}</div>`
    }).join('');

    // كل عنصر جوه payments عبارة عن data: URL ناتج من إعادة ترميز canvas (شوف
    // checkout.html)، يعني منطقياً مايحتويش على quotes/markup — بس esc() هنا
    // دفاع إضافي احتياطي. الطلبات القديمة (قبل دعم InstaPay) كانت بتحفظ
    // paymentMethod/paymentScreenshot لوحدهم بدل مصفوفة payments، فبنعمل
    // fallback ليهم عشان يفضلوا ظاهرين برضه.
    let paymentsList = o.payments && o.payments.length
      ? o.payments
      : (o.paymentScreenshot ? [{method:o.paymentMethod||'vodafone', label:o.paymentMethod==='instapay'?'InstaPay':'فودافون كاش', screenshot:o.paymentScreenshot}] : []);
    let paymentHtml = paymentsList.length ? paymentsList.map(pm => `
      <div style="border-top:1px dashed #ddd;padding-top:8px;margin-top:8px">
        <b style="color:${pm.method==='instapay'?'#0d47a1':'#856404'}">${pm.method==='instapay'?'🅿️':'💜'} دفع ${esc(pm.label)} - صورة التحويل:</b><br>
        <img src="${esc(pm.screenshot)}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin-top:6px;cursor:pointer;border:1px solid #ddd" onclick="window.open('${esc(pm.screenshot)}','_blank')">
      </div>`).join('') : '';

    let noteHtml = o.note ? `
      <div style="border-top:1px dashed #ddd;padding-top:8px;margin-top:8px;background:#eef6ff;padding:8px;border-radius:8px">
        <b style="color:#0d6efd">📝 ملاحظة العميل:</b> ${esc(o.note)}
      </div>` : '';

    html += `
    <div class="order" id="order-${o.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0">${i18n[LANG].order_no} #${esc((o.orderNum || o.id).toString().slice(-6))}</h4>
        <span class="badge ${statusClass(o.st)}">${statusLabel(o.st)}</span>
      </div>
      <p style="margin:6px 0;color:var(--muted)"><b>${esc(formatOrderDate(o))}</b></p>
      <p><b>${o.c ? esc(o.c.n) : ''}</b> - ${o.c ? esc(o.c.p) : ''}${o.c && o.c.p2 ? ` / ${esc(o.c.p2)}` : ''}</p>
      <p>${o.c ? esc(o.c.g) : ''} - ${o.c ? esc(o.c.a) : ''}</p>
      ${typeof customerHistoryChip === 'function' ? customerHistoryChip(o) : ''}
      ${orderIssuesHtml(o)}
      <div style="border-top:1px dashed #ddd;padding-top:8px">${itemsHtml}</div>
      ${paymentHtml}
      ${noteHtml}
      <h4 style="color:var(--main)">${i18n[LANG].total_lbl}: ${(o.tot || 0).toFixed(1)} ${i18n[LANG].currency}</h4>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" style="background:#6f42c1;color:#fff" onclick="setSt('${o.id}','conf')">تم التأكيد</button>
        <button class="btn small" style="background:#fd7e14;color:#fff" onclick="setSt('${o.id}','noans')">لم يرد</button>
        <button class="btn small" style="background:#0ea5e9;color:#fff" onclick="setShipped('${o.id}')">اتشحن</button>
        <button class="btn green small" onclick="setSt('${o.id}','ok')">تم التسليم</button>
        <button class="btn small" style="background:#b45309;color:#fff" onclick="setSt('${o.id}','ret')">مرتجع</button>
        <button class="btn red small" onclick="setSt('${o.id}','cancel')">إلغاء الطلب</button>
        ${(typeof orderWaLink === 'function' && orderWaLink(o)) ? `<a class="btn green small" style="margin:0" href="${esc(orderWaLink(o))}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}
        <button class="btn gray small" style="background:#444; color:#fff" onclick="printInvoice('${o.id}')">طباعة</button>
        <button class="btn red small" style="background:#dc3545" onclick="delOrder('${o.id}')">حذف</button>
      </div>
    </div>`
  });
  
  oList.innerHTML = html;
}

// ================= المخزون: بيتخصم عند التأكيد، ويرجع عند الإلغاء/المرتجع =================
// الطلب الجديد من المتجر بيتسجّل بـ stockDeducted:false (المتصفح مابيعدّلش المخزون — ده بيتم هنا).
// الطلبات القديمة (قبل التعديل ده) مفيهاش الحقل: بنعتبرها اتخصمت لو مش ملغية/مرتجعة.
const STOCK_HOLD_STATUSES = ['conf', 'ship', 'ok'];      // الحالات اللي المخزون فيها لازم يكون متخصوم
const STOCK_RELEASE_STATUSES = ['cancel', 'ret'];        // الحالات اللي بترجّع المخزون

function isStockDeducted(o){
  if(o.stockDeducted === true) return true;
  if(o.stockDeducted === false) return false;
  return !STOCK_RELEASE_STATUSES.includes(o.st);          // طلب قديم
}

// sign = +1 رجّع المخزون، -1 اخصم من المخزون. بتشتغل جوه transaction ذرّية لكل منتج
// (بتقرا آخر نسخة وقت التنفيذ). لو الخصم هيطلّع المخزون بالسالب بنثبّته على صفر ونرجّع
// أسماء المنتجات الناقصة عشان تتحذّر.
async function adjustStockForOrder(o, sign){
  let touchedIds = [];
  let shortages = new Set();
  let failed = [];
  for(let item of (o.items || [])){
    try {
      await runTransaction(db, async (tx) => {
        let ref = doc(db, "products", item.id);
        let snap = await tx.get(ref);
        if(!snap.exists()) return;
        let data = snap.data();
        let apply = (cur, delta) => {
          let next = (cur || 0) + sign * (delta || 0);
          if(next < 0){ shortages.add(item.n || item.id); next = 0; }
          return next;
        };
        let update = { stock: apply(data.stock, item.q) };

        if(item.colors){
          let m = {...(data.stockByColor || {})};
          for(let c in item.colors){ if(item.colors[c]) m[c] = apply(m[c], item.colors[c]); }
          update.stockByColor = m;
        }
        if(item.sizes){
          let m = {...(data.stockBySize || {})};
          for(let s in item.sizes){ if(item.sizes[s]) m[s] = apply(m[s], item.sizes[s]); }
          update.stockBySize = m;
        }
        if(item.custom && data.customVariants){
          update.customVariants = data.customVariants.map(cv => {
            if(item.custom[cv.name]) return {...cv, stock: apply(cv.stock, item.custom[cv.name])};
            return cv;
          });
        }
        tx.set(ref, update, {merge: true});
      });
      touchedIds.push(item.id);
    } catch(e){ console.error(e); failed.push(item.n || item.id); }
  }

  // بدل ما نعمل getDocs لكل المنتجات، بنجيب المنتجات اللي اتأثرت بس (getDoc لكل واحد)
  // ونحدّث نسختها المحلية في PROD.
  for(let id of touchedIds){
    try{
      let snap = await getDoc(doc(db, "products", id));
      if(snap.exists()){
        let fresh = {id, ...snap.data()};
        let idx = PROD.findIndex(p => p.id === id);
        if(idx > -1) PROD[idx] = fresh; else PROD.push(fresh);
      }
    }catch(e){ console.error(e); }
  }
  if(document.getElementById('products').classList.contains('on')) drawP();
  if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
  return { shortages: [...shortages], failed };
}
async function returnStockForOrder(o){ return adjustStockForOrder(o, +1); }

// ================= فحص الطلب قبل التأكيد (⚠️) =================
// الزائر ممكن يبعت طلب بإجمالي أو أسعار مزيفة، فبنقارن الطلبات اللي لسه ماتأكدتش
// بأسعار المنتجات الحالية وبحساب الإجمالي، ونظهر تحذير قبل ما تأكدها.
const ISSUE_CHECK_STATUSES = ['new', 'noans', 'conf'];
function currentUnitPrice(p, qty){
  let price = p.disc && p.disc < p.v ? p.disc : p.v;
  if(p.bulk_on && qty >= p.bulk_qty) price = price * (1 - p.bulk_disc / 100);
  return price;
}
function orderIssues(o){
  if(!ISSUE_CHECK_STATUSES.includes(o.st)) return [];
  let r = (n) => Math.round(Number(n) * 100) / 100;
  let issues = [];
  let items = o.items || [];
  let sub = items.reduce((t, i) => t + (Number(i.v) || 0) * (Number(i.q) || 0), 0);
  let expected = sub + (Number(o.ship) || 0) - (Number(o.coupon) || 0);
  if(!(Math.abs(expected - Number(o.tot)) <= 1)){
    issues.push(`الإجمالي المسجل (${r(o.tot)}) مش بيساوي مجموع الأصناف + الشحن − الكوبون (${r(expected)})`);
  }
  items.forEach(i => {
    let q = Number(i.q), v = Number(i.v);
    if(!(q > 0) || !Number.isInteger(q)) issues.push(`كمية "${i.n}" غير صحيحة (${i.q})`);
    if(!(v >= 0)) issues.push(`سعر "${i.n}" غير صحيح (${i.v})`);
  });
  if(PROD.length){
    items.forEach(i => {
      let p = PROD.find(x => x.id == i.id);
      if(!p){ issues.push(`المنتج "${i.n}" مش موجود أو اتحذف`); return; }
      let cur = currentUnitPrice(p, Number(i.q));
      if(Math.abs(cur - Number(i.v)) > 0.5) issues.push(`سعر "${i.n}" في الطلب (${r(i.v)}) غير سعره الحالي (${r(cur)})`);
      if(p.maxQty && Number(i.q) > p.maxQty) issues.push(`كمية "${i.n}" (${i.q}) أكبر من الحد الأقصى (${p.maxQty})`);
      if(!isStockDeducted(o) && Number(i.q) > (p.stock || 0)) issues.push(`كمية "${i.n}" (${i.q}) أكبر من المخزون المتاح (${p.stock || 0})`);
    });
  }
  return issues;
}
function orderIssuesHtml(o){
  let issues = orderIssues(o);
  if(!issues.length) return '';
  return `<div style="margin:6px 0;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700;background:#f8d7da;color:#842029">⚠️ راجع الطلب ده قبل ما تأكده:<ul style="margin:4px 18px 0">${issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

// ================= تغيير حالة الطلب =================
async function setShipped(id){ return setSt(id, 'ship'); }

async function setSt(id, st){
  let o = ORD.find(x => x.id == id);
  if(!o) return;
  let deducted = isStockDeducted(o);
  let wantsHold = STOCK_HOLD_STATUSES.includes(st);
  let wantsRelease = STOCK_RELEASE_STATUSES.includes(st);

  // قبل التأكيد لأول مرة: لو فيه تحذيرات (سعر/إجمالي مش مطابق...) اسأل الأول
  if(wantsHold && ['new', 'noans'].includes(o.st)){
    let issues = orderIssues(o);
    if(issues.length && !confirm('⚠️ الطلب ده فيه تحذيرات:\n\n- ' + issues.join('\n- ') + '\n\nمتأكد إنك عايز تكمل؟')) return;
  }

  let patch = { st };
  let msg = st === 'ship' ? 'تم الشحن' : 'تم التحديث';
  let sign = 0;
  let result = { shortages: [], failed: [] };

  if(wantsRelease && deducted){
    sign = +1;
    result = await adjustStockForOrder(o, sign);
    patch.stockDeducted = false;
    msg = st === 'ret' ? 'تم تسجيل المرتجع وإرجاع المخزون للمنتجات' : 'تم الإلغاء وإرجاع المخزون للمنتجات';
  } else if(wantsHold && !deducted){
    sign = -1;
    result = await adjustStockForOrder(o, sign);
    patch.stockDeducted = true;
    msg = 'تم التأكيد وخصم المخزون';
  }

  try{
    await updateDoc(doc(db, "orders", id), patch);
  }catch(e){
    console.error(e);
    if(sign) await adjustStockForOrder(o, -sign);   // نلغي تعديل المخزون لو الحالة ماتحفظتش
    alert('تعذر تحديث حالة الطلب، حاول تاني');
    return;
  }
  Object.assign(o, patch);

  if(result.failed.length) alert('⚠️ تعذر تعديل مخزون: ' + result.failed.join('، ') + '\nعدّله يدويًا من صفحة المنتجات.');
  if(result.shortages.length) msg += ' — تنبيه: المخزون مش كفاية لـ ' + result.shortages.join('، ');
  toast(msg);
}

// بيانات المرسل اللي بتظهر في الفاتورة (من الإعدادات، ولو فاضية بنستخدم الافتراضي)
const DEFAULT_SENDER_NAME = 'مكانك_your place';
const DEFAULT_SENDER_PHONE = '01044941885';

// طرق الدفع الإلكتروني المسجّلة على الطلب (فودافون كاش / إنستا باي) — فاضية = كاش عند الاستلام
function invoicePaymentLabels(o){
  let list = (o.payments && o.payments.length) ? o.payments
    : (o.paymentScreenshot ? [{ method: o.paymentMethod || 'vodafone' }] : []);
  let labels = list.map(p => p.method === 'instapay' ? 'إنستا باي' : 'فودافون كاش');
  return Array.from(new Set(labels));
}

function printInvoice(id){
  let o = ORD.find(x=>x.id==id);
  if(!o) return alert('الطلب مش موجود');

  // الفاتورة بتتفتح في نافذة جديدة بنفس الأصل عن طريق document.write، يعني أي
  // نص عميل مش متعدّي هيتنفذ بصلاحية كاملة على جلسة اللوحة (كوكيز/localStorage) —
  // لازم esc() لأي حاجة بنحطها جوه.
  let cName = esc(o.c ? o.c.n : '-');
  let cPhone = esc(o.c ? o.c.p + (o.c.p2 ? ` / ${o.c.p2}` : '') : '-');
  let cGov = esc(o.c ? o.c.g : '-');
  let cAddr = esc(o.c ? o.c.a : '-');
  let shipping = Number(o.ship || 0);
  let couponDiscount = Number(o.coupon || 0);
  let bulkDiscount = Number(o.bulkDiscount || 0); 

  let subtotal = 0;
  
  let items = (o.items || []).map(i=>{
    let price = Number(i.v || 0);
    let qty = Number(i.q || 1);
    let itemTotal = price * qty;
    subtotal += itemTotal;

    let sizesText = '-';
    if(i.sizes && Object.keys(i.sizes).length){
      sizesText = Object.entries(i.sizes).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
    }

    let colorsText = '-';
    if(i.colors && Object.keys(i.colors).length){
      colorsText = Object.entries(i.colors).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
    }

    let customText = '-';
    if(i.custom && Object.keys(i.custom).length){
      customText = Object.entries(i.custom).map(([k,v])=>`${esc(k)}: ${esc(v)}`).join(' - ');
    }

    return `<tr>
      <td>${esc(i.n)}</td>
      <td>${sizesText}</td>
      <td>${colorsText}</td>
      <td>${customText}</td>
      <td>${esc(qty)}</td>
      <td>${esc(price)} ج</td>
      <td>${esc(itemTotal)} ج</td>
    </tr>`;
  }).join('');

  let senderName = (SET.senderName && SET.senderName.trim()) || DEFAULT_SENDER_NAME;
  let senderPhone = (SET.senderPhone && SET.senderPhone.trim()) || DEFAULT_SENDER_PHONE;
  let paidLabels = invoicePaymentLabels(o);

  let totalAfterDiscounts = subtotal - couponDiscount; 
  let finalTotal = totalAfterDiscounts + shipping;

  let w = window.open('', '_blank', 'width=900,height=700');
  w.document.write(`
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>فاتورة</title>
      <style>
        body{font-family:Arial; padding:20px; background:#fff}
        h2{text-align:center; margin-bottom:20px}
        table{width:100%; border-collapse:collapse; margin-top:20px; font-size:14px}
        th,td{border:1px solid #ddd; padding:10px; text-align:center}
        th{background:#f2f2f2; font-weight:bold}
        .info{text-align:right; line-height:2.2; font-size:15px; margin-bottom:20px; border:1px solid #eee; padding:15px; border-radius:8px}
        .summary{text-align:left; font-size:16px; margin-top:20px; border-top:2px solid #000; padding-top:15px; line-height:2}
        .total{font-size:20px; font-weight:bold; color:#2563EB}
        .btn-print{margin-top:20px;padding:12px 25px;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:16px}
        @media print{ .btn-print{display:none} body{padding:0} }
      </style>
    </head>
    <body>
      <h2>فاتورة مبيعات - ${esc(SET.name)}</h2>
      <div class="info">
        <b>المرسل:</b> ${esc(senderName)} <br>
        <b>رقم المرسل:</b> <span dir="ltr">${esc(senderPhone)}</span> <br>
        <b>رقم الطلب:</b> #${esc((o.orderNum || o.id).toString().slice(-6))} <br>
        <b>التاريخ:</b> ${esc(formatOrderDate(o))} <br>
        <b>العميل:</b> ${cName} <br>
        <b>التليفون:</b> ${cPhone} <br>
        <b>المحافظة:</b> ${cGov} <br>
        <b>العنوان:</b> ${cAddr} <br>
        <b>الحالة:</b> ${esc(statusLabel(o.st))}
        ${(o.payments && o.payments.length) ? `<br><b>وسيلة الدفع:</b> ${o.payments.map(pm=>esc(pm.label)).join('، ')}` : (o.paymentScreenshot ? `<br><b>وسيلة الدفع:</b> ${o.paymentMethod==='instapay'?'InstaPay':'فودافون كاش'}` : '')}
        ${o.note ? `<br><b>ملاحظة العميل:</b> ${esc(o.note)}` : ''}
      </div>

      <table>
        <thead>
          <tr><th>المنتج</th><th>المقاس</th><th>اللون</th><th>ميزة إضافية</th><th>الكمية</th><th>السعر</th><th>الاجمالي</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>

      <div class="summary">
        ${bulkDiscount > 0 ? `<div style="color:orange">خصم الكمية: -${bulkDiscount.toFixed(1)} جنيه</div>` : ''} 
        <div>المجموع الفرعي: ${subtotal.toFixed(1)} جنيه</div>
        ${couponDiscount > 0 ? `<div style="color:green">خصم الكوبون: -${couponDiscount.toFixed(1)} جنيه</div>` : ''}
        <div>تكلفة الشحن: ${shipping.toFixed(1)} جنيه</div>
        <div class="total">الإجمالي النهائي: ${finalTotal.toFixed(1)} جنيه</div>
        ${paidLabels.length
          ? `<div style="color:#198754;font-weight:bold;margin-top:6px">✅ تم دفع المبلغ بالكامل (${esc(paidLabels.join(' + '))})</div>
             <div class="total" style="color:#000">المطلوب تحصيله: 0 جنيه</div>`
          : `<div class="total" style="color:#000;margin-top:6px">المطلوب تحصيله: ${finalTotal.toFixed(1)} جنيه (كاش عند الاستلام)</div>`}
      </div>
      <button class="btn-print" onclick="window.print()">طباعة</button>
    </body>
    </html>
  `);
  w.document.close();
  w.focus();
}

document.getElementById('searchOrder').addEventListener('input', drawO);
