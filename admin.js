import { supabase } from "./supabase.js";

let editingId = null;

/* ===============================
   إضافة / تعديل منتج
================================ */
window.addProduct = async function () {

  const name = document.getElementById("name").value.trim();
  const basePrice = parseFloat(document.getElementById("price").value);
  const category = document.getElementById("category").value;
  const hasVariants = document.getElementById("hasVariants").checked;
  const extras = document.getElementById("extras").value;

  if (!name) {
    alert("اكتب اسم المنتج");
    return;
  }

  let product;

  // ✏️ تعديل
  if (editingId) {

    const { data, error } = await supabase
      .from("products")
      .update({
        name,
        price: hasVariants ? null : basePrice,
        has_variants: hasVariants,
        category,
        extras_text: extras
      })
      .eq("id", editingId)
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("❌ خطأ في التعديل");
      return;
    }

    product = data;
    editingId = null;

  } else {

    // ➕ إضافة جديدة
    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        price: hasVariants ? null : basePrice,
        has_variants: hasVariants,
        category,
        extras_text: extras
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("❌ خطأ في الإضافة");
      return;
    }

    product = data;
  }

  /* ===============================
     الأحجام
  ================================ */
  if (hasVariants) {

    // حذف القديم (في حالة التعديل)
    await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", product.id);

    const variants = [
      { label: "Small", price: parseFloat(document.getElementById("smallPrice").value) },
      { label: "Medium", price: parseFloat(document.getElementById("mediumPrice").value) },
      { label: "Large", price: parseFloat(document.getElementById("largePrice").value) }
    ].filter(v => !isNaN(v.price));

    if (variants.length > 0) {
      await supabase.from("product_variants").insert(
        variants.map(v => ({
          product_id: product.id,
          label: v.label,
          price: v.price
        }))
      );
    }
  }

  /* ===============================
     تنظيف الفورم
  ================================ */
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("extras").value = "";
  document.getElementById("hasVariants").checked = false;

  alert("✅ تم الحفظ");

  loadProducts();
};

/* ===============================
   عرض المنتجات
================================ */
async function loadProducts() {

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById("productsList");
  tbody.innerHTML = "";

  data.forEach(p => {
    tbody.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td>${p.price ? p.price.toFixed(3) : "حسب الحجم"}</td>
        <td>
          <button onclick="editProduct('${p.id}', '${p.name}', ${p.price || 0}, '${p.category}', ${p.has_variants}, \`${p.extras_text || ""}\`)">✏️</button>
          <button onclick="deleteProduct('${p.id}')">🗑</button>
        </td>
      </tr>
    `;
  });
}

/* ===============================
   تعديل
================================ */
window.editProduct = function(id, name, price, category, hasVariants, extras) {

  document.getElementById("name").value = name;
  document.getElementById("price").value = price;
  document.getElementById("category").value = category;
  document.getElementById("hasVariants").checked = hasVariants;
  document.getElementById("extras").value = extras || "";

  // إظهار/إخفاء الأحجام
  document.getElementById("variantsBox").style.display =
    hasVariants ? "block" : "none";

  editingId = id;
};

/* ===============================
   حذف
================================ */
window.deleteProduct = async function(id) {

  if (!confirm("حذف المنتج؟")) return;

  await supabase
    .from("products")
    .delete()
    .eq("id", id);

  loadProducts();
};

/* ===============================
   تشغيل أولي
================================ */
loadProducts();
