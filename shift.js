import { supabase } from "./supabase.js";
import { cart, renderCart } from "./cart.js";
import { loadActiveOrders } from "./orders.js";
import { loadCancelledOrders } from "./reports.js";

export let currentShiftId = null;
export let currentEmployee = null;

/* ===============================
   تحديث زر الشفت
================================ */
function updateShiftButton() {

  const shiftBtn = document.getElementById("shiftBtn");
  const infoBtn = document.getElementById("shiftInfoBtn");
  const closeBtn = document.getElementById("closeShiftBtn");

  if (!shiftBtn) return;

  if (currentShiftId && currentEmployee?.name) {

    shiftBtn.textContent = `🟢 ${currentEmployee.name}`;

    if (infoBtn) infoBtn.style.display = "block";
    if (closeBtn) closeBtn.style.display = "block";

  } else {

    shiftBtn.textContent = "➕ فتح شفت";

    if (infoBtn) infoBtn.style.display = "none";
    if (closeBtn) closeBtn.style.display = "none";
  }
}

/* ===============================
   فتح Popup الشفت
================================ */
window.openShiftPrompt = function () {

  const popup = document.getElementById("shiftPopup");

  if (!popup) {
    console.error("❌ shiftPopup غير موجود");
    return;
  }

  popup.style.display = "flex";
};

/* ===============================
   إغلاق Popup الشفت
================================ */
window.closeShiftPopup = function () {

  const popup = document.getElementById("shiftPopup");

  if (popup) {
    popup.style.display = "none";
  }
};

/* ===============================
   زر الشفت
================================ */
window.toggleShiftAction = function () {

  if (!currentShiftId) {
    openShiftPrompt();
  }
};

/* ===============================
   فتح الشفت
================================ */
window.confirmOpenShift = async function () {

  const pin = document.getElementById("shiftPin").value.trim();

  const errorBox = document.getElementById("shiftError");

  if (!pin) {

    errorBox.textContent = "❌ أدخل PIN";
    errorBox.style.display = "block";

    return;
  }

  // 🔍 التحقق من الموظف
  const { data: emp } = await supabase
    .from("employees")
    .select("id, name, pin")
    .eq("pin", pin)
    .maybeSingle();

  if (!emp) {

    errorBox.textContent = "❌ PIN خطأ";
    errorBox.style.display = "block";

    return;
  }

  errorBox.style.display = "none";

  // 🔍 يوم العمل
  const { data: openDay } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .maybeSingle();

  // ➕ إنشاء يوم عمل إذا ما فيه
  if (!openDay) {

    const { error: dayError } = await supabase
      .from("business_days")
      .insert({
        day_date: new Date().toISOString().split("T")[0],
        is_open: true,
        invoice_counter: 0
      });

    if (dayError) {

      console.error(dayError);

      alert("❌ خطأ في فتح يوم العمل");
      return;
    }
  }

  // 🔍 شفت مفتوح مسبقًا
  const { data: existingShift } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", emp.id)
    .eq("is_open", true)
    .maybeSingle();

  if (existingShift) {

    currentShiftId = existingShift.id;
    currentEmployee = emp;

    localStorage.setItem("shiftId", existingShift.id);

    loadActiveOrders(currentShiftId);
    loadCancelledOrders(currentShiftId);

    updateShiftButton();

    closeShiftPopup();

    alert(`📂 تم استرجاع الشفت - ${emp.name}`);

    return;
  }

  // ➕ إنشاء شفت جديد
  const { data: shift, error } = await supabase
    .from("shifts")
    .insert({
      employee_id: emp.id
    })
    .select()
    .single();

  if (error) {

    console.error(error);

    alert("❌ خطأ في فتح الشفت");

    return;
  }

  currentShiftId = shift.id;
  currentEmployee = emp;

  localStorage.setItem("shiftId", shift.id);

  loadActiveOrders(currentShiftId);
  loadCancelledOrders(currentShiftId);

  updateShiftButton();

  closeShiftPopup();

  alert(`✅ تم فتح الشفت - ${emp.name}`);
};

