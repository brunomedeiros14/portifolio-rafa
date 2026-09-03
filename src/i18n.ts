import type { I18NData, Language, Translations } from "./types";

export const I18N: I18NData = {
  pt: {
    "loader.label": "CARREGANDO ARQUIVO VISUAL",
    "nav.work": "PORTFÓLIO",
    "nav.projects": "PROJETOS",
    "nav.about": "SOBRE",
    "nav.contact": "CONTATO",
    "hero.label": "FOTÓGRAFO DE CASAMENTOS",
    "hero.tagline":
      "Especializado em registrar histórias de amor em casamentos e pré-wedding.",
    "hero.specialties": "CASAMENTOS / PRÉ-WEDDING / ENSAIOS",
    "hero.location": "BASED EM MINAS GERAIS, BRASIL",
    "hero.scroll": "ROLAR",
    "manifesto.text": "Fotografo o que acontece entre momentos.",
    "manifesto.sub": "O silêncio antes do sorriso. A luz antes da sombra.",
    "work.title": "PORTFÓLIO SELECIONADO",
    "carousel.title": "DESTAQUES",
    "projects.title": "PROJETOS",
    "projects.p1.desc":
      "Retratos explorando identidade, silêncio e gestos cotidianos.",
    "projects.p2.desc": "Arquitetura e o ritmo dos espaços construídos.",
    "projects.p3.desc":
      "Histórias de casamento contadas através da luz e intimidade.",
    "projects.view": "VER PROJETO →",
    "gallery.title": "GALERIA",
    "about.title": "SOBRE",
    "about.role": "Fotógrafo baseado em Minas Gerais, Brasil.",
    "about.bio1":
      "Com mais de uma década de experiência atrás da lente, sou especializado em capturar a essência autêntica dos meus temas — seja através de retratos, editorial ou trabalho documental.",
    "about.bio2":
      "Minha abordagem é enraizada na observação. Acredito que as fotografias mais poderosas nascem não da encenação, mas da paciência — esperando a luz certa, o gesto certo, o silêncio certo.",
    "about.bio3":
      "Cada projeto é uma colaboração. Cada imagem, uma conversa entre luz e emoção.",
    "about.years": "ANOS DE EXPERIÊNCIA",
    "about.projects_stat": "PROJETOS",
    "about.publications": "PUBLICAÇÕES",
    "clients.title": "CLIENTES SELECIONADOS",
    "clients.note": "* Clientes de exemplo para fins de demonstração",
    "contact.line1": "VAMOS CRIAR",
    "contact.line2": "ALGO",
    "contact.line3": "MEMORÁVEL.",
    "contact.email": "ENTRE EM CONTATO →",
    "contact.email_label": "E-MAIL",
    "contact.instagram_label": "INSTAGRAM",
    "contact.location_label": "LOCALIZAÇÃO",
    "footer.tagline": "Fotografia de casamentos e pré-wedding.",
    "footer.work": "PORTFÓLIO",
    "footer.projects": "PROJETOS",
    "footer.about": "SOBRE",
    "footer.contact": "CONTATO",
    "footer.top": "VOLTAR AO TOPO ↑",
  },
  en: {
    "loader.label": "LOADING VISUAL ARCHIVE",
    "nav.work": "WORK",
    "nav.projects": "PROJECTS",
    "nav.about": "ABOUT",
    "nav.contact": "CONTACT",
    "hero.label": "WEDDING PHOTOGRAPHER",
    "hero.tagline":
      "Specialized in telling love stories through weddings and pre-wedding sessions.",
    "hero.specialties": "WEDDINGS / PRE-WEDDING / SESSIONS",
    "hero.location": "BASED IN MINAS GERAIS, BRAZIL",
    "hero.scroll": "SCROLL",
    "manifesto.text": "I photograph what happens between moments.",
    "manifesto.sub":
      "The silence before the smile. The light before the shadow.",
    "work.title": "SELECTED WORK",
    "carousel.title": "FEATURED",
    "projects.title": "PROJECTS",
    "projects.p1.desc":
      "Portraits exploring identity, silence and everyday gestures.",
    "projects.p2.desc": "Architecture and the rhythm of built spaces.",
    "projects.p3.desc": "Wedding stories told through light and intimacy.",
    "projects.view": "VIEW PROJECT →",
    "gallery.title": "GALLERY",
    "about.title": "ABOUT",
    "about.role": "Photographer based in Minas Gerais, Brazil.",
    "about.bio1":
      "With over a decade of experience behind the lens, I specialize in capturing the authentic essence of my subjects — whether through portraiture, editorial, or documentary work.",
    "about.bio2":
      "My approach is rooted in observation. I believe the most powerful photographs are born not from staging, but from patience — waiting for the right light, the right gesture, the right silence.",
    "about.bio3":
      "Every project is a collaboration. Every image, a conversation between light and emotion.",
    "about.years": "YEARS EXPERIENCE",
    "about.projects_stat": "PROJECTS",
    "about.publications": "PUBLICATIONS",
    "clients.title": "SELECTED CLIENTS",
    "clients.note": "* Example clients for demonstration purposes",
    "contact.line1": "LET'S CREATE",
    "contact.line2": "SOMETHING",
    "contact.line3": "MEMORABLE.",
    "contact.email": "GET IN TOUCH →",
    "contact.email_label": "EMAIL",
    "contact.instagram_label": "INSTAGRAM",
    "contact.location_label": "LOCATION",
    "footer.tagline": "Wedding and pre-wedding photography.",
    "footer.work": "WORK",
    "footer.projects": "PROJECTS",
    "footer.about": "ABOUT",
    "footer.contact": "CONTACT",
    "footer.top": "BACK TO TOP ↑",
  },
};

