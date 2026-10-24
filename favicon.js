// favicon.js — أيقونة تبويب المتصفح (favicon).
// من غيرها المتصفح بيعرض الكوكب 🌐 الافتراضي. بتتحدد من لوحة التحكم ← الإعدادات ← "أيقونة التبويب"
// (ولو مفيش، بنستخدم شعار المتجر).
// بنحوّل الشعار لمربع 64×64 ونحفظه في localStorage عشان يظهر فورًا في الزيارات الجاية.
(function(){
  var KEY = 'favicon_cache';
  var SIG = 'favicon_sig';

  function setHref(href){
    var link = document.querySelector('link[rel="icon"]');
    if(!href){ if(link) link.remove(); return; }
    if(!link){
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = href;
  }
  function store(k, v){ try{ if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} }
  function read(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }

  // أول ما الصفحة تفتح: لو عندنا أيقونة محفوظة من زيارة قبل كده نظهرها فورًا
  var cached = read(KEY);
  if(cached) setHref(cached);

  // logoSrc = شعار المتجر (data: URL أو رابط). فاضي = مفيش شعار، فنشيل الأيقونة
  window.applyFavicon = function(logoSrc){
    if(!logoSrc){ store(KEY, null); store(SIG, null); setHref(''); return; }
    var sig = logoSrc.length + ':' + logoSrc.slice(-40);
    if(cached && read(SIG) === sig){ setHref(cached); return; } // نفس الشعار، مفيش داعي نحوّله تاني

    var img = new Image();
    img.onload = function(){
      try{
        var size = 64;
        var c = document.createElement('canvas');
        c.width = size; c.height = size;
        var ctx = c.getContext('2d');
        var s = Math.min(size / img.width, size / img.height);
        var w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        var url = c.toDataURL('image/png');
        cached = url;
        store(KEY, url); store(SIG, sig);
        setHref(url);
      }catch(e){
        // شعار من موقع تاني (CORS) ماينفعش يتحوّل — نستخدمه زي ما هو
        setHref(logoSrc);
      }
    };
    img.src = logoSrc;
  };
})();
