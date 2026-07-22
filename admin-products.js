// admin-products.js — the "add/edit product" form (media gallery,
// sizes/colors/custom variants) and the products management table.

function renderPreviewGallery() {
  previewGallery.innerHTML = TMP_MEDIA.map((m, idx) => `
    <div class="preview-item">
      ${m.type === 'video' ? `<video src="${m.src}" muted></video>` : `<img src="${m.src}">`}
      <button class="remove-btn" onclick="removeMediaFromTmp(${idx})">X</button>
    </div>
  `).join('');
}

function removeMediaFromTmp(idx) {
  TMP_MEDIA.splice(idx, 1);
  renderPreviewGallery();
}

function addSz(){let v=szIn.value.trim();if(!v)return;if(TMP_SZ.includes(v))return toast('Exists');TMP_SZ.push(v);TMP_SZ_STOCK[v]=0;szIn.value='';drawTags();drawSzStock()}
function addCl(){let v=clIn.value.trim();if(!v)return;if(TMP_CL.includes(v))return toast('Exists');TMP_CL.push(v);TMP_CL_STOCK[v]=0;clIn.value='';drawTags();drawClStock()}
function delSz(i){let c=TMP_SZ[i];delete TMP_SZ_STOCK[c];TMP_SZ.splice(i,1);drawTags();drawSzStock()}
function delCl(i){let c=TMP_CL[i];delete TMP_CL_STOCK[c];TMP_CL.splice(i,1);drawTags();drawClStock()}
function drawTags(){szTags.innerHTML=TMP_SZ.map((s,i)=>`<span class="tag">${s}<span onclick="delSz(${i})">x</span></span>`).join('');clTags.innerHTML=TMP_CL.map((c,i)=>`<span class="tag">${c}<span onclick="delCl(${i})">x</span></span>`).join('')}
function drawClStock(){clStockBox.innerHTML=TMP_CL.length?TMP_CL.map(c=>`<div class="stock-row"><b>${c}:</b><input type="number" value="${TMP_CL_STOCK[c]||0}" oninput="TMP_CL_STOCK['${c}']=+this.value"></div>`).join(''):'...'}
function drawSzStock(){szStockBox.innerHTML=TMP_SZ.length?TMP_SZ.map(s=>`<div class="stock-row"><b>${s}:</b><input type="number" value="${TMP_SZ_STOCK[s]||0}" oninput="TMP_SZ_STOCK['${s}']=+this.value"></div>`).join(''):'...'}

function addCustomVariantField(){ TMP_CUSTOM.push({name:'', stock:0}); drawCustomStock(); }
function delCustomVariant(i){ TMP_CUSTOM.splice(i,1); drawCustomStock(); }
function drawCustomStock(){
  customStockBox.innerHTML = TMP_CUSTOM.length ? TMP_CUSTOM.map((v,i)=>`
    <div class="stock-row">
      <input placeholder="اسم الميزة (مثلاً: الطول)" value="${v.name}" style="flex:1" oninput="TMP_CUSTOM[${i}].name=this.value">
      <input type="number" min="0" placeholder="المخزون" value="${v.stock}" oninput="TMP_CUSTOM[${i}].stock=+this.value">
      <button type="button" class="btn small red" style="margin:0;width:36px" onclick="delCustomVariant(${i})">X</button>
    </div>`).join('') : 'دوس "+ أضف زر" لإضافة ميزة مخصصة';
}

function resetTags() {
  TMP_SZ=[];TMP_CL=[];TMP_CL_STOCK={};TMP_SZ_STOCK={};TMP_MEDIA=[];TMP_CUSTOM=[];
  drawTags();drawClStock();drawSzStock();drawCustomStock();renderPreviewGallery();
  pn.value=''; pp.value=''; pd.value=''; pdisc.value=''; pstock.value='0'; pcost.value='';
  pi.value=''; showStock.checked=true; document.getElementById('pCat').value = 'all';
  let btn = document.getElementById('productBtn');
  btn.innerText = "اضافة المنتج";
  btn.setAttribute('onclick', "addP()");
}

