// Sert uniquement a verifier qu'un deploiement est bien en ligne (via GET /api/version)
// sans jamais avoir a tester avec une vraie requete qui ecrit des donnees (ex: POST /api/comments).
// A incrementer a chaque changement cote Worker qui doit etre confirme avant tout autre test.
const WORKER_VERSION = '2026-09-05.2';

// Adresse qui recoit une notification a chaque nouveau message du livre d'or.
// Pas un secret (visible aussi en pied de page du site) -- seule la cle API Resend
// (env.RESEND_API_KEY, un Cloudflare secret) ne doit jamais apparaitre dans le code.
const NOTIFICATION_EMAIL = 'huichunheihugo@gmail.com';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "form-action 'self'",
  // Sans ceci, l'iframe OpenStreetMap de la section "Nous trouver" (accueil) est bloquee en
  // silence par la CSP -- aucune erreur visible pour un visiteur, juste un cadre vide.
  "frame-src https://www.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

const SPAM_WORDS = [
  'viagra', 'cialis', 'casino', 'poker', 'crypto', 'bitcoin', 'forex',
  'xxx', 'porn', 'loan', 'credit repair', 'seo service', 'backlink',
  'http://', 'https://', 'www.',
];

// Un filtre par mots-clés n'attrapera jamais tout (fautes volontaires, contournements,
// tournures detournees...) -- c'est un premier filet, pas une garantie. Chaque categorie
// est volontairement composee de termes univoques ou d'expressions completes plutot que
// de mots courts ambigus, pour limiter les faux positifs sur de vrais messages.

// Insultes racistes / discriminatoires (origine, religion, orientation, identite de genre)
// Les accents ne sont pas necessaires ici : normalizeForFilter() les retire avant comparaison,
// donc "negre" attrape aussi "nègre" automatiquement.
const HATE_WORDS = [
  'negre', 'bougnoule', 'youpin', 'chinetoque', 'feuj', 'bicot',
  'sale juif', 'sale arabe', 'sale noir', 'sale blanc',
  'pd', 'pede', 'tapette', 'tarlouze', 'gouine', 'travelo',
];

// Vocabulaire lie au terrorisme / extremisme violent
const EXTREMISM_WORDS = [
  'terroriste', 'terrorisme', 'djihad', 'jihad', 'daesh', 'isis',
  'kamikaze', 'attentat', 'decapiter', 'egorger',
  'nazi', 'suprematiste',
];

// Grossieretes courantes en francais
const PROFANITY_WORDS = [
  'connard', 'connasse', 'salope', 'pute', 'putain', 'encule', 'merde',
  'nique', 'niquer', 'nique ta mere', 'nique sa mere', 'ntm', 'fdp',
  'fils de pute', 'ta gueule', 'ferme ta gueule', 'salopard', 'enfoire',
  'trouduc', 'branleur', 'va te faire foutre',
  // Note : "batard"/"bâtard" est volontairement absent de cette liste -- c'est aussi le mot
  // francais pour un chien croise/sans race, tres frequent sur un site de refuge canin.
];

// Contenu a caractere sexuel explicite
const SEXUAL_WORDS = [
  'couille', 'couilles', 'burnes', 'chibre', 'sodomie', 'fellation',
];

const INAPPROPRIATE_WORDS = [...HATE_WORDS, ...EXTREMISM_WORDS, ...PROFANITY_WORDS, ...SEXUAL_WORDS];

// Retire les accents, uniformise les substitutions type "leet speak" (0->o, 4->a...) et
// ecrase les lettres repetees ("salopeeee" -> "salopee") pour attraper les contournements
// volontaires du filtre, sans jamais modifier le message reellement stocke/affiche
// (cette fonction ne sert qu'a la comparaison interne).
const LEET_MAP = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '+': 't' };

// Plage Unicode des diacritiques combinants (U+0300-U+036F), construite via code point
// plutot qu'un caractere litteral pour eviter tout probleme d'encodage dans le fichier source.
const DIACRITICS_PATTERN = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function normalizeForFilter(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_PATTERN, '')
    .replace(/[013457@$+]/g, (c) => LEET_MAP[c])
    .replace(/(.)\1{2,}/g, '$1$1');
}

// Verifie une liste de mots/expressions contre un texte normalise, plus une variante
// "compactee" (espaces/ponctuation retires) pour les entrees assez longues -- attrape
// les contournements du type "s a l o p e" ou "s.a.l.o.p.e" sans risquer de faux positifs
// sur des entrees courtes (ex: "pd") qui matcheraient trop souvent par hasard une fois compactees.
function containsFilteredWord(text, words) {
  const normalized = normalizeForFilter(text);
  const normalizedWords = words.map(normalizeForFilter);

  if (normalizedWords.some((word) => normalized.includes(word))) return true;

  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalizedWords.some((word) => {
    const compactWord = word.replace(/[^a-z0-9]/g, '');
    return compactWord.length >= 5 && compact.includes(compactWord);
  });
}

function withSecurityHeaders(response) {
  const hardened = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    hardened.headers.set(key, value);
  }
  return hardened;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    // Sans ceci, le navigateur peut reservir une reponse mise en cache pour une URL deja
    // visitee (ex: revenir sur "Plus recents d'abord" apres une suppression) et faire
    // reapparaitre un message pourtant bien supprime cote serveur.
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function hashIp(ip) {
  const data = new TextEncoder().encode('dogcytocin-guestbook-salt-2026:' + ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] || 0) ^ (bBytes[i] || 0);
  }
  return diff === 0;
}

