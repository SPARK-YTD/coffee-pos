import { loadCancelledOrders } from "./reports.js";
import { supabase } from "./supabase.js";
import { sendReceiptWhatsApp } from "./customers.js";
import { loadActiveOrders } from "./orders.js";

import {
  cart,
  addToCart,
  renderCart
} from "./cart.js";

window.addEventListener("error", (e) => {
  console.error("🔥 GLOBAL ERROR:", e.error);
});

let currentShiftId = null;
let currentEmployee = null;

function updateShiftButton() {
  const shiftBtn = document.getElementById("shiftBtn");
  const infoBtn = document.getElementById("shiftInfoBtn");
  const closeBtn = document.getElementById("closeShiftBtn");

  if (!shiftBtn) return;

  if (currentShiftId && currentEmployee?.name) {
    shiftBtn.textContent = `🟢 ${currentEmployee.name}`;

    if (infoBtn) infoBtn.style.display = "block";
    if (closeBtn) closeBtn.style.display = "block";

  } else {
    shiftBtn.textContent = "➕ فتح شفت";

    if (infoBtn) infoBtn.style.display = "none";
    if (closeBtn) closeBtn.style.display = "none";
  }
}

window.toggleShiftAction = function () {
  if (!currentShiftId) {
    openShiftPrompt();
  }
};

let TAX_RATE = 0;

async function loadTax() {
  const { data } = await supabase
    .from("settings")
    .select("tax_rate")
    .eq("id", 1)
    .single();

  TAX_RATE = Number(data?.tax_rate || 0) / 100;

  console.log("🔥 TAX LOADED:", TAX_RATE);
}

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

window.formatMoney = formatMoney;


  let items = [];

window.editingOrderId = null;
window.lastOrder = null;
window.lastCart = null;

  function listenToTaxChanges() {

  supabase
    .channel("tax-live")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "settings",
        filter: "id=eq.1"
      },
      (payload) => {

        TAX_RATE = Number(payload.new.tax_rate || 0) / 100;

        console.log("⚡ TAX UPDATED LIVE:", TAX_RATE);

        if (cart.length > 0) {
          renderCart();
        }
      }
    )
    .subscribe((status) => {
      console.log("📡 REALTIME STATUS:", status);
    });
}

window.openShiftPrompt = function () {
  const popup = document.getElementById("shiftPopup");

  if (!popup) {
    console.error("❌ shiftPopup غير موجود في الصفحة");
    return;
  }

  popup.style.display = "flex";
};

window.closeShiftPopup = function () {
  const popup = document.getElementById("shiftPopup");
  if (popup) popup.style.display = "none";
};

window.confirmOpenShift = async function () {

  const pin = document.getElementById("shiftPin").value.trim();
  const errorBox = document.getElementById("shiftError");

  if (!pin) {
    errorBox.textContent = "❌ أدخل PIN";
    errorBox.style.display = "block";
    return;
  }

  const { data: emp } = await supabase
    .from("employees")
    .select("id, name, pin")
    .eq("pin", pin.trim())
    .maybeSingle();

  if (!emp) {
    errorBox.textContent = "❌ PIN خطأ";
    errorBox.style.display = "block";
    return;
  }

  errorBox.style.display = "none";
  currentEmployee = emp;

  // ===============================
  // 🔥 تأكد فيه يوم عمل مفتوح
  // ===============================
  const { data: openDay } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .maybeSingle();

  if (!openDay) {
    const { error: dayError } = await supabase
      .from("business_days")
      .insert({
        day_date: new Date().toISOString().split("T")[0],
        is_open: true,
        invoice_counter: 0
      });

    if (dayError) {
      alert("❌ خطأ في فتح يوم العمل");
      return;
    }
  }

  // 🔍 شفت موجود؟
  const { data: existingShift } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("is_open", true)
    .maybeSingle();

  if (existingShift) {
  currentShiftId = existingShift.id;
  localStorage.setItem("shiftId", existingShift.id);

  loadItems("drinks");
  loadActiveOrders(currentShiftId);
  loadCancelledOrders(currentShiftId);

  alert(`📂 تم استرجاع الشفت - ${emp.name}`);
  updateShiftButton();
  closeShiftPopup();
  return;
}

  // ➕ إنشاء شفت
  const { data: shift, error } = await supabase
    .from("shifts")
    .insert({
      employee_id: emp.id
    })
    .select()
    .single();

  if (error) {
    alert("❌ خطأ في فتح الشفت");
    return;
  }

  currentShiftId = shift.id;
  localStorage.setItem("shiftId", shift.id);

  loadItems("drinks");
  loadActiveOrders(currentShiftId);
  loadCancelledOrders(currentShiftId);

  alert(`✅ تم فتح الشفت - ${emp.name}`);
  updateShiftButton();
  closeShiftPopup();
};

