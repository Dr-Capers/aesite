import './styles.css';
import './home.css';
import { initBrand } from './brand.js';
import { initSignupForm } from './app.js';
import { initCharacter } from './character/index.js';
import { renderSite } from './siteV2.js';

document.addEventListener('DOMContentLoaded', () => {
  renderSite();
  initSignupForm();
  const character = initCharacter();
  initBrand(character);
});
