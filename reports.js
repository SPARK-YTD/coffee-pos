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

  const todayMap = {};
  const yesterdayMap = {};

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  orders.forEach(order => {
    const date = new Date(order.created_at);

    // اليوم
    if (date.toDateString() === today.toDateString()) {
      if (!todayMap["today"]) todayMap["today"] = 0;
      todayMap["today"] += order.total;
    }

    // أمس
    if (date.toDateString() === yesterday.toDateString()) {
      if (!yesterdayMap["yesterday"]) yesterdayMap["yesterday"] = 0;
      yesterdayMap["yesterday"] += order.total;
    }
  });

  const todayTotal = todayMap["today"] || 0;
  const yesterdayTotal = yesterdayMap["yesterday"] || 0;

  const ctx = document.getElementById("salesChart");

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["اليوم", "أمس"],
      datasets: [{
        label: "المبيعات",
        data: [todayTotal, yesterdayTotal],
        borderWidth: 2
      }]
    }
  });
}