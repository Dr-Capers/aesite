import './styles.css';
import { initSignupForm } from './app.js';
import { initCharacter } from './character/index.js';
import { initFooterOtherPopover } from './ui/footerOther.js';
import { initLegalModal } from './ui/legalModal.js';
import { initQuizModal } from './ui/quizModal.js';
import { initThumbModal } from './ui/thumbModal.js';

// Kick off small interaction once DOM content is parsed.
document.addEventListener('DOMContentLoaded', () => {
  initSignupForm();
  initCharacter();
  initFooterOtherPopover();
  initLegalModal();
  initQuizModal();
  initThumbModal();
});
