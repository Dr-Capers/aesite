import './styles.css';
import { initSignupForm } from './app.js';
import { initCharacter } from './character/index.js';
import { renderSite } from './siteV2.js';

document.addEventListener('DOMContentLoaded', () => {
  renderSite();
  initSignupForm();
  initCharacter();
});
