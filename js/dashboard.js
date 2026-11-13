
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("ptbCurrentUser") || "null");

  document.querySelectorAll("[data-user-name]").forEach(el => {
    el.textContent = user?.username || "Professional";
  });

  const profileForm = document.getElementById("professionalProfileForm") ||
    document.getElementById("profileForm");
  const verifiedWorkList = document.getElementById("verifiedWorkList");

  if (verifiedWorkList) {
    const approvedWork = JSON.parse(localStorage.getItem("ptbSubmissions") || "[]")
      .filter(item => item.status === "Approved");
    verifiedWorkList.replaceChildren();
    if (!approvedWork.length) {
      verifiedWorkList.textContent = "No approved work is available yet.";
    } else {
      approvedWork.forEach(item => {
        const card = document.createElement("article");
        card.className = "feature-card";
        const title = document.createElement("h3");
        title.textContent = item.title || item.taskReference || "Verified work";
        const description = document.createElement("p");
        description.textContent = item.description || "";
        card.append(title, description);
        verifiedWorkList.appendChild(card);
      });
    }
  }

  if (profileForm) {
    const saved = JSON.parse(localStorage.getItem("ptbProfessionalProfile") || "null");

    if (saved) {
      ["username", "occupation", "bio", "services", "skills", "portfolio"].forEach(key => {
        if (profileForm.elements[key]) {
          profileForm.elements[key].value = saved[key] || "";
        }
      });
    } else if (user?.username && profileForm.elements.username) {
      profileForm.elements.username.value = user.username;
    }

    profileForm.addEventListener("submit", event => {
      event.preventDefault();

      const data = new FormData(profileForm);
      const profile = {};

      ["username", "occupation", "bio", "services", "skills", "portfolio"].forEach(key => {
        profile[key] = data.get(key) || "";
      });

      localStorage.setItem("ptbProfessionalProfile", JSON.stringify(profile));
      const message = profileForm.querySelector('[role="status"], p');
      if (message) message.textContent = "Your profile has been saved on this device.";
    });
  }
});
