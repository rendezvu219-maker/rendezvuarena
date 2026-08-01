const contactLinks = [...document.querySelectorAll('[data-public-contact]')];
const supportLinks = [...document.querySelectorAll('[data-public-support]')];
const contactFallbacks = [...document.querySelectorAll('[data-contact-fallback]')];

fetch('/api/public/site-config', { credentials: 'same-origin', cache: 'no-store' })
  .then(response => response.ok ? response.json() : {})
  .then(config => {
    if (config.contactEmail) {
      contactLinks.forEach(link => {
        link.href = `mailto:${config.contactEmail}`;
        link.textContent = config.contactEmail;
        link.hidden = false;
      });
      contactFallbacks.forEach(element => { element.hidden = true; });
    }
    if (config.supportUrl) {
      supportLinks.forEach(link => {
        link.href = config.supportUrl;
        link.hidden = false;
      });
      contactFallbacks.forEach(element => { element.hidden = true; });
    }
  })
  .catch(() => {});
