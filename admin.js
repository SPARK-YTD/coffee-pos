import { supabase } from "./supabase.js";

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

  // 1️⃣ إنشاء المنتج
  const { data: product, error } = await supabase
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
    alert("❌ خطأ في إضافة المنتج");
    return;
  }

  // 2️⃣ إضافة الأحجام (إذا موجودة)
  if (hasVariants) {

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

  alert("✅ تم إضافة المنتج");

};
