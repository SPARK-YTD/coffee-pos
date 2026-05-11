import { loadCancelledOrders } from ‘./reports.js’;
import { supabase } from ‘./supabase.js’;
import { loadActiveOrders } from ‘./orders.js’;
import { openPaymentAndSave } from ‘./payment.js’;
import { cart, addToCart, renderCart } from ‘./cart.js’;
import { currentShiftId, restoreShift } from ‘./shift.js’;

window.addEventListener(‘error’, function(e) {
console.error(‘GLOBAL ERROR:’, e.error);
});

window.addEventListener(‘unhandledrejection’, function(e) {
console.error(‘PROMISE ERROR:’, e.reason);
});

let TAX_RATE = 0;
let HIDE_TAX = false;
let currentCategory = ‘drinks’;

async function loadTax() {
const result = await supabase
.from(‘settings’)
.select(‘tax_rate, hide_tax’)
.eq(‘id’, 1)
.single();

const data = result.data;
TAX_RATE = Number((data && data.tax_rate) || 0) / 100;
HIDE_TAX = (data && data.hide_tax) || false;
}

function formatMoney(amount) {
return Number(amount).toFixed(2) + ’ ر.س’;
}

window.formatMoney = formatMoney;

let items = [];
window.editingOrderId = null;
window.lastOrder = null;
window.lastCart = null;

function listenToTaxChanges() {
supabase
.channel(‘tax-live’)
.on(
‘postgres_changes’,
{
event: ‘UPDATE’,
schema: ‘public’,
table: ‘settings’,
filter: ‘id=eq.1’
},
function(payload) {
TAX_RATE = Number(payload.new.tax_rate || 0) / 100;
HIDE_TAX = payload.new.hide_tax || false;
if (cart.length > 0) {
renderCart();
}
}
)
.subscribe(function(status) {
console.log(‘TAX REALTIME:’, status);
});
}

