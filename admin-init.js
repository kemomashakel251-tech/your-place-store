// admin-init.js — Firebase bootstrap: loads the SDK, wires up
// Firestore reads/writes used by every module above, and Firebase Auth
// (login state -> starts the protected admin listeners). Must load LAST.

let db; 
let collection, addDoc, setDoc, updateDoc, doc, getDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, deleteDoc;

import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js").then(({ initializeApp }) => {
import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js").then((firestore) => {
  
  collection = firestore.collection;
  addDoc = firestore.addDoc;
  setDoc = firestore.setDoc;
  updateDoc = firestore.updateDoc;
  doc = firestore.doc;
  getDoc = firestore.getDoc;
  getDocs = firestore.getDocs;
  onSnapshot = firestore.onSnapshot;
  query = firestore.query;
  orderBy = firestore.orderBy;
  serverTimestamp = firestore.serverTimestamp;
  deleteDoc = firestore.deleteDoc;
  
  const app = initializeApp({
    apiKey: "AIzaSyA1E6agTbU1Tmyn8I8n3ygl8C3Rz7SNRgg",
    authDomain: "yourplace-31bd8.firebaseapp.com",
    projectId: "yourplace-31bd8",
    storageBucket: "yourplace-31bd8.firebasestorage.app",
    messagingSenderId: "774952140342",
    appId: "1:774952140342:web:1f45cdbd0897e1884c2297"
  });

  db = firestore.getFirestore(app);

  window.saveOrderToCloud = async function(order){
    await addDoc(collection(db, "orders"), {...order, id: Date.now(), createdAt: serverTimestamp()});
  }

  // ---- بيانات المتجر: تتحمّل مرة واحدة بس عند الدخول ----
  async function loadProducts(){
    let snapshot = await getDocs(collection(db, "products"));
    PROD = [];
    snapshot.forEach((d) => { PROD.push({id: d.id, ...d.data()}); });
    if(document.getElementById('store').classList.contains('on')) drawStore(); 
    if(document.getElementById('products').classList.contains('on')) drawP(); 
    if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
    checkDeepLinks();
    checkNewProducts();
  }
  window.loadProducts = loadProducts;

  async function loadSettings(){
    let snap = await getDoc(doc(db, "settings", "main"));
    if(snap.exists()){ 
      SET = snap.data(); 
      applyTheme(SET.theme); 
      sName.innerText = SET.name; 
      waFloat.href = `https://wa.me/${SET.wa}`; 
      renderCategoriesDOM();
      checkStoreUpdates();
      if(!pixelsInitialized){
        pixelsInitialized = true;
        if(SET.fbPixelId && typeof fbq !== 'undefined'){ fbq('init', SET.fbPixelId); fbq('track', 'PageView'); }
        if(SET.tiktokPixelId && typeof TMTK !== 'undefined' && TMTK.load){ TMTK.load(SET.tiktokPixelId); TMTK.push(['track', 'PageView']); }
        getDoc(doc(db, "settings", "advanced")).then(advSnap=>{
          if(advSnap.exists()){
            let hc = advSnap.data().headerCode;
            if(hc && hc.trim()) injectHeaderCode(hc);
          }
        }).catch(()=>{});
      }
    }
  }

  // بيضيف كود الهيد المخصص (اللي اتكتب في الاعدادات) لل <head> مرة واحدة بس،
  // وبيشغل أي وسم <script> جواه لأن اللي بيتحط بـ innerHTML مباشرة ماينفعش يتنفذ
  let headerCodeInjected = false;
  function injectHeaderCode(html){
    if(headerCodeInjected) return;
    headerCodeInjected = true;
    let temp = document.createElement('div');
    temp.innerHTML = html;
    Array.from(temp.childNodes).forEach(node => {
      if(node.tagName === 'SCRIPT'){
        let s = document.createElement('script');
        Array.from(node.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.text = node.textContent;
        document.head.appendChild(s);
      } else {
        document.head.appendChild(node.cloneNode ? node.cloneNode(true) : node);
      }
    });
  }
  window.injectHeaderCode = injectHeaderCode;

  async function loadStats(){
    let snap = await getDoc(doc(db, "settings", "stats"));
    STORE_VISITS = snap.exists() ? (snap.data().visits || 0) : 0;
    if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
  }

  async function loadOrders(){
    let snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
    ORD = [];
    snapshot.forEach((d) => { 
      let data = d.data();
      let isNumeric = v => v !== undefined && v !== null && /^\d+$/.test(String(v));
      let stableNum = isNumeric(data.id) ? data.id : ((data.createdAt && data.createdAt.seconds) ? data.createdAt.seconds : d.id);
      ORD.push({...data, orderNum: stableNum, id: d.id}); 
    });
    if(document.getElementById('orders').classList.contains('on')) drawO(); 
    if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
    updateNewOrderBadge();
  }
  window.loadOrders = loadOrders;

  // ---- الطلبات الجديدة: onSnapshot للأدمن فقط بعد تسجيل الدخول ----
  let protectedListenersStarted = false;
  window.startProtectedListeners = function(){
    if(protectedListenersStarted) return;
    protectedListenersStarted = true;

    // حمّل كل البيانات لأول مرة
    loadProducts();
    loadSettings();
    loadStats();

    // الطلبات: onSnapshot حقيقي بس للأدمن عشان الإشعار الفوري
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snapshot) => {
      ORD = [];
      snapshot.forEach((d) => { 
        let data = d.data();
        let isNumeric = v => v !== undefined && v !== null && /^\d+$/.test(String(v));
        let stableNum = isNumeric(data.id) ? data.id : ((data.createdAt && data.createdAt.seconds) ? data.createdAt.seconds : d.id);
        ORD.push({...data, orderNum: stableNum, id: d.id}); 
      });
      if(document.getElementById('orders').classList.contains('on')) drawO(); 
      if(document.getElementById('dashboard').classList.contains('on')) drawDashboard();
      updateNewOrderBadge();
    });

    loadSuppliers();
  };

  // بدون تسجيل دخول: حمّل الإعدادات والمنتجات بس (للمتجر المدمج)
  loadSettings();
  loadProducts();

  // Firebase Auth — بيتحمل مستقل ومتوازي
  import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail
  }) => {
    const auth = getAuth(app);
    window._fbAuth = auth;
    window._fbSignIn = signInWithEmailAndPassword;
    window._fbSignOut = signOut;
    window._fbResetPwd = sendPasswordResetEmail;
    AUTH_READY = true;

    onAuthStateChanged(auth, (user) => {
      let loginBtn = document.getElementById('loginBtn');
      if(loginBtn){ loginBtn.disabled=false; loginBtn.innerText='دخول'; }

      if(user){
        // مسجل دخول بـ Firebase Auth — كفاية، مفيش طبقة تانية
        document.getElementById('menu').style.display='flex';
        startProtectedListeners();
        if(document.getElementById('login').classList.contains('on')){
          go('store');
        }
      } else {
        // مش مسجل دخول
        document.getElementById('menu').style.display='none';
        if(!document.getElementById('login').classList.contains('on') &&
           !document.getElementById('forgot').classList.contains('on')){
          go('login');
        }
      }
    });
  });

}); 
}); 
