// admin-settings.js — store settings form (name, theme, categories,
// coupon, shipping, countdown, fake counter, pixels, header code,
// Vodafone Cash, shipping policy) and the "print all orders" report.

// شعار المتجر: نفس أسلوب ضغط صور المنتجات (canvas -> WebP/JPEG data URL) بس
// بارتفاع أصغر لأنه لوجو صغير في الهيدر. TMP_LOGO_IMG فضل null يعني "مفيش
// تعديل معلّق"، لحد ما المستخدم يرفع صورة جديدة (تبقى dataURL) أو يمسح
// اللوجو الحالي (تبقى '') — ده اللي بيفرّق بين "سيبه زي ما هو" و"امسحه".
let TMP_LOGO_IMG = null;

function drawLogoPreview(){
  let box = document.getElementById('logoImgPreview');
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
  let input = document.getElementById('logoImgInput');
  if(input) input.value = '';
  drawLogoPreview();
}

document.getElementById('logoImgInput').addEventListener('change', function(e){
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

function drawS(){
  stName.value=SET.name;stWa.value=SET.wa;stColor.value=SET.theme||'#2563EB';cpOn.checked=SET.cpOn;cpCode.value=SET.cpCode;cpVal.value=SET.cpVal;
  waFloat.href=`https://wa.me/${SET.wa}`;gList.innerHTML='';
  SET.gov.forEach((g,i)=>{gList.innerHTML+=`<div class="gov"><input value="${g.n}" oninput="SET.gov[${i}].n=this.value"><input type="number" value="${g.v}" oninput="SET.gov[${i}].v=+this.value"><button class="btn red" onclick="SET.gov.splice(${i},1);drawS()">X</button></div>`})
  
  skipCart.checked=SET.skipCart;
  clientNote.value=SET.clientNote;
  
  countDownOn.checked=SET.countDownOn;
  countDownHours.value=SET.countDownHours || 2;
  countDownMins.value=SET.countDownMins || 30;
  countDownSecs.value=SET.countDownSecs || 0;
  countDownText.value=SET.countDownText;
  
  fakeCounterOn.checked=SET.fakeCounterOn;
  fakeCounterNum.value=SET.fakeCounterNum;

  fbPixelId.value=SET.fbPixelId||'';
  tiktokPixelId.value=SET.tiktokPixelId||'';
  headerCode.value='';
  getDoc(doc(db, "settings", "advanced")).then(snap=>{
    if(snap.exists()) headerCode.value = snap.data().headerCode || '';
  }).catch(()=>{});
  vodafoneOn.checked=SET.vodafoneOn||false;
  vodafoneNumber.value=SET.vodafoneNumber||'';

  instapayOn.checked=SET.instapayOn||false;
  instapayNumber.value=SET.instapayNumber||'';

  shippingPolicyOn.checked=SET.shippingPolicyOn||false;
  shippingPolicyText.value=SET.shippingPolicyText||'';
  altPhoneOn.checked=SET.altPhoneOn||false;

  thankYouMsg.value=SET.thankYouMsg||'';

  aboutText.value=SET.aboutText||'';
  SET.phones = SET.phones || [];
  drawPhonesList();

  fbUrl.value=SET.fbUrl||'';
  instaUrl.value=SET.instaUrl||'';
  tiktokUrl.value=SET.tiktokUrl||'';

  TMP_LOGO_IMG = null;
  drawLogoPreview();

  drawCategorySettingsList();
}

function addG(){SET.gov.push({n:'Gov',v:50});drawS()}

function drawPhonesList(){
  let box = document.getElementById('phonesList');
  if(!SET.phones.length){ box.innerHTML = '<p style="color:var(--muted);font-size:13px">مفيش أرقام مضافة لسه</p>'; return; }
  box.innerHTML = SET.phones.map((p,i) => `
    <div class="gov">
      <input value="${p.label}" oninput="SET.phones[${i}].label=this.value" placeholder="مسمى">
      <input value="${p.num}" oninput="SET.phones[${i}].num=this.value" placeholder="رقم" inputmode="tel">
      <button class="btn red" onclick="SET.phones.splice(${i},1);drawPhonesList()">X</button>
    </div>`).join('');
}
function addPhone(){
  let labelEl = document.getElementById('newPhoneLabel'), numEl = document.getElementById('newPhoneNum');
  let label = labelEl.value.trim(), num = numEl.value.trim();
  if(!num) return toast('اكتب رقم التليفون الأول');
  SET.phones.push({label: label || 'تليفون', num});
  labelEl.value=''; numEl.value='';
  drawPhonesList();
}

async function saveS(){
  SET.name=stName.value;SET.wa=stWa.value;SET.theme=stColor.value;SET.cpOn=cpOn.checked;SET.cpCode=cpCode.value;SET.cpVal=+cpVal.value||0;
  SET.skipCart=skipCart.checked;SET.clientNote=clientNote.value;
  
  SET.countDownOn=countDownOn.checked;
  SET.countDownHours=+countDownHours.value||0;
  SET.countDownMins=+countDownMins.value||0;
  SET.countDownSecs=+countDownSecs.value||0;
  SET.countDownText=countDownText.value;
  
  SET.fakeCounterOn=fakeCounterOn.checked;
  SET.fakeCounterNum=+fakeCounterNum.value||10;

  SET.fbPixelId=fbPixelId.value.trim();
  SET.tiktokPixelId=tiktokPixelId.value.trim();
  SET.vodafoneOn=vodafoneOn.checked;
  SET.vodafoneNumber=vodafoneNumber.value.trim();

  SET.instapayOn=instapayOn.checked;
  SET.instapayNumber=instapayNumber.value.trim();

  SET.shippingPolicyOn=shippingPolicyOn.checked;
  SET.shippingPolicyText=shippingPolicyText.value;
  SET.altPhoneOn=altPhoneOn.checked;

  SET.thankYouMsg=thankYouMsg.value;

  SET.aboutText=aboutText.value;
  SET.fbUrl=fbUrl.value.trim();
  SET.instaUrl=instaUrl.value.trim();
  SET.tiktokUrl=tiktokUrl.value.trim();

  if(TMP_LOGO_IMG !== null) SET.logoImg = TMP_LOGO_IMG;
  
  applyTheme(SET.theme);saveAll();sName.innerText=SET.name;
  
  await setDoc(doc(db, "settings", "main"), SET); 
  await setDoc(doc(db, "settings", "advanced"), {headerCode: headerCode.value}, {merge: true});

  renderCategoriesDOM();
  checkStoreUpdates();
  toast('OK');drawS();
}

applyTheme(SET.theme);
sName.innerText=SET.name;
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
