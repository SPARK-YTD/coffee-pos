async function saveProduct() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const file = document.getElementById("image").files[0];

  let imageUrl = "";

  if (file) {
    const fileName = Date.now() + file.name;

    await supabaseClient.storage
      .from("products")
      .upload(fileName, file);

    const { data } = supabaseClient.storage
      .from("products")
      .getPublicUrl(fileName);

    imageUrl = data.publicUrl;
  }

  await supabaseClient.from("products").insert([
    { name, base_price: price, image_url: imageUrl }
  ]);

  alert("تم الحفظ ✅");
  loadProducts();
}

async function loadProducts() {
  const { data } = await supabaseClient
    .from("products")
    .select("*");

  const box = document.getElementById("products");
  box.innerHTML = "";

  data.forEach(p => {
    box.innerHTML += `
      <div>
        ${p.name} - ${p.base_price}
      </div>
    `;
  });
}

async function addEmployee() {
  const name = document.getElementById("emp_name").value;
  const num = document.getElementById("emp_num").value;
  const pass = document.getElementById("emp_pass").value;

  await supabaseClient.from("employees").insert([
    { name, employee_number: num, password: pass, role: "cashier" }
  ]);

  alert("تم إضافة الموظف");
  loadEmployees();
}

async function loadEmployees() {
  const { data } = await supabaseClient
    .from("employees")
    .select("*");

  const el = document.getElementById("employeesList");
  el.innerHTML = "";

  data.forEach(e => {
    el.innerHTML += `<div>${e.name}</div>`;
  });
}

loadProducts();
loadEmployees();