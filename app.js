async function seedProducts() {
  const products = [
    { name: "Latte", category: "Coffee", price: 1.5 },
    { name: "Cappuccino", category: "Coffee", price: 1.2 },
    { name: "Espresso", category: "Coffee", price: 0.8 },
    { name: "Iced Latte", category: "Iced", price: 1.7 }
  ];

  const { error } = await supabase.from("products").insert(products);

  if (error) {
    console.error("❌ Seed Error:", error);
  } else {
    console.log("✅ Products Added");
    loadProducts();
  }
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*");

  if (error) {
    console.error("❌ Error:", error);
    return;
  }

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(product => {
    const btn = document.createElement("button");
    btn.innerText = product.name + " - " + product.price + " BD";
    btn.style.display = "block";
    btn.style.margin = "10px";
    btn.style.padding = "10px";

    container.appendChild(btn);
  });
}

// أول مرة يشغل
loadProducts();
