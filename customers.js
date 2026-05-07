import { supabase } from "./supabase.js";

export function sendReceiptWhatsApp(
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

  if (!lastOrder || !lastCart) {
    alert("❌ سو عملية الدفع أول");
    return;
  }

  // تنظيف الرقم
  phone = phone.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = phone.substring(1);
  }

  const fullPhone = country + phone;

  // تجهيز الأصناف
  const itemsText = lastCart.map(i =>
    `▫️ ${i.name}\n   ×${i.qty} = ${formatMoney(i.price * i.qty)}`
  ).join("\n");

  const message = `
☕ *سكوب لاب*

✨ تم تسجيل طلبك ✨
ويتم تحضيره الآن بعناية خاصة

رقم الطلب: *${lastOrder.invoice_number}*

${itemsText}

الإجمالي: *${formatMoney(lastOrder.total)}*

—
شكراً لثقتك بنا 🤎
ننتظرك في زيارة ثانية 😍🩵
`;

  const url =
    `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;

  window.location.href = url;

  supabase
    .from("customers")
    .upsert(
      {
        phone: fullPhone,
        country_code: country
      },
      { onConflict: "phone" }
    )
    .then(({ error }) => {
      if (error) {
        console.error("DB ERROR:", error);
      }
    });

  document
    .querySelectorAll(".popup-overlay")
    .forEach(o => o.remove());
}
