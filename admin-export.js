// admin-export.js — تصدير الطلبات لملف Excel حقيقي (.xlsx): النهارده / امبارح / آخر يومين /
// آخر ٧ أيام / الشهر / فترة مخصصة / "من آخر تصدير" (الجديد بس). الملف بيتبني جوه المتصفح
// من غير إنترنت ولا مكتبات (ملف xlsx هو zip فيه ملفات XML)، وبيتفتح في Excel وGoogle Sheets.

// ================= zip بسيط (بدون ضغط) =================
const CRC_TABLE = (() => {
  let t = new Uint32Array(256);
  for(let n = 0; n < 256; n++){
    let c = n;
    for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes){
  let c = 0xFFFFFFFF;
  for(let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files){                       // files: [{ name, data: Uint8Array }]
  const enc = new TextEncoder();
  const u16 = v => [v & 255, (v >>> 8) & 255];
  const u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  let chunks = [], central = [], offset = 0;
  for(const f of files){
    let name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    let local = new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)]);
    chunks.push(local, name, f.data);
    central.push({ name, crc, size, offset });
    offset += local.length + name.length + size;
  }
  let cdStart = offset, cdSize = 0;
  for(const c of central){
    let h = new Uint8Array([0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size), ...u16(c.name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset)]);
    chunks.push(h, c.name);
    cdSize += h.length + c.name.length;
  }
  chunks.push(new Uint8Array([0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0, ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(cdStart), ...u16(0)]));
  let total = chunks.reduce((t, c) => t + c.length, 0);
  let out = new Uint8Array(total), pos = 0;
  chunks.forEach(c => { out.set(c, pos); pos += c.length; });
  return out;
}

// ================= xlsx =================
function xmlEsc(s){
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')      // محارف ممنوعة في XML
    .slice(0, 32000)                                                            // حد Excel للخلية
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function colName(i){                             // 0 → A ، 26 → AA
  let s = '';
  for(i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
  return s;
}
// أنماط الخلايا: 0 عادي، 1 عنوان (أبيض على أزرق)، 2 نص طويل (التفاف)، 3 إجمالي (عريض)، 4 تاريخ ووقت
const XLSX_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\-mm\-dd\ hh:mm"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// columns: [{ h: 'العنوان', w: عرض, s: نمط الخلية }]، rows: صفوف من القيم (نص أو رقم)،
// footer: صفوف إضافية تحت الجدول: [{ v, s }]
function buildXlsx({ sheetName, columns, rows, footer }){
  const enc = new TextEncoder();
  const cell = (r, c, v, s) => {
    let ref = colName(c) + r;
    if(typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
    if(v === null || v === undefined || v === '') return `<c r="${ref}" s="${s}"/>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  };
  let sheetRows = [];
  sheetRows.push(`<row r="1" ht="30" customHeight="1">${columns.map((c, i) => cell(1, i, c.h, 1)).join('')}</row>`);
  rows.forEach((row, ri) => {
    let r = ri + 2;
    sheetRows.push(`<row r="${r}">${columns.map((c, i) => cell(r, i, row[i], c.s || 0)).join('')}</row>`);
  });
  let lastDataRow = rows.length + 1;
  let r = lastDataRow + 1;
  (footer || []).forEach(frow => {
    r++;
    sheetRows.push(`<row r="${r}">${frow.map((f, i) => cell(r, i, f.v, f.s === undefined ? 3 : f.s)).join('')}</row>`);
  });
  const lastCol = colName(columns.length - 1);
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`).join('')}</cols>
<sheetData>${sheetRows.join('')}</sheetData>
<autoFilter ref="A1:${lastCol}${Math.max(lastDataRow, 1)}"/>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="${xmlEsc(String(sheetName).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', XLSX_STYLES],
    ['xl/worksheets/sheet1.xml', sheet]
  ];
  return zipStore(files.map(([name, xml]) => ({ name, data: enc.encode(xml) })));
}

// ================= بيانات الطلبات =================
const ORDER_SHEET_COLUMNS = [
  { h: 'رقم الطلب', w: 11 }, { h: 'التاريخ والوقت', w: 17, s: 4 }, { h: 'الحالة', w: 12 }, { h: 'الاسم', w: 18 },
  { h: 'الموبايل', w: 14 }, { h: 'موبايل تاني', w: 14 }, { h: 'المحافظة', w: 13 }, { h: 'العنوان', w: 32, s: 2 },
  { h: 'المنتجات', w: 38, s: 2 }, { h: 'عدد القطع', w: 9 }, { h: 'المجموع الفرعي', w: 12 }, { h: 'خصم الكوبون', w: 11 },
  { h: 'الشحن', w: 9 }, { h: 'الإجمالي', w: 11 }, { h: 'طريقة الدفع', w: 16 }, { h: 'المطلوب تحصيله', w: 13 }, { h: 'ملاحظة', w: 26, s: 2 }
];
const SHEET_EXCLUDED_FROM_TOTALS = ['cancel', 'ret'];

// تاريخ Excel الحقيقي (عدد الأيام من 1899-12-30) بالتوقيت المحلي، عشان الفرز والفلترة بالتاريخ يشتغلوا
function excelDate(d){
  if(!d || isNaN(d)) return null;
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) / 86400000 + 25569;
}

