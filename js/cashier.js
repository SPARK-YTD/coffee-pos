let cart = [];

async function loadProducts() {
  const { data } = await supabaseClient
    .from("products")
    .select("*");

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    container.innerHTML += `
      <div class="product" onclick='addToCart(${JSON.stringify(p)})'>
        <img src="${p.image_url}" width="100">
        <p>${p.name}</p>
        <p>${p.base_price} BD</p>
      </div>
    `;
  });
}

function addToCart(product) {
  cart.push(product);
  renderCart();
}

function renderCart() {
  const el = document.getElementById("cartItems");
  el.innerHTML = "";

  let total = 0;

  cart.forEach(p => {
    total += Number(p.base_price);

    el.innerHTML += `
      <div>${p.name} - ${p.base_price}</div>
    `;
  });

  document.getElementById("total").innerText = total + " BD";
}

async function checkout() {
  if (cart.length === 0) return;

  const total = cart.reduce((sum, p) => sum + Number(p.base_price), 0);

  const { error } = await supabaseClient.from("orders").insert([
    { items: cart, total }
  ]);

  if (error) {
    console.log(error);
    return alert("خطأ ❌");
  }

  alert("تم الدفع ✅");
  cart = [];
  renderCart();
}

loadProducts();