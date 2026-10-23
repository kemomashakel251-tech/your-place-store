// admin-backup.js — نسخ احتياطي واسترجاع (JSON كامل) + تصدير الطلبات CSV.
// الخطة المجانية (Spark) مفيهاش نسخ احتياطي تلقائي، فالملف ده هو شبكة الأمان بتاعتك.

const BACKUP_VERSION = 1;
const BACKUP_COLLECTIONS = ['products', 'orders', 'suppliers'];
const BACKUP_DOCS = [['settings','main'], ['settings','advanced'], ['settings','stats'], ['finance','main']];

// Timestamp بتاع Firestore مش بيتحوّل لـ JSON لوحده، فبنعلّمه ونرجّعه وقت الاسترجاع
function serializeValue(v){
  if(v === null || v === undefined) return v;
  if(typeof v === 'object'){
    if(typeof v.toDate === 'function' && typeof v.seconds === 'number') return { __ts: [v.seconds, v.nanoseconds || 0] };
    if(Array.isArray(v)) return v.map(serializeValue);
    let out = {};
    Object.keys(v).forEach(k => { out[k] = serializeValue(v[k]); });
    return out;
  }
  return v;
}
function deserializeValue(v, TS){
  if(v === null || v === undefined) return v;
  if(typeof v === 'object'){
    if(Array.isArray(v)) return v.map(x => deserializeValue(x, TS));
    let keys = Object.keys(v);
    if(keys.length === 1 && keys[0] === '__ts' && Array.isArray(v.__ts) && TS) return new TS(v.__ts[0], v.__ts[1]);
    let out = {};
    keys.forEach(k => { out[k] = deserializeValue(v[k], TS); });
    return out;
  }
  return v;
}

// بتتأكد إن الملف نسخة احتياطية صحيحة من المتجر ده، وبترجع ملخص أو رسالة خطأ
function validateBackup(obj){
  if(!obj || typeof obj !== 'object') return { ok: false, error: 'الملف مش JSON صالح' };
  if(!obj.meta || obj.meta.app !== 'yourplace-store') return { ok: false, error: 'الملف ده مش نسخة احتياطية من المتجر' };
  if(obj.meta.version > BACKUP_VERSION) return { ok: false, error: 'النسخة دي أحدث من إصدار اللوحة، حدّث اللوحة الأول' };
  if(!obj.collections || typeof obj.collections !== 'object') return { ok: false, error: 'الملف ناقصه بيانات' };
  let counts = {};
  BACKUP_COLLECTIONS.forEach(n => {
    let arr = obj.collections[n];
    counts[n] = Array.isArray(arr) ? arr.length : 0;
  });
  counts.docs = obj.docs ? Object.keys(obj.docs).length : 0;
  return { ok: true, counts };
}

function setBackupStatus(msg){
  let el = document.getElementById('backupStatus');
  if(el) el.innerText = msg || '';
}

async function exportBackup(){
  if(!db) return toast('سجّل الدخول الأول');
  setBackupStatus('جاري القراءة من Firebase...');
  try{
    let data = { meta: { app: 'yourplace-store', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), counts: {} }, collections: {}, docs: {} };
    for(const name of BACKUP_COLLECTIONS){
      let snap = await getDocs(collection(db, name));
      data.collections[name] = [];
      snap.forEach(d => data.collections[name].push({ id: d.id, data: serializeValue(d.data()) }));
      data.meta.counts[name] = data.collections[name].length;
    }
    for(const [col, id] of BACKUP_DOCS){
      try{
        let s = await getDoc(doc(db, col, id));
        if(s.exists()) data.docs[col + '/' + id] = serializeValue(s.data());
      }catch(e){ console.warn('backup doc skipped', col, id, e); }
    }
    let stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadFile('store-backup-' + stamp + '.json', JSON.stringify(data), 'application/json', true);
    try{ localStorage.setItem('lastBackupAt', String(Date.now())); }catch(e){}
    setBackupStatus(`تم التحميل ✅ — منتجات: ${data.meta.counts.products}، طلبات: ${data.meta.counts.orders}، موردين: ${data.meta.counts.suppliers}`);
    checkBackupBadge(); drawBackupPage();
    toast('تم تحميل النسخة الاحتياطية');
  }catch(e){
    console.error(e);
    setBackupStatus('حصل خطأ: ' + (e.message || e));
    alert('تعذر عمل النسخة الاحتياطية: ' + (e.message || e));
  }
}

