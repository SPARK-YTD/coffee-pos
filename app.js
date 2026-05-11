import { loadCancelledOrders } from “./reports.js”;
import { supabase } from “./supabase.js”;
import { loadActiveOrders } from “./orders.js”;
import { openPaymentAndSave } from “./payment.js”;

import {
cart,
addToCart,
renderCart
} from “./cart.js”;

import {
currentShiftId,
restoreShift
} from “./shift.js”;

window.addEventListener(“error”, (e) => {
console.error(“🔥 GLOBAL ERROR:”, e.error);
});

window.addEventListener(“unhandledrejection”, (e) => {
console.error(“🔥 PROMISE ERROR:”, e.reason);
});

let TAX_RATE = 0;
let HIDE_TAX = false;
let currentCategory = “drinks”;

async function loadTax() {

const { data } = await supabase
.from(“settings”)
.select(“tax_rate, hide_tax”)
.eq(“id”, 1)
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

/* ===============================
Realtime — تغييرات الضريبة
================================ */
function listenToTaxChanges() {

supabase
.channel(“tax-live”)
.on(
“postgres_changes”,
{
event: “UPDATE”,
schema: “public”,
table: “settings”,
filter: “id=eq.1”
},
(payload) => {

```
    TAX_RATE = Number(payload.new.tax_rate || 0) / 100;
    HIDE_TAX = payload.new.hide_tax || false;

    if (cart.length > 0) {
      renderCart();
    }
  }
)
.subscribe((status) => {
  console.log("📡 TAX REALTIME:", status);
});
```

}

/* ===============================
Realtime — تغييرات المنتجات
================================ */
function listenToProductChanges() {

supabase
.channel(“products-live”)
.on(
“postgres_changes”,
{
event: “*”,
schema: “public”,
table: “products”
},
(payload) => {

```
    const eventType = payload.eventType;
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === "INSERT") {

      if (newRow.category === currentCategory && newRow.is_active) {
        items.push(mapProduct(newRow));
        renderItems();
      }

    } else if (eventType === "UPDATE") {

      const idx = items.findIndex(i => i.id === newRow.id);

      const shouldBeShown =
        newRow.category === currentCategory && newRow.is_active;

      if (!shouldBeShown) {
        if (idx !== -1) {
          items.splice(idx, 1);
          renderItems();
        }
        return;
      }

      if (idx !== -1) {
        items[idx] = mapProduct(newRow);
      } else {
        items.push(mapProduct(newRow));
      }
      renderItems();

    } else if (eventType === "DELETE") {

      const idx = items.findIndex(i => i.id === oldRow.id);
      if (idx !== -1) {
        items.splice(idx, 1);
        renderItems();
      }
    }
  }
)
.subscribe((status) => {
  console.log("📡 PRODUCTS REALTIME:", status);
});
```

}

/* ===============================
Realtime — تغييرات يوم العمل
================================ */
function listenToBusinessDayChanges() {

supabase
.channel(“business-day-live”)
.on(
“postgres_changes”,
{
event: “*”,
schema: “public”,
table: “business_days”
},
() => {
updateDayButton();
}
)
.subscribe((status) => {
console.log(“📡 BUSINESS DAY REALTIME:”, status);
});
}

function mapProduct(p) {
return {
…p,
extras: p.extras_text
? p.extras_text.split(”\n”).map(e => e.trim()).filter(e => e !== “”)
: []
};
}

/* ===============================
تحميل المنتجات
================================ */
async function loadItems(category = “drinks”) {

currentCategory = category;

const { data, error } = await supabase
.from(“products”)
.select(”*”)
.eq(“category”, category)
.eq(“is_active”, true);

if (error) {
console.error(error);
return;
}

items = (data || []).map(mapProduct);

renderItems();
}

/* ===============================
عرض المنتجات
================================ */
function renderItems() {
const box = document.getElementById(“items”);

if (!box) {
console.error(“❌ items container مو موجود”);
return;
}

box.innerHTML = “”;

items.forEach(item => {
const div = document.createElement(“div”);
div.className = “item”;

```
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
```

});
}

/* ===============================
الضغط على المنتج
================================ */
async function handleItem(item) {

if (!currentShiftId) {
alert(“❌ لازم تفتح شفت أول”);
return;
}

const existingPopup = document.querySelector(”.popup-overlay”);
if (existingPopup) {
existingPopup.remove();
}

if (item.has_variants) {

```
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
```

}

if (item.extras && item.extras.filter(e => e).length > 0) {
showExtrasPopup(item);
return;
}

addToCart({
…item,
product_id: item.id
}, renderCart);
}

/* ===============================
Popup السايز
================================ */
function showVariantsPopup(item, variants) {

const overlay = document.createElement(“div”);
overlay.className = “popup-overlay”;

overlay.innerHTML = `
<div class="popup-box">
<h3>${item.name}</h3>

```
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
```

`;

document.body.appendChild(overlay);

overlay.querySelector(”.cancel-btn”).onclick = () => overlay.remove();
overlay.onclick = e => {
if (e.target === overlay) overlay.remove();
};
}

window.selectVariant = function (id, name, label, price) {

const baseItem = items.find(i => String(i.id) === String(id));

if (baseItem?.extras && baseItem.extras.length > 0) {
showExtrasPopup({
…baseItem,
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

document.querySelector(”.popup-overlay”)?.remove();
};

/* ===============================
Popup الإضافات
================================ */
function showExtrasPopup(item) {

const overlay = document.createElement(“div”);
overlay.className = “popup-overlay”;

overlay.innerHTML = `
<div class="popup-box">
<h3>${item.name}</h3>

```
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
```

`;

document.body.appendChild(overlay);

overlay.querySelector(”.cancel-btn”).onclick = () => overlay.remove();

overlay.querySelector(”#confirmExtras”).onclick = () => {

```
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
```

};
}

window.filterCategory = function (category, btn) {
document.querySelectorAll(”.cat”).forEach(b => b.classList.remove(“active”));
btn.classList.add(“active”);
loadItems(category);
};

window.addEventListener(“DOMContentLoaded”, async () => {

try {

```
await loadTax();

listenToTaxChanges();
listenToProductChanges();
listenToBusinessDayChanges();
```

} catch (err) {

```
console.error("🔥 INIT ERROR:", err);
```

}

await restoreShift();

loadItems(“drinks”);

loadActiveOrders(currentShiftId);

loadCancelledOrders(currentShiftId);

updateDayButton();
});

window.completeOrder = async function () {

if (!currentShiftId) {
alert(“❌ لازم تفتح شفت أول”);
return;
}

if (!cart.length) {
alert(“السلة فاضية”);
return;
}

if (TAX_RATE === null || TAX_RATE === undefined) {
alert(“⚠️ الضريبة ما تحملت”);
return;
}

const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);

const vat = HIDE_TAX
? 0
: subtotal * TAX_RATE;

const total = subtotal + vat;

openPaymentAndSave(total, subtotal, vat);
};

/* ===============================
تحديث زر اليوم
================================ */
async function updateDayButton() {

const dayBtn = document.getElementById(“dayBtn”);
if (!dayBtn) return;

const { data: openDay } = await supabase
.from(“business_days”)
.select(“id”)
.eq(“is_open”, true)
.maybeSingle();

if (openDay) {
dayBtn.textContent = “📅 إغلاق اليوم”;
dayBtn.onclick = () => window.closeDay();
} else {
dayBtn.textContent = “🌅 فتح يوم جديد”;
dayBtn.onclick = () => window.openDay();
}
}

window.updateDayButton = updateDayButton;

/* ===============================
فتح يوم جديد
================================ */
window.openDay = async function () {

const pin = prompt(“🔐 أدخل PIN المدير لفتح يوم جديد”);

if (!pin) return;

// 🔐 استدعاء RPC للتحقق من PIN المدير
const { data: managerArray, error: rpcError } = await supabase
.rpc(“verify_employee_pin”, { input_pin: pin.trim() });

if (rpcError) {
console.error(“RPC ERROR:”, rpcError);
alert(“❌ خطأ في التحقق”);
return;
}

const manager = managerArray && managerArray.length > 0 ? managerArray[0] : null;

if (!manager || manager.role !== “manager”) {
alert(“❌ غير مصرح — هذي العملية للمدير فقط”);
return;
}

const { data: existingDay } = await supabase
.from(“business_days”)
.select(“id”)
.eq(“is_open”, true)
.maybeSingle();

if (existingDay) {
alert(“⚠️ فيه يوم مفتوح بالفعل”);
updateDayButton();
return;
}

const { data: newDay, error } = await supabase
.from(“business_days”)
.insert({
day_date: new Date().toISOString().split(“T”)[0],
is_open: true,
invoice_counter: 0
})
.select()
.single();

if (error) {
console.error(error);
alert(“❌ فشل فتح اليوم: “ + error.message);
return;
}

alert(`🌅 تم فتح يوم عمل جديد\n👤 بواسطة: ${manager.name}`);

updateDayButton();
};

/* ===============================
إغلاق اليوم — يحسب يوم العمل الفعلي + يستثني الملغية
================================ */
window.closeDay = async function () {

const { data: day, error: dayErr } = await supabase
.from(“business_days”)
.select(”*”)
.eq(“is_open”, true)
.maybeSingle();

if (dayErr) {
console.error(“DAY FETCH ERROR:”, dayErr);
alert(“❌ خطأ في قراءة يوم العمل”);
return;
}

if (!day) {
alert(“❌ ما فيه يوم مفتوح”);
updateDayButton();
return;
}

const { data: openShifts } = await supabase
.from(“shifts”)
.select(`id, employees ( name )`)
.eq(“is_open”, true);

if (openShifts && openShifts.length > 0) {
const names = openShifts
.map(s => s.employees?.name || “غير معروف”)
.join(”\n”);
alert(`❌ فيه شفتات مفتوحة:\n\n${names}\n\nلازم تقفلهم أول`);
return;
}

const { data: activeOrders } = await supabase
.from(“orders”)
.select(“id”)
.eq(“status”, “active”);

if (activeOrders && activeOrders.length > 0) {
alert(“❌ فيه طلبات مفتوحة! لازم تخلصها أول”);
return;
}

// 🎯 حساب يوم العمل الفعلي:
// من وقت فتح اليوم لين الوقت الحالي
// + استثناء الطلبات الملغية
const { data: orders } = await supabase
.from(“orders”)
.select(“total”)
.eq(“is_paid”, true)
.neq(“status”, “cancelled”)  // ← استثناء الملغية
.gte(“created_at”, day.opened_at)  // ← من وقت فتح اليوم
.lte(“created_at”, new Date().toISOString());  // ← للوقت الحالي

let total = 0;
(orders || []).forEach(o => {
total += Number(o.total || 0);
});

const count = orders?.length || 0;

const ok = confirm(`
📊 تقرير يوم العمل:

💰 الإجمالي: ${formatMoney(total)}
🧾 الطلبات: ${count}

ℹ️ من ${new Date(day.opened_at).toLocaleString()}
إلى الآن

تأكيد الإغلاق؟
`);

if (!ok) return;

const { data: updated, error: updateErr } = await supabase
.from(“business_days”)
.update({
is_open: false,
closed_at: new Date().toISOString(),
total_sales: total,
total_orders: count
})
.eq(“id”, day.id)
.select();

if (updateErr) {
console.error(“CLOSE DAY ERROR:”, updateErr);
alert(“❌ فشل إغلاق اليوم: “ + updateErr.message);
return;
}

if (!updated || updated.length === 0) {
alert(“❌ ما تم تحديث اليوم — جرب مرة ثانية”);
return;
}

alert(“📅 تم إغلاق يوم العمل”);

updateDayButton();
};

const menuBtn = document.getElementById(“menuBtn”);
const menuDropdown = document.getElementById(“menuDropdown”);

if (menuBtn && menuDropdown) {

menuBtn.addEventListener(“click”, (e) => {

```
e.stopPropagation();

if (
  menuDropdown.style.display === "flex"
) {

  menuDropdown.style.display = "none";

} else {

  menuDropdown.style.display = "flex";
}
```

});

document.addEventListener(“click”, () => {

```
menuDropdown.style.display = "none";
```

});

menuDropdown.addEventListener(“click”, (e) => {
e.stopPropagation();
});
}

/* ===============================
تبديل التابات (الجارية / الملغية)
================================ */
window.showTab = function (tab, btn) {

const activeBox = document.getElementById(“activeOrders”);
const cancelledBox = document.getElementById(“cancelledOrders”);

if (activeBox) activeBox.style.display = “none”;
if (cancelledBox) cancelledBox.style.display = “none”;

document.querySelectorAll(”.tab”).forEach(t => t.classList.remove(“active”));

if (tab === “active”) {
if (activeBox) activeBox.style.display = “block”;
} else if (tab === “cancelled”) {
if (cancelledBox) cancelledBox.style.display = “block”;
}

if (btn) {
btn.classList.add(“active”);
} else if (typeof event !== “undefined” && event && event.target) {
event.target.classList.add(“active”);
}
};