export function applyLang(lang: Language): void {
  document.documentElement.setAttribute("data-lang", lang);
  document.documentElement.setAttribute("lang", lang);

  const translations: Translations = I18N[lang];
  if (!translations) return;

  applyManifesto(translations);

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && translations[key]) {
      el.textContent = translations[key];
    }
  });

  document.querySelectorAll(".nav__lang-en").forEach((el) => {
    el.classList.toggle("active", lang === "en");
  });
  document.querySelectorAll(".nav__lang-pt").forEach((el) => {
    el.classList.toggle("active", lang === "pt");
  });
}

function applyManifesto(translations: Translations): void {
  const text = translations["manifesto.text"];
  const manifestoText = document.querySelector<HTMLElement>(".manifesto__text");
  if (!text || !manifestoText) return;

  manifestoText
    .querySelectorAll<HTMLElement>(".manifesto__word")
    .forEach((w) => {
      w.classList.remove("is-visible");
    });

  const words = text.split(" ");
  manifestoText.innerHTML = words
    .map((word) => `<span class="manifesto__word">${word}</span>`)
    .join(" ");

  if (manifestoAlreadyRevealed()) {
    manifestoText
      .querySelectorAll(".manifesto__word")
      .forEach((w) => w.classList.add("is-visible"));
  }
}

function manifestoAlreadyRevealed(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return true;
  const manifesto = document.getElementById("manifesto");
  if (manifesto) {
    const rect = manifesto.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return true;
  }
  return (window as any).__manifestoRevealed === true;
}

export function initI18n(): void {
  let currentLang: Language = "pt";

  applyLang(currentLang);

  const langToggle = document.getElementById("lang-toggle");
  const langToggleMobile = document.getElementById("lang-toggle-mobile");

  function toggleLang(): void {
    currentLang = currentLang === "en" ? "pt" : "en";
    applyLang(currentLang);
  }

  langToggle?.addEventListener("click", toggleLang);
  langToggleMobile?.addEventListener("click", toggleLang);
}
