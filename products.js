const supabase = window.supabaseClient;
let sizes = [];

// إضافة حجم
function addSize() {
  const n = sizeName.value;
  const p = sizePrice.value;

  if (!n || !p) return alert("اكتب البيانات");

  sizes.push({ n, p });
  renderSizes();
}

// عرض الأحجام
function renderSizes() {
  sizesEl.innerHTML = "";
  sizes.forEach((s,i)=>{
    sizesEl.innerHTML += `${s.n} - ${s.p}<br>`;
  });
}

// إضافة منتج
async function addProduct() {

  const name = nameInput.value;
  const price = priceInput.value;

  const { data: product } = await supabase
    .from("products")
    .insert({
      name,
      price: sizes.length ? null : parseFloat(price),
      has_variants: sizes.length > 0,
      active: true
    })
    .select()
    .single();

  if (sizes.length) {
    await supabase.from("product_variants").insert(
      sizes.map(s=>({
        product_id: product.id,
        label: s.n,
        price: parseFloat(s.p)
      }))
    );
  }

  alert("تم");
  sizes=[];
  renderSizes();
  loadProducts();
}

// تحميل المنتجات
async function loadProducts() {
  const { data } = await supabase.from("products").select("*");

  products.innerHTML="";
  data.forEach(p=>{
    products.innerHTML += `<div>${p.name}</div>`;
  });
}

loadProducts();