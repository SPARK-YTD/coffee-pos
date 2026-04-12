async function login() {
  const number = document.getElementById("employee_number").value.trim();
  const password = document.getElementById("password").value.trim();

  // تحقق من الإدخال
  if (!number || !password) {
    alert("حط الرقم الوظيفي والباسورد");
    return;
  }

  try {
    // نتأكد أن supabase موجود
    if (!supabase) {
      alert("Supabase مو متصل ❌");
      console.error("Supabase not initialized");
      return;
    }

    // نجيب كل الموظفين
    const { data, error } = await supabase
      .from("employees")
      .select("*");

    if (error) {
      console.error("Supabase error:", error);
      alert("في مشكلة بالاتصال ❌");
      return;
    }

    console.log("Employees:", data);

    // نبحث عن المستخدم
    const user = data.find(u =>
      u.employee_number == number && u.password == password
    );

    if (!user) {
      alert("بيانات غلط ❌");
      return;
    }

    // تم الدخول
    alert("تم تسجيل الدخول ✅");

    localStorage.setItem("user", JSON.stringify(user));

    // تحويل حسب الدور
    if (user.role === "admin") {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "cashier.html";
    }

  } catch (err) {
    console.error("Unexpected error:", err);
    alert("في مشكلة غير متوقعة ❌");
  }
}
