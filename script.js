async function seedProducts() {
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
    container.appendChild(btn);
  });
}

loadProducts();
