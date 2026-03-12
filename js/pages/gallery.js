(function () {
  const galleries = Array.from(document.querySelectorAll("[data-gallery-card]"));

  galleries.forEach((gallery) => {
    const image = gallery.querySelector("[data-gallery-image]");
    const counter = gallery.querySelector("[data-gallery-counter]");
    const prevButton = gallery.querySelector("[data-gallery-prev]");
    const nextButton = gallery.querySelector("[data-gallery-next]");
    const title = gallery.getAttribute("data-gallery-title") || "Gallery item";
    const totalCount = Number(gallery.getAttribute("data-gallery-count")) || 1;
    const images = (gallery.getAttribute("data-gallery-images") || "")
      .split("||")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!image || !counter || !prevButton || !nextButton || !images.length) {
      return;
    }

    let index = 0;

    const render = () => {
      const displayIndex = ((index % totalCount) + totalCount) % totalCount;
      const currentImage = images[displayIndex % images.length];

      image.src = currentImage;
      image.alt = title + " image " + (displayIndex + 1);
      counter.textContent = String(displayIndex + 1) + " / " + String(totalCount);

      const disabled = totalCount <= 1;
      prevButton.disabled = disabled;
      nextButton.disabled = disabled;
    };

    prevButton.addEventListener("click", () => {
      index = (index - 1 + totalCount) % totalCount;
      render();
    });

    nextButton.addEventListener("click", () => {
      index = (index + 1) % totalCount;
      render();
    });

    render();
  });
})();
