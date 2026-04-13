let cart = [];
let total = 0;

function addItem(name, price) {
  cart.push({ name, price });
  total += price;

  updateCart();
}

function updateCart() {
  const cartList = document.getElementById("cart");
  cartList.innerHTML = "";

  cart.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.name} - ${item.price}`;
    cartList.appendChild(li);
  });

  document.getElementById("total").textContent = "المجموع: " + total.toFixed(2);
}

function checkout() {
  alert("تم الطلب! 💸");

  cart = [];
  total = 0;
  updateCart();
}