function orderToSheetRow(o){
  let c = o.c || {};
  let items = o.items || [];
  let sub = items.reduce((t, i) => t + (Number(i.v) || 0) * (Number(i.q) || 0), 0);
  let pieces = items.reduce((t, i) => t + (Number(i.q) || 0), 0);
  let paid = invoicePaymentLabels(o);
  let total = Number(o.tot || 0);
  return [
    String(o.orderNum || o.id).slice(-6), excelDate(getOrderDate(o)) ?? formatOrderDate(o), statusLabel(o.st), c.n || '',
    String(c.p || ''), String(c.p2 || ''), c.g || '', c.a || '',
    orderItemsSummary(o), pieces, sub, Number(o.coupon || 0), Number(o.ship || 0), total,
    paid.length ? paid.join(' + ') : 'كاش عند الاستلام',
    paid.length ? 0 : total,                                  // الدفع الإلكتروني = المطلوب 0 (زي الفاتورة)
    o.note || ''
  ];
}

// ================= الفترات =================
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

// بترجّع { from, to } (from شامل، to مش شامل) — null يعني من غير حد
function exportRange(kind, now, opts){
  opts = opts || {};
  let today = startOfDay(now);
  switch(kind){
    case 'today':     return { from: today, to: null };
    case 'yesterday': return { from: addDays(today, -1), to: today };
    case 'last2':     return { from: addDays(today, -1), to: null };
    case 'last7':     return { from: addDays(today, -6), to: null };
    case 'month':     return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    case 'sinceLast': return { from: opts.lastMs ? new Date(opts.lastMs + 1) : null, to: null };
    case 'custom': {
      let f = opts.from ? new Date(opts.from + 'T00:00:00') : null;
      let t = opts.to ? addDays(new Date(opts.to + 'T00:00:00'), 1) : null;
      return { from: f && !isNaN(f) ? f : null, to: t && !isNaN(t) ? t : null };
    }
    default:          return { from: null, to: null };
  }
}

function filterOrdersForExport(orders, range, status){
  let list = (orders || []).filter(o => {
    if(status && status !== 'all' && o.st !== status) return false;
    if(range.from || range.to){
      let d = getOrderDate(o);
      if(!d) return false;                                   // طلب من غير تاريخ مايدخلش في فترة
      if(range.from && d < range.from) return false;
      if(range.to && d >= range.to) return false;
    }
    return true;
  });
  return list.sort((a, b) => {
    let da = getOrderDate(a), db_ = getOrderDate(b);
    return (da ? da.getTime() : 0) - (db_ ? db_.getTime() : 0);
  });
}

