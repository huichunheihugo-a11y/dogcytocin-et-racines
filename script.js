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
        errorBlock.textContent = "Aïe, l'envoi n'est pas passé. Réessayez, ou écrivez-nous directement — on ne veut surtout pas rater votre message.";
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

  const shareBtn = document.getElementById('share-btn');

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: 'Dogcytocin et Racines',
        text: 'Un refuge pour chiens en Bretagne où sauvetage, nature et lien humain se retrouvent.',
        url: window.location.origin + '/index.html',
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          /* Partage annulé par l'utilisateur, rien à faire. */
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(shareData.url);
        const original = shareBtn.textContent;
        shareBtn.textContent = 'Lien copié !';
        setTimeout(() => { shareBtn.textContent = original; }, 2200);
      } catch (err) {
        shareBtn.textContent = shareData.url;
      }
    });
  }

  const guestbookForm = document.getElementById('guestbook-form');

  if (guestbookForm) {
    const listEl = document.getElementById('guestbook-list');
    const loadingEl = document.getElementById('guestbook-loading');
    const countEl = document.getElementById('guestbook-count');
    const errorEl = document.getElementById('guestbook-error');
    const successEl = document.getElementById('guestbook-success');
    const submitBtn = document.getElementById('guestbook-submit');
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const renderEntry = (entry) => {
      const card = document.createElement('div');
      card.className = 'guestbook-entry fade-in visible';

      const top = document.createElement('div');
      top.className = 'guestbook-entry-top';

      const avatar = document.createElement('span');
      avatar.className = 'guestbook-avatar';
      avatar.textContent = entry.name.trim().charAt(0).toUpperCase();

      const head = document.createElement('div');
      head.className = 'guestbook-entry-head';

      const name = document.createElement('span');
      name.className = 'guestbook-entry-name';
      name.textContent = entry.name;

      const date = document.createElement('span');
      date.className = 'guestbook-entry-date';
      date.textContent = dateFormatter.format(new Date(entry.created_at));

      head.appendChild(name);
      head.appendChild(date);
      top.appendChild(avatar);
      top.appendChild(head);

      const message = document.createElement('p');
      message.className = 'guestbook-entry-message';
      message.textContent = entry.message;

      card.appendChild(top);
      card.appendChild(message);
      return card;
    };

    const showEmptyState = () => {
      if (document.getElementById('guestbook-empty')) return;
      const empty = document.createElement('p');
      empty.className = 'guestbook-empty';
      empty.id = 'guestbook-empty';
      empty.textContent = 'Soyez le premier à laisser un mot !';
      listEl.appendChild(empty);
    };

    const prependEntry = (entry) => {
      const emptyMsg = document.getElementById('guestbook-empty');
      if (emptyMsg) emptyMsg.remove();
      listEl.prepend(renderEntry(entry));
    };

    (async () => {
      try {
        const response = await fetch('/api/comments');
        const data = await response.json();
        if (loadingEl) loadingEl.remove();

        if (!data.comments || data.comments.length === 0) {
          showEmptyState();
          return;
        }

        countEl.hidden = false;
        countEl.textContent = data.comments.length > 1 ? `${data.comments.length} messages` : '1 message';
        data.comments.forEach((entry) => listEl.appendChild(renderEntry(entry)));
      } catch (err) {
        if (loadingEl) loadingEl.remove();
        showEmptyState();
      }
    })();

    guestbookForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (guestbookForm.elements.site_web.value) {
        guestbookForm.reset();
        return;
      }

      errorEl.hidden = true;
      successEl.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      const payload = {
        name: guestbookForm.elements.name.value,
        message: guestbookForm.elements.message.value,
        website: guestbookForm.elements.site_web.value,
      };

      try {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          errorEl.textContent = (result && result.message) || "Aïe, l'envoi n'est pas passé. Réessayez un peu plus tard.";
          errorEl.hidden = false;
          return;
        }

        guestbookForm.reset();
        successEl.hidden = false;
        if (result.comment) prependEntry(result.comment);
      } catch (err) {
        errorEl.textContent = "Aïe, l'envoi n'est pas passé. Réessayez un peu plus tard.";
        errorEl.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer mon message';
      }
    });
  }
});
