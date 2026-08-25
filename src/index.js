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
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
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
  const combined = (name + ' ' + message).toLowerCase();
  if (SPAM_WORDS.some((word) => combined.includes(word))) return true;
  if (/\b[\w-]+\.(com|net|org|fr|info|biz|ru|xyz|top|click|shop)\b/.test(combined)) return true;
  return false;
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

async function handleGetComments(env) {
  if (!env.DB) return json({ comments: [] });
  try {
    const { results } = await env.DB.prepare(
      'SELECT id, name, message, created_at FROM comments ORDER BY id DESC LIMIT 100'
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

  if (n.length < 2 || n.length > 60 || m.length < 3 || m.length > 600) {
    await logRejected(env, n, m, 'invalid', ipHash);
    return json({
      success: false,
      reason: 'invalid',
      message: 'Vérifiez votre nom et votre message (le message doit faire entre 3 et 600 caractères).',
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

    return json({
      success: true,
      comment: { id: insert.meta.last_row_id, name: n, message: m, created_at: createdAt },
    });
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

      if (url.pathname === '/api/comments') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetComments(env));
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

      if (url.pathname === '/api/admin/rejected') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetRejected(request, env));
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
