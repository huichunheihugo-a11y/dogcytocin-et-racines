document.addEventListener('DOMContentLoaded', () => {
  const faders = document.querySelectorAll('.fade-in');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  faders.forEach((el) => observer.observe(el));

  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  const gateForm = document.getElementById('gate-form');
  const gate = document.getElementById('password-gate');

  if (gateForm && gate) {
    gateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('gate-password');
      const error = document.getElementById('gate-error');

      if (input.value === '123') {
        localStorage.setItem('dogcytocin_unlocked', 'true');
        gate.style.display = 'none';
      } else {
        error.hidden = false;
        input.value = '';
        input.focus();
      }
    });
  }
});