function looksLikeSpam(name, message) {
  const combined = name + ' ' + message;
  if (containsFilteredWord(combined, SPAM_WORDS)) return true;
  if (/\b[\w-]+\.(com|net|org|fr|info|biz|ru|xyz|top|click|shop)\b/.test(normalizeForFilter(combined))) return true;
  return false;
}

function looksInappropriate(name, message) {
  return containsFilteredWord(name + ' ' + message, INAPPROPRIATE_WORDS);
}

async function logRejected(env, name, message, reason, ipHash) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      'INSERT INTO rejected_comments (name, message, reason, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5)'
    ).bind(name || '', message || '', reason, new Date().toISOString(), ipHash).run();
  } catch (err) {
    // Journal des refus : un bonus, pas une dependance dure -- on ne bloque jamais la reponse au visiteur pour ca.
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendCommentNotification(env, comment) {
  if (!env.RESEND_API_KEY) return;

  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(comment.created_at));

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Expediteur par defaut de Resend : fonctionne sans verifier de domaine, mais tant
        // qu'aucun domaine n'est verifie, Resend ne livre qu'a l'adresse du compte Resend lui-meme.
        from: 'Dogcytocin et Racines <onboarding@resend.dev>',
        to: NOTIFICATION_EMAIL,
        subject: `Nouveau message de ${comment.name} sur le livre d'or`,
        html: `<p><strong>${escapeHtml(comment.name)}</strong> a laissé un message le ${dateLabel} :</p><p>${escapeHtml(comment.message)}</p>`,
      }),
    });
  } catch (err) {
    // Best-effort : une notification manquee ne doit jamais empecher la publication du commentaire.
  }
}

// Contenu des emails envoyes au candidat quand sa candidature est acceptee/refusee. Ton volontairement
// chaleureux (pas de refus froid/automatique-sonnant) puisque ces messages partent sans relecture humaine.
const FOSTER_STATUS_EMAIL_CONTENT = {
  acceptee: {
    subject: "Votre candidature famille d'accueil — bonne nouvelle !",
    html: (name) => `
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Nous avons le plaisir de vous annoncer que votre candidature pour devenir famille d'accueil a été <strong>acceptée</strong> !</p>
      <p>Nous allons revenir vers vous très prochainement pour organiser la suite ensemble.</p>
      <p>Merci infiniment pour votre engagement — c'est grâce à des personnes comme vous que nos chiens trouvent le temps et l'amour dont ils ont besoin avant leur adoption définitive.</p>
      <p>À très vite,<br>L'équipe Dogcytocin et Racines</p>
    `,
  },
  refusee: {
    subject: "Votre candidature famille d'accueil",
    html: (name) => `
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Merci beaucoup pour l'intérêt que vous portez à nos chiens et pour le temps que vous avez pris à candidater.</p>
      <p>Après réflexion, nous ne pouvons pas donner suite à votre candidature pour le moment. Cela ne remet absolument pas en cause votre motivation — la situation actuelle ne correspond simplement pas à ce dont nous avons besoin aujourd'hui.</p>
      <p>N'hésitez pas à nous recontacter à l'avenir, ou à nous soutenir d'une autre façon si vous le souhaitez.</p>
      <p>Merci encore,<br>L'équipe Dogcytocin et Racines</p>
    `,
  },
};

async function sendFosterStatusEmail(env, application, status) {
  const content = FOSTER_STATUS_EMAIL_CONTENT[status];
  if (!content || !env.RESEND_API_KEY) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Dogcytocin et Racines <onboarding@resend.dev>',
        to: application.email,
        subject: content.subject,
        html: content.html(application.nom_complet),
      }),
    });
  } catch (err) {
    // Best-effort : un email de notification manque ne doit jamais bloquer la mise a jour du statut.
  }
}

const FOSTER_FIELD_LABELS = {
  nom_complet: 'Nom complet',
  telephone: 'Téléphone',
  email: 'Email',
  type_logement: 'Type de logement',
  autres_animaux: 'Autres animaux',
  details_autres_animaux: 'Détails autres animaux',
  enfants_bas_age: 'Enfants en bas âge',
  experience_animaux: 'Expérience avec les animaux',
  motivation: 'Motivation',
  duree_disponibilite: 'Durée de disponibilité',
};

const FOSTER_REQUIRED_FIELDS = [
  'nom_complet', 'telephone', 'email', 'type_logement',
  'autres_animaux', 'enfants_bas_age', 'experience_animaux',
  'motivation', 'duree_disponibilite',
];

