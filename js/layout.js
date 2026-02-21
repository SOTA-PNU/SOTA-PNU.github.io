(async function () {
  const load = async (selector, url) => {
    const mount = document.querySelector(selector);
    if (!mount) return false;

    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);

    mount.innerHTML = await res.text();
    return true;
  };

  // 1) Inject header/footer
  await load("#siteHeader", "partials/header.html");
  await load("#siteFooter", "partials/footer.html");

  // 2) Footer year
  const yearEl = document.getElementById("pnu-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // 3) Active nav highlighting (desktop + mobile)
  let currentPath = window.location.pathname.split("/").pop();
  if (currentPath === "") currentPath = "index.html";

  document.querySelectorAll('.pnu-nav-link, .pnu-mobile-link').forEach(a => {
    const href = a.getAttribute("href");
    if (href === currentPath) a.classList.add("pnu-nav-link-cta");
  });

  // 4) Mobile menu toggle (works after injection)
  const btn = document.getElementById("mobileMenuBtn");
  const sheet = document.getElementById("mobileMenuSheet");
  const backdrop = document.getElementById("mobileMenuBackdrop");
  const closeBtn = document.getElementById("mobileMenuClose");

  if (btn && sheet && backdrop) {
    const open = () => {
      document.documentElement.classList.add("pnu-mobile-open");
      sheet.hidden = false;
      backdrop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      document.documentElement.classList.remove("pnu-mobile-open");
      btn.setAttribute("aria-expanded", "false");
      window.setTimeout(() => {
        sheet.hidden = true;
        backdrop.hidden = true;
      }, 220);
    };

    const isOpen = () => document.documentElement.classList.contains("pnu-mobile-open");

    btn.addEventListener("click", () => (isOpen() ? close() : open()));
    backdrop.addEventListener("click", close);
    if (closeBtn) closeBtn.addEventListener("click", close);

    sheet.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a) close();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) close();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth >= 768 && isOpen()) close();
    });
  }
})();