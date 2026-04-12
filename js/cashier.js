let cart = [];
let currentCategory = "all";

async function loadCategories() {
  const { data } = await supabase.from("products").select("category");

  const unique = [...new Set(data.map(x => x.category))];

  const box = document.getElementById("categories");
  box.innerHTML = `<button onclick="filter('all')">الكل</button>`;

  unique.forEach(c => {
    box.innerHTML += `<button onclick="filter('${c}')">${c}</button>`;
  });
}

function filter(cat) {
  currentCategory = cat;
  loadProducts();
}

async function loadProducts() {
  let query = supabase.from("products").select("*").eq("active", true);

  if (currentCategory !== "all") {
    query = query.eq("category", currentCategory);
  }

  const { data } = await query;

  const box = document.getElementById("products");
  box.innerHTML = "";

  for (let p of data) {
    box.innerHTML += `
      <div class="card">
        <img src="${p.image_url || ""}">
        <h3>${p.name}</h3>
        <p>${p.base_price} د.ب</p>
        <button onclick="selectProduct('${p.id}')">اختيار</button>
      </div>
    `;
  }
}

async function selectProduct(id) {
  const { data: product } = await supabase
    .from("products").select("*").eq("id", id).single();

  const { data: sizes } = await supabase
    .from("product_sizes").select("*").eq("product_id", id);

  const { data: extras } = await supabase
    .from("product_extras").select("*").eq("product_id", id);

  let size = sizes[0]?.name || "";
  let price = product.base_price;

  if (sizes.length) {
    const chosen = prompt("اختر الحجم: " + sizes.map(s => s.name).join(", "));
    const s = sizes.find(x => x.name === chosen);
    if (s) {
      size = s.name;
      price += s.price;
    }
  }

  let selectedExtras = [];

  if (extras.length) {
    const chosen = prompt("اختر إضافات (فصلها بفاصلة): " + extras.map(e => e.name).join(", "));
    if (chosen) {
      const arr = chosen.split(",");
      arr.forEach(e => {
        const ex = extras.find(x => x.name === e.trim());
        if (ex) {
          selectedExtras.push(ex.name);
          price += ex.price;
        }
      });
    }
  }

  cart.push({
    id,
    name: product.name,
    size,
    extras: selectedExtras,
    price
  });

  renderCart();
}

function renderCart() {
  const box = document.getElementById("cart");
  box.innerHTML = "";

  let total = 0;

  cart.forEach(i => {
    total += i.price;
    box.innerHTML += `<div>${i.name} (${i.size}) - ${i.price}</div>`;
  });

  document.getElementById("total").innerText = "المجموع: " + total + " د.ب";
}

async function checkout() {
  if (!cart.length) return;

  const total = cart.reduce((a,b)=>a+b.price,0);

  const { data: order } = await supabase
    .from("orders")
    .insert([{ total }])
    .select()
    .single();

  for (let i of cart) {
    await supabase.from("order_items").insert([{
      order_id: order.id,
      product_id: i.id,
      size: i.size,
      extras: i.extras,
      price: i.price
    }]);
  }

  alert("تم الطلب ✅");
  cart = [];
  renderCart();
}

loadCategories();
loadProducts();
