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

document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("cookie-banner");
  const stored = localStorage.getItem("cookieConsent");

  if (!stored) {
    banner.classList.remove("hidden");
  }

  document.getElementById("cookie-accept").addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "accepted");
    banner.classList.add("hidden");
    // ici tu pourras activer GA/fbPixel
  });

  document.getElementById("cookie-reject").addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "rejected");
    banner.classList.add("hidden");
  });

  document.getElementById("cookie-customize").addEventListener("click", () => {
    window.location.href = "cookies.html";
  });

});

document.addEventListener("DOMContentLoaded", () => {
  const banner = document.getElementById("cookie-banner");
  const consent = localStorage.getItem("cookieConsent");

  // Si aucune décision => afficher la bannière
  if (!consent) {
    banner.classList.remove("hidden");
  }

  // Bouton ACCEPTER TOUT
  document.getElementById("cookie-accept").addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "accepted");

    // accepter tout
    localStorage.setItem("cookie_stats", "true");
    localStorage.setItem("cookie_marketing", "true");

    banner.classList.add("hidden");
    activateOptionalCookies();
  });

  // Bouton REFUSER TOUT
  document.getElementById("cookie-reject").addEventListener("click", () => {
    localStorage.setItem("cookieConsent", "rejected");

    // refuser tout sauf essentiels
    localStorage.setItem("cookie_stats", "false");
    localStorage.setItem("cookie_marketing", "false");

    banner.classList.add("hidden");
  });

  // Bouton PERSONNALISER → redirection vers la page cookies
  document.getElementById("cookie-customize").addEventListener("click", () => {
    window.location.href = "cookies.html";
  });

  // ➤ Active Google Analytics seulement si déjà accepté avant
  if (localStorage.getItem("cookie_stats") === "true") {
    activateOptionalCookies();
  }
});

/* ---------------------------------------------------------- */
/*        Active GA / Pixel / Marketing selon consentement     */
/* ---------------------------------------------------------- */
function activateOptionalCookies() {
  // Exemple : Google Analytics
  if (!document.getElementById("ga-script")) {
    const ga = document.createElement("script");
    ga.id = "ga-script";
    ga.async = true;
    ga.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX";
    document.head.appendChild(ga);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXX');
  }
}
