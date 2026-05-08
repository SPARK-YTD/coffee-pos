import { loadCancelledOrders } from "./reports.js";
import { supabase } from "./supabase.js";
import { loadActiveOrders } from "./orders.js";
import { openPaymentAndSave } from "./payment.js";

import {
  cart,
  addToCart,
  renderCart
} from "./cart.js";

import {
  currentShiftId,
  restoreShift
} from "./shift.js";

window.addEventListener("error", (e) => {
  console.error("🔥 GLOBAL ERROR:", e.error);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("🔥 PROMISE ERROR:", e.reason);
});




let TAX_RATE = 0;
let HIDE_TAX = false;

async function loadTax() {

  const { data } = await supabase
    .from("settings")
    .select("tax_rate, hide_tax")
    .eq("id", 1)
    .single();

  TAX_RATE = Number(data?.tax_rate || 0) / 100;

  HIDE_TAX = data?.hide_tax || false;
}

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

window.formatMoney = formatMoney;


  let items = [];

window.editingOrderId = null;
window.lastOrder = null;
window.lastCart = null;

  function listenToTaxChanges() {

  supabase
    .channel("tax-live")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "settings",
        filter: "id=eq.1"
      },
      (payload) => {

        TAX_RATE = Number(payload.new.tax_rate || 0) / 100;

        HIDE_TAX = payload.new.hide_tax || false;


        if (cart.length > 0) {
          renderCart();
        }
      }
    )
    .subscribe((status) => {
      console.log("📡 REALTIME STATUS:", status);
    });
}

/* ===============================
   تحميل المنتجات
================================ */
async function loadItems(category = "drinks") {

  const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("category", category)
  .eq("is_active", true);
  

  if (error) {
    console.error(error);
    return;
  }

  items = (data || []).map(p => ({
  ...p,
  extras: p.extras_text
    ? p.extras_text
        .split("\n")
        .map(e => e.trim())
        .filter(e => e !== "")
    : []
}));

  renderItems();
}

