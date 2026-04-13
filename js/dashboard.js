async function saveProduct() {
  const name = nameInput.value;
  const price = parseFloat(priceInput.value);
  const category = categoryInput.value;
  const file = image.files[0];

  let url = "";

  if (file) {
    const fileName = Date.now() + file.name;

    await supabase.storage.from("products").upload(fileName, file);

    const { data } = supabase.storage.from("products").getPublicUrl(fileName);
    url = data.publicUrl;
  }

  await supabase.from("products").insert([
    { name, base_price: price, category, image_url: url }
  ]);

  load();
}

async function load() {
  const { data } = await supabase.from("products").select("*");

  list.innerHTML = "";

  data.forEach(p=>{
    list.innerHTML += `<div>${p.name} - ${p.base_price}</div>`;
  });
}

load();