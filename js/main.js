
document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelectorAll("[data-year]");
  year.forEach(item => item.textContent = new Date().getFullYear());

  let user = null;
  const savedUser = localStorage.getItem("ptbCurrentUser");
  if (savedUser) {
    try {
      user = JSON.parse(savedUser);
    } catch (error) {
      console.error("Could not read the saved account session.", error);
    }
  }

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      try {
        const supabase = await window.connectPTBSupabase();
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      } catch (error) {
        console.error("Supabase sign out failed.", error);
        window.alert(`Sign out failed: ${error.message}`);
        return;
      }
      localStorage.removeItem("ptbCurrentUser");
      window.location.href = window.location.pathname.includes("/pages/")
        ? "login.html"
        : "pages/login.html";
    });
  });

  document.querySelectorAll("[data-user-name]").forEach(el => {
    el.textContent = user?.username || "Guest";
  });

  const header = document.querySelector("body > header");
  if (header && !header.querySelector("nav")) {
    const navigation = document.createElement("nav");
    navigation.setAttribute("aria-label", "Main navigation");
    navigation.innerHTML = `
      <a href="../index.html">Home</a>
      <a href="marketplace.html">Marketplace</a>
      <a href="dashboard.html">Dashboard</a>
      <a href="support.html">Support</a>
    `;
    if (window.location.pathname.endsWith("/index.html") || !window.location.pathname.includes("/pages/")) {
      navigation.querySelector('a[href="../index.html"]').href = "index.html";
      navigation.querySelector('a[href="marketplace.html"]').href = "pages/marketplace.html";
      navigation.querySelector('a[href="dashboard.html"]').href = "pages/dashboard.html";
      navigation.querySelector('a[href="support.html"]').href = "pages/support.html";
    }
    const existingLinks = Array.from(header.querySelectorAll("a"))
      .map(link => link.href);
    navigation.querySelectorAll("a").forEach(link => {
      if (existingLinks.includes(link.href)) link.remove();
    });

    const hasAccountLink = header.querySelector("[data-logout]") ||
      Array.from(header.querySelectorAll("a")).some(link => /\/login\.html$/.test(link.href));
    if (!hasAccountLink) {
      const accountLink = document.createElement("a");
      if (user) {
        accountLink.href = "#";
        accountLink.dataset.logout = "";
        accountLink.textContent = "Log out";
        accountLink.addEventListener("click", event => {
          event.preventDefault();
          localStorage.removeItem("ptbCurrentUser");
          window.location.href = window.location.pathname.includes("/pages/")
            ? "login.html"
            : "pages/login.html";
        });
      } else {
        accountLink.href = window.location.pathname.includes("/pages/")
          ? "login.html"
          : "pages/login.html";
        accountLink.textContent = "Login";
      }
      navigation.appendChild(accountLink);
    }
    header.appendChild(navigation);
  }

  if (header && !document.querySelector("body > footer")) {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="footer-content">
        <div>
          <h3>Prove Talentbridge</h3>
          <p>Connecting talent with opportunities.</p>
        </div>
        <nav class="footer-links" aria-label="Legal and help">
          <a href="terms.html">Terms</a>
          <a href="privacy.html">Privacy</a>
          <a href="payments-policy.html">Payments Policy</a>
          <a href="community-rules.html">Community Rules</a>
          <a href="support.html">Support</a>
        </nav>
      </div>
      <hr>
      <p>&copy; <span data-year>${new Date().getFullYear()}</span> Prove Talentbridge. All rights reserved.</p>
    `;
    document.body.appendChild(footer);
    if (!window.location.pathname.includes("/pages/")) {
      footer.querySelectorAll("a").forEach(link => {
        link.href = `pages/${link.getAttribute("href")}`;
      });
    }
  }

  const listings = document.getElementById("professionalListings");
  if (listings) {
    const search = document.getElementById("professionalSearch");
    const category = document.getElementById("marketplaceCategory");
    const requestedCategory = new URLSearchParams(window.location.search).get("category");
    if (category && requestedCategory) {
      const option = Array.from(category.options).find(item =>
        item.value.toLowerCase() === requestedCategory.toLowerCase()
      );
      if (option) category.value = option.value;
    }
    const profile = JSON.parse(localStorage.getItem("ptbProfessionalProfile") || "null");
    const jobsContainer = document.getElementById("recentJobs");
    const jobs = JSON.parse(localStorage.getItem("ptbJobs") || "[]");

    function renderMarketplace() {
      listings.replaceChildren();
      const searchTerm = search ? search.value.trim().toLowerCase() : "";
      const selectedCategory = category ? category.value.toLowerCase() : "";
      const haystack = profile
        ? `${profile.username} ${profile.occupation} ${profile.bio} ${profile.services} ${profile.skills}`.toLowerCase()
        : "";
      const profileCategory = profile ? String(profile.occupation || "").toLowerCase() : "";
      const categoryMatches = !selectedCategory ||
        profileCategory.includes(selectedCategory) ||
        (selectedCategory === "design" && /design|graphic/.test(profileCategory)) ||
        (selectedCategory === "video editing" && /video|editor/.test(profileCategory)) ||
        (selectedCategory === "photo editing" && /photo|editor|photographer/.test(profileCategory)) ||
        (selectedCategory === "technology" && /developer|technology|tech/.test(profileCategory)) ||
        (selectedCategory === "writing" && /writer|writing|content/.test(profileCategory)) ||
        (selectedCategory === "marketing" && /market|social/.test(profileCategory)) ||
        (selectedCategory === "business" && /business|consultant/.test(profileCategory)) ||
        (selectedCategory === "virtual assistance" && /assistant|virtual/.test(profileCategory));

      if (profile && categoryMatches && (!searchTerm || haystack.includes(searchTerm))) {
        const card = document.createElement("article");
        card.className = "professional-card";
        const heading = document.createElement("h2");
        heading.textContent = profile.username || "Professional";
        const role = document.createElement("p");
        role.className = "muted";
        role.textContent = profile.occupation || "Independent professional";
        const bio = document.createElement("p");
        bio.textContent = profile.bio || "This professional has not added a bio yet.";
        const service = document.createElement("p");
        service.textContent = [profile.services, profile.skills].filter(Boolean).join(" · ");
        card.append(heading, role, bio);
        if (service.textContent) card.appendChild(service);
        const link = document.createElement("a");
        link.className = "btn btn-outline";
        link.href = "professional-profile.html";
        link.textContent = "Edit professional profile";
        card.appendChild(link);
        listings.appendChild(card);
      }

      if (!listings.childElementCount) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = profile
          ? "No professionals match those filters yet."
          : "No professional profiles are available yet. Create a professional account and complete your profile to appear here.";
        listings.appendChild(empty);
      }
    }

    if (search) search.addEventListener("input", renderMarketplace);
    if (category) category.addEventListener("change", renderMarketplace);
    renderMarketplace();

    if (jobsContainer) {
      jobsContainer.replaceChildren();
      if (!jobs.length) {
        jobsContainer.textContent = "No jobs have been posted on this device yet.";
      } else {
        jobs.forEach(job => {
          const item = document.createElement("article");
          item.className = "job-card";
          const title = document.createElement("h3");
          title.textContent = job.title;
          const details = document.createElement("p");
          details.textContent = `${job.category || "General"} · ₦${job.budget || "Budget not set"} · Deadline: ${job.deadline || "Not set"}`;
          const description = document.createElement("p");
          description.textContent = job.description || "";
          item.append(title, details, description);
          jobsContainer.appendChild(item);
        });
      }
    }
  }

  document.querySelectorAll("#supportForm, #disputeForm").forEach(form => {
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const key = form.id === "supportForm" ? "ptbSupportRequests" : "ptbDisputes";
      const records = JSON.parse(localStorage.getItem(key) || "[]");
      records.unshift({ ...data, status: "Submitted", createdAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(records));
      const status = form.querySelector('[role="status"], p');
      if (status) status.textContent = form.id === "supportForm"
        ? "Your request has been saved on this device. Support delivery requires a connected backend."
        : "Your dispute has been saved on this device for review.";
      form.reset();
    });
  });
});
