export function initScrollAnimations() {
  const faders = document.querySelectorAll('.fade');
  const navbar = document.querySelector('.navbar');
  
  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      if (navbar) navbar.classList.add('scrolled');
    } else {
      if (navbar) navbar.classList.remove('scrolled');
    }
  });

  // Intersection Observer for fade-in
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: "0px 0px -50px 0px"
    });

    faders.forEach(el => observer.observe(el));
  } else {
    faders.forEach(el => el.classList.add('show'));
  }
}
