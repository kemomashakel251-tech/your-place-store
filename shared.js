// ============================================================
// shared.js — common state + logic for index.html / product.html / checkout.html
// Cart is persisted to localStorage so it survives real page navigation
// between the separate pages of the site.
// ============================================================

let SET={"name":"yourplace_مكانك","wa":"2010","theme":"#2563EB","gov":[{"n":"العاصمة","v":50}],"categories":[{"id":"all","n":"الكل"},{"id":"electronics","n":"إلكترونيات"},{"id":"fashion","n":"أزياء"},{"id":"cosmetics","n":"تجميل"}],"cpOn":false,"cpCode":"SALE50","cpVal":10,"skipCart":false,"clientNote":"","fakeCounterOn":true,"fakeCounterNum":15,"countDownOn":true,"countDownHours":2,"countDownMins":30,"countDownSecs":0,"countDownText":"ينتهي العرض الخاص خلال","fbPixelId":"","tiktokPixelId":"","vodafoneOn":false,"vodafoneNumber":"","shippingPolicyOn":false,"shippingPolicyText":"","altPhoneOn":false};
let PROD=[];
let currentFilter = 'all';
let CART = JSON.parse(localStorage.getItem('cart') || '{}');
let LANG = localStorage.lang || 'ar';
let timerIntervalGlobal = null;
let db;
let pixelsInitialized = false;
let visitCounted = false;

const i18n = {
  ar: {
    nav_store: "المتجر", nav_cart: "السلة",
    show_stock_lbl: "اظهار المخزون الكلي للعميل ✓", sizes: "المقاسات", colors: "الالوان",
    checkout_title: "إتمام الطلب", shipping_info: "بيانات الشحن", apply_btn: "تطبيق", confirm_order: "تأكيد الطلب", cancel_btn: "إلغاء", count_lbl: "العدد",
    empty_cart: "السلة فارغة", item_out: "المنتج نفذ", added_cart: "تم الإضافة للسلة", max_stock: "المخزون الكلي المتاح فقط", select_size: "اختار مقاس لـ", select_color: "اختار لون لـ",
    ordered_msg: "تم الطلب بنجاح", currency: "جنيه", pcs: "قطعة",
    placeholder_name: "الاسم بالكامل", placeholder_phone: "رقم الموبايل", placeholder_address: "العنوان بالتفصيل", placeholder_coupon: "كود الكوبون", select_gov: "اختار المحافظة"
  },
  en: {
    nav_store: "Store", nav_cart: "Cart",
    show_stock_lbl: "Show stock to client ✓", sizes: "Sizes", colors: "Colors",
    checkout_title: "Checkout", shipping_info: "Shipping Information", apply_btn: "Apply", confirm_order: "Confirm Order", cancel_btn: "Cancel", count_lbl: "Count",
    empty_cart: "Cart is empty", item_out: "Out of stock", added_cart: "Added to cart", max_stock: "Available stock limit reached", select_size: "Select size for ", select_color: "Select color for ",
    ordered_msg: "Order placed successfully", currency: "EGP", pcs: "Pcs",
    placeholder_name: "Full Name", placeholder_phone: "Mobile Number", placeholder_address: "Detailed Address", placeholder_coupon: "Coupon Code", select_gov: "Select Governorate"
  }
};

function toast(t){let e=document.getElementById('toast');if(!e)return;e.innerText=t;e.style.display='block';setTimeout(()=>e.style.display='none',2500)}

function applyTheme(color){
  document.documentElement.style.setProperty('--main', color);
  document.documentElement.style.setProperty('--main-dark', color + 'cc');
}

function updateLangDOM(){
  let h = document.getElementById('htmlTag');
  if(h){
    h.setAttribute('lang', LANG);
    h.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');
  }
  let langBtn = document.getElementById('langBtn');
  if(langBtn) langBtn.innerText = LANG === 'ar' ? 'EN' : 'AR';

  document.querySelectorAll('[data-key]').forEach(el => {
    let key = el.getAttribute('data-key');
    if(i18n[LANG][key]) el.innerText = i18n[LANG][key];
  });

  let cn=document.getElementById('cn'), cp=document.getElementById('cp'), ca=document.getElementById('ca'), coupon=document.getElementById('coupon');
  if(cn) cn.placeholder = i18n[LANG].placeholder_name;
  if(cp) cp.placeholder = i18n[LANG].placeholder_phone;
  if(ca) ca.placeholder = i18n[LANG].placeholder_address;
  if(coupon) coupon.placeholder = i18n[LANG].placeholder_coupon;
}