/* ===============================
   تحميل المنتجات
================================ */
async function loadItems(category = "drinks") {

  const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("category", category)
  .eq("is_active", true);
  
  console.log("PRODUCTS:", data);
  console.log("ERROR:", error);

  if (error) {
    console.error(error);
    return;
  }

  items = (data || []).map(p => ({
  ...p,
  extras: p.extras_text
    ? p.extras_text
        .split("\n")
        .map(e => e.trim())
        .filter(e => e !== "")
    : []
}));

  renderItems();
}

/* ===============================
   عرض المنتجات
================================ */
function renderItems() {
  const box = document.getElementById("items");

if (!box) {
  console.error("❌ items container مو موجود");
  return;
}

box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
  ${item.image_url ? `
    <img src="${item.image_url}" class="item-img">
  ` : ""}

  <div class="item-name">${item.name}</div>

  <div class="item-price">
  ${item.has_variants
    ? "اختر الحجم"
    : formatMoney(item.price || 0)}
</div>
`;

    div.onclick = () => handleItem(item);

    box.appendChild(div);
  });
}

/* ===============================
   الضغط على المنتج
================================ */
async function handleItem(item) {
  
  if (!currentShiftId) {
  alert("❌ لازم تفتح شفت أول");
  return;
}

  const existingPopup = document.querySelector(".popup-overlay");
if (existingPopup) {
  existingPopup.remove();
}

  if (item.has_variants) {

    const { data: variants, error } = await supabase
  .from("product_variants")
  .select("*")
  .eq("product_id", item.id);

if (error) {
  console.error(error);
  alert("❌ خطأ في تحميل الأحجام");
  return;
}
     
    showVariantsPopup(item, variants);
    return;
  }

if (item.extras && item.extras.filter(e => e).length > 0) {    showExtrasPopup(item);
    return;
  }

  addToCart({
  ...item,
  product_id: item.id
}, renderCart);
}

/* ===============================
   Popup السايز
================================ */
function showVariantsPopup(item, variants) {

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <h3>${item.name}</h3>

      ${(variants || []).map(v => `
        <button class="variant-btn"
          onclick="selectVariant(
            '${item.id}',
            '${item.name}',
            '${v.label}',
            ${v.price}
          )">
          ${v.label} — ${formatMoney(v.price)}
        </button>
      `).join("")}

      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();
  overlay.onclick = e => {
    if (e.target === overlay) overlay.remove();
  };
}

window.selectVariant = function (id, name, label, price) {

  const baseItem = items.find(i => String(i.id) === String(id));

  if (baseItem?.extras && baseItem.extras.length > 0) {
    showExtrasPopup({
      ...baseItem,
      name: `${name} (${label})`,
      price
    });
  } else {
    addToCart({
  id: id,
  product_id: id,
  name: `${name} (${label})`,
  price: price
}, renderCart);

  }

  document.querySelector(".popup-overlay")?.remove();
};

/* ===============================
   Popup الإضافات
================================ */
function showExtrasPopup(item) {

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <h3>${item.name}</h3>

      <div>
        ${(item.extras || []).map(extra => `
          <label>
            <input type="checkbox" value="${extra}" checked>
            ${extra}
          </label>
        `).join("")}
      </div>

      <button id="confirmExtras">إضافة</button>
      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.querySelector("#confirmExtras").onclick = () => {

    const removed = [...overlay.querySelectorAll("input")]
      .filter(cb => !cb.checked)
      .map(cb => cb.value);

    let name = item.name;

    if (removed.length > 0) {
      name += ` (بدون: ${removed.join(", ")})`;
    }

    addToCart({
  id: item.id,
  product_id: item.id,
  name,
  price: item.price
}, renderCart);

    overlay.remove();
  };
}


window.filterCategory = function (category, btn) {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
};

window.addEventListener("DOMContentLoaded", async () => {

  console.log("🔥 DOM LOADED");

  await loadTax();
  listenToTaxChanges();

  const savedShift = localStorage.getItem("shiftId");

  console.log("🔥 SAVED SHIFT:", savedShift);

  if (savedShift) {

    const { data } = await supabase
      .from("shifts")
      .select("id, is_open, employees(name)")
      .eq("id", savedShift)
      .single();

    console.log("🔥 SHIFT DATA:", data);

    if (data && data.is_open) {

      currentShiftId = savedShift;

      currentEmployee = {
        name: data.employees?.name || "غير معروف"
      };

      console.log("📂 تم استرجاع الشفت");

      updateShiftButton();

    } else {

      localStorage.removeItem("shiftId");
      openShiftPrompt();
      return;
    }

  } else {

    console.log("❌ NO SHIFT");

    openShiftPrompt();
    return;
  }

  console.log("🔥 BEFORE LOAD ITEMS");

  loadItems("drinks");

  loadActiveOrders(currentShiftId);
  loadCancelledOrders(currentShiftId);

});

async function deductInventory(cartItems) {

  for (const item of cartItems) {

    if (!item.product_id) continue;

    const { data: ingredients } = await supabase
      .from("product_ingredients")
      .select("*")
      .eq("product_id", item.product_id);

    if (!ingredients || ingredients.length === 0) continue;

    for (const ing of ingredients) {

      const totalUsed = Number(ing.qty_used) * Number(item.qty);

      await supabase.rpc("decrease_inventory", {
        inv_id: ing.inventory_id,
        amount: totalUsed
      });
    }
  }
}

window.completeOrder = async function () {
  
  if (!currentShiftId) {
  alert("❌ لازم تفتح شفت أول");
  return;
}

  if (!cart.length) {
    alert("السلة فاضية");
    return;
  }

  if (TAX_RATE === null || TAX_RATE === undefined) {
  alert("⚠️ الضريبة ما تحملت");
  return;
  }

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const vat = subtotal * TAX_RATE;

  const total = subtotal + vat;

  openPaymentAndSave(total, subtotal, vat);
};



  function openPaymentAndSave(total, subtotal, vat) {
  
  const finalSubtotal = subtotal;
  const finalVat = vat;
  const finalTotal = total;

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <div style="display:flex;justify-content:space-between;align-items:center">
  <h3>💰 الدفع</h3>
  <button onclick="resetPayment()" style="background:#ef4444;padding:5px 10px;border-radius:8px">
    🗑
  </button>
</div>

    <div>المجموع: ${formatMoney(subtotal)}</div>
<div>الضريبة: ${formatMoney(vat)}</div>
<div><strong>الإجمالي: ${formatMoney(total)}</strong></div>

      <label>💵 كاش:</label>
<input type="number" id="cashInput" placeholder="0">

<div style="display:flex; gap:6px; margin:5px 0; justify-content:center;">
  <button onclick="setCash(${total})">💵 كاش كامل</button>
  <button onclick="completeWithCash(${total})">💵 أكمل الكاش</button>
</div>

  <label>💳 بطاقة:</label>
  <input type="number" id="cardInput" placeholder="0">

  <div style="margin:5px 0">
  <button onclick="setCard(${total})">💳 بطاقة كاملة</button>
  <button onclick="completeWithCard(${total})">💳 أكمل البطاقة</button>
  </div>

      <div id="remainBox" style="margin:10px 0;font-weight:bold"></div>

      <button id="confirmPay">تأكيد</button>
      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

   const cashInput = overlay.querySelector("#cashInput");
const cardInput = overlay.querySelector("#cardInput");
const remainBox = overlay.querySelector("#remainBox");

cashInput.onfocus = () => {
  if (cashInput.value === "0") cashInput.value = "";
};

cardInput.onfocus = () => {
  if (cardInput.value === "0") cardInput.value = "";
};

function updateRemain() {

  const cash = parseFloat(cashInput.value || "0");
  let card = parseFloat(cardInput.value || "0");

  /* 🔥 البطاقة ما تتعدى المتبقي */
  const maxCard = total - cash;

  if (maxCard >= 0 && card > maxCard) {
    card = maxCard;
    cardInput.value = maxCard.toFixed(2);
  }

  const paid = cash + card;
  const diff = paid - total;

  if (diff > 0) {
    remainBox.innerHTML = `
      💰 الباقي: ${formatMoney(diff)}<br>
      💵 كاش: ${formatMoney(cash)} | 💳 بطاقة: ${formatMoney(card)}
    `;
    remainBox.style.color = "green";

  } else if (diff < 0) {
    remainBox.innerHTML = `
      ❌ المتبقي: ${formatMoney(Math.abs(diff))}<br>
      💵 كاش: ${formatMoney(cash)} | 💳 بطاقة: ${formatMoney(card)}
    `;
    remainBox.style.color = "red";

  } else {
    remainBox.innerHTML = `
      ✅ مكتمل<br>
      💵 كاش: ${formatMoney(cash)} | 💳 بطاقة: ${formatMoney(card)}
    `;
    remainBox.style.color = "green";
  }
}

cashInput.oninput = updateRemain;
cardInput.oninput = updateRemain;

updateRemain();

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.querySelector("#confirmPay").onclick = async () => {
    
  if (!currentShiftId) {
      openShiftPrompt();
      return;
  }
    const cash = parseFloat(cashInput.value || "0");
    const card = parseFloat(cardInput.value || "0");

    const paid = cash + card;

if (paid < total) {
  alert("❌ المبلغ ناقص");
  return;
}

// 🔥 إذا زاد المبلغ نحسب الباقي
const change = paid - total;

if (change > 0) {
remainBox.textContent = `💰 الباقي : ${formatMoney(change)}`;
remainBox.style.color = "green";
}

    let method =
      cash > 0 && card > 0 ? "mixed" :
      cash > 0 ? "cash" : "card";

    // 🔥 إنشاء الطلب
    let order;

if (editingOrderId) {

  // 🔄 تحديث الطلب (بدون تغيير رقم الفاتورة)
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      subtotal: finalSubtotal,
      vat: finalVat,
      total: finalTotal,
      is_paid: true,
      cash_amount: cash,
      card_amount: card,
      payment_method: method,
      shift_id: currentShiftId
    })
    .eq("id", editingOrderId);

  if (updateError) {
    alert("❌ خطأ في تحديث الطلب");
    console.error(updateError);
    return;
  }

  // 🧹 حذف العناصر القديمة
  const { error: deleteError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", editingOrderId);

  if (deleteError) {
    alert("❌ خطأ في حذف العناصر");
    console.error(deleteError);
    return;
  }

  order = { id: editingOrderId };
  editingOrderId = null;

} else {

  // ➕ طلب جديد

  // 🔥 رقم الفاتورة من الداتابيس (آمن 100%)
const { data: newCounter, error } = await supabase
  .rpc("get_next_invoice");

if (error || !newCounter) {
  alert("❌ خطأ في رقم الفاتورة");
  console.error(error);
  return;
}

  // 🔥 إنشاء الطلب مع رقم الفاتورة
  const { data, error: insertError } = await supabase
    .from("orders")
    .insert({
      subtotal: finalSubtotal,
      vat: finalVat,
      total: finalTotal,
      status: "active",
      is_paid: true,
      cash_amount: cash,
      card_amount: card,
      payment_method: method,
      shift_id: currentShiftId,
      invoice_number: newCounter
    })
    .select()
    .single();

  if (insertError) {
    alert("❌ خطأ في إنشاء الطلب");
    console.error(insertError);
    return;
  }

  order = data;
}

    const itemsToInsert = cart.map(i => ({
  order_id: order.id,
  product_id: i.product_id,
  item_name: i.name,
  qty: i.qty,
  price: i.price
}));

    await supabase.from("order_items").insert(itemsToInsert);
    await deductInventory(cart);


    prepareReceipt(order, cart, cash, card, method);
    
    window.lastOrder = order;
    window.lastCart = [...cart];
    cart.length = 0;
    renderCart();
    


    
    loadActiveOrders(currentShiftId);
    

    overlay.remove();
    showAfterPaymentOptions();

};  

}; 

  function prepareReceipt(order, cart, cash, card, method) {
  

  // رقم الطلب
  document.getElementById("printOrderId").textContent =
    order.invoice_number || order.id.slice(0,6);

  // التاريخ (تنسيق سعودي مرتب)
  document.getElementById("printDate").textContent =
    new Date().toLocaleString("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

  // ===============================
  // 🧾 العناصر (مرتب + احترافي)
  // ===============================
  document.getElementById("printItems").innerHTML =
    cart.map(i => `
      <div class="receipt-row">
        <span>${i.name}</span>
        <span>${i.qty}</span>
        <span>${formatMoney(i.price)}</span>
        <span>${formatMoney(i.price * i.qty)}</span>
      </div>
    `).join("");

  // ===============================
  // 💰 المجاميع (هنا الصح)
  // ===============================
  document.getElementById("printSubtotal").textContent =
    formatMoney(order.subtotal);

  document.getElementById("printVat").textContent =
    formatMoney(order.vat);

  document.getElementById("printTotal").textContent =
    formatMoney(order.total);
}


// 🔥 كاش (ما يمس البطاقة)
window.setCash = function(total) {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");

  if (!cashInput || !cardInput) return;

  const card = parseFloat(cardInput.value) || 0;
  const remaining = total - card;

  cashInput.value = remaining > 0 ? remaining.toFixed(2) : "0.00";

  cashInput.dispatchEvent(new Event("input"));
};

// 🔥 بطاقة (ما تمس الكاش)
window.setCard = function(total) {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");

  if (!cashInput || !cardInput) return;

  const cash = parseFloat(cashInput.value) || 0;
  const remaining = total - cash;

  cardInput.value = remaining > 0 ? remaining.toFixed(2) : "0.00";

  cardInput.dispatchEvent(new Event("input"));
};

// 🔥 أكمل الباقي
window.completeWithCard = function(total) {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");

  if (!cashInput || !cardInput) return;

  const cash = parseFloat(cashInput.value) || 0;
  const remaining = total - cash;

  if (remaining > 0) {
    cardInput.value = remaining.toFixed(2);
    cardInput.focus(); // 🔥 حركة حلوة
  }

  cardInput.dispatchEvent(new Event("input"));
};

window.resetPayment = function() {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");
  const remainBox = document.getElementById("remainBox");

  if (!cashInput || !cardInput) return;

  cashInput.value = "";
  cardInput.value = "";

  remainBox.textContent = "";

  cashInput.dispatchEvent(new Event("input"));
  cardInput.dispatchEvent(new Event("input"));
};

window.completeWithCash = function(total) {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");

  if (!cashInput || !cardInput) return;

  const card = parseFloat(cardInput.value) || 0;
  const remaining = total - card;

  if (remaining > 0) {
    cashInput.value = remaining.toFixed(2);
    cashInput.focus();
  }

  cashInput.dispatchEvent(new Event("input"));
};

window.closeShift = async function (autoAsk = true) {


  // 🔴 يمنع الإغلاق إذا فيه طلبات مفتوحة
  const { data: active } = await supabase
    .from("orders")
    .select("id")
    .eq("shift_id", currentShiftId)
    .eq("status", "active");

  if (active && active.length > 0) {
    alert("❌ فيه طلبات مفتوحة! لازم تخلصها أول");
    return;
  }

  // ✅ نجيب الطلبات المدفوعة (هذا كان ناقص عندك 🔥)
  const { data: orders } = await supabase
    .from("orders")
    .select("total, cash_amount, card_amount")
    .eq("shift_id", currentShiftId)
    .eq("is_paid", true);

  // لو ما فيه مبيعات
  if (!orders || orders.length === 0) {
    const ok = confirm("⚠️ ما فيه مبيعات، متأكد تبغى تقفل الشفت؟");
    if (!ok) return;
  }

  let totalSales = 0;
  let totalCash = 0;
  let totalCard = 0;

  (orders || []).forEach(o => {
    totalSales += Number(o.total || 0);
    totalCash += Number(o.cash_amount || 0);
    totalCard += Number(o.card_amount || 0);
  });

  const totalOrders = orders?.length || 0;

  // 📊 تقرير قبل الإغلاق
  const ok = confirm(`
