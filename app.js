import { loadCancelledOrders } from "./reports.js";
import { supabase } from "./supabase.js";

let currentShiftId = null;
let currentEmployee = null;

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}



let items = [];
let cart = [];


async function openShiftPrompt() {

  const pin = prompt("ادخل رقم الموظف (PIN)");

  if (!pin) {
  alert("لازم تفتح شفت أول");
  return openShiftPrompt();
}

 const { data: emp } = await supabase
  .from("employees")
  .select("id, name, pin")
  .eq("pin", pin.trim())
  .maybeSingle();

console.log("EMP:", emp);

if (!emp) {
  alert("❌ PIN خطأ");
  return openShiftPrompt();
}

  currentEmployee = emp;

  // 🔍 نتحقق هل فيه شفت مفتوح
const { data: existingShift } = await supabase
  .from("shifts")
  .select("*")
  .eq("employee_id", emp.id)
  .eq("is_open", true)
  .maybeSingle();

if (existingShift) {
  currentShiftId = existingShift.id;
  alert(`📂 تم استرجاع الشفت - ${emp.name}`);
  return;
}

// ➕ إنشاء شفت جديد
const { data: shift, error } = await supabase
  .from("shifts")
  .insert({
  employee_id: emp.id
})
  .select()
  .single();

if (error) {
  console.error("SHIFT ERROR:", error);
  alert(error.message);
  return;
}

currentShiftId = shift.id;

alert(`✅ تم فتح الشفت - ${emp.name}`);
}

/* ===============================
   تحميل المنتجات
================================ */
async function loadItems(category = "drinks") {

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .eq("active", true);

  if (error) {
    console.error(error);
    return;
  }

  items = data.map(p => ({
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
      : formatMoney(item.price)}
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

  const existingPopup = document.querySelector(".popup-overlay");
if (existingPopup) {
  existingPopup.remove(); // 🔥 يحذف أي popup عالق
}

  if (item.has_variants) {

    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", item.id);

    showVariantsPopup(item, variants);
    return;
  }

if (item.extras && item.extras.filter(e => e).length > 0) {    showExtrasPopup(item);
    return;
  }

  addToCart(item);
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

      ${variants.map(v => `
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

  const baseItem = items.find(i => i.id === id);

  if (baseItem.extras.length > 0) {
    showExtrasPopup({
      ...baseItem,
      name: `${name} (${label})`,
      price
    });
  } else {
    addToCart({
  id: id, // 🔥 مهم
  name: `${name} (${label})`,
  price: price
});
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
        ${item.extras.map(extra => `
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
  name,
  price: item.price
});

    overlay.remove();
  };
}

/* ===============================
   السلة
================================ */
function addToCart(item) {

  const existing = cart.find(i =>
    i.id === item.id &&
    i.name === item.name
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: item.id || null, // 🔥 مهم
      name: item.name,
      price: item.price,
      qty: 1
    });
  }

  renderCart();
}

