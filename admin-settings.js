// admin-settings.js — store settings form (name, theme, categories,
// coupon, shipping, countdown, fake counter, pixels, header code,
// Vodafone Cash, shipping policy) and the "print all orders" report.

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

  shippingPolicyOn.checked=SET.shippingPolicyOn||false;
  shippingPolicyText.value=SET.shippingPolicyText||'';
  altPhoneOn.checked=SET.altPhoneOn||false;

  drawCategorySettingsList();
}

function addG(){SET.gov.push({n:'Gov',v:50});drawS()}

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

  SET.shippingPolicyOn=shippingPolicyOn.checked;
  SET.shippingPolicyText=shippingPolicyText.value;
  SET.altPhoneOn=altPhoneOn.checked;
  
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
      <td>${esc(o.date || '')}</td>
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
