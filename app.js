async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*");

  if (error) {
    console.error("❌ Error:", error);
    return;
  }

  console.log("✅ Products:", data);

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

loadProducts();
