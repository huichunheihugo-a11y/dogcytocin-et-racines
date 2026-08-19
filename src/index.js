const NOTIFY_EMAIL = 'dogcytocin@hotmail.com';

function buildEmailBody(fields) {
  const animauxLine = fields.details_autres_animaux
    ? `${fields.autres_animaux} (${fields.details_autres_animaux})`
    : fields.autres_animaux;

  return `Nouvelle candidature famille d'accueil

Nom complet : ${fields.nom_complet}
Téléphone : ${fields.telephone}
Email : ${fields.email}
Type de logement : ${fields.type_logement}
Autres animaux : ${animauxLine}
Enfants en bas âge : ${fields.enfants_bas_age}

Expérience avec les animaux :
${fields.experience_animaux}

Pourquoi devenir famille d'accueil :
${fields.motivation}

Durée de disponibilité : ${fields.duree_disponibilite}
`;
}

async function handleFamilleAccueil(request, env) {
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Requête invalide' }), { status: 400 });
  }

  // Piège à robots : on répond OK sans rien envoyer si le champ caché est rempli
  if (formData.get('bot-field')) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  const fields = {
    nom_complet: formData.get('nom_complet') || '',
    telephone: formData.get('telephone') || '',
    email: formData.get('email') || '',
    type_logement: formData.get('type_logement') || '',
    autres_animaux: formData.get('autres_animaux') || '',
    details_autres_animaux: formData.get('details_autres_animaux') || '',
    enfants_bas_age: formData.get('enfants_bas_age') || '',
    experience_animaux: formData.get('experience_animaux') || '',
    motivation: formData.get('motivation') || '',
    duree_disponibilite: formData.get('duree_disponibilite') || '',
  };

  if (!fields.nom_complet || !fields.email) {
    return new Response(JSON.stringify({ error: 'Champs requis manquants' }), { status: 400 });
  }

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'Configuration email manquante' }), { status: 500 });
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Dogcytocin et Racines <onboarding@resend.dev>',
      to: NOTIFY_EMAIL,
      reply_to: fields.email,
      subject: `Nouvelle candidature famille d'accueil — ${fields.nom_complet}`,
      text: buildEmailBody(fields),
    }),
  });

  if (!resendResponse.ok) {
    const detail = await resendResponse.text();
    return new Response(JSON.stringify({ error: "Échec de l'envoi", detail }), { status: 502 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/famille-accueil' && request.method === 'POST') {
      return handleFamilleAccueil(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
