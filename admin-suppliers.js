// admin-suppliers.js — supplier (dropshipping) management: linking
// platforms, market-product import, and price/stock sync.

let SUPPLIERS = [];
let MARKET_PRODUCTS = [];
let ACTIVE_SUPPLIER_ID = null;

async function loadSuppliers(){
  if(!db){ toast('سجّل الدخول الأول عشان تشوف الموردين'); return; }
  try{
    let snapshot = await getDocs(collection(db, "suppliers"));
    SUPPLIERS = [];
    snapshot.forEach((d) => { SUPPLIERS.push({id: d.id, ...d.data()}); });
    if(document.getElementById('suppliers').classList.contains('on')) drawSuppliers();
    checkSupplierSyncReminders();
  }catch(e){ console.error(e); toast('خطأ في تحميل الموردين — تأكد إنك مسجل دخول'); }
}

async function addSupplier(){
  if(!db) return toast('سجّل الدخول الأول');
  let name = document.getElementById('supName').value.trim();
  let apiKey = document.getElementById('supApiKey').value.trim();
  if(!name) return toast('من فضلك اكتب اسم المنصة');
  try{
    await addDoc(collection(db, "suppliers"), {name, apiKey, addedAt: serverTimestamp(), lastSyncAt: null});
    document.getElementById('supName').value = '';
    document.getElementById('supApiKey').value = '';
    await loadSuppliers();
    toast('تم إضافة المورد بنجاح');
  }catch(e){ console.error(e); alert('حدث خطأ أثناء إضافة المورد: ' + e.message); }
}

async function deleteSupplier(id){
  if(!confirm('هل أنت متأكد من حذف المورد؟ المنتجات اللي اتضافت منه هتفضل في مكتبتك.')) return;
  try{
    await deleteDoc(doc(db, "suppliers", id));
    await loadSuppliers();
    toast('تم حذف المورد');
  }catch(e){ console.error(e); alert('حدث خطأ أثناء الحذف'); }
}

