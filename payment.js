import { supabase } from "./supabase.js";

import {
  cart,
  renderCart
} from "./cart.js";

import {
  currentShiftId
} from "./shift.js";

import { sendReceiptWhatsApp } from "./customers.js";

/* ===============================
   تنسيق العملة
================================ */
function formatMoney(amount) {
  return `${Number(amount).toFixed(2)} ﷼`;
}

/* ===============================
   خصم المخزون
================================ */
async function deductInventory(cartItems) {

  for (const item of cartItems) {

    if (!item.product_id) continue;

    const { data: ingredients } = await supabase
      .from("product_ingredients")
      .select("*")
      .eq("product_id", item.product_id);

    if (!ingredients || ingredients.length === 0) continue;

    for (const ing of ingredients) {

      const totalUsed =
        Number(ing.qty_used) * Number(item.qty);

      await supabase.rpc("decrease_inventory", {
        inv_id: ing.inventory_id,
        amount: totalUsed
      });
    }
  }
}

/* ===============================
   فتح الدفع
================================ */
export function openPaymentAndSave(
  total,
  subtotal,
  vat
) {

  const overlay = document.createElement("div");

  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center
      ">

        <h3>💰 الدفع</h3>

        <button
          onclick="resetPayment()"
          style="
            background:#ef4444;
            padding:5px 10px;
            border-radius:8px
          "
        >
          🗑
        </button>

      </div>

      <div>
        المجموع: ${formatMoney(subtotal)}
      </div>

      <div>
        الضريبة: ${formatMoney(vat)}
      </div>

      <div>
        <strong>
          الإجمالي: ${formatMoney(total)}
        </strong>
      </div>

      <label>💵 كاش:</label>

      <input
        type="number"
        id="cashInput"
        placeholder="0"
      >

      <div style="
        display:flex;
        gap:6px;
        margin:5px 0;
        justify-content:center;
      ">

        <button onclick="setCash(${total})">
          💵 كاش كامل
        </button>

        <button onclick="completeWithCash(${total})">
          💵 أكمل الكاش
        </button>

      </div>

      <label>💳 بطاقة:</label>

      <input
        type="number"
        id="cardInput"
        placeholder="0"
      >

      <div style="margin:5px 0">

        <button onclick="setCard(${total})">
          💳 بطاقة كاملة
        </button>

        <button onclick="completeWithCard(${total})">
          💳 أكمل البطاقة
        </button>

      </div>

      <div
        id="remainBox"
        style="
          margin:10px 0;
          font-weight:bold
        "
      ></div>

      <button id="confirmPay">
        تأكيد
      </button>

      <button class="cancel-btn">
        إلغاء
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  const cashInput =
    overlay.querySelector("#cashInput");

  const cardInput =
    overlay.querySelector("#cardInput");

  const remainBox =
    overlay.querySelector("#remainBox");

  function updateRemain() {

    const cash =
      parseFloat(cashInput.value || "0");

    let card =
      parseFloat(cardInput.value || "0");

    const maxCard = total - cash;

    if (maxCard >= 0 && card > maxCard) {

      card = maxCard;

      cardInput.value =
        maxCard.toFixed(2);
    }

    const paid = cash + card;

    const diff = paid - total;

    if (diff > 0) {

      remainBox.innerHTML = `
        💰 الباقي:
        ${formatMoney(diff)}
      `;

      remainBox.style.color = "green";

    } else if (diff < 0) {

      remainBox.innerHTML = `
        ❌ المتبقي:
        ${formatMoney(Math.abs(diff))}
      `;

      remainBox.style.color = "red";

    } else {

      remainBox.innerHTML = `
        ✅ مكتمل
      `;

      remainBox.style.color = "green";
    }
  }

  cashInput.oninput = updateRemain;
  cardInput.oninput = updateRemain;

  updateRemain();

  overlay
    .querySelector(".cancel-btn")
    .onclick = () => overlay.remove();

  overlay
    .querySelector("#confirmPay")
    .onclick = async () => {

      if (!currentShiftId) {
        alert("❌ لازم تفتح شفت أول");
        return;
      }

      const cash =
        parseFloat(cashInput.value || "0");

      const card =
        parseFloat(cardInput.value || "0");

      const paid = cash + card;

      if (paid < total) {

        alert("❌ المبلغ ناقص");

        return;
      }

      const method =
        cash > 0 && card > 0
          ? "mixed"
          : cash > 0
          ? "cash"
          : "card";

      const {
        data: newCounter,
        error
      } = await supabase.rpc(
        "get_next_invoice"
      );

      if (error || !newCounter) {

        alert("❌ خطأ في رقم الفاتورة");

        return;
      }

      const {
        data: order,
        error: insertError
      } = await supabase
        .from("orders")
        .insert({
          subtotal,
          vat,
          total,
          status: "active",
          is_paid: true,
          cash_amount: cash,
          card_amount: card,
          payment_method: method,
          shift_id: currentShiftId,
          invoice_number: newCounter
        })
        .select()
        .single();

      if (insertError) {

        console.error(insertError);

        alert("❌ خطأ في إنشاء الطلب");

        return;
      }

      const itemsToInsert =
        cart.map(i => ({
          order_id: order.id,
          product_id: i.product_id,
          item_name: i.name,
          qty: i.qty,
          price: i.price
        }));

      await supabase
        .from("order_items")
        .insert(itemsToInsert);

      await deductInventory(cart);

      window.lastOrder = order;
      window.lastCart = [...cart];

      prepareReceipt(order);

      cart.length = 0;

      renderCart();

      // ما نحتاج loadActiveOrders — Realtime يضيف الطلب تلقائي

      overlay.remove();

      showAfterPaymentOptions();
    };
}

