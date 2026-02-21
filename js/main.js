(function(){
  let currentPath = window.location.pathname.split("/").pop();
  if(currentPath === "") currentPath = "index.html";

  const navLinks = document.querySelectorAll(".pnu-nav-link");

  navLinks.forEach(link => {
    const linkPath = link.getAttribute("href");
    if(linkPath === currentPath){
      link.classList.add("pnu-nav-link-cta");
    }
  });
})();