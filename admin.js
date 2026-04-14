import { supabase } from "./supabase.js";

window.addProduct = async function () {

  const name = document.getElementById("name").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const hasVariants = document.getElementById("hasVariants").checked;
  const extras = document.getElementById("extras").value;

  if (!name || isNaN(price)) {
    alert("اكتب الاسم والسعر");
    return;
  }

  const { error } = await supabase
    .from("products")
    .insert({
      name: name,
      price: price,
      has_variants: hasVariants,
      extras_text: extras,
      category: "drinks" // مؤقت
    });

  if (error) {
    alert("❌ خطأ");
    console.error(error);
    return;
  }

  alert("✅ تم إضافة المنتج");

  // تفريغ الحقول
  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("extras").value = "";
  document.getElementById("hasVariants").checked = false;
};
