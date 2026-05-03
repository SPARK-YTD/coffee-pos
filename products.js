import { supabase } from "./supabase.js";

/* ===============================
   الحالة
================================ */
let editingProductId = null;
let currentImageUrl = null;

/* ===============================
   تحميل المنتجات
================================ */
async function loadProducts() {

  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      product_ingredients (
        qty_used,
        inventory ( name )
      )
    `);

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById("productsList");
  if (!tbody) return;

  tbody.innerHTML = "";

  (data || []).forEach(p => {

    // الحالة
    const status = p.is_active
      ? "<span style='color:#16a34a;font-weight:bold'>● مفعل</span>"
      : "<span style='color:#dc2626;font-weight:bold'>● معطل</span>";

    // المواد
    let ingredientsText = "❌ غير مربوط";

    if (p.product_ingredients && p.product_ingredients.length > 0) {
      ingredientsText = p.product_ingredients
        .map(i => `${i.inventory?.name || "-"} (${i.qty_used})`)
        .join(" + ");
    }

    tbody.innerHTML += `
      <tr style="${!p.is_active ? 'opacity:0.5' : ''}">
        <td>${p.name}</td>

        <td>
          ${p.has_variants 
            ? "☕ متعدد الأحجام" 
            : (p.price ? p.price + " ر.س" : "-")}
        </td>

        <td>${status}</td>

        <td>${ingredientsText}</td>

        <td>
          <button onclick="toggleProduct('${p.id}', ${p.is_active})">
            ${p.is_active ? "🔴 تعطيل" : "🟢 تفعيل"}
          </button>

          <button onclick="startEditProduct('${p.id}')">
            ✏️ تعديل
          </button>

          <button onclick="selectProduct('${p.id}')">
            📦 تعديل المواد
          </button>

          <button onclick="deleteProduct('${p.id}')">
            🗑
          </button>
        </td>
      </tr>
    `;
  });
}

/* ===============================
   تفعيل / تعطيل
================================ */
window.toggleProduct = async function(id, current) {

  const { error } = await supabase
    .from("products")
    .update({ is_active: !current })
    .eq("id", id);

  if (error) {
    alert("❌ خطأ");
    return;
  }

  loadProducts();
};

/* ===============================
   حذف
================================ */
window.deleteProduct = async function(id) {

  if (!confirm("حذف المنتج؟")) return;

  await supabase.from("products").delete().eq("id", id);
  loadProducts();
};

/* ===============================
   بدء التعديل
================================ */
window.startEditProduct = async function(id) {

  const { data: p, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !p) return;

  editingProductId = id;
  currentImageUrl = p.image_url;

  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price || "";
  document.getElementById("category").value = p.category;
  document.getElementById("extras").value = p.extras_text || "";

  document.getElementById("hasVariants").checked = p.has_variants;

  document.getElementById("variantsBox").style.display =
    p.has_variants ? "block" : "none";

  // الصورة
  if (p.image_url) {
    const img = document.getElementById("preview");
    img.src = p.image_url;
    img.style.display = "block";
  }

  // الأحجام
  if (p.has_variants) {

    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", id);

    (variants || []).forEach(v => {

      if (v.label === "Small") {
        document.getElementById("smallPrice").value = v.price;
      }

      if (v.label === "Medium") {
        document.getElementById("mediumPrice").value = v.price;
      }

      if (v.label === "Large") {
        document.getElementById("largePrice").value = v.price;
      }

    });
  }

  alert("✏️ عدل المنتج ثم اضغط حفظ");
};

/* ===============================
   الضريبة
================================ */
window.saveTax = async function() {

  const pin = prompt("🔐 أدخل رقم المدير");
  if (!pin) return;

  const { data: manager } = await supabase
    .from("employees")
    .select("id, role")
    .eq("pin", pin.trim())
    .eq("role", "manager")
    .maybeSingle();

  if (!manager) {
    alert("❌ غير مصرح");
    return;
  }

  const rate = parseFloat(document.getElementById("taxRate").value);

  if (isNaN(rate)) {
    alert("❌ رقم غير صحيح");
    return;
  }

  await supabase.from("settings").upsert({
    id: 1,
    tax_rate: rate
  });

  alert("✅ تم حفظ الضريبة");
};

async function loadTax() {

  const { data } = await supabase
    .from("settings")
    .select("tax_rate")
    .eq("id", 1)
    .single();

  if (data) {
    document.getElementById("taxRate").value = data.tax_rate;
  }
}

/* ===============================
   تشغيل الصفحة
================================ */
window.addEventListener("DOMContentLoaded", () => {

  // عرض الصورة
  const imageInput = document.getElementById("image");

  if (imageInput) {
    imageInput.onchange = function(e) {

      const file = e.target.files[0];
      if (!file) return;

      const url = URL.createObjectURL(file);

      const img = document.getElementById("preview");
      img.src = url;
      img.style.display = "block";
    };
  }

  // الأحجام
  const variantsCheck = document.getElementById("hasVariants");

  if (variantsCheck) {
    variantsCheck.onchange = function() {
      document.getElementById("variantsBox").style.display =
        this.checked ? "block" : "none";
    };
  }

  // حفظ
  const submitBtn = document.getElementById("submitBtn");

  if (submitBtn) {
    submitBtn.onclick = async () => {

      const name = document.getElementById("name").value;
      const price = document.getElementById("price").value;
      const category = document.getElementById("category").value;
      const extras = document.getElementById("extras").value;

      if (!name) {
        alert("❌ اكتب اسم المنتج");
        return;
      }

      const hasVariants = document.getElementById("hasVariants").checked;

      let imageUrl = null;

      const file = document.getElementById("image").files[0];

      if (file) {
        const fileName = Date.now() + "_" + file.name;

        const { error } = await supabase.storage
          .from("products")
          .upload(fileName, file);

        if (!error) {
          const { data } = supabase.storage
            .from("products")
            .getPublicUrl(fileName);

          imageUrl = data.publicUrl;
        }
      }

      if (editingProductId) {

        await supabase
          .from("products")
          .update({
            name,
            price: hasVariants ? null : price,
            category,
            extras_text: extras,
            has_variants: hasVariants,
            image_url: imageUrl || currentImageUrl
          })
          .eq("id", editingProductId);

      } else {

        await supabase
          .from("products")
          .insert({
            name,
            price: hasVariants ? null : price,
            category,
            extras_text: extras,
            has_variants: hasVariants,
            image_url: imageUrl
          });
      }

      alert(editingProductId ? "✅ تم التعديل" : "✅ تم الإضافة");

      editingProductId = null;
      currentImageUrl = null;

      document.getElementById("name").value = "";
      document.getElementById("price").value = "";
      document.getElementById("extras").value = "";
      document.getElementById("image").value = "";
      document.getElementById("preview").style.display = "none";

      loadProducts();
    };
  }

  loadProducts();
  loadTax();
});

/* ===============================
   ربط المواد
================================ */
window.selectProduct = async function(productId) {

  const { data: inventory } = await supabase
    .from("inventory")
    .select("*");

  if (!inventory || inventory.length === 0) {
    alert("❌ ما عندك مواد");
    return;
  }

  let text = "اختر رقم المادة:\n\n";

  inventory.forEach((i, index) => {
    text += `${index + 1} - ${i.name} (المتوفر: ${i.quantity})\n`;
  });

  const choice = prompt(text);
  const selected = inventory[choice - 1];

  if (!selected) return;

  const qty = prompt("كم يستهلك لكل حبة؟");

  if (!qty || isNaN(qty) || Number(qty) <= 0) {
    alert("❌ رقم غير صحيح");
    return;
  }

  const { error } = await supabase
    .from("product_ingredients")
    .upsert({
      product_id: productId,
      inventory_id: selected.id,
      qty_used: Number(qty)
    }, {
      onConflict: "product_id,inventory_id"
    });

  if (error) {
    alert("❌ فشل الربط: " + error.message);
    return;
  }

  alert("✅ تم الربط");
  loadProducts();
};