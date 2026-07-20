// admin-dashboard.js — sales/profit/stock statistics dashboard.

function drawDashboard(){
  let totalSales = 0; let totalProfits = 0; let totalSoldQty = 0; let productStats = {};
  PROD.forEach(p => { productStats[p.id] = { n: p.n, currentStock: p.stock, soldQty: 0, revenue: 0, profit: 0 }; });

  ORD.forEach(order => {
    if(order.st === 'ok'){
      (order.items || []).forEach(item => {
        let qty = item.q;
        let revenue = item.v * qty; 
        let cost = (item.cost || 0) * qty;
        let profit = revenue - cost;
        totalSales += revenue; totalProfits += profit; totalSoldQty += qty;

        if(productStats[item.id]){
          productStats[item.id].soldQty += qty;
          productStats[item.id].revenue += revenue;
          productStats[item.id].profit += profit;
        } else {
          productStats[item.id] = { n: item.n + " (Deleted)", currentStock: 0, soldQty: qty, revenue: revenue, profit: profit };
        }
      });
    }
  });

  statSales.innerText = totalSales + ` ${i18n[LANG].currency}`;
  statProfProfits.innerText = totalProfits + ` ${i18n[LANG].currency}`;
  statSoldQty.innerText = totalSoldQty + ` ${i18n[LANG].pcs}`;
  statVisits.innerText = STORE_VISITS + ' زيارة';

  dashTable.innerHTML = Object.keys(productStats).map(id => {
    let s = productStats[id];
    let isRealProduct = PROD.some(p => p.id == id);
    let stockEditHtml = isRealProduct ? `
      <div style="display:flex;gap:6px;justify-content:center;align-items:center">
        <input type="number" id="stockEdit-${id}" value="${s.currentStock}" style="width:70px;padding:6px;margin:0">
        <button class="btn small" style="margin:0" onclick="updateStockFromDash('${id}')">تحديث</button>
      </div>` : '-';
    return `<tr>
      <td><b>${s.n}</b></td>
      <td>${s.currentStock} ${i18n[LANG].pcs}</td>
      <td>${stockEditHtml}</td>
      <td style="color:#0d6efd"><b>${s.soldQty}</b></td>
      <td>${s.revenue}</td>
      <td style="color:var(--green)"><b>${s.profit}</b></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6">-</td></tr>';

  let colorRows = [];
  let sizeRows = [];
  PROD.forEach(p => {
    if(p.stockByColor){
      Object.entries(p.stockByColor).forEach(([c,q]) => {
        colorRows.push(`<tr><td><b>${p.n}</b></td><td>${c}</td><td style="color:${q<5?'var(--red)':'var(--green)'};font-weight:700">${q}</td></tr>`);
      });
    }
    if(p.stockBySize){
      Object.entries(p.stockBySize).forEach(([s,q]) => {
        sizeRows.push(`<tr><td><b>${p.n}</b></td><td>${s}</td><td style="color:${q<5?'var(--red)':'var(--green)'};font-weight:700">${q}</td></tr>`);
      });
    }
  });
  dashColorStockTable.innerHTML = colorRows.join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">لا يوجد مخزون ألوان مسجل</td></tr>';
  dashSizeStockTable.innerHTML = sizeRows.join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">لا يوجد مخزون مقاسات مسجل</td></tr>';
}

async function updateStockFromDash(id){
  let input = document.getElementById('stockEdit-' + id);
  if(!input) return;
  let newStock = +input.value;
  if(isNaN(newStock) || newStock < 0) return toast('من فضلك ادخل رقم صحيح');
  let p = PROD.find(x => x.id == id);
  if(!p) return;
  p.stock = newStock;
  try {
    await setDoc(doc(db, "products", id), p);
    await window.loadProducts();
    toast('تم تحديث المخزون بنجاح');
  } catch(error) {
    console.error(error);
    alert('حدث خطأ أثناء تحديث المخزون');
  }
}

