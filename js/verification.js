
document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("verificationQueue") ||
    document.getElementById("verificationList");
  if (!list) return;

  function render() {
    const submissions = JSON.parse(localStorage.getItem("ptbSubmissions") || "[]");
    list.replaceChildren();
    if (!submissions.length) {
      list.textContent = "No work submissions are awaiting review.";
      return;
    }
    submissions.forEach((submission, index) => {
    const card = document.createElement("div");
    card.className = "feature-card";

    const title = document.createElement("h3");
    title.textContent = submission.title;

    const description = document.createElement("p");
    description.textContent = submission.description;

    const status = document.createElement("p");
    status.textContent = `Review status: ${submission.status}`;

    const approve = document.createElement("button");
    approve.textContent = "Approve work";
    approve.addEventListener("click", () => {
      updateStatus(index, "Approved");
    });

    const redo = document.createElement("button");
    redo.textContent = "Request redo";
    redo.addEventListener("click", () => {
      updateStatus(index, "Corrections requested");
    });

    card.append(title, description, status, approve, redo);
    list.appendChild(card);
    });
  }

  function updateStatus(index, status) {
    const submissions = JSON.parse(localStorage.getItem("ptbSubmissions") || "[]");
    if (!submissions[index]) return;
    submissions[index].status = status;
    localStorage.setItem("ptbSubmissions", JSON.stringify(submissions));
    render();
  }

  render();
});
