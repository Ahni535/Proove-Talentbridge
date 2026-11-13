
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("notificationList") ||
    document.getElementById("notificationsList");
  if (!container) return;

  const notifications = JSON.parse(
    localStorage.getItem("ptbNotifications") || "[]"
  );

  container.innerHTML = "";

  render();

  function render() {
    container.replaceChildren();
    if (!notifications.length) {
      container.textContent = "You have no notifications.";
      return;
    }
    notifications.forEach(note => {
      const item = document.createElement("article");
      item.className = "notification-card";
      item.textContent = note.message;
      container.appendChild(item);
    });
  }

  const markRead = document.getElementById("markNotificationsRead");
  if (markRead) {
    markRead.addEventListener("click", () => {
      notifications.length = 0;
      localStorage.setItem("ptbNotifications", JSON.stringify(notifications));
      render();
      markRead.disabled = true;
      markRead.textContent = "All caught up";
    });
  }
});

function addPTBNotification(message) {
  const notifications = JSON.parse(
    localStorage.getItem("ptbNotifications") || "[]"
  );

  notifications.unshift({
    message,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem("ptbNotifications", JSON.stringify(notifications));
}
