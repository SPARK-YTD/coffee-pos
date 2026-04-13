let cart = [];

// -------------------
// إضافة منتجات
// -------------------
async function seedProducts() {
  const { data } = await supabaseClient.from("products").select("*");

  if (data.length > 0) {
    alert("المنتجات موجودة مسبقًا ✅");
    return;
  }

  const products = [
    { name: "Latte", category: "Coffee", price: 1.5 },
    { name: "Cappuccino", category: "Coffee", price: 1.2 },
    { name: "Espresso", category: "Coffee", price: 0.8 }
  ];

  const { error } = await supabaseClient.from("products").insert(products);

  if (error) {
    console.error("❌", error);
  } else {
    console.log("✅ added");
    loadProducts();
  }
}

// -------------------
// تحميل المنتجات
// -------------------
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*");

  if (error) {
    console.error("❌", error);
    return;
  }

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const btn = document.createElement("button");
    btn.innerText = p.name + " - " + p.price;
    btn.onclick = () => addToCart(p);

    container.appendChild(btn);
  });
}

// -------------------
// إضافة للسلة
// -------------------
function addToCart(product) {
  cart.push(product);
  renderCart();
}

// -------------------
// عرض السلة
// -------------------
function renderCart() {
  const cartEl = document.getElementById("cart");
  const totalEl = document.getElementById("total");

  cartEl.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    const li = document.createElement("li");
    li.innerText = item.name + " - " + item.price;
    cartEl.appendChild(li);

    total += item.price;
  });

  totalEl.innerText = "المجموع: " + total + " BD";
}

// -------------------
// إتمام الطلب
// -------------------
async function checkout() {
  if (cart.length === 0) {
    alert("السلة فاضية ❌");
    return;
  }

  let total = 0;
  cart.forEach(item => total += item.price);

  const { data: order, error: orderError } = await supabaseClient
    .from("orders")
    .insert([{ total: total, status: "pending" }])
    .select()
    .single();

  if (orderError) {
    console.error(orderError);
    return;
  }

  const items = cart.map(item => ({
    order_id: order.id,
    product_id: item.id,
    qty: 1,
    price: item.price,
    item_name: item.name
  }));

  const { error: itemsError } = await supabaseClient
    .from("order_items")
    .insert(items);

  if (itemsError) {
    console.error(itemsError);
    return;
  }

  alert("تم حفظ الطلب ✅");

  cart = [];
  renderCart();
  loadPendingOrders(); // 👈 هذا الجديد
  }

// تشغيل أولي
loadProducts();
