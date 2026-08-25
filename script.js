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

  const adminList = document.getElementById('admin-list');

  if (adminList) {
    const passwordInput = document.getElementById('admin-password');
    const passwordToggle = document.getElementById('admin-password-toggle');
    const rememberBtn = document.getElementById('admin-remember');
    const authMsg = document.getElementById('admin-auth-msg');
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    passwordToggle.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      passwordToggle.textContent = showing ? '👁' : '🙈';
    });

    const storedPassword = () => sessionStorage.getItem('dogcytocin_admin_pw') || '';
    if (storedPassword()) passwordInput.value = storedPassword();

    const showActionMsg = (text, isError) => {
      authMsg.textContent = text;
      authMsg.className = 'admin-auth-msg ' + (isError ? 'is-error' : 'is-ok');
      authMsg.hidden = false;
    };

    // Si une action authentifiee echoue avec 401 en cours de route (mot de passe change, session obsolete),
    // on efface le mot de passe memorise et on redemande de valider, sans rien casser d'autre a l'ecran.
    const requireReauth = () => {
      sessionStorage.removeItem('dogcytocin_admin_pw');
      showActionMsg('Session expirée, ressaisis le mot de passe et clique sur Valider.', true);
    };

    async function verifyPassword(pw) {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'X-Admin-Password': pw },
      });
      const result = await response.json();
      return { ok: response.ok && result.success, message: result && result.message };
    }

    async function attemptLogin() {
      if (rememberBtn.disabled) return; // deja en cours
      const pw = passwordInput.value;
      rememberBtn.disabled = true;
      rememberBtn.textContent = 'Vérification...';

      try {
        const { ok, message } = await verifyPassword(pw);
        if (!ok) {
          showActionMsg(message || 'Mot de passe incorrect.', true);
          sessionStorage.removeItem('dogcytocin_admin_pw');
          return;
        }

        sessionStorage.setItem('dogcytocin_admin_pw', pw);
        showActionMsg('Mot de passe correct.', false);
        loadComments();
        loadRejected();
      } catch (err) {
        showActionMsg('Vérification impossible, réessaie.', true);
      } finally {
        rememberBtn.disabled = false;
        rememberBtn.textContent = 'Valider';
      }
    }

    // Deux points d'entree pour la meme action : la touche Entree dans le champ, et le clic sur Valider.
    rememberBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptLogin();
      }
    });

    // Reconnexion automatique si un mot de passe valide est deja memorise pour cette session de navigateur.
    (async () => {
      const pw = storedPassword();
      if (!pw) return;
      try {
        const { ok } = await verifyPassword(pw);
        if (ok) {
          loadComments();
          loadRejected();
        } else {
          sessionStorage.removeItem('dogcytocin_admin_pw');
        }
      } catch (err) {
        // Reste sur le formulaire si la verification echoue au chargement.
      }
    })();

    // Bascule entre les onglets "Livre d'or", "Messages refusés" et "Tri".
    const navLinks = document.querySelectorAll('.admin-nav-link');
    const tabs = document.querySelectorAll('.admin-tab');
    const tabTitle = document.getElementById('admin-tab-title');
    const tabLabels = { comments: "Livre d'or", rejected: 'Messages refusés', sort: 'Tri' };

    let currentSortOrder = 'desc';
    const sortButtons = document.querySelectorAll('.admin-sort-btn');

    sortButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const order = btn.dataset.order;
        if (order === currentSortOrder) return;
        currentSortOrder = order;
        sortButtons.forEach((b) => b.classList.toggle('active', b === btn));
        loadSortedComments(currentSortOrder);
      });
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        navLinks.forEach((l) => l.classList.toggle('active', l === link));
        tabs.forEach((t) => { t.hidden = t.id !== `admin-tab-${tab}`; });
        tabTitle.textContent = tabLabels[tab] || '';
        if (tab === 'sort') loadSortedComments(currentSortOrder);
      });
    });

    // Bouton "Supprimer" a deux clics : le premier arme, le second confirme (evite de dependre de confirm(), bloque par certains navigateurs/extensions).
    const createTwoStepButton = (label, onConfirm) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-delete-btn';
      btn.textContent = label;

      let confirmTimer = null;
      const reset = () => {
        clearTimeout(confirmTimer);
        confirmTimer = null;
        btn.classList.remove('confirming');
        btn.textContent = label;
      };

      btn.addEventListener('click', async () => {
        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        if (!btn.classList.contains('confirming')) {
          btn.classList.add('confirming');
          btn.textContent = 'Confirmer ?';
          confirmTimer = setTimeout(reset, 4000);
          return;
        }

        clearTimeout(confirmTimer);
        btn.disabled = true;
        btn.textContent = '...';

        try {
          await onConfirm(pw);
        } catch (err) {
          if (err.unauthorized) {
            requireReauth();
            return;
          }
          btn.disabled = false;
          reset();
          showActionMsg(err.message || "L'action a échoué, réessaie.", true);
        }
      });

      return btn;
    };

    const renderAdminEntry = (entry) => {
      const row = document.createElement('div');
      row.className = 'admin-entry';

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const name = document.createElement('span');
      name.className = 'admin-entry-name';
      name.textContent = entry.name;

      const date = document.createElement('span');
      date.className = 'admin-entry-date';
      date.textContent = dateFormatter.format(new Date(entry.created_at));

      head.appendChild(name);
      head.appendChild(date);

      const message = document.createElement('p');
      message.className = 'admin-entry-message';
      message.textContent = entry.message;

      body.appendChild(head);
      body.appendChild(message);

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/comments/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('La suppression a échoué, réessaie.');

        row.remove();
      });

      row.appendChild(body);
      row.appendChild(deleteBtn);
      return row;
    };

    const REJECTED_REASON_LABELS = {
      spam: 'Filtré : lien ou mot-clé publicitaire',
      invalid: 'Filtré : longueur invalide',
      inappropriate: 'Filtré : langage inapproprié',
    };

    const renderRejectedEntry = (entry) => {
      const row = document.createElement('div');
      row.className = 'admin-entry';

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const name = document.createElement('span');
      name.className = 'admin-entry-name';
      name.textContent = entry.name || '(sans nom)';

      const date = document.createElement('span');
      date.className = 'admin-entry-date';
      date.textContent = dateFormatter.format(new Date(entry.created_at));

      head.appendChild(name);
      head.appendChild(date);

      const reason = document.createElement('span');
      reason.className = 'admin-entry-reason';
      reason.textContent = REJECTED_REASON_LABELS[entry.reason] || entry.reason;

      const message = document.createElement('p');
      message.className = 'admin-entry-message';
      message.textContent = entry.message;

      body.appendChild(head);
      body.appendChild(reason);
      body.appendChild(message);

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';

      const approveBtn = document.createElement('button');
      approveBtn.type = 'button';
      approveBtn.className = 'admin-approve-btn';
      approveBtn.textContent = 'Publier quand même';

      approveBtn.addEventListener('click', async () => {
        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        approveBtn.disabled = true;
        approveBtn.textContent = '...';

        try {
          const response = await fetch(`/api/admin/rejected/${entry.id}/approve`, {
            method: 'POST',
            headers: { 'X-Admin-Password': pw },
          });

          if (response.status === 401) {
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error('publish failed');

          row.remove();
          if (result.comment) prependAdminComment(result.comment);
        } catch (err) {
          approveBtn.disabled = false;
          approveBtn.textContent = 'Publier quand même';
          showActionMsg('La publication a échoué, réessaie.', true);
        }
      });

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/admin/rejected/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('La suppression a échoué, réessaie.');

        row.remove();
      });

      actions.appendChild(approveBtn);
      actions.appendChild(deleteBtn);
      row.appendChild(body);
      row.appendChild(actions);
      return row;
    };

    function prependAdminComment(entry) {
      const emptyMsg = adminList.querySelector('.guestbook-empty');
      if (emptyMsg) emptyMsg.remove();
      adminList.prepend(renderAdminEntry(entry));
    }

    async function loadComments() {
      adminList.innerHTML = '<p class="guestbook-loading">Chargement des messages...</p>';
      try {
        const response = await fetch('/api/comments');
        const data = await response.json();
        adminList.innerHTML = '';

        if (!data.comments || data.comments.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucun message pour le moment.';
          adminList.appendChild(empty);
          return;
        }

        data.comments.forEach((entry) => adminList.appendChild(renderAdminEntry(entry)));
      } catch (err) {
        adminList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les messages.';
        adminList.appendChild(empty);
      }
    }

    async function loadRejected() {
      const rejectedList = document.getElementById('admin-rejected-list');
      const pw = storedPassword();
      if (!pw || !rejectedList) return;

      rejectedList.innerHTML = '<p class="guestbook-loading">Chargement...</p>';
      try {
        const response = await fetch('/api/admin/rejected', {
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) {
          requireReauth();
          return;
        }

        const data = await response.json();
        rejectedList.innerHTML = '';

        if (!data.rejected || data.rejected.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucun message refusé pour le moment.';
          rejectedList.appendChild(empty);
          return;
        }

        data.rejected.forEach((entry) => rejectedList.appendChild(renderRejectedEntry(entry)));
      } catch (err) {
        rejectedList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les messages refusés.';
        rejectedList.appendChild(empty);
      }
    }

    async function loadSortedComments(order) {
      const sortList = document.getElementById('admin-sort-list');
      if (!sortList) return;

      sortList.innerHTML = '<p class="guestbook-loading">Chargement des messages...</p>';
      try {
        const response = await fetch(`/api/comments?order=${order === 'asc' ? 'asc' : 'desc'}`);
        const data = await response.json();
        sortList.innerHTML = '';

        if (!data.comments || data.comments.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucun message pour le moment.';
          sortList.appendChild(empty);
          return;
        }

        data.comments.forEach((entry) => sortList.appendChild(renderAdminEntry(entry)));
      } catch (err) {
        sortList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les messages.';
        sortList.appendChild(empty);
      }
    }
  }
});
