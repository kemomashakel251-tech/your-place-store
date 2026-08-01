// admin-settings.js — store settings form (name, theme, categories,
// coupon, shipping, countdown, fake counter, pixels, header code,
// Vodafone Cash, shipping policy) and the "print all orders" report.

// admin-settings.js — store settings form (name, theme, categories,
// coupon, shipping, countdown, fake counter, pixels, header code,
// Vodafone Cash / InstaPay, shipping policy, about page) and the
// "print all orders" report.

// دوال مساعدة "دفاعية": بترجع قيمة افتراضية بدل ما ترمي خطأ لو عنصر معين
// مش موجود في admin.html (مثلاً لو حد استبدل admin-settings.js من غير ما
// يستبدل admin.html معاه بنفس الوقت). كده أي حقل ناقص بيتجاهل هو بس، وباقي
// الإعدادات بتفضل بتتحفظ عادي بدل ما زرار الحفظ يقف تمام عند أول عنصر ناقص.
function $el(id){ return document.getElementById(id); }
function $val(id, fallback){ let el = $el(id); return el ? el.value : (fallback ?? ''); }
function $checked(id, fallback){ let el = $el(id); return el ? el.checked : !!fallback; }
function $set(id, prop, val){ let el = $el(id); if(el) el[prop] = val; }

// شعار المتجر: نفس أسلوب ضغط صور المنتجات (canvas -> WebP/JPEG data URL) بس
// بارتفاع أصغر لأنه لوجو صغير في الهيدر. TMP_LOGO_IMG فضل null يعني "مفيش
// تعديل معلّق"، لحد ما المستخدم يرفع صورة جديدة (تبقى dataURL) أو يمسح
// اللوجو الحالي (تبقى '') — ده اللي بيفرّق بين "سيبه زي ما هو" و"امسحه".
let TMP_LOGO_IMG = null;

function drawLogoPreview(){
  let box = $el('logoImgPreview');
  if(!box) return;
  let current = TMP_LOGO_IMG !== null ? TMP_LOGO_IMG : (SET.logoImg || '');
  box.innerHTML = current
    ? `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
         <img src="${current}" style="max-height:60px;max-width:200px;border-radius:8px;border:1px solid #eee;background:#f7f8fa">
         <button type="button" class="btn small red" style="margin:0" onclick="removeLogoImg()">حذف الشعار</button>
       </div>`
    : `<p style="color:var(--muted);font-size:13px;margin:0">مفيش شعار مرفوع - اسم المتجر النصي هيظهر بدل منه</p>`;
}

function removeLogoImg(){
  TMP_LOGO_IMG = '';
  $set('logoImgInput', 'value', '');
  drawLogoPreview();
}

