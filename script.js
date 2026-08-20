if (localStorage.getItem('dogcytocin_unlocked') === 'true') {
  const gate = document.getElementById('password-gate');
  if (gate) gate.style.display = 'none';
}

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

  const fosterForm = document.getElementById('foster-form');

  if (fosterForm) {
    const errorBlock = document.getElementById('foster-error');
    const successBlock = document.getElementById('foster-success');
    const submitBtn = document.getElementById('foster-submit');
    const animauxDetails = document.getElementById('autres-animaux-details');

    document.querySelectorAll('input[name="autres_animaux"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        animauxDetails.classList.toggle('open', radio.value === 'Oui');
        if (radio.value !== 'Oui') {
          document.getElementById('fa-animaux-details').value = '';
        }
      });
    });

    fosterForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (fosterForm.elements.botcheck.checked) {
        fosterForm.hidden = true;
        successBlock.hidden = false;
        return;
      }

      errorBlock.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      const payload = {};
      new FormData(fosterForm).forEach((value, key) => { payload[key] = value; });

      try {
        const response = await fetch(fosterForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('Réponse invalide');

        fosterForm.hidden = true;
        successBlock.hidden = false;
        successBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        errorBlock.textContent = "Une erreur est survenue lors de l'envoi. Merci de réessayer, ou de nous contacter directement.";
        errorBlock.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma candidature';
      }
    });
  }

  const filterPills = document.querySelectorAll('.filter-pill');
  const dogCards = document.querySelectorAll('.dog-card');
  const dogsEmpty = document.getElementById('dogs-empty');

  if (filterPills.length && dogCards.length) {
    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');

        const filter = pill.dataset.filter;
        let visibleCount = 0;

        dogCards.forEach((card) => {
          const show = filter === 'all' || card.dataset.status === filter;
          card.hidden = !show;
          if (show) visibleCount++;
        });

        if (dogsEmpty) dogsEmpty.hidden = visibleCount !== 0;
      });
    });
  }
});
