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

let activeContact = null;

// Render contacts
function renderContacts() {
  contactList.innerHTML = "";
  contacts.forEach(contact => {
    const li = document.createElement("li");
    li.textContent = `${contact.name} (${contact.id})`;
    li.addEventListener("click", () => {
      document.querySelectorAll(".sidebar li").forEach(el => el.classList.remove("active"));
      li.classList.add("active");
      activeContact = contact;
      chatTitle.textContent = `Chat with ${contact.name}`;
      messagesDiv.innerHTML = ""; // clear old messages
      addDateSeparator();
    });
    contactList.appendChild(li);
  });
}

// Add date separator
function addDateSeparator() {
  const separator = document.createElement("div");
  separator.className = "date-separator";
  separator.textContent = new Date().toLocaleDateString();
  messagesDiv.appendChild(separator);
}

// Add message bubble
function addMessage(text, sender = "You", status = "") {
  const newMsg = document.createElement("div");
  newMsg.className = sender === "You" ? "message sender" : "message receiver";
  newMsg.textContent = `${sender}: ${text} ${status}`;
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

// Fake auto-reply
function autoReply() {
  setTimeout(() => {
    if (activeContact) {
      addMessage("Got your message!", activeContact.name);
    }
  }, 1200);
}

// Handle sending
function handleSend() {
  const text = msgInput.value.trim();
  if (text !== "" && activeContact) {
    addMessage(text, "You", "✓");
    msgInput.value = "";
    animateSendButton();
    autoReply();
  } else if (!activeContact) {
    alert("Please select a contact first.");
  }
}

// Events
sendBtn.addEventListener("click", handleSend);
msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSend();
});

// Init
renderContacts();