async function addP(){
  if(!TMP_MEDIA.length) return alert('برجاء رفع صورة أو فيديو واحد على الأقل للمنتج');
  
  try {
    let newProduct = {
      n: pn.value,
      cat: document.getElementById('pCat').value,
      cost: +pcost.value || 0,
      v: +pp.value,
      d: pd.value,
      media: [...TMP_MEDIA],
      sz: [...TMP_SZ],
      cl: [...TMP_CL],
      disc: +pdisc.value || 0,
      stock: +pstock.value || 0,
      showStock: showStock.checked,
      stockByColor: {...TMP_CL_STOCK},
      stockBySize: {...TMP_SZ_STOCK},
      customVariants: TMP_CUSTOM.filter(v => v.name && v.name.trim()),
      maxQty: +pmax.value || 999,
      bulk_on: 0,
      bulk_qty: 5,
      bulk_disc: 20,
      customLandingUrl: "" // قيمة افتراضية فارغة للرابط المخصص
    };
    let ref = await addDoc(collection(db, "products"), newProduct);

    // بدل ما نعمل getDocs لكل المنتجات تاني (قراءة كل الكولكشن من فايربيز)،
    // بنضيف المنتج الجديد لمصفوفة PROD المحلية على طول ونرسم بيها — نفس
    // النتيجة بصفر قراءات إضافية.
    PROD.push({id: ref.id, ...newProduct});

    resetTags();
    drawP();
    if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
    toast('تمت إضافة المنتج بنجاح');
  } catch(error) {
    console.error("Error adding product: ", error);
    alert("حدث خطأ أثناء حفظ المنتج في السحابة");
  }
}

async function delP(id){
  if(confirm(i18n[LANG].del_confirm_prod)){
    try {
      await deleteDoc(doc(db, "products", id));
      PROD = PROD.filter(x => x.id != id);
      drawP();
      if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
      toast('تم الحذف بنجاح');
    } catch(error) {
      console.error(error);
      alert("خطأ في الحذف");
    }
  }
}

async function delOrder(id){
  if(confirm(i18n[LANG].del_confirm_ord)){
    try {
      await deleteDoc(doc(db, "orders", id));
      toast('تم الحذف بنجاح');
    } catch(error) {
      console.error(error);
      alert("خطأ في الحذف");
    }
  }
}

function editP(id){
  let p = PROD.find(x=>x.id==id);
  if(!p) return;

  pn.value = p.n;
  document.getElementById('pCat').value = p.cat || 'all';
  pcost.value = p.cost || 0;
  pp.value = p.v;
  pdisc.value = p.disc || '';
  pstock.value = p.stock || 0;
  pmax.value = (p.maxQty && p.maxQty!= 999)? p.maxQty : '';
  pd.value = p.d || '';
  showStock.checked = p.showStock ?? true;

  TMP_SZ = [...(p.sz || [])];
  TMP_CL = [...(p.cl || [])];
  TMP_CL_STOCK = {...(p.stockByColor || {})};
  TMP_SZ_STOCK = {...(p.stockBySize || {})};
  TMP_CUSTOM = (p.customVariants || []).map(v => ({...v}));
  TMP_MEDIA = [...(p.media || [])];

  drawTags();
  drawClStock();
  drawSzStock();
  drawCustomStock();
  renderPreviewGallery();

  let btn = document.getElementById('productBtn');
  btn.innerText = "حفظ التعديلات";
  btn.setAttribute('onclick', `updateP('${id}')`);

  go('products');
  window.scrollTo(0,0);
}

async function updateP(id){
  if(!TMP_MEDIA.length) return alert('برجاء رفع صورة أو فيديو واحد على الأقل للمنتج');

  try {
    let p = PROD.find(x=>x.id==id) || {};
    let updated = {
      ...p,
      n: pn.value,
      cat: document.getElementById('pCat').value,
      cost: +pcost.value || 0,
      v: +pp.value,
      d: pd.value,
      media: [...TMP_MEDIA],
      sz: [...TMP_SZ],
      cl: [...TMP_CL],
      disc: +pdisc.value || 0,
      stock: +pstock.value || 0,
      showStock: showStock.checked,
      maxQty: +pmax.value || 999,
      stockByColor: {...TMP_CL_STOCK},
      stockBySize: {...TMP_SZ_STOCK},
      customVariants: TMP_CUSTOM.filter(v => v.name && v.name.trim()),
    };
    await setDoc(doc(db, "products", id), updated);

    // تحديث محلي بدل getDocs لكل المنتجات تاني
    let idx = PROD.findIndex(x => x.id == id);
    if(idx > -1) PROD[idx] = {...updated, id}; else PROD.push({...updated, id});

    resetTags();
    drawP();
    if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
    toast('تم التحديث بنجاح');
  } catch(error) {
    console.error("Error updating product: ", error);
    alert("حدث خطأ أثناء تحديث المنتج");
  }
}

