async function login() {
  const user = document.getElementById("user").value.trim();
  const pass = document.getElementById("pass").value.trim();

  if (!user || !pass) {
    alert("اكتب البيانات ❌");
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("employees")
    .select("*")
    .eq("employee_number", user)
    .eq("password", pass);

  console.log("RESULT:", data, error);

  if (error) {
    alert("خطأ في الاتصال ❌");
    console.log(error);
    return;
  }

  if (!data || data.length === 0) {
    alert("بيانات غلط ❌");
    return;
  }

  const employee = data[0];

  // حفظ المستخدم
  localStorage.setItem("user", JSON.stringify(employee));

  // تحويل
  if (employee.role === "admin") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "cashier.html";
  }
}
