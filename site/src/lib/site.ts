// Réglages du site bnia.lab — à compléter ici, une seule fois.

/** Adresse mail pro. Laisser vide tant qu'elle n'existe pas : le site renvoie alors vers Instagram. */
export const CONTACT_EMAIL = "";

export const INSTAGRAM_URL = "https://www.instagram.com/bnia.lab";
export const INSTAGRAM_HANDLE = "@bnia.lab";

/** Mentions légales : à remplir dès que l'activité est déclarée. */
export const LEGAL = {
  responsable: "[Prénom Nom]",
  statut: "entrepreneur individuel (micro-entreprise)",
  siret: "[numéro SIRET]",
  adresse: "[adresse postale ou de domiciliation]",
  tva: "TVA non applicable, article 293 B du CGI",
};

/** Préfixe des fichiers de public/ (le site est servi sous /bnia-lab sur GitHub Pages). */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;

export const contactHref = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : INSTAGRAM_URL;
