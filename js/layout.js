(async function () {
  const loadPartial = async (selector, url) => {
    const mount = document.querySelector(selector);
    if (!mount) return;

    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error("Failed to load " + url + ": " + response.status);
    }

    mount.innerHTML = await response.text();
  };

  const getCurrentPath = () => {
    const path = window.location.pathname.split("/").pop();
    return path || "index.html";
  };

  const syncActiveNavigation = () => {
    const currentPath = getCurrentPath();

    document
      .querySelectorAll(".pnu-nav-link, .pnu-mobile-link")
      .forEach((link) => {
        const isActive = link.getAttribute("href") === currentPath;
        link.classList.toggle("pnu-nav-link-cta", isActive);

        if (isActive) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });
  };

  const syncFooterYear = () => {
    const year = document.getElementById("pnu-year");
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }
  };

  const setupMobileMenu = () => {
    const root = document.documentElement;
    const button = document.getElementById("mobileMenuBtn");
    const sheet = document.getElementById("mobileMenuSheet");
    const backdrop = document.getElementById("mobileMenuBackdrop");
    const closeButton = document.getElementById("mobileMenuClose");
    const closeDelayMs = 220;
    let hideTimer = null;

    if (!button || !sheet || !backdrop) return;

    const isOpen = () => root.classList.contains("pnu-mobile-open");

    const openMenu = () => {
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }

      sheet.hidden = false;
      backdrop.hidden = false;
      root.classList.add("pnu-mobile-open");
      button.setAttribute("aria-expanded", "true");
    };

    const closeMenu = () => {
      root.classList.remove("pnu-mobile-open");
      button.setAttribute("aria-expanded", "false");

      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }

      hideTimer = window.setTimeout(() => {
        if (!isOpen()) {
          sheet.hidden = true;
          backdrop.hidden = true;
        }
        hideTimer = null;
      }, closeDelayMs);
    };

    button.addEventListener("click", () => {
      if (isOpen()) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    backdrop.addEventListener("click", closeMenu);

    if (closeButton) {
      closeButton.addEventListener("click", closeMenu);
    }

    sheet.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        closeMenu();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768 && isOpen()) {
        closeMenu();
      }
    });
  };

  try {
    await Promise.all([
      loadPartial("#siteHeader", "partials/header.html"),
      loadPartial("#siteFooter", "partials/footer.html"),
    ]);
  } catch (error) {
    console.error(error);
  }

  syncActiveNavigation();
  syncFooterYear();
  setupMobileMenu();
})();
