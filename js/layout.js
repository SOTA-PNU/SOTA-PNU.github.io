(async function () {
  // 같은 페이지에서 이 파일이 두 번 이상 실려도 리스너가 중복 등록되지 않도록 한다.
  // (토글이 두 번 걸리면 클릭 한 번에 열렸다 바로 닫혀서 메뉴가 동작하지 않는 것처럼 보인다)
  if (window.__pnuLayoutLoaded) return;
  window.__pnuLayoutLoaded = true;

  const load = async (selector, url) => {
    const mount = document.querySelector(selector);
    if (!mount) return false;

    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);

    mount.innerHTML = await res.text();
    return true;
  };

  // 1) Inject header/footer
  // index.html 처럼 헤더/푸터가 이미 문서에 들어있는 페이지도 있으므로,
  // 주입이 실패하더라도 아래 모바일 메뉴 바인딩까지 막히면 안 된다.
  try {
    await load("#siteHeader", "partials/header.html");
    await load("#siteFooter", "partials/footer.html");
  } catch (err) {
    console.error("[layout] partial injection failed:", err);
  }

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
    const DUR = 220; // css/redesign.css 의 transition 시간과 맞춘다
    let hideTimer = null;

    const isOpen = () => document.documentElement.classList.contains("pnu-mobile-open");

    const open = () => {
      // 닫는 중이었다면 예약된 hidden 처리를 취소한다
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

      sheet.hidden = false;
      backdrop.hidden = false;

      // hidden 해제 직후 reflow 를 한 번 주어야 transition 이 실제로 재생된다
      void sheet.offsetHeight;

      document.documentElement.classList.add("pnu-mobile-open");
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      document.documentElement.classList.remove("pnu-mobile-open");
      btn.setAttribute("aria-expanded", "false");

      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        // 애니메이션이 끝나기 전에 다시 열렸으면 숨기지 않는다
        if (!isOpen()) {
          sheet.hidden = true;
          backdrop.hidden = true;
        }
        hideTimer = null;
      }, DUR);
    };

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