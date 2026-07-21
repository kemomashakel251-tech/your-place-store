// admin-orders.js — orders list, filters, search, invoice printing,
// price-tampering warnings, and order status transitions (ship / deliver /
// cancel + stock return).

function updateNewOrderBadge(){
  let badge = document.getElementById('newOrderBadge');
  if(!badge) return;
  let onOrdersPage = document.getElementById('orders').classList.contains('on');
  let newCount = ORD.filter(o => o.st === 'new').length;
  if(newCount > 0 && !onOrdersPage){
    badge.innerText = newCount > 99 ? '99+' : newCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}
function clearNewOrderBadge(){
  let badge = document.getElementById('newOrderBadge');
  if(badge) badge.style.display = 'none';
}

let ORDER_FILTER = 'all';
function setOrderFilter(f){
  ORDER_FILTER = f;
  ['all','new','ship','ok','cancel'].forEach(k => {
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

    // paymentScreenshot عبارة عن data: URL ناتج من إعادة ترميز canvas (شوف checkout.html)،
    // يعني منطقياً مايحتويش على quotes/markup — بس esc() هنا دفاع إضافي احتياطي.
    let paymentHtml = o.paymentScreenshot ? `
      <div style="border-top:1px dashed #ddd;padding-top:8px;margin-top:8px">
        <b style="color:#856404">💜 دفع فودافون كاش - صورة التحويل:</b><br>
        <img src="${esc(o.paymentScreenshot)}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin-top:6px;cursor:pointer;border:1px solid #ddd" onclick="window.open('${esc(o.paymentScreenshot)}','_blank')">
      </div>` : '';

    html += `
    <div class="order" id="order-${o.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h4 style="margin:0">${i18n[LANG].order_no} #${esc((o.orderNum || o.id).toString().slice(-6))}</h4>
        <span class="badge ${o.st=='new'?'new':o.st=='ship'?'ship':o.st=='ok'?'ok':'cancel'}">
          ${o.st=='new'?'جديد':o.st=='ship'?'اتشحن':o.st=='ok'?'تم التسليم':'ملغي'}
        </span>
      </div>
      <p style="margin:6px 0;color:var(--muted)"><b>${esc(formatOrderDate(o))}</b></p>
      <p><b>${o.c ? esc(o.c.n) : ''}</b> - ${o.c ? esc(o.c.p) : ''}${o.c && o.c.p2 ? ` / ${esc(o.c.p2)}` : ''}</p>
      <p>${o.c ? esc(o.c.g) : ''} - ${o.c ? esc(o.c.a) : ''}</p>
      <div style="border-top:1px dashed #ddd;padding-top:8px">${itemsHtml}</div>
      ${paymentHtml}
      <h4 style="color:var(--main)">${i18n[LANG].total_lbl}: ${(o.tot || 0).toFixed(1)} ${i18n[LANG].currency}</h4>
       <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" style="background:#0ea5e9;color:#fff" onclick="setShipped('${o.id}')">اتشحن</button>
        <button class="btn green small" onclick="setSt('${o.id}','ok')">تم التسليم</button>
        <button class="btn red small" onclick="setSt('${o.id}','cancel')">إلغاء الطلب</button>
        <button class="btn gray small" style="background:#444; color:#fff" onclick="printInvoice('${o.id}')">طباعة</button>
        <button class="btn red small" style="background:#dc3545" onclick="delOrder('${o.id}')">حذف</button>
      </div>
    </div>`
  });
  
  oList.innerHTML = html;
}

async function setShipped(id){
  let o = ORD.find(x=>x.id==id);
  if(o){ 
    o.st = 'ship'; 
    await updateDoc(doc(db, "orders", id), {st: 'ship'});
    toast('تم الشحن'); 
  }
}

async function setSt(id,st){
  let o = ORD.find(x=>x.id==id);
  if(o){ 
    if(st === 'cancel' && o.st !== 'cancel'){
      await returnStockForOrder(o);
      o.st = st; 
      await updateDoc(doc(db, "orders", id), {st: st});
      toast('تم الإلغاء وإرجاع المخزون للمنتجات'); 
    } else {
      o.st = st; 
      await updateDoc(doc(db, "orders", id), {st: st});
      toast('تم التحديث'); 
    }
  }
}

async function returnStockForOrder(o){
  for(let item of (o.items || [])){
    // بنرجّع المخزون جوه معاملة (transaction) ذرّية: بتقرا آخر نسخة من المنتج
    // في قاعدة البيانات وقت التنفيذ نفسه وتزود عليها، فمحدش يمسح تعديل حصل
    // في نفس اللحظة على نفس المنتج (بيع أو إلغاء تاني) — ده بيشمل المخزون
    // الكلي والألوان والمقاسات والميزة الإضافية المخصصة كلهم مع بعض.
    try {
      await runTransaction(db, async (tx) => {
        let ref = doc(db, "products", item.id);
        let snap = await tx.get(ref);
        if(!snap.exists()) return;
        let data = snap.data();
        let update = { stock: (data.stock || 0) + (item.q || 0) };

        if(item.colors){
          let newStockByColor = {...(data.stockByColor || {})};
          for(let c in item.colors){ if(item.colors[c]) newStockByColor[c] = (newStockByColor[c] || 0) + item.colors[c]; }
          update.stockByColor = newStockByColor;
        }
        if(item.sizes){
          let newStockBySize = {...(data.stockBySize || {})};
          for(let s in item.sizes){ if(item.sizes[s]) newStockBySize[s] = (newStockBySize[s] || 0) + item.sizes[s]; }
          update.stockBySize = newStockBySize;
        }
        if(item.custom && data.customVariants){
          update.customVariants = data.customVariants.map(cv => {
            if(item.custom[cv.name]) return {...cv, stock: (cv.stock || 0) + item.custom[cv.name]};
            return cv;
          });
        }

        tx.set(ref, update, {merge: true});
      });
    } catch(e){ console.error(e); }
  }
  if(window.loadProducts) await window.loadProducts();
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
        <b>رقم الطلب:</b> #${esc((o.orderNum || o.id).toString().slice(-6))} <br>
        <b>التاريخ:</b> ${esc(formatOrderDate(o))} <br>
        <b>العميل:</b> ${cName} <br>
        <b>التليفون:</b> ${cPhone} <br>
        <b>المحافظة:</b> ${cGov} <br>
        <b>العنوان:</b> ${cAddr} <br>
        <b>الحالة:</b> ${o.st=='new'?'جديد':o.st=='ok'?'تم التسليم':'ملغي'}
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
      </div>
      <button class="btn-print" onclick="window.print()">طباعة</button>
    </body>
    </html>
  `);
  w.document.close();
  w.focus();
}

document.getElementById('searchOrder').addEventListener('input', drawO);
