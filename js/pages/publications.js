(function () {
  const filterBar = document.getElementById("pubFilters");
  if (!filterBar) return;

  const chips = Array.from(filterBar.querySelectorAll("[data-filter]"));
  const cards = Array.from(document.querySelectorAll(".pnu-pub-card"));
  const yearBlocks = Array.from(document.querySelectorAll(".pnu-year-block"));

  const normalizeTags = (value) =>
    (value || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);

  const applyFilter = (filterKey) => {
    chips.forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.filter === filterKey);
    });

    cards.forEach((card) => {
      const tags = normalizeTags(card.getAttribute("data-tags"));
      const show = filterKey === "all" || tags.includes(filterKey);
      card.style.display = show ? "" : "none";
    });

    yearBlocks.forEach((block) => {
      const visibleCards = Array.from(block.querySelectorAll(".pnu-pub-card"))
        .filter((card) => card.style.display !== "none");
      block.style.display = visibleCards.length ? "" : "none";
    });
  };

  filterBar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    applyFilter(button.dataset.filter);
  });

  applyFilter("all");
})();