function listenToProductChanges() {
supabase
.channel(‘products-live’)
.on(
‘postgres_changes’,
{
event: ‘*’,
schema: ‘public’,
table: ‘products’
},
function(payload) {
const eventType = payload.eventType;
const newRow = payload.new;
const oldRow = payload.old;

```
    if (eventType === 'INSERT') {
      if (newRow.category === currentCategory && newRow.is_active) {
        items.push(mapProduct(newRow));
        renderItems();
      }
    } else if (eventType === 'UPDATE') {
      const idx = items.findIndex(function(i) { return i.id === newRow.id; });
      const shouldBeShown = newRow.category === currentCategory && newRow.is_active;

      if (!shouldBeShown) {
        if (idx !== -1) {
          items.splice(idx, 1);
          renderItems();
        }
        return;
      }

      if (idx !== -1) {
        items[idx] = mapProduct(newRow);
      } else {
        items.push(mapProduct(newRow));
      }
      renderItems();
    } else if (eventType === 'DELETE') {
      const idx = items.findIndex(function(i) { return i.id === oldRow.id; });
      if (idx !== -1) {
        items.splice(idx, 1);
        renderItems();
      }
    }
  }
)
.subscribe(function(status) {
  console.log('PRODUCTS REALTIME:', status);
});
```

}

function listenToBusinessDayChanges() {
supabase
.channel(‘business-day-live’)
.on(
‘postgres_changes’,
{
event: ‘*’,
schema: ‘public’,
table: ‘business_days’
},
function() {
updateDayButton();
}
)
.subscribe(function(status) {
console.log(‘BUSINESS DAY REALTIME:’, status);
});
}

function mapProduct(p) {
const extrasArr = p.extras_text
? p.extras_text.split(’\n’).map(function(e) { return e.trim(); }).filter(function(e) { return e !== ‘’; })
: [];
return Object.assign({}, p, { extras: extrasArr });
}

async function loadItems(category) {
if (!category) category = ‘drinks’;
currentCategory = category;

const result = await supabase
.from(‘products’)
.select(’*’)
.eq(‘category’, category)
.eq(‘is_active’, true);

if (result.error) {
console.error(result.error);
return;
}

items = (result.data || []).map(mapProduct);
renderItems();
}

window.loadItems = loadItems;

function renderItems() {
const box = document.getElementById(‘items’);
if (!box) {
console.error(‘items container not found’);
return;
}

box.innerHTML = ‘’;

items.forEach(function(item) {
const div = document.createElement(‘div’);
div.className = ‘item’;

```
let imgPart = '';
if (item.image_url) {
  imgPart = '<img src="' + item.image_url + '" class="item-img">';
}

let pricePart;
if (item.has_variants) {
  pricePart = 'اختر الحجم';
} else {
  pricePart = formatMoney(item.price || 0);
}

div.innerHTML =
  imgPart +
  '<div class="item-name">' + item.name + '</div>' +
  '<div class="item-price">' + pricePart + '</div>';

div.onclick = function() { handleItem(item); };
box.appendChild(div);
```

});
}

async function handleItem(item) {
if (!currentShiftId) {
alert(‘لازم تفتح شفت أول’);
return;
}

const existingPopup = document.querySelector(’.popup-overlay’);
if (existingPopup) {
existingPopup.remove();
}

if (item.has_variants) {
const result = await supabase
.from(‘product_variants’)
.select(’*’)
.eq(‘product_id’, item.id);

```
if (result.error) {
  console.error(result.error);
  alert('خطأ في تحميل الأحجام');
  return;
}

showVariantsPopup(item, result.data);
return;
```

}

if (item.extras && item.extras.filter(function(e) { return e; }).length > 0) {
showExtrasPopup(item);
return;
}

addToCart(Object.assign({}, item, { product_id: item.id }), renderCart);
}

function showVariantsPopup(item, variants) {
const overlay = document.createElement(‘div’);
overlay.className = ‘popup-overlay’;

let variantsHtml = ‘’;
(variants || []).forEach(function(v) {
variantsHtml +=
‘<button class="variant-btn" onclick="selectVariant(\'' +
item.id + '\',\'' + item.name + '\',\'' + v.label + '\',' + v.price + ')">’ +
v.label + ’ - ’ + formatMoney(v.price) +
‘</button>’;
});

overlay.innerHTML =
‘<div class="popup-box">’ +
‘<h3>’ + item.name + ‘</h3>’ +
variantsHtml +
‘<button class="cancel-btn">إلغاء</button>’ +
‘</div>’;

document.body.appendChild(overlay);

overlay.querySelector(’.cancel-btn’).onclick = function() { overlay.remove(); };
overlay.onclick = function(e) {
if (e.target === overlay) overlay.remove();
};
}

window.selectVariant = function(id, name, label, price) {
const baseItem = items.find(function(i) { return String(i.id) === String(id); });

if (baseItem && baseItem.extras && baseItem.extras.length > 0) {
showExtrasPopup(Object.assign({}, baseItem, {
name: name + ’ (’ + label + ‘)’,
price: price
}));
} else {
addToCart({
id: id,
product_id: id,
name: name + ’ (’ + label + ‘)’,
price: price
}, renderCart);
}

const popup = document.querySelector(’.popup-overlay’);
if (popup) popup.remove();
};

function showExtrasPopup(item) {
const overlay = document.createElement(‘div’);
overlay.className = ‘popup-overlay’;

let extrasHtml = ‘’;
(item.extras || []).forEach(function(extra) {
extrasHtml +=
‘<label><input type="checkbox" value="' + extra + '" checked>’ +
extra + ‘</label>’;
});

overlay.innerHTML =
‘<div class="popup-box">’ +
‘<h3>’ + item.name + ‘</h3>’ +
‘<div>’ + extrasHtml + ‘</div>’ +
‘<button id="confirmExtras">إضافة</button>’ +
‘<button class="cancel-btn">إلغاء</button>’ +
‘</div>’;

document.body.appendChild(overlay);

overlay.querySelector(’.cancel-btn’).onclick = function() { overlay.remove(); };

overlay.querySelector(’#confirmExtras’).onclick = function() {
const inputs = Array.from(overlay.querySelectorAll(‘input’));
const removed = inputs.filter(function(cb) { return !cb.checked; }).map(function(cb) { return cb.value; });

```
let name = item.name;
if (removed.length > 0) {
  name += ' (بدون: ' + removed.join(', ') + ')';
}

addToCart({
  id: item.id,
  product_id: item.id,
  name: name,
  price: item.price
}, renderCart);

overlay.remove();
```

};
}

window.filterCategory = function(category, btn) {
document.querySelectorAll(’.cat’).forEach(function(b) { b.classList.remove(‘active’); });
btn.classList.add(‘active’);
loadItems(category);
};

window.addEventListener(‘DOMContentLoaded’, async function() {
try {
await loadTax();
listenToTaxChanges();
listenToProductChanges();
listenToBusinessDayChanges();
} catch (err) {
console.error(‘INIT ERROR:’, err);
}

await restoreShift();
loadItems(‘drinks’);
loadActiveOrders(currentShiftId);
loadCancelledOrders(currentShiftId);
updateDayButton();
});

window.completeOrder = async function() {
if (!currentShiftId) {
alert(‘لازم تفتح شفت أول’);
return;
}

if (!cart.length) {
alert(‘السلة فاضية’);
return;
}

if (TAX_RATE === null || TAX_RATE === undefined) {
alert(‘الضريبة ما تحملت’);
return;
}

const subtotal = cart.reduce(function(s, i) { return s + i.qty * i.price; }, 0);
const vat = HIDE_TAX ? 0 : subtotal * TAX_RATE;
const total = subtotal + vat;

openPaymentAndSave(total, subtotal, vat);
};

async function updateDayButton() {
const dayBtn = document.getElementById(‘dayBtn’);
if (!dayBtn) return;

const result = await supabase
.from(‘business_days’)
.select(‘id’)
.eq(‘is_open’, true)
.maybeSingle();

if (result.data) {
dayBtn.textContent = ‘إغلاق اليوم’;
dayBtn.onclick = function() { window.closeDay(); };
} else {
dayBtn.textContent = ‘فتح يوم جديد’;
dayBtn.onclick = function() { window.openDay(); };
}
}

window.updateDayButton = updateDayButton;

window.openDay = async function() {
const pin = prompt(‘أدخل PIN المدير لفتح يوم جديد’);
if (!pin) return;

const result = await supabase.rpc(‘verify_employee_pin’, { input_pin: pin.trim() });

if (result.error) {
console.error(‘RPC ERROR:’, result.error);
alert(‘خطأ في التحقق’);
return;
}

const managerArray = result.data;
const manager = managerArray && managerArray.length > 0 ? managerArray[0] : null;

if (!manager || manager.role !== ‘manager’) {
alert(‘غير مصرح - هذي العملية للمدير فقط’);
return;
}

const existing = await supabase
.from(‘business_days’)
.select(‘id’)
.eq(‘is_open’, true)
.maybeSingle();

if (existing.data) {
alert(‘فيه يوم مفتوح بالفعل’);
updateDayButton();
return;
}

const insertResult = await supabase
.from(‘business_days’)
.insert({
day_date: new Date().toISOString().split(‘T’)[0],
is_open: true,
invoice_counter: 0
})
.select()
.single();

if (insertResult.error) {
console.error(insertResult.error);
alert(’فشل فتح اليوم: ’ + insertResult.error.message);
return;
}

alert(’تم فتح يوم عمل جديد\nبواسطة: ’ + manager.name);
updateDayButton();
};

window.closeDay = async function() {
const dayResult = await supabase
.from(‘business_days’)
.select(’*’)
.eq(‘is_open’, true)
.maybeSingle();

if (dayResult.error) {
console.error(‘DAY FETCH ERROR:’, dayResult.error);
alert(‘خطأ في قراءة يوم العمل’);
return;
}

const day = dayResult.data;
if (!day) {
alert(‘ما فيه يوم مفتوح’);
updateDayButton();
return;
}

const shiftsResult = await supabase
.from(‘shifts’)
.select(‘id, employees ( name )’)
.eq(‘is_open’, true);

const openShifts = shiftsResult.data;
if (openShifts && openShifts.length > 0) {
const names = openShifts.map(function(s) {
return (s.employees && s.employees.name) || ‘غير معروف’;
}).join(’\n’);
alert(‘فيه شفتات مفتوحة:\n\n’ + names + ‘\n\nلازم تقفلهم أول’);
return;
}

const activeResult = await supabase
.from(‘orders’)
.select(‘id’)
.eq(‘status’, ‘active’);

if (activeResult.data && activeResult.data.length > 0) {
alert(‘فيه طلبات مفتوحة! لازم تخلصها أول’);
return;
}

const ordersResult = await supabase
.from(‘orders’)
.select(‘total’)
.eq(‘is_paid’, true)
.neq(‘status’, ‘cancelled’)
.gte(‘created_at’, day.opened_at)
.lte(‘created_at’, new Date().toISOString());

const orders = ordersResult.data || [];
let total = 0;
orders.forEach(function(o) {
total += Number(o.total || 0);
});

const count = orders.length;

const ok = confirm(
‘تقرير يوم العمل:\n\n’ +
’الإجمالي: ’ + formatMoney(total) + ‘\n’ +
’الطلبات: ’ + count + ‘\n\n’ +
’من ’ + new Date(day.opened_at).toLocaleString() + ‘\n’ +
‘إلى الآن\n\n’ +
‘تأكيد الإغلاق؟’
);

if (!ok) return;

const updateResult = await supabase
.from(‘business_days’)
.update({
is_open: false,
closed_at: new Date().toISOString(),
total_sales: total,
total_orders: count
})
.eq(‘id’, day.id)
.select();

if (updateResult.error) {
console.error(‘CLOSE DAY ERROR:’, updateResult.error);
alert(’فشل إغلاق اليوم: ’ + updateResult.error.message);
return;
}

if (!updateResult.data || updateResult.data.length === 0) {
alert(‘ما تم تحديث اليوم - جرب مرة ثانية’);
return;
}

alert(‘تم إغلاق يوم العمل’);
updateDayButton();
};

const menuBtn = document.getElementById(‘menuBtn’);
const menuDropdown = document.getElementById(‘menuDropdown’);

if (menuBtn && menuDropdown) {
menuBtn.addEventListener(‘click’, function(e) {
e.stopPropagation();
if (menuDropdown.style.display === ‘flex’) {
menuDropdown.style.display = ‘none’;
} else {
menuDropdown.style.display = ‘flex’;
}
});

document.addEventListener(‘click’, function() {
menuDropdown.style.display = ‘none’;
});

menuDropdown.addEventListener(‘click’, function(e) {
e.stopPropagation();
});
}

window.showTab = function(tab, btn) {
const activeBox = document.getElementById(‘activeOrders’);
const cancelledBox = document.getElementById(‘cancelledOrders’);

if (activeBox) activeBox.style.display = ‘none’;
if (cancelledBox) cancelledBox.style.display = ‘none’;

document.querySelectorAll(’.tab’).forEach(function(t) { t.classList.remove(‘active’); });

if (tab === ‘active’) {
if (activeBox) activeBox.style.display = ‘block’;
} else if (tab === ‘cancelled’) {
if (cancelledBox) cancelledBox.style.display = ‘block’;
}

if (btn) {
btn.classList.add(‘active’);
} else if (typeof event !== ‘undefined’ && event && event.target) {
event.target.classList.add(‘active’);
}
};