async function handleFosterApplication(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  if (body?.botcheck) {
    // Piège à robots déclenché : succès silencieux, rien n'est envoyé, pour ne pas alerter le bot.
    return json({ success: true });
  }

  for (const key of FOSTER_REQUIRED_FIELDS) {
    if (typeof body?.[key] !== 'string' || !body[key].trim()) {
      return json({ success: false, message: 'Merci de remplir tous les champs obligatoires.' }, 422);
    }
  }

  if (!env.RESEND_API_KEY) {
    return json({ success: false, message: "L'envoi n'est pas encore configuré, réessayez plus tard ou écrivez-nous directement." }, 503);
  }

  if (env.DB) {
    try {
      // Enregistrement best-effort : le panel admin (suivi + statut) est un plus, mais l'envoi de
      // l'email ci-dessous reste le vrai critere de succes pour la personne qui candidate.
      await env.DB.prepare(
        `INSERT INTO foster_applications
         (nom_complet, telephone, email, type_logement, autres_animaux, details_autres_animaux,
          enfants_bas_age, experience_animaux, motivation, duree_disponibilite, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'nouvelle', ?11)`
      ).bind(
        body.nom_complet.trim(),
        body.telephone.trim(),
        body.email.trim(),
        body.type_logement.trim(),
        body.autres_animaux.trim(),
        typeof body.details_autres_animaux === 'string' ? body.details_autres_animaux.trim() || null : null,
        body.enfants_bas_age.trim(),
        body.experience_animaux.trim(),
        body.motivation.trim(),
        body.duree_disponibilite.trim(),
        new Date().toISOString()
      ).run();
    } catch (err) {
      // Table pas encore creee ou base indisponible : ne bloque jamais l'envoi de l'email.
    }
  }

  const rows = Object.entries(FOSTER_FIELD_LABELS)
    .filter(([key]) => typeof body[key] === 'string' && body[key].trim())
    .map(([key, label]) => {
      const value = escapeHtml(body[key].trim()).replace(/\n/g, '<br>');
      return `<tr><td style="padding:4px 14px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${value}</td></tr>`;
    })
    .join('');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Dogcytocin et Racines <onboarding@resend.dev>',
        to: NOTIFICATION_EMAIL,
        // Permet de repondre directement au candidat depuis la boite mail, sans copier son adresse.
        reply_to: body.email.trim(),
        subject: `Nouvelle candidature famille d'accueil — ${body.nom_complet.trim()}`,
        html: `<table cellpadding="0" cellspacing="0">${rows}</table>`,
      }),
    });

    if (!resendResponse.ok) {
      return json({ success: false, message: "L'envoi a échoué, réessayez ou écrivez-nous directement." }, 502);
    }

    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: "L'envoi a échoué, réessayez ou écrivez-nous directement." }, 502);
  }
}

const VOLUNTEER_FIELD_LABELS = {
  nom_complet: 'Nom complet',
  telephone: 'Téléphone',
  email: 'Email',
  modalite: 'Sur place ou à distance',
  competences: 'Ce qu’il ou elle peut faire',
};

const VOLUNTEER_REQUIRED_FIELDS = ['nom_complet', 'telephone', 'email', 'modalite', 'competences'];

// Version simple (formulaire -> email) : pas de suivi dans le panel admin pour l'instant,
// contrairement aux candidatures famille d'accueil -- a etendre plus tard si besoin.
async function handleVolunteerApplication(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  if (body?.botcheck) {
    // Piège à robots déclenché : succès silencieux, rien n'est envoyé, pour ne pas alerter le bot.
    return json({ success: true });
  }

  for (const key of VOLUNTEER_REQUIRED_FIELDS) {
    if (typeof body?.[key] !== 'string' || !body[key].trim()) {
      return json({ success: false, message: 'Merci de remplir tous les champs obligatoires.' }, 422);
    }
  }

  if (!env.RESEND_API_KEY) {
    return json({ success: false, message: "L'envoi n'est pas encore configuré, réessayez plus tard ou écrivez-nous directement." }, 503);
  }

  if (env.DB) {
    try {
      // Enregistrement best-effort, comme pour foster_applications : l'email ci-dessous reste
      // le vrai critere de succes pour la personne qui candidate.
      await env.DB.prepare(
        `INSERT INTO volunteer_applications
         (nom_complet, telephone, email, modalite, competences, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      ).bind(
        body.nom_complet.trim(),
        body.telephone.trim(),
        body.email.trim(),
        body.modalite.trim(),
        body.competences.trim(),
        new Date().toISOString()
      ).run();
    } catch (err) {
      // Table pas encore creee ou base indisponible : ne bloque jamais l'envoi de l'email.
    }
  }

  const rows = Object.entries(VOLUNTEER_FIELD_LABELS)
    .filter(([key]) => typeof body[key] === 'string' && body[key].trim())
    .map(([key, label]) => {
      const value = escapeHtml(body[key].trim()).replace(/\n/g, '<br>');
      return `<tr><td style="padding:4px 14px 4px 0;font-weight:600;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;">${value}</td></tr>`;
    })
    .join('');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Dogcytocin et Racines <onboarding@resend.dev>',
        to: NOTIFICATION_EMAIL,
        reply_to: body.email.trim(),
        subject: `Nouvelle candidature bénévole — ${body.nom_complet.trim()}`,
        html: `<table cellpadding="0" cellspacing="0">${rows}</table>`,
      }),
    });

    if (!resendResponse.ok) {
      return json({ success: false, message: "L'envoi a échoué, réessayez ou écrivez-nous directement." }, 502);
    }

    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: "L'envoi a échoué, réessayez ou écrivez-nous directement." }, 502);
  }
}

async function handleGetComments(env, order) {
  if (!env.DB) return json({ comments: [] });
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, message, created_at, reply_message, reply_created_at FROM comments ORDER BY created_at ${direction}, id ${direction} LIMIT 100`
    ).all();
    return json({ comments: results });
  } catch (err) {
    // Base pas encore prête (ex. table absente) : on affiche une liste vide plutôt que de casser la page.
    return json({ comments: [] });
  }
}

async function handlePostComment(request, env) {
  if (!env.DB) {
    return json({ success: false, reason: 'unavailable', message: "Le livre d'or n'est pas encore branché, réessayez plus tard." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, reason: 'invalid', message: 'Message illisible, réessayez.' }, 400);
  }

  const { name, message, website } = body || {};

  if (website) {
    // Piège à robots déclenché : on répond succès (sans rien enregistrer) pour ne pas alerter le bot.
    return json({ success: true, comment: null });
  }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp(ip);

  const n = typeof name === 'string' ? name.trim() : '';
  const m = typeof message === 'string' ? message.trim() : '';

  if (n.length < 2 || n.length > 60 || m.length < 3 || m.length > 300) {
    await logRejected(env, n, m, 'invalid', ipHash);
    return json({
      success: false,
      reason: 'invalid',
      message: 'Vérifiez votre nom et votre message (le message doit faire entre 3 et 300 caractères).',
    }, 422);
  }

  if (looksLikeSpam(n, m)) {
    await logRejected(env, n, m, 'spam', ipHash);
    return json({
      success: false,
      reason: 'spam',
      message: "Votre message n'a pas pu être publié — évitez les liens ou mots-clés publicitaires.",
    }, 422);
  }

  if (looksInappropriate(n, m)) {
    await logRejected(env, n, m, 'inappropriate', ipHash);
    return json({
      success: false,
      reason: 'inappropriate',
      message: "Votre message n'a pas pu être publié — merci de rester respectueux.",
    }, 422);
  }

  try {
    // created_at est stocké au format ISO (toISOString) : on compare avec une borne
    // du même format plutôt que le format SQLite datetime(), pour que la comparaison
    // texte reste chronologiquement correcte.
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const check = await env.DB.prepare(
      'SELECT COUNT(*) as cnt, MAX(created_at) as last_at FROM comments WHERE ip_hash = ?1 AND created_at > ?2'
    ).bind(ipHash, oneHourAgoIso).first();

    if (check && check.cnt >= 5) {
      return json({
        success: false,
        reason: 'rate_limit',
        message: 'Vous avez déjà laissé plusieurs messages récemment — merci de patienter un peu.',
      }, 429);
    }

    if (check && check.last_at) {
      const lastMs = new Date(check.last_at).getTime();
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < 15000) {
        return json({
          success: false,
          reason: 'rate_limit',
          message: 'Un peu de patience — réessayez dans quelques secondes.',
        }, 429);
      }
    }

    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      'INSERT INTO comments (name, message, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4)'
    ).bind(n, m, createdAt, ipHash).run();

    const newComment = { id: insert.meta.last_row_id, name: n, message: m, created_at: createdAt };
    await sendCommentNotification(env, newComment);

    return json({ success: true, comment: newComment });
  } catch (err) {
    return json({
      success: false,
      reason: 'unavailable',
      message: "Le livre d'or n'est pas encore tout à fait prêt, réessayez un peu plus tard.",
    }, 503);
  }
}

