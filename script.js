const supabase = window.supabaseClient;
let currentCategory = "Coffee";
let items = [];
let cart = [];

// ========================
// تحميل المنتجات
// ========================
async function loadItems() {
  const { data, error } = await supabase
    .from("products")
    .select("*");

  if (error) {
    console.error(error);
    return;
  }

  console.log("🔥 المنتجات:", data); // 👈 مهم

  items = data || [];
  renderItems();
}

// ========================
// عرض المنتجات
// ========================
function renderItems() {
  const box = document.getElementById("items");
  box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <img src="${item.image_url || ""}">
      <div>${item.name}</div>
      <small>
        ${item.has_variants ? "اختر الحجم" : (item.price || 0).toFixed(3) + " BD"}
      </small>
    `;

    div.onclick = () => handleClick(item);

    box.appendChild(div);
  });
}

// ========================
// الضغط على المنتج
// ========================
async function handleClick(item) {

  // منتج عادي
  if (!item.has_variants) {
    addToCart(item.name, item.price, item.id, null);
    return;
  }

  // منتج فيه أحجام
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id);

  if (error) {
    console.error(error);
    alert("خطأ في تحميل الأحجام");
    return;
  }

  if (!data || data.length === 0) {
    alert("ما فيه أحجام ❌");
    return;
  }

  let html = `<h3 style="margin-bottom:10px">${item.name}</h3>`;

  data.forEach(v => {
    html += `
      <button onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})"
        style="display:block;width:100%;margin:5px 0;padding:10px">
        ${v.label} - ${v.price} BD
      </button>
    `;
  });

  showPopup(html);
}

// ========================
// popup
// ========================
function showPopup(html) {
  const overlay = document.createElement("div");

  overlay.style = `
    position:fixed;
    top:0;left:0;
    width:100%;height:100%;
    background:rgba(0,0,0,0.5);
    z-index:1000;
  `;

  overlay.onclick = () => overlay.remove();

  const box = document.createElement("div");
  box.innerHTML = html;

  box.style = `
    background:white;
    padding:20px;
    border-radius:10px;
    position:absolute;
    top:50%;left:50%;
    transform:translate(-50%,-50%);
    width:250px;
    text-align:center;
  `;

  box.onclick = e => e.stopPropagation();

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ========================
// اختيار الحجم
// ========================
window.selectVariant = function(id, name, variantId, label, price) {
  addToCart(name + " - " + label, price, id, variantId);
  document.body.lastChild.remove();
};

// ========================
// إضافة للسلة
// ========================
function addToCart(name, price, id, variant_id) {

  const existing = cart.find(i =>
    i.id === id && i.variant_id === variant_id
  );

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      name,
      price,
      id,
      variant_id,
      qty: 1
    });
  }

  renderCart();
}

// ========================
// عرض السلة
// ========================
function renderCart() {
  const cartEl = document.getElementById("cart");
  const totalEl = document.getElementById("total");

  cartEl.innerHTML = "";
  let total = 0;

  cart.forEach((i, index) => {
    cartEl.innerHTML += `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${(i.price * i.qty).toFixed(3)}</td>
        <td>
          <button onclick="removeItem(${index})">❌</button>
        </td>
      </tr>
    `;

    total += i.price * i.qty;
  });

  totalEl.innerText = total.toFixed(3) + " BD";
}

// ========================
// حذف عنصر
// ========================
window.removeItem = function(i) {
  cart.splice(i, 1);
  renderCart();
};

// ========================
// إتمام الطلب
// ========================
window.checkout = async function() {

  if (!cart.length) {
    alert("السلة فاضية ❌");
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({ total, status: "pending" })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert("خطأ في الطلب");
    return;
  }

  await supabase.from("order_items").insert(
    cart.map(i => ({
      order_id: order.id,
      product_id: i.id,
      variant_id: i.variant_id,
      qty: i.qty,
      price: i.price,
      item_name: i.name
    }))
  );

  alert("تم الطلب ✅");

  cart = [];
  renderCart();
};

// تشغيل
loadItems();