📊 تقرير الشفت:

💰 الإجمالي: ${formatMoney(totalSales)}
💵 كاش: ${formatMoney(totalCash)}
💳 بطاقة: ${formatMoney(totalCard)}
🧾 عدد الطلبات: ${totalOrders}

تأكيد الإغلاق؟
  `);

  if (!ok) return;

  // 🔒 إغلاق الشفت
  await supabase
    .from("shifts")
    .update({
      is_open: false,
      total_sales: totalSales,
      total_cash: totalCash,
      total_card: totalCard,
      total_orders: totalOrders,
      closed_at: new Date().toISOString()
    })
    .eq("id", currentShiftId);

    // 🧹 تصفير
currentShiftId = null;
updateShiftButton();
localStorage.removeItem("shiftId");
cart.length = 0;
renderCart();

// 🔒 قفل الكاشير
document.getElementById("items").innerHTML = `
  <div style="text-align:center;padding:40px;font-size:18px;">
    🔒 الكاشير مغلق<br><br>
    افتح شفت عشان تبدأ
  </div>
`;

document.getElementById("cart").innerHTML = "";
document.getElementById("total").textContent = "0.00 ﷼";

alert("✅ تم إغلاق الشفت");

// 🔁 خيار فتح شفت جديد
if (autoAsk) {
  const reopen = confirm("هل تبي تفتح شفت جديد؟");
  if (reopen) {
    openShiftPrompt();
  }
}
};
// ===============================
// 🔥 كود المنيو (زر ☰)
// ===============================
window.addEventListener("load", () => {
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menuDropdown");

  if (menuBtn && menu) {

    menuBtn.onclick = (e) => {
      e.stopPropagation();

      if (menu.style.display === "flex") {
        menu.style.display = "none";
      } else {
        menu.style.display = "flex";
      }
    };

    // يقفل فقط إذا ضغطت خارج القائمة
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== menuBtn) {
        menu.style.display = "none";
      }
    });

    // يخلي الأزرار داخل المنيو تشتغل
    menu.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }
});

window.showTab = function(type) {

  const active = document.getElementById("activeOrders");
  const cancelled = document.getElementById("cancelledOrders");

  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(t => t.classList.remove("active"));

  if (type === "active") {
    active.style.display = "block";
    cancelled.style.display = "none";
    tabs[0].classList.add("active");
  } else {
    active.style.display = "none";
    cancelled.style.display = "block";
    tabs[1].classList.add("active");
  }
};

window.showReport = async function () {

  if (!currentShiftId) {
    alert("❌ ما فيه شفت");
    return;
  }

  // 🟢 الطلبات المدفوعة
  const { data: sales } = await supabase
    .from("orders")
    .select("total, cash_amount, card_amount")
    .eq("shift_id", currentShiftId)
    .eq("is_paid", true);

  // 🔴 الطلبات الملغية
  const { data: cancelled } = await supabase
    .from("orders")
    .select("id")
    .eq("shift_id", currentShiftId)
    .eq("status", "cancelled");

  let totalSales = 0;
  let totalCash = 0;
  let totalCard = 0;

  (sales || []).forEach(o => {
    totalSales += Number(o.total || 0);
    totalCash += Number(o.cash_amount || 0);
    totalCard += Number(o.card_amount || 0);
  });

  const totalOrders = sales?.length || 0;
  const totalCancelled = cancelled?.length || 0;

  alert(`