async function checkAdminPassword(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return json({ success: false, message: "Secret ADMIN_PASSWORD non configuré côté serveur." }, 500);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp('admin:' + ip);

  if (env.DB) {
    try {
      const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const attempts = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM admin_attempts WHERE ip_hash = ?1 AND attempted_at > ?2 AND success = 0'
      ).bind(ipHash, tenMinAgoIso).first();

      if (attempts && attempts.cnt >= 5) {
        return json({ success: false, message: 'Trop de tentatives — réessaie dans 10 minutes.' }, 429);
      }
    } catch (err) {
      // Table pas encore créée ou base indisponible : on ne bloque pas sur le comptage, le mot de passe reste le vrai rempart.
    }
  }

  const password = request.headers.get('X-Admin-Password') || '';
  const ok = timingSafeEqual(password, env.ADMIN_PASSWORD);

  if (env.DB) {
    try {
      await env.DB.prepare(
        'INSERT INTO admin_attempts (ip_hash, attempted_at, success) VALUES (?1, ?2, ?3)'
      ).bind(ipHash, new Date().toISOString(), ok ? 1 : 0).run();
    } catch (err) {
      // idem : le suivi des tentatives est un bonus, pas une dépendance dure.
    }
  }

  if (!ok) {
    return json({ success: false, message: 'Mot de passe incorrect.' }, 401);
  }
  return null;
}

async function handleDeleteComment(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: "Base indisponible." }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM comments WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

async function handleReplyComment(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Message illisible.' }, 400);
  }

  const reply = typeof body?.reply === 'string' ? body.reply.trim() : '';

  if (reply.length > 1000) {
    return json({ success: false, message: 'La réponse est trop longue (1000 caractères max).' }, 422);
  }

  try {
    // Un champ vide efface la reponse existante (permet a l'admin de corriger une erreur sans endpoint dedie).
    const replyCreatedAt = reply ? new Date().toISOString() : null;
    await env.DB.prepare(
      'UPDATE comments SET reply_message = ?1, reply_created_at = ?2 WHERE id = ?3'
    ).bind(reply || null, replyCreatedAt, id).run();

    return json({
      success: true,
      reply: reply ? { message: reply, created_at: replyCreatedAt } : null,
    });
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de la réponse." }, 500);
  }
}

async function handleGetRejected(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) return json({ rejected: [] });

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, message, reason, created_at FROM rejected_comments ORDER BY id DESC LIMIT 100'
    ).all();
    return json({ rejected: results });
  } catch (err) {
    return json({ rejected: [] });
  }
}

