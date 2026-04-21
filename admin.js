import { supabase } from "./supabase.js";

const SESSION_TIMEOUT = 30 * 60 * 1000;

// تحديث آخر نشاط
function updateLastActivity() {
  localStorage.setItem("lastActivity", Date.now());
}

// التحقق من الجلسة
function isSessionValid() {
  const last = localStorage.getItem("lastActivity");
  if (!last) return false;

  const diff = Date.now() - Number(last);
  return diff < SESSION_TIMEOUT;
}


if (localStorage.getItem("admin") === "true" && isSessionValid()) {
  console.log("✅ جلسة نشطة");
  updateLastActivity();
} else {

  localStorage.removeItem("admin");

  const pin = prompt("🔐 أدخل رقم المدير");

if (!pin) {
  alert("❌ لازم تدخل رقم المدير");
  location.reload();
  return;
}

const { data: manager } = await supabase
  .from("employees")
  .select("id, role, name")
  .eq("pin", pin.trim())
  .eq("role", "manager")
  .maybeSingle();

if (!manager) {
  alert("❌ غير مصرح");
  location.reload();
  return;
}

localStorage.setItem("admin", "true");
updateLastActivity();
}

/* ===============================
   التنقل بين التبويبات
================================ */
window.showAdminTab = function(type) {

  const sections = {
    products: document.getElementById("productsTab"),
    employees: document.getElementById("employeesTab"),
    sales: document.getElementById("salesTab"),
    reports: document.getElementById("reportsTab"),
  };

  // إخفاء الكل
  document.querySelectorAll(".admin-section")
    .forEach(s => s.style.display = "none");

  document.querySelectorAll(".tab")
    .forEach(t => t.classList.remove("active"));

  // إظهار القسم
  sections[type].style.display = "block";

  const index = ["products","employees","sales","reports"].indexOf(type);
  document.querySelectorAll(".tab")[index].classList.add("active");

  // تحميل البيانات حسب التبويب
  if (type === "sales") loadSales();
  if (type === "reports") loadReport();
  if (type === "employees") loadEmployees();
};


/* ===============================
   الموظفين
================================ */

// إضافة موظف
window.addEmployee = async function() {
  const name = document.getElementById("empName").value.trim();
  const pin = document.getElementById("empPin").value.trim();
  const role = document.getElementById("empRole").value;

  if (!name || !pin) {
    alert("❌ اكتب الاسم و PIN");
    return;
  }

  const { error } = await supabase
    .from("employees")
    .insert({ name, pin, role });

  if (error) {
    alert(error.message);
    return;
  }

  alert("✅ تم إضافة الموظف");

  // تنظيف الحقول
  document.getElementById("empName").value = "";
  document.getElementById("empPin").value = "";

  loadEmployees();
};


// عرض الموظفين
async function loadEmployees() {
  const { data } = await supabase.from("employees").select("*");

  const box = document.getElementById("employeesList");
  box.innerHTML = "";

  (data || []).forEach(e => {
    box.innerHTML += `
      <div style="margin-bottom:8px">
        👤 ${e.name} (${e.role})
        <button onclick="deleteEmployee('${e.id}')">🗑</button>
      </div>
    `;
  });
}


// حذف موظف
window.deleteEmployee = async function(id) {
  if (!confirm("حذف الموظف؟")) return;

  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};


/* ===============================
   المبيعات (completed فقط)
================================ */

async function loadSales() {

  const { data } = await supabase
    .from("orders")
    .select("total, cash_amount, card_amount")
    .eq("status", "completed"); // 🔥 فقط المسلّم

  let total = 0;
  let cash = 0;
  let card = 0;

  (data || []).forEach(o => {
    total += Number(o.total || 0);
    cash += Number(o.cash_amount || 0);
    card += Number(o.card_amount || 0);
  });

  document.getElementById("salesBox").innerHTML = `
    <div class="card">
      <h3>💰 المبيعات</h3>
      <p>الإجمالي: ${total.toFixed(2)} ر.س</p>
      <p>💵 كاش: ${cash.toFixed(2)} ر.س</p>
      <p>💳 بطاقة: ${card.toFixed(2)} ر.س</p>
      <p>🧾 عدد الطلبات: ${(data || []).length}</p>
    </div>
  `;
}


/* ===============================
   التقارير
================================ */

async function loadReport() {

  const { data: cancelled } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "cancelled");

  document.getElementById("reportBox").innerHTML = `
    <div class="card">
      <h3>📊 التقارير</h3>
      <p>❌ الطلبات الملغية: ${cancelled?.length || 0}</p>
    </div>
  `;
}


/* ===============================
   تشغيل أولي
================================ */

// يبدأ على تبويب الأصناف
showAdminTab("products");

["click", "mousemove", "keydown", "touchstart"].forEach(event => {
  document.addEventListener(event, updateLastActivity);
});

let sessionExpired = false;

setInterval(() => {
  if (!isSessionValid() && !sessionExpired) {
    sessionExpired = true;

    alert("🔒 انتهت الجلسة");
    localStorage.removeItem("admin");
    location.reload();
  }
}, 60000);