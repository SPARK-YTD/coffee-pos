// reports.js
import { supabase } from "./supabase.js";

function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

export async function loadCancelledOrders() {
  const { data } = await supabase
    .from("orders")
    .select("id, total, cancelled_at")
    .eq("status", "cancelled")
    .order("cancelled_at", { ascending: false });

  renderCancelledOrders(data || []);
}

function renderCancelledOrders(list) {
  const box = document.getElementById("cancelledOrders");
  if (!box) return;

  box.innerHTML = "";

  list.forEach(order => {
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