function buildOrdersWorkbook(orders){
  let rows = orders.map(orderToSheetRow);
  let counted = rows.filter((r, i) => !SHEET_EXCLUDED_FROM_TOTALS.includes(orders[i].st));
  let sum = idx => counted.reduce((t, r) => t + (Number(r[idx]) || 0), 0);
  let blanks = n => Array.from({ length: n }, () => ({ v: '' }));
  let footerRow = [{ v: `الإجمالي (بدون الملغي والمرتجع): ${counted.length} طلب` }, ...blanks(8),
    { v: sum(9) }, { v: sum(10) }, { v: sum(11) }, { v: sum(12) }, { v: sum(13) }, { v: '' }, { v: sum(15) }, { v: '' }];
  return buildXlsx({ sheetName: 'الطلبات', columns: ORDER_SHEET_COLUMNS, rows, footer: [footerRow] });
}

function dateStamp(d){
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function exportFileName(orders){
  let dates = orders.map(getOrderDate).filter(Boolean).sort((a, b) => a - b);
  if(!dates.length) return 'orders.xlsx';
  let a = dateStamp(dates[0]), b = dateStamp(dates[dates.length - 1]);
  return a === b ? `orders-${a}.xlsx` : `orders-${a}_to_${b}.xlsx`;
}

function downloadBinary(filename, bytes, mime){
  let blob = new Blob([bytes], { type: mime });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// ================= الواجهة (صفحة الطلبات) =================
const EXPORT_MARKER_KEY = 'excelExportMarker';   // وقت آخر طلب اتصدّر (بالملي ثانية)
function exportMarker(){ try{ return +localStorage.getItem(EXPORT_MARKER_KEY) || 0; }catch(e){ return 0; } }

function currentExportSelection(now){
  let val = id => { let el = document.getElementById(id); return el ? el.value : ''; };
  let kind = val('expPeriod') || 'today';
  let range = exportRange(kind, now || new Date(), { lastMs: exportMarker(), from: val('expFrom'), to: val('expTo') });
  let status = val('expStatus') || 'all';
  return { kind, range, status, orders: filterOrdersForExport(ORD, range, status) };
}

function fmtArDate(d){ return d ? d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : ''; }

function updateExportPreview(){
  let el = document.getElementById('expPreview');
  if(!el) return;
  let customBox = document.getElementById('expCustom');
  if(customBox) customBox.style.display = (document.getElementById('expPeriod').value === 'custom') ? 'inline-flex' : 'none';
  let sel = currentExportSelection();
  let parts = [`هيتصدّر ${sel.orders.length} طلب`];
  if(sel.kind === 'sinceLast'){
    let m = exportMarker();
    parts.push(m ? 'من بعد آخر تصدير (' + new Date(m).toLocaleString('ar-EG') + ')' : 'ماعملتش تصدير قبل كده، فهيتصدّر كل الطلبات');
  } else if(sel.range.from || sel.range.to){
    let to = sel.range.to ? addDays(sel.range.to, -1) : null;
    parts.push((sel.range.from ? 'من ' + fmtArDate(sel.range.from) : '') + (to ? ' إلى ' + fmtArDate(to) : (sel.range.from ? ' لحد دلوقتي' : '')));
  }
  el.innerText = parts.join(' — ');
}

function exportOrdersExcel(){
  let sel = currentExportSelection();
  if(!sel.orders.length) return toast(sel.kind === 'sinceLast' ? 'مفيش طلبات جديدة من آخر تصدير' : 'مفيش طلبات في الفترة دي');
  let bytes = buildOrdersWorkbook(sel.orders);
  downloadBinary(exportFileName(sel.orders), bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  // نفتكر آخر طلب اتصدّر عشان "من آخر تصدير" المرة الجاية تجيب الجديد بس
  let newest = Math.max(...sel.orders.map(o => { let d = getOrderDate(o); return d ? d.getTime() : 0; }));
  if(newest){ try{ localStorage.setItem(EXPORT_MARKER_KEY, String(Math.max(newest, exportMarker()))); }catch(e){} }
  toast(`تم تحميل ${sel.orders.length} طلب كملف Excel`);
  updateExportPreview();
}

(function initExportBox(){
  ['expPeriod', 'expFrom', 'expTo', 'expStatus'].forEach(id => {
    let el = document.getElementById(id);
    if(el) el.addEventListener('change', updateExportPreview);
  });
})();
