document.addEventListener('DOMContentLoaded', () => {
  // .fade-in est visible par defaut en CSS desormais (voir style.css) -- .visible ne fait
  // plus qu'ajouter une transition ; simple ajout immediat, plus besoin d'IntersectionObserver
  // ni de logique de secours puisque rien ne depend plus du JS pour etre visible.
  document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('visible'));

  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    const applyScrolledState = () => {
      siteHeader.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    applyScrolledState();
    window.addEventListener('scroll', applyScrolledState, { passive: true });
  }

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

  const galleryGrid = document.getElementById('gallery-grid');
  const lightbox = document.getElementById('gallery-lightbox');

  if (galleryGrid && lightbox) {
    const lightboxImg = document.getElementById('gallery-lightbox-img');
    const lightboxCaption = document.getElementById('gallery-lightbox-caption');
    const lightboxClose = document.getElementById('gallery-lightbox-close');

    const openLightbox = (item) => {
      lightboxImg.src = item.dataset.full;
      lightboxImg.alt = item.dataset.caption || '';
      lightboxCaption.textContent = item.dataset.caption || '';
      lightbox.hidden = false;
      // Deux rAF imbriques : laisse le navigateur peindre l'etat de depart (opacity: 0)
      // avant d'ajouter la classe qui declenche la transition CSS vers opacity: 1 -- sans
      // ce detour, retirer [hidden] et ajouter la classe dans le meme tick saute la transition.
      requestAnimationFrame(() => requestAnimationFrame(() => lightbox.classList.add('is-visible')));
    };

    const closeLightbox = () => {
      lightbox.classList.remove('is-visible');
      window.setTimeout(() => { lightbox.hidden = true; lightboxImg.src = ''; }, 250);
    };

    galleryGrid.querySelectorAll('.gallery-item').forEach((item) => {
      item.addEventListener('click', () => openLightbox(item));
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
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
        errorBlock.textContent = "Aïe, l'envoi n'est pas passé. Réessayez, ou écrivez-nous directement, on ne veut surtout pas rater votre message.";
        errorBlock.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma candidature';
      }
    });
  }

  const volunteerForm = document.getElementById('volunteer-form');

  if (volunteerForm) {
    const errorBlock = document.getElementById('volunteer-error');
    const successBlock = document.getElementById('volunteer-success');
    const submitBtn = document.getElementById('volunteer-submit');

    volunteerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (volunteerForm.elements.botcheck.checked) {
        volunteerForm.hidden = true;
        successBlock.hidden = false;
        return;
      }

      errorBlock.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      const payload = {};
      new FormData(volunteerForm).forEach((value, key) => { payload[key] = value; });

      try {
        const response = await fetch(volunteerForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('Réponse invalide');

        volunteerForm.hidden = true;
        successBlock.hidden = false;
        successBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        errorBlock.textContent = "Aïe, l'envoi n'est pas passé. Réessayez, ou écrivez-nous directement, on ne veut surtout pas rater votre message.";
        errorBlock.hidden = false;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer ma candidature';
      }
    });
  }

  const dogsGrid = document.getElementById('dogs-grid');

  if (dogsGrid) {
    const dogsLoading = document.getElementById('dogs-loading');
    const dogsEmpty = document.getElementById('dogs-empty');
    const filterPills = document.querySelectorAll('.filter-pill');
    const DOG_STATUS_STAMP = {
      adoption: '<span class="dog-stamp">À<br>l\'adoption</span>',
      bientot: '<span class="dog-badge"><svg viewBox=\'0 0 24 24\' fill=\'none\' stroke-width=\'1.8\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'12\' cy=\'12\' r=\'9\'/><path d=\'M12 7v5l3.5 2\'/></svg> Bientôt</span>',
    };

    const renderDogCard = (dog) => {
      const article = document.createElement('article');
      article.className = 'dog-card fade-in visible';
      article.dataset.status = dog.status;

      const photo = document.createElement('div');
      photo.className = 'dog-photo';

      const placeholder = document.createElement('div');
      placeholder.className = 'dog-photo-placeholder';
      const img = document.createElement('img');
      img.alt = '';
      // .dog-silhouette est pensee pour l'illustration de substitution en filigrane (opacite
      // reduite, effet multiply) -- une vraie photo doit s'afficher pleine opacite (.dog-photo-img).
      if (dog.image_url) {
        img.src = dog.image_url;
        img.className = 'dog-photo-img';
      } else {
        img.src = 'images/chien-silhouette.jpg';
        img.className = 'dog-silhouette';
      }
      placeholder.appendChild(img);
      photo.appendChild(placeholder);
      photo.insertAdjacentHTML('beforeend', DOG_STATUS_STAMP[dog.status] || '');

      const info = document.createElement('div');
      info.className = 'dog-info';
      const name = document.createElement('h3');
      name.textContent = dog.name;
      const meta = document.createElement('p');
      meta.className = 'dog-meta';
      meta.textContent = `${dog.age} · ${dog.size}`;
      const quote = document.createElement('p');
      quote.className = 'dog-quote';
      quote.textContent = dog.description;
      info.appendChild(name);
      info.appendChild(meta);
      info.appendChild(quote);

      article.appendChild(photo);
      article.appendChild(info);
      return article;
    };

    // Le filtrage cherche les cartes a chaque clic (plutot qu'une seule fois au chargement) car
    // elles sont ajoutees de facon asynchrone apres la reponse de /api/dogs.
    const wireDogFilters = () => {
      if (!filterPills.length) return;
      filterPills.forEach((pill) => {
        pill.addEventListener('click', () => {
          filterPills.forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');

          const filter = pill.dataset.filter;
          const dogCards = dogsGrid.querySelectorAll('.dog-card');
          let visibleCount = 0;

          dogCards.forEach((card) => {
            const show = filter === 'all' || card.dataset.status === filter;
            card.hidden = !show;
            if (show) visibleCount++;
          });

          if (dogsEmpty) dogsEmpty.hidden = visibleCount !== 0;
        });
      });
    };

    (async () => {
      try {
        const response = await fetch('/api/dogs');
        const data = await response.json();
        if (dogsLoading) dogsLoading.remove();

        if (!data.dogs || data.dogs.length === 0) {
          if (dogsEmpty) dogsEmpty.hidden = false;
          return;
        }

        data.dogs.forEach((dog) => dogsGrid.appendChild(renderDogCard(dog)));
        wireDogFilters();
      } catch (err) {
        if (dogsLoading) dogsLoading.remove();
        if (dogsEmpty) dogsEmpty.hidden = false;
      }
    })();
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
    const messageInput = document.getElementById('gb-message');
    const messageCountEl = document.getElementById('gb-message-count');
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const MESSAGE_MAX_LENGTH = 300;

    const updateMessageCount = () => {
      const length = messageInput.value.length;
      messageCountEl.textContent = `${length}/${MESSAGE_MAX_LENGTH} caractères`;
      messageCountEl.classList.toggle('is-near-limit', length >= MESSAGE_MAX_LENGTH * 0.9 && length <= MESSAGE_MAX_LENGTH);
      messageCountEl.classList.toggle('is-over-limit', length > MESSAGE_MAX_LENGTH);
    };

    messageInput.addEventListener('input', updateMessageCount);
    updateMessageCount();

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

      if (entry.reply_message) {
        const reply = document.createElement('div');
        reply.className = 'guestbook-reply';

        const badge = document.createElement('span');
        badge.className = 'guestbook-reply-badge';
        badge.textContent = 'Réponse de Dogcytocin';

        const replyMessage = document.createElement('p');
        replyMessage.className = 'guestbook-reply-message';
        replyMessage.textContent = entry.reply_message;

        reply.appendChild(badge);
        reply.appendChild(replyMessage);
        card.appendChild(reply);
      }

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

      if (messageInput.value.length > MESSAGE_MAX_LENGTH) {
        errorEl.textContent = `Votre message dépasse la limite de ${MESSAGE_MAX_LENGTH} caractères, merci de le raccourcir.`;
        errorEl.hidden = false;
        return;
      }

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
        updateMessageCount();
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

  const blogFeedList = document.getElementById('blog-feed-list');

  if (blogFeedList) {
    const blogFeedLoading = document.getElementById('blog-feed-loading');
    const blogFeedEmpty = document.getElementById('blog-feed-empty');
    const blogDateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    const renderBlogPost = (post) => {
      const article = document.createElement('article');
      article.className = 'blog-post fade-in visible';

      if (post.image_url) {
        const media = document.createElement('div');
        media.className = 'blog-post-media';
        const img = document.createElement('img');
        img.src = post.image_url;
        img.alt = '';
        media.appendChild(img);
        article.appendChild(media);
      }

      const body = document.createElement('div');
      body.className = 'blog-post-body';

      const date = document.createElement('p');
      date.className = 'blog-post-date';
      date.textContent = blogDateFormatter.format(new Date(post.created_at));

      const title = document.createElement('h2');
      title.textContent = post.title;

      const content = document.createElement('p');
      content.className = 'blog-post-content';
      content.textContent = post.content;

      body.appendChild(date);
      body.appendChild(title);
      body.appendChild(content);
      article.appendChild(body);

      return article;
    };

    (async () => {
      try {
        const response = await fetch('/api/blog-posts');
        const data = await response.json();
        if (blogFeedLoading) blogFeedLoading.remove();

        if (!data.posts || data.posts.length === 0) {
          if (blogFeedEmpty) blogFeedEmpty.hidden = false;
          return;
        }

        data.posts.forEach((post) => blogFeedList.appendChild(renderBlogPost(post)));
      } catch (err) {
        if (blogFeedLoading) blogFeedLoading.remove();
        if (blogFeedEmpty) blogFeedEmpty.hidden = false;
      }
    })();
  }

  const adminList = document.getElementById('admin-list');

  if (adminList) {
    const passwordInput = document.getElementById('admin-password');
    const passwordToggle = document.getElementById('admin-password-toggle');
    const passwordToggleIcon = document.getElementById('admin-password-toggle-icon');
    const passwordToggleLabel = document.getElementById('admin-password-toggle-label');
    const rememberBtn = document.getElementById('admin-remember');
    const authMsg = document.getElementById('admin-auth-msg');
    const authForm = document.getElementById('admin-auth-form');
    const authConnected = document.getElementById('admin-auth-connected');
    const logoutBtn = document.getElementById('admin-logout');
    const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const EYE_OPEN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_OFF_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

    passwordToggle.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      passwordToggleIcon.innerHTML = showing ? EYE_OPEN_ICON : EYE_OFF_ICON;
      passwordToggleLabel.textContent = showing ? 'Afficher' : 'Masquer';
      passwordToggle.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
    });

    const storedPassword = () => sessionStorage.getItem('dogcytocin_admin_pw') || '';
    if (storedPassword()) passwordInput.value = storedPassword();

    const showActionMsg = (text, isError) => {
      authMsg.textContent = text;
      authMsg.className = 'admin-auth-msg ' + (isError ? 'is-error' : 'is-ok');
      authMsg.hidden = false;
    };

    // Bascule l'affichage entre "connecte" (badge + deconnexion) et le formulaire de mot de passe --
    // pour que ce qui est visible a l'ecran corresponde toujours a l'etat reel de la session, plutot
    // que de laisser un champ mot de passe vide a cote d'une liste de messages deja chargee.
    const showConnectedState = () => {
      authForm.hidden = true;
      authConnected.hidden = false;
      const blogLocked = document.getElementById('admin-blog-locked-msg');
      const blogAuthed = document.getElementById('admin-blog-authed');
      if (blogLocked) blogLocked.hidden = true;
      if (blogAuthed) blogAuthed.hidden = false;
      const dogsLocked = document.getElementById('admin-dogs-locked-msg');
      const dogsAuthed = document.getElementById('admin-dogs-authed');
      if (dogsLocked) dogsLocked.hidden = true;
      if (dogsAuthed) dogsAuthed.hidden = false;
    };

    const showLoginForm = () => {
      authForm.hidden = false;
      authConnected.hidden = true;
      const blogLocked = document.getElementById('admin-blog-locked-msg');
      const blogAuthed = document.getElementById('admin-blog-authed');
      if (blogLocked) blogLocked.hidden = false;
      if (blogAuthed) blogAuthed.hidden = true;
      const dogsLocked = document.getElementById('admin-dogs-locked-msg');
      const dogsAuthed = document.getElementById('admin-dogs-authed');
      if (dogsLocked) dogsLocked.hidden = false;
      if (dogsAuthed) dogsAuthed.hidden = true;
    };

    // Vide les listes et les stats affichees, pour ne rien laisser visible d'une session terminee.
    const clearAdminContent = () => {
      adminList.innerHTML = '';
      const rejectedList = document.getElementById('admin-rejected-list');
      if (rejectedList) rejectedList.innerHTML = '';
      const statsContent = document.getElementById('admin-stats-content');
      if (statsContent) statsContent.innerHTML = '';
      const fosterList = document.getElementById('admin-foster-list');
      if (fosterList) fosterList.innerHTML = '';
      const fosterBadgeEl = document.getElementById('admin-foster-badge');
      if (fosterBadgeEl) fosterBadgeEl.hidden = true;
      const blogListEl = document.getElementById('admin-blog-list');
      if (blogListEl) blogListEl.innerHTML = '';
      resetBlogForm();
      const dogListEl = document.getElementById('admin-dog-list');
      if (dogListEl) dogListEl.innerHTML = '';
      resetDogForm();
    };

    // Si une action authentifiee echoue avec 401 en cours de route (mot de passe change, session obsolete),
    // on efface le mot de passe memorise et on redemande de valider, sans rien casser d'autre a l'ecran.
    const requireReauth = () => {
      sessionStorage.removeItem('dogcytocin_admin_pw');
      passwordInput.value = '';
      showLoginForm();
      clearAdminContent();
      showActionMsg('Session expirée, ressaisis le mot de passe et clique sur Valider.', true);
    };

    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('dogcytocin_admin_pw');
      passwordInput.value = '';
      showLoginForm();
      clearAdminContent();
      authMsg.hidden = true;
    });

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
        showConnectedState();
        loadComments(currentSortOrder);
        loadRejected();
        loadStats();
        loadFosterApplications();
        loadVolunteerApplications();
        loadBlogPosts();
        loadDogs();
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
          showConnectedState();
          loadComments(currentSortOrder);
          loadRejected();
          loadStats();
          loadFosterApplications();
          loadBlogPosts();
          loadDogs();
        } else {
          sessionStorage.removeItem('dogcytocin_admin_pw');
          passwordInput.value = '';
        }
      } catch (err) {
        // Reste sur le formulaire si la verification echoue au chargement.
      }
    })();

    // Ordre d'affichage des messages du "Livre d'or" (bouton actif = ordre courant).
    let currentSortOrder = 'desc';
    const sortButtons = document.querySelectorAll('.admin-sort-btn');

    sortButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!storedPassword()) return;
        const order = btn.dataset.order;
        if (order === currentSortOrder) return;
        currentSortOrder = order;
        sortButtons.forEach((b) => b.classList.toggle('active', b === btn));
        loadComments(currentSortOrder);
      });
    });

    // Filtre par statut des candidatures famille d'accueil -- purement cote client (les
    // candidatures sont deja toutes chargees), pas besoin de refaire une requete au clic.
    let currentFosterFilter = 'all';
    const fosterFilterButtons = document.querySelectorAll('.admin-status-filter-btn');

    const applyFosterFilterToRow = (row) => {
      row.hidden = currentFosterFilter !== 'all' && row.dataset.status !== currentFosterFilter;
    };

    const fosterBadge = document.getElementById('admin-foster-badge');
    const updateFosterBadge = () => {
      if (!fosterBadge) return;
      const fosterList = document.getElementById('admin-foster-list');
      const count = fosterList ? fosterList.querySelectorAll('.admin-entry[data-status="nouvelle"]').length : 0;
      fosterBadge.textContent = String(count);
      fosterBadge.hidden = count === 0;
    };

    fosterFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!storedPassword()) return;
        currentFosterFilter = btn.dataset.statusFilter;
        fosterFilterButtons.forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('#admin-foster-list .admin-entry').forEach(applyFosterFilterToRow);
      });
    });

    // Bascule entre les onglets principaux "Commentaires" et "Messages refusés".
    const navLinks = document.querySelectorAll('.admin-nav-link');
    const tabs = document.querySelectorAll('.admin-tab');
    const tabTitle = document.getElementById('admin-tab-title');
    const tabLabels = { comments: 'Commentaires', foster: "Familles d'accueil", benevoles: 'Bénévoles', dogs: 'Nos chiens', blog: 'Blog', rejected: 'Messages refusés' };

    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = link.dataset.tab;
        navLinks.forEach((l) => l.classList.toggle('active', l === link));
        tabs.forEach((t) => { t.hidden = t.id !== `admin-tab-${tab}`; });
        tabTitle.textContent = tabLabels[tab] || '';
      });
    });

    // Bascule entre les sous-onglets "Liste des messages" et "Statistiques" a l'interieur
    // de l'onglet "Commentaires" -- aucun rechargement, juste un affichage/masquage local.
    const subtabButtons = document.querySelectorAll('.admin-subtab-btn');
    const subtabPanels = document.querySelectorAll('.admin-subtab-panel');

    subtabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const subtab = btn.dataset.subtab;
        subtabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        subtabPanels.forEach((p) => { p.hidden = p.id !== `admin-subtab-${subtab}`; });
      });
    });

    // Compresse une photo choisie depuis la galerie du telephone/ordinateur avant l'envoi : on
    // redimensionne et on reencode systematiquement en JPEG (perd la transparence eventuelle d'un
    // PNG, acceptable pour des photos) pour rester tres en dessous de la limite serveur, elle-meme
    // sous la limite de 2 Mo/ligne de D1. Renvoie {base64, mime} ; rejette avec un message clair.
    //
    // Pas de verification du type MIME en amont : les photos prises par un iPhone sont souvent au
    // format HEIC, et Safari/Chrome mobile rapportent parfois un type incoherent ou vide pour une
    // photo choisie dans la galerie -- rejeter sur la seule base de file.type provoquait de faux
    // refus. On tente directement le decodage, avec deux methodes pour maximiser la compatibilite.
    const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
    const IMAGE_UPLOAD_TARGET_BYTES = 1_000_000;

    // Decode le fichier en une image dessinable. createImageBitmap() gere plus de formats/cas
    // limites sur mobile (notamment certains HEIC) ; on retombe sur <img>+URL.createObjectURL()
    // si indisponible ou en echec, pour couvrir les navigateurs plus anciens.
    async function decodeImageFile(file) {
      if (typeof createImageBitmap === 'function') {
        try {
          return await createImageBitmap(file);
        } catch (err) {
          // Continue avec la methode de secours ci-dessous.
        }
      }

      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('decode-failed')); };
        img.src = objectUrl;
      });
    }

    function compressImageFile(file) {
      return decodeImageFile(file)
        .then((source) => {
          const sourceWidth = source.naturalWidth || source.width;
          const sourceHeight = source.naturalHeight || source.height;
          const scale = Math.min(1, IMAGE_UPLOAD_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(sourceWidth * scale);
          canvas.height = Math.round(sourceHeight * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
          if (source.close) source.close();

          return new Promise((resolve, reject) => {
            const qualities = [0.85, 0.7, 0.55, 0.4];
            const tryQuality = (i) => {
              canvas.toBlob((blob) => {
                if (!blob) {
                  reject(new Error("Impossible de traiter cette image, réessaie avec une autre photo."));
                  return;
                }
                if (blob.size > IMAGE_UPLOAD_TARGET_BYTES && i < qualities.length - 1) {
                  tryQuality(i + 1);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => resolve({ base64: reader.result.split(',')[1], mime: 'image/jpeg' });
                reader.onerror = () => reject(new Error("Impossible de lire cette image, réessaie."));
                reader.readAsDataURL(blob);
              }, 'image/jpeg', qualities[i]);
            };
            tryQuality(0);
          });
        })
        .catch(() => {
          throw new Error("Cette photo n'a pas pu être lue, si elle vient d'un iPhone au format HEIC, essaie de la convertir en JPEG avant l'envoi (ou choisis une autre photo).");
        });
    }

    async function uploadMediaFile(file, pw) {
      const { base64, mime } = await compressImageFile(file);

      const response = await fetch('/api/admin/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
        body: JSON.stringify({ data: base64, mime }),
      });

      if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "L'envoi de la photo a échoué, réessaie.");

      return result.url;
    }

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

      let replyPreview = null;
      const renderReplyPreview = () => {
        if (replyPreview) {
          replyPreview.remove();
          replyPreview = null;
        }
        if (!entry.reply_message) return;

        replyPreview = document.createElement('div');
        replyPreview.className = 'admin-reply-preview';

        const badge = document.createElement('span');
        badge.className = 'admin-reply-badge';
        badge.textContent = 'Réponse de Dogcytocin';

        const text = document.createElement('p');
        text.className = 'admin-reply-preview-message';
        text.textContent = entry.reply_message;

        replyPreview.appendChild(badge);
        replyPreview.appendChild(text);
        body.insertBefore(replyPreview, replyForm);
      };

      const replyForm = document.createElement('div');
      replyForm.className = 'admin-reply-form';
      replyForm.hidden = true;

      const replyTextarea = document.createElement('textarea');
      replyTextarea.className = 'admin-reply-textarea field';
      replyTextarea.placeholder = 'Écris une réponse publique à ce message...';
      replyTextarea.maxLength = 1000;
      replyTextarea.rows = 2;

      const replyActions = document.createElement('div');
      replyActions.className = 'admin-reply-actions';

      const sendReplyBtn = document.createElement('button');
      sendReplyBtn.type = 'button';
      sendReplyBtn.className = 'admin-approve-btn';
      sendReplyBtn.textContent = 'Envoyer la réponse';

      const cancelReplyBtn = document.createElement('button');
      cancelReplyBtn.type = 'button';
      cancelReplyBtn.className = 'admin-reply-cancel-btn';
      cancelReplyBtn.textContent = 'Annuler';

      replyActions.appendChild(sendReplyBtn);
      replyActions.appendChild(cancelReplyBtn);
      replyForm.appendChild(replyTextarea);
      replyForm.appendChild(replyActions);

      body.appendChild(replyForm);
      renderReplyPreview();

      const replyToggleBtn = document.createElement('button');
      replyToggleBtn.type = 'button';
      replyToggleBtn.className = 'admin-reply-toggle-btn';
      replyToggleBtn.textContent = entry.reply_message ? 'Modifier la réponse' : 'Répondre';

      // Le formulaire remplace l'aperçu pendant l'edition (evite d'afficher deux fois le meme
      // texte -- l'aperçu revient des que le formulaire se referme).
      replyToggleBtn.addEventListener('click', () => {
        replyForm.hidden = !replyForm.hidden;
        if (replyPreview) replyPreview.hidden = !replyForm.hidden;
        if (!replyForm.hidden) {
          replyTextarea.value = entry.reply_message || '';
          replyTextarea.focus();
        }
      });

      cancelReplyBtn.addEventListener('click', () => {
        replyForm.hidden = true;
        if (replyPreview) replyPreview.hidden = false;
      });

      sendReplyBtn.addEventListener('click', async () => {
        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        const text = replyTextarea.value.trim();
        sendReplyBtn.disabled = true;
        sendReplyBtn.textContent = 'Envoi...';

        try {
          const response = await fetch(`/api/comments/${entry.id}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
            body: JSON.stringify({ reply: text }),
          });

          if (response.status === 401) {
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error(result.message || 'échec');

          entry.reply_message = result.reply ? result.reply.message : null;
          renderReplyPreview();
          replyForm.hidden = true;
          replyToggleBtn.textContent = entry.reply_message ? 'Modifier la réponse' : 'Répondre';
        } catch (err) {
          showActionMsg("L'envoi de la réponse a échoué, réessaie.", true);
        } finally {
          sendReplyBtn.disabled = false;
          sendReplyBtn.textContent = 'Envoyer la réponse';
        }
      });

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

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';
      actions.appendChild(replyToggleBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(body);
      row.appendChild(actions);
      return row;
    };

    const FOSTER_STATUS_LABELS = {
      nouvelle: 'Nouvelle',
      en_cours: 'En cours',
      acceptee: 'Acceptée',
      refusee: 'Refusée',
    };

    const renderFosterEntry = (entry) => {
      const row = document.createElement('div');
      row.className = 'admin-entry';
      row.dataset.status = entry.status;

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const name = document.createElement('span');
      name.className = 'admin-entry-name';
      name.textContent = entry.nom_complet;

      const date = document.createElement('span');
      date.className = 'admin-entry-date';
      date.textContent = dateFormatter.format(new Date(entry.created_at));

      head.appendChild(name);
      head.appendChild(date);

      const contact = document.createElement('p');
      contact.className = 'admin-foster-contact';
      contact.textContent = `${entry.telephone} · ${entry.email}`;

      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'admin-foster-chips';

      const chipTexts = [
        entry.type_logement,
        entry.autres_animaux === 'Oui' && entry.details_autres_animaux
          ? `Animaux : ${entry.autres_animaux} (${entry.details_autres_animaux})`
          : `Animaux : ${entry.autres_animaux}`,
        `Enfants en bas âge : ${entry.enfants_bas_age}`,
        `Disponibilité : ${entry.duree_disponibilite}`,
      ];
      chipTexts.forEach((text) => {
        const chip = document.createElement('span');
        chip.className = 'admin-foster-chip';
        chip.textContent = text;
        chipsWrap.appendChild(chip);
      });

      const experience = document.createElement('div');
      experience.className = 'admin-foster-text';
      const experienceLabel = document.createElement('span');
      experienceLabel.className = 'admin-foster-text-label';
      experienceLabel.textContent = 'Expérience';
      const experienceValue = document.createElement('p');
      experienceValue.textContent = entry.experience_animaux;
      experience.appendChild(experienceLabel);
      experience.appendChild(experienceValue);

      const motivation = document.createElement('div');
      motivation.className = 'admin-foster-text';
      const motivationLabel = document.createElement('span');
      motivationLabel.className = 'admin-foster-text-label';
      motivationLabel.textContent = 'Motivation';
      const motivationValue = document.createElement('p');
      motivationValue.textContent = entry.motivation;
      motivation.appendChild(motivationLabel);
      motivation.appendChild(motivationValue);

      const notesBlock = document.createElement('div');
      notesBlock.className = 'admin-foster-notes';

      const notesLabel = document.createElement('label');
      notesLabel.className = 'admin-foster-text-label';
      notesLabel.textContent = "Note interne (visible seulement par l'équipe)";

      const notesTextarea = document.createElement('textarea');
      notesTextarea.className = 'admin-foster-notes-textarea field';
      notesTextarea.placeholder = 'Ex. Appelé le 12/09, très motivé...';
      notesTextarea.rows = 2;
      notesTextarea.maxLength = 2000;
      notesTextarea.value = entry.notes || '';

      const saveNotesBtn = document.createElement('button');
      saveNotesBtn.type = 'button';
      saveNotesBtn.className = 'admin-foster-notes-save';
      saveNotesBtn.textContent = 'Enregistrer la note';

      saveNotesBtn.addEventListener('click', async () => {
        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        saveNotesBtn.disabled = true;
        saveNotesBtn.textContent = 'Enregistrement...';

        try {
          const response = await fetch(`/api/admin/foster-applications/${entry.id}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
            body: JSON.stringify({ notes: notesTextarea.value }),
          });

          if (response.status === 401) {
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error('échec');

          entry.notes = notesTextarea.value.trim();
          saveNotesBtn.textContent = 'Enregistré ✓';
          setTimeout(() => { saveNotesBtn.textContent = 'Enregistrer la note'; }, 2000);
        } catch (err) {
          showActionMsg("L'enregistrement de la note a échoué, réessaie.", true);
          saveNotesBtn.textContent = 'Enregistrer la note';
        } finally {
          saveNotesBtn.disabled = false;
        }
      });

      notesBlock.appendChild(notesLabel);
      notesBlock.appendChild(notesTextarea);
      notesBlock.appendChild(saveNotesBtn);

      body.appendChild(head);
      body.appendChild(contact);
      body.appendChild(chipsWrap);
      body.appendChild(experience);
      body.appendChild(motivation);
      body.appendChild(notesBlock);

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';

      const statusSelect = document.createElement('select');
      statusSelect.className = 'admin-foster-status field';
      Object.entries(FOSTER_STATUS_LABELS).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (value === entry.status) option.selected = true;
        statusSelect.appendChild(option);
      });
      statusSelect.dataset.status = entry.status;

      statusSelect.addEventListener('change', async () => {
        const pw = storedPassword();
        if (!pw) {
          statusSelect.value = entry.status;
          requireReauth();
          return;
        }

        const newStatus = statusSelect.value;
        const previousStatus = entry.status;
        statusSelect.disabled = true;

        try {
          const response = await fetch(`/api/admin/foster-applications/${entry.id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
            body: JSON.stringify({ status: newStatus }),
          });

          if (response.status === 401) {
            statusSelect.value = previousStatus;
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) throw new Error('échec');

          entry.status = newStatus;
          statusSelect.dataset.status = newStatus;
          row.dataset.status = newStatus;
          applyFosterFilterToRow(row);
          updateFosterBadge();
        } catch (err) {
          statusSelect.value = previousStatus;
          showActionMsg("La mise à jour du statut a échoué, réessaie.", true);
        } finally {
          statusSelect.disabled = false;
        }
      });

      actions.appendChild(statusSelect);

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/admin/foster-applications/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('La suppression a échoué, réessaie.');

        row.remove();
        updateFosterBadge();
        const fosterList = document.getElementById('admin-foster-list');
        if (fosterList && !fosterList.children.length) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune candidature pour le moment.';
          fosterList.appendChild(empty);
        }
      });

      actions.appendChild(deleteBtn);

      row.appendChild(body);
      row.appendChild(actions);
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

    async function loadComments(order) {
      // Le GET /api/comments est public (les messages sont deja visibles sur le site), mais le
      // panel admin lui-meme ne doit rien afficher -- ni la liste ni les boutons Supprimer/Repondre
      // -- tant qu'aucune session admin valide n'est memorisee.
      if (!storedPassword()) return;

      adminList.innerHTML = '<p class="guestbook-loading">Chargement des messages...</p>';
      try {
        const response = await fetch(`/api/comments?order=${order === 'asc' ? 'asc' : 'desc'}`);
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

    async function loadStats() {
      const statsContent = document.getElementById('admin-stats-content');
      const pw = storedPassword();
      if (!pw || !statsContent) return;

      statsContent.innerHTML = '<p class="guestbook-loading">Chargement des statistiques...</p>';
      try {
        const response = await fetch('/api/admin/stats', {
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) {
          requireReauth();
          return;
        }

        const data = await response.json();
        statsContent.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'admin-stats-grid';

        const cards = [
          { label: 'Total (historique complet)', value: data.totalComments },
          { label: 'Ce mois-ci', value: data.thisMonth },
          { label: 'Cette semaine', value: data.thisWeek },
          { label: 'Bloqués par le filtre', value: data.totalBlocked },
        ];
        cards.forEach((c) => {
          const card = document.createElement('div');
          card.className = 'admin-stat-card';
          const num = document.createElement('div');
          num.className = 'admin-stat-number';
          num.textContent = c.value;
          const label = document.createElement('div');
          label.className = 'admin-stat-label';
          label.textContent = c.label;
          card.appendChild(num);
          card.appendChild(label);
          grid.appendChild(card);
        });
        statsContent.appendChild(grid);

        if (data.latestComment) {
          const latestCard = document.createElement('div');
          latestCard.className = 'admin-stats-latest';

          const label = document.createElement('span');
          label.className = 'admin-stats-latest-label';
          label.textContent = 'Dernier commentaire';
          const name = document.createElement('span');
          name.className = 'admin-stats-latest-name';
          name.textContent = data.latestComment.name;
          const date = document.createElement('span');
          date.className = 'admin-stats-latest-date';
          date.textContent = dateFormatter.format(new Date(data.latestComment.created_at));

          latestCard.appendChild(label);
          latestCard.appendChild(name);
          latestCard.appendChild(date);
          statsContent.appendChild(latestCard);
        }

        const chartCard = document.createElement('div');
        chartCard.className = 'admin-stats-chart-card';
        const chartTitle = document.createElement('h2');
        chartTitle.className = 'admin-stats-chart-title';
        chartTitle.textContent = 'Commentaires des 7 derniers jours';
        chartCard.appendChild(chartTitle);

        const chart = document.createElement('div');
        chart.className = 'admin-stats-chart';
        const maxCount = Math.max(1, ...(data.last7Days || []).map((d) => d.count));
        const dayLabelFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

        (data.last7Days || []).forEach((d) => {
          const col = document.createElement('div');
          col.className = 'admin-stats-bar-col';

          const value = document.createElement('span');
          value.className = 'admin-stats-bar-value';
          value.textContent = d.count;

          const bar = document.createElement('div');
          bar.className = 'admin-stats-bar';
          bar.style.height = `${Math.max(4, (d.count / maxCount) * 100)}px`;

          const label = document.createElement('span');
          label.className = 'admin-stats-bar-label';
          label.textContent = dayLabelFormatter.format(new Date(`${d.date}T12:00:00Z`));

          col.appendChild(value);
          col.appendChild(bar);
          col.appendChild(label);
          chart.appendChild(col);
        });

        chartCard.appendChild(chart);
        statsContent.appendChild(chartCard);
      } catch (err) {
        statsContent.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les statistiques.';
        statsContent.appendChild(empty);
      }
    }

    async function loadFosterApplications() {
      const fosterList = document.getElementById('admin-foster-list');
      const pw = storedPassword();
      if (!pw || !fosterList) return;

      fosterList.innerHTML = '<p class="guestbook-loading">Chargement...</p>';
      try {
        const response = await fetch('/api/admin/foster-applications', {
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) {
          requireReauth();
          return;
        }

        const data = await response.json();
        fosterList.innerHTML = '';

        if (!data.applications || data.applications.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune candidature pour le moment.';
          fosterList.appendChild(empty);
          updateFosterBadge();
          return;
        }

        data.applications.forEach((entry) => {
          const row = renderFosterEntry(entry);
          applyFosterFilterToRow(row);
          fosterList.appendChild(row);
        });
        updateFosterBadge();
      } catch (err) {
        fosterList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les candidatures.';
        fosterList.appendChild(empty);
      }
    }

    // Version simple des candidatures benevoles : pas de statut ni de notes internes (voir
    // handleVolunteerApplication cote serveur), juste la liste et la suppression.
    const renderVolunteerEntry = (entry) => {
      const row = document.createElement('div');
      row.className = 'admin-entry';

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const name = document.createElement('span');
      name.className = 'admin-entry-name';
      name.textContent = entry.nom_complet;

      const date = document.createElement('span');
      date.className = 'admin-entry-date';
      date.textContent = dateFormatter.format(new Date(entry.created_at));

      head.appendChild(name);
      head.appendChild(date);

      const contact = document.createElement('p');
      contact.className = 'admin-foster-contact';
      contact.textContent = `${entry.telephone} · ${entry.email}`;

      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'admin-foster-chips';
      const chip = document.createElement('span');
      chip.className = 'admin-foster-chip';
      chip.textContent = entry.modalite;
      chipsWrap.appendChild(chip);

      const competences = document.createElement('div');
      competences.className = 'admin-foster-text';
      const competencesLabel = document.createElement('span');
      competencesLabel.className = 'admin-foster-text-label';
      competencesLabel.textContent = 'Ce qu’il ou elle peut faire';
      const competencesValue = document.createElement('p');
      competencesValue.textContent = entry.competences;
      competences.appendChild(competencesLabel);
      competences.appendChild(competencesValue);

      body.appendChild(head);
      body.appendChild(contact);
      body.appendChild(chipsWrap);
      body.appendChild(competences);

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/admin/volunteer-applications/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error('La suppression a échoué, réessaie.');

        row.remove();
        const benevolesList = document.getElementById('admin-benevoles-list');
        if (benevolesList && !benevolesList.children.length) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune candidature pour le moment.';
          benevolesList.appendChild(empty);
        }
      });

      actions.appendChild(deleteBtn);

      row.appendChild(body);
      row.appendChild(actions);
      return row;
    };

    async function loadVolunteerApplications() {
      const benevolesList = document.getElementById('admin-benevoles-list');
      const pw = storedPassword();
      if (!pw || !benevolesList) return;

      benevolesList.innerHTML = '<p class="guestbook-loading">Chargement...</p>';
      try {
        const response = await fetch('/api/admin/volunteer-applications', {
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) {
          requireReauth();
          return;
        }

        const data = await response.json();
        benevolesList.innerHTML = '';

        if (!data.applications || data.applications.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune candidature pour le moment.';
          benevolesList.appendChild(empty);
          return;
        }

        data.applications.forEach((entry) => {
          benevolesList.appendChild(renderVolunteerEntry(entry));
        });
      } catch (err) {
        benevolesList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les candidatures.';
        benevolesList.appendChild(empty);
      }
    }

    // Formulaire de creation/modification d'article de blog : la photo est une simple URL externe
    // (pas d'upload de fichier -- R2 necessiterait un abonnement payant cote Cloudflare). Le meme
    // formulaire sert aussi a modifier un article existant (bouton "Modifier" de la liste ci-dessous) --
    // editingBlogPostId distingue les deux modes.
    const blogForm = document.getElementById('admin-blog-form');

    const BLOG_INTRO_CREATE = 'Rédige un nouvel article pour le blog du site.';
    const BLOG_INTRO_EDIT = "Modifie l'article ci-dessous, puis enregistre.";

    let editingBlogPostId = null;

    // Reinitialise le formulaire en mode "creation" -- appele apres une publication reussie,
    // au clic sur "Annuler la modification", et a la deconnexion (rien ne doit rester affiche
    // d'une edition en cours une fois la session terminee).
    const resetBlogForm = () => {
      if (!blogForm) return;
      blogForm.reset();
      editingBlogPostId = null;
      const previewImg = document.getElementById('admin-blog-preview-img');
      const preview = document.getElementById('admin-blog-preview');
      const imageError = document.getElementById('admin-blog-image-error');
      const msg = document.getElementById('admin-blog-msg');
      const intro = document.getElementById('admin-blog-intro');
      const submit = document.getElementById('admin-blog-submit');
      const cancelEdit = document.getElementById('admin-blog-cancel-edit');
      const uploadStatus = document.getElementById('admin-blog-image-upload-status');
      const urlInput = document.getElementById('admin-blog-image-url');
      if (previewImg) previewImg.src = '';
      if (preview) preview.hidden = true;
      if (imageError) imageError.hidden = true;
      if (msg) msg.hidden = true;
      if (intro) intro.textContent = BLOG_INTRO_CREATE;
      if (submit) submit.textContent = "Publier l'article";
      if (cancelEdit) cancelEdit.hidden = true;
      if (uploadStatus) uploadStatus.hidden = true;
      if (urlInput) urlInput.hidden = true;
    };

    // Bascule le formulaire en mode "modification" pour un article existant : pre-remplit les
    // champs et l'apercu (photo existante comprise). Definie a ce niveau (comme resetBlogForm)
    // pour rester accessible depuis renderBlogEntry ci-dessous.
    const startEditingBlogPost = (entry) => {
      if (!blogForm) return;
      editingBlogPostId = entry.id;

      const titleInput = document.getElementById('admin-blog-title');
      const contentInput = document.getElementById('admin-blog-content');
      const imageUrlInput = document.getElementById('admin-blog-image-url');
      const previewImg = document.getElementById('admin-blog-preview-img');
      const preview = document.getElementById('admin-blog-preview');
      const imageError = document.getElementById('admin-blog-image-error');
      const msg = document.getElementById('admin-blog-msg');
      const intro = document.getElementById('admin-blog-intro');
      const submit = document.getElementById('admin-blog-submit');
      const cancelEdit = document.getElementById('admin-blog-cancel-edit');

      titleInput.value = entry.title;
      contentInput.value = entry.content;
      imageUrlInput.value = entry.image_url || '';
      // Affiche le champ URL des qu'une valeur existe deja (venant d'un envoi galerie ou d'un
      // lien colle), pour que l'admin voie ce qui est actuellement enregistre.
      imageUrlInput.hidden = !entry.image_url;

      if (entry.image_url) {
        previewImg.src = entry.image_url;
        preview.hidden = false;
      } else {
        previewImg.src = '';
        preview.hidden = true;
      }

      imageError.hidden = true;
      msg.hidden = true;
      intro.textContent = BLOG_INTRO_EDIT;
      submit.textContent = 'Enregistrer les modifications';
      cancelEdit.hidden = false;
      blogForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const BLOG_STATUS_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const blogList = document.getElementById('admin-blog-list');

    // Remplace/insere l'entree correspondante dans la liste admin, pour refleter immediatement
    // une creation/modification sans recharger toute la liste depuis le serveur.
    const upsertBlogListEntry = (post, { prepend } = {}) => {
      if (!blogList) return;
      const emptyMsg = blogList.querySelector('.guestbook-empty');
      if (emptyMsg) emptyMsg.remove();

      const existingRow = blogList.querySelector(`[data-id="${post.id}"]`);
      const newRow = renderBlogEntry(post);
      if (existingRow) {
        existingRow.replaceWith(newRow);
      } else if (prepend) {
        blogList.prepend(newRow);
      } else {
        blogList.appendChild(newRow);
      }
    };

    function renderBlogEntry(entry) {
      const row = document.createElement('div');
      row.className = 'admin-entry admin-blog-entry';
      row.dataset.id = entry.id;

      if (entry.image_url) {
        const thumb = document.createElement('img');
        thumb.className = 'admin-blog-thumb';
        thumb.src = entry.image_url;
        thumb.alt = '';
        row.appendChild(thumb);
      }

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const title = document.createElement('span');
      title.className = 'admin-entry-name';
      title.textContent = entry.title;

      const date = document.createElement('span');
      date.className = 'admin-entry-date';
      date.textContent = BLOG_STATUS_DATE_FORMATTER.format(new Date(entry.created_at));

      head.appendChild(title);
      head.appendChild(date);
      body.appendChild(head);

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'admin-approve-btn';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => startEditingBlogPost(entry));

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/admin/blog-posts/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error("La suppression a échoué, réessaie.");

        row.remove();
        if (editingBlogPostId === entry.id) resetBlogForm();
        if (!blogList.children.length) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucun article publié pour le moment.';
          blogList.appendChild(empty);
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(body);
      row.appendChild(actions);
      return row;
    }

    async function loadBlogPosts() {
      if (!storedPassword() || !blogList) return;

      blogList.innerHTML = '<p class="guestbook-loading">Chargement des articles...</p>';
      try {
        const response = await fetch('/api/blog-posts');
        const data = await response.json();
        blogList.innerHTML = '';

        if (!data.posts || data.posts.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucun article publié pour le moment.';
          blogList.appendChild(empty);
          return;
        }

        data.posts.forEach((entry) => blogList.appendChild(renderBlogEntry(entry)));
      } catch (err) {
        blogList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les articles.';
        blogList.appendChild(empty);
      }
    }

    if (blogForm) {
      const blogTitleInput = document.getElementById('admin-blog-title');
      const blogContentInput = document.getElementById('admin-blog-content');
      const blogImageUrlInput = document.getElementById('admin-blog-image-url');
      const blogPreview = document.getElementById('admin-blog-preview');
      const blogPreviewImg = document.getElementById('admin-blog-preview-img');
      const blogImageError = document.getElementById('admin-blog-image-error');
      const blogMsg = document.getElementById('admin-blog-msg');
      const blogSubmit = document.getElementById('admin-blog-submit');
      const blogIntro = document.getElementById('admin-blog-intro');
      const blogCancelEdit = document.getElementById('admin-blog-cancel-edit');

      const showBlogImageError = (text) => {
        blogImageError.textContent = text;
        blogImageError.hidden = false;
      };

      const showBlogMsg = (text, isError) => {
        blogMsg.textContent = text;
        blogMsg.className = 'admin-auth-msg ' + (isError ? 'is-error' : 'is-ok');
        blogMsg.hidden = false;
      };

      // Apercu en direct des que l'admin colle une URL -- <img onerror> masque la preview toute
      // seule si l'URL ne charge pas (image supprimee, lien casse, etc.).
      blogImageUrlInput.addEventListener('input', () => {
        blogImageError.hidden = true;
        const value = blogImageUrlInput.value.trim();
        if (!value) {
          blogPreview.hidden = true;
          blogPreviewImg.src = '';
          return;
        }
        blogPreviewImg.src = value;
      });

      blogPreviewImg.addEventListener('load', () => {
        if (blogPreviewImg.src) blogPreview.hidden = false;
      });

      blogPreviewImg.addEventListener('error', () => {
        blogPreview.hidden = true;
      });

      blogCancelEdit.addEventListener('click', resetBlogForm);

      const blogImageUploadBtn = document.getElementById('admin-blog-image-upload-btn');
      const blogImageFileInput = document.getElementById('admin-blog-image-file');
      const blogImageUploadStatus = document.getElementById('admin-blog-image-upload-status');
      const blogImageUrlToggleBtn = document.getElementById('admin-blog-image-url-toggle-btn');

      blogImageUploadBtn.addEventListener('click', () => blogImageFileInput.click());

      blogImageUrlToggleBtn.addEventListener('click', () => {
        blogImageUrlInput.hidden = !blogImageUrlInput.hidden;
        if (!blogImageUrlInput.hidden) blogImageUrlInput.focus();
      });

      blogImageFileInput.addEventListener('change', async () => {
        const file = blogImageFileInput.files && blogImageFileInput.files[0];
        if (!file) return;

        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        blogImageError.hidden = true;
        blogImageUploadBtn.disabled = true;
        blogImageUploadStatus.hidden = false;
        blogImageUploadStatus.className = 'admin-image-upload-status';
        blogImageUploadStatus.textContent = 'Envoi de la photo...';

        try {
          const url = await uploadMediaFile(file, pw);
          blogImageUrlInput.value = url;
          blogImageUrlInput.dispatchEvent(new Event('input'));
          blogImageUploadStatus.textContent = 'Photo envoyée ✓';
        } catch (err) {
          if (err.unauthorized) {
            requireReauth();
            return;
          }
          blogImageUploadStatus.className = 'admin-image-upload-status is-error';
          blogImageUploadStatus.textContent = err.message || "L'envoi a échoué, réessaie.";
        } finally {
          blogImageUploadBtn.disabled = false;
          blogImageFileInput.value = '';
        }
      });

      blogForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        blogMsg.hidden = true;
        blogImageError.hidden = true;

        const title = blogTitleInput.value.trim();
        const content = blogContentInput.value.trim();
        const imageUrl = blogImageUrlInput.value.trim();

        if (!title) {
          showBlogMsg('Le titre est obligatoire.', true);
          blogTitleInput.focus();
          return;
        }

        if (!content) {
          showBlogMsg('Le contenu est obligatoire.', true);
          blogContentInput.focus();
          return;
        }

        if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !/^\/media\/\d+$/.test(imageUrl)) {
          showBlogImageError("L'URL de l'image doit commencer par http:// ou https://.");
          blogImageUrlInput.focus();
          return;
        }

        const isEditing = editingBlogPostId !== null;
        const url = isEditing ? `/api/admin/blog-posts/${editingBlogPostId}` : '/api/admin/blog-posts';

        blogSubmit.disabled = true;
        blogSubmit.textContent = isEditing ? 'Enregistrement...' : 'Publication...';

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'X-Admin-Password': pw, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, image_url: imageUrl }),
          });

          if (response.status === 401) {
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) {
            showBlogMsg(result.message || (isEditing ? "L'enregistrement a échoué, réessaie." : "La publication a échoué, réessaie."), true);
            return;
          }

          if (result.post) upsertBlogListEntry(result.post, { prepend: !isEditing });
          resetBlogForm();
          showBlogMsg(isEditing ? 'Article mis à jour !' : 'Article publié !', false);
        } catch (err) {
          showBlogMsg(isEditing ? "L'enregistrement a échoué, réessaie." : "La publication a échoué, réessaie.", true);
        } finally {
          blogSubmit.disabled = false;
          // editingBlogPostId est deja retombe a null si resetBlogForm() a tourne (succes) --
          // sinon on est toujours dans le meme mode qu'au debut de cette soumission (echec).
          blogSubmit.textContent = editingBlogPostId !== null ? 'Enregistrer les modifications' : "Publier l'article";
        }
      });
    }

    // Formulaire de creation/modification de fiche chien pour la page publique "Nos chiens".
    // Meme logique que le blog (photo en URL, pas d'upload) -- editingDogId distingue creation/edition.
    const dogForm = document.getElementById('admin-dog-form');

    const DOG_INTRO_CREATE = 'Ajoute une nouvelle fiche chien pour la page "Nos chiens".';
    const DOG_INTRO_EDIT = "Modifie la fiche ci-dessous, puis enregistre.";
    const DOG_STATUS_LABELS = { adoption: "À l'adoption", bientot: 'Bientôt à l\'adoption' };

    let editingDogId = null;

    const resetDogForm = () => {
      if (!dogForm) return;
      dogForm.reset();
      editingDogId = null;
      const previewImg = document.getElementById('admin-dog-preview-img');
      const preview = document.getElementById('admin-dog-preview');
      const imageError = document.getElementById('admin-dog-image-error');
      const msg = document.getElementById('admin-dog-msg');
      const intro = document.getElementById('admin-dogs-intro');
      const submit = document.getElementById('admin-dog-submit');
      const cancelEdit = document.getElementById('admin-dog-cancel-edit');
      const uploadStatus = document.getElementById('admin-dog-image-upload-status');
      const urlInput = document.getElementById('admin-dog-image-url');
      if (previewImg) previewImg.src = '';
      if (preview) preview.hidden = true;
      if (imageError) imageError.hidden = true;
      if (msg) msg.hidden = true;
      if (intro) intro.textContent = DOG_INTRO_CREATE;
      if (submit) submit.textContent = 'Publier la fiche';
      if (cancelEdit) cancelEdit.hidden = true;
      if (uploadStatus) uploadStatus.hidden = true;
      if (urlInput) urlInput.hidden = true;
    };

    // Bascule le formulaire en mode "modification" pour une fiche existante -- definie a ce
    // niveau (comme resetDogForm) pour rester accessible depuis renderDogEntry ci-dessous.
    const startEditingDog = (entry) => {
      if (!dogForm) return;
      editingDogId = entry.id;

      const nameInput = document.getElementById('admin-dog-name');
      const ageInput = document.getElementById('admin-dog-age');
      const sizeInput = document.getElementById('admin-dog-size');
      const descriptionInput = document.getElementById('admin-dog-description');
      const statusSelect = document.getElementById('admin-dog-status');
      const imageUrlInput = document.getElementById('admin-dog-image-url');
      const previewImg = document.getElementById('admin-dog-preview-img');
      const preview = document.getElementById('admin-dog-preview');
      const imageError = document.getElementById('admin-dog-image-error');
      const msg = document.getElementById('admin-dog-msg');
      const intro = document.getElementById('admin-dogs-intro');
      const submit = document.getElementById('admin-dog-submit');
      const cancelEdit = document.getElementById('admin-dog-cancel-edit');

      nameInput.value = entry.name;
      ageInput.value = entry.age;
      sizeInput.value = entry.size;
      descriptionInput.value = entry.description;
      statusSelect.value = entry.status;
      imageUrlInput.value = entry.image_url || '';
      // Affiche le champ URL des qu'une valeur existe deja (venant d'un envoi galerie ou d'un
      // lien colle), pour que l'admin voie ce qui est actuellement enregistre.
      imageUrlInput.hidden = !entry.image_url;

      if (entry.image_url) {
        previewImg.src = entry.image_url;
        preview.hidden = false;
      } else {
        previewImg.src = '';
        preview.hidden = true;
      }

      imageError.hidden = true;
      msg.hidden = true;
      intro.textContent = DOG_INTRO_EDIT;
      submit.textContent = 'Enregistrer les modifications';
      cancelEdit.hidden = false;
      dogForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const dogList = document.getElementById('admin-dog-list');

    // Remplace/insere l'entree correspondante dans la liste admin, pour refleter immediatement
    // une creation/modification sans recharger toute la liste depuis le serveur.
    const upsertDogListEntry = (dog, { prepend } = {}) => {
      if (!dogList) return;
      const emptyMsg = dogList.querySelector('.guestbook-empty');
      if (emptyMsg) emptyMsg.remove();

      const existingRow = dogList.querySelector(`[data-id="${dog.id}"]`);
      const newRow = renderDogEntry(dog);
      if (existingRow) {
        existingRow.replaceWith(newRow);
      } else if (prepend) {
        dogList.prepend(newRow);
      } else {
        dogList.appendChild(newRow);
      }
    };

    function renderDogEntry(entry) {
      const row = document.createElement('div');
      row.className = 'admin-entry admin-blog-entry';
      row.dataset.id = entry.id;

      const thumb = document.createElement('img');
      thumb.className = 'admin-dog-thumb';
      thumb.src = entry.image_url || 'images/chien-silhouette.jpg';
      thumb.alt = '';
      row.appendChild(thumb);

      const body = document.createElement('div');
      body.className = 'admin-entry-body';

      const head = document.createElement('div');
      head.className = 'admin-entry-head';

      const name = document.createElement('span');
      name.className = 'admin-entry-name';
      name.textContent = entry.name;

      const statusLabel = document.createElement('span');
      statusLabel.className = 'admin-dog-status-label ' + (entry.status === 'adoption' ? 'is-adoption' : 'is-bientot');
      statusLabel.textContent = DOG_STATUS_LABELS[entry.status] || entry.status;

      head.appendChild(name);
      head.appendChild(statusLabel);
      body.appendChild(head);

      const meta = document.createElement('span');
      meta.className = 'admin-entry-date';
      meta.textContent = `${entry.age} · ${entry.size}`;
      body.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'admin-entry-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'admin-approve-btn';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => startEditingDog(entry));

      const deleteBtn = createTwoStepButton('Supprimer', async (pw) => {
        const response = await fetch(`/api/admin/dogs/${entry.id}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Password': pw },
        });

        if (response.status === 401) throw Object.assign(new Error('Session expirée.'), { unauthorized: true });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error("La suppression a échoué, réessaie.");

        row.remove();
        if (editingDogId === entry.id) resetDogForm();
        if (!dogList.children.length) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune fiche publiée pour le moment.';
          dogList.appendChild(empty);
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      row.appendChild(body);
      row.appendChild(actions);
      return row;
    }

    async function loadDogs() {
      if (!storedPassword() || !dogList) return;

      dogList.innerHTML = '<p class="guestbook-loading">Chargement des fiches...</p>';
      try {
        const response = await fetch('/api/dogs');
        const data = await response.json();
        dogList.innerHTML = '';

        if (!data.dogs || data.dogs.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'guestbook-empty';
          empty.textContent = 'Aucune fiche publiée pour le moment.';
          dogList.appendChild(empty);
          return;
        }

        data.dogs.forEach((entry) => dogList.appendChild(renderDogEntry(entry)));
      } catch (err) {
        dogList.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'guestbook-empty';
        empty.textContent = 'Impossible de charger les fiches.';
        dogList.appendChild(empty);
      }
    }

    if (dogForm) {
      const dogNameInput = document.getElementById('admin-dog-name');
      const dogAgeInput = document.getElementById('admin-dog-age');
      const dogSizeInput = document.getElementById('admin-dog-size');
      const dogDescriptionInput = document.getElementById('admin-dog-description');
      const dogStatusSelect = document.getElementById('admin-dog-status');
      const dogImageUrlInput = document.getElementById('admin-dog-image-url');
      const dogPreview = document.getElementById('admin-dog-preview');
      const dogPreviewImg = document.getElementById('admin-dog-preview-img');
      const dogImageError = document.getElementById('admin-dog-image-error');
      const dogMsg = document.getElementById('admin-dog-msg');
      const dogSubmit = document.getElementById('admin-dog-submit');
      const dogCancelEdit = document.getElementById('admin-dog-cancel-edit');

      const showDogImageError = (text) => {
        dogImageError.textContent = text;
        dogImageError.hidden = false;
      };

      const showDogMsg = (text, isError) => {
        dogMsg.textContent = text;
        dogMsg.className = 'admin-auth-msg ' + (isError ? 'is-error' : 'is-ok');
        dogMsg.hidden = false;
      };

      dogImageUrlInput.addEventListener('input', () => {
        dogImageError.hidden = true;
        const value = dogImageUrlInput.value.trim();
        if (!value) {
          dogPreview.hidden = true;
          dogPreviewImg.src = '';
          return;
        }
        dogPreviewImg.src = value;
      });

      dogPreviewImg.addEventListener('load', () => {
        if (dogPreviewImg.src) dogPreview.hidden = false;
      });

      dogPreviewImg.addEventListener('error', () => {
        dogPreview.hidden = true;
      });

      dogCancelEdit.addEventListener('click', resetDogForm);

      const dogImageUploadBtn = document.getElementById('admin-dog-image-upload-btn');
      const dogImageFileInput = document.getElementById('admin-dog-image-file');
      const dogImageUploadStatus = document.getElementById('admin-dog-image-upload-status');
      const dogImageUrlToggleBtn = document.getElementById('admin-dog-image-url-toggle-btn');

      dogImageUploadBtn.addEventListener('click', () => dogImageFileInput.click());

      dogImageUrlToggleBtn.addEventListener('click', () => {
        dogImageUrlInput.hidden = !dogImageUrlInput.hidden;
        if (!dogImageUrlInput.hidden) dogImageUrlInput.focus();
      });

      dogImageFileInput.addEventListener('change', async () => {
        const file = dogImageFileInput.files && dogImageFileInput.files[0];
        if (!file) return;

        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        dogImageError.hidden = true;
        dogImageUploadBtn.disabled = true;
        dogImageUploadStatus.hidden = false;
        dogImageUploadStatus.className = 'admin-image-upload-status';
        dogImageUploadStatus.textContent = 'Envoi de la photo...';

        try {
          const url = await uploadMediaFile(file, pw);
          dogImageUrlInput.value = url;
          dogImageUrlInput.dispatchEvent(new Event('input'));
          dogImageUploadStatus.textContent = 'Photo envoyée ✓';
        } catch (err) {
          if (err.unauthorized) {
            requireReauth();
            return;
          }
          dogImageUploadStatus.className = 'admin-image-upload-status is-error';
          dogImageUploadStatus.textContent = err.message || "L'envoi a échoué, réessaie.";
        } finally {
          dogImageUploadBtn.disabled = false;
          dogImageFileInput.value = '';
        }
      });

      dogForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pw = storedPassword();
        if (!pw) {
          requireReauth();
          return;
        }

        dogMsg.hidden = true;
        dogImageError.hidden = true;

        const name = dogNameInput.value.trim();
        const age = dogAgeInput.value.trim();
        const size = dogSizeInput.value.trim();
        const description = dogDescriptionInput.value.trim();
        const status = dogStatusSelect.value;
        const imageUrl = dogImageUrlInput.value.trim();

        if (!name) {
          showDogMsg('Le nom est obligatoire.', true);
          dogNameInput.focus();
          return;
        }

        if (!age) {
          showDogMsg("L'âge est obligatoire.", true);
          dogAgeInput.focus();
          return;
        }

        if (!size) {
          showDogMsg('La taille est obligatoire.', true);
          dogSizeInput.focus();
          return;
        }

        if (!description) {
          showDogMsg('La description est obligatoire.', true);
          dogDescriptionInput.focus();
          return;
        }

        if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !/^\/media\/\d+$/.test(imageUrl)) {
          showDogImageError("L'URL de l'image doit commencer par http:// ou https://.");
          dogImageUrlInput.focus();
          return;
        }

        const isEditing = editingDogId !== null;
        const url = isEditing ? `/api/admin/dogs/${editingDogId}` : '/api/admin/dogs';

        dogSubmit.disabled = true;
        dogSubmit.textContent = isEditing ? 'Enregistrement...' : 'Publication...';

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'X-Admin-Password': pw, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, age, size, description, status, image_url: imageUrl }),
          });

          if (response.status === 401) {
            requireReauth();
            return;
          }

          const result = await response.json();
          if (!response.ok || !result.success) {
            showDogMsg(result.message || (isEditing ? "L'enregistrement a échoué, réessaie." : "La publication a échoué, réessaie."), true);
            return;
          }

          if (result.dog) upsertDogListEntry(result.dog, { prepend: !isEditing });
          resetDogForm();
          showDogMsg(isEditing ? 'Fiche mise à jour !' : 'Fiche publiée !', false);
        } catch (err) {
          showDogMsg(isEditing ? "L'enregistrement a échoué, réessaie." : "La publication a échoué, réessaie.", true);
        } finally {
          dogSubmit.disabled = false;
          dogSubmit.textContent = editingDogId !== null ? 'Enregistrer les modifications' : 'Publier la fiche';
        }
      });
    }
  }
});
