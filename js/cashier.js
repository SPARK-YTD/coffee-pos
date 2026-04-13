let cart = [];

async function loadProducts() {
  const { data } = await supabaseClient
    .from("products")
    .select("*");

  const box = document.getElementById("products");
  box.innerHTML = "";

  data.forEach(p => {
    box.innerHTML += `
      <div onclick='addToCart(${JSON.stringify(p)})'>
        ${p.name} - ${p.base_price}
      </div>
    `;
  });
}

function addToCart(p) {
  cart.push(p);
  renderCart();
}

function renderCart() {
  const box = document.getElementById("cart");
  let total = 0;

  box.innerHTML = "";

  cart.forEach(p => {
    total += Number(p.base_price);
    box.innerHTML += `<div>${p.name}</div>`;
  });

  document.getElementById("total").innerText = total;
}

async function checkout() {
  const user = JSON.parse(localStorage.getItem("user"));

  const total = cart.reduce((s, p) => s + Number(p.base_price), 0);

  await supabaseClient.from("orders").insert([
    {
      items: cart,
      total,
      employee_id: user.id
    }
  ]);

  alert("تم الدفع");
  cart = [];
  renderCart();
}

loadProducts();