async function login() {
  const number = document.getElementById("employee_number").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!number || !password) {
    alert("حط الرقم والباسورد");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("employees")
      .select("*");

    if (error) {
      alert("خطأ في الاتصال ❌");
      console.error(error);
      return;
    }

    const user = data.find(u =>
      u.employee_number == number && u.password == password
    );

    if (!user) {
      alert("بيانات غلط ❌");
      return;
    }

    localStorage.setItem("user", JSON.stringify(user));

    if (user.role === "admin") {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "cashier.html";
    }

  } catch (err) {
    console.error(err);
    alert("خطأ غير متوقع ❌");
  }
}
