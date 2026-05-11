// reports.js
import { supabase } from "./supabase.js";

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

/* ===============================
   تنسيق الوقت — توقيت الرياض (UTC+3) صراحة
================================ */
function formatDateTime(dateStr) {
  if (!dateStr) return "-";

  let isoStr = String(dateStr);
  if (!isoStr.endsWith("Z") && !isoStr.includes("+") && !isoStr.match(/-\d\d:\d\d$/)) {
    isoStr = isoStr.replace(" ", "T") + "Z";
  }

  const d = new Date(isoStr);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).formatToParts(d);

  const get = (type) => parts.find(p => p.type === type)?.value || "";

  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const mins = get("minute");
  const period = get("dayPeriod") === "AM" ? "ص" : "م";

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
