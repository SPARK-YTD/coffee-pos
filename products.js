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

    const status = p.is_active ? "🟢 مفعل" : "🔴 معطل";

    tbody.innerHTML += `
      <tr style="${!p.is_active ? 'opacity:0.5' : ''}">
        <td>${p.name}</td>
        <td>${p.price || "-"}</td>
        <td>${status}</td>
        <td>

          <button onclick="toggleProduct('${p.id}', ${p.is_active})">
            ${p.is_active ? "تعطيل" : "تفعيل"}
          </button>

          <button onclick="deleteProduct('${p.id}')">🗑</button>

        </td>
      </tr>
    `;
  });
}

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
  
  if (!name) {
  alert("❌ اكتب اسم المنتج");
  return;
}

  const hasVariants = document.getElementById("hasVariants").checked;

  let imageUrl = null;

  // رفع الصورة
  const file = document.getElementById("image").files[0];
  if (file) {
    const fileName = Date.now() + "_" + file.name;

    const { data, error } = await supabase.storage
  .from("products")
  .upload(fileName, file);

if (error) {
  console.error("❌ IMAGE UPLOAD ERROR:", error);
  alert("فشل رفع الصورة");
} else {
  const { data: urlData } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  imageUrl = urlData.publicUrl;
}
  }

  // إدخال المنتج
    const { data: product, error } = await supabase
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
  console.error(error);
  alert("❌ خطأ في إضافة المنتج");
  return;
}

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
  
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("extras").value = "";
  document.getElementById("image").value = "";
  document.getElementById("preview").style.display = "none";

  loadProducts();
};

// تشغيل
loadProducts();

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
    console.error(error);
    alert("❌ خطأ في الحفظ");
    return;
  }

  alert("✅ تم حفظ الضريبة");
};

async function loadTax() {

  const { data, error } = await supabase
    .from("settings")
    .select("tax_rate")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("❌ TAX LOAD ERROR:", error);
    return;
  }

  if (data) {
    document.getElementById("taxRate").value = data.tax_rate;
  }
}

loadTax();