async function handleGetStats(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  const empty = { totalComments: 0, totalBlocked: 0, thisMonth: 0, thisWeek: 0, latestComment: null, last7Days: [] };
  if (!env.DB) return json(empty);

  try {
    // sqlite_sequence.seq = plus grand id jamais attribue a la table (AUTOINCREMENT ne reutilise
    // jamais un id) : c'est donc le total historique reel, qui ne diminue jamais meme apres
    // suppression -- pas besoin d'un compteur separe a maintenir a la main.
    const [totalRow, blockedRow, latestRow] = await Promise.all([
      env.DB.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'comments'").first(),
      env.DB.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'rejected_comments'").first(),
      env.DB.prepare('SELECT name, created_at FROM comments ORDER BY id DESC LIMIT 1').first(),
    ]);

    const now = new Date();
    const startOfMonthIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const dayOfWeek = now.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeekIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday)).toISOString();

    const [monthRow, weekRow] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as cnt FROM comments WHERE created_at >= ?1').bind(startOfMonthIso).first(),
      env.DB.prepare('SELECT COUNT(*) as cnt FROM comments WHERE created_at >= ?1').bind(startOfWeekIso).first(),
    ]);

    // 7 derniers jours (aujourd'hui inclus), calendaires en UTC.
    const dayKeys = [];
    for (let i = 6; i >= 0; i--) {
      dayKeys.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)).toISOString().slice(0, 10));
    }
    const sevenDaysAgoIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)).toISOString();

    const { results: dayRows } = await env.DB.prepare(
      "SELECT substr(created_at, 1, 10) as day, COUNT(*) as cnt FROM comments WHERE created_at >= ?1 GROUP BY day"
    ).bind(sevenDaysAgoIso).all();

    const countsByDay = Object.fromEntries(dayRows.map((r) => [r.day, r.cnt]));
    const last7Days = dayKeys.map((day) => ({ date: day, count: countsByDay[day] || 0 }));

    return json({
      totalComments: totalRow?.seq || 0,
      totalBlocked: blockedRow?.seq || 0,
      thisMonth: monthRow?.cnt || 0,
      thisWeek: weekRow?.cnt || 0,
      latestComment: latestRow ? { name: latestRow.name, created_at: latestRow.created_at } : null,
      last7Days,
    });
  } catch (err) {
    return json(empty);
  }
}

const FOSTER_STATUSES = ['nouvelle', 'en_cours', 'acceptee', 'refusee'];

async function handleGetFosterApplications(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) return json({ applications: [] });

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nom_complet, telephone, email, type_logement, autres_animaux, details_autres_animaux,
              enfants_bas_age, experience_animaux, motivation, duree_disponibilite, status, created_at, notes
       FROM foster_applications ORDER BY id DESC LIMIT 200`
    ).all();
    return json({ applications: results });
  } catch (err) {
    // Table pas encore creee : on affiche une liste vide plutot que de casser la page.
    return json({ applications: [] });
  }
}

async function handleUpdateFosterStatus(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible.' }, 400);
  }

  if (!FOSTER_STATUSES.includes(body?.status)) {
    return json({ success: false, message: 'Statut invalide.' }, 400);
  }

  try {
    await env.DB.prepare('UPDATE foster_applications SET status = ?1 WHERE id = ?2')
      .bind(body.status, id).run();

    if (body.status === 'acceptee' || body.status === 'refusee') {
      const application = await env.DB.prepare(
        'SELECT nom_complet, email FROM foster_applications WHERE id = ?1'
      ).bind(id).first();
      if (application) await sendFosterStatusEmail(env, application, body.status);
    }

    return json({ success: true, status: body.status });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la mise à jour.' }, 500);
  }
}

async function handleUpdateFosterNotes(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible.' }, 400);
  }

  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';

  if (notes.length > 2000) {
    return json({ success: false, message: 'La note est trop longue (2000 caractères max).' }, 422);
  }

  try {
    await env.DB.prepare('UPDATE foster_applications SET notes = ?1 WHERE id = ?2')
      .bind(notes || null, id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement." }, 500);
  }
}

async function handleDeleteFosterApplication(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM foster_applications WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

async function handleGetVolunteerApplications(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) return json({ applications: [] });

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, nom_complet, telephone, email, modalite, competences, created_at
       FROM volunteer_applications ORDER BY id DESC LIMIT 200`
    ).all();
    return json({ applications: results });
  } catch (err) {
    // Table pas encore creee : on affiche une liste vide plutot que de casser la page.
    return json({ applications: [] });
  }
}

async function handleDeleteVolunteerApplication(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM volunteer_applications WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

async function handleApproveRejected(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    const row = await env.DB.prepare(
      'SELECT name, message FROM rejected_comments WHERE id = ?1'
    ).bind(id).first();

    if (!row) {
      return json({ success: false, message: 'Message introuvable (déjà traité ?).' }, 404);
    }

    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      'INSERT INTO comments (name, message, created_at, ip_hash) VALUES (?1, ?2, ?3, ?4)'
    ).bind(row.name, row.message, createdAt, null).run();

    await env.DB.prepare('DELETE FROM rejected_comments WHERE id = ?1').bind(id).run();

    return json({
      success: true,
      comment: { id: insert.meta.last_row_id, name: row.name, message: row.message, created_at: createdAt },
    });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la publication.' }, 500);
  }
}

