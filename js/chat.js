
document.addEventListener("DOMContentLoaded", () => {
  const key = "ptbChatMessages";
  const contactPattern = /(\+?\d[\d\s()-]{7,}\d|https?:\/\/|www\.|instagram\.com|facebook\.com|t\.me)/i;

  document.querySelectorAll("#clientChatForm, #workerChatForm, #chatForm").forEach(form => {
    const input = form.querySelector("textarea, input");
    const messages = document.getElementById(
      form.id === "clientChatForm" ? "clientChatMessages" :
        form.id === "workerChatForm" ? "workerChatMessages" : "chatMessages"
    );
    const status = form.querySelector('[role="status"], p');
    if (!input || !messages) return;

    function displayMessages() {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      messages.replaceChildren();
      saved.forEach(message => {
        const item = document.createElement("p");
        item.className = "message";
        item.textContent = `${message.sender}: ${message.text}`;
        messages.appendChild(item);
      });
      if (!saved.length) messages.textContent = "No messages yet. Start the conversation below.";
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (contactPattern.test(text)) {
        if (status) status.textContent = "Sharing phone numbers or external contact details is not allowed.";
        return;
      }

      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      const user = JSON.parse(localStorage.getItem("ptbCurrentUser") || "null");
      saved.push({
        sender: user?.username || "User",
        text,
        sentAt: new Date().toISOString()
      });
      localStorage.setItem(key, JSON.stringify(saved));
      input.value = "";
      if (status) status.textContent = "Message saved on this device. Shared messaging requires a connected backend.";
      displayMessages();
    });

    displayMessages();
  });
});
