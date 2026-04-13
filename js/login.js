async function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  const { data, error } = await supabaseClient
    .from("employees")
    .select("*")
    .eq("employee_number", user)
    .eq("password", pass)
    .single();

  if (error || !data) {
    alert("بيانات غلط ❌");
    return;
  }

  localStorage.setItem("user", JSON.stringify(data));

  if (data.role === "admin") {
    location.href = "dashboard.html";
  } else {
    location.href = "cashier.html";
  }
}