📊 تقرير الشفت:

💰 الإجمالي: ${formatMoney(totalSales)}
💵 كاش: ${formatMoney(totalCash)}
💳 بطاقة: ${formatMoney(totalCard)}

🧾 الطلبات: ${totalOrders}
❌ الملغية: ${totalCancelled}
  `);
};


window.closeDay = async function () {

  const { data: day } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .maybeSingle();

  if (!day) {
    alert("❌ ما فيه يوم مفتوح");
    return;
  }

  const { data: openShifts } = await supabase
  .from("shifts")
  .select(`
    id,
    employees (
      name
    )
  `)
  .eq("is_open", true);

if (openShifts && openShifts.length > 0) {

  const names = openShifts
    .map(s => s.employees?.name || "غير معروف")
    .join("\n");

  alert(`❌ فيه شفتات مفتوحة:\n\n${names}\n\nلازم تقفلهم أول`);
  return;
}

    // 🔴 يمنع الإغلاق إذا فيه طلبات شغالة بأي شفت
const { data: activeOrders } = await supabase
  .from("orders")
  .select("id")
  .eq("status", "active");

if (activeOrders && activeOrders.length > 0) {
  alert("❌ فيه طلبات مفتوحة! لازم تخلصها أول");
  return;
}

    const start = new Date(day.day_date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

  const { data: orders } = await supabase
    .from("orders")
    .select("total")
    .eq("is_paid", true)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  let total = 0;

  (orders || []).forEach(o => {
    total += Number(o.total || 0);
  });

  const count = orders?.length || 0;

  const ok = confirm(`
