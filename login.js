async function login() {
  const number = document.getElementById("employee_number").value.trim();
  const password = document.getElementById("password").value.trim();

  // تحقق بسيط
  if (!number || !password) {
    alert("حط الرقم الوظيفي والباسورد");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_number", number)
      .eq("password", password)
      .single();

    // إذا فيه خطأ أو ما لقى المستخدم
    if (error || !data) {
      console.log("Login error:", error);
      alert("بيانات غلط ❌");
      return;
    }

    // حفظ المستخدم
    localStorage.setItem("user", JSON.stringify(data));

    // توجيه حسب الدور
    if (data.role === "admin") {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "cashier.html";
    }

  } catch (err) {
    console.error("Unexpected error:", err);
    alert("في مشكلة بالاتصال ❌");
  }
}