export function animateSendButton(sendBtn) {
  const plane = document.createElement("span");
  plane.textContent = "✈️";
  plane.style.marginLeft = "10px";
  plane.style.animation = "fly 1s forwards";
  sendBtn.appendChild(plane);
  setTimeout(() => plane.remove(), 1000);
}