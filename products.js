import { supabase } from "./supabase.js";

/* ===============================
   حالة التعديل
================================ */
let editingProductId = null;

/* ===============================
   تحميل المنتجات
================================ */
async function loadProducts() {
  const { data } = await supabase.from("products").select("*");

  const tbody = document.getElementById("productsList");
  if (!tbody) return;

  tbody.innerHTML = "";

  (data || []).forEach(p => {

    const status = p.is_active
      ? "<span style='color:#16a34a;font-weight:bold'>● مفعل</span>"
      : "<span style='color:#dc2626;font-weight:bold'>● معطل</span>";

    tbody.innerHTML += `
      <tr style="${!p.is_active ? 'opacity:0.5' : ''}">
        <td>${p.name}</td>
        <td>
          ${p.has_variants 
            ? "☕ متعدد الأحجام" 
            : (p.price ? p.price + " ر.س" : "-")}
        </td>
        <td>${status}</td>
        <td>

          <button onclick="toggleProduct('${p.id}', ${p.is_active})">
            ${p.is_active ? "🔴 تعطيل" : "🟢 تفعيل"}
          </button>

          <button onclick="startEditProduct('${p.id}')">
            ✏️ تعديل
          </button>
          <button onclick="selectProduct('${p.id}')">📦 ربط مواد</button>
          <button onclick="deleteProduct('${p.id}')">🗑</button>

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

  const { data: p } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!p) return;

  editingProductId = id;

  document.getElementById("name").value = p.name;
  document.getElementById("price").value = p.price || "";
  document.getElementById("category").value = p.category;
  document.getElementById("extras").value = p.extras_text || "";

  document.getElementById("hasVariants").checked = p.has_variants;

  document.getElementById("variantsBox").style.display =
    p.has_variants ? "block" : "none";

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
    alert("❌ اكتب رقم صحيح");
    return;
  }

  const { error } = await supabase
    .from("settings")
    .upsert({
      id: 1,
      tax_rate: rate
    });

  if (error) {
    alert("❌ خطأ في الحفظ");
    return;
  }

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

  // زر الحفظ (إضافة + تعديل)
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

      let product;

      if (editingProductId) {

        const { data, error } = await supabase
          .from("products")
          .update({
            name,
            price: hasVariants ? null : price,
            category,
            extras_text: extras,
            has_variants: hasVariants
          })
          .eq("id", editingProductId)
          .select()
          .single();

        if (error) {
          alert("❌ فشل التعديل");
          return;
        }

        product = data;

      } else {

        const { data, error } = await supabase
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

        if (error) {
          alert("❌ خطأ في الإضافة");
          return;
        }

        product = data;
      }

      alert(editingProductId ? "✅ تم تعديل المنتج" : "✅ تم إضافة المنتج");

      editingProductId = null;

      // تنظيف
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
   ربط المواد (Inventory)
================================ */

let selectedProductId = null;


window.selectProduct = async function (productId) {

  // نجيب كل المواد
  const { data: inventory } = await supabase
    .from("inventory")
    .select("*");

  if (!inventory || inventory.length === 0) {
    alert("❌ ما عندك مواد");
    return;
  }

  // عرض المواد
  let text = "اختر رقم المادة:\n\n";
  inventory.forEach((i, index) => {
    text += `${index + 1} - ${i.name} (المتوفر: ${i.quantity})\n`;
  });

  const choice = prompt(text);
  const selected = inventory[choice - 1];

  if (!selected) return;

  // كم يستهلك
  const qty = prompt("كم يستهلك من هذه المادة لكل حبة؟");

  if (!qty || isNaN(qty) || Number(qty) <= 0) {
    alert("❌ رقم غير صحيح");
    return;
  }

  // نحذف الربط القديم لنفس المنتج ونفس المادة
await supabase
  .from("product_ingredients")
  .delete()
  .eq("product_id", productId)
  .eq("inventory_id", selected.id);

// ثم نضيف الجديد
const { error } = await supabase
  .from("product_ingredients")
  .insert({
    product_id: productId,
    inventory_id: selected.id,
    qty_used: qty
  });

  if (error) {
    alert("❌ فشل الربط");
    return;
  }

  alert("✅ تم ربط المادة بالمنتج");
};