import { supabase } from "./supabase.js";

// عرض الصورة
document.getElementById("image").onchange = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  const img = document.getElementById("preview");
  img.src = url;
  img.style.display = "block";
};

// إظهار الأحجام
document.getElementById("hasVariants").onchange = function() {
  document.getElementById("variantsBox").style.display =
    this.checked ? "block" : "none";
};

// تحميل المنتجات
async function loadProducts() {
  const { data } = await supabase.from("products").select("*");

  const tbody = document.getElementById("productsList");
  tbody.innerHTML = "";

  (data || []).forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${p.price || "-"}</td>
        <td>
          <button onclick="deleteProduct('${p.id}')">🗑 حذف</button>
        </td>
      </tr>
    `;
  });
}

// حذف
window.deleteProduct = async function(id) {
  if (!confirm("حذف المنتج؟")) return;

  await supabase.from("products").delete().eq("id", id);
  loadProducts();
};

// إضافة
document.getElementById("submitBtn").onclick = async () => {

  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const category = document.getElementById("category").value;
  const extras = document.getElementById("extras").value;

  const hasVariants = document.getElementById("hasVariants").checked;

  let imageUrl = null;

  // رفع الصورة
  const file = document.getElementById("image").files[0];
  if (file) {
    const fileName = Date.now() + "_" + file.name;

    const { data, error } = await supabase.storage
      .from("products")
      .upload(fileName, file);

    if (!error) {
      const { data: urlData } = supabase.storage
        .from("products")
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
    }
  }

  // إدخال المنتج
  const { data: product } = await supabase
    .from("products")
    .insert({
      name,
      price: hasVariants ? null : price,
      category,
      extras_text: extras,
      has_variants: hasVariants,
      image_url: imageUrl
    })
    .select()
    .single();

  // الأحجام
  if (hasVariants && product) {

    const variants = [
      { label: "Small", price: document.getElementById("smallPrice").value },
      { label: "Medium", price: document.getElementById("mediumPrice").value },
      { label: "Large", price: document.getElementById("largePrice").value },
    ].filter(v => v.price);

    const rows = variants.map(v => ({
      product_id: product.id,
      label: v.label,
      price: v.price
    }));

    if (rows.length > 0) {
      await supabase.from("product_variants").insert(rows);
    }
  }

  alert("✅ تم إضافة المنتج");

  loadProducts();
};

// تشغيل
loadProducts();

window.saveTax = function() {
  const rate = document.getElementById("taxRate").value;

  if (!rate) {
    alert("اكتب النسبة");
    return;
  }

  localStorage.setItem("taxRate", rate);

  alert("✅ تم حفظ الضريبة");
};

window.addEventListener("load", () => {
  const saved = localStorage.getItem("taxRate");
  if (saved) {
    document.getElementById("taxRate").value = saved;
  }
});
