let cart = [];

async function loadProducts() {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  const box = document.getElementById("products");
  box.innerHTML = "";

  data.forEach(p => {
    box.innerHTML += `
      <div class="card" onclick="add('${p.id}')">
        <img src="${p.image_url || ''}">
        <h4>${p.name}</h4>
        <p>${p.base_price} د.ب</p>
      </div>
    `;
  });
}

async function add(id) {
  const { data } = await supabase.from("products").select("*").eq("id", id).single();

  cart.push({
    id,
    name: data.name,
    price: data.base_price
  });

  renderCart();
}

function renderCart() {
  const box = document.getElementById("cart");
  let total = 0;
  box.innerHTML = "";

  cart.forEach(i => {
    total += i.price;
    box.innerHTML += `<div>${i.name} - ${i.price}</div>`;
  });

  document.getElementById("total").innerText = total + " د.ب";
}

async function checkout(method) {
  if (!cart.length) return;

  const total = cart.reduce((a,b)=>a+b.price,0);

  const { data: order } = await supabase
    .from("orders")
    .insert([{ total, payment_method: method, status: "new" }])
    .select()
    .single();

  for (let i of cart) {
    await supabase.from("order_items").insert([
      { order_id: order.id, product_id: i.id, price: i.price }
    ]);
  }

  print(order.id, total);

  cart = [];
  renderCart();
}

function print(id,total){
  const w = window.open();
  w.document.write(`<h2>Order #${id}</h2><h3>${total}</h3>`);
  w.print();
}

loadProducts();