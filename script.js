let cart = [];
let currentOrderId = null;

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

  let order;

  if (currentOrderId) {
    // ✏️ تحديث الطلب
    const { data, error } = await supabaseClient
      .from("orders")
      .update({ total: total })
      .eq("id", currentOrderId)
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    order = data;

    // حذف العناصر القديمة
    await supabaseClient
      .from("order_items")
      .delete()
      .eq("order_id", currentOrderId);

  } else {
    // ➕ إنشاء طلب جديد
    const { data, error } = await supabaseClient
      .from("orders")
      .insert([{ total: total, status: "pending" }])
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    order = data;
  }

  // إضافة العناصر الجديدة
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
  currentOrderId = null; // 🔥 مهم جدًا
  renderCart();
  loadPendingOrders();
}

 async function loadPendingOrders() {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("pendingOrders");
  container.innerHTML = "";

  data.forEach(order => {
    const div = document.createElement("div");
    div.onclick = () => openOrder(order.id);
    div.style.border = "1px solid black";
    div.style.margin = "5px";
    div.style.padding = "5px";

    div.innerHTML = `
      <strong>طلب #${order.id.slice(0,5)}</strong>
      <p>المجموع: ${order.total} BD</p>
    `;

    container.appendChild(div);
  });
}

async function openOrder(orderId) {
  currentOrderId = orderId;

  const { data, error } = await supabaseClient
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (error) {
    console.error(error);
    return;
  }

  cart = data.map(item => ({
    id: item.product_id,
    name: item.item_name,
    price: item.price
  }));

  renderCart();

  alert("تم فتح الطلب للتعديل ✏️");
}
loadProducts();
loadPendingOrders();
