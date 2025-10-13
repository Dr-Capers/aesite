import termsHtml from '../legal/terms.html?raw';
import privacyHtml from '../legal/privacy.html?raw';

const PANEL_CONTENT = {
  terms: termsHtml,
  privacy: privacyHtml,
};

const FALLBACK_HTML =
  '<p class="legal-modal__error">Document unavailable.</p>';

export function getLegalContent(id) {
  return PANEL_CONTENT[id] ?? FALLBACK_HTML;
}
