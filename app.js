import { supabase } from "./supabase.js";

let items = [];
let cart = [];

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
      : item.price.toFixed(3) + " ر.س"}
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
          ${v.label} — ${v.price.toFixed(3)} ر.س
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
        <td>${sum.toFixed(3)}</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
    total.toFixed(3) + " ر.س";
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
loadItems("drinks");
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
    .select("*")
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

      <div>الإجمالي: ${total.toFixed(3)} ر.س</div>

      <label>💵 كاش:</label>
  <input type="number" id="cashInput" placeholder="0">

  <div style="margin:5px 0">
  <button onclick="setCash(${total})">💵 كاش كامل</button>
  </div>

  <label>💳 بطاقة:</label>
  <input type="number" id="cardInput" placeholder="0">

  <div style="margin:5px 0">
  <button onclick="setCard(${total})">💳 بطاقة كاملة</button>
  <button onclick="completeWithCard(${total})">💳 أكمل الباقي</button>
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
  const card = parseFloat(cardInput.value || "0");

  const paid = cash + card;
  const diff = paid - total;

  if (diff > 0) {
    remainBox.textContent = `💰 الباقي للزبون: ${diff.toFixed(3)} ر.س`;
    remainBox.style.color = "green";
  } else if (diff < 0) {
    remainBox.textContent = `❌ المتبقي: ${Math.abs(diff).toFixed(3)} ر.س`;
    remainBox.style.color = "red";
  } else {
    remainBox.textContent = "✅ المبلغ مكتمل";
    remainBox.style.color = "green";
  }
}

cashInput.oninput = updateRemain;
cardInput.oninput = updateRemain;

updateRemain();

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.querySelector("#confirmPay").onclick = async () => {

    const cash = parseFloat(cashInput.value || "0");
    const card = parseFloat(cardInput.value || "0");

    const paid = cash + card;

if (Math.abs(paid - total) > 0.001 && paid < total) {
  alert("❌ المبلغ ناقص");
  return;
}

// 🔥 إذا زاد المبلغ نحسب الباقي
const change = paid - total;

if (change > 0) {
alert(`💰 الباقي: ${change.toFixed(3)} ر.س`);
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
      payment_method: method
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
      payment_method: method
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

    window.print();
  };
}

function renderActiveOrders() {

  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  activeOrders.forEach(order => {

    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
  <strong>فاتورة رقم ${order.id.slice(0,6)}</strong><br>
  💰 ${order.total.toFixed(3)} ر.س<br> ${order.is_paid ? "✅ مدفوع" : "❌ غير مدفوع"}<br><br>

  <button onclick="viewOrder('${order.id}')">👁 عرض</button>
  <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
  <button onclick="deleteOrder('${order.id}')">🗑 حذف</button>
  <button onclick="markCompleted('${order.id}')">✅ مكتمل</button>
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

window.deleteOrder = async function(id) {

  if (!confirm("حذف الطلب نهائيًا؟")) return;

  // حذف العناصر أول
  await supabase
    .from("order_items")
    .delete()
    .eq("order_id", id);

  // حذف الطلب نفسه
  await supabase
    .from("orders")
    .delete()
    .eq("id", id);

  loadActiveOrders();
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

  document.getElementById("printOrderId").textContent =
    order.id.slice(0,6);

  document.getElementById("printDate").textContent =
    new Date().toLocaleString();

  document.getElementById("printTotal").textContent =
    order.total.toFixed(3) + " ر.س";

  document.getElementById("printItems").innerHTML =
    cart.map(i => `
      <div style="display:flex;justify-content:space-between">
        <span>${i.name} x${i.qty}</span>
        <span>${(i.price * i.qty).toFixed(3)}</span>
      </div>
    `).join("");

  let paymentText =
    method === "cash" ? "💵 كاش" :
    method === "card" ? "💳 بطاقة" :
    "💰 مختلط";

  document.getElementById("printPayment").textContent =
    `طريقة الدفع: ${paymentText}`;

  if ((cash + card) > order.total) {
    const change = (cash + card) - order.total;

    document.getElementById("printPayment").innerHTML +=
      `<br>💰 الباقي: ${change.toFixed(3)} ر.س`;
  }
}
loadActiveOrders();

// 🔥 كاش (ما يمس البطاقة)
window.setCash = function(amount) {
  const cashInput = document.getElementById("cashInput");

  if (!cashInput) return;

  cashInput.value = amount.toFixed(3);
  cashInput.dispatchEvent(new Event("input"));
};

// 🔥 بطاقة (ما تمس الكاش)
window.setCard = function(amount) {
  const cardInput = document.getElementById("cardInput");

  if (!cardInput) return;

  cardInput.value = amount.toFixed(3);
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
    cardInput.value = remaining.toFixed(3);
    cardInput.focus(); // 🔥 حركة حلوة
  }

  cardInput.dispatchEvent(new Event("input"));
};

window.resetPayment = function() {

  const cashInput = document.getElementById("cashInput");
  const cardInput = document.getElementById("cardInput");

  if (!cashInput || !cardInput) return;

  cashInput.value = "";
  cardInput.value = "";

  cashInput.dispatchEvent(new Event("input"));
  cardInput.dispatchEvent(new Event("input"));
};
