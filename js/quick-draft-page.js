import { HostSetup } from './host-setup.js?v=0.7.4-link-check';
import { t } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    window.hostSetup = new HostSetup();
  } catch (error) {
    console.error(error);
    const content = document.getElementById('setup-content');
    if (content) content.innerHTML = `<div class="empty-state"><span class="state-icon">!</span><h2>${t('setupCouldNotLoad').toUpperCase()}</h2><p>${String(error?.message || error)}</p></div>`;
  }
});
