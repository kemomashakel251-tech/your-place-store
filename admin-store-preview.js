// admin-store-preview.js — a full embedded copy of the public store/product
// landing/checkout flow, used inside the admin panel for previewing pages
// and generating shareable links, independently from the public site files.

function drawStore(){
  grid.innerHTML='';
  PROD.forEach((x, prodIdx)=>{
    if(x.active === false) return;
    if(currentFilter !== 'all' && x.cat !== currentFilter) return;

    let priceHtml = x.disc && x.disc < x.v
      ? `<div class="price"><span style="text-decoration:line-through;color:var(--muted);font-size:14px">${x.v}</span> ${x.disc} ${i18n[LANG].currency}</div>`
      : `<div class="price">${x.v} ${i18n[LANG].currency}</div>`;
    let stockHtml = x.showStock && x.stock>0? `<div class="stock ${x.stock<5?'low':''}"> ${LANG=='ar'?'متبقي':'Remaining'} ${x.stock} ${i18n[LANG].pcs}</div>` : x.showStock && x.stock==0? `<div class="stock low">${LANG=='ar'?'نفذت الكمية':'Out of Stock'}</div>` : '';
    let btnDisabled = x.stock<=0? 'disabled' : '';
    
    let fakeCounterHtml = '';
    if(SET.fakeCounterOn) {
       let fakeBuyers = Math.floor(Math.random() * 12) + 4;
       let fakeStock = Math.floor(Math.random() * parseInt(SET.fakeCounterNum)) + 2;
       fakeCounterHtml = LANG === 'ar' 
         ? `<div style="color:red;font-size:12px;margin-top:5px">🔥 قام ${fakeBuyers} أشخاص بطلب هذا اليوم</div><div style="color:green;font-size:12px">متبقي ${fakeStock} قطع فقط في المخزن!</div>`
         : `<div style="color:red;font-size:12px;margin-top:5px">🔥 ${fakeBuyers} person ordered this today</div><div style="color:green;font-size:12px">Only ${fakeStock} items left in stock!</div>`;
    }

    let mediaList = x.media || [];
    if(mediaList.length === 0) mediaList = [{type:'image', src:'https://via.placeholder.com/200'}];
    
    let mediaItemsHtml = mediaList.map((m, i) => {
      let activeClass = i === 0 ? 'active' : '';
      if(m.type === 'video') {
        return `<video src="${m.src}" class="media-item-${prodIdx} ${activeClass}" controls muted></video>`;
      } else {
        return `<img src="${m.src}" class="media-item-${prodIdx} ${activeClass}">`;
      }
    }).join('');

    let navHtml = mediaList.length > 1 ? `
      <button class="media-nav prev" onclick="slideMedia(${prodIdx}, -1)">&#10095;</button>
      <button class="media-nav next" onclick="slideMedia(${prodIdx}, 1)">&#10094;</button>
    ` : '';

    // التحقق مما إذا كان للمنتج رابط صفحة هبوط مخصص أم لا
    let landingBtnHtml = '';
    if (x.customLandingUrl && x.customLandingUrl.trim() !== '') {
       landingBtnHtml = `<button class="btn gray" style="margin-top:5px; font-size:13px; padding:6px; font-weight:bold; border: 1px solid var(--main);" onclick="window.open('${x.customLandingUrl}', '_blank')">👁️ رابط صفحة الهبوط المخصصة</button>`;
    }

    let bulkDiscountTextHtml = '';
    if(x.bulk_on) {
       bulkDiscountTextHtml = LANG === 'ar'
         ? `<div style="background:#fff3cd;color:#856404;padding:6px;border-radius:8px;font-size:12px;font-weight:700;margin:6px 0;text-align:center">🔥 اشتري ${x.bulk_qty} قطع ووفر ${x.bulk_disc}%</div>`
         : `<div style="background:#fff3cd;color:#856404;padding:6px;border-radius:8px;font-size:12px;font-weight:700;margin:6px 0;text-align:center">🔥 Buy ${x.bulk_qty} pieces and save ${x.bulk_disc}%</div>`;
    }

    grid.innerHTML+=`
      <div class="card">
        <div class="media-container" id="mediaCont${prodIdx}">
          ${mediaItemsHtml}
          ${navHtml}
        </div>
        <h4>${x.n}</h4>
        <p>${x.d ? x.d.substring(0,40) : ''}...</p>
        ${priceHtml}
        ${stockHtml}
        ${fakeCounterHtml}
        <button class="btn" onclick="addC('${x.id}')" ${btnDisabled}>${LANG=='ar'?'اضف للسلة':'Add to Cart'}</button>
        ${landingBtnHtml}
        ${bulkDiscountTextHtml}
      </div>`;
  });
}