/* ===============================
   عرض المنتجات
================================ */
function renderItems() {
  const box = document.getElementById("items");

if (!box) {
  console.error("❌ items container مو موجود");
  return;
}

box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
  ${item.image_url ? `
    <img src="${item.image_url}" class="item-img">
  ` : ""}

  <div class="item-name">${item.name}</div>

  <div class="item-price">
  ${item.has_variants
    ? "اختر الحجم"
    : formatMoney(item.price || 0)}
</div>
`;

    div.onclick = () => handleItem(item);

    box.appendChild(div);
  });
}

/* ===============================
   الضغط على المنتج
================================ */
async function handleItem(item) {
  
  if (!currentShiftId) {
  alert("❌ لازم تفتح شفت أول");
  return;
}

  const existingPopup = document.querySelector(".popup-overlay");
if (existingPopup) {
  existingPopup.remove();
}

  if (item.has_variants) {

    const { data: variants, error } = await supabase
  .from("product_variants")
  .select("*")
  .eq("product_id", item.id);

if (error) {
  console.error(error);
  alert("❌ خطأ في تحميل الأحجام");
  return;
}
     
    showVariantsPopup(item, variants);
    return;
  }

if (item.extras && item.extras.filter(e => e).length > 0) {    showExtrasPopup(item);
    return;
  }

  addToCart({
  ...item,
  product_id: item.id
}, renderCart);
}

/* ===============================
   Popup السايز
================================ */
function showVariantsPopup(item, variants) {

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <h3>${item.name}</h3>

      ${(variants || []).map(v => `
        <button class="variant-btn"
          onclick="selectVariant(
            '${item.id}',
            '${item.name}',
            '${v.label}',
            ${v.price}
          )">
          ${v.label} — ${formatMoney(v.price)}
        </button>
      `).join("")}

      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();
  overlay.onclick = e => {
    if (e.target === overlay) overlay.remove();
  };
}

window.selectVariant = function (id, name, label, price) {

  const baseItem = items.find(i => String(i.id) === String(id));

  if (baseItem?.extras && baseItem.extras.length > 0) {
    showExtrasPopup({
      ...baseItem,
      name: `${name} (${label})`,
      price
    });
  } else {
    addToCart({
  id: id,
  product_id: id,
  name: `${name} (${label})`,
  price: price
}, renderCart);

  }

  document.querySelector(".popup-overlay")?.remove();
};

/* ===============================
   Popup الإضافات
================================ */
function showExtrasPopup(item) {

  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">
      <h3>${item.name}</h3>

      <div>
        ${(item.extras || []).map(extra => `
          <label>
            <input type="checkbox" value="${extra}" checked>
            ${extra}
          </label>
        `).join("")}
      </div>

      <button id="confirmExtras">إضافة</button>
      <button class="cancel-btn">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => overlay.remove();

  overlay.querySelector("#confirmExtras").onclick = () => {

    const removed = [...overlay.querySelectorAll("input")]
      .filter(cb => !cb.checked)
      .map(cb => cb.value);

    let name = item.name;

    if (removed.length > 0) {
      name += ` (بدون: ${removed.join(", ")})`;
    }

    addToCart({
  id: item.id,
  product_id: item.id,
  name,
  price: item.price
}, renderCart);

    overlay.remove();
  };
}


window.filterCategory = function (category, btn) {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
};

window.addEventListener("DOMContentLoaded", async () => {


  try {


  await loadTax();


  listenToTaxChanges();

} catch (err) {

  console.error("🔥 TAX ERROR:", err);

}

  
await restoreShift();

loadItems("drinks");

loadActiveOrders(currentShiftId);

loadCancelledOrders(currentShiftId);

});


window.completeOrder = async function () {
  
  if (!currentShiftId) {
  alert("❌ لازم تفتح شفت أول");
  return;
}

  if (!cart.length) {
    alert("السلة فاضية");
    return;
  }

  if (TAX_RATE === null || TAX_RATE === undefined) {
  alert("⚠️ الضريبة ما تحملت");
  return;
  }

  const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const vat = HIDE_TAX
  ? 0
  : subtotal * TAX_RATE;

  const total = subtotal + vat;

  openPaymentAndSave(total, subtotal, vat);
};


window.closeDay = async function () {

  const { data: day } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .maybeSingle();

  if (!day) {
    alert("❌ ما فيه يوم مفتوح");
    return;
  }

  const { data: openShifts } = await supabase
  .from("shifts")
  .select(`
    id,
    employees (
      name
    )
  `)
  .eq("is_open", true);

if (openShifts && openShifts.length > 0) {

  const names = openShifts
    .map(s => s.employees?.name || "غير معروف")
    .join("\n");

  alert(`❌ فيه شفتات مفتوحة:\n\n${names}\n\nلازم تقفلهم أول`);
  return;
}

    // 🔴 يمنع الإغلاق إذا فيه طلبات شغالة بأي شفت
const { data: activeOrders } = await supabase
  .from("orders")
  .select("id")
  .eq("status", "active");

if (activeOrders && activeOrders.length > 0) {
  alert("❌ فيه طلبات مفتوحة! لازم تخلصها أول");
  return;
}

    const start = new Date(day.day_date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

  const { data: orders } = await supabase
    .from("orders")
    .select("total")
    .eq("is_paid", true)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  let total = 0;

  (orders || []).forEach(o => {
    total += Number(o.total || 0);
  });

  const count = orders?.length || 0;

  const ok = confirm(`
📊 تقرير اليوم:

💰 الإجمالي: ${formatMoney(total)}
🧾 الطلبات: ${count}

تأكيد الإغلاق؟
  `);

  if (!ok) return;

  await supabase
    .from("business_days")
    .update({
      is_open: false,
      closed_at: new Date().toISOString(),
      total_sales: total,
      total_orders: count
    })
    .eq("id", day.id);

  alert("📅 تم إغلاق يوم العمل");
};


const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");

if (menuBtn && menuDropdown) {

  menuBtn.addEventListener("click", (e) => {

    e.stopPropagation();

    if (
      menuDropdown.style.display === "flex"
    ) {

      menuDropdown.style.display = "none";

    } else {

      menuDropdown.style.display = "flex";
    }
  });

  document.addEventListener("click", () => {

    menuDropdown.style.display = "none";
  });

  menuDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}