async function handleDeleteRejected(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM rejected_comments WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

// Pas de stockage de fichiers (R2 nécessite un abonnement payant côté Cloudflare) : l'admin
// colle l'URL d'une image déjà hébergée ailleurs (ex: imgbb.com), on se contente de la valider
// et de la stocker telle quelle dans D1. Reutilisee par le blog ET les fiches chiens.
const IMAGE_URL_RE = /^https?:\/\/.+/i;
// Photo envoyee depuis la galerie du telephone (voir handleUploadMedia plus bas) plutot qu'une
// URL externe -- meme champ image_url, juste une valeur interne au lieu d'un lien http(s).
const MEDIA_URL_RE = /^\/media\/\d+$/;

// Certains services generent des liens de miniature basse resolution avec la taille encodee
// dans l'URL elle-meme (parametre de requete ou nom de fichier) -- on la remonte automatiquement
// a l'enregistrement, pour eviter des photos floues une fois agrandies dans les cartes du site
// (chiens ET blog), sans que l'admin ait besoin d'y penser ou de retrouver la source originale.
const IMAGE_UPGRADE_TARGET_SIZE = 1200;

function upgradeImageUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  // Miniatures Bing Images (th.bing.com/th/id/...?w=285&h=180...) : la taille est un
  // parametre de requete classique, on la remonte directement.
  if (parsed.hostname === 'th.bing.com') {
    let changed = false;
    for (const param of ['w', 'h']) {
      const current = Number(parsed.searchParams.get(param));
      if (current && current < IMAGE_UPGRADE_TARGET_SIZE) {
        parsed.searchParams.set(param, String(IMAGE_UPGRADE_TARGET_SIZE));
        changed = true;
      }
    }
    return changed ? parsed.toString() : url;
  }

  // Miniatures Wikimedia/Wikipedia (.../thumb/x/xx/Fichier.jpg/320px-Fichier.jpg) : la taille
  // est encodee dans le nom du fichier final, sous forme de prefixe "NNNpx-".
  if (parsed.hostname.endsWith('wikimedia.org') && parsed.pathname.includes('/thumb/')) {
    const upgraded = parsed.pathname.replace(/\/(\d+)px-([^/]+)$/, (match, size, filename) => (
      Number(size) < IMAGE_UPGRADE_TARGET_SIZE ? `/${IMAGE_UPGRADE_TARGET_SIZE}px-${filename}` : match
    ));
    if (upgraded === parsed.pathname) return url;
    parsed.pathname = upgraded;
    return parsed.toString();
  }

  return url;
}

function validateImageUrl(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: true, value: null };
  if (value.length > 2000) return { ok: false };
  if (MEDIA_URL_RE.test(value)) return { ok: true, value };
  if (!IMAGE_URL_RE.test(value)) return { ok: false };
  return { ok: true, value: upgradeImageUrl(value) };
}

const MEDIA_MIME_TYPES = { 'image/jpeg': true, 'image/png': true, 'image/webp': true };
// Marge sous la limite de 2 Mo/ligne de D1 -- laisse de la place pour le reste de la ligne et
// pour le gonflement d'environ 33% du base64 par rapport aux octets bruts. Le navigateur
// redimensionne/compresse deja la photo avant l'envoi (voir script.js), cette limite ne sert
// qu'a se proteger d'un appel direct a l'API qui ignorerait cette etape.
const MEDIA_MAX_BASE64_LENGTH = 1_400_000;

// Upload depuis la galerie du telephone : alternative a une URL externe pour la photo d'un
// article de blog ou d'une fiche chien (meme champ image_url cote formulaire, cf validateImageUrl).
async function handleUploadMedia(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  const mime = typeof body.mime === 'string' ? body.mime : '';
  const data = typeof body.data === 'string' ? body.data : '';

  if (!MEDIA_MIME_TYPES[mime]) {
    return json({ success: false, message: 'Format invalide : seuls les fichiers JPG, PNG et WEBP sont acceptés.' }, 422);
  }
  if (!data || data.length > MEDIA_MAX_BASE64_LENGTH || !/^[A-Za-z0-9+/]+=*$/.test(data)) {
    return json({ success: false, message: "L'image est trop volumineuse ou illisible, réessayez avec une photo plus légère." }, 422);
  }

  try {
    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      'INSERT INTO media (data, mime, created_at) VALUES (?1, ?2, ?3)'
    ).bind(data, mime, createdAt).run();

    return json({ success: true, url: `/media/${insert.meta.last_row_id}` });
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de la photo." }, 500);
  }
}

async function handleGetMedia(env, id) {
  if (!/^\d+$/.test(id) || !env.DB) return new Response('Introuvable', { status: 404 });

  try {
    const row = await env.DB.prepare('SELECT data, mime FROM media WHERE id = ?1').bind(id).first();
    if (!row) return new Response('Introuvable', { status: 404 });

    const binary = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
    return new Response(binary, {
      headers: {
        'Content-Type': row.mime,
        // Identifiant numerique jamais reutilise ni modifie : le contenu a cette URL ne change jamais.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return new Response('Introuvable', { status: 404 });
  }
}

async function handleCreateBlogPost(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!title || title.length > 200) {
    return json({ success: false, message: 'Le titre est obligatoire (200 caractères max).' }, 422);
  }
  if (!content) {
    return json({ success: false, message: 'Le contenu est obligatoire.' }, 422);
  }
  if (content.length > 20000) {
    return json({ success: false, message: 'Le contenu dépasse 20 000 caractères, raccourcissez-le.' }, 422);
  }

  const imageUrlResult = validateImageUrl(body.image_url);
  if (!imageUrlResult.ok) {
    return json({ success: false, message: "L'URL de l'image doit commencer par http:// ou https://." }, 422);
  }
  const imageUrl = imageUrlResult.value;

  try {
    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      'INSERT INTO blog_posts (title, content, image_url, created_at) VALUES (?1, ?2, ?3, ?4)'
    ).bind(title, content, imageUrl, createdAt).run();

    return json({
      success: true,
      post: { id: insert.meta.last_row_id, title, content, image_url: imageUrl, created_at: createdAt },
    });
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de l'article." }, 500);
  }
}

function toPublicBlogPost(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    image_url: row.image_url || null,
    created_at: row.created_at,
  };
}

