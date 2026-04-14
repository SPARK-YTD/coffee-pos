let cart = [];
let currentOrderId = null;

// -------------------
// تحميل المنتجات
// -------------------
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*") .order("category", { ascending: true });

  if (error) {
    console.error("❌", error);
    return;
  }

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const btn = document.createElement("button");
    btn.innerHTML = `   <img src="${p.image_url || 'no-image.png'}" width="80"><br>   ${p.name} - ${p.price} BD `;
    btn.onclick = () => handleProductClick(p);

    container.appendChild(btn);
  });
}
async function handleProductClick(product) {

  // 🟢 إذا المنتج عادي
  if (!product.has_variants) {
    addToCart(product);
    return;
  }

  // 🟡 إذا فيه أحجام
  const { data: variants, error } = await supabaseClient
    .from("product_variants")
    .select("*")
    .eq("product_id", product.id);

  if (error) {
    console.error(error);
    return;
  }

  showVariants(product, variants);
}

function showVariants(product, variants) {

  let html = `<h3>${product.name}</h3>`;

  variants.forEach(v => {
    html += `
      <button onclick="selectVariant('${product.id}', '${product.name}', '${v.label}', ${v.price})">
        ${v.label} - ${v.price} BD
      </button><br><br>
    `;
  });

  const div = document.createElement("div");
  div.innerHTML = html;

  div.style.position = "fixed";
  div.style.top = "50%";
  div.style.left = "50%";
  div.style.transform = "translate(-50%, -50%)";
  div.style.background = "white";
  div.style.padding = "20px";
  div.style.border = "1px solid black";

  div.id = "variantPopup";

  document.body.appendChild(div);
}

function selectVariant(productId, productName, label, price) {

  const item = {
    id: productId,
    name: productName + " - " + label,
    price: price
  };

  cart.push(item);
  renderCart();

  document.getElementById("variantPopup").remove();
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

 // تاريخ اليوم
const startOfDay = new Date();
startOfDay.setHours(0,0,0,0);

const { data: lastOrder } = await supabaseClient
  .from("orders")
  .select("invoice_number")
  .gte("created_at", startOfDay.toISOString())
  .order("invoice_number", { ascending: false })
  .limit(1)
  .maybeSingle();
  

let invoiceNumber = 1;

if (lastOrder && lastOrder.invoice_number) {
  invoiceNumber = lastOrder.invoice_number + 1;
}
  
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
      .insert([{   total: total,   status: "pending",   invoice_number: invoiceNumber }])
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

 localStorage.setItem("receipt", JSON.stringify({
  items: cart,
  total: total,
  invoice: order.invoice_number
}));


window.open("receipt.html", "_blank");
  

  cart = [];
  currentOrderId = null;
  
  document.getElementById("mode").innerText = "طلب جديد";
  
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
    div.onclick = (e) => {   if (!e.target.closest("button")) {     openOrder(order.id);   } };
    div.style.border = "1px solid black";
    div.style.margin = "5px";
    div.style.padding = "5px";

    div.innerHTML = `
  <strong>طلب #${order.id.slice(0,5)}</strong>
  <p>المجموع: ${order.total} BD</p>
  <button onclick="deleteOrder('${order.id}')">🗑️ حذف</button>
`;

    container.appendChild(div);
  });
}

async function openOrder(orderId) {
  currentOrderId = orderId;
  
 document.getElementById("mode").innerText = "✏️ تعديل طلب";
  
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
async function deleteOrder(orderId) {
  const confirmDelete = confirm("متأكد تبغى تحذف الطلب؟");

  if (!confirmDelete) return;

  // حذف العناصر أول
  await supabaseClient
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  // حذف الطلب
  await supabaseClient
    .from("orders")
    .delete()
    .eq("id", orderId);

  loadPendingOrders();
  loadProducts();
}
