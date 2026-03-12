(function () {
  const filterWrap = document.getElementById("memberFilters");
  if (!filterWrap) return;

  const buttons = Array.from(filterWrap.querySelectorAll("[data-filter]"));
  const groups = Array.from(document.querySelectorAll("[data-member-group]"));
  const onlyAllGroups = new Set(["industry", "collaborators"]);

  const setActive = (selectedButton) => {
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button === selectedButton);
    });
  };

  const applyFilter = (filter) => {
    groups.forEach((section) => {
      const group = (section.getAttribute("data-member-group") || "").trim();

      if (onlyAllGroups.has(group)) {
        section.style.display = filter === "all" ? "" : "none";
        return;
      }

      section.style.display =
        filter === "all" || group === filter ? "" : "none";
    });
  };

  const defaultButton =
    buttons.find((button) => button.dataset.filter === "all") || buttons[0];

  if (!defaultButton) return;

  setActive(defaultButton);
  applyFilter(defaultButton.dataset.filter);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setActive(button);
      applyFilter(button.dataset.filter);
    });
  });
})();
