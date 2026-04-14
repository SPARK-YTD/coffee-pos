import { supabase } from "./supabase.js";

let items = [];
let cart = [];

// تحميل المنتجات
async function loadItems() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true);

  if (error) {
    console.error(error);
    return;
  }

  items = data;
  renderItems();
}

// عرض المنتجات
function renderItems() {
  const box = document.getElementById("items");
  box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.innerHTML = `
      <button>
        ${item.name}
      </button>
    `;
    div.onclick = () => handleItem(item);
    box.appendChild(div);
  });
}

// الضغط على المنتج
async function handleItem(item) {

  if (item.has_variants) {

    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", item.id);

    let choice = prompt(
      variants.map(v => `${v.label} - ${v.price}`).join("\n")
    );

    const selected = variants.find(v =>
      v.label.toLowerCase() === choice?.toLowerCase()
    );

    if (!selected) return;

    addToCart({
      name: `${item.name} (${selected.label})`,
      price: selected.price
    });

  } else {
    addToCart({
      name: item.name,
      price: item.price
    });
  }
}

// إضافة للسلة
function addToCart(item) {

  const existing = cart.find(i => i.name === item.name);

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

// عرض السلة
function renderCart() {
  const tbody = document.getElementById("cart");
  tbody.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    const sum = item.qty * item.price;
    total += sum;

    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${sum.toFixed(3)}</td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
    total.toFixed(3) + " د.ب";
}

loadItems();
