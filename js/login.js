async function login() {
  const userInput = document.getElementById("user");
  const passInput = document.getElementById("pass");

  // تحقق
  if (!userInput || !passInput) {
    alert("خطأ في الصفحة ❌");
    console.error("Inputs not found");
    return;
  }

  const user = userInput.value.trim();
  const pass = passInput.value.trim();

  if (!user || !pass) {
    alert("اكتب البيانات ❌");
    return;
  }

  try {
    const { data, error } = await window.supabaseClient
      .from("employees")
      .select("*")
      .eq("employee_number", user)
      .eq("password", pass)
      .single();

    if (error || !data) {
      alert("بيانات غلط ❌");
      console.log(error);
      return;
    }

    // حفظ الجلسة
    localStorage.setItem("user", JSON.stringify(data));

    if (data.role === "admin") {
      location.href = "dashboard.html";
    } else {
      location.href = "cashier.html";
    }

  } catch (err) {
    console.error(err);
    alert("خطأ غير متوقع ❌");
  }
}