/* ===============================
   تجهيز الفاتورة
================================ */
function prepareReceipt(order) {

  document.getElementById(
    "printOrderId"
  ).textContent =
    order.invoice_number;

  document.getElementById(
    "printDate"
  ).textContent =
    new Date().toLocaleString();

  document.getElementById(
    "printItems"
  ).innerHTML =
    (window.lastCart || []).map(i => `
      <div class="receipt-row">
        <span>${i.name}</span>
        <span>${i.qty}</span>
        <span>${formatMoney(i.price)}</span>
        <span>
          ${formatMoney(i.price * i.qty)}
        </span>
      </div>
    `).join("");

  document.getElementById(
    "printSubtotal"
  ).textContent =
    formatMoney(order.subtotal);

  document.getElementById(
    "printVat"
  ).textContent =
    formatMoney(order.vat);

  document.getElementById(
    "printTotal"
  ).textContent =
    formatMoney(order.total);
}

/* ===============================
   أدوات الدفع
================================ */
window.setCash = function(total) {

  const cashInput =
    document.getElementById("cashInput");

  const cardInput =
    document.getElementById("cardInput");

  const card =
    parseFloat(cardInput.value) || 0;

  const remaining = total - card;

  cashInput.value =
    remaining > 0
      ? remaining.toFixed(2)
      : "0.00";

  cashInput.dispatchEvent(
    new Event("input")
  );
};

window.setCard = function(total) {

  const cashInput =
    document.getElementById("cashInput");

  const cardInput =
    document.getElementById("cardInput");

  const cash =
    parseFloat(cashInput.value) || 0;

  const remaining = total - cash;

  cardInput.value =
    remaining > 0
      ? remaining.toFixed(2)
      : "0.00";

  cardInput.dispatchEvent(
    new Event("input")
  );
};

window.completeWithCash = function(total) {

  const cashInput =
    document.getElementById("cashInput");

  const cardInput =
    document.getElementById("cardInput");

  const card =
    parseFloat(cardInput.value) || 0;

  const remaining = total - card;

  if (remaining > 0) {

    cashInput.value =
      remaining.toFixed(2);
  }

  cashInput.dispatchEvent(
    new Event("input")
  );
};

