async function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  const { data } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_number", user)
    .eq("password", pass)
    .single();

  if (!data) return alert("خطأ");

  if (data.role === "admin") location = "dashboard.html";
  else location = "cashier.html";
}