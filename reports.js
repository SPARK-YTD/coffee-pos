// reports.js
import { supabase } from "./supabase.js";

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

let cancelledList = [];
let activeShiftId = null;
let cancelledChannel = null;
let realtimeWorking = false;

/* ===============================
   تحميل الطلبات الملغية
================================ */
export async function loadCancelledOrders(shiftId) {

  // لو الشفت تغيّر، نعيد الاشتراك
  const shiftChanged = activeShiftId !== shiftId;

  activeShiftId = shiftId;

  if (!shiftId) {
    cancelledList = [];
    renderCancelledOrders();
    teardownRealtime();
    return;
  }

  const { data } = await supabase
    .from("orders")
    .select("id, total, cancelled_at, status, shift_id")
    .eq("status", "cancelled")
    .eq("shift_id", shiftId)
    .order("cancelled_at", { ascending: false });

  cancelledList = data || [];

  renderCancelledOrders();

  // اشتراك مرة وحدة بس (أو لما الشفت يتغيّر)
  if (!cancelledChannel || shiftChanged) {
    setupRealtime();
  }
}

/* ===============================
   إلغاء الاشتراك
================================ */
function teardownRealtime() {

  if (cancelledChannel) {
    supabase.removeChannel(cancelledChannel);
    cancelledChannel = null;
    realtimeWorking = false;
  }
}

/* ===============================
   اشتراك Realtime
================================ */
function setupRealtime() {

  teardownRealtime();

  if (!activeShiftId) return;

  cancelledChannel = supabase
    .channel(`cancelled-orders-${activeShiftId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `shift_id=eq.${activeShiftId}`
      },
      (payload) => {

        const o = payload.new;

        if (o.status === "cancelled") {

          // ضيف لو مو موجود
          const exists = cancelledList.some(x => x.id === o.id);
          if (!exists) {
            cancelledList.unshift(o);
            renderCancelledOrders();
          }

        } else {

          // طلب رجع نشط مثلاً → شيله من قائمة الملغاة
          const idx = cancelledList.findIndex(x => x.id === o.id);
          if (idx !== -1) {
            cancelledList.splice(idx, 1);
            renderCancelledOrders();
          }
        }
      }
    )
    .subscribe((status) => {

      console.log("📡 CANCELLED ORDERS REALTIME:", status);

      if (status === "SUBSCRIBED") {
        realtimeWorking = true;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        realtimeWorking = false;
      }
    });
}

/* ===============================
   عرض الطلبات الملغية
================================ */
function renderCancelledOrders() {

  const box = document.getElementById("cancelledOrders");
  if (!box) return;

  box.innerHTML = "";

  cancelledList.forEach(order => {
    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
      <strong>طلب #${order.id.slice(0,6)}</strong><br>
      💰 ${formatMoney(order.total)}<br>
      ⏱ ${new Date(order.cancelled_at).toLocaleString()}
    `;

    box.appendChild(div);
  });
}