function drawSuppliers(){
  let box = document.getElementById('suppliersList');
  if(!SUPPLIERS.length){ box.innerHTML = 'مفيش موردين مضافين لسه'; return; }
  box.innerHTML = SUPPLIERS.map(s => {
    let maskedKey = s.apiKey ? (s.apiKey.slice(0,4) + '••••••') : 'مفيش API Key متسجل';
    let needsSync = supplierNeedsSync(s);
    let lastSyncText = s.lastSyncAt && s.lastSyncAt.seconds
      ? new Date(s.lastSyncAt.seconds*1000).toLocaleString('ar-EG')
      : 'لسه متعملش تحديث';
    return `<div style="border:1px solid #eee;border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b>${s.name}</b><br>
          <small style="color:var(--muted)">${maskedKey}</small><br>
          <small style="color:var(--muted)">آخر تحديث: ${lastSyncText}</small>
          ${needsSync ? `<br><small style="color:var(--red)">🔄 محتاج تحديث (فات عليه أكتر من 6 ساعات)</small>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn small" onclick="openMarketImport('${s.id}')">📥 استيراد منتجات</button>
          <button class="btn small gray" style="background:#0ea5e9;color:#fff" onclick="openSyncBox('${s.id}')">🔄 تحديث الأسعار والمخزون</button>
          <button class="btn small red" onclick="deleteSupplier('${s.id}')">حذف المورد</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function supplierNeedsSync(s){
  if(!s.lastSyncAt || !s.lastSyncAt.seconds) return true;
  let hoursSince = (Date.now()/1000 - s.lastSyncAt.seconds) / 3600;
  return hoursSince >= 6;
}

function checkSupplierSyncReminders(){
  let badge = document.getElementById('supplierSyncBadge');
  if(!badge) return;
  let anyNeedsSync = SUPPLIERS.some(s => supplierNeedsSync(s));
  badge.style.display = anyNeedsSync ? 'inline-block' : 'none';
}

function openMarketImport(supplierId){
  ACTIVE_SUPPLIER_ID = supplierId;
  let s = SUPPLIERS.find(x=>x.id==supplierId);
  document.getElementById('marketTitle').innerText = `المرحلة 2: سوق منتجات "${s?s.name:''}"`;
  document.getElementById('marketBox').style.display = 'block';
  document.getElementById('syncBox').style.display = 'none';
  let cached = localStorage.getItem('marketJson_' + supplierId);
  document.getElementById('marketJson').value = cached || '';
  MARKET_PRODUCTS = [];
  document.getElementById('marketGrid').innerHTML = '';
  document.getElementById('marketBox').scrollIntoView({behavior:'smooth'});
}

function closeMarketBox(){
  document.getElementById('marketBox').style.display = 'none';
  ACTIVE_SUPPLIER_ID = null;
}

function previewMarketJson(){
  let raw = document.getElementById('marketJson').value.trim();
  if(!raw) return toast('الصق كود المنتجات الأول');
  let parsed;
  try{ parsed = JSON.parse(raw); }
  catch(e){ return toast('صيغة JSON غلط، راجعها تاني'); }
  if(!Array.isArray(parsed)) return toast('لازم يكون مصفوفة منتجات []');
  MARKET_PRODUCTS = parsed.map(p => ({
    id: String(p.id ?? p.sku ?? p.name ?? Math.random()),
    name: p.name || p.n || 'منتج بدون اسم',
    price: +p.price || +p.v || 0,
    stock: +p.stock ?? 0,
    image: safeImg(p.image || p.img || (p.media && p.media[0] && p.media[0].src)),
    description: p.description || p.d || ''
  }));
  localStorage.setItem('marketJson_' + ACTIVE_SUPPLIER_ID, raw);
  drawMarketGrid();
}

function drawMarketGrid(){
  let box = document.getElementById('marketGrid');
  if(!MARKET_PRODUCTS.length){ box.innerHTML = '<p style="color:var(--muted)">مفيش منتجات للعرض</p>'; return; }
  box.innerHTML = MARKET_PRODUCTS.map((p,i) => `
    <div style="border:1px solid #eee;border-radius:12px;padding:10px;text-align:center">
      <img src="${safeImg(p.image)}" style="width:100%;height:130px;object-fit:cover;border-radius:8px">
      <b style="display:block;margin:8px 0 4px">${p.name}</b>
      <div style="color:var(--main);font-weight:700">${p.price} ${i18n[LANG].currency}</div>
      <div style="color:${p.stock>0?'var(--green)':'var(--red)'};font-size:13px">مخزون: ${p.stock}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn small green" style="margin:0;flex:1" onclick="addToMine(${i})">➕ اضف عندي</button>
        <button class="btn small gray" style="margin:0;flex:1" onclick="ignoreMarketProduct(${i})">🚫 تجاهل</button>
      </div>
    </div>`).join('');
}

async function addToMine(idx){
  let mp = MARKET_PRODUCTS[idx];
  if(!mp) return;
  try{
    let newProduct = {
      n: mp.name,
      cat: 'all',
      cost: 0,
      v: mp.price,
      d: mp.description,
      media: [{type:'image', src: mp.image}],
      sz: [],
      cl: [],
      disc: 0,
      stock: mp.stock,
      showStock: true,
      stockByColor: {},
      stockBySize: {},
      customVariants: [],
      maxQty: 999,
      bulk_on: 0,
      bulk_qty: 5,
      bulk_disc: 20,
      customLandingUrl: "",
      active: mp.stock > 0,
      supplierId: ACTIVE_SUPPLIER_ID,
      sourceId: mp.id
    };
    let ref = await addDoc(collection(db, "products"), newProduct);
    // بدل قراءة كل المنتجات تاني من فايربيز، بنضيفه لمصفوفة PROD المحلية
    PROD.push({id: ref.id, ...newProduct});
    MARKET_PRODUCTS.splice(idx,1);
    drawMarketGrid();
    if(document.getElementById('products').classList.contains('on')) drawP();
    toast('اتضاف لمكتبتك بنجاح');
  }catch(e){ console.error(e); alert('حدث خطأ أثناء إضافة المنتج'); }
}

function ignoreMarketProduct(idx){
  MARKET_PRODUCTS.splice(idx,1);
  drawMarketGrid();
}

function openSyncBox(supplierId){
  ACTIVE_SUPPLIER_ID = supplierId;
  let s = SUPPLIERS.find(x=>x.id==supplierId);
  document.getElementById('syncTitle').innerText = `المرحلة 4: تحديث منتجات "${s?s.name:''}"`;
  document.getElementById('syncBox').style.display = 'block';
  document.getElementById('marketBox').style.display = 'none';
  let cached = localStorage.getItem('marketJson_' + supplierId);
  document.getElementById('syncJson').value = cached || '';
  document.getElementById('syncBox').scrollIntoView({behavior:'smooth'});
}

function closeSyncBox(){
  document.getElementById('syncBox').style.display = 'none';
  ACTIVE_SUPPLIER_ID = null;
}

async function runSupplierSync(){
  let raw = document.getElementById('syncJson').value.trim();
  if(!raw) return toast('الصق كود المنتجات المحدث الأول');
  let parsed;
  try{ parsed = JSON.parse(raw); }
  catch(e){ return toast('صيغة JSON غلط، راجعها تاني'); }
  if(!Array.isArray(parsed)) return toast('لازم يكون مصفوفة منتجات []');

  localStorage.setItem('marketJson_' + ACTIVE_SUPPLIER_ID, raw);

  let freshById = {};
  parsed.forEach(p => { freshById[String(p.id ?? p.sku ?? p.name)] = p; });

  let myProducts = PROD.filter(p => p.supplierId === ACTIVE_SUPPLIER_ID && p.sourceId);
  let updatedCount = 0;
  for(let p of myProducts){
    let fresh = freshById[String(p.sourceId)];
    if(!fresh) continue;
    let newPrice = +fresh.price || +fresh.v || p.v;
    let newStock = fresh.stock !== undefined ? +fresh.stock : p.stock;
    p.v = newPrice;
    p.stock = newStock;
    p.active = newStock > 0;
    try{ await setDoc(doc(db, "products", p.id), p); updatedCount++; }
    catch(e){ console.error(e); }
  }

  try{
    await setDoc(doc(db, "suppliers", ACTIVE_SUPPLIER_ID), {lastSyncAt: serverTimestamp()}, {merge: true});
  }catch(e){ console.error(e); }

  // myProducts عبارة عن مراجع (references) لنفس عناصر PROD، يعني هي بالفعل
  // اتحدثت محلياً جوه اللوب فوق — مفيش داعي نعمل getDocs لكل المنتجات تاني
  if(document.getElementById('products').classList.contains('on')) drawP();
  if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
  await loadSuppliers();
  toast(`تم تحديث ${updatedCount} منتج بنجاح`);
  closeSyncBox();
}

