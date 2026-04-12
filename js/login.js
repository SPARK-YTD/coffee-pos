async function login() {
  const number = document.getElementById("employee_number").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!number || !password) {
    alert("حط البيانات");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("employees")
    .select("*");

  if (error) {
    alert("خطأ اتصال ❌");
    console.log(error);
    return;
  }

  const user = data.find(u =>
    u.employee_number == number && u.password == password
  );

  if (!user) {
    alert("بيانات غلط ❌");
    return;
  }

  alert("تم الدخول ✅");

  localStorage.setItem("user", JSON.stringify(user));

  if (user.role === "admin") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "cashier.html";
  }
}