async function toggleBulk(id, checked) {
  let p = PROD.find(x=>x.id==id);
  if(p) {
    p.bulk_on = checked ? 1 : 0;
    await setDoc(doc(db, "products", id), p);
    drawP();
    toast('تم تعديل العرض');
  }
}

async function updateBulkValue(id, key, val) {
  let p = PROD.find(x=>x.id==id);
  if(p) {
    p[key] = +val;
    await setDoc(doc(db, "products", id), p);
  }
}

// دالة جديدة لتخصيص وإضافة رابط صفحة هبوط للمنتج من لوحة التحكم بشكل يدوي ومستقل
async function promptCustomLandingUrl(id) {
  let p = PROD.find(x => x.id == id);
  if(!p) return;
  
  let currentUrl = p.customLandingUrl || "";
  let newUrl = prompt("أدخل رابط صفحة الهبوط المخصصة لهذا المنتج (سيبه فاضي عشان تلغي الزر للمنتج ده):", currentUrl);
  
  if (newUrl !== null) {
     p.customLandingUrl = newUrl.trim();
     await setDoc(doc(db, "products", id), p);
     toast('تم تحديث الرابط المخصص بنجاح');
     drawP();
  }
}

function drawP(){
  pTable.innerHTML='';
  PROD.forEach(x=>{
    let price = x.disc && x.disc < x.v? `<s style="color:#999">${x.v}</s> ${x.disc}` : x.v;
    let firstImg = x.media && x.media[0]? x.media[0].src : 'https://via.placeholder.com/50';
    let bulkStatus = x.bulk_on? 'مفعل' : 'مقفول';
    let bulkColor = x.bulk_on? 'var(--green)' : 'var(--red)';
    let hasUrlText = x.customLandingUrl && x.customLandingUrl.trim() !== '' ? '✅ مضاف' : '❌ غير محدد';
    let isActive = x.active !== false;
    let supplierBadge = x.supplierId ? `<br><small style="color:#0ea5e9">📦 من مورد</small>` : '';

    pTable.innerHTML+=`<tr style="${isActive?'':'opacity:.5'}">
      <td><img src="${firstImg}" style="width:50px;height:50px;object-fit:cover;border-radius:8px"></td>
      <td>${x.n}<br><small style="color:var(--muted)">التكلفة: ${x.cost||0} ج</small>${supplierBadge}</td>
      <td>${price} جنيه</td>
      <td>${x.stock}</td>
      <td style="min-width:220px">
        <button class="btn small" onclick="editP('${x.id}')">تعديل</button>
        <button class="btn small red" onclick="delP('${x.id}')">حذف</button>
        <button class="btn small gray" style="background:#0ea5e9; color:#fff;" onclick="promptCustomLandingUrl('${x.id}')">رابط مخصص 🔗 (${hasUrlText})</button>
        <button class="btn small ${isActive?'gray':''}" style="${isActive?'background:#444;color:#fff':'background:var(--green);color:#fff'}" onclick="toggleActive('${x.id}')">${isActive?'⏸ إيقاف المنتج':'▶ تفعيل المنتج'}</button>

        <hr style="margin:8px 0">
        <div style="text-align:right; background:#f8f9fa; padding:8px; border-radius:8px">
          <b>خصم الكمية</b> <span style="color:${bulkColor}; font-weight:700">[${bulkStatus}]</span><br>

          <label style="display:flex; align-items:center; gap:5px; margin-top:5px">
            <input type="checkbox" ${x.bulk_on?'checked':''}
            onchange="toggleBulk('${x.id}', this.checked)">
            تفعيل
          </label>

          <div style="display:flex; gap:5px; margin-top:5px">
            <input type="number" placeholder="القطع" value="${x.bulk_qty||5}" min="2" style="width:70px"
            onchange="updateBulkValue('${x.id}', 'bulk_qty', this.value)">
            <span>قطعة</span>
          </div>

          <div style="display:flex; gap:5px; margin-top:5px">
            <input type="number" placeholder="النسبة" value="${x.bulk_disc||20}" min="1" max="99" style="width:70px"
            onchange="updateBulkValue('${x.id}', 'bulk_disc', this.value)">
            <span>%</span>
          </div>
        </div>
      </td>
    </tr>`;
  });
}

async function toggleActive(id){
  let p = PROD.find(x=>x.id==id);
  if(!p) return;
  p.active = p.active === false ? true : false;
  await setDoc(doc(db, "products", id), p);
  drawP();
  toast(p.active ? 'تم تفعيل المنتج' : 'تم إيقاف المنتج');
}

// ================= الموردين (دروبشيبينج) =================
