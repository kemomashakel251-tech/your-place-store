// ============================================================
// shared.js — common state + logic for index.html / product.html / checkout.html
// Cart is persisted to localStorage so it survives real page navigation
// between the separate pages of the site.
// ============================================================

let SET={"name":"yourplace_مكانك","wa":"2010","theme":"#2563EB","gov":[{"n":"العاصمة","v":50}],"categories":[{"id":"all","n":"الكل"},{"id":"electronics","n":"إلكترونيات"},{"id":"fashion","n":"أزياء"},{"id":"cosmetics","n":"تجميل"}],"cpOn":false,"cpCode":"SALE50","cpVal":10,"skipCart":false,"clientNote":"","fakeCounterOn":true,"fakeCounterNum":15,"countDownOn":true,"countDownHours":2,"countDownMins":30,"countDownSecs":0,"countDownText":"ينتهي العرض الخاص خلال","fbPixelId":"","tiktokPixelId":"","vodafoneOn":false,"vodafoneNumber":"","shippingPolicyOn":false,"shippingPolicyText":"","altPhoneOn":false};
let PROD=[];
// عرض فوري من الكاش (لو موجود) لحد ما البيانات الحية توصل من Firebase،
// ده بيقلل زمن ظهور أول محتوى (LCP) بشكل كبير على الزيارات المتكررة
try{
  let cachedSet = localStorage.getItem('cache_settings');
  if(cachedSet) SET = JSON.parse(cachedSet);
}catch(e){}
try{
  let cachedProd = localStorage.getItem('cache_products');
  if(cachedProd) PROD = JSON.parse(cachedProd);
}catch(e){}
let currentFilter = 'all';
let CART = JSON.parse(localStorage.getItem('cart') || '{}');
let LANG = localStorage.lang || 'ar';
let timerIntervalGlobal = null;
let db;
let pixelsInitialized = false;
let visitCounted = false;

const i18n = {
  ar: {
    nav_store: "المتجر", nav_cart: "السلة", nav_ship_policy: "سياسة الشحن", nav_about: "من نحن",
    show_stock_lbl: "اظهار المخزون الكلي للعميل ✓", sizes: "المقاسات", colors: "الالوان",
    checkout_title: "إتمام الطلب", shipping_info: "بيانات الشحن", apply_btn: "تطبيق", confirm_order: "تأكيد الطلب", cancel_btn: "إلغاء", count_lbl: "العدد",
    empty_cart: "السلة فارغة", item_out: "المنتج نفذ", added_cart: "تم الإضافة للسلة", max_stock: "المخزون الكلي المتاح فقط", select_size: "اختار مقاس لـ", select_color: "اختار لون لـ",
    ordered_msg: "تم الطلب بنجاح", currency: "جنيه", pcs: "قطعة",
    placeholder_name: "الاسم بالكامل", placeholder_phone: "رقم الموبايل", placeholder_address: "العنوان بالتفصيل", placeholder_coupon: "كود الكوبون", select_gov: "اختار المحافظة"
  },
  en: {
    nav_store: "Store", nav_cart: "Cart", nav_ship_policy: "Shipping Policy", nav_about: "About Us",
    show_stock_lbl: "Show stock to client ✓", sizes: "Sizes", colors: "Colors",
    checkout_title: "Checkout", shipping_info: "Shipping Information", apply_btn: "Apply", confirm_order: "Confirm Order", cancel_btn: "Cancel", count_lbl: "Count",
    empty_cart: "Cart is empty", item_out: "Out of stock", added_cart: "Added to cart", max_stock: "Available stock limit reached", select_size: "Select size for ", select_color: "Select color for ",
    ordered_msg: "Order placed successfully", currency: "EGP", pcs: "Pcs",
    placeholder_name: "Full Name", placeholder_phone: "Mobile Number", placeholder_address: "Detailed Address", placeholder_coupon: "Coupon Code", select_gov: "Select Governorate"
  }
};

function toast(t){let e=document.getElementById('toast');if(!e)return;e.innerText=t;e.style.display='block';setTimeout(()=>e.style.display='none',2500)}

