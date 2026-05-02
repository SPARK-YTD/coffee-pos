import { supabase } from "./supabase.js";

async function loadInventory() {
  const { data } = await supabase.from("inventory").select("*");

  const box = document.getElementById("inventoryList");
  box.innerHTML = "";

  (data || []).forEach(i => {
    box.innerHTML += `
      <div style="margin:10px 0">
        📦 ${i.name} - ${i.quantity}
        <button onclick="deleteItem('${i.id}')">🗑</button>
      </div>
    `;
  });
}

window.addItem = async function() {
  const name = document.getElementById("invName").value;
  const quantity = document.getElementById("invQty").value;

  if (!name) return alert("اكتب اسم المادة");

  await supabase.from("inventory").insert({
    name,
    quantity
  });

  loadInventory();
};

window.deleteItem = async function(id) {
  await supabase.from("inventory").delete().eq("id", id);
  loadInventory();
};

loadInventory();