async function addEmployee() {
  const name = document.getElementById("name").value;
  const number = document.getElementById("number").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.from("employees").insert([
    {
      name,
      employee_number: number,
      password,
      role: "cashier"
    }
  ]);

  if (error) {
    alert("خطأ");
  } else {
    alert("تم إضافة الموظف");
  }
}
