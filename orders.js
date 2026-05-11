import { supabase } from “./supabase.js”;
import { loadCancelledOrders } from “./reports.js”;

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
.from(“orders”)
.select(“id, invoice_number, total, is_paid, is_prepared, created_at, shift_id, status”)
.eq(“status”, “active”)
.eq(“shift_id”, currentShiftId)
.order(“created_at”, { ascending: false });

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
“postgres_changes”,
{
event: “*”,
schema: “public”,
table: “orders”,
filter: `shift_id=eq.${activeShiftId}`
},
(payload) => {

```
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
    console.warn("⚠️ Realtime مشكلة على orders — راح يستخدم تحديث يدوي");
  }
});
```

}

/* ===============================
عرض الطلبات
================================ */
export function renderActiveOrders() {

const box = document.getElementById(“activeOrders”);

if (!box) return;

box.innerHTML = “”;

activeOrders.forEach(order => {

```
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
  <button onclick="reprintOrder('${order.id}')">🖨️ إعادة طباعة</button>
  <button onclick="cancelOrder('${order.id}')">❌ إلغاء</button>
  <button onclick="markCompleted('${order.id}')">تم التسليم</button>
`;

box.appendChild(div);
```

});
}

/* ===============================
تم التسليم
================================ */
window.markCompleted = async function(id) {

await supabase
.from(“orders”)
.update({ status: “completed” })
.eq(“id”, id);

if (!realtimeWorking) {
await loadActiveOrders(localStorage.getItem(“shiftId”));
}
};

/* ===============================
إلغاء الطلب (المدير فقط - عبر RPC)
================================ */
window.cancelOrder = async function(id) {

const pin = prompt(“🔐 أدخل رمز المدير لإلغاء الفاتورة”);

if (!pin) return;

const { data: managerArray, error: rpcError } = await supabase
.rpc(“verify_employee_pin”, { input_pin: pin.trim() });

if (rpcError) {
console.error(“RPC ERROR:”, rpcError);
alert(“❌ خطأ في التحقق”);
return;
}

const manager = managerArray && managerArray.length > 0 ? managerArray[0] : null;

if (!manager || manager.role !== “manager”) {
alert(“❌ غير مصرح — هذا الإجراء للمدير فقط”);
return;
}

if (!confirm(“⚠️ تأكيد إلغاء الفاتورة؟”)) return;

await supabase
.from(“orders”)
.update({
status: “cancelled”,
cancelled_by: manager.id,
cancelled_at: new Date().toISOString()
})
.eq(“id”, id);

alert(“✅ تم إلغاء الفاتورة”);

if (!realtimeWorking) {
await loadActiveOrders(localStorage.getItem(“shiftId”));
loadCancelledOrders(localStorage.getItem(“shiftId”));
}
};

/* ===============================
عرض تفاصيل الطلب
================================ */
window.viewOrder = async function(orderId) {

const { data } = await supabase
.from(“order_items”)
.select(”*”)
.eq(“order_id”, orderId);

if (!data) return;

alert(
data.map(i => `${i.item_name} × ${i.qty}`).join(”\n”)
);
};

/* ===============================
تنسيق الوقت
================================ */
function formatPrintTime(d) {
const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, “0”);
const dd = String(d.getDate()).padStart(2, “0”);
let hours = d.getHours();
const mins = String(d.getMinutes()).padStart(2, “0”);
const period = hours >= 12 ? “PM” : “AM”;
hours = hours % 12;
if (hours === 0) hours = 12;
const hh = String(hours).padStart(2, “0”);
return yyyy + “/” + mm + “/” + dd + “ - “ + hh + “:” + mins + “ “ + period;
}

/* ===============================
إعادة طباعة الفاتورة
================================ */
window.reprintOrder = async function(orderId) {

// جلب الفاتورة
const { data: order, error: orderErr } = await supabase
.from(“orders”)
.select(”*”)
.eq(“id”, orderId)
.single();

if (orderErr || !order) {
alert(“❌ ما قدرنا نجيب الفاتورة”);
return;
}

// جلب الأصناف
const { data: items } = await supabase
.from(“order_items”)
.select(”*”)
.eq(“order_id”, orderId);

if (!items || items.length === 0) {
alert(“❌ ما فيه أصناف في الفاتورة”);
return;
}

const reprintTime = formatPrintTime(new Date());
const originalTime = formatPrintTime(new Date(order.created_at));
const invoiceNum = order.invoice_number || “—”;
const totalAmount = Number(order.total).toFixed(2);

// بناء جدول الأصناف
let itemsRows = “”;
items.forEach(function(i) {
const itemTotal = (i.price * i.qty).toFixed(2);
itemsRows += ‘<tr>’;
itemsRows += ‘<td>’ + i.item_name + ‘</td>’;
itemsRows += ‘<td style="text-align:center">’ + i.qty + ‘</td>’;
itemsRows += ‘<td style="text-align:left">’ + itemTotal + ‘</td>’;
itemsRows += ‘</tr>’;
});

// طريقة الدفع
let paymentBlock = “”;
if (order.payment_method) {
let payText = “مختلط”;
if (order.payment_method === “cash”) payText = “كاش”;
if (order.payment_method === “card”) payText = “بطاقة”;
paymentBlock = ’<div class="info" style="margin-top:10px;"><div><strong>💳 طريقة الدفع:</strong> ’ + payText + ‘</div></div>’;
}

// بناء HTML للفاتورة (بدون template literal كبير)
let html = “”;
html += ‘<!DOCTYPE html>’;
html += ‘<html dir="rtl">’;
html += ‘<head>’;
html += ‘<meta charset="UTF-8">’;
html += ‘<title>إعادة طباعة فاتورة</title>’;
html += ‘<style>’;
html += ‘body{font-family:Arial,sans-serif;max-width:80mm;margin:0 auto;padding:10px;font-size:14px;}’;
html += ‘.reprint-banner{background:#ffeb3b;color:#000;padding:8px;text-align:center;font-weight:bold;margin-bottom:15px;border:2px dashed #f57c00;font-size:13px;}’;
html += ‘.header{text-align:center;margin-bottom:15px;border-bottom:1px dashed #000;padding-bottom:10px;}’;
html += ‘.header h2{margin:0;font-size:18px;}’;
html += ‘.info{margin-bottom:10px;}’;
html += ‘.info div{margin:4px 0;}’;
html += ‘table{width:100%;border-collapse:collapse;margin:10px 0;}’;
html += ‘th,td{padding:5px;border-bottom:1px dashed #999;}’;
html += ‘th{background:#f0f0f0;}’;
html += ‘.total{font-weight:bold;font-size:16px;text-align:center;margin-top:15px;padding:10px;border:2px solid #000;}’;
html += ‘.footer{text-align:center;margin-top:20px;font-size:12px;color:#666;}’;
html += ‘@media print{.no-print{display:none;}}’;
html += ‘</style>’;
html += ‘</head>’;
html += ‘<body>’;
html += ‘<div class="reprint-banner">⚠️ نسخة معاد طباعتها<br>REPRINT - NOT ORIGINAL</div>’;
html += ‘<div class="header"><h2>☕ سكوب لاب</h2></div>’;
html += ‘<div class="info">’;
html += ’<div><strong>🧾 فاتورة رقم:</strong> ’ + invoiceNum + ‘</div>’;
html += ’<div><strong>📅 التاريخ الأصلي:</strong> ’ + originalTime + ‘</div>’;
html += ’<div><strong>🖨️ تاريخ إعادة الطباعة:</strong> ’ + reprintTime + ‘</div>’;
html += ‘</div>’;
html += ‘<table>’;
html += ‘<thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>’;
html += ‘<tbody>’ + itemsRows + ‘</tbody>’;
html += ‘</table>’;
html += ‘<div class="total">💰 الإجمالي: ’ + totalAmount + ’ ﷼</div>’;
html += paymentBlock;
html += ‘<div class="footer">شكراً لزيارتكم 🙏<br><small>هذه نسخة معاد طباعتها من الفاتورة الأصلية</small></div>’;
html += ‘<div class="no-print" style="text-align:center; margin-top:20px;">’;
html += ‘<button onclick="window.print()" style="padding:10px 30px; font-size:16px; cursor:pointer;">🖨️ طباعة</button>’;
html += ‘<button onclick="window.close()" style="padding:10px 30px; font-size:16px; cursor:pointer; margin-right:10px;">❌ إغلاق</button>’;
html += ‘</div>’;
html += ‘</body>’;
html += ‘</html>’;

// فتح نافذة جديدة
const printWindow = window.open(””, “_blank”, “width=400,height=600”);

if (!printWindow) {
alert(“❌ لم تفتح نافذة الطباعة. تأكد من السماح للنوافذ المنبثقة.”);
return;
}

printWindow.document.write(html);
printWindow.document.close();

printWindow.onload = function() {
setTimeout(function() {
printWindow.print();
}, 250);
};
}; 