function slideMedia(prodIdx, direction) {
  let container = document.getElementById(`mediaCont${prodIdx}`);
  let items = container.querySelectorAll(`.media-item-${prodIdx}`);
  let activeIdx = Array.from(items).findIndex(el => el.classList.contains('active'));
  
  items[activeIdx].classList.remove('active');
  if(items[activeIdx].tagName === 'VIDEO') items[activeIdx].pause();

  let nextIdx = activeIdx + direction;
  if(nextIdx >= items.length) nextIdx = 0;
  if(nextIdx < 0) nextIdx = items.length - 1;
  
  items[nextIdx].classList.add('active');
}

function addC(id){
  let p=PROD.find(x=>x.id==id);
  if(!p)return toast('المنتج مش موجود');
  if(p.stock<=0)return toast('خلص');

  let max = p.maxQty || 999;
  if((CART[id]||0) >= max) return toast(`اقصى عدد من ${p.n} هو ${max} قطعة`);

  CART[id]=(CART[id]||0)+1;
  updC();
  if(SET.skipCart){toCheckout();return;}
  toast('تمت الاضافة');
}

function delC(id){delete CART[id];delete CHK_OPTS[id];updC()}

function chgQty(id,d){
  let p=PROD.find(x=>x.id==id);
  if(!p)return delC(id);

  let newQ=(CART[id]||0)+d;
  if(newQ<1)return delC(id);

  let max = p.maxQty || 999;
  if(newQ > max) return toast(`اقصى عدد من ${p.n} هو ${max} قطعة`);
  if(newQ>p.stock)return toast(`${i18n[LANG].max_stock}: ${p.stock}`);

  CART[id]=newQ;
  if(CHK_OPTS[id]) CHK_OPTS[id].q=CART[id];
  updC();
}

function updC(){
  let items=Object.keys(CART).map(id=>({id:id,p:PROD.find(x=>x.id==id),q:CART[id]})).filter(x=>x.p);
  let total=items.reduce((a,b)=>a+b.q,0);
  cNum.innerText=total;cNum2.innerText=total;
  cItems.innerHTML=items.map(x=>{
    let firstMedia = x.p.media && x.p.media[0] ? x.p.media[0] : {type:'image', src:'https://via.placeholder.com/200'};
    let previewTag = firstMedia.type === 'video' 
      ? `<video src="${firstMedia.src}" muted></video>` 
      : `<img src="${firstMedia.src}">`;
    return `
    <div class="cart-item">
      ${previewTag}
      <div style="flex:1"><b>${x.p.n}</b><br><span style="color:var(--muted)">${getPrice(x.p, x.q)} ${i18n[LANG].currency}</span></div>
      <div class="qty">
        <button class="btn small gray" onclick="chgQty('${x.id}',-1)">-</button>
        <b>${x.q}</b>
        <button class="btn small gray" onclick="chgQty('${x.id}',1)">+</button>
      </div>
      <button class="btn small red" onclick="delC('${x.id}')">X</button>
    </div>`}).join('')||`<p style="text-align:center;color:var(--muted)">${i18n[LANG].empty_cart}</p>`;
}

function cartToggle(){cart.style.display=cart.style.display=='block'?'none':'block'}

