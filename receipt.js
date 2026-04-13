function loadReceipt() {
  const order = JSON.parse(localStorage.getItem("receipt"));

  if (!order) return;

  const container = document.getElementById("receipt");

  let html = "";

  order.items.forEach(item => {
    html += `<p>${item.name} - ${item.price} BD</p>`;
  });

  html += `<hr>`;
  html += `<h3>المجموع: ${order.total} BD</h3>`;

  container.innerHTML = html;
}
