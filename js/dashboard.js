function addSize() {
  const div = document.createElement("div");
  div.innerHTML = `
    <input placeholder="اسم الحجم">
    <input placeholder="السعر">
  `;
  document.getElementById("sizes").appendChild(div);
}

function addExtra() {
  const div = document.createElement("div");
  div.innerHTML = `
    <input placeholder="اسم الإضافة">
    <input placeholder="السعر">
  `;
  document.getElementById("extras").appendChild(div);
}

async function saveProduct() {
  const name = document.getElementById("name").value;
  const image = document.getElementById("image").value;
  const price = document.getElementById("price").value;

  // حفظ المنتج
  const { data: product, error } = await window.supabaseClient
    .from("products")
    .insert([{ name, image_url: image, base_price: price }])
    .select()
    .single();

  if (error) {
    alert("خطأ ❌");
    console.log(error);
    return;
  }

  const productId = product.id;

  // حفظ الأحجام
  const sizeInputs = document.getElementById("sizes").children;
  for (let div of sizeInputs) {
    const inputs = div.querySelectorAll("input");
    const sizeName = inputs[0].value;
    const sizePrice = inputs[1].value;

    if (sizeName) {
      await window.supabaseClient.from("product_sizes").insert([
        {
          product_id: productId,
          name: sizeName,
          price: sizePrice
        }
      ]);
    }
  }

  // حفظ الإضافات
  const extraInputs = document.getElementById("extras").children;
  for (let div of extraInputs) {
    const inputs = div.querySelectorAll("input");
    const extraName = inputs[0].value;
    const extraPrice = inputs[1].value;

    if (extraName) {
      await window.supabaseClient.from("product_extras").insert([
        {
          product_id: productId,
          name: extraName,
          price: extraPrice
        }
      ]);
    }
  }

  alert("تم حفظ المنتج ✅");
}
