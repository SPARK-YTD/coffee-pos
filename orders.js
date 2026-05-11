import { supabase } from "./supabase.js";
import { loadCancelledOrders } from "./reports.js";

let activeOrders = [];
let activeShiftId = null;
let ordersChannel = null;
let realtimeWorking = false;

/* ===============================
   تنسيق الوقت بتوقيت الرياض
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

  return get("year") + "/" + get("month") + "/" + get("day") + " - " + get("hour") + ":" + get("minute") + " " + (get("dayPeriod") === "AM" ? "ص" : "م");
}

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
    div.className = order.is_prepared ? "order-box prepared" : "order-box";

    div.innerHTML = `
      <strong>🧾 فاتورة رقم ${order.invoice_number || order.id.slice(0,6)}</strong><br>
      💰 ${window.formatMoney(order.total)}<br>
      ${order.is_paid ? "✅ مدفوع" : "❌ غير مدفوع"}<br>
      ${order.is_prepared ? "🟢 جاهز" : "🟡 قيد التحضير"}<br><br>

      <button onclick="viewOrder('${order.id}')">👁 عرض</button>
      <button onclick="reprintOrder('${order.id}')">🖨️ إعادة طباعة</button>
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
   إلغاء الطلب (المدير فقط)
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
   عرض تفاصيل الفاتورة (Popup تفصيلي)
================================ */
window.viewOrder = async function(orderId) {

  // جلب بيانات الفاتورة
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    alert("❌ ما قدرنا نجيب بيانات الفاتورة");
    return;
  }

  // جلب الأصناف
  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!items) {
    alert("❌ ما فيه أصناف");
    return;
  }

  // بناء جدول الأصناف
  let itemsHtml = "";
  let subtotalCalc = 0;

  items.forEach(i => {
    const itemTotal = i.price * i.qty;
    subtotalCalc += itemTotal;

    let extrasNote = "";
    if (i.extras_added && Array.isArray(i.extras_added) && i.extras_added.length > 0) {
      extrasNote = '<br><small style="color:#666">إضافات: ' + i.extras_added.join(", ") + '</small>';
    }

    let notesText = "";
    if (i.notes) {
      notesText = '<br><small style="color:#999">📝 ' + i.notes + '</small>';
    }

    itemsHtml += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px;text-align:right;">${i.item_name}${extrasNote}${notesText}</td>
        <td style="padding:8px;text-align:center;">${i.qty}</td>
        <td style="padding:8px;text-align:center;">${Number(i.price).toFixed(2)}</td>
        <td style="padding:8px;text-align:left;">${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });

  // طريقة الدفع
  let paymentText = "—";
  if (order.payment_method === "cash") paymentText = "💵 كاش";
  else if (order.payment_method === "card") paymentText = "💳 بطاقة";
  else if (order.payment_method === "mixed") paymentText = "💵💳 مختلط";

  // حالة الدفع والتحضير
  const paidBadge = order.is_paid
    ? '<span style="color:#4caf50;font-weight:bold;">✅ مدفوع</span>'
    : '<span style="color:#f44336;font-weight:bold;">❌ غير مدفوع</span>';

  const preparedBadge = order.is_prepared
    ? '<span style="color:#4caf50;font-weight:bold;">🟢 جاهز</span>'
    : '<span style="color:#ff9800;font-weight:bold;">🟡 قيد التحضير</span>';

  // بناء HTML
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:99999;padding:20px;";

  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;padding:0;direction:rtl;">

      <div style="background:#4a3a2c;color:#fff;padding:15px 20px;border-radius:12px 12px 0 0;">
        <h3 style="margin:0;text-align:center;">
          🧾 تفاصيل الفاتورة #${order.invoice_number || order.id.slice(0,6)}
        </h3>
      </div>

      <div style="padding:20px;">

        <div style="background:#f9f9f9;padding:12px;border-radius:8px;margin-bottom:15px;">
          <div style="margin:5px 0;"><strong>📅 التاريخ:</strong> ${formatDateTime(order.created_at)}</div>
          <div style="margin:5px 0;"><strong>💳 الحالة:</strong> ${paidBadge}</div>
          <div style="margin:5px 0;"><strong>🍽️ التحضير:</strong> ${preparedBadge}</div>
          <div style="margin:5px 0;"><strong>💰 طريقة الدفع:</strong> ${paymentText}</div>
        </div>

        <h4 style="margin:15px 0 10px 0;">🛒 الأصناف:</h4>

        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px;text-align:right;">الصنف</th>
              <th style="padding:8px;text-align:center;">الكمية</th>
              <th style="padding:8px;text-align:center;">السعر</th>
              <th style="padding:8px;text-align:left;">المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin-top:15px;">
          ${order.subtotal ? `
            <div style="display:flex;justify-content:space-between;margin:5px 0;">
              <span>المجموع الفرعي:</span>
              <strong>${Number(order.subtotal).toFixed(2)} ﷼</strong>
            </div>
          ` : ""}

          ${order.vat && order.vat > 0 ? `
            <div style="display:flex;justify-content:space-between;margin:5px 0;">
              <span>الضريبة:</span>
              <strong>${Number(order.vat).toFixed(2)} ﷼</strong>
            </div>
          ` : ""}

          <div style="display:flex;justify-content:space-between;margin:10px 0 0 0;padding-top:10px;border-top:2px solid #4a3a2c;font-size:16px;">
            <span><strong>💰 الإجمالي:</strong></span>
            <strong style="color:#4a3a2c;">${Number(order.total).toFixed(2)} ﷼</strong>
          </div>

          ${order.cash_amount && order.cash_amount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin:5px 0;font-size:13px;color:#666;">
              <span>💵 المدفوع كاش:</span>
              <span>${Number(order.cash_amount).toFixed(2)} ﷼</span>
            </div>
          ` : ""}

          ${order.card_amount && order.card_amount > 0 ? `
            <div style="display:flex;justify-content:space-between;margin:5px 0;font-size:13px;color:#666;">
              <span>💳 المدفوع بالبطاقة:</span>
              <span>${Number(order.card_amount).toFixed(2)} ﷼</span>
            </div>
          ` : ""}
        </div>

        <div style="text-align:center;margin-top:20px;">
          <button class="close-view-btn" style="padding:10px 30px;background:#4a3a2c;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
            إغلاق
          </button>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".close-view-btn").onclick = () => overlay.remove();

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
};

/* ===============================
   إعادة طباعة الفاتورة
================================ */
window.reprintOrder = async function(orderId) {

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    alert("❌ ما قدرنا نجيب الفاتورة");
    return;
  }

  const { data: items } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);

  if (!items || items.length === 0) {
    alert("❌ ما فيه أصناف");
    return;
  }

  const reprintTime = formatDateTime(new Date().toISOString());
  const originalTime = formatDateTime(order.created_at);
  const invoiceNum = order.invoice_number || "—";
  const totalAmount = Number(order.total).toFixed(2);

  // بناء جدول الأصناف
  let itemsRows = "";
  items.forEach(function(i) {
    const itemTotal = (i.price * i.qty).toFixed(2);
    itemsRows += '<tr>';
    itemsRows += '<td>' + i.item_name + '</td>';
    itemsRows += '<td style="text-align:center">' + i.qty + '</td>';
    itemsRows += '<td style="text-align:left">' + itemTotal + '</td>';
    itemsRows += '</tr>';
  });

  // طريقة الدفع
  let paymentBlock = "";
  if (order.payment_method) {
    let payText = "مختلط";
    if (order.payment_method === "cash") payText = "كاش";
    if (order.payment_method === "card") payText = "بطاقة";
    paymentBlock = '<div class="info" style="margin-top:10px;"><div><strong>طريقة الدفع:</strong> ' + payText + '</div></div>';
  }

  let html = "";
  html += '<!DOCTYPE html>';
  html += '<html dir="rtl">';
  html += '<head>';
  html += '<meta charset="UTF-8">';
  html += '<title>إعادة طباعة فاتورة</title>';
  html += '<style>';
  html += 'body{font-family:Arial,sans-serif;max-width:80mm;margin:0 auto;padding:10px;font-size:14px;}';
  html += '.reprint-banner{background:#ffeb3b;color:#000;padding:8px;text-align:center;font-weight:bold;margin-bottom:15px;border:2px dashed #f57c00;font-size:13px;}';
  html += '.header{text-align:center;margin-bottom:15px;border-bottom:1px dashed #000;padding-bottom:10px;}';
  html += '.header h2{margin:0;font-size:18px;}';
  html += '.info{margin-bottom:10px;}';
  html += '.info div{margin:4px 0;}';
  html += 'table{width:100%;border-collapse:collapse;margin:10px 0;}';
  html += 'th,td{padding:5px;border-bottom:1px dashed #999;}';
  html += 'th{background:#f0f0f0;}';
  html += '.total{font-weight:bold;font-size:16px;text-align:center;margin-top:15px;padding:10px;border:2px solid #000;}';
  html += '.footer{text-align:center;margin-top:20px;font-size:12px;color:#666;}';
  html += '@media print{.no-print{display:none;}}';
  html += '</style>';
  html += '</head>';
  html += '<body>';
  html += '<div class="reprint-banner">نسخة معاد طباعتها<br>REPRINT - NOT ORIGINAL</div>';
  html += '<div class="header"><h2>☕ سكوب لاب</h2></div>';
  html += '<div class="info">';
  html += '<div><strong>فاتورة رقم:</strong> ' + invoiceNum + '</div>';
  html += '<div><strong>التاريخ الأصلي:</strong> ' + originalTime + '</div>';
  html += '<div><strong>تاريخ إعادة الطباعة:</strong> ' + reprintTime + '</div>';
  html += '</div>';
  html += '<table>';
  html += '<thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>';
  html += '<tbody>' + itemsRows + '</tbody>';
  html += '</table>';
  html += '<div class="total">الإجمالي: ' + totalAmount + ' ر.س</div>';
  html += paymentBlock;
  html += '<div class="footer">شكراً لزيارتكم<br><small>هذه نسخة معاد طباعتها من الفاتورة الأصلية</small></div>';
  html += '</body>';
  html += '</html>';

  // إنشاء iframe مخفي للطباعة (يشتغل في الجوال)
  let printFrame = document.getElementById("reprintFrame");
  if (printFrame) {
    printFrame.remove();
  }

  printFrame = document.createElement("iframe");
  printFrame.id = "reprintFrame";
  printFrame.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;";
  document.body.appendChild(printFrame);

  const doc = printFrame.contentDocument || printFrame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // طباعة بعد التحميل
  setTimeout(function() {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.error("Print error:", e);
      alert("❌ خطأ في الطباعة: " + e.message);
    }
  }, 500);
};