// أي نص جاي من المستخدم (اسم منتج، وصف، اسم عميل، مقاس/لون مكتوب يدوي...) لازم
// يتعدّى من هنا قبل ما يتحط جوه innerHTML، عشان محدش يقدر يحقن HTML/سكريبت
// (XSS) عن طريق اسم منتج أو بيانات طلب.
function esc(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeImg(url){
  let fallback = 'https://via.placeholder.com/200';
  if(!url || typeof url !== 'string') return fallback;
  let trimmed = url.trim();
  if(!/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) return fallback;
  return esc(trimmed);
}

function applyTheme(color){
  document.documentElement.style.setProperty('--main', color);
  document.documentElement.style.setProperty('--main-dark', color + 'cc');
}

// أيقونات SVG بسيطة لأشهر منصات التواصل — بتتحط جوه دوائر ملوّنة بألوان كل
// منصة (facebook/instagram/tiktok/whatsapp)، بدل الإيموجي العام اللي كان
// مستخدم قبل كده.
const ICON_WA = `<svg viewBox="0 0 24 24" width="26" height="26" fill="#fff"><path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2zm5.8 14.14c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.8-.11-.42-.13-.95-.31-1.64-.61-2.88-1.24-4.76-4.15-4.9-4.35-.14-.19-1.17-1.56-1.17-2.98s.75-2.11 1.01-2.4c.26-.28.58-.35.77-.35l.55.01c.18.01.42-.07.65.5.24.58.82 2.01.9 2.15.07.15.12.32.02.51-.1.19-.15.32-.29.49-.14.17-.3.39-.43.53-.14.15-.29.3-.13.59.17.28.74 1.22 1.58 1.98 1.09.97 2.01 1.27 2.29 1.42.29.14.46.12.63-.08.17-.2.73-.85.93-1.14.19-.29.38-.24.65-.14.26.09 1.67.79 1.96.93.29.14.48.21.55.34.07.13.07.73-.17 1.43z"/></svg>`;
const ICON_FB = `<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/></svg>`;
const ICON_TIKTOK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M16.5 2.5c.4 2.2 1.9 3.9 4.2 4.2v3.2c-1.5 0-2.9-.4-4.2-1.3v6.8c0 3.5-2.8 6.3-6.3 6.3S4 18.9 4 15.4c0-3.4 2.7-6.2 6-6.3v3.3c-1.6.1-2.9 1.4-2.9 3 0 1.7 1.4 3.1 3.1 3.1s3.1-1.4 3.1-3.1V2.5h3.2z"/></svg>`;
const ICON_INSTA = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.4" cy="6.6" r="1.1" fill="#fff" stroke="none"/></svg>`;

// بتتحط جوه أي صفحة عندها <div id="socialIconsBar">، وبتتظهر تلقائي لو
// الأدمن ضاف أي رابط منهم في الإعدادات (فيسبوك/انستجرام/تيك توك).
function renderSocialIconsBar(){
  let bar = document.getElementById('socialIconsBar');
  if(!bar) return;
  let icons = [];
  if(SET.fbUrl) icons.push(`<a class="social-icon-btn fb" href="${esc(SET.fbUrl)}" target="_blank" rel="noopener" title="فيسبوك">${ICON_FB}</a>`);
  if(SET.instaUrl) icons.push(`<a class="social-icon-btn insta" href="${esc(SET.instaUrl)}" target="_blank" rel="noopener" title="انستجرام">${ICON_INSTA}</a>`);
  if(SET.tiktokUrl) icons.push(`<a class="social-icon-btn tiktok" href="${esc(SET.tiktokUrl)}" target="_blank" rel="noopener" title="تيك توك">${ICON_TIKTOK}</a>`);
  bar.innerHTML = icons.length ? `<div class="social-icons-bar">${icons.join('')}</div>` : '';
}

// بتتحط جوه أي صفحة عندها عناصر بالاسماء دي: <prefix>TextBox، <prefix>PhonesSection،
// <prefix>PhonesList، وممكن كمان <prefix>Section (حاوية خارجية تتخفي بالكامل لو
// مفيش بيانات) أو <prefix>EmptyMsg (رسالة "لسه مفيش بيانات"). بنستخدمها مرتين:
// مرة بـ prefix='storeAbout' تحت المنتجات في الصفحة الرئيسية، ومرة بـ
// prefix='about' في صفحة "من نحن" المستقلة — نفس البيانات، مكانين مختلفين.
function renderAboutInfo(prefix){
  let textBox = document.getElementById(prefix+'TextBox');
  let phonesSection = document.getElementById(prefix+'PhonesSection');
  let phonesList = document.getElementById(prefix+'PhonesList');
  let emptyMsg = document.getElementById(prefix+'EmptyMsg');
  let wrapper = document.getElementById(prefix+'Section');
  if(!textBox && !phonesSection && !wrapper) return;

  let hasText = !!(SET.aboutText && SET.aboutText.trim());
  if(textBox) textBox.innerText = hasText ? SET.aboutText : '';

  let phones = SET.phones || [];
  if(phonesSection){
    if(phones.length){
      phonesSection.style.display = 'block';
      if(phonesList) phonesList.innerHTML = phones.map(p => `
        <a href="tel:${esc(p.num)}" style="display:flex;align-items:center;gap:10px;background:#f7f8fa;padding:12px 14px;border-radius:12px;text-decoration:none;color:var(--text);font-weight:600">
          <span style="font-size:20px">📞</span>
          <span style="flex:1">${esc(p.label)}</span>
          <span style="direction:ltr;color:var(--main)">${esc(p.num)}</span>
        </a>`).join('');
    } else {
      phonesSection.style.display = 'none';
    }
  }

  let hasSocials = !!(SET.fbUrl || SET.instaUrl || SET.tiktokUrl);
  let hasAnything = hasText || phones.length || hasSocials;
  if(wrapper) wrapper.style.display = hasAnything ? 'block' : 'none';
  if(emptyMsg) emptyMsg.style.display = hasAnything ? 'none' : 'block';
}

function updateLangDOM(){
  let h = document.getElementById('htmlTag');
  if(h){
    h.setAttribute('lang', LANG);
    h.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');
  }
  let langBtn = document.getElementById('langBtn');
  if(langBtn) langBtn.innerText = '🌐';

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
      <div style="flex:1"><b>${esc(x.p.n)}</b><br><span style="color:var(--muted)">${getPrice(x.p, x.q)} ${i18n[LANG].currency}</span></div>
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
      let imgHtml = c.img ? `<img src="${c.img}" alt="${esc(c.n)}">` : '🗂️';
      return `<button class="cat-circle-item ${activeClass}" onclick="filterCat('${c.id}', this)">
        <span class="cat-circle-img">${imgHtml}</span>
        <span class="cat-circle-label">${esc(c.n)}</span>
      </button>`;
    }).join('');
  }
}