// Liste publique : un article publié est un contenu public par nature (comme les commentaires),
// reutilisee telle quelle par la page "Actualites" du site ET par le panel admin (qui se contente
// de ne rien en afficher tant qu'aucune session admin n'est memorisee, cote client).
async function handleListBlogPosts(env) {
  if (!env.DB) return json({ posts: [] });

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, title, content, image_url, created_at FROM blog_posts ORDER BY id DESC LIMIT 200'
    ).all();
    return json({ posts: results.map(toPublicBlogPost) });
  } catch (err) {
    return json({ posts: [] });
  }
}

async function handleUpdateBlogPost(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!title || title.length > 200) {
    return json({ success: false, message: 'Le titre est obligatoire (200 caractères max).' }, 422);
  }
  if (!content) {
    return json({ success: false, message: 'Le contenu est obligatoire.' }, 422);
  }
  if (content.length > 20000) {
    return json({ success: false, message: 'Le contenu dépasse 20 000 caractères, raccourcissez-le.' }, 422);
  }

  const imageUrlResult = validateImageUrl(body.image_url);
  if (!imageUrlResult.ok) {
    return json({ success: false, message: "L'URL de l'image doit commencer par http:// ou https://." }, 422);
  }
  const imageUrl = imageUrlResult.value;

  let existing;
  try {
    existing = await env.DB.prepare('SELECT id FROM blog_posts WHERE id = ?1').bind(id).first();
  } catch (err) {
    return json({ success: false, message: "Erreur lors de la lecture de l'article." }, 500);
  }
  if (!existing) {
    return json({ success: false, message: 'Article introuvable (déjà supprimé ?).' }, 404);
  }

  try {
    await env.DB.prepare('UPDATE blog_posts SET title = ?1, content = ?2, image_url = ?3 WHERE id = ?4')
      .bind(title, content, imageUrl, id).run();
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de l'article." }, 500);
  }

  const row = await env.DB.prepare(
    'SELECT id, title, content, image_url, created_at FROM blog_posts WHERE id = ?1'
  ).bind(id).first();

  return json({ success: true, post: toPublicBlogPost(row) });
}

async function handleDeleteBlogPost(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM blog_posts WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

// Statuts affiches sur les fiches chiens de la page publique (tampon dore "A l'adoption"
// vs badge vert "Bientot") -- ces valeurs sont aussi celles utilisees par le filtre client
// (data-status) et doivent donc rester synchronisees avec nos-chiens.html / script.js.
const DOG_STATUSES = ['adoption', 'bientot'];

function toPublicDog(row) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    size: row.size,
    description: row.description,
    status: row.status,
    image_url: row.image_url || null,
    created_at: row.created_at,
  };
}

async function handleListDogs(env) {
  if (!env.DB) return json({ dogs: [] });

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, age, size, description, status, image_url, created_at FROM dogs ORDER BY id DESC LIMIT 200'
    ).all();
    return json({ dogs: results.map(toPublicDog) });
  } catch (err) {
    return json({ dogs: [] });
  }
}

async function handleCreateDog(request, env) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const age = typeof body.age === 'string' ? body.age.trim() : '';
  const size = typeof body.size === 'string' ? body.size.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!name || name.length > 100) {
    return json({ success: false, message: 'Le nom est obligatoire (100 caractères max).' }, 422);
  }
  if (!age || age.length > 50) {
    return json({ success: false, message: "L'âge est obligatoire (50 caractères max)." }, 422);
  }
  if (!size || size.length > 50) {
    return json({ success: false, message: 'La taille est obligatoire (50 caractères max).' }, 422);
  }
  if (!description || description.length > 1000) {
    return json({ success: false, message: 'La description est obligatoire (1000 caractères max).' }, 422);
  }
  if (!DOG_STATUSES.includes(status)) {
    return json({ success: false, message: 'Statut invalide.' }, 422);
  }

  const imageUrlResult = validateImageUrl(body.image_url);
  if (!imageUrlResult.ok) {
    return json({ success: false, message: "L'URL de l'image doit commencer par http:// ou https://." }, 422);
  }
  const imageUrl = imageUrlResult.value;

  try {
    const createdAt = new Date().toISOString();
    const insert = await env.DB.prepare(
      'INSERT INTO dogs (name, age, size, description, status, image_url, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ).bind(name, age, size, description, status, imageUrl, createdAt).run();

    return json({
      success: true,
      dog: { id: insert.meta.last_row_id, name, age, size, description, status, image_url: imageUrl, created_at: createdAt },
    });
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de la fiche." }, 500);
  }
}

