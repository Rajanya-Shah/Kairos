// Grab elements from the HTML
const sendBtn = document.getElementById("sendBtn");
const msgInput = document.getElementById("msgInput");
const messagesDiv = document.getElementById("messages");

// Function to add a new message
function addMessage(text, sender = "You") {
  const newMsg = document.createElement("div");
  newMsg.className = sender === "You" ? "message sender" : "message receiver";
  newMsg.textContent = `${sender}: ${text}`;

  // Add animation class
  newMsg.style.animation = "slideIn 0.5s ease";

  messagesDiv.appendChild(newMsg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Event listener for Send button
sendBtn.addEventListener("click", () => {
  const text = msgInput.value.trim();
  if (text !== "") {
    addMessage(text, "You");
    msgInput.value = "";
  }
});

// Optional: Press Enter to send
msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendBtn.click();
  }
});

// Typing indicator (three bouncing dots)
function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "message receiver";
  indicator.innerHTML = "User B is typing <span class='dots'>...</span>";
  messagesDiv.appendChild(indicator);

  setTimeout(() => {
    indicator.remove(); // remove after 2 seconds
    addMessage("Hey, just testing typing animation!", "User B");
  }, 2000);
}

// Trigger typing indicator after 3 seconds (demo)
setTimeout(showTypingIndicator, 3000);