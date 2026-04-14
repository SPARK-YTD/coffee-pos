const supabase = window.supabaseClient;

let items = [];
let cart = [];

// تحميل المنتجات
async function loadItems() {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  items = data || [];
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
      <img src="${item.image_url || ""}">
      <div>${item.name}</div>
      <small>${item.has_variants ? "اختر الحجم" : item.price + " BD"}</small>
    `;

    div.onclick = () => clickItem(item);
    box.appendChild(div);
  });
}

// عند الضغط
async function clickItem(item) {

  if (!item.has_variants) {
    addToCart(item.name, item.price, item.id, null);
    return;
  }

  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id);

  if (!data.length) {
    alert("ما فيه أحجام");
    return;
  }

  let html = `<h3>${item.name}</h3>`;

  data.forEach(v => {
    html += `<button onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
      ${v.label} - ${v.price}
    </button><br>`;
  });

  popup(html);
}

// popup
function popup(html) {
  const o = document.createElement("div");
  o.style = "position:fixed;top:0;width:100%;height:100%;background:#0008";

  const b = document.createElement("div");
  b.innerHTML = html;
  b.style = "background:#fff;padding:20px;margin:100px auto;width:200px";

  o.onclick = () => o.remove();
  b.onclick = e => e.stopPropagation();

  o.appendChild(b);
  document.body.appendChild(o);
}

// اختيار حجم
window.selectVariant = function(id, name, vid, label, price) {
  addToCart(name + " - " + label, price, id, vid);
  document.body.lastChild.remove();
};

// إضافة للسلة
function addToCart(name, price, id, vid) {

  const f = cart.find(i => i.id === id && i.vid === vid);

  if (f) f.qty++;
  else cart.push({ name, price, id, vid, qty:1 });

  renderCart();
}

// عرض السلة
function renderCart() {
  const el = document.getElementById("cart");
  const totalEl = document.getElementById("total");

  el.innerHTML = "";
  let total = 0;

  cart.forEach((i, x) => {
    el.innerHTML += `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${(i.price*i.qty).toFixed(3)}</td>
        <td><button onclick="removeItem(${x})">❌</button></td>
      </tr>
    `;
    total += i.price*i.qty;
  });

  totalEl.innerText = total.toFixed(3) + " BD";
}

// حذف
window.removeItem = i => {
  cart.splice(i,1);
  renderCart();
};

// طلب
window.checkout = async () => {

  if (!cart.length) return alert("السلة فاضية");

  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);

  const { data: order } = await supabase
    .from("orders")
    .insert({ total })
    .select()
    .single();

  await supabase.from("order_items").insert(
    cart.map(i => ({
      order_id: order.id,
      product_id: i.id,
      variant_id: i.vid,
      qty: i.qty,
      price: i.price,
      item_name: i.name
    }))
  );

  alert("تم الطلب");
  cart=[];
  renderCart();
};

loadItems();