📊 تقرير اليوم:

💰 الإجمالي: ${formatMoney(total)}
🧾 الطلبات: ${count}

تأكيد الإغلاق؟
  `);

  if (!ok) return;

  await supabase
    .from("business_days")
    .update({
      is_open: false,
      closed_at: new Date().toISOString(),
      total_sales: total,
      total_orders: count
    })
    .eq("id", day.id);

  alert("📅 تم إغلاق يوم العمل");
};

window.showShiftInfo = async function () {

  if (!currentShiftId) {
    alert("❌ ما فيه شفت مفتوح");
    return;
  }

  // 🔥 نجيب بيانات الشفت
  const { data: shift } = await supabase
    .from("shifts")
    .select(`
      opened_at,
      employees ( name )
    `)
    .eq("id", currentShiftId)
    .single();

  if (!shift) {
    alert("❌ ما قدرنا نجيب بيانات الشفت");
    return;
  }

  const name = shift.employees?.name || "غير معروف";

  const start = new Date(shift.opened_at);
const now = new Date();

// 🔥 حساب أدق
let diff = Math.floor((now - start) / 1000); // بالثواني

const hours = Math.floor(diff / 3600);
diff %= 3600;

const mins = Math.floor(diff / 60);

  // 🔥 Popup
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box" style="text-align:center">

      <h3>🟢 الشفت المفتوح</h3>

      👤 الموظف: <strong>${name}</strong><br><br>

      🕒 وقت الفتح:<br>
      ${start.toLocaleString()}<br><br>

      ⏱ المدة:<br>
      ${hours} ساعة ${mins} دقيقة<br><br>

      <button onclick="closeShift()">🔒 إغلاق الشفت</button>
      <button class="cancel-btn">إغلاق</button>

    </div>
  `;

  document.body.appendChild(overlay);

  // ❌ إغلاق
  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
};


