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
