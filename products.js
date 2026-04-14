let sizes = [];

// إضافة حجم
function addSize() {
  const name = document.getElementById("sizeName").value;
  const price = document.getElementById("sizePrice").value;

  if (!name || !price) {
    alert("اكتب الاسم والسعر ❌");
    return;
  }

  const exists = sizes.find(s => s.name === name);
  if (exists) {
    alert("الحجم موجود ❌");
    return;
  }

  sizes.push({ name, price });
  renderSizes();

  document.getElementById("sizeName").value = "";
  document.getElementById("sizePrice").value = "";
}

// عرض الأحجام
function renderSizes() {
  const div = document.getElementById("sizes");
  div.innerHTML = "";

  sizes.forEach((s, index) => {
    div.innerHTML += `
      <div>
        ${s.name} - ${s.price} BD
        <button onclick="removeSize(${index})">❌</button>
      </div>
    `;
  });
}

function removeSize(index) {
  sizes.splice(index, 1);
  renderSizes();
}

// تحميل المنتجات
async function loadProducts() {
  const { data } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "product-card";

    div.innerHTML = `
      <img src="${p.image_url || 'no-image.png'}">
      <strong>${p.name}</strong>
      <div>
        ${p.has_variants ? "📏 متعدد الأحجام" : (p.price ? p.price + " BD" : "-")}
      </div>

      <button onclick="deleteProduct('${p.id}')" style="background:#dc2626;color:white">
        🗑 حذف
      </button>
    `;

    container.appendChild(div);
  });
}

// إضافة منتج
async function addProduct() {
  const name = document.getElementById("name").value.trim();
  const price = document.getElementById("price").value;
  const file = document.getElementById("image").files[0];

  if (!name || (sizes.length === 0 && !price)) {
    alert("اكمل البيانات ❌");
    return;
  }

  if (sizes.length > 0 && price) {
    alert("❌ لا تحط سعر مع الأحجام");
    return;
  }

  let imageUrl = "";

  if (file) {
    const fileName = Date.now() + "-" + file.name;

    const { error } = await supabaseClient
      .storage
      .from("products")
      .upload(fileName, file);

    if (error) {
      alert("خطأ في رفع الصورة ❌");
      return;
    }

    const { data } = supabaseClient
      .storage
      .from("products")
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  const { data: product } = await supabaseClient
    .from("products")
    .insert({
      name,
      price: sizes.length > 0 ? null : parseFloat(price),
      has_variants: sizes.length > 0,
      image_url: imageUrl,
      active: true
    })
    .select()
    .single();

  if (sizes.length > 0) {
    const variantRows = sizes.map(s => ({
      product_id: product.id,
      label: s.name,
      price: parseFloat(s.price)
    }));

    await supabaseClient.from("product_variants").insert(variantRows);

    sizes = [];
    renderSizes();
  }

  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("image").value = "";

  alert("تمت الإضافة ✅");
  loadProducts();
}

// حذف
async function deleteProduct(id) {
  if (!confirm("متأكد؟")) return;

  await supabaseClient
    .from("product_variants")
    .delete()
    .eq("product_id", id);

  await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

  loadProducts();
}

// تشغيل
loadProducts();