import { initMobileMenu } from './mobile-menu.js';
import { initFAQ } from './faq.js';
import { initScrollAnimations } from './scroll-animations.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initFAQ();
  initScrollAnimations();
});
