// reports.js
import { supabase } from "./supabase.js";

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

/* ===============================
   تنسيق الوقت — يستخدم المنطقة الزمنية المحلية للجهاز
================================ */
function formatDateTime(dateStr) {
  if (!dateStr) return "-";

  const d = new Date(dateStr);

  // استخدام تنسيق يدوي عشان نضمن أرقام إنجليزية وتقويم ميلادي
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");

  const period = hours >= 12 ? "م" : "ص";

  // تحويل لـ 12 ساعة
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} - ${hh}:${mins} ${period}`;
}

let cancelledList = [];
let activeShiftId = null;
let cancelledChannel = null;
let realtimeWorking = false;

/* ===============================
   تحميل الطلبات الملغية
================================ */
export async function loadCancelledOrders(shiftId) {

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
    .select("id, invoice_number, total, cancelled_at, status, shift_id")
    .eq("status", "cancelled")
    .eq("shift_id", shiftId)
    .order("cancelled_at", { ascending: false });

  cancelledList = data || [];

  renderCancelledOrders();

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

          const exists = cancelledList.some(x => x.id === o.id);
          if (!exists) {
            cancelledList.unshift(o);
            renderCancelledOrders();
          }

        } else {

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

  if (cancelledList.length === 0) {
    box.innerHTML = `
      <div style="text-align:center;padding:30px;color:#888;">
        🍃 ما فيه طلبات ملغية
      </div>
    `;
    return;
  }

  cancelledList.forEach(order => {

    const div = document.createElement("div");
    div.className = "order-box";

    const invoiceNum = order.invoice_number
      ? `#${order.invoice_number}`
      : `#${order.id.slice(0,6)}`;

    div.innerHTML = `
      <strong>🧾 فاتورة ${invoiceNum}</strong><br>
      💰 ${formatMoney(order.total)}<br>
      ⏱ ${formatDateTime(order.cancelled_at)}
    `;

    box.appendChild(div);
  });
}
