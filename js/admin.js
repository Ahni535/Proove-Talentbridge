
document.addEventListener("DOMContentLoaded", () => {
  const submissions = JSON.parse(
    localStorage.getItem("ptbSubmissions") || "[]"
  );

  const submissionCount = document.getElementById("submissionCount");

  if (submissionCount) submissionCount.textContent = submissions.length;

  const reviewList = document.getElementById("adminSubmissions");

  if (reviewList) {
    reviewList.replaceChildren();
    if (!submissions.length) {
      reviewList.textContent = "No work submissions have been received.";
    }

    submissions.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "feature-card";

      const title = document.createElement("h3");
      title.textContent = item.title;

      const status = document.createElement("p");
      status.textContent = `Status: ${item.status}`;

      const approve = document.createElement("button");
      approve.textContent = "Approve";
      approve.addEventListener("click", () => {
        submissions[index].status = "Approved";
        localStorage.setItem("ptbSubmissions", JSON.stringify(submissions));
        location.reload();
      });

      card.append(title, status, approve);
      reviewList.appendChild(card);
    });
  }

  const staffForm = document.getElementById("staffManagementForm");
  const staffList = document.getElementById("staffList");
  if (staffList) {
    const staff = JSON.parse(localStorage.getItem("ptbStaff") || "[]");
    staffList.replaceChildren();
    if (!staff.length) {
      staffList.textContent = "No staff assignments have been saved on this device.";
    } else {
      staff.forEach(member => {
        const item = document.createElement("article");
        item.className = "notification-card";
        item.textContent = `${member.email} — ${member.duty}${member.canApprovePayments ? " (payment approval)" : ""}`;
        staffList.appendChild(item);
      });
    }
  }

  if (staffForm) {
    staffForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(staffForm);
      const staff = JSON.parse(localStorage.getItem("ptbStaff") || "[]");
      staff.unshift({
        email: data.get("email"),
        duty: data.get("duty"),
        canApprovePayments: data.get("canApprovePayments") === "on"
      });
      localStorage.setItem("ptbStaff", JSON.stringify(staff));
      const message = document.getElementById("staffManagementMessage");
      if (message) message.textContent = "Staff assignment saved on this device. Access controls require a secure backend.";
      staffForm.reset();
      if (staffList) {
        const item = document.createElement("article");
        item.className = "notification-card";
        item.textContent = `${staff[0].email} — ${staff[0].duty}${staff[0].canApprovePayments ? " (payment approval)" : ""}`;
        staffList.prepend(item);
      }
    });
  }
});
