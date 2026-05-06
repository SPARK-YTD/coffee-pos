import { supabase } from "./supabase.js";

window.sendReceiptWhatsApp = async function () {

  let phone = document.getElementById("customerPhone")?.value;
  const country = document.getElementById("countryCode")?.value || "966";

  if (!phone) {
    alert("❌ اكتب رقم العميل");
    return;
  }

  if (!window.lastOrder || !window.lastCart) {
    alert("❌ سو عملية الدفع أول");
    return;
  }

  // تنظيف الرقم
  phone = phone.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  const fullPhone = country + phone;

  // حفظ العميل
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
  }

  // تجهيز الأصناف
  const itemsText = window.lastCart.map(i =>
    `▫️ ${i.name}\n   ×${i.qty} = ${window.formatMoney(i.price * i.qty)}`
  ).join("\n");

  const message = `
☕ *Tranqila Cafe*

✨ تم تسجيل طلبك ✨
ويتم تحضيره الآن بعناية خاصة

رقم الطلب: *${window.lastOrder.invoice_number}*

${itemsText}

الإجمالي: *${window.formatMoney(window.lastOrder.total)}*

—
شكراً لثقتك بنا 🤎
ننتظرك في زيارة ثانية 😍🩵
`;

  const url =
    `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");

  document
    .querySelectorAll(".popup-overlay")
    .forEach(o => o.remove());
};