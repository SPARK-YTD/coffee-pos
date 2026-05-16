// auth.js - حماية الصفحات والتحقق من تسجيل الدخول
import { supabase } from “./supabase.js”;

/* ===============================
التحقق من تسجيل الدخول
لو ما هو مسجل، يحوّله لصفحة login.html
================================ */
export async function checkAuth() {
const { data: { session }, error } = await supabase.auth.getSession();

if (error || !session) {
console.warn(“⚠️ Not authenticated, redirecting to login…”);
window.location.href = “login.html”;
return null;
}

// تحديث آخر نشاط للجهاز
const deviceId = localStorage.getItem(“device_id”);
if (deviceId) {
try {
await supabase.rpc(“update_device_seen”, { p_device_id: deviceId });
} catch (e) {
console.warn(“Failed to update device:”, e);
}
}

return session.user;
}

/* ===============================
تسجيل خروج
================================ */
export async function logout() {
if (!confirm(“هل تريد تسجيل الخروج؟”)) return;

// حذف الجهاز من القاعدة
const deviceId = localStorage.getItem(“device_id”);
if (deviceId) {
try {
await supabase
.from(“user_devices”)
.delete()
.eq(“id”, deviceId);
} catch (e) {
console.warn(“Failed to remove device:”, e);
}
}

// مسح البيانات المحلية
localStorage.removeItem(“device_id”);
localStorage.removeItem(“shiftId”);

// تسجيل خروج من Supabase
await supabase.auth.signOut();

// إعادة التوجيه
window.location.href = “login.html”;
}

window.logout = logout;

/* ===============================
عرض الأجهزة المسجلة
================================ */
export async function showDevices() {
const { data: devices, error } = await supabase
.from(“user_devices”)
.select(”*”)
.order(“last_seen”, { ascending: false });

if (error) {
alert(“❌ فشل تحميل الأجهزة”);
return;
}

const currentDeviceId = localStorage.getItem(“device_id”);

// تنسيق الوقت
function formatTime(dateStr) {
if (!dateStr) return “-”;
const d = new Date(dateStr);
const now = new Date();
const diffMs = now - d;
const diffMins = Math.floor(diffMs / 60000);
const diffHours = Math.floor(diffMs / 3600000);
const diffDays = Math.floor(diffMs / 86400000);

```
if (diffMins < 1) return "الآن";
if (diffMins < 60) return "قبل " + diffMins + " دقيقة";
if (diffHours < 24) return "قبل " + diffHours + " ساعة";
if (diffDays < 30) return "قبل " + diffDays + " يوم";

return d.toLocaleDateString("ar-SA-u-ca-gregory");
```

}

let devicesHtml = “”;
(devices || []).forEach(d => {
const isCurrent = d.id === currentDeviceId;
const badge = isCurrent
? ‘<span style="background:#4caf50;color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin-right:8px;">الجهاز الحالي</span>’
: ‘’;

```
const removeBtn = isCurrent
  ? '<button onclick="logout()" style="background:#f44336;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">🚪 خروج</button>'
  : '<button onclick="removeDevice(\'' + d.id + '\')" style="background:#ff9800;color:#fff;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;">❌ طرد</button>';

devicesHtml += `
  <div style="border:1px solid #e0e0e0;border-radius:10px;padding:15px;margin-bottom:10px;background:${isCurrent ? '#f1f8e9' : '#fff'};">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:15px;font-weight:bold;">${d.device_name || 'جهاز غير معروف'}${badge}</div>
        <div style="color:#888;font-size:13px;margin-top:5px;">⏱ آخر نشاط: ${formatTime(d.last_seen)}</div>
      </div>
      ${removeBtn}
    </div>
  </div>
`;
```

});

if (devices.length === 0) {
devicesHtml = ‘<div style="text-align:center;padding:30px;color:#888;">لا توجد أجهزة مسجلة</div>’;
}

const overlay = document.createElement(“div”);
overlay.className = “popup-overlay”;
overlay.style.cssText = “position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:99999;padding:20px;”;

overlay.innerHTML = `
<div style="background:#fff;border-radius:12px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;direction:rtl;">

```
  <div style="background:#4a3a2c;color:#fff;padding:15px 20px;border-radius:12px 12px 0 0;">
    <h3 style="margin:0;text-align:center;">📱 الأجهزة المسجلة</h3>
  </div>

  <div style="padding:20px;">

    <div style="background:#fff3e0;padding:10px;border-radius:8px;margin-bottom:15px;font-size:13px;color:#e65100;">
      ℹ️ هذه الأجهزة لها صلاحية الدخول للحساب. لو شفت جهاز غريب، اضغط "طرد".
    </div>

    ${devicesHtml}

    <button class="close-devices-btn" style="width:100%;padding:12px;background:#4a3a2c;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-top:15px;">
      إغلاق
    </button>

  </div>
</div>
```

`;

document.body.appendChild(overlay);

overlay.querySelector(”.close-devices-btn”).onclick = () => overlay.remove();
overlay.onclick = (e) => {
if (e.target === overlay) overlay.remove();
};
}

window.showDevices = showDevices;

/* ===============================
طرد جهاز
================================ */
window.removeDevice = async function(deviceId) {
if (!confirm(“⚠️ هل تريد طرد هذا الجهاز؟\nسيتم تسجيل خروجه فوراً.”)) return;

const { error } = await supabase
.from(“user_devices”)
.delete()
.eq(“id”, deviceId);

if (error) {
alert(“❌ فشل طرد الجهاز: “ + error.message);
return;
}

alert(“✅ تم طرد الجهاز”);

// إعادة فتح القائمة
document.querySelector(”.popup-overlay”)?.remove();
showDevices();
};

/* ===============================
مراقبة تغييرات الجلسة
لو سُجّل خروج من جهاز ثاني، يطلع تلقائياً
================================ */
supabase.auth.onAuthStateChange((event, session) => {
if (event === “SIGNED_OUT” || !session) {
if (window.location.pathname !== “/login.html” && !window.location.pathname.endsWith(“login.html”)) {
window.location.href = “login.html”;
}
}
});