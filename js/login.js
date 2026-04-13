function login() {
  const userInput = document.getElementById("user");
  const passInput = document.getElementById("pass");

  if (!userInput || !passInput) {
    console.error("❌ input مو موجود");
    return alert("في مشكلة في الصفحة");
  }

  const user = userInput.value;
  const pass = passInput.value;

  doLogin(user, pass);
}

async function doLogin(user, pass) {
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
