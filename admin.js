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


window.addEventListener("load", () => {

  if (localStorage.getItem("admin") === "true" && isSessionValid()) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminApp").style.display = "block";
    loadDashboard();
    updateLastActivity();

    showAdminTab("products");  
  } else {
    localStorage.removeItem("admin");
  }

});

window.login = async function() {

  const pin = document.getElementById("loginPin").value.trim();
  const errorBox = document.getElementById("loginError");

  if (!pin) {
    errorBox.textContent = "❌ أدخل PIN";
    errorBox.style.display = "block";
    return;
  }

  const { data: manager } = await supabase
    .from("employees")
    .select("*")
    .eq("pin", pin)
    .eq("role", "manager")
    .maybeSingle();

  if (!manager) {
    errorBox.textContent = "❌ PIN خطأ";
    errorBox.style.display = "block";
    return;
  }

  localStorage.setItem("admin", "true");
  updateLastActivity();

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("adminApp").style.display = "block";
  
  loadDashboard();

  showAdminTab("products"); // ✅
  errorBox.style.display = "none"; // ✅
};
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

window.loadDailyReport = async function() {

  const date = document.getElementById("reportDate").value;

  if (!date) {
    alert("اختر تاريخ");
    return;
  }

  const start = date + " 00:00:00";
  const end = date + " 23:59:59";

  // 🟢 نجيب الشفتات في هذا اليوم
  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, employees(name)")
    .gte("opened_at", start)
    .lte("opened_at", end);

  if (!shifts || shifts.length === 0) {
    document.getElementById("reportBox").innerHTML = "❌ لا يوجد بيانات";
    return;
  }

  let totalDay = 0;

  const html = shifts.map(s => {

    totalDay += Number(s.total_sales || 0);

    return `
  <div class="card">
    👤 الموظف: ${s.employees?.name || "غير معروف"}<br>
    💰 المبيعات: ${Number(s.total_sales || 0).toFixed(2)}<br>
    💵 كاش: ${Number(s.total_cash || 0).toFixed(2)}<br>
    💳 بطاقة: ${Number(s.total_card || 0).toFixed(2)}
  </div>
`;
  }).join("");

  document.getElementById("reportBox").innerHTML = `
    ${html}
    <hr>
    <div class="card">
      💰 إجمالي اليوم: ${totalDay.toFixed(2)} ر.س
    </div>
  `;
};

window.loadRangeReport = async function() {

  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  if (!from || !to) {
    alert("حدد التاريخ");
    return;
  }

  const start = from + " 00:00:00";
  const end = to + " 23:59:59";

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, employees(name)")
    .gte("opened_at", start)
    .lte("opened_at", end);

  if (!shifts || shifts.length === 0) {
    document.getElementById("reportBox").innerHTML = "❌ لا يوجد بيانات";
    return;
  }

  let total = 0;

  const html = shifts.map(s => {

    total += Number(s.total_sales || 0);

    return `
      <div class="card">
        👤 ${s.employees?.name || "غير معروف"}<br>
        📅 ${new Date(s.opened_at).toLocaleDateString()}<br>
        💰 ${Number(s.total_sales || 0).toFixed(2)} ر.س
      </div>
    `;
  }).join("");

  document.getElementById("reportBox").innerHTML = `
    ${html}
    <hr>
    <div class="card">
      💰 إجمالي الفترة: ${total.toFixed(2)} ر.س
    </div>
  `;
};
async function loadDashboard() {

  const today = new Date().toISOString().split("T")[0];

  const start = today + " 00:00:00";
  const end = today + " 23:59:59";

  // الطلبات المسلّمة اليوم
  const { data: sales } = await supabase
    .from("orders")
    .select("total")
    .eq("status", "completed")
    .gte("created_at", start)
    .lte("created_at", end);

  // الطلبات الملغية اليوم
  const { data: cancelled } = await supabase
    .from("orders")
    .select("id")
    .eq("status", "cancelled")
    .gte("created_at", start)
    .lte("created_at", end);

  let total = 0;

  (sales || []).forEach(o => {
    total += Number(o.total || 0);
  });

  document.getElementById("dashboard").innerHTML = `
    <div class="card">💰 ${total.toFixed(2)} ر.س</div>
    <div class="card">🧾 ${(sales || []).length} طلب</div>
    <div class="card">❌ ${(cancelled || []).length}</div>
  `;
}
window.loadEmployeeReport = async function() {

  const { data: shifts } = await supabase
    .from("shifts")
    .select("*, employees(name)");

  if (!shifts || shifts.length === 0) {
    document.getElementById("reportBox").innerHTML = "❌ لا يوجد بيانات";
    return;
  }

  const summary = {};

  shifts.forEach(s => {
    const name = s.employees?.name || "غير معروف";
    const sales = Number(s.total_sales || 0);

    if (!summary[name]) {
      summary[name] = 0;
    }

    summary[name] += sales;
  });

  const html = Object.entries(summary)
    .sort((a, b) => b[1] - a[1]) // 🔥 ترتيب الأعلى أول
    .map(([name, total]) => `
      <div class="card">
        👤 ${name}<br>
        💰 ${total.toFixed(2)} ر.س
      </div>
    `).join("");

  document.getElementById("reportBox").innerHTML = html;
};