/* ===============================
   استرجاع الشفت
================================ */
export async function restoreShift() {

  const savedShift = localStorage.getItem("shiftId");

  if (!savedShift) {

    openShiftPrompt();

    return;
  }

  const { data } = await supabase
    .from("shifts")
    .select(`
      *,
      employees (
        name
      )
    `)
    .eq("id", savedShift)
    .single();

  if (data && data.is_open) {

    currentShiftId = data.id;

    currentEmployee = {
      name: data.employees?.name || "غير معروف"
    };

    updateShiftButton();

loadActiveOrders(currentShiftId);
loadCancelledOrders(currentShiftId);

  } else {

    localStorage.removeItem("shiftId");

    openShiftPrompt();
  }
}

/* ===============================
   إغلاق الشفت
================================ */
window.closeShift = async function (autoAsk = true) {

  if (!currentShiftId) {
    return;
  }

  // 🔴 طلبات مفتوحة
  const { data: active } = await supabase
    .from("orders")
    .select("id")
    .eq("shift_id", currentShiftId)
    .eq("status", "active");

  if (active && active.length > 0) {

    alert("❌ فيه طلبات مفتوحة");

    return;
  }

  // 🟢 الطلبات المدفوعة
  const { data: orders } = await supabase
    .from("orders")
    .select("total, cash_amount, card_amount")
    .eq("shift_id", currentShiftId)
    .eq("is_paid", true);

  let totalSales = 0;
  let totalCash = 0;
  let totalCard = 0;

  (orders || []).forEach(o => {

    totalSales += Number(o.total || 0);
    totalCash += Number(o.cash_amount || 0);
    totalCard += Number(o.card_amount || 0);
  });

  const totalOrders = orders?.length || 0;

  const ok = confirm(`
📊 تقرير الشفت:

💰 الإجمالي: ${totalSales.toFixed(2)} ﷼
💵 كاش: ${totalCash.toFixed(2)} ﷼
💳 بطاقة: ${totalCard.toFixed(2)} ﷼

🧾 عدد الطلبات: ${totalOrders}

تأكيد الإغلاق؟
  `);

  if (!ok) return;

  // 🔒 إغلاق
  await supabase
    .from("shifts")
    .update({
      is_open: false,
      total_sales: totalSales,
      total_cash: totalCash,
      total_card: totalCard,
      total_orders: totalOrders,
      closed_at: new Date().toISOString()
    })
    .eq("id", currentShiftId);

  // 🧹 تنظيف
  currentShiftId = null;
  currentEmployee = null;

  localStorage.removeItem("shiftId");

  cart.length = 0;

  renderCart();

  updateShiftButton();

  document.getElementById("items").innerHTML = `
    <div style="text-align:center;padding:40px;font-size:18px;">
      🔒 الكاشير مغلق
      <br><br>
      افتح شفت عشان تبدأ
    </div>
  `;

  alert("✅ تم إغلاق الشفت");

  if (autoAsk) {

    const reopen = confirm("هل تبي تفتح شفت جديد؟");

    if (reopen) {
      openShiftPrompt();
    }
  }
};

/* ===============================
   معلومات الشفت
================================ */
window.showShiftInfo = async function () {

  if (!currentShiftId) {

    alert("❌ ما فيه شفت مفتوح");

    return;
  }

  const { data: shift } = await supabase
    .from("shifts")
    .select(`
      opened_at,
      employees (
        name
      )
    `)
    .eq("id", currentShiftId)
    .single();

  if (!shift) {

    alert("❌ ما قدرنا نجيب بيانات الشفت");

    return;
  }

  const name = shift.employees?.name || "غير معروف";

  const start = new Date(shift.opened_at);

  const now = new Date();

  let diff = Math.floor((now - start) / 1000);

  const hours = Math.floor(diff / 3600);

  diff %= 3600;

  const mins = Math.floor(diff / 60);

  const overlay = document.createElement("div");

  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box" style="text-align:center">

      <h3>🟢 الشفت المفتوح</h3>

      👤 الموظف:
      <strong>${name}</strong>

      <br><br>

      🕒 وقت الفتح:
      <br>
      ${start.toLocaleString()}

      <br><br>

      ⏱ المدة:
      <br>
      ${hours} ساعة ${mins} دقيقة

      <br><br>

      <button onclick="closeShift()">
        🔒 إغلاق الشفت
      </button>

      <button class="cancel-btn">
        إغلاق
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".cancel-btn").onclick = () => {
    overlay.remove();
  };

  overlay.onclick = (e) => {

    if (e.target === overlay) {
      overlay.remove();
    }
  };
};

/* ===============================
   Export
================================ */
export {
  updateShiftButton
};