if($el('logoImgInput')){
  $el('logoImgInput').addEventListener('change', function(e){
    let file = e.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = function(ev){
      let img = new Image();
      img.onload = function(){
        let canvas = document.createElement('canvas');
        let max_h = 200;
        let width = img.width, height = img.height;
        if(height > max_h){ width *= max_h / height; height = max_h; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.9);
        if(!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
        TMP_LOGO_IMG = dataUrl;
        drawLogoPreview();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function drawS(){
  $set('stName','value',SET.name); $set('stWa','value',SET.wa); $set('stColor','value',SET.theme||'#2563EB');
  $set('cpOn','checked',SET.cpOn); $set('cpCode','value',SET.cpCode); $set('cpVal','value',SET.cpVal);
  $set('waFloat','href',`https://wa.me/${SET.wa}`);
  let gList = $el('gList');
  if(gList){
    gList.innerHTML='';
    SET.gov.forEach((g,i)=>{gList.innerHTML+=`<div class="gov"><input value="${g.n}" oninput="SET.gov[${i}].n=this.value"><input type="number" value="${g.v}" oninput="SET.gov[${i}].v=+this.value"><button class="btn red" onclick="SET.gov.splice(${i},1);drawS()">X</button></div>`});
  }

  $set('skipCart','checked',SET.skipCart);
  $set('clientNote','value',SET.clientNote);

  $set('countDownOn','checked',SET.countDownOn);
  $set('countDownHours','value',SET.countDownHours || 2);
  $set('countDownMins','value',SET.countDownMins || 30);
  $set('countDownSecs','value',SET.countDownSecs || 0);
  $set('countDownText','value',SET.countDownText);

  $set('fakeCounterOn','checked',SET.fakeCounterOn);
  $set('fakeCounterNum','value',SET.fakeCounterNum);

  $set('fbPixelId','value',SET.fbPixelId||'');
  $set('tiktokPixelId','value',SET.tiktokPixelId||'');
  $set('headerCode','value','');
  getDoc(doc(db, "settings", "advanced")).then(snap=>{
    if(snap.exists()) $set('headerCode','value', snap.data().headerCode || '');
  }).catch(()=>{});

  $set('vodafoneOn','checked',SET.vodafoneOn||false);
  $set('vodafoneNumber','value',SET.vodafoneNumber||'');

  $set('instapayOn','checked',SET.instapayOn||false);
  $set('instapayNumber','value',SET.instapayNumber||'');

  $set('shippingPolicyOn','checked',SET.shippingPolicyOn||false);
  $set('shippingPolicyText','value',SET.shippingPolicyText||'');
  $set('altPhoneOn','checked',SET.altPhoneOn||false);

  $set('thankYouMsg','value',SET.thankYouMsg||'');

  $set('aboutText','value',SET.aboutText||'');
  SET.phones = SET.phones || [];
  drawPhonesList();

  $set('fbUrl','value',SET.fbUrl||'');
  $set('instaUrl','value',SET.instaUrl||'');
  $set('tiktokUrl','value',SET.tiktokUrl||'');

  TMP_LOGO_IMG = null;
  drawLogoPreview();

  drawCategorySettingsList();
}

function addG(){SET.gov.push({n:'Gov',v:50});drawS()}

function drawPhonesList(){
  let box = $el('phonesList');
  if(!box) return;
  if(!SET.phones.length){ box.innerHTML = '<p style="color:var(--muted);font-size:13px">مفيش أرقام مضافة لسه</p>'; return; }
  box.innerHTML = SET.phones.map((p,i) => `
    <div class="gov">
      <input value="${p.label}" oninput="SET.phones[${i}].label=this.value" placeholder="مسمى">
      <input value="${p.num}" oninput="SET.phones[${i}].num=this.value" placeholder="رقم" inputmode="tel">
      <button class="btn red" onclick="SET.phones.splice(${i},1);drawPhonesList()">X</button>
    </div>`).join('');
}
function addPhone(){
  let label = $val('newPhoneLabel').trim(), num = $val('newPhoneNum').trim();
  if(!num) return toast('اكتب رقم التليفون الأول');
  SET.phones.push({label: label || 'تليفون', num});
  $set('newPhoneLabel','value',''); $set('newPhoneNum','value','');
  drawPhonesList();
}

async function saveS(){
  SET.name=$val('stName',SET.name); SET.wa=$val('stWa',SET.wa); SET.theme=$val('stColor',SET.theme);
  SET.cpOn=$checked('cpOn',SET.cpOn); SET.cpCode=$val('cpCode',SET.cpCode); SET.cpVal=+$val('cpVal',SET.cpVal)||0;
  SET.skipCart=$checked('skipCart',SET.skipCart); SET.clientNote=$val('clientNote',SET.clientNote);

  SET.countDownOn=$checked('countDownOn',SET.countDownOn);
  SET.countDownHours=+$val('countDownHours',0)||0;
  SET.countDownMins=+$val('countDownMins',0)||0;
  SET.countDownSecs=+$val('countDownSecs',0)||0;
  SET.countDownText=$val('countDownText',SET.countDownText);

  SET.fakeCounterOn=$checked('fakeCounterOn',SET.fakeCounterOn);
  SET.fakeCounterNum=+$val('fakeCounterNum',10)||10;

  SET.fbPixelId=$val('fbPixelId').trim();
  SET.tiktokPixelId=$val('tiktokPixelId').trim();
  SET.vodafoneOn=$checked('vodafoneOn',SET.vodafoneOn);
  SET.vodafoneNumber=$val('vodafoneNumber').trim();

  SET.instapayOn=$checked('instapayOn',SET.instapayOn);
  SET.instapayNumber=$val('instapayNumber').trim();

  SET.shippingPolicyOn=$checked('shippingPolicyOn',SET.shippingPolicyOn);
  SET.shippingPolicyText=$val('shippingPolicyText',SET.shippingPolicyText);
  SET.altPhoneOn=$checked('altPhoneOn',SET.altPhoneOn);

  SET.thankYouMsg=$val('thankYouMsg',SET.thankYouMsg);

  SET.aboutText=$val('aboutText',SET.aboutText);
  SET.fbUrl=$val('fbUrl').trim();
  SET.instaUrl=$val('instaUrl').trim();
  SET.tiktokUrl=$val('tiktokUrl').trim();

  if(TMP_LOGO_IMG !== null) SET.logoImg = TMP_LOGO_IMG;

  applyTheme(SET.theme); saveAll(); $set('sName','innerText',SET.name);

  await setDoc(doc(db, "settings", "main"), SET);
  await setDoc(doc(db, "settings", "advanced"), {headerCode: $val('headerCode')}, {merge: true});

  renderCategoriesDOM();
  checkStoreUpdates();
  toast('OK'); drawS();
}

applyTheme(SET.theme);
$set('sName','innerText',SET.name);
updateLangDOM();
renderCategoriesDOM();
checkDeepLinks();

function printAllOrders(){
  if(ORD.length === 0) return alert('مفيش طلبات للطباعة');
  
  let rows = ORD.map(o=>{
    let shipping = Number(o.ship || 0);
    let coupon = Number(o.coupon || 0);
    let bulk = Number(o.bulkDiscount || 0);
    let sub = (o.items || []).reduce((t,i)=> t + (Number(i.v)*Number(i.q||1)), 0);
    let totalAfter = sub - coupon;
    let final = totalAfter + shipping;
    
    return `<tr>
      <td>${esc((o.orderNum || o.id).toString().slice(-6))}</td>
      <td>${esc(formatOrderDate(o))}</td>
      <td>${o.c ? esc(o.c.n) : ''}</td>
      <td>${o.c ? esc(o.c.p + (o.c.p2 ? ` / ${o.c.p2}` : '')) : ''}</td>
      <td>${o.items ? o.items.length : 0}</td>
      <td>${bulk.toFixed(1)}</td>
      <td>${sub.toFixed(1)}</td>
      <td>${coupon.toFixed(1)}</td>
      <td>${shipping.toFixed(1)}</td>
      <td><b>${final.toFixed(1)}</b></td>
      <td>${o.st=='new'?'جديد':o.st=='ok'?'تم':'ملغي'}</td>
    </tr>`;
  }).join('');

  let w = window.open('', '_blank');
  w.document.write(`
    <html dir="rtl"><head><meta charset="UTF-8"><title>تقرير الطلبات</title>
    <style>
      body{font-family:Arial; padding:20px} 
      h2{text-align:center}
      table{width:100%; border-collapse:collapse; font-size:12px}
      th,td{border:1px solid #ddd; padding:6px; text-align:center} 
      th{background:#f2f2f2}
      @media print{ button{display:none} }
    </style></head><body>
      <h2>تقرير جميع الطلبات - ${esc(SET.name)}</h2>
      <table>
        <tr>
          <th>رقم</th><th>التاريخ</th><th>العميل</th><th>التليفون</th><th>عدد الاصناف</th>
          <th>خصم كمية</th><th>المجموع</th><th>خصم كوبون</th><th>شحن</th><th>الاجمالي</th><th>الحالة</th>
        </tr>
        ${rows}
      </table>
      <button onclick="window.print()" style="margin-top:20px;padding:10px 20px">طباعة</button>
    </body></html>
  `);
  w.document.close();
  w.focus();
}
