async function openShift() {
  const user = JSON.parse(localStorage.getItem("user"));

  const { error } = await supabase.from("shifts").insert([
    {
      employee_id: user.id
    }
  ]);

  if (error) {
    alert("خطأ");
  } else {
    alert("تم فتح الشفت");
  }
}