function showAfterPaymentOptions() {

  // 🔥 يقفل أي بوب قديم قبل يفتح الجديد
  document.querySelectorAll(".popup-overlay").forEach(o => o.remove());

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box" style="text-align:center">

      <h3>✅ تم الدفع بنجاح</h3>

      <p style="margin:10px 0;">وش تبي تسوي؟</p>

      <button onclick="printReceipt()">🖨 طباعة الفاتورة</button>

      <hr style="margin:15px 0">

      <h4>📤 إرسال واتساب</h4>

      <select id="countryCode" style="width:100%;padding:8px;margin-bottom:8px">
        <option value="966" selected>🇸🇦 السعودية</option>
        <option value="973">🇧🇭 البحرين</option>
        <option value="971">🇦🇪 الإمارات</option>
        <option value="965">🇰🇼 الكويت</option>
        <option value="974">🇶🇦 قطر</option>
        <option value="968">🇴🇲 عمان</option>
      </select>

      <input 
        id="customerPhone" 
        placeholder="رقم العميل"
        style="width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;margin-bottom:10px"
      >

      <button id="sendWhatsappBtn">📤 إرسال</button>

      <br><br>

      <button class="cancel-btn">إغلاق</button>

    </div>
  `;

  document.body.appendChild(overlay);

overlay
  .querySelector("#sendWhatsappBtn")
  .onclick = () => {
    sendReceiptWhatsApp(
      window.lastOrder,
      window.lastCart,
      formatMoney
    );
  };

overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}
