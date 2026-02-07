import { animateSendButton } from "./ui.js";
import { renderContacts } from "./contacts.js";

const sendBtn = document.getElementById("sendBtn");
const msgInput = document.getElementById("msgInput");
const messagesDiv = document.getElementById("messages");

function addMessage(text, sender = "You") {
  const newMsg = document.createElement("div");
  newMsg.className = sender === "You" ? "message sender" : "message receiver";
  newMsg.textContent = `${sender}: ${text}`;
  messagesDiv.appendChild(newMsg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const text = msgInput.value.trim();
  if (text !== "") {
    addMessage(text, "You");
    msgInput.value = "";
    animateSendButton(sendBtn);
  }
});

msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// Initialize
renderContacts();