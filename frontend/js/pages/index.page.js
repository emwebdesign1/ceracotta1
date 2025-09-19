// 1. Animation des sections au scroll
const sections = document.querySelectorAll(".section");
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
    }
  });
}, { threshold: 0.2 });
sections.forEach(sec => observer.observe(sec));

// 2. CTA scroll
document.querySelector('.cta-button')?.addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('univers')?.scrollIntoView({ behavior: 'smooth' });
});

// 3. Avis clients (slider horizontal avec flèches)
const avisSlider = document.querySelector(".avis-slider");
document.getElementById("avis-prev")?.addEventListener("click", () => {
  avisSlider.scrollBy({ left: -320, behavior: "smooth" });
});
document.getElementById("avis-next")?.addEventListener("click", () => {
  avisSlider.scrollBy({ left: 320, behavior: "smooth" });
});
