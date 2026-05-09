import { supabase } from "./supabase.js";

let currentAdminTab = "products";
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Realtime — يشتغل مرة وحدة بس بعد تسجيل الدخول
let adminRealtimeStarted = false;

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
    startAdminRealtime();
  } else {
    localStorage.removeItem("admin");
  }

  // ما نحتاج setInterval — Realtime يتولاها
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
  startAdminRealtime();
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
    inventory: document.getElementById("inventoryTab"),
    customers: document.getElementById("customersTab"),
    settings: document.getElementById("settingsTab"),
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
  if (type === "inventory") {
    // صفحة المخزون لها ملف مستقل
  }
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

  // Realtime يحدّث القائمة تلقائي
};

async function loadEmployees() {
  const { data } = await supabase.from("employees").select("*");

  const box = document.getElementById("employeesList");
  if (!box) return;

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

  // 🔐 طلب PIN المدير
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

  if (!confirm("حذف الموظف؟")) return;

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    alert("❌ فشل الحذف");
    return;
  }

  alert("✅ تم حذف الموظف");

  // Realtime يحدّث القائمة تلقائي
};

/* ===============================
   المبيعات
================================ */

function money(val) {
  return Number(val || 0).toFixed(2) + " ر.س";
}

window.loadSales = async function () {

  const mode = document.getElementById("salesMode")?.value || "today";

  let query = supabase
    .from("orders")
    .select(`
      total,
      cash_amount,
      card_amount,
      created_at
    `);

  if (mode === "today") {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);

    query = query.gte("created_at", start.toISOString())
                 .lte("created_at", end.toISOString());
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

  const { data = [] } = await query.eq("is_paid", true);

  let total = 0, cash = 0, card = 0;

  data.forEach(o => {
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

    itemsQuery = itemsQuery
      .gte("orders.created_at", from + " 00:00:00")
      .lte("orders.created_at", to + " 23:59:59");
  }

  const { data: items } = await itemsQuery;
  const safeItems = items || [];

  const map = {};

  safeItems.forEach(i => {
    if (!map[i.item_name]) {
      map[i.item_name] = { qty: 0, total: 0 };
    }

    map[i.item_name].qty += i.qty;
    map[i.item_name].total += i.qty * i.price;
  });

  const products = Object.entries(map).map(([name, val]) => ({
    name,
    qty: val.qty,
    total: val.total
  }));

  products.sort((a, b) => b.qty - a.qty);

  const bestProduct = products[0] || null;
  const totalQty = products.length
    ? products.reduce((sum, p) => sum + p.qty, 0)
    : 0;

  const statsEl = document.getElementById("salesStats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-box">
        <span>💰 الإجمالي</span>
        <strong>${money(total)}</strong>
      </div>

      <div class="stat-box">
        <span>💵 كاش</span>
        <strong>${money(cash)}</strong>
      </div>

      <div class="stat-box">
        <span>💳 بطاقة</span>
        <strong>${money(card)}</strong>
      </div>

      <div class="stat-box">
        <span>🧾 الطلبات</span>
        <strong>${data.length}</strong>
      </div>
    `;
  }

  const salesBox = document.getElementById("salesBox");
  if (salesBox) {
    salesBox.innerHTML = `

    <div class="card">
      🏆 الأكثر مبيعاً<br><br>
      <strong style="font-size:18px">
        ${bestProduct ? `${bestProduct.name} (${bestProduct.qty})` : "-"}
      </strong>
    </div>

    <div class="card">
      <h3>📊 تفاصيل الأصناف</h3>

      <table style="width:100%; text-align:center;">
        <tr>
          <th>الصنف</th>
          <th>الكمية</th>
          <th>الإجمالي</th>
          <th>%</th>
        </tr>

        ${products.length === 0 ? `
          <tr><td colspan="4">❌ لا يوجد مبيعات</td></tr>
        ` : products.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.qty}</td>
            <td>${money(p.total)}</td>
            <td>${totalQty ? ((p.qty / totalQty) * 100).toFixed(1) : 0}%</td>
          </tr>
        `).join("")}

      </table>
    </div>
    `;
  }
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
  if (!box) return;

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
    <div style="display:flex; justify-content:space-between; align-items:center;">

      <div>
        <strong>👤 ${s.employees?.name || "غير معروف"}</strong><br>
        <small style="color:#666">شفت مفتوح</small>
      </div>

      <div style="font-weight:bold; font-size:16px; color:#4caf50">
        ${money(map[s.id])}
      </div>

    </div>
  </div>
`;
  });

  box.innerHTML = html;
};

/* ===============================
   Realtime — يحدّث التبويب الحالي تلقائي
================================ */
function startAdminRealtime() {

  if (adminRealtimeStarted) return;
  adminRealtimeStarted = true;

  // debounce: لو صار كذا تغيير في وقت قصير، نحدّث مرة وحدة بس
  let salesReloadTimer = null;
  let shiftsReloadTimer = null;

  function scheduleSalesReload() {
    if (salesReloadTimer) return;
    salesReloadTimer = setTimeout(() => {
      salesReloadTimer = null;
      if (currentAdminTab === "sales") loadSales();
    }, 500);
  }

  function scheduleShiftsReload() {
    if (shiftsReloadTimer) return;
    shiftsReloadTimer = setTimeout(() => {
      shiftsReloadTimer = null;
      if (currentAdminTab === "shifts") loadAdminShifts();
    }, 500);
  }

  // الطلبات → تأثر على الشفتات + المبيعات
  supabase
    .channel("admin-orders-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders"
      },
      () => {
        scheduleSalesReload();
        scheduleShiftsReload();
      }
    )
    .subscribe((status) => {
      console.log("📡 ADMIN ORDERS REALTIME:", status);
    });

  // الشفتات (فتح/إغلاق)
  supabase
    .channel("admin-shifts-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shifts"
      },
      () => {
        scheduleShiftsReload();
      }
    )
    .subscribe((status) => {
      console.log("📡 ADMIN SHIFTS REALTIME:", status);
    });

  // الموظفين
  supabase
    .channel("admin-employees-live")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "employees"
      },
      () => {
        if (currentAdminTab === "employees") loadEmployees();
      }
    )
    .subscribe((status) => {
      console.log("📡 ADMIN EMPLOYEES REALTIME:", status);
    });
}

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

/* ===============================
   إعدادات النظام
================================ */

async function loadSettings() {

  const { data } = await supabase
    .from("settings")
    .select("hide_tax")
    .eq("id", 1)
    .single();

  const toggle =
    document.getElementById("hideTaxToggle");

  if (toggle) {
    toggle.checked = data?.hide_tax || false;
  }
}

window.addEventListener("load", () => {

  loadSettings();

  const toggle =
    document.getElementById("hideTaxToggle");

  if (!toggle) return;

  toggle.addEventListener("change", async () => {

    await supabase
      .from("settings")
      .update({
        hide_tax: toggle.checked
      })
      .eq("id", 1);

    alert("✅ تم حفظ الإعداد");
  });
});
