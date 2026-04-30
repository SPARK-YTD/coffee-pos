import { supabase } from "./supabase.js";
let currentAdminTab = "products";
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
    updateLastActivity();

    showAdminTab("products");  
  } else {
    localStorage.removeItem("admin");
  }
  
  setInterval(() => {
  if (currentAdminTab === "shifts") {
    loadAdminShifts();
  }
}, 10000);

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
  

  showAdminTab("products"); // ✅
  errorBox.style.display = "none"; // ✅
};
/* ===============================
   التنقل بين التبويبات
================================ */
  window.showAdminTab = function(type) {
  currentAdminTab = type;

  const sections = {
  products: document.getElementById("productsTab"),
  employees: document.getElementById("employeesTab"),
  sales: document.getElementById("salesTab"),
  reports: document.getElementById("reportsTab"),
  shifts: document.getElementById("shiftsTab"),
};

  // إخفاء الكل
  document.querySelectorAll(".admin-section")
    .forEach(s => s.style.display = "none");

  document.querySelectorAll(".tab")
    .forEach(t => t.classList.remove("active"));

  // إظهار القسم
if (sections[type]) {
  sections[type].style.display = "block";
}

document.querySelectorAll(".tab").forEach(btn => {
  if (btn.dataset.tab === type) {
    btn.classList.add("active");
  }
});

  // تحميل البيانات حسب التبويب
  if (type === "sales") loadSales();
  if (type === "reports") loadReport();
  if (type === "employees") loadEmployees();
  if (type === "shifts") loadAdminShifts();
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

window.loadSales = async function() {

  const mode = document.getElementById("salesMode")?.value || "today";

  let query = supabase
    .from("orders")
    .select(`
      id,
      total,
      cash_amount,
      card_amount,
      status,
      created_at,
      shift_id,
      shifts (
        employees ( name )
      )
    `);


  // 🟢 اليوم
if (mode === "today") {
  const start = new Date();
  start.setHours(0,0,0,0);

  const end = new Date();
  end.setHours(23,59,59,999);

  query = query
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());
}

// 🟢 الشهر
if (mode === "month") {
  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);

  const end = new Date();

  query = query
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());
}

// 🟢 مدى تاريخ
if (mode === "range") {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  if (!from || !to) {
    alert("حدد التاريخ");
    return;
  }

  query = query
    .gte("created_at", from + " 00:00:00")
    .lte("created_at", to + " 23:59:59");
}
  // ✅ الطلبات المدفوعة
const { data, error } = await query.eq("status", "completed");
console.log("DATA:", data);


  if (error) {
    document.getElementById("salesBox").innerHTML = "❌ خطأ في جلب البيانات";
    return;
  }

  // 🔴 الطلبات الملغية
  let cancelledQuery = supabase
    .from("orders")
    .select("id");

  if (mode === "today") {
  const start = new Date();
  start.setHours(0,0,0,0);

  const end = new Date();
  end.setHours(23,59,59,999);

  cancelledQuery = cancelledQuery
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());
}

if (mode === "month") {
  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);

  const end = new Date();

  cancelledQuery = cancelledQuery
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());
}

if (mode === "range") {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  cancelledQuery = cancelledQuery
    .gte("created_at", from + " 00:00:00")
    .lte("created_at", to + " 23:59:59");
}
  const { data: cancelled } = await cancelledQuery.eq("status", "cancelled");

  // ===============================
  // الحسابات
  // ===============================
  let total = 0, cash = 0, card = 0;

  const employeeSales = {};

  (data || []).forEach(o => {

    total += Number(o.total || 0);
    cash += Number(o.cash_amount || 0);
    card += Number(o.card_amount || 0);

    const empName = o.shifts?.employees?.name || "غير معروف";

    if (!employeeSales[empName]) {
      employeeSales[empName] = 0;
    }

    employeeSales[empName] += Number(o.total || 0);
  });

  const topEmployee = Object.entries(employeeSales)
    .sort((a, b) => b[1] - a[1])[0];

  // ===============================
  // العرض
  // ===============================
  document.getElementById("salesBox").innerHTML = `
    <div class="card">

      <h3>📊 الإحصائيات</h3>

      💰 الإجمالي: ${total.toFixed(2)} ر.س<br>
      💵 كاش: ${cash.toFixed(2)} ر.س<br>
      💳 بطاقة: ${card.toFixed(2)} ر.س<br><br>

      🧾 الطلبات: ${(data || []).length}<br>
      ❌ الملغية: ${(cancelled || []).length}<br><br>

      👑 أفضل موظف: ${
        topEmployee 
        ? topEmployee[0] + " (" + topEmployee[1].toFixed(2) + " ر.س)"
        : "-"
      }
    </div>
  `;
};

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