window.completeWithCard = function(total) {

  const cashInput =
    document.getElementById("cashInput");

  const cardInput =
    document.getElementById("cardInput");

  const cash =
    parseFloat(cashInput.value) || 0;

  const remaining = total - cash;

  if (remaining > 0) {

    cardInput.value =
      remaining.toFixed(2);
  }

  cardInput.dispatchEvent(
    new Event("input")
  );
};

window.resetPayment = function() {

  const cashInput =
    document.getElementById("cashInput");

  const cardInput =
    document.getElementById("cardInput");

  const remainBox =
    document.getElementById("remainBox");

  cashInput.value = "";
  cardInput.value = "";

  remainBox.textContent = "";

  cashInput.dispatchEvent(
    new Event("input")
  );

  cardInput.dispatchEvent(
    new Event("input")
  );
};

/* ===============================
   بعد الدفع
================================ */
function showAfterPaymentOptions() {

  document
    .querySelectorAll(".popup-overlay")
    .forEach(o => o.remove());

  const overlay =
    document.createElement("div");

  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-box" style="text-align:center">

      <h3>✅ تم الدفع بنجاح</h3>

      <p style="margin:10px 0;">
        وش تبي تسوي؟
      </p>

      <button onclick="printReceipt()">
        🖨 طباعة الفاتورة
      </button>

      <hr style="margin:15px 0">

      <h4>📤 إرسال واتساب</h4>

      <select
        id="countryCode"
        style="
          width:100%;
          padding:8px;
          margin-bottom:8px;
        "
      >
        <option value="966" selected>
          🇸🇦 السعودية
        </option>

        <option value="973">
          🇧🇭 البحرين
        </option>

        <option value="971">
          🇦🇪 الإمارات
        </option>

        <option value="965">
          🇰🇼 الكويت
        </option>

        <option value="974">
          🇶🇦 قطر
        </option>

        <option value="968">
          🇴🇲 عمان
        </option>

      </select>

      <input
        id="customerPhone"
        placeholder="رقم العميل"
        style="
          width:100%;
          padding:10px;
          border-radius:8px;
          border:1px solid #ccc;
          margin-bottom:10px;
        "
      >

      <button id="sendWhatsappBtn">
        📤 إرسال
      </button>

      <br><br>

      <button class="cancel-btn">
        إغلاق
      </button>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay
    .querySelector("#sendWhatsappBtn")
    .onclick = () => {

      sendReceiptWhatsApp(
        window.lastOrder,
        window.lastCart,
        formatMoney
      );
    };

  overlay
    .querySelector(".cancel-btn")
    .onclick = () => overlay.remove();

  overlay.onclick = (e) => {

    if (e.target === overlay) {
      overlay.remove();
    }
  };
}

/* ===============================
   طباعة الفاتورة
================================ */
window.printReceipt = function () {

  const area = document.getElementById("printArea");

  if (!area) {
    alert("❌ ما فيه فاتورة");
    return;
  }

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html dir="rtl">
      <head>
        <title>فاتورة</title>

        <style>
          body{
            font-family:sans-serif;
            padding:20px;
            direction:rtl;
          }

          .receipt{
            width:300px;
            margin:auto;
          }

          .receipt-row,
          .table-header,
          .totals-row,
          .grand-box{
            display:flex;
            justify-content:space-between;
            margin:5px 0;
          }

          .divider{
            border-top:1px dashed #999;
            margin:10px 0;
          }

          .grand-box{
            font-weight:bold;
            font-size:18px;
          }

          .thanks{
            text-align:center;
            margin-top:15px;
          }

          .footer{
            text-align:center;
            margin-top:10px;
            font-size:12px;
          }
        </style>
      </head>

      <body>
        ${area.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 500);
};
