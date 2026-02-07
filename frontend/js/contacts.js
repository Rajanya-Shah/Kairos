export const contacts = [
  { id: "kairos001", name: "User A" },
  { id: "kairos002", name: "User B" },
  { id: "kairos003", name: "User C" }
];

export function renderContacts() {
  const list = document.getElementById("contactList");
  list.innerHTML = "";
  contacts.forEach(contact => {
    const li = document.createElement("li");
    li.textContent = `${contact.name} (${contact.id})`;
    li.addEventListener("click", () => {
      document.getElementById("chatTitle").textContent = `Chat with ${contact.name}`;
    });
    list.appendChild(li);
  });
}