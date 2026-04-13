async function loadOrders() {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "new");

  const box = document.getElementById("orders");
  box.innerHTML = "";

  data.forEach(o => {
    box.innerHTML += `
      <div class="card">
        <h3>${o.id}</h3>
        <p>${o.total}</p>
        <button onclick="done('${o.id}')">جاهز</button>
      </div>
    `;
  });
}

async function done(id) {
  await supabase.from("orders").update({ status: "ready" }).eq("id", id);
  loadOrders();
}

setInterval(loadOrders,2000);
