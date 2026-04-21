window.showAdminTab = function(type) {

  const sections = {
    products: document.getElementById("productsTab"),
    employees: document.getElementById("employeesTab"),
    sales: document.getElementById("salesTab"),
    reports: document.getElementById("reportsTab"),
  };

  document.querySelectorAll(".admin-section")
    .forEach(s => s.style.display = "none");

  document.querySelectorAll(".tab")
    .forEach(t => t.classList.remove("active"));

  sections[type].style.display = "block";

  const index = ["products","employees","sales","reports"].indexOf(type);
  document.querySelectorAll(".tab")[index].classList.add("active");

  // 🔥 تحميل حسب التبويب
  if (type === "sales") loadSales();
  if (type === "reports") loadReport();
  if (type === "employees") loadEmployees();
};
async function addEmployee() {
  const name = document.getElementById("empName").value;
  const pin = document.getElementById("empPin").value;
  const role = document.getElementById("empRole").value;

  await supabase.from("employees").insert({ name, pin, role });

  alert("✅ تم إضافة الموظف");
  loadEmployees();
}

async function loadEmployees() {
  const { data } = await supabase.from("employees").select("*");

  const box = document.getElementById("employeesList");
  box.innerHTML = "";

  (data || []).forEach(e => {
    box.innerHTML += `
      <div>
        👤 ${e.name} (${e.role})
        <button onclick="deleteEmployee('${e.id}')">🗑</button>
      </div>
    `;
  });
}

window.deleteEmployee = async function(id) {
  if (!confirm("حذف الموظف؟")) return;
  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

async function loadSales() {

  const { data } = await supabase
    .from("orders")
    .select("total, cash_amount, card_amount")
    .eq("status", "completed");

  let total = 0, cash = 0, card = 0;

  (data || []).forEach(o => {
    total += Number(o.total || 0);
    cash += Number(o.cash_amount || 0);
    card += Number(o.card_amount || 0);
  });

  document.getElementById("salesBox").innerHTML = `
    <div class="card">
      <h3>💰 المبيعات</h3>
      <p>الإجمالي: ${total.toFixed(2)} ر.س</p>
      <p>كاش: ${cash.toFixed(2)} ر.س</p>
      <p>بطاقة: ${card.toFixed(2)} ر.س</p>
    </div>
  `;
}

async function loadReport() {

  const { data } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "cancelled");

  document.getElementById("reportBox").innerHTML = `
    <div class="card">
      <h3>📊 التقارير</h3>
      <p>❌ الطلبات الملغية: ${data?.length || 0}</p>
    </div>
  `;
}
