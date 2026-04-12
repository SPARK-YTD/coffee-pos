async function login() {
  const number = document.getElementById("employee_number").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_number", number)
    .eq("password", password)
    .single();

  if (error || !data) {
    alert("بيانات غلط");
    return;
  }

  localStorage.setItem("user", JSON.stringify(data));

  if (data.role === "admin") {
    window.location.href = "dashboard.html";
  } else {
    window.location.href = "cashier.html";
  }
}