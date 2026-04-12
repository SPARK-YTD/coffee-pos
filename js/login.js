async function login() {
  const number = document.getElementById("employee_number").value.trim();
  const password = document.getElementById("password").value.trim();

  const { data } = await supabase
    .from("employees")
    .select("*");

  console.log(data);

  const user = data.find(u => 
    u.employee_number == number && u.password == password
  );

  if (!user) {
    alert("بيانات غلط ❌");
    return;
  }

  alert("دخلت ✅");

  localStorage.setItem("user", JSON.stringify(user));

  window.location.href = "dashboard.html";
}
