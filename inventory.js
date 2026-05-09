import { supabase } from "./supabase.js";

let inventoryCache = [];
let realtimeWorking = false;

/* ===============================
   تحميل المواد (المرة الأولى + fallback)
================================ */
async function loadInventory() {

  const { data } = await supabase
    .from("inventory")
    .select("*")
    .order("name");

  inventoryCache = data || [];
  renderInventory();
}

/* ===============================
   عرض المواد
================================ */
function renderInventory() {

  const box = document.getElementById("inventoryList");
  if (!box) return;

  box.innerHTML = "";

  if (inventoryCache.length === 0) {
    box.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888;">
        📭 ما فيه مواد — أضف مادة جديدة
      </div>
    `;
    return;
  }

  inventoryCache.forEach(i => {

    const lowStock = i.quantity <= 10;

    box.innerHTML += `
      <div class="inv-box ${lowStock ? "low" : ""}" data-inv-id="${i.id}">
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

  // لو Realtime مو شغّال، نحدث يدوياً
  if (!realtimeWorking) {
    loadInventory();
  }
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

  if (!realtimeWorking) {
    loadInventory();
  }
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

  if (!realtimeWorking) {
    loadInventory();
  }
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

  if (!realtimeWorking) {
    loadInventory();
  }
};

/* ===============================
   Realtime — يستمع لتغييرات المخزون
================================ */
function listenInventoryRealtime() {

  supabase
    .channel("inventory-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "inventory"
      },
      (payload) => {

        const eventType = payload.eventType;
        const newRow = payload.new;
        const oldRow = payload.old;

        if (eventType === "INSERT") {

          // ضيف وحافظ على الترتيب الأبجدي
          inventoryCache.push(newRow);
          inventoryCache.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          renderInventory();

        } else if (eventType === "UPDATE") {

          const idx = inventoryCache.findIndex(x => x.id === newRow.id);

          if (idx !== -1) {
            inventoryCache[idx] = newRow;
            // لو الاسم تغيّر، نعيد الترتيب
            inventoryCache.sort((a, b) =>
              (a.name || "").localeCompare(b.name || "")
            );
            renderInventory();
          }

        } else if (eventType === "DELETE") {

          const idx = inventoryCache.findIndex(x => x.id === oldRow.id);
          if (idx !== -1) {
            inventoryCache.splice(idx, 1);
            renderInventory();
          }
        }
      }
    )
    .subscribe((status) => {

      console.log("📡 INVENTORY REALTIME:", status);

      if (status === "SUBSCRIBED") {
        realtimeWorking = true;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        realtimeWorking = false;
        console.warn("⚠️ Realtime مو شغّال على inventory");
      }
    });
}

/* ===============================
   تشغيل الصفحة
================================ */
window.addEventListener("DOMContentLoaded", () => {
  loadInventory();
  listenInventoryRealtime();
});