async function handleUpdateDog(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, message: 'Requête illisible, réessayez.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const age = typeof body.age === 'string' ? body.age.trim() : '';
  const size = typeof body.size === 'string' ? body.size.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const status = typeof body.status === 'string' ? body.status.trim() : '';

  if (!name || name.length > 100) {
    return json({ success: false, message: 'Le nom est obligatoire (100 caractères max).' }, 422);
  }
  if (!age || age.length > 50) {
    return json({ success: false, message: "L'âge est obligatoire (50 caractères max)." }, 422);
  }
  if (!size || size.length > 50) {
    return json({ success: false, message: 'La taille est obligatoire (50 caractères max).' }, 422);
  }
  if (!description || description.length > 1000) {
    return json({ success: false, message: 'La description est obligatoire (1000 caractères max).' }, 422);
  }
  if (!DOG_STATUSES.includes(status)) {
    return json({ success: false, message: 'Statut invalide.' }, 422);
  }

  const imageUrlResult = validateImageUrl(body.image_url);
  if (!imageUrlResult.ok) {
    return json({ success: false, message: "L'URL de l'image doit commencer par http:// ou https://." }, 422);
  }
  const imageUrl = imageUrlResult.value;

  let existing;
  try {
    existing = await env.DB.prepare('SELECT id FROM dogs WHERE id = ?1').bind(id).first();
  } catch (err) {
    return json({ success: false, message: "Erreur lors de la lecture de la fiche." }, 500);
  }
  if (!existing) {
    return json({ success: false, message: 'Fiche introuvable (déjà supprimée ?).' }, 404);
  }

  try {
    await env.DB.prepare('UPDATE dogs SET name = ?1, age = ?2, size = ?3, description = ?4, status = ?5, image_url = ?6 WHERE id = ?7')
      .bind(name, age, size, description, status, imageUrl, id).run();
  } catch (err) {
    return json({ success: false, message: "Erreur lors de l'enregistrement de la fiche." }, 500);
  }

  const row = await env.DB.prepare(
    'SELECT id, name, age, size, description, status, image_url, created_at FROM dogs WHERE id = ?1'
  ).bind(id).first();

  return json({ success: true, dog: toPublicDog(row) });
}

async function handleDeleteDog(request, env, id) {
  const authError = await checkAdminPassword(request, env);
  if (authError) return authError;

  if (!/^\d+$/.test(id)) {
    return json({ success: false, message: 'Identifiant invalide.' }, 400);
  }
  if (!env.DB) {
    return json({ success: false, message: 'Base indisponible.' }, 503);
  }

  try {
    await env.DB.prepare('DELETE FROM dogs WHERE id = ?1').bind(id).run();
    return json({ success: true });
  } catch (err) {
    return json({ success: false, message: 'Erreur lors de la suppression.' }, 500);
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/version') {
        return withSecurityHeaders(json({ version: WORKER_VERSION }));
      }

      if (url.pathname === '/api/foster-application') {
        if (request.method === 'POST') return withSecurityHeaders(await handleFosterApplication(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/volunteer-application') {
        if (request.method === 'POST') return withSecurityHeaders(await handleVolunteerApplication(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/comments') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetComments(env, url.searchParams.get('order')));
        if (request.method === 'POST') return withSecurityHeaders(await handlePostComment(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/verify') {
        if (request.method !== 'POST') return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
        const authError = await checkAdminPassword(request, env);
        return withSecurityHeaders(authError || json({ success: true }));
      }

      const commentIdMatch = url.pathname.match(/^\/api\/comments\/(\d+)$/);
      if (commentIdMatch) {
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteComment(request, env, commentIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const replyMatch = url.pathname.match(/^\/api\/comments\/(\d+)\/reply$/);
      if (replyMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleReplyComment(request, env, replyMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/rejected') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetRejected(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/stats') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetStats(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const approveMatch = url.pathname.match(/^\/api\/admin\/rejected\/(\d+)\/approve$/);
      if (approveMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleApproveRejected(request, env, approveMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const rejectedIdMatch = url.pathname.match(/^\/api\/admin\/rejected\/(\d+)$/);
      if (rejectedIdMatch) {
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteRejected(request, env, rejectedIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/foster-applications') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetFosterApplications(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const fosterStatusMatch = url.pathname.match(/^\/api\/admin\/foster-applications\/(\d+)\/status$/);
      if (fosterStatusMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleUpdateFosterStatus(request, env, fosterStatusMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const fosterNotesMatch = url.pathname.match(/^\/api\/admin\/foster-applications\/(\d+)\/notes$/);
      if (fosterNotesMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleUpdateFosterNotes(request, env, fosterNotesMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const fosterIdMatch = url.pathname.match(/^\/api\/admin\/foster-applications\/(\d+)$/);
      if (fosterIdMatch) {
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteFosterApplication(request, env, fosterIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/volunteer-applications') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetVolunteerApplications(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const volunteerIdMatch = url.pathname.match(/^\/api\/admin\/volunteer-applications\/(\d+)$/);
      if (volunteerIdMatch) {
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteVolunteerApplication(request, env, volunteerIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/blog-posts') {
        if (request.method === 'GET') return withSecurityHeaders(await handleListBlogPosts(env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/blog-posts') {
        if (request.method === 'POST') return withSecurityHeaders(await handleCreateBlogPost(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const blogPostIdMatch = url.pathname.match(/^\/api\/admin\/blog-posts\/(\d+)$/);
      if (blogPostIdMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleUpdateBlogPost(request, env, blogPostIdMatch[1]));
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteBlogPost(request, env, blogPostIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/dogs') {
        if (request.method === 'GET') return withSecurityHeaders(await handleListDogs(env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/dogs') {
        if (request.method === 'POST') return withSecurityHeaders(await handleCreateDog(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const dogIdMatch = url.pathname.match(/^\/api\/admin\/dogs\/(\d+)$/);
      if (dogIdMatch) {
        if (request.method === 'POST') return withSecurityHeaders(await handleUpdateDog(request, env, dogIdMatch[1]));
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteDog(request, env, dogIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      if (url.pathname === '/api/admin/media') {
        if (request.method === 'POST') return withSecurityHeaders(await handleUploadMedia(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const mediaIdMatch = url.pathname.match(/^\/media\/(\d+)$/);
      if (mediaIdMatch) {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetMedia(env, mediaIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response);
    } catch (err) {
      return withSecurityHeaders(json({ success: false, message: 'Erreur inattendue, réessayez.' }, 500));
    }
  },
};
