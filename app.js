import { supabase } from "./supabase.js";

let items = [];
let cart = [];

// تحميل المنتجات
async function loadItems() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error(error);
    return;
  }

  items = data;
  renderItems();
}

// عرض المنتجات
function renderItems() {
  const box = document.getElementById("items");
  box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${item.name}</strong><br>
      ${item.has_variants ? "اختر الحجم" : item.price + " د.ب"}
    `;
    div.onclick = () => handleItem(item);
    box.appendChild(div);
  });
}

// الضغط على المنتج
async function handleItem(item) {

  if (item.has_variants) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", item.id);

    showVariantsPopup(item, variants);
    return;
  }

  addToCart({
    name: item.name,
    price: item.price
  });
}

// popup الأحجام
function showVariantsPopup(item, variants) {

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <h3>${item.name}</h3>

      ${variants.map(v => `
        <button class="variant-btn"
          onclick="selectVariant('${item.name}', '${v.label}', ${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}

      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

// اختيار الحجم
window.selectVariant = function(name, label, price) {

  addToCart({
    name: `${name} (${label})`,
    price: price
  });

  document.querySelector(".popup-overlay")?.remove();
};

// إضافة للسلة
function addToCart(item) {

  const existing = cart.find(i => i.name === item.name);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      ...item,
      qty: 1
    });
  }

  renderCart();
}

// عرض السلة
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

// تعديل الكمية
window.changeQty = (i, d) => {
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  renderCart();
};

// حذف
window.removeItem = (i) => {
  cart.splice(i, 1);
  renderCart();
};

loadItems();
