import { supabase } from "./supabase.js";
import { loadCancelledOrders } from "./reports.js";

let activeOrders = [];

export async function loadActiveOrders(currentShiftId) {

  const { data } = await supabase
    .from("orders")
    .select("id, invoice_number, total, is_paid, is_prepared, created_at")
    .eq("status", "active")
    .eq("shift_id", currentShiftId)
    .order("created_at", { ascending: false });

  activeOrders = data || [];

  renderActiveOrders(currentShiftId);
}

export function renderActiveOrders(currentShiftId) {

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

window.markCompleted = async function(id) {

  await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  await loadActiveOrders(localStorage.getItem("shiftId"));
};

window.cancelOrder = async function(id) {

  const pin = prompt("🔐 أدخل رقم المدير");

  if (!pin) return;

  const { data: manager } = await supabase
    .from("employees")
    .select("id, role")
    .eq("pin", pin.trim())
    .eq("role", "manager")
    .maybeSingle();

  if (!manager) {
    alert("❌ غير مصرح");
    return;
  }

  if (!confirm("تأكيد إلغاء الطلب؟")) return;

  await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_by: manager.id,
      cancelled_at: new Date().toISOString()
    })
    .eq("id", id);

  await loadActiveOrders(localStorage.getItem("shiftId"));

  loadCancelledOrders(localStorage.getItem("shiftId"));
};

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