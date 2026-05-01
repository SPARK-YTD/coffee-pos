import { supabase } from "./supabase.js";

let currentAdminTab = "products";
const SESSION_TIMEOUT = 30 * 60 * 1000;

/* ===============================
   الجلسة
================================ */

function updateLastActivity() {
  localStorage.setItem("lastActivity", Date.now());
}

function isSessionValid() {
  const last = localStorage.getItem("lastActivity");
  if (!last) return false;

  return Date.now() - Number(last) < SESSION_TIMEOUT;
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

window.login = async function () {
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

  showAdminTab("products");
  errorBox.style.display = "none";
};

/* ===============================
   التبويبات
================================ */

window.showAdminTab = function (type) {
  currentAdminTab = type;

  const sections = {
    products: document.getElementById("productsTab"),
    employees: document.getElementById("employeesTab"),
    sales: document.getElementById("salesTab"),
    shifts: document.getElementById("shiftsTab"),
  };

  document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  if (sections[type]) sections[type].style.display = "block";

  document.querySelectorAll(".tab").forEach(btn => {
    if (btn.dataset.tab === type) btn.classList.add("active");
  });

  if (type === "sales") loadSales();
  if (type === "employees") loadEmployees();
  if (type === "shifts") loadAdminShifts();
};

/* ===============================
   الموظفين
================================ */

window.addEmployee = async function () {
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

  document.getElementById("empName").value = "";
  document.getElementById("empPin").value = "";

  loadEmployees();
};

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

window.deleteEmployee = async function (id) {
  if (!confirm("حذف الموظف؟")) return;

  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

/* ===============================
   المبيعات
================================ */

window.loadSales = async function () {
  const mode = document.getElementById("salesMode")?.value || "today";

  let query = supabase
    .from("orders")
    .select(`
      total,
      cash_amount,
      card_amount,
      created_at,
      shifts (
        employees ( name )
      )
    `);

  // فلترة التاريخ
  if (mode === "today") {
    const start = new Date();
    start.setHours(0,0,0,0);

    const end = new Date();
    end.setHours(23,59,59,999);

    query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
  }

  if (mode === "month") {
    const start = new Date();
    start.setDate(1);
    start.setHours(0,0,0,0);

    query = query.gte("created_at", start.toISOString());
  }

  if (mode === "range") {
    const from = document.getElementById("salesFromDate").value;
    const to = document.getElementById("salesToDate").value;

    if (!from || !to) {
      alert("حدد التاريخ");
      return;
    }

    query = query
      .gte("created_at", from + " 00:00:00")
      .lte("created_at", to + " 23:59:59");
  }

  const { data } = await query.eq("is_paid", true);


// 🔢 حساب الإجمالي
let total = 0, cash = 0, card = 0;

(data || []).forEach(o => {
  total += Number(o.total || 0);
  cash += Number(o.cash_amount || 0);
  card += Number(o.card_amount || 0);
});


let itemsQuery = supabase
  .from("order_items")
  .select(`
    item_name,
    qty,
    price,
    orders!inner (
      created_at,
      is_paid,
      status
    )
  `)
  .eq("orders.is_paid", true)
  .neq("orders.status", "cancelled");

// فلترة التاريخ من الداتابيس (أسرع 🔥)
if (mode === "today") {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(); end.setHours(23,59,59,999);

  itemsQuery = itemsQuery
    .gte("orders.created_at", start.toISOString())
    .lte("orders.created_at", end.toISOString());
}

if (mode === "month") {
  const start = new Date();
  start.setDate(1);
  start.setHours(0,0,0,0);

  itemsQuery = itemsQuery
    .gte("orders.created_at", start.toISOString());
}

if (mode === "range") {
  const from = document.getElementById("salesFromDate").value;
  const to = document.getElementById("salesToDate").value;

  if (!from || !to) {
    alert("حدد التاريخ");
    return;
  }

  itemsQuery = itemsQuery
    .gte("orders.created_at", from + " 00:00:00")
    .lte("orders.created_at", to + " 23:59:59");
}

// 🔥 هنا نجيب البيانات الصح
const { data: filteredItems = [] } = await itemsQuery;


// 🔢 تجميع المنتجات
const map = {};

(filteredItems || []).forEach(i => {

  if (!map[i.item_name]) {
    map[i.item_name] = {
      qty: 0,
      total: 0
    };
  }

  map[i.item_name].qty += i.qty;
  map[i.item_name].total += i.qty * i.price;
});

const products = Object.entries(map).map(([name, val]) => ({
  name,
  qty: val.qty,
  total: val.total
}));

// ترتيب
products.sort((a, b) => b.qty - a.qty);

// الأفضل
const bestProduct = products[0] || null;
const totalQty = products.reduce((sum, p) => sum + p.qty, 0);

// 🎨 عرض النتائج
document.getElementById("salesBox").innerHTML = `

<div class="stats-grid">

  <div class="stat-box">
    <span>💰 الإجمالي</span>
    <strong>${total.toFixed(2)}</strong>
  </div>

  <div class="stat-box">
    <span>💵 كاش</span>
    <strong>${cash.toFixed(2)}</strong>
  </div>

  <div class="stat-box">
    <span>💳 بطاقة</span>
    <strong>${card.toFixed(2)}</strong>
  </div>

  <div class="stat-box">
    <span>🧾 الطلبات</span>
    <strong>${(data || []).length}</strong>
  </div>

</div>


<div class="card">
  🏆 الأكثر مبيعاً<br><br>
  <strong style="font-size:18px">
    ${bestProduct ? `${bestProduct.name} (${bestProduct.qty})` : "-"}
  </strong>
</div>


<div class="card">
  <h3 style="margin-bottom:10px">📊 تفاصيل الأصناف</h3>

  <table style="width:100%; text-align:center;">
    <tr style="background:#f5f5f5">
      <th>الصنف</th>
      <th>الكمية</th>
      <th>الإجمالي</th>
      <th>%</th>
    </tr>

    ${products.length === 0 ? `
      <tr>
        <td colspan="4">❌ لا يوجد مبيعات</td>
      </tr>
    ` : products.map(p => `
      <tr style="border-bottom:1px solid #eee">
        <td>${p.name}</td>
        <td>${p.qty}</td>
        <td>${p.total.toFixed(2)}</td>
        <td>${totalQty ? ((p.qty / totalQty) * 100).toFixed(1) : 0}%</td>
      </tr>
    `).join("")}

  </table>

</div>
`;

};  

/* ===============================
   الشفتات
================================ */

window.loadAdminShifts = async function () {
  const { data: shifts } = await supabase
    .from("shifts")
    .select(`
      id,
      opened_at,
      employees ( name )
    `)
    .eq("is_open", true);

  const box = document.getElementById("adminShifts");

  if (!shifts || shifts.length === 0) {
    box.innerHTML = "❌ لا يوجد شفتات";
    return;
  }

  const shiftIds = shifts.map(s => s.id);

  const { data: orders } = await supabase
    .from("orders")
    .select("shift_id, total")
    .in("shift_id", shiftIds)
    .eq("is_paid", true);

  const map = {};

  (orders || []).forEach(o => {
    if (!map[o.shift_id]) map[o.shift_id] = 0;
    map[o.shift_id] += Number(o.total || 0);
  });

  let html = "";

  shifts.forEach(s => {
    html += `
      <div class="card">
        👤 ${s.employees?.name || "غير معروف"}<br>
        💰 ${map[s.id] || 0}
      </div>
    `;
  });

  box.innerHTML = html;
};

/* ===============================
   نشاط المستخدم
================================ */

["click", "mousemove", "keydown", "touchstart"].forEach(e => {
  document.addEventListener(e, updateLastActivity);
});

setInterval(() => {
  if (!isSessionValid()) {
    alert("🔒 انتهت الجلسة");
    localStorage.removeItem("admin");
    location.reload();
  }
}, 60000);

window.handleSalesFilter = function () {
  const mode = document.getElementById("salesMode").value;
  const box = document.getElementById("dateRange");

  if (mode === "range") {
    box.style.display = "block";
  } else {
    box.style.display = "none";
    loadSales();
  }
};