// Elements
const sendBtn = document.getElementById("sendBtn");
const msgInput = document.getElementById("msgInput");
const messagesDiv = document.getElementById("messages");
const contactList = document.getElementById("contactList");
const chatTitle = document.getElementById("chatTitle");

// Demo contacts
const contacts = [
  { id: "kairos001", name: "User A" },
  { id: "kairos002", name: "User B" },
  { id: "kairos003", name: "User C" }
];

// Render contacts
function renderContacts() {
  contactList.innerHTML = "";
  contacts.forEach(contact => {
    const li = document.createElement("li");
    li.textContent = `${contact.name} (${contact.id})`;
    li.addEventListener("click", () => {
      document.querySelectorAll(".sidebar li").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      chatTitle.textContent = `Chat with ${contact.name}`;
    });
    contactList.appendChild(li);
  });
}

// Add message
function addMessage(text, sender = "You") {
  const newMsg = document.createElement("div");
  newMsg.className = sender === "You" ? "message sender" : "message receiver";
  newMsg.textContent = `${sender}: ${text}`;
  messagesDiv.appendChild(newMsg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Animate send button
function animateSendButton() {
  const plane = document.createElement("span");
  plane.textContent = "✈️";
  plane.style.marginLeft = "10px";
  plane.style.animation = "fly 1s forwards";
  sendBtn.appendChild(plane);
  setTimeout(() => plane.remove(), 1000);
}

// Events
sendBtn.addEventListener("click", () => {
  const text = msgInput.value.trim();
  if (text !== "") {
    addMessage(text, "You");
    msgInput.value = "";
    animateSendButton();
  }
});

msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// Init
renderContacts();