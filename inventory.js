import { supabase } from "./supabase.js";

/* ===============================
   تحميل المواد
================================ */
async function loadInventory() {
  const { data } = await supabase.from("inventory").select("*").order("name");

  const box = document.getElementById("inventoryList");
  if (!box) return;

  box.innerHTML = "";

  (data || []).forEach(i => {

    const lowStock = i.quantity <= 10;

    box.innerHTML += `
      <div class="inv-box ${lowStock ? "low" : ""}">
        <div>
          <strong>${i.name}</strong><br>
          الكمية: ${i.quantity}
        </div>

        <div>
          <button onclick="increaseQty('${i.id}', ${i.quantity})">➕</button>
          <button onclick="decreaseQty('${i.id}', ${i.quantity})">➖</button>
          <button onclick="deleteInventory('${i.id}')">🗑</button>
        </div>
      </div>
    `;
  });
}

/* ===============================
   إضافة مادة
================================ */
window.addInventory = async function () {

  const name = document.getElementById("invName").value.trim();
  const qty = Number(document.getElementById("invQty").value);

  if (!name || !qty) {
    alert("❌ اكتب الاسم والكمية");
    return;
  }

  const { error } = await supabase
    .from("inventory")
    .insert({
      name,
      quantity: qty
    });

  if (error) {
    alert("❌ خطأ في الإضافة");
    return;
  }

  alert("✅ تم إضافة المادة");

  document.getElementById("invName").value = "";
  document.getElementById("invQty").value = "";

  loadInventory();
};

/* ===============================
   زيادة الكمية
================================ */
window.increaseQty = async function (id, current) {

  const add = prompt("كم تضيف؟");
  if (!add) return;

  const newQty = Number(current) + Number(add);

  await supabase
    .from("inventory")
    .update({ quantity: newQty })
    .eq("id", id);

  loadInventory();
};

/* ===============================
   نقص الكمية
================================ */
window.decreaseQty = async function (id, current) {

  const minus = prompt("كم تخصم؟");
  if (!minus) return;

  const newQty = Math.max(0, Number(current) - Number(minus));

  await supabase
    .from("inventory")
    .update({ quantity: newQty })
    .eq("id", id);

  loadInventory();
};

/* ===============================
   حذف
================================ */
window.deleteInventory = async function (id) {

  if (!confirm("حذف المادة؟")) return;

  await supabase
    .from("inventory")
    .delete()
    .eq("id", id);

  loadInventory();
};

/* ===============================
   تشغيل الصفحة
================================ */
window.addEventListener("DOMContentLoaded", () => {
  loadInventory();
});