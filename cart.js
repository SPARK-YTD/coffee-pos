export const cart = [];

/* ===============================
   تنسيق العملة
================================ */
function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

/* ===============================
   إضافة للسلة
================================ */
export function addToCart(item, callback = null) {

  const existing = cart.find(i =>
    i.name === item.name &&
    i.price === item.price
  );

  if (existing) {
    existing.qty += 1;

  } else {
    cart.push({
      ...item,
      qty: 1
    });
  }

  if (callback) {
  callback();
} else {
  renderCart();
}
}

/* ===============================
   حذف عنصر
================================ */
export function removeFromCart(index) {

  cart.splice(index, 1);

  renderCart();
}

/* ===============================
   تغيير الكمية
================================ */
export function changeQty(index, change) {

  if (!cart[index]) return;

  cart[index].qty += change;

  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  renderCart();
}

/* ===============================
   تفريغ السلة
================================ */
export function clearCart() {

  cart.length = 0;

  renderCart();
}

/* ===============================
   رسم السلة
================================ */
export function renderCart() {

  const cartBox = document.getElementById("cart");
  const totalBox = document.getElementById("total");

  if (!cartBox || !totalBox) return;

  cartBox.innerHTML = "";

  let total = 0;

  cart.forEach((item, index) => {

    total += item.price * item.qty;

    const div = document.createElement("div");
    div.className = "cart-item";

    div.innerHTML = `
      <div class="cart-top">

        <div class="cart-name">
          ${item.name}
        </div>

        <div class="cart-price">
          ${formatMoney(item.price * item.qty)}
        </div>

      </div>

      <div class="cart-controls">

        <button onclick="window.changeQty(${index}, -1)">
          ➖
        </button>

        <span>
          ${item.qty}
        </span>

        <button onclick="window.changeQty(${index}, 1)">
          ➕
        </button>

        <button 
          onclick="window.removeFromCart(${index})"
          class="remove-btn"
        >
          🗑
        </button>

      </div>
    `;

    cartBox.appendChild(div);
  });

  totalBox.textContent = formatMoney(total);
}

/* ===============================
   ربط مع window
================================ */
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.renderCart = renderCart;