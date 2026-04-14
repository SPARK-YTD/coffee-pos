import { supabase } from "./supabase.js";

let cart = [];

// =================
// تحميل المنتجات
// =================
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "product";

    div.innerHTML = `
      <img src="${p.image_url || ""}" width="80"><br>
      ${p.name}<br>
      ${p.has_variants ? "اختر الحجم" : p.price + " BD"}
    `;

    div.onclick = () => handleClick(p);

    container.appendChild(div);
  });
}

// =================
// الضغط على المنتج
// =================
async function handleClick(product) {

  if (!product.has_variants) {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price
    });
    return;
  }

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", product.id);

  if (!variants || variants.length === 0) {
    alert("ما فيه أحجام");
    return;
  }

  showVariants(product, variants);
}

// =================
// عرض الأحجام
// =================
function showVariants(product, variants) {

  let html = `<h3>${product.name}</h3>`;

  variants.forEach(v => {
    html += `
      <button onclick="selectVariant('${product.id}','${product.name}','${v.id}','${v.label}',${v.price})">
        ${v.label} - ${v.price} BD
      </button><br><br>
    `;
  });

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.5)";
  overlay.id = "variantOverlay";

  overlay.onclick = () => overlay.remove();

  const box = document.createElement("div");
  box.innerHTML = html;
  box.style.background = "white";
  box.style.padding = "20px";
  box.style.position = "absolute";
  box.style.top = "50%";
  box.style.left = "50%";
  box.style.transform = "translate(-50%, -50%)";

  box.onclick = e => e.stopPropagation();

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// =================
// اختيار الحجم
// =================
window.selectVariant = function(id, name, variantId, label, price) {

  addToCart({
    id,
    name: name + " - " + label,
    price,
    variant_id: variantId
  });

  document.getElementById("variantOverlay").remove();
};

// =================
// إضافة للسلة
// =================
function addToCart(item) {

  const existing = cart.find(i =>
    i.id === item.id &&
    i.variant_id === item.variant_id
  );

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

// =================
// عرض السلة
// =================
function renderCart() {

  const cartEl = document.getElementById("cart");
  const totalEl = document.getElementById("total");

  cartEl.innerHTML = "";

  let total = 0;

  cart.forEach((item, i) => {

    const li = document.createElement("li");

    li.innerHTML = `
      ${item.name} × ${item.qty}
      - ${(item.price * item.qty).toFixed(3)} BD
      <button onclick="removeItem(${i})">❌</button>
    `;

    cartEl.appendChild(li);

    total += item.price * item.qty;
  });

  totalEl.innerText = "المجموع: " + total.toFixed(3) + " BD";
}

// =================
// حذف عنصر
// =================
window.removeItem = function(i) {
  cart.splice(i, 1);
  renderCart();
};

// =================
// إتمام الطلب
// =================
window.checkout = async function() {

  if (cart.length === 0) {
    alert("السلة فاضية");
    return;
  }

  let total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: order } = await supabase
    .from("orders")
    .insert({
      total,
      status: "pending"
    })
    .select()
    .single();

  const items = cart.map(i => ({
    order_id: order.id,
    product_id: i.id,
    variant_id: i.variant_id || null,
    qty: i.qty,
    price: i.price,
    item_name: i.name
  }));

  await supabase.from("order_items").insert(items);

  alert("تم الطلب ✅");

  cart = [];
  renderCart();
};

// تشغيل
loadProducts();