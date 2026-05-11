import { supabase } from "./supabase.js";
import { loadCancelledOrders } from "./reports.js";

let activeOrders = [];
let activeShiftId = null;
let ordersChannel = null;
let realtimeWorking = false;

/* ===============================
   تحميل الطلبات النشطة
================================ */
export async function loadActiveOrders(currentShiftId) {

  const shiftChanged = activeShiftId !== currentShiftId;

  activeShiftId = currentShiftId;

  if (!currentShiftId) {
    activeOrders = [];
    renderActiveOrders();
    teardownRealtime();
    return;
  }

  const { data } = await supabase
    .from("orders")
    .select("id, invoice_number, total, is_paid, is_prepared, created_at, shift_id, status")
    .eq("status", "active")
    .eq("shift_id", currentShiftId)
    .order("created_at", { ascending: false });

  activeOrders = data || [];

  renderActiveOrders();

  if (!ordersChannel || shiftChanged) {
    setupRealtime();
  }
}

/* ===============================
   إلغاء الاشتراك
================================ */
function teardownRealtime() {

  if (ordersChannel) {
    supabase.removeChannel(ordersChannel);
    ordersChannel = null;
    realtimeWorking = false;
  }
}

/* ===============================
   اشتراك Realtime
================================ */
function setupRealtime() {

  teardownRealtime();

  if (!activeShiftId) return;

  ordersChannel = supabase
    .channel(`active-orders-${activeShiftId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `shift_id=eq.${activeShiftId}`
      },
      (payload) => {

        const eventType = payload.eventType;
        const newRow = payload.new;
        const oldRow = payload.old;

        if (eventType === "INSERT") {

          if (newRow.status === "active") {
            activeOrders.unshift(newRow);
            renderActiveOrders();
          }

        } else if (eventType === "UPDATE") {

          const idx = activeOrders.findIndex(o => o.id === newRow.id);

          if (newRow.status !== "active") {
            if (idx !== -1) {
              activeOrders.splice(idx, 1);
              renderActiveOrders();
            }

            if (newRow.status === "cancelled") {
              loadCancelledOrders(activeShiftId);
            }

          } else {
            if (idx !== -1) {
              activeOrders[idx] = newRow;
              renderActiveOrders();
            } else {
              activeOrders.unshift(newRow);
              renderActiveOrders();
            }
          }

        } else if (eventType === "DELETE") {

          const idx = activeOrders.findIndex(o => o.id === oldRow.id);
          if (idx !== -1) {
            activeOrders.splice(idx, 1);
            renderActiveOrders();
          }
        }
      }
    )
    .subscribe((status) => {

      console.log("📡 ACTIVE ORDERS REALTIME:", status);

      if (status === "SUBSCRIBED") {
        realtimeWorking = true;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        realtimeWorking = false;
        console.warn("⚠️ Realtime مشكلة على orders");
      }
    });
}

/* ===============================
   عرض الطلبات
================================ */
export function renderActiveOrders() {

  const box = document.getElementById("activeOrders");

  if (!box) return;

  box.innerHTML = "";

  activeOrders.forEach(order => {

    const div = document.createElement("div");

    div.className = order.is_prepared
      ? "order-box prepared"
      : "order-box";

    div.innerHTML = `
      <strong>🧾 فاتورة رقم ${order.invoice_number || order.id.slice(0,6)}</strong><br>
      💰 ${window.formatMoney(order.total)}<br>
      ${order.is_paid ? "✅ مدفوع" : "❌ غير مدفوع"}<br>
      ${order.is_prepared ? "🟢 جاهز" : "🟡 قيد التحضير"}<br><br>

      <button onclick="viewOrder('${order.id}')">👁 عرض</button>
      <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
      <button onclick="cancelOrder('${order.id}')">❌ إلغاء</button>
      <button onclick="markCompleted('${order.id}')">تم التسليم</button>
    `;

    box.appendChild(div);
  });
}

/* ===============================
   تم التسليم
================================ */
window.markCompleted = async function(id) {

  await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  if (!realtimeWorking) {
    await loadActiveOrders(localStorage.getItem("shiftId"));
  }
};

/* ===============================
   إلغاء الطلب (المدير فقط - عبر RPC)
================================ */
window.cancelOrder = async function(id) {

  const pin = prompt("🔐 أدخل رمز المدير لإلغاء الفاتورة");

  if (!pin) return;

  const { data: managerArray, error: rpcError } = await supabase
    .rpc("verify_employee_pin", { input_pin: pin.trim() });

  if (rpcError) {
    console.error("RPC ERROR:", rpcError);
    alert("❌ خطأ في التحقق");
    return;
  }

  const manager = managerArray && managerArray.length > 0 ? managerArray[0] : null;

  if (!manager || manager.role !== "manager") {
    alert("❌ غير مصرح — هذا الإجراء للمدير فقط");
    return;
  }

  if (!confirm("⚠️ تأكيد إلغاء الفاتورة؟")) return;

  await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_by: manager.id,
      cancelled_at: new Date().toISOString()
    })
    .eq("id", id);

  alert("✅ تم إلغاء الفاتورة");

  if (!realtimeWorking) {
    await loadActiveOrders(localStorage.getItem("shiftId"));
    loadCancelledOrders(localStorage.getItem("shiftId"));
  }
};

/* ===============================
   عرض تفاصيل الطلب
================================ */
window.viewOrder = async function(orderId) {

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!data) return;

  alert(
    data.map(i => `${i.item_name} × ${i.qty}`).join("\n")
  );
};

/* ===============================
   تعديل الطلب
================================ */
window.editOrder = async function(orderId) {

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!data) return;

  window.cart = data.map(i => ({
    id: i.product_id,
    name: i.item_name,
    price: i.price,
    qty: i.qty
  }));

  window.editingOrderId = orderId;

  window.renderCart();
};