function renderCart() {

  const tbody = document.getElementById("cart");
  tbody.innerHTML = "";

  let total = 0;

  cart.forEach((item, i) => {

    const sum = item.qty * item.price;
    total += sum;

    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>
          <button onclick="changeQty(${i},-1)">-</button>
          ${item.qty}
          <button onclick="changeQty(${i},1)">+</button>
        </td>
        <td>${formatMoney(sum)}</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
  formatMoney(total);
}

window.changeQty = (i, d) => {
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  renderCart();
};

window.removeItem = i => {
  cart.splice(i, 1);
  renderCart();
};

/* ===============================
   تصنيف
================================ */
window.filterCategory = function (category, btn) {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
};

/* =============================== */
(async () => {

  const savedShift = localStorage.getItem("shiftId");

if (savedShift) {

  const { data } = await supabase
    .from("shifts")
    .select("id, is_open")
    .eq("id", savedShift)
    .single();

  if (data && data.is_open) {
    currentShiftId = savedShift;
    localStorage.setItem("shiftId", savedShift);
    console.log("📂 تم استرجاع الشفت");
  } else {
    localStorage.removeItem("shiftId");
    await openShiftPrompt();
  }

} else {
  await openShiftPrompt();
  if (currentShiftId) {
    localStorage.setItem("shiftId", currentShiftId);
  }
}
  loadItems("drinks");

})();

window.completeOrder = function () {

  if (!cart.length) {
    alert("السلة فاضية");
    return;
  }

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  openPaymentAndSave(total);
};



let activeOrders = [];

async function loadActiveOrders() {

  const { data } = await supabase
    .from("orders")
    .select("id, total, is_paid, is_prepared, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  activeOrders = data || [];
  renderActiveOrders();
}

function openPaymentAndSave(total) {

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

      <div>الإجمالي: ${formatMoney(total)}</div>

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
      await openShiftPrompt();
      if (!currentShiftId) return;
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

  // 🔄 تحديث الطلب
  await supabase
    .from("orders")
    .update({
      total,
      is_paid: true,
      cash_amount: cash,
      card_amount: card,
      payment_method: method,
      shift_id: currentShiftId
    })
    .eq("id", editingOrderId);

  // 🧹 حذف العناصر القديمة
  await supabase
    .from("order_items")
    .delete()
    .eq("order_id", editingOrderId);

  order = { id: editingOrderId };

  editingOrderId = null;

} else {

  // ➕ طلب جديد
  const { data } = await supabase
    .from("orders")
   .insert({
  total,
  status: "active",
  is_paid: true,
  cash_amount: cash,
  card_amount: card,
  payment_method: method,
  shift_id: currentShiftId
})
    .select()
    .single();

  order = data;
}

    // 🔥 العناصر
    const itemsToInsert = cart.map(i => ({
      order_id: order.id,
      product_id: i.id,
      item_name: i.name,
      qty: i.qty,
      price: i.price
    }));

    await supabase.from("order_items").insert(itemsToInsert);

    prepareReceipt(order, cart, cash, card, method);
    cart = [];
    renderCart();
    loadActiveOrders();
    
    

    overlay.remove();

const printArea = document.getElementById("printArea");

printArea.style.display = "block";

printArea.offsetHeight;

setTimeout(() => {
  window.print();

  setTimeout(() => {
    printArea.style.display = "none";
  }, 300);

}, 600);
  };
}

function renderActiveOrders() {

  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  activeOrders.forEach(order => {

    const div = document.createElement("div");
    div.className = order.is_prepared
  ? "order-box prepared"
  : "order-box";

    div.innerHTML = `
  <strong>فاتورة رقم ${order.id.slice(0,6)}</strong><br>
  💰 ${formatMoney(order.total)}<br> ${order.is_paid ? "✅ مدفوع" : "❌ غير مدفوع"}<br>
${order.is_prepared ? "🟢 جاهز" : "🟡 قيد التحضير"}<br><br>

  <button onclick="viewOrder('${order.id}')">👁 عرض</button>
  <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
  <button onclick="cancelOrder('${order.id}')">❌ إلغاء</button>
  <button onclick="markCompleted('${order.id}')">تم التسليم </button>
`;

    box.appendChild(div);
  });
}

window.markCompleted = async function (id) {

  await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  loadActiveOrders();
};

window.cancelOrder = async function(id) {

  const pin = prompt("🔐 أدخل رقم المدير");
  if (!pin) return;

  const { data: manager } = await supabase
    .from("employees")
    .select("id, role")
    .eq("pin", pin.trim())
    .eq("role", "manager")
    .maybeSingle();

  if (!manager) {
    alert("❌ غير مصرح");
    return;
  }

  if (!confirm("تأكيد إلغاء الطلب؟")) return;

  await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_by: manager.id,
      cancelled_at: new Date().toISOString()
    })
    .eq("id", id);

  loadActiveOrders();
  loadCancelledOrders(currentShiftId);
};

let editingOrderId = null;

/* ===============================
   عرض الطلب 👁
================================ */
window.viewOrder = async function(orderId) {

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!data) return;

  alert(
    data.map(i => `${i.item_name} × ${i.qty}`).join("\n")
  );
};

/* ===============================
   تعديل الطلب ✏️
================================ */
window.editOrder = async function(orderId) {

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!data) return;

  cart = data.map(i => ({
    id: i.product_id,
    name: i.item_name,
    price: i.price,
    qty: i.qty
  }));

  editingOrderId = orderId;

  renderCart();
};

function prepareReceipt(order, cart, cash, card, method) {

  // رقم الطلب
  document.getElementById("printOrderId").textContent =
    order.id ? order.id.slice(0,6) : "000000";

  // التاريخ
  document.getElementById("printDate").textContent =
    new Date().toLocaleString();

  // العناصر
  document.getElementById("printItems").innerHTML =
  cart.map(i => `
    <div class="receipt-row">
      <span>${i.name}</span>
      <span>${i.qty}</span>
      <span>${(i.price * i.qty).toFixed(2)}</span>
    </div>
  `).join("");

  // الإجمالي
  document.getElementById("printTotal").textContent =
    formatMoney(order.total);

  // الدفع
  let paymentText =
    method === "cash" ? "💵 كاش" :
    method === "card" ? "💳 بطاقة" :
    "💰 مختلط";

  let extra = "";

  if ((cash + card) > order.total) {
    const change = (cash + card) - order.total;
    extra = `<br>الباقي: ${change.toFixed(2)} ريال`;
  }

  document.getElementById("printPayment").innerHTML =
    `طريقة الدفع: ${paymentText}<br>
     كاش: ${cash.toFixed(2)}<br>
     بطاقة: ${card.toFixed(2)}
     ${extra}`;
}
loadActiveOrders();

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
window.closeShift = async function () {

  if (!currentShiftId) {
    alert("❌ ما فيه شفت مفتوح");
    return;
  }

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
  localStorage.removeItem("shiftId"); // 🔥 هذا المهم
  cart = [];
  renderCart();

  alert("✅ تم إغلاق الشفت");

  const reopen = confirm("هل تبي تفتح شفت جديد؟");

  if (reopen) {
    await openShiftPrompt();
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
