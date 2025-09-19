import './styles.css';
import { initSignupForm } from './app.js';
import { initCharacter } from './character/index.js';

// Kick off small interaction once DOM content is parsed.
document.addEventListener('DOMContentLoaded', () => {
  initSignupForm();
  initCharacter();
});
