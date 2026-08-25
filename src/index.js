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

function looksLikeSpam(name, message) {
  const combined = (name + ' ' + message).toLowerCase();
  if (SPAM_WORDS.some((word) => combined.includes(word))) return true;
  if (/\b[\w-]+\.(com|net|org|fr|info|biz|ru|xyz|top|click|shop)\b/.test(combined)) return true;
  return false;
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

  const n = typeof name === 'string' ? name.trim() : '';
  const m = typeof message === 'string' ? message.trim() : '';

  if (n.length < 2 || n.length > 60 || m.length < 3 || m.length > 600) {
    return json({
      success: false,
      reason: 'invalid',
      message: 'Vérifiez votre nom et votre message (le message doit faire entre 3 et 600 caractères).',
    }, 422);
  }

  if (looksLikeSpam(n, m)) {
    return json({
      success: false,
      reason: 'spam',
      message: "Votre message n'a pas pu être publié — évitez les liens ou mots-clés publicitaires.",
    }, 422);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp(ip);

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

async function handleDeleteComment(request, env, id) {
  if (!env.ADMIN_PASSWORD) {
    return json({ success: false, message: "Secret ADMIN_PASSWORD non configuré côté serveur." }, 500);
  }

  const password = request.headers.get('X-Admin-Password') || '';
  if (password !== env.ADMIN_PASSWORD) {
    return json({ success: false, message: 'Mot de passe incorrect.' }, 401);
  }

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

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/api/comments') {
        if (request.method === 'GET') return withSecurityHeaders(await handleGetComments(env));
        if (request.method === 'POST') return withSecurityHeaders(await handlePostComment(request, env));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const commentIdMatch = url.pathname.match(/^\/api\/comments\/(\d+)$/);
      if (commentIdMatch) {
        if (request.method === 'DELETE') return withSecurityHeaders(await handleDeleteComment(request, env, commentIdMatch[1]));
        return withSecurityHeaders(json({ success: false, message: 'Méthode non supportée' }, 405));
      }

      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response);
    } catch (err) {
      return withSecurityHeaders(json({ success: false, message: 'Erreur inattendue, réessayez.' }, 500));
    }
  },
};
