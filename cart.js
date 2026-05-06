export let cart = [];

export function addToCart(item, renderCart) {

  const existing = cart.find(i =>
    i.id === item.id &&
    i.name === item.name
  );

  if (existing) {
    existing.qty += 1;

  } else {

    cart.push({
      id: item.id || null,
      product_id: item.id || null,
      name: item.name,
      price: item.price,
      qty: 1
    });
  }

  renderCart();
}

export function renderCart(formatMoney) {

  const tbody = document.getElementById("cart");

  if (!tbody) return;

  tbody.innerHTML = "";

  let total = 0;

  cart.forEach((item, i) => {

    const sum = item.qty * item.price;

    total += sum;

    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>

        <td>
          <button onclick="changeQty(${i},-1)">-</button>

          ${item.qty}

          <button onclick="changeQty(${i},1)">+</button>
        </td>

        <td>${formatMoney(sum)}</td>

        <td>
          <button onclick="removeItem(${i})">🗑</button>
        </td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
    formatMoney(total);
}

window.changeQty = function(i, d) {

  cart[i].qty += d;

  if (cart[i].qty <= 0) {
    cart.splice(i, 1);
  }

  window.renderCart(window.formatMoney);
};

window.removeItem = function(i) {

  cart.splice(i, 1);

  window.renderCart(window.formatMoney);
};