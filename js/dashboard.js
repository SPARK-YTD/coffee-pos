async function saveProduct() {
  const name = document.getElementById("name").value;
  const file = document.getElementById("image").files[0];
  const price = parseFloat(document.getElementById("price").value);

  if (!name) {
    alert("اكتب اسم المنتج ❌");
    return;
  }

  if (!file) {
    alert("اختر صورة ❌");
    return;
  }

  if (!price) {
    alert("حط السعر ❌");
    return;
  }

  let imageUrl = "";

  // رفع الصورة
  const fileName = `${Date.now()}-${Math.random()}-${file.name}`;

  const { error: uploadError } = await window.supabaseClient.storage
    .from("products")
    .upload(fileName, file);

  if (uploadError) {
    alert("خطأ رفع الصورة ❌");
    console.log(uploadError);
    return;
  }

  const { data: publicUrlData } = window.supabaseClient.storage
    .from("products")
    .getPublicUrl(fileName);

  imageUrl = publicUrlData.publicUrl;

  // حفظ المنتج
  const { data: product, error: productError } = await window.supabaseClient
    .from("products")
    .insert([{ name, image_url: imageUrl, base_price: price }])
    .select()
    .single();

  if (productError) {
    alert("خطأ ❌");
    console.log(productError);
    return;
  }

  const productId = product.id;

  // الأحجام
  const sizeInputs = document.getElementById("sizes").children;
  for (let div of sizeInputs) {
    const inputs = div.querySelectorAll("input");
    const sizeName = inputs[0].value;
    const sizePrice = inputs[1].value;

    if (sizeName) {
      await window.supabaseClient.from("product_sizes").insert([
        { product_id: productId, name: sizeName, price: sizePrice }
      ]);
    }
  }

  // الإضافات
  const extraInputs = document.getElementById("extras").children;
  for (let div of extraInputs) {
    const inputs = div.querySelectorAll("input");
    const extraName = inputs[0].value;
    const extraPrice = inputs[1].value;

    if (extraName) {
      await window.supabaseClient.from("product_extras").insert([
        { product_id: productId, name: extraName, price: extraPrice }
      ]);
    }
  }

  alert("تم حفظ المنتج مع الصورة ✅");
}
