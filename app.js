import { supabase } from "./supabase.js";

let items = [];
let cart = [];

/* ===============================
   تحميل المنتجات
================================ */
async function loadItems(category = "food") {

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
      : item.price.toFixed(3) + " د.ب"}
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
          ${v.label} — ${v.price.toFixed(3)} د.ب
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
    total.toFixed(3) + " د.ب";
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
loadItems();
window.completeOrder = async function () {

  if (!cart.length) {
    alert("السلة فاضية");
    return;
  }

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  // 1️⃣ إنشاء الطلب
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      total: total,
      status: "active"
    })
    .select()
    .single();

  if (error || !order) {
    console.error(error);
    alert("❌ فشل إنشاء الطلب");
    return;
  }

  // 2️⃣ إضافة العناصر
  const itemsToInsert = cart.map(i => ({
    order_id: order.id,
    product_id: i.id,
    item_name: i.name,
    qty: i.qty,
    price: i.price
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsToInsert);

  if (itemsError) {
    console.error(itemsError);
    alert("❌ فشل حفظ العناصر");
    return;
  }

  // 3️⃣ تنظيف
  cart = [];
  renderCart();
   loadActiveOrders();

  alert("✅ تم حفظ الطلب");
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


function renderActiveOrders() {

  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  activeOrders.forEach(order => {

    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
      <strong>فاتورة رقم ${order.id.slice(0,6)}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>

      <button onclick="markCompleted('${order.id}')">
        ✅ مكتمل
      </button>
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
loadActiveOrders();
