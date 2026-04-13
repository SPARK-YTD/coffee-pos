async function saveProduct() {
  const name = document.getElementById("name").value;
  const price = parseFloat(document.getElementById("price").value);
  const category = document.getElementById("category").value;
  const file = document.getElementById("image").files[0];

  let imageUrl = "";

  if (file) {
    const fileName = Date.now() + file.name;

    await supabase.storage.from("products").upload(fileName, file);

    const { data } = supabase.storage
      .from("products")
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  await supabase.from("products").insert([
    { name, base_price: price, category, image_url: imageUrl }
  ]);

  alert("تم الحفظ");
  loadProducts();
}

async function loadProducts() {
  const { data } = await supabase.from("products").select("*");

  const box = document.getElementById("products");
  box.innerHTML = "";

  data.forEach(p => {
    box.innerHTML += `
      <div class="card">
        <h3>${p.name}</h3>
        <p>${p.base_price}</p>
        <button onclick="deleteProduct('${p.id}')">حذف</button>
      </div>
    `;
  });
}

async function deleteProduct(id) {
  await supabase.from("products").delete().eq("id", id);
  loadProducts();
}

loadProducts();
