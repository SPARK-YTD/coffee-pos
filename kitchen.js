import { supabase } from "./supabase.js";

const grid = document.getElementById("ordersGrid");

/* ===============================
   تحميل الطلبات
================================ */
async function loadOrders() {

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  renderOrders(orders || []);
}

/* ===============================
   عرض الطلبات
================================ */
async function renderOrders(orders) {

  grid.innerHTML = "";

  for (const order of orders) {

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    const mins = getMinutes(order.created_at);

    let level = "";
    if (mins >= 10) level = "danger";
    else if (mins >= 5) level = "warning";

    const card = document.createElement("div");
    card.className = `order-card ${level}`;

    card.innerHTML = `
      <div class="order-head">
        <div class="bill-no">فاتورة #${order.id.slice(0,6)}</div>
        <div class="timer">${mins} دقيقة</div>
      </div>

      <div class="items-list">
        ${(items || []).map(i => `
          <div class="item-row">
            <div class="item-name">${i.item_name}</div>
            <div class="item-qty">× ${i.qty}</div>
          </div>
        `).join("")}
      </div>

      <button class="done-btn"
        onclick="markReady('${order.id}')">
        ✅ تم التجهيز
      </button>
    `;

    grid.appendChild(card);
  }
}

/* ===============================
   تم التجهيز
================================ */
window.markReady = async function(id) {

  await supabase
    .from("orders")
    .update({ status: "ready" })
    .eq("id", id);

  loadOrders();
};

/* ===============================
   حساب الوقت
================================ */
function getMinutes(date) {

  const created = new Date(date).getTime();
  const now = new Date().getTime();

  return Math.floor((now - created) / 60000);
}

/* ===============================
   تحديث تلقائي
================================ */
loadOrders();

setInterval(() => {
  loadOrders();
}, 5000);