async function loadReports() {

  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);

  // 🧾 الطلبات
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("*")
    .gte("created_at", startOfDay.toISOString());

  const ordersCount = orders.length;

  let totalSales = 0;
  orders.forEach(o => totalSales += o.total);

  document.getElementById("ordersCount").innerText = ordersCount;
  document.getElementById("totalSales").innerText = totalSales;

  // ☕ المنتجات الأكثر مبيع
  const { data: items } = await supabaseClient
    .from("order_items")
    .select("*");

  const map = {};

  items.forEach(item => {
    if (!map[item.item_name]) {
      map[item.item_name] = 0;
    }
    map[item.item_name] += item.qty;
  });

  let html = "";

  Object.entries(map).forEach(([name, qty]) => {
    html += `<p>${name} - ${qty}</p>`;
  });

  document.getElementById("topProducts").innerHTML = html;
}

loadReports();