async function restoreBackupFromFile(input){
  let file = input.files && input.files[0];
  if(!file) return;
  if(!db){ toast('سجّل الدخول الأول'); input.value = ''; return; }
  try{
    let obj = JSON.parse(await file.text());
    let v = validateBackup(obj);
    if(!v.ok){ alert(v.error); input.value = ''; return; }
    let when = obj.meta.exportedAt ? new Date(obj.meta.exportedAt).toLocaleString('ar-EG') : 'غير معروف';
    let msg = `استرجاع نسخة بتاريخ ${when}\n\nمنتجات: ${v.counts.products}\nطلبات: ${v.counts.orders}\nموردين: ${v.counts.suppliers}\nإعدادات: ${v.counts.docs}\n\n` +
      `الاسترجاع بيكتب فوق أي مستند ليه نفس الـ id، ومابيمسحش حاجة تانية.\nمتأكد إنك عايز تكمل؟`;
    if(!confirm(msg)){ input.value = ''; return; }

    let jobs = [];
    BACKUP_COLLECTIONS.forEach(n => (obj.collections[n] || []).forEach(d => jobs.push([n, d.id, d.data])));
    Object.keys(obj.docs || {}).forEach(path => { let [c, i] = path.split('/'); jobs.push([c, i, obj.docs[path]]); });

    let done = 0, failed = [];
    for(const [col, id, data] of jobs){
      try{ await setDoc(doc(db, col, id), deserializeValue(data, Timestamp)); done++; }
      catch(e){ failed.push(col + '/' + id + ': ' + (e.code || e.message)); }
      if((done + failed.length) % 20 === 0) setBackupStatus(`جاري الاسترجاع... ${done + failed.length} / ${jobs.length}`);
    }
    setBackupStatus(`خلص الاسترجاع: ${done} نجح، ${failed.length} فشل` + (failed.length ? '\n' + failed.slice(0, 5).join('\n') : ''));
    if(typeof loadProducts === 'function') loadProducts();
    if(typeof loadSuppliers === 'function') loadSuppliers();
    if(typeof loadSettings === 'function') loadSettings();
    if(typeof loadFinance === 'function') loadFinance();
    toast(failed.length ? 'الاسترجاع خلص مع أخطاء — شوف التفاصيل' : 'تم الاسترجاع بنجاح');
  }catch(e){
    console.error(e);
    alert('الملف مش صالح أو حصل خطأ: ' + (e.message || e));
  }
  input.value = '';
}

// تصدير الطلبات CSV (يفتح في Excel، ومناسب لرفعه لشركة الشحن أو للمحاسب)
function ordersToRows(orders){
  let rows = [['رقم الطلب','التاريخ','الحالة','الاسم','الموبايل','موبايل تاني','المحافظة','العنوان','المنتجات','المجموع الفرعي','خصم الكوبون','الشحن','الإجمالي','وسيلة الدفع','ملاحظة']];
  (orders || []).forEach(o => {
    let c = o.c || {};
    let sub = (o.items || []).reduce((t, i) => t + (Number(i.v) || 0) * (Number(i.q) || 0), 0);
    let pay = (o.payments && o.payments.length) ? o.payments.map(p => p.label).join(' + ') : (o.paymentScreenshot ? (o.paymentMethod === 'instapay' ? 'InstaPay' : 'فودافون كاش') : 'كاش عند الاستلام');
    rows.push([
      String(o.orderNum || o.id).slice(-6), formatOrderDate(o), statusLabel(o.st), c.n, c.p, c.p2, c.g, c.a,
      orderItemsSummary(o), sub, Number(o.coupon || 0), Number(o.ship || 0), Number(o.tot || 0), pay, o.note || ''
    ]);
  });
  return rows;
}
function exportOrdersCSV(){
  if(!ORD.length) return toast('مفيش طلبات للتصدير');
  downloadFile('orders-' + new Date().toISOString().slice(0, 10) + '.csv', toCSV(ordersToRows(ORD)));
}

// ---------- تذكير النسخ الاحتياطي ----------
function backupAgeDays(){
  let last = +localStorage.getItem('lastBackupAt') || 0;
  return last ? (Date.now() - last) / 86400000 : Infinity;
}
function checkBackupBadge(){
  let b = document.getElementById('backupBadge');
  if(b) b.style.display = backupAgeDays() > 7 ? 'inline-block' : 'none';
}

function drawBackupPage(){
  let el = document.getElementById('backupLast');
  if(!el) return;
  let last = +localStorage.getItem('lastBackupAt') || 0;
  let age = backupAgeDays();
  el.innerHTML = last
    ? `آخر نسخة احتياطية من الجهاز ده: <b>${new Date(last).toLocaleString('ar-EG')}</b> ${age > 7 ? '<span style="color:var(--red);font-weight:700">— عدّى أكتر من أسبوع، خد نسخة جديدة</span>' : ''}`
    : '<span style="color:var(--red);font-weight:700">لسه ماعملتش أي نسخة احتياطية من الجهاز ده.</span>';
  checkBackupBadge();
}