function filterCat(catName, btnElement) {
  currentFilter = catName;
  btnElement.parentElement.querySelectorAll('.cat-circle-item').forEach(b => b.classList.remove('active'));
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
  {label:'🛍️ ازاي اطلب؟', text:'ازاي اطلب من المتجر؟'},
  {label:'ℹ️ من نحن', text:'من نحن؟ احكيلي عن المتجر'},
  {label:'📱 السوشيال ميديا', text:'ايه روابط السوشيال ميديا بتاعتكم؟'},
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
      addBotMessage('bot', `أهلاً بيك في ${SET.name || 'متجرنا'} 👋 تقدر تسألني عن المنتجات، العروض، الشحن، طرق الدفع، من نحن، أو أي حاجة تانية في المتجر.`);
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
  if(/من نحن|مين انتوا|مين انتو|عن المتجر|تعرفنا|احكيلي عن/.test(t)){
    if(SET.aboutText && SET.aboutText.trim()) return 'ℹ️ ' + SET.aboutText;
    return `احنا ${SET.name || 'متجر إلكتروني'}، تقدر تعرف أكتر عننا من صفحة "من نحن" فوق.`;
  }
  if(/ارقامكم|ارقام التواصل|رقم تليفون|رقم موبايل|رقم للتواصل|اتصل بيكم|اكلمكم ازاي/.test(t)){
    if(SET.phones && SET.phones.length) return '📞 أرقامنا:\n' + SET.phones.map(p=>`• ${p.label}: ${p.num}`).join('\n');
    if(SET.wa) return `تقدر تكلمنا على الواتساب على الرقم ${SET.wa}.`;
    return 'تقدر تلاقي بيانات التواصل بتاعتنا في صفحة "من نحن".';
  }
  if(/فيسبوك|انستجرام|انستقرام|instagram|facebook|تيك توك|tiktok|سوشيال ميديا|سوشيال|فولو|تابعو/.test(t)){
    let links = [];
    if(SET.fbUrl) links.push('• فيسبوك: ' + SET.fbUrl);
    if(SET.instaUrl) links.push('• انستجرام: ' + SET.instaUrl);
    if(SET.tiktokUrl) links.push('• تيك توك: ' + SET.tiktokUrl);
    if(links.length) return '📱 تابعنا على:\n' + links.join('\n');
    return 'لسه مفيش روابط سوشيال ميديا مضافة، تقدر تلاقي كل بيانات التواصل في صفحة "من نحن".';
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
  if(/عرض|خصم كوبون|كوبون|تخفيض/.test(t)){
    let parts = [];
    if(SET.cpOn && SET.cpCode) parts.push(`فيه كود خصم شغال دلوقتي: ${SET.cpCode} (خصم ${SET.cpVal || ''}%)، جربه في صفحة الدفع.`);
    let discounted = PROD.filter(p => p.disc && p.disc < p.v).slice(0,3);
    if(discounted.length) parts.push('منتجات عليها خصم:\n' + discounted.map(p=>`• ${p.n}: ${p.v} → ${p.disc} ${i18n[LANG].currency}`).join('\n'));
    if(SET.countDownOn && SET.countDownText) parts.push(`⏰ ${SET.countDownText}`);
    return parts.length? parts.join('\n\n') : 'مفيش عروض خاصة دلوقتي، لكن تابعنا عشان تعرف أول بأول.';
  }
  if(/خصم الكمية|شراء بالجملة|بالجمله|اشتري كذا قطعة/.test(t)){
    let bulkProducts = PROD.filter(p => p.bulk_on).slice(0,3);
    if(bulkProducts.length) return '🔥 عندنا خصم كمية على منتجات معينة:\n' + bulkProducts.map(p=>`• ${p.n}: اشتري ${p.bulk_qty} قطع ووفر ${p.bulk_disc}%`).join('\n');
    return 'مفيش خصم كمية متاح دلوقتي على منتجات معينة، لكن تابع صفحة المتجر لآخر تحديث.';
  }
  if(/اقصى كمية|الحد الاقصى|اكبر كمية اطلبها/.test(t)){
    return 'الحد الأقصى للكمية بيختلف من منتج للتاني، هتلاقيه موضّح في صفحة المنتج نفسه.';
  }
  if(/هوصل امتى|مدة التوصيل|معاد التوصيل|هياخد قد ايه|كام يوم التوصيل/.test(t)){
    return 'مدة التوصيل بتختلف حسب المحافظة، وهتلاقي تفاصيلها في سياسة الشحن أو تقدر تسألنا مباشرة على الواتساب.';
  }
  if(/شحن|توصيل|تشحن/.test(t)){
    let parts = [];
    if(SET.gov && SET.gov.length) parts.push('أسعار الشحن حسب المحافظة:\n' + SET.gov.map(g=>`• ${g.n}: ${g.v} ${i18n[LANG].currency}`).join('\n'));
    if(SET.shippingPolicyOn && SET.shippingPolicyText) parts.push('📦 سياسة الشحن:\n' + SET.shippingPolicyText);
    return parts.length ? parts.join('\n\n') : 'التوصيل متاح لكل المحافظات، هيتقالك السعر بالظبط في صفحة الدفع.';
  }
  if(/انستاباي|instapay/.test(t)){
    if(SET.instapayOn && SET.instapayNumber) return `الدفع متاح عن طريق InstaPay على: ${SET.instapayNumber}، وترفع صورة التحويل وقت إتمام الطلب.`;
    return 'الدفع بـ InstaPay مش متاح دلوقتي، بس تقدر تدفع عند الاستلام أو بالطرق التانية المتاحة في صفحة الدفع.';
  }
  if(/فودافون|كاش|طرق الدفع|طريقة الدفع|ادفع ازاي/.test(t)){
    let ways = ['الدفع عند الاستلام (كاش)'];
    if(SET.vodafoneOn && SET.vodafoneNumber) ways.push(`فودافون كاش على الرقم ${SET.vodafoneNumber}`);
    if(SET.instapayOn && SET.instapayNumber) ways.push(`InstaPay على ${SET.instapayNumber}`);
    return '💳 طرق الدفع المتاحة:\n' + ways.map(w=>'• '+w).join('\n');
  }
  if(/ازاي اطلب|طريقة الطلب|كيف اطلب|خطوات الطلب/.test(t)){
    return '🛍️ اطلب بسهولة في 3 خطوات:\n1) اختار المنتج وحدد المقاس/اللون لو موجود واضغط "اضف للسلة"\n2) افتح السلة واضغط "اتمام الطلب"\n3) اكتب بياناتك وأكّد الطلب — وهيتم التواصل معاك لتأكيده.';
  }
  if(/الغاء الطلب|الغي طلبي|عايز الغي/.test(t)){
    return 'تقدر تلغي طلبك بالتواصل معانا في أقرب وقت على الواتساب قبل ما يتم شحنه.';
  }
  if(/ضمان|المنتج فيه عيب|وصلني تالف|منتج معيب/.test(t)){
    return 'لو وصلك منتج فيه أي مشكلة، كلمنا فورًا على الواتساب وهنحل المشكلة معاك.';
  }
  if(/طلبي|اوردر|فين طلبي|حالة الطلب/.test(t)){
    return 'تقدر تتابع حالة طلبك بسهولة عن طريق التواصل معانا على الواتساب وذكر اسمك ورقم الموبايل اللي طلبت بيه.';
  }
  if(/مقاس|مقاسات|لون|الوان/.test(t)){
    return 'المقاسات والألوان المتاحة لكل منتج موجودة جوه صفحة المنتج نفسه.';
  }
  if(/واتساب|تواصل|اتصال/.test(t)){
    return 'تقدر تتواصل معانا مباشرة من زرار الواتساب الأخضر 💬 تحت.';
  }
  let matchedProduct = PROD.find(p => p.n && t.includes(p.n.toLowerCase()));
  if(matchedProduct){
    let price = matchedProduct.disc && matchedProduct.disc < matchedProduct.v ? matchedProduct.disc : matchedProduct.v;
    let stockText = matchedProduct.stock > 0 ? 'متوفر' : 'غير متوفر حالياً';
    return `${matchedProduct.n}: ${price} ${i18n[LANG].currency} - ${stockText}`;
  }
  return 'تقدر تسألني عن: المنتجات الجديدة، الأقسام، العروض، سياسة الشحن، طرق الدفع، من نحن، أرقامنا، أو السوشيال ميديا بتاعتنا. أو كلمنا على الواتساب لو محتاج مساعدة شخص حقيقي 💬';
}

function checkStoreUpdates(){
  let seenRaw = localStorage.botSeenSettings;
  let current = {cpOn:!!SET.cpOn, cpCode:SET.cpCode||'', shippingPolicyOn:!!SET.shippingPolicyOn, countDownOn:!!SET.countDownOn, countDownText:SET.countDownText||'', vodafoneOn:!!SET.vodafoneOn, instapayOn:!!SET.instapayOn};
  if(seenRaw === undefined){ localStorage.botSeenSettings = JSON.stringify(current); return; }
  let seen = JSON.parse(seenRaw || '{}');
  let msgs = [];
  if(current.cpOn && (!seen.cpOn || seen.cpCode !== current.cpCode) && current.cpCode) msgs.push(`🎁 في كود خصم جديد شغال دلوقتي: ${current.cpCode}`);
  if(current.shippingPolicyOn && !seen.shippingPolicyOn) msgs.push('📦 تمت إضافة سياسة شحن جديدة، اسألني عنها لو حابب.');
  if(current.countDownOn && (!seen.countDownOn || seen.countDownText !== current.countDownText) && current.countDownText) msgs.push(`⏰ عرض جديد: ${current.countDownText}`);
  if(current.vodafoneOn && !seen.vodafoneOn) msgs.push('💜 بقى متاح الدفع بفودافون كاش دلوقتي.');
  if(current.instapayOn && !seen.instapayOn) msgs.push('🅿️ بقى متاح الدفع بـ InstaPay دلوقتي.');
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
  Promise.all([
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js")
  ]).then(([{ initializeApp }, { getFirestore, collection, addDoc, doc, getDoc, getDocs, setDoc, onSnapshot, serverTimestamp, increment, runTransaction }, { initializeAppCheck, ReCaptchaV3Provider }]) => {
    const app = initializeApp({apiKey: "AIzaSyA1E6agTbU1Tmyn8I8n3ygl8C3Rz7SNRgg",authDomain: "yourplace-31bd8.firebaseapp.com",projectId: "yourplace-31bd8",storageBucket: "yourplace-31bd8.firebasestorage.app",messagingSenderId: "774952140342",appId: "1:774952140342:web:1f45cdbd0897e1884c2297"});

    // App Check — بيتأكد إن أي طلب واصل لفايربيز جاي فعلاً من موقعك شغال في
    // متصفح حقيقي (مش بوت بيضرب على الـ API مباشرة). REPLACE_WITH_RECAPTCHA_V3_SITE_KEY
    // لازم تتستبدل بالـ Site Key (العام) اللي هتجيبه من:
    // https://www.google.com/recaptcha/admin/create — واختار reCAPTCHA v3.
    // من غير المفتاح ده، السطر ده هيفشل بصمت (catch) ومش هيوقف باقي الموقع.
    try{
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6LegxmMtAAAAAAoggUEM5ivkjMKECr3ozac53X_K'),
        isTokenAutoRefreshEnabled: true
      });
    }catch(e){ console.warn('App Check not initialized:', e); }

    db = getFirestore(app);
    window.db = db;
    window.setDoc = setDoc; window.doc = doc; window.getDoc = getDoc; window.getDocs = getDocs;
    window.collection = collection; window.addDoc = addDoc; window.serverTimestamp = serverTimestamp; window.increment = increment;
    window.runTransaction = runTransaction;
    window.saveOrderToCloud = async function(order){ await addDoc(collection(db, "orders"), {...order, createdAt: serverTimestamp()}); };

    // Settings (main + advanced) fetch — نفس فكرة كاش المنتجات بالظبط: بدل
    // onSnapshot الحي اللي كان بيفتح قراءة لكل زائر جديد ويفضل مستمع، بقى
    // getDoc واحد بس كل نص ساعة (نفس مدة كاش المنتجات)، والصفحات اللي بتتفتح
    // في نفس النص ساعة بتاخد من الكاش المحلي من غير أي قراءة إضافية. الأثر
    // الوحيد: لو الأدمن غيّر إعداد (اسم، لون، سياسة شحن...) والزائر فاتح
    // تاب من قبل التغيير، مش هيشوفه إلا بعد ما الكاش ينتهي أو يعمل تحديث للصفحة.
    const SETTINGS_CACHE_MS = 30 * 60 * 1000; // 30 دقيقة — نفس مدة كاش المنتجات

    function applySettingsToDOM(){
      applyTheme(SET.theme);
      let sNameEl = document.getElementById('sName');
      if(sNameEl){
        if(SET.logoImg){
          sNameEl.innerHTML = `<img src="${SET.logoImg}" alt="${SET.name || ''}" class="store-logo-img">`;
        } else {
          sNameEl.innerText = SET.name || 'yourplace_مكانك';
        }
      }
      let waEl = document.getElementById('waFloat');
      if(SET.wa && waEl) waEl.href = `https://wa.me/${SET.wa}`;
      renderCategoriesDOM();
      updateLangDOM();
      checkStoreUpdates();
      renderSocialIconsBar();
      renderAboutInfo('storeAbout');
      renderAboutInfo('about');

      let shipBtn = document.getElementById('navShipPolicy');
      if(shipBtn) shipBtn.style.display = SET.shippingPolicyOn ? 'inline-flex' : 'none';

      if(!pixelsInitialized){
        pixelsInitialized = true;
        if(SET.fbPixelId && typeof fbq !== 'undefined'){ fbq('init', SET.fbPixelId); fbq('track', 'PageView'); }
        if(SET.tiktokPixelId && typeof TMTK !== 'undefined' && TMTK.load){ TMTK.load(SET.tiktokPixelId); TMTK.push(['track', 'PageView']); }
      }
      if(typeof window.onSettingsLoaded === 'function') window.onSettingsLoaded();
    }

    async function loadSettings(force){
      let cachedAt = +localStorage.getItem('cache_settings_at') || 0;
      let cachedRaw = localStorage.getItem('cache_settings');
      let isFresh = !force && cachedRaw && (Date.now() - cachedAt) < SETTINGS_CACHE_MS;
      if(isFresh){
        try{ SET = JSON.parse(cachedRaw); }catch(e){}
        applySettingsToDOM();
        return;
      }
      let snap = await getDoc(doc(db, "settings", "main"));
      if(snap.exists()){
        SET = snap.data();
        try{
          localStorage.setItem('cache_settings', JSON.stringify(SET));
          localStorage.setItem('cache_settings_at', String(Date.now()));
        }catch(e){}
        applySettingsToDOM();
      }
    }
    window.loadSettings = loadSettings;
    loadSettings();

    // حمّل الإعدادات المتقدمة (كود الهيد) وحقنه في الصفحة — بنفس منطق الكاش
    async function loadAdvancedSettings(force){
      let cachedAt = +localStorage.getItem('cache_settings_adv_at') || 0;
      let cachedHeader = localStorage.getItem('cache_settings_adv_header');
      let isFresh = !force && cachedHeader !== null && (Date.now() - cachedAt) < SETTINGS_CACHE_MS;
      let headerCode = cachedHeader || '';
      if(!isFresh){
        try{
          let snap = await window.getDoc(window.doc(db, "settings", "advanced"));
          if(snap && snap.exists && snap.exists()){
            headerCode = (snap.data().headerCode) || '';
            localStorage.setItem('cache_settings_adv_header', headerCode);
            localStorage.setItem('cache_settings_adv_at', String(Date.now()));
          }
        }catch(e){}
      }
      if(headerCode && headerCode.trim()){
        let temp = document.createElement('div');
        temp.innerHTML = headerCode;
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
    loadAdvancedSettings();

    // عداد زيارات المتجر - يزيد مرة واحدة لكل تحميل للصفحة
    if(!visitCounted){
      visitCounted = true;
      setDoc(doc(db, "settings", "stats"), { visits: increment(1) }, { merge: true }).catch(()=>{});
    }

    // Products fetch — كاش بمدة صلاحية (30 دقيقة) بدل ما نجيب كل المنتجات من
    // فايربيز من جديد في كل فتح صفحة. زائر بيتصفح الرئيسية بعدين منتج بعدين
    // الدفع كان بيعمل 3 قراءات كاملة للكولكشن (يعني لو 50 منتج = 150 قراءة
    // لزيارة واحدة بس). دلوقتي أول صفحة بس هي اللي بتقرا من فايربيز، والصفحات
    // اللي بعدها (لحد 30 دقيقة) بتستخدم نفس النسخة من غير أي قراءة إضافية.
    const PRODUCTS_CACHE_MS = 30 * 60 * 1000; // 30 دقيقة
    async function loadProducts(force){
      let cachedAt = +localStorage.getItem('cache_products_at') || 0;
      let isFresh = !force && (Date.now() - cachedAt) < PRODUCTS_CACHE_MS;
      if(isFresh && PROD.length){
        // الكاش لسه طازة — من غير أي قراءة جديدة من فايربيز
        cleanCart();
        updateCartBadge();
        checkNewProducts();
        if(typeof window.onProductsLoaded === 'function') window.onProductsLoaded();
        return;
      }
      let snapshot = await getDocs(collection(db, "products"));
      PROD = [];
      snapshot.forEach((d) => { PROD.push({id: d.id,...d.data()}); });
      try{
        localStorage.setItem('cache_products', JSON.stringify(PROD));
        localStorage.setItem('cache_products_at', String(Date.now()));
      }catch(e){}
      cleanCart();
      updateCartBadge();
      checkNewProducts();
      if(typeof window.onProductsLoaded === 'function') window.onProductsLoaded();
    }
    window.loadProducts = loadProducts;
    loadProducts();
    // مفيش polling — بيتحدث تلقائي بس لما الكاش تعدت مدته (30 دقيقة) أو حد
    // نده loadProducts(true) يدوي (زي بعد إضافة منتج جديد من الأدمن مثلاً)
  });
}
