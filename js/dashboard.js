async function showProducts() {
  const { data } = await window.supabaseClient
    .from("products")
    .select("*");

  const grid = document.getElementById("productsGrid");
  grid.innerHTML = "";

  data.forEach(p => {
    grid.innerHTML += `
      <div class="card">
        <img src="${p.image_url || 'https://via.placeholder.com/150'}">
        <h3>${p.name}</h3>
        <p>${p.base_price} BD</p>
      </div>
    `;
  });
}

function openModal() {
  document.getElementById("modal").style.display = "block";
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

function logout() {
  location.href = "index.html";
}

// تحميل أول ما تفتح الصفحة
showProducts();