function toCheckout(){
  if(!Object.keys(CART).length)return alert('السلة فاضية');

  let noteHtml = SET.clientNote? `<div style='background:#e7f1ff;border:1px solid #b3d4fc;padding:12px;text-align:center;font-weight:600;color:#084298;margin-bottom:15px;border-radius:8px'>📢 ${SET.clientNote}</div>` : '';
  
  let countDownHtml = '';
  if(SET.countDownOn) {
     countDownHtml = `<div style='background:#fff3cd; color:#856404; padding:12px; text-align:center; font-weight:bold; margin-bottom:15px; border-radius:8px;'>
        <div style="margin-bottom:5px;">⏰ ${SET.countDownText}</div>
        <div class="dynamic-timer-box">
          <div><div class="timer-segment" id="chkHours">00</div><div class="timer-label">ساعة</div></div>
          <div><div class="timer-segment" id="chkMins">00</div><div class="timer-label">دقيقة</div></div>
          <div><div class="timer-segment" id="chkSecs">00</div><div class="timer-label">ثانية</div></div>
        </div>
     </div>`;
  }

  checkList.innerHTML= noteHtml + countDownHtml + Object.keys(CART).map(id=>{
    let p=PROD.find(x=>x.id==id);
    if(!p) return '';
    if(!CHK_OPTS[id])CHK_OPTS[id]={q:CART[id],sizes:{},colors:{},custom:{}};
    if(!CHK_OPTS[id].custom) CHK_OPTS[id].custom = {};

    let opt = CHK_OPTS[id];
    let totalQty = CART[id];
    let price = getPrice(p, totalQty);

    let sizeSum = Object.values(opt.sizes).reduce((a,b)=>a+b,0);
    let colorSum = Object.values(opt.colors).reduce((a,b)=>a+b,0);
    let customSum = Object.values(opt.custom).reduce((a,b)=>a+b,0);
    if(sizeSum==0 && p.sz.length) opt.sizes[p.sz[0]] = totalQty;
    if(colorSum==0 && p.cl.length) opt.colors[p.cl[0]] = totalQty;
    if(customSum==0 && p.customVariants && p.customVariants.length) opt.custom[p.customVariants[0].name] = totalQty;
    sizeSum = Object.values(opt.sizes).reduce((a,b)=>a+b,0);
    colorSum = Object.values(opt.colors).reduce((a,b)=>a+b,0);
    customSum = Object.values(opt.custom).reduce((a,b)=>a+b,0);

    let sizeHtml = p.sz.length? `<div><b>المقاسات:</b><br>`+ p.sz.map(s=>{
      let val = opt.sizes[s]||0;
      let remaining = totalQty - (sizeSum - val);
      let isDisabled = remaining <= 0 && val == 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
        <span style="width:50px">${s}:</span>
        <input type="number" min="0" max="${totalQty}" value="${val}" ${isDisabled?'disabled':''} style="width:70px;padding:6px;${isDisabled?'background:#e0e0e0;cursor:not-allowed':''}" oninput="setDist('${id}','sizes','${s}',this.value)">
      </div>`
    }).join('')+`</div>` : '';

    let colorHtml = p.cl.length? `<div><b>الوان:</b><br>`+ p.cl.map(c=>{
      let val = opt.colors[c]||0;
      let remaining = totalQty - (colorSum - val);
      let isDisabled = remaining <= 0 && val == 0;
      return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
        <span style="width:50px">${c}:</span>
        <input type="number" min="0" max="${totalQty}" value="${val}" ${isDisabled?'disabled':''} style="width:70px;padding:6px;${isDisabled?'background:#e0e0e0;cursor:not-allowed':''}" oninput="setDist('${id}','colors','${c}',this.value)">
      </div>`
    }).join('')+`</div>` : '';

    let customHtml = (p.customVariants && p.customVariants.length)? p.customVariants.map(cv=>{
      let val = opt.custom[cv.name]||0;
      let usedElsewhere = customSum - val;
      let remaining = totalQty - usedElsewhere;
      let isDisabled = remaining <= 0 && val == 0;
      return `<div><b>${cv.name}:</b><br><div style="display:flex;align-items:center;gap:8px;margin:4px 0">
        <input type="number" min="0" max="${totalQty}" value="${val}" ${isDisabled?'disabled':''} style="width:70px;padding:6px;${isDisabled?'background:#e0e0e0;cursor:not-allowed':''}" oninput="setDist('${id}','custom','${cv.name}',this.value)">
      </div></div>`
    }).join('') : '';

    let descriptionHtml = p.d ? `<p style="color:var(--muted); font-size:14px; margin: 8px 0; white-space: pre-line;">${p.d}</p>` : '';

    let checkMediaList = p.media && p.media.length ? p.media : [{type:'image', src:'https://via.placeholder.com/200'}];
    let checkMediaHtml = checkMediaList.length > 1
      ? `<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:10px">${checkMediaList.map(m => m.type==='video'
          ? `<video src="${m.src}" muted controls style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex:0 0 auto"></video>`
          : `<img src="${m.src}" style="width:90px;height:90px;object-fit:cover;border-radius:10px;flex:0 0 auto">`).join('')}</div>`
      : (checkMediaList[0].type==='video'
          ? `<video src="${checkMediaList[0].src}" controls muted></video>`
          : `<img src="${checkMediaList[0].src}">`);

    return `<div class="check-prod" id="chk${id}">
      ${checkMediaHtml}
      <h3>${p.n}</h3>
      <h4>الاجمالي: ${totalQty} قطع</h4>
      ${descriptionHtml}
      ${sizeHtml}
      ${colorHtml}
      ${customHtml}
      <h3 style="color:var(--main)">السعر: ${price*totalQty} جنيه</h3>
    </div>`
  }).join('');

  cg.innerHTML=`<option value="">اختار المحافظة</option>`+SET.gov.map(g=>`<option value="${g.v}">${g.n} - ${g.v} جنيه</option>`).join('');
  cg.onchange=calc; COUPON=0;coupon.value='';cpBox.style.display=SET.cpOn?'flex':'none';calc();

  document.getElementById('shipPolicyBtn').style.display = (SET.shippingPolicyOn && SET.shippingPolicyText) ? 'block' : 'none';
  document.getElementById('cp2').style.display = SET.altPhoneOn ? 'block' : 'none';

  VF_SCREENSHOT = null;
  let vfBox = document.getElementById('vodafoneBox');
  if(SET.vodafoneOn && SET.vodafoneNumber){
    vfBox.style.display='block';
    document.getElementById('vfNumberDisplay').innerText = SET.vodafoneNumber;
    document.getElementById('vfPreview').innerHTML='';
    document.getElementById('vfScreenshot').value='';
  } else {
    vfBox.style.display='none';
  }

  if(!document.getElementById('checkout').classList.contains('on')){
    if(cart.style.display=='block') cartToggle();
    go('checkout');
  }
  
  if(SET.countDownOn) {
     startDynamicTimer('chkHours', 'chkMins', 'chkSecs');
  }
}

document.getElementById('vfScreenshot').addEventListener('change', function(e){
  let file = e.target.files[0];
  if(!file) return;
  let reader = new FileReader();
  reader.onload = function(ev){
    let img = new Image();
    img.onload = function(){
      let canvas = document.createElement('canvas');
      let max_size = 900;
      let width = img.width, height = img.height;
      if(width > height){ if(width > max_size){ height *= max_size/width; width = max_size; } }
      else { if(height > max_size){ width *= max_size/height; height = max_size; } }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      VF_SCREENSHOT = canvas.toDataURL('image/jpeg', 0.7);
      document.getElementById('vfPreview').innerHTML = `<img src="${VF_SCREENSHOT}" style="width:100px;height:100px;object-fit:cover;border-radius:8px">`;
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function setDist(id,type,key,val){
  let p = PROD.find(x=>x.id==id);
  let opt = CHK_OPTS[id];
  let totalQty = CART[id];

  val = +val || 0;
  opt[type][key] = val;

  let sum = Object.values(opt[type]).reduce((a,b)=>a+b,0);

  if(sum > totalQty){
    toast('المجموع ماينفعش يزيد عن '+totalQty);
    opt[type][key] = totalQty - (sum - val);
  }
  toCheckout(); 
}

function calc(){
  let sub=0, bulkSave=0;
  Object.keys(CART).forEach(id=>{
    let p=PROD.find(x=>x.id==id);
    if(!p) return;
    let qty = CART[id];
    let normalPrice = p.disc && p.disc < p.v? p.disc : p.v;
    let itemPrice = getPrice(p, qty);
    let itemTotal = itemPrice * qty;
    let normalTotal = normalPrice * qty;

    if(p.bulk_on && qty >= p.bulk_qty){
      bulkSave += normalTotal - itemTotal; 
    }
    sub += itemTotal;
  });

  let ship=+cg.value||0;
  let discountAmount = sub * (COUPON / 100);
  LAST={sub,ship,tot:sub+ship-discountAmount, bulkSave: bulkSave}; 

  sum.innerHTML=`<hr><table style="background:transparent">
    <tr><td>المنتجات</td><td><b>${sub.toFixed(1)}</b></td></tr>
    ${bulkSave>0?`<tr><td style="color:#22c55e">خصم الكمية</td><td style="color:#22c55e"><b>-${bulkSave.toFixed(1)}</b></td></tr>`:''}
    <tr><td>الشحن</td><td><b>${ship}</b></td></tr>
    ${COUPON>0?`<tr><td>خصم الكوبون</td><td style="color:var(--green)">-%${COUPON} (-${discountAmount.toFixed(1)})</td></tr>`:''}
    <tr><td><b>الإجمالي</b></td><td><b style="color:var(--main);font-size:20px">${LAST.tot.toFixed(1)} جنيه</b></td></tr></table>`;
}

function applyCoupon(){if(coupon.value==SET.cpCode){COUPON=+SET.cpVal;toast(`%${COUPON} OK`)}else{COUPON=0;toast('Error')};calc()}

async function finish(){
  if(!cn.value) return toast('من فضلك اكتب الاسم');
  if(!cp.value) return toast('من فضلك اكتب الموبايل');
  if(!ca.value) return toast('من فضلك اكتب العنوان');
  if(!cg.value) return toast('من فضلك اختار المحافظة');

  let items=[];
  for(let id in CART){
    let p=PROD.find(x=>x.id==id);
    let opt=CHK_OPTS[id];
    let price = getPrice(p, CART[id]);
    let sizeSum = Object.values(opt.sizes).reduce((a,b)=>a+b,0);
    let colorSum = Object.values(opt.colors).reduce((a,b)=>a+b,0);
    let customSum = Object.values(opt.custom||{}).reduce((a,b)=>a+b,0);
    if(sizeSum!= CART[id]) return toast(`مجموع المقاسات لازم يساوي ${CART[id]} للمنتج ${p.n}`);
    if(colorSum!= CART[id]) return toast(`مجموع الالوان لازم يساوي ${CART[id]} للمنتج ${p.n}`);
    if(p.customVariants && p.customVariants.length && customSum!= CART[id]) return toast(`مجموع ${p.customVariants[0].name} لازم يساوي ${CART[id]} للمنتج ${p.n}`);
    if(CART[id]>p.stock)return toast(`${i18n[LANG].max_stock} ${p.stock}`);
    items.push({id:id,n:p.n,d:p.d||'',v:price,q:CART[id],cost:p.cost||0,sizes:opt.sizes,colors:opt.colors,custom:opt.custom||{}});
    
    p.stock-=CART[id];
    for(let c in opt.colors){ if(p.stockByColor && p.stockByColor[c]) p.stockByColor[c] -= opt.colors[c]; }
    for(let s in opt.sizes){ if(p.stockBySize && p.stockBySize[s]) p.stockBySize[s] -= opt.sizes[s]; }
    if(p.customVariants){ for(let cv of p.customVariants){ if(opt.custom && opt.custom[cv.name]) cv.stock -= opt.custom[cv.name]; } }

    let stockUpdate = {stock: p.stock};
    if(p.stockByColor) stockUpdate.stockByColor = p.stockByColor;
    if(p.stockBySize) stockUpdate.stockBySize = p.stockBySize;
    if(p.customVariants) stockUpdate.customVariants = p.customVariants;
    await setDoc(doc(db, "products", id), stockUpdate, {merge: true});
  }

  let newOrder = {
    items,
    subtotal: LAST.sub,
    bulkDiscount: LAST.bulkSave || 0,
    coupon: LAST.sub * (COUPON / 100),
    ship: LAST.ship,
    tot:LAST.tot,
    st:'new',
    c:{n:cn.value,p:cp.value,p2:(SET.altPhoneOn?document.getElementById('cp2').value:''),a:ca.value,g:cg.options[cg.selectedIndex].text}
  };
  if(SET.vodafoneOn && VF_SCREENSHOT){ newOrder.paymentMethod='vodafone'; newOrder.paymentScreenshot=VF_SCREENSHOT; }

  if(typeof fbq !== 'undefined' && SET.fbPixelId) { fbq('track', 'Purchase', { value: LAST.tot, currency: 'EGP' }); }
  if(typeof TMTK !== 'undefined' && SET.tiktokPixelId) { TMTK.push(['track', 'CompletePayment', { value: LAST.tot, currency: 'EGP' }]); }

  await saveOrderToCloud(newOrder);
  CART={};CHK_OPTS={};COUPON=0;VF_SCREENSHOT=null;updC();toast('تم الطلب بنجاح ');cn.value=cp.value=ca.value='';
  window.location.hash = "";
  go('store');
}

pi.onchange = e => {
  let files = Array.from(e.target.files);
  if(!files.length) return;
  
  files.forEach(file => {
    let type = file.type.startsWith('video/') ? 'video' : 'image';
    
    if (type === 'video') {
      if (file.size > 10 * 1024 * 1024) {
        toast('الفيديو مساحته كبيرة جداً! الحد الأقصى 10 ميجابايت');
        return;
      }
      let r = new FileReader();
      r.onload = ev => {
        TMP_MEDIA.push({ type: 'video', src: ev.target.result });
        renderPreviewGallery();
      };
      r.readAsDataURL(file);
    } else {
      let reader = new FileReader();
      reader.onload = function (event) {
        let img = new Image();
        img.onload = function () {
          let canvas = document.createElement('canvas');
          let max_size = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > max_size) { height *= max_size / width; width = max_size; }
          } else {
            if (height > max_size) { width *= max_size / height; height = max_size; }
          }
          canvas.width = width;
          canvas.height = height;
          let ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          let dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          TMP_MEDIA.push({ type: 'image', src: dataUrl });
          renderPreviewGallery();
        }
        img.src = event.target.result;
      }
      reader.readAsDataURL(file);
    }
  });
};

