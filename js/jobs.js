
document.addEventListener("DOMContentLoaded", () => {
  const tasksKey = "ptbSubmissions";

  function readRecords(key) {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }

  function saveRecord(key, record) {
    const records = readRecords(key);
    records.unshift(record);
    localStorage.setItem(key, JSON.stringify(records));
  }

  function displayTasks() {
    const history = document.getElementById("submissionHistory");
    const tasks = readRecords(tasksKey);
    if (history) {
      history.replaceChildren();
      if (!tasks.length) {
        history.textContent = "No submissions yet.";
      } else {
        tasks.forEach(task => {
          const card = document.createElement("article");
          card.className = "feature-card";
          const title = document.createElement("h3");
          title.textContent = task.title || task.taskReference || "Work submission";
          const description = document.createElement("p");
          description.textContent = task.description || "";
          const status = document.createElement("p");
          status.textContent = `Status: ${task.status}`;
          card.append(title, description, status);
          history.appendChild(card);
        });
      }
    }

    const available = document.getElementById("availableWorkerTasks");
    if (available) {
      const jobs = readRecords("ptbJobs");
      available.replaceChildren();
      if (!jobs.length) available.textContent = "No jobs are available on this device yet.";
      jobs.forEach(job => {
        const card = document.createElement("article");
        card.className = "job-card";
        const title = document.createElement("h3");
        title.textContent = job.title;
        const details = document.createElement("p");
        details.textContent = `${job.category} · ₦${job.budget} · Deadline: ${job.deadline}`;
        const description = document.createElement("p");
        description.textContent = job.description;
        card.append(title, details, description);
        available.appendChild(card);
      });
    }

    const completed = document.getElementById("completedProjects");
    if (completed) {
      const deliveries = readRecords("ptbDeliveries");
      completed.replaceChildren();
      if (!deliveries.length) completed.textContent = "No project deliveries have been submitted yet.";
      deliveries.forEach(delivery => {
        const item = document.createElement("article");
        item.className = "notification-card";
        item.textContent = `${delivery.projectReference}: ${delivery.description} — ${delivery.status}`;
        completed.appendChild(item);
      });
    }
  }

  function connectForm(id, storageKey, recordFromForm, feedbackId, successMessage) {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", event => {
      event.preventDefault();
      saveRecord(storageKey, {
        ...recordFromForm(new FormData(form)),
        status: "Submitted",
        createdAt: new Date().toISOString()
      });
      const feedback = document.getElementById(feedbackId);
      if (feedback) feedback.textContent = successMessage;
      form.reset();
      displayTasks();
    });
  }

  connectForm("taskSubmissionForm", tasksKey, data => ({
    taskReference: data.get("taskReference"),
    title: data.get("taskReference"),
    description: data.get("description"),
    fileLink: data.get("fileLink")
  }), "taskSubmissionMessage", "Submission saved on this device for review.");

  connectForm("jobPostingForm", "ptbJobs", data => ({
    title: data.get("title"),
    category: data.get("category"),
    description: data.get("description"),
    budget: data.get("budget"),
    deadline: data.get("deadline")
  }), "jobPostingMessage", "Job saved on this device. Publishing it to the marketplace requires a backend.");

  connectForm("projectDeliveryForm", "ptbDeliveries", data => ({
    projectReference: data.get("projectReference"),
    description: data.get("message"),
    fileLink: data.get("fileLink")
  }), "deliveryStatus", "Delivery saved on this device for review.");

  connectForm("projectOfferResponseForm", "ptbProjectOffers", data => ({
    offerReference: data.get("offerReference"),
    price: data.get("price"),
    deadline: data.get("deadline"),
    deliverables: data.get("deliverables")
  }), "offerResponseMessage", "Proposal saved on this device.");

  displayTasks();
});
