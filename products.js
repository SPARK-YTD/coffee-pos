let sizes = [];

// -------------------
// إضافة حجم
// -------------------
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

// -------------------
// عرض الأحجام
// -------------------
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

// -------------------
// تحميل المنتجات
// -------------------
async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "product-card";

    div.innerHTML = `
      <img src="${p.image_url || 'no-image.png'}">

      <strong>${p.name}</strong>

      <input id="name-${p.id}" value="${p.name}">
      <input id="cat-${p.id}" value="${p.category}">
      <input id="price-${p.id}" type="number" value="${p.price || ''}" placeholder="السعر">

      <div class="actions">
        <button onclick="updateProduct('${p.id}')">💾 حفظ</button>
        <button class="danger" onclick="deleteProduct('${p.id}')">🗑️ حذف</button>
      </div>
    `;

    container.appendChild(div);
  });
}

// -------------------
// إضافة منتج
// -------------------
async function addProduct() {
  const name = document.getElementById("name").value;
  const category = document.getElementById("category").value;
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

  // رفع الصورة
  if (file) {
    const fileName = Date.now() + "-" + file.name;

    const { error: uploadError } = await supabaseClient
      .storage
      .from("products")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert("خطأ في رفع الصورة ❌");
      return;
    }

    const { data } = supabaseClient
      .storage
      .from("products")
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  // إنشاء المنتج
  const { data: product, error } = await supabaseClient
    .from("products")
    .insert([{
      name,
      category,
      price: sizes.length > 0 ? null : parseFloat(price),
      has_variants: sizes.length > 0,
      image_url: imageUrl
    }])
    .select()
    .single();

  if (error) {
    console.error(error);
    return;
  }

  // إضافة الأحجام
  if (sizes.length > 0) {
    const variantRows = sizes.map(s => ({
      product_id: product.id,
      label: s.name,
      price: parseFloat(s.price),
      active: true
    }));

    await supabaseClient.from("product_variants").insert(variantRows);

    sizes = [];
    renderSizes();
  }

  // تنظيف
  document.getElementById("name").value = "";
  document.getElementById("category").value = "";
  document.getElementById("price").value = "";
  document.getElementById("image").value = "";

  loadProducts();
}

// -------------------
// تعديل منتج
// -------------------
async function updateProduct(id) {
  const name = document.getElementById(`name-${id}`).value;
  const category = document.getElementById(`cat-${id}`).value;
  const price = document.getElementById(`price-${id}`).value;

  const hasVariants = !price;

  await supabaseClient
    .from("products")
    .update({
      name,
      category,
      price: hasVariants ? null : parseFloat(price),
      has_variants: hasVariants
    })
    .eq("id", id);

  alert("تم التعديل ✅");
  loadProducts();
}

// -------------------
// حذف منتج
// -------------------
async function deleteProduct(id) {
  const confirmDelete = confirm("متأكد تبغى تحذف؟");

  if (!confirmDelete) return;

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

// -------------------
loadProducts();