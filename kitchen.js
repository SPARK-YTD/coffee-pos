async function loadOrders() {
  const { data: orders, error } = await supabaseClient
    .from("orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const container = document.getElementById("orders");
  container.innerHTML = "";

  for (let order of orders) {
    // نجيب عناصر الطلب
    const { data: items } = await supabaseClient
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    const div = document.createElement("div");
    div.style.border = "2px solid black";
    div.style.margin = "10px";
    div.style.padding = "10px";

    let itemsHTML = "";

    items.forEach(item => {
      itemsHTML += `<li>${item.item_name} - ${item.price}</li>`;
    });

    div.innerHTML = `
      <h3>طلب #${order.id.slice(0, 5)}</h3>
      <ul>${itemsHTML}</ul>
      <p>المجموع: ${order.total} BD</p>
      <button onclick="markReady('${order.id}')">جاهز</button>
    `;

    container.appendChild(div);
  }
}

async function markReady(orderId) {
  const { error } = await supabaseClient
    .from("orders")
    .update({ status: "completed" })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    return;
  }

  loadOrders();
}

// تحديث كل 3 ثواني
setInterval(loadOrders, 3000);

loadOrders();
