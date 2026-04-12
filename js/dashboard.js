async function saveProduct() {
  const name = document.getElementById("name").value;
  const file = document.getElementById("image").files[0];
  const price = document.getElementById("price").value;

  let imageUrl = "";

  // رفع الصورة
  if (file) {
    const fileName = Date.now() + "-" + file.name;

    const { data, error } = await window.supabaseClient.storage
      .from("products")
      .upload(fileName, file);

    if (error) {
      alert("خطأ رفع الصورة ❌");
      console.log(error);
      return;
    }

    const { data: urlData } = window.supabaseClient.storage
      .from("products")
      .getPublicUrl(fileName);

    imageUrl = urlData.publicUrl;
  }

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
