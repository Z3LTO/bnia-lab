# bnia.lab — site vitrine (source)

Source Next.js + Tailwind de la page d'accueil de bnia.lab, exportée en site statique.
Les fichiers construits sont copiés à la racine du dépôt, où GitHub Pages les sert
(à côté de `tampon/` et `courtier/`, qui ne sont pas touchés).

## À compléter

Tout se règle dans `src/lib/site.ts` :
- `CONTACT_EMAIL` : l'adresse pro (vide = les boutons renvoient vers Instagram) ;
- `LEGAL` : nom, SIRET et adresse pour les mentions légales.

## Publier une modification

```bash
cd site
npm install
NEXT_PUBLIC_BASE_PATH=/bnia-lab npm run build
cp -r out/. ..          # copie le site construit à la racine du dépôt
```

Puis commit + push sur `main`. Avec un nom de domaine perso, construire sans `NEXT_PUBLIC_BASE_PATH`.