function toggleLang(){
  LANG = LANG === 'ar' ? 'en' : 'ar';
  localStorage.lang = LANG;
  updateLangDOM();
  if(typeof onLangChange === 'function') onLangChange();
}

function getPrice(p, qty=1){
  let price = p.disc && p.disc < p.v? p.disc : p.v;
  if(p.bulk_on && qty >= p.bulk_qty){ price = price * (1 - p.bulk_disc/100); }
  return price;
}

// ---------------- Cart (persisted across pages via localStorage) ----------------
function saveCart(){ localStorage.setItem('cart', JSON.stringify(CART)); }

function cleanCart(){
  let changed = false;
  Object.keys(CART).forEach(id => {
    if(!PROD.find(p => p.id == id)){ delete CART[id]; changed = true; }
  });
  if(changed) saveCart();
}

function updateCartBadge(){
  let total = Object.values(CART).reduce((a,b)=>a+b,0);
  document.querySelectorAll('.cart-badge').forEach(el => el.innerText = total);
}

function renderCartDrawer(){
  let cItemsEl = document.getElementById('cItems');
  if(!cItemsEl) return;
  let items=Object.keys(CART).map(id=>({id:id,p:PROD.find(x=>x.id==id),q:CART[id]})).filter(x=>x.p);
  cItemsEl.innerHTML=items.map(x=>{
    let firstMedia = x.p.media && x.p.media[0] ? x.p.media[0] : {type:'image', src:'https://via.placeholder.com/200'};
    let previewTag = firstMedia.type === 'video' ? `<video src="${firstMedia.src}" muted></video>` : `<img src="${firstMedia.src}">`;
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

function cartToggle(){
  let c = document.getElementById('cart');
  if(!c) return;
  c.style.display = c.style.display=='block'?'none':'block';
  renderCartDrawer();
}

function addC(id){
  let p=PROD.find(x=>x.id==id);
  if(!p){ toast('المنتج مش موجود'); return false; }
  if(p.stock<=0){ toast('خلص'); return false; }
  let max = p.maxQty || 999;
  if((CART[id]||0) >= max){ toast(`اقصى عدد من ${p.n} هو ${max} قطعة`); return false; }
  CART[id]=(CART[id]||0)+1;
  saveCart();
  if(SET.skipCart){ window.location.href='checkout.html'; return true; }
  updateCartBadge(); renderCartDrawer();
  if(typeof onCartChange === 'function') onCartChange();
  toast('تمت الاضافة');
  return true;
}

function delC(id){
  delete CART[id];
  saveCart(); updateCartBadge(); renderCartDrawer();
  if(typeof onCartChange === 'function') onCartChange();
}

function chgQty(id,d){
  let p=PROD.find(x=>x.id==id);
  if(!p)return delC(id);
  let newQ=(CART[id]||0)+d;
  if(newQ<1)return delC(id);
  let max = p.maxQty || 999;
  if(newQ > max) return toast(`اقصى عدد من ${p.n} هو ${max} قطعة`);
  if(newQ>p.stock)return toast(`${i18n[LANG].max_stock}: ${p.stock}`);
  CART[id]=newQ;
  saveCart(); updateCartBadge(); renderCartDrawer();
  if(typeof onCartChange === 'function') onCartChange();
}

function goToCheckout(){
  if(!Object.keys(CART).length) return alert('السلة فاضية');
  window.location.href = 'checkout.html';
}

// ---------------- Categories / filter (index.html only, guarded) ----------------
function renderCategoriesDOM() {
  if(!SET.categories) SET.categories = [{"id":"all","n":"الكل"}];
  let storeBar = document.getElementById('storeCatBar');
  if(storeBar) {
    storeBar.innerHTML = SET.categories.map(c => {
      let activeClass = currentFilter === c.id ? 'active' : '';
      return `<button class="opt-btn ${activeClass}" onclick="filterCat('${c.id}', this)">${c.n}</button>`;
    }).join('');
  }
}

function filterCat(catName, btnElement) {
  currentFilter = catName;
  btnElement.parentElement.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
  btnElement.classList.add('active');
  if(typeof drawStore === 'function') drawStore();
}

// ---------------- Countdown timer ----------------
function startDynamicTimer(hoursContainerId, minsContainerId, secsContainerId) {
  if(timerIntervalGlobal) clearInterval(timerIntervalGlobal);
  let configH = parseInt(SET.countDownHours) || 2;
  let configM = parseInt(SET.countDownMins) || 30;
  let configS = parseInt(SET.countDownSecs) || 0;
  let totalConfigSeconds = (configH * 3600) + (configM * 60) + configS;
  let targetTimestamp = localStorage.getItem('yourplace_timer_target');
  let now = Math.floor(Date.now() / 1000);

  if (!targetTimestamp || parseInt(targetTimestamp) <= now) {
    targetTimestamp = now + totalConfigSeconds;
    localStorage.setItem('yourplace_timer_target', targetTimestamp);
  }

  function updateDOM() {
    let currentNow = Math.floor(Date.now() / 1000);
    let rem = targetTimestamp - currentNow;
    if (rem <= 0) {
      targetTimestamp = currentNow + totalConfigSeconds;
      localStorage.setItem('yourplace_timer_target', targetTimestamp);
      rem = totalConfigSeconds;
    }
    let h = Math.floor(rem / 3600);
    let m = Math.floor((rem % 3600) / 60);
    let s = rem % 60;
    let hEl = document.getElementById(hoursContainerId);
    let mEl = document.getElementById(minsContainerId);
    let sEl = document.getElementById(secsContainerId);
    if(hEl) hEl.innerText = String(h).padStart(2, '0');
    if(mEl) mEl.innerText = String(m).padStart(2, '0');
    if(sEl) sEl.innerText = String(s).padStart(2, '0');
  }
  updateDOM();
  timerIntervalGlobal = setInterval(updateDOM, 1000);
}

// ---------------- Shipping policy modal ----------------
function showShipPolicy(){
  let el = document.getElementById('shipPolicyText');
  if(el) el.innerText = SET.shippingPolicyText || 'لا توجد سياسة شحن مضافة حالياً.';
  let ov = document.getElementById('shipPolicyOverlay');
  if(ov) ov.style.display='flex';
}
function hideShipPolicy(){ let ov = document.getElementById('shipPolicyOverlay'); if(ov) ov.style.display='none'; }

// ---------------- Bot assistant (shared across all pages) ----------------
let BOT_MSGS = JSON.parse(localStorage.botChat || '[]');
const BOT_QUICK_REPLIES = [
  {label:'🆕 ايه الجديد؟', text:'ايه الجديد في المتجر؟'},
  {label:'🎁 عروض وخصومات', text:'في عروض ولا خصومات دلوقتي؟'},
  {label:'📦 سياسة الشحن', text:'ايه سياسة الشحن والاسترجاع؟'},
  {label:'🚚 مصاريف الشحن', text:'الشحن بكام؟'},
  {label:'💳 طرق الدفع', text:'ايه طرق الدفع المتاحة؟'},
  {label:'📞 كلمونا', text:'عايز اتواصل مع خدمة العملاء'}
];

function renderBotQuick(){
  let box = document.getElementById('botQuick');
  if(!box) return;
  box.innerHTML = BOT_QUICK_REPLIES.map(q => `<button type="button" class="bot-chip" onclick='sendBotQuick(${JSON.stringify(q.text)})'>${q.label}</button>`).join('');
}

function sendBotQuick(text){
  addBotMessage('user', text);
  setTimeout(() => addBotMessage('bot', botReply(text)), 300);
}

function renderBotMessages(){
  let box = document.getElementById('botMessages');
  if(!box) return;
  box.innerHTML = BOT_MSGS.map(m => `<div class="bot-msg ${m.from}">${m.text}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function addBotMessage(from, text){
  BOT_MSGS.push({from, text});
  if(BOT_MSGS.length > 60) BOT_MSGS = BOT_MSGS.slice(-60);
  localStorage.botChat = JSON.stringify(BOT_MSGS);
  renderBotMessages();
  let panel = document.getElementById('botPanel');
  if(from === 'bot' && panel && !panel.classList.contains('on')){
    let badge = document.getElementById('botBadge');
    if(badge) badge.style.display = 'block';
  }
}

function toggleBotPanel(){
  let panel = document.getElementById('botPanel');
  if(!panel) return;
  panel.classList.toggle('on');
  let nameEl = document.getElementById('botStoreName');
  if(nameEl) nameEl.innerText = SET.name || 'المتجر';
  if(panel.classList.contains('on')){
    let badge = document.getElementById('botBadge');
    if(badge) badge.style.display = 'none';
    renderBotQuick();
    if(BOT_MSGS.length === 0){
      addBotMessage('bot', `أهلاً بيك في ${SET.name || 'متجرنا'} 👋 تقدر تسألني عن المنتجات، العروض، الشحن، أو أي حاجة جديدة في المتجر.`);
    } else {
      renderBotMessages();
    }
    let input = document.getElementById('botInput');
    if(input) input.focus();
  }
}

function sendBotMsg(){
  let input = document.getElementById('botInput');
  if(!input) return;
  let text = input.value.trim();
  if(!text) return;
  addBotMessage('user', text);
  input.value = '';
  setTimeout(() => addBotMessage('bot', botReply(text)), 300);
}

function botReply(text){
  let t = text.toLowerCase();
  if(/مرحبا|اهلا|هاي|hello|hi\b|السلام عليكم/.test(t)){
    return `أهلاً بيك في ${SET.name || 'متجرنا'} 👋 اسألني عن أي حاجة تحب تعرفها.`;
  }
  if(/شكرا|متشكر|thanks|تسلم/.test(t)){
    return 'العفو 🌸 تحت أمرك في أي وقت.';
  }
  if(/سياسة الشحن|سياسه الشحن|استرجاع|ارجاع|استبدال/.test(t)){
    if(SET.shippingPolicyOn && SET.shippingPolicyText) return '📦 سياسة الشحن:\n' + SET.shippingPolicyText;
    return 'لسه مفيش سياسة شحن مفصّلة متاحة دلوقتي، تقدر تتواصل معانا عشان أي استفسار.';
  }
  if(/جديد|احدث|وصل/.test(t)){
    if(!PROD.length) return 'لسه مفيش منتجات مضافة في المتجر حالياً.';
    let latest = PROD.slice(-3);
    return 'أحدث المنتجات عندنا:\n' + latest.map(p => `• ${p.n} - ${p.disc && p.disc<p.v? p.disc : p.v} ${i18n[LANG].currency}`).join('\n');
  }
  if(/قسم|اقسام|فئات|تصنيف/.test(t)){
    if(SET.categories && SET.categories.length) return 'أقسام المتجر:\n' + SET.categories.map(c=>`• ${c}`).join('\n');
    return 'المنتجات عندنا معروضة كلها في صفحة المتجر الرئيسية.';
  }
  if(/عرض|خصم|كوبون|تخفيض/.test(t)){
    let parts = [];
    if(SET.cpOn && SET.cpCode) parts.push(`فيه كود خصم شغال دلوقتي: ${SET.cpCode} (خصم ${SET.cpVal || ''}%)، جربه في صفحة الدفع.`);
    let discounted = PROD.filter(p => p.disc && p.disc < p.v).slice(0,3);
    if(discounted.length) parts.push('منتجات عليها خصم:\n' + discounted.map(p=>`• ${p.n}: ${p.v} → ${p.disc} ${i18n[LANG].currency}`).join('\n'));
    if(SET.countDownOn && SET.countDownText) parts.push(`⏰ ${SET.countDownText}`);
    return parts.length? parts.join('\n\n') : 'مفيش عروض خاصة دلوقتي، لكن تابعنا عشان تعرف أول بأول.';
  }
  if(/شحن|توصيل|تشحن/.test(t)){
    let parts = [];
    if(SET.gov && SET.gov.length) parts.push('أسعار الشحن حسب المحافظة:\n' + SET.gov.map(g=>`• ${g.n}: ${g.v} ${i18n[LANG].currency}`).join('\n'));
    if(SET.shippingPolicyOn && SET.shippingPolicyText) parts.push('📦 سياسة الشحن:\n' + SET.shippingPolicyText);
    return parts.length ? parts.join('\n\n') : 'التوصيل متاح لكل المحافظات، هيتقالك السعر بالظبط في صفحة الدفع.';
  }
  if(/فودافون|كاش|دفع/.test(t)){
    if(SET.vodafoneOn && SET.vodafoneNumber) return `الدفع متاح عن طريق فودافون كاش على الرقم ${SET.vodafoneNumber}، أو الدفع عند الاستلام.`;
    return 'الدفع متاح عند استلام الأوردر.';
  }
  if(/طلبي|اوردر|فين طلبي|حالة الطلب/.test(t)){
    return 'تقدر تتابع حالة طلبك بسهولة عن طريق التواصل معانا على الواتساب وذكر اسمك ورقم الموبايل اللي طلبت بيه.';
  }
  if(/مقاس|مقاسات|لون|الوان/.test(t)){
    return 'المقاسات والألوان المتاحة لكل منتج موجودة جوه صفحة المنتج نفسه.';
  }
  if(/واتساب|تواصل|اتصال|رقم التليفون/.test(t)){
    return 'تقدر تتواصل معانا مباشرة من زرار الواتساب الأخضر 💬 تحت.';
  }
  let matchedProduct = PROD.find(p => p.n && t.includes(p.n.toLowerCase()));
  if(matchedProduct){
    let price = matchedProduct.disc && matchedProduct.disc < matchedProduct.v ? matchedProduct.disc : matchedProduct.v;
    let stockText = matchedProduct.stock > 0 ? 'متوفر' : 'غير متوفر حالياً';
    return `${matchedProduct.n}: ${price} ${i18n[LANG].currency} - ${stockText}`;
  }
  return 'تقدر تسألني عن: المنتجات الجديدة، الأقسام، العروض، سياسة الشحن، أو طرق الدفع. أو كلمنا على الواتساب لو محتاج مساعدة شخص حقيقي 💬';
}

function checkStoreUpdates(){
  let seenRaw = localStorage.botSeenSettings;
  let current = {cpOn:!!SET.cpOn, cpCode:SET.cpCode||'', shippingPolicyOn:!!SET.shippingPolicyOn, countDownOn:!!SET.countDownOn, countDownText:SET.countDownText||'', vodafoneOn:!!SET.vodafoneOn};
  if(seenRaw === undefined){ localStorage.botSeenSettings = JSON.stringify(current); return; }
  let seen = JSON.parse(seenRaw || '{}');
  let msgs = [];
  if(current.cpOn && (!seen.cpOn || seen.cpCode !== current.cpCode) && current.cpCode) msgs.push(`🎁 في كود خصم جديد شغال دلوقتي: ${current.cpCode}`);
  if(current.shippingPolicyOn && !seen.shippingPolicyOn) msgs.push('📦 تمت إضافة سياسة شحن جديدة، اسألني عنها لو حابب.');
  if(current.countDownOn && (!seen.countDownOn || seen.countDownText !== current.countDownText) && current.countDownText) msgs.push(`⏰ عرض جديد: ${current.countDownText}`);
  if(current.vodafoneOn && !seen.vodafoneOn) msgs.push('💜 بقى متاح الدفع بفودافون كاش دلوقتي.');
  msgs.forEach(m => addBotMessage('bot', m));
  localStorage.botSeenSettings = JSON.stringify(current);
}

function checkNewProducts(){
  let seenRaw = localStorage.botSeenProducts;
  let currentIds = PROD.map(p=>p.id);
  if(seenRaw === undefined){
    localStorage.botSeenProducts = JSON.stringify(currentIds);
    return;
  }
  let seen = JSON.parse(seenRaw || '[]');
  let newOnes = PROD.filter(p => !seen.includes(p.id));
  if(newOnes.length && seen.length){
    newOnes.forEach(p=>{
      let price = p.disc && p.disc<p.v? p.disc : p.v;
      addBotMessage('bot', `🆕 وصل منتج جديد للمتجر: ${p.n} بسعر ${price} ${i18n[LANG].currency}`);
    });
  }
  localStorage.botSeenProducts = JSON.stringify(currentIds);
}

// ---------------- Firebase init (shared by every page) ----------------
// Each page can define window.onSettingsLoaded / window.onProductsLoaded
// before calling initApp() to hook into the data lifecycle.
function initApp(){
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js").then(({ initializeApp }) => {
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then(({ getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp, increment }) => {
    const app = initializeApp({apiKey: "AIzaSyA1E6agTbU1Tmyn8I8n3ygl8C3Rz7SNRgg",authDomain: "yourplace-31bd8.firebaseapp.com",projectId: "yourplace-31bd8",storageBucket: "yourplace-31bd8.firebasestorage.app",messagingSenderId: "774952140342",appId: "1:774952140342:web:1f45cdbd0897e1884c2297"});
    db = getFirestore(app);
    window.db = db;
    window.setDoc = setDoc; window.doc = doc; window.getDoc = getDoc; window.getDocs = getDocs;
    window.collection = collection; window.addDoc = addDoc; window.serverTimestamp = serverTimestamp; window.increment = increment;
    window.saveOrderToCloud = async function(order){ await addDoc(collection(db, "orders"), {...order, createdAt: serverTimestamp()}); };

    // Live settings fetch
    onSnapshot(doc(db, "settings", "main"), (snap) => {
      if(snap.exists()){
        SET = snap.data();
        applyTheme(SET.theme);
        let sNameEl = document.getElementById('sName');
        if(sNameEl) sNameEl.innerText = SET.name || 'yourplace_مكانك';
        let waEl = document.getElementById('waFloat');
        if(SET.wa && waEl) waEl.href = `https://wa.me/${SET.wa}`;
        renderCategoriesDOM();
        updateLangDOM();
        checkStoreUpdates();

        if(!pixelsInitialized){
          pixelsInitialized = true;
          if(SET.fbPixelId && typeof fbq !== 'undefined'){ fbq('init', SET.fbPixelId); fbq('track', 'PageView'); }
          if(SET.tiktokPixelId && typeof TMTK !== 'undefined' && TMTK.load){ TMTK.load(SET.tiktokPixelId); TMTK.push(['track', 'PageView']); }
        }
        if(typeof window.onSettingsLoaded === 'function') window.onSettingsLoaded();
      }
    });

    // حمّل الإعدادات المتقدمة (كود الهيد) وحقنه في الصفحة
    window.getDoc(window.doc(db, "settings", "advanced")).then(snap => {
      if(snap && snap.exists && snap.exists()){
        let adv = snap.data();
        if(adv.headerCode && adv.headerCode.trim()){
          let temp = document.createElement('div');
          temp.innerHTML = adv.headerCode;
          Array.from(temp.childNodes).forEach(node => {
            if(node.tagName === 'SCRIPT'){
              // سكريبت متحط عن طريق innerHTML ماينفعش يتنفذ لوحده، فبنعمله من جديد
              let s = document.createElement('script');
              Array.from(node.attributes).forEach(a => s.setAttribute(a.name, a.value));
              s.text = node.textContent;
              document.head.appendChild(s);
            } else {
              document.head.appendChild(node.cloneNode ? node.cloneNode(true) : node);
            }
          });
        }
      }
    }).catch(()=>{});

    // عداد زيارات المتجر - يزيد مرة واحدة لكل تحميل للصفحة
    if(!visitCounted){
      visitCounted = true;
      setDoc(doc(db, "settings", "stats"), { visits: increment(1) }, { merge: true }).catch(()=>{});
    }

    // Products fetch (one-time + periodic refresh instead of a permanent live listener)
    async function loadProducts(){
      let snapshot = await getDocs(collection(db, "products"));
      PROD = [];
      snapshot.forEach((d) => { PROD.push({id: d.id,...d.data()}); });
      cleanCart();
      updateCartBadge();
      checkNewProducts();
      if(typeof window.onProductsLoaded === 'function') window.onProductsLoaded();
    }
    window.loadProducts = loadProducts;
    loadProducts();
    // مفيش polling — بيتحدث مرة واحدة عند دخول الصفحة بس
  })});
}
