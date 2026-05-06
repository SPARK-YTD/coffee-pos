import { supabase } from "./supabase.js";

export async function sendReceiptWhatsApp(
  lastOrder,
  lastCart,
  formatMoney
) {

  let phone = document.getElementById("customerPhone")?.value;
  const country = document.getElementById("countryCode")?.value || "966";

  if (!phone) {
    alert("❌ اكتب رقم العميل");
    return;
  }

  if (!lastOrder || !lastCart || lastCart.length === 0) {
    alert("❌ سو عملية الدفع أول");
    return;
  }

  // 🔥 تنظيف الرقم
  phone = phone.replace(/\D/g, "");

  // حذف الصفر بالبداية
  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  const fullPhone = `${country}${phone}`;

  console.log("📞 PHONE:", fullPhone);
  console.log("🧾 ORDER:", lastOrder);
  console.log("🛒 CART:", lastCart);

  // 🔥 حفظ العميل
  const { error } = await supabase
    .from("customers")
    .upsert(
      {
        phone: fullPhone,
        country_code: country
      },
      { onConflict: "phone" }
    );

  if (error) {
    console.error("❌ DB ERROR:", error);
    alert(error.message);
    return;
  }

  // 🔥 تجهيز الأصناف
  const itemsText = lastCart.map(i =>
    `▫️ ${i.name}\n   ×${i.qty} = ${formatMoney(i.price * i.qty)}`
  ).join("\n");

  const message = `
☕ *Tranqila Cafe*

✨ تم تسجيل طلبك ✨
ويتم تحضيره الآن بعناية خاصة

رقم الطلب: *${lastOrder.invoice_number || "-" }*

${itemsText}

الإجمالي: *${formatMoney(lastOrder.total || 0)}*

—
شكراً لثقتك بنا 🤎
ننتظرك في زيارة ثانية 😍🩵
`;

  const url =
    `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

  console.log("📤 WHATSAPP URL:", url);

  // 🔥 مهم للآيفون
  window.location.href = url;

  // 🔥 إغلاق النوافذ
  document
    .querySelectorAll(".popup-overlay")
    .forEach(o => o.remove());
}