let lastShiftsLog = null;

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

// 🔥 حفظ الضريبة
window.saveTax = async function() {

  const pin = prompt("🔐 أدخل رقم المدير");

  if (!pin) return;

  const { data: manager } = await supabase
    .from("employees")
    .select("id, role")
    .eq("pin", pin.trim())
    .eq("role", "manager")
    .maybeSingle();

  if (!manager) {
    alert("❌ غير مصرح");
    return;
  }

  const rate = parseFloat(document.getElementById("taxRate").value);

  if (isNaN(rate)) {
    alert("❌ اكتب رقم صحيح");
    return;
  }

  const { error } = await supabase
    .from("settings")
    .upsert({
      id: 1,
      tax_rate: rate
    });

  if (error) {
    console.error(error);
    alert("❌ خطأ في الحفظ");
    return;
  }

  alert("✅ تم حفظ الضريبة");
};

// 🔥 تحميل الضريبة
async function loadSettings() {

  const { data } = await supabase
    .from("settings")
    .select("tax_rate")
    .eq("id", 1)
    .single();

  const input = document.getElementById("taxRate");

  // ✅ نحمي الكود
  if (data && input) {
    input.value = data.tax_rate;
  }
}


loadSettings();

window.loadAdminShifts = async function () {

  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(`
      id,
      is_open,
      opened_at,
      employees (
        name
      )
    `)
    .eq("is_open", true);

  const box = document.getElementById("adminShifts");

  if (error || !shifts || shifts.length === 0) {
    box.innerHTML = "❌ لا يوجد شفتات مفتوحة";
    return;
  }

  let html = "";

  // 🔥 نجيب كل الطلبات مرة وحدة
const shiftIds = shifts.map(s => s.id);

const { data: allOrders } = await supabase
  .from("orders")
  .select("shift_id, total, cash_amount, card_amount")
  .in("shift_id", shiftIds)
  .eq("status", "completed");

const ordersMap = {};

(allOrders || []).forEach(o => {
  if (!ordersMap[o.shift_id]) {
    ordersMap[o.shift_id] = [];
  }
  ordersMap[o.shift_id].push(o);
});
    for (const s of shifts) {

  const orders = ordersMap[s.id] || [];

  let total = 0, cash = 0, card = 0;

  orders.forEach(o => {
    total += Number(o.total || 0);
    cash += Number(o.cash_amount || 0);
    card += Number(o.card_amount || 0);
  });

  const start = new Date(s.opened_at);
  const now = new Date();

  const diff = Math.floor((now - start) / 60000);
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;

  const isLong = hours >= 8;

  html += `
    <div class="card">
      <h3 style="color:${isLong ? 'red' : 'green'}">
        ${isLong ? "⚠️ شفت طويل" : "🟢 شفت مفتوح"}
      </h3>

      👤 الموظف: <strong>${s.employees?.name || "غير معروف"}</strong><br><br>

      ⏱ المدة: ${hours} ساعة ${mins} دقيقة<br><br>

      💰 المبيعات: ${total.toFixed(2)}<br>
      💵 كاش: ${cash.toFixed(2)}<br>
      💳 بطاقة: ${card.toFixed(2)}<br><br>

      🧾 الطلبات: ${orders.length}
    </div>
  `;
}

  box.innerHTML = html;
};

window.handleSalesFilter = function() {
  const mode = document.getElementById("salesMode").value;
  const rangeBox = document.getElementById("dateRange");

  if (mode === "range") {
    rangeBox.style.display = "block";
  } else {
    rangeBox.style.display = "none";
    loadSales();
  }
};