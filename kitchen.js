import { supabase } from "./supabase.js";

const grid = document.getElementById("ordersGrid");

// كاش الطلبات والأصناف
let ordersCache = []; // [{ order, items }]

// حالة الـ Realtime — لو ما اشتغل، نرجع لطريقة الـ polling القديمة
let realtimeWorking = false;
let pollingTimer = null;

/* ===============================
   تحميل الطلبات (المرة الأولى + fallback)
================================ */
async function loadOrders() {

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
    .eq("is_prepared", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("KITCHEN LOAD ERROR:", error);
    return;
  }

  // جلب كل الأصناف بـ query واحد (أسرع من loop)
  const orderIds = (orders || []).map(o => o.id);

  let itemsByOrder = {};

  if (orderIds.length > 0) {

    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    (items || []).forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    });
  }

  ordersCache = (orders || []).map(o => ({
    order: o,
    items: itemsByOrder[o.id] || []
  }));

  renderOrders();
}

/* ===============================
   عرض الطلبات
================================ */
function renderOrders() {

  grid.innerHTML = "";

  if (ordersCache.length === 0) {
    grid.innerHTML = `
      <div style="
        grid-column:1/-1;
        text-align:center;
        padding:40px;
        font-size:18px;
        color:#888;
      ">
        🍃 ما فيه طلبات قيد التحضير
      </div>
    `;
    return;
  }

  ordersCache.forEach(({ order, items }) => {

    const mins = getMinutes(order.created_at);

    let level = "";
    if (mins >= 10) level = "danger";
    else if (mins >= 5) level = "warning";

    const card = document.createElement("div");
    card.className = `order-card ${level}`;
    card.dataset.orderId = order.id;

    card.innerHTML = `
      <div class="order-head">
        <div class="bill-no">فاتورة #${order.invoice_number || order.id.slice(0,6)}</div>
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
  });
}

/* ===============================
   تم التجهيز
================================ */
window.markReady = async function(id) {

  await supabase
    .from("orders")
    .update({ is_prepared: true })
    .eq("id", id);

  // لو Realtime ما يشتغل، نحدث يدوياً
  if (!realtimeWorking) {
    loadOrders();
  }
  // لو شغّال، Realtime راح يشيل الطلب من الكاشة تلقائياً
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
   تحديث المؤقتات بس (محلياً، بدون قاعدة)
================================ */
function updateTimers() {

  ordersCache.forEach(({ order }) => {

    const card = grid.querySelector(`[data-order-id="${order.id}"]`);
    if (!card) return;

    const mins = getMinutes(order.created_at);

    const timerEl = card.querySelector(".timer");
    if (timerEl) timerEl.textContent = `${mins} دقيقة`;

    card.classList.remove("warning", "danger");
    if (mins >= 10) card.classList.add("danger");
    else if (mins >= 5) card.classList.add("warning");
  });
}

setInterval(updateTimers, 30000); // كل 30 ثانية محلياً

/* ===============================
   جلب طلب واحد + أصنافه
================================ */
async function fetchOneOrder(orderId) {

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  return { order, items: items || [] };
}

/* ===============================
   Realtime — يستمع لتغييرات الطلبات
================================ */
function listenRealtime() {

  supabase
    .channel("kitchen-orders")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders"
      },
      async (payload) => {

        const o = payload.new;

        // نضيف بس لو نشط ومو محضّر
        if (o.status === "active" && !o.is_prepared) {

          const result = await fetchOneOrder(o.id);
          if (!result) return;

          // ضيفه في الكاش (مرتب حسب الوقت)
          ordersCache.push(result);
          ordersCache.sort((a, b) =>
            new Date(a.order.created_at) - new Date(b.order.created_at)
          );

          renderOrders();
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders"
      },
      async (payload) => {

        const o = payload.new;
        const idx = ordersCache.findIndex(x => x.order.id === o.id);

        // لو صار محضّر/ملغي/مكتمل → نشيله من المطبخ
        if (o.is_prepared || o.status !== "active") {
          if (idx !== -1) {
            ordersCache.splice(idx, 1);
            renderOrders();
          }
          return;
        }

        // لو موجود نحدث بياناته
        if (idx !== -1) {
          ordersCache[idx].order = o;
          renderOrders();
        } else {
          // طلب رجع نشط (نادر) → نضيفه
          const result = await fetchOneOrder(o.id);
          if (result) {
            ordersCache.push(result);
            renderOrders();
          }
        }
      }
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "order_items"
      },
      (payload) => {

        const it = payload.new;
        const idx = ordersCache.findIndex(x => x.order.id === it.order_id);

        if (idx !== -1) {
          ordersCache[idx].items.push(it);
          renderOrders();
        }
      }
    )
    .subscribe((status) => {

      console.log("📡 KITCHEN REALTIME:", status);

      if (status === "SUBSCRIBED") {
        // Realtime اشتغل — وقّف الـ polling لو شغّال
        realtimeWorking = true;
        if (pollingTimer) {
          clearInterval(pollingTimer);
          pollingTimer = null;
        }
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        // Realtime ما اشتغل — شغّل الـ polling
        realtimeWorking = false;
        startPollingFallback();
      }
    });
}

/* ===============================
   Fallback — الطريقة القديمة لو Realtime ما يشتغل
================================ */
function startPollingFallback() {

  if (pollingTimer) return; // شغّال أصلاً

  console.warn("⚠️ Realtime مو شغّال — رجعنا للـ polling كل 5 ثواني");

  pollingTimer = setInterval(() => {
    loadOrders();
  }, 5000);
}

/* ===============================
   تشغيل الصفحة
================================ */
loadOrders();
listenRealtime();
