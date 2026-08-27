// Sert uniquement a verifier qu'un deploiement est bien en ligne (via GET /api/version)
// sans jamais avoir a tester avec une vraie requete qui ecrit des donnees (ex: POST /api/comments).
// A incrementer a chaque changement cote Worker qui doit etre confirme avant tout autre test.
const WORKER_VERSION = '2026-08-26.7';

// Adresse qui recoit une notification a chaque nouveau message du livre d'or.
// Pas un secret (visible aussi en pied de page du site) -- seule la cle API Resend
// (env.RESEND_API_KEY, un Cloudflare secret) ne doit jamais apparaitre dans le code.
const NOTIFICATION_EMAIL = 'huichunheihugo@gmail.com';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://api.web3forms.com",
  "form-action 'self' https://api.web3forms.com",
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

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/version') {
        return withSecurityHeaders(json({ version: WORKER_VERSION }));
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

      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response);
    } catch (err) {
      return withSecurityHeaders(json({ success: false, message: 'Erreur inattendue, réessayez.' }, 500));
    }
  },
};
