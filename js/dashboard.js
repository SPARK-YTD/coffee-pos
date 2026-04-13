function logout() {
  location.href = "index.html";
}

function openModal() {
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

async function saveProduct() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const file = document.getElementById("image").files[0];

  if (!name || !price || !file) {
    alert("املأ كل البيانات");
    return;
  }

  const fileName = Date.now() + "-" + file.name;

  const { error: uploadError } = await supabaseClient.storage
    .from("products")
    .upload(fileName, file);

  if (uploadError) {
    console.log(uploadError);
    return alert("خطأ رفع الصورة");
  }

  const { data } = supabaseClient.storage
    .from("products")
    .getPublicUrl(fileName);

  const imageUrl = data.publicUrl;

  const { error } = await supabaseClient
    .from("products")
    .insert([{ name, base_price: price, image_url: imageUrl }]);

  if (error) {
    console.log(error);
    return alert("خطأ الحفظ");
  }

  alert("تم الإضافة ✅");
  closeModal();
  showProducts();
}

async function showProducts() {
  const { data } = await supabaseClient
    .from("products")
    .select("*");

  const grid = document.getElementById("productsGrid");
  const orders = document.getElementById("orders");

  orders.innerHTML = "";
  grid.innerHTML = "";

  data.forEach(p => {
    grid.innerHTML += `
      <div class="card">
        <img src="${p.image_url || ''}">
        <h3>${p.name}</h3>
        <p>${p.base_price} BD</p>
        <button onclick="deleteProduct('${p.id}')">🗑️ حذف</button>
      </div>
    `;
  });
}

async function deleteProduct(id) {
  await supabaseClient.from("products").delete().eq("id", id);
  showProducts();
}

async function showOrders() {
  const { data } = await supabaseClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  const el = document.getElementById("orders");
  const grid = document.getElementById("productsGrid");

  grid.innerHTML = "";
  el.innerHTML = "<h2>الطلبات</h2>";

  data.forEach(o => {
    el.innerHTML += `
      <div class="card">
        <p>💰 ${o.total} BD</p>
        <small>${new Date(o.created_at).toLocaleString()}</small>
      </div>
    `;
  });
}

// تحميل أولي
showProducts();