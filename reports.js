let chart;
async function loadReports() {

  const filter = document.getElementById("filter").value;

  let startDate = new Date();
  let endDate = new Date();

  if (filter === "today") {
    startDate.setHours(0,0,0,0);

  } else if (filter === "week") {
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - day);
    startDate.setHours(0,0,0,0);

  } else if (filter === "month") {
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  } else if (filter === "custom") {
    const startInput = document.getElementById("startDate").value;
    const endInput = document.getElementById("endDate").value;

    if (!startInput || !endInput) {
      alert("حدد التاريخ أول ❌");
      return;
    }

    startDate = new Date(startInput);
    endDate = new Date(endInput);
  }

  // الطلبات
  const { data: orders } = await supabaseClient
    .from("orders")
    .select("*")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString());

  const ordersCount = orders.length;

  let totalSales = 0;
  orders.forEach(o => totalSales += o.total);

  document.getElementById("ordersCount").innerText = ordersCount;
  document.getElementById("totalSales").innerText = totalSales;

  // المنتجات
const orderIds = orders.map(o => o.id);

let items = [];

if (orderIds.length > 0) {
  const { data } = await supabaseClient
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  items = data;
}

const map = {};

items.forEach(item => {
  if (!map[item.item_name]) {
    map[item.item_name] = 0;
  }
  map[item.item_name] += item.qty;
});

  let sorted = Object.entries(map)
  .sort((a, b) => b[1] - a[1]) // ترتيب تنازلي
  .slice(0, 5); // أعلى 5

let html = "";

sorted.forEach(([name, qty], index) => {
  let medal = "";

  if (index === 0) medal = "🥇";
  else if (index === 1) medal = "🥈";
  else if (index === 2) medal = "🥉";

  html += `<p>${medal} ${name} (${qty})</p>`;
});

  document.getElementById("topProducts").innerHTML = html;

drawChart(orders);
}

loadReports();

function drawChart(orders) {

  const days = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const salesMap = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};

  // 🔥 نحسب بداية الأسبوع مرة وحدة
  const now = new Date();
  const startOfWeek = new Date();
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);

  // 🔥 لفّة وحدة فقط
  orders.forEach(order => {
    const date = new Date(order.created_at);

    if (date < startOfWeek) return;

    const day = date.getDay();
    salesMap[day] += order.total;
  });

  const labels = days;
  const data = Object.values(salesMap);

  const ctx = document.getElementById("salesChart");

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "المبيعات الأسبوعية",
        data: data,
        borderWidth: 2
      }]
    }
  });
}