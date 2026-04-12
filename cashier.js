let cart = [];

async function openShift() {
  const user = JSON.parse(localStorage.getItem("user"));

  const { error } = await supabase.from("shifts").insert([
    {
      employee_id: user.id
    }
  ]);

  if (error) {
    alert("خطأ في فتح الشفت");
  } else {
    alert("تم فتح الشفت ✅");
  }
}

// تحميل المنتجات
async function loadProducts() {
  const { data } = await supabase.from("products").select("*");

  const container = document.getElementById("products");
  container.innerHTML = "";

  data.forEach(p => {
    const btn = document.createElement("button");
    btn.innerText = p.name + " - " + p.base_price;
    btn.onclick = () => addToCart(p);
    container.appendChild(btn);
  });
}

function addToCart(product) {
  cart.push(product);
  renderCart();
}

function renderCart() {
  const container = document.getElementById("cart");
  container.innerHTML = "";

  cart.forEach(item => {
    const div = document.createElement("div");
    div.innerText = item.name + " - " + item.base_price;
    container.appendChild(div);
  });
}

async function checkout() {
  const user = JSON.parse(localStorage.getItem("user"));

  // نجيب يوم العمل
  const { data: day } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  // نولد رقم الفاتورة
  const { data: invoice_no } = await supabase
    .rpc("generate_invoice_number", {
      p_business_day_id: day.id
    });

  let total = cart.reduce((sum, item) => sum + Number(item.base_price), 0);

  // إنشاء الطلب
  const { data: order } = await supabase.from("orders").insert([
    {
      invoice_no,
      business_day_id: day.id,
      employee_id: user.id,
      total,
      payment_method: "cash"
    }
  ]).select().single();

  // إضافة العناصر
  for (let item of cart) {
    await supabase.from("order_items").insert([
      {
        order_id: order.id,
        product_id: item.id,
        quantity: 1,
        price: item.base_price
      }
    ]);
  }

  alert("تم الدفع ✅ رقم الفاتورة: " + invoice_no);

  cart = [];
  renderCart();
}

// تشغيل تلقائي
loadProducts();