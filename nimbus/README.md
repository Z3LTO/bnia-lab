# ☁ Nimbus : tous tes clouds gratuits dans un seul coffre chiffré

Nimbus est une application web installable (PWA) pour PC, Android et iPhone. Elle réunit l'espace gratuit de plusieurs clouds
(MEGA 20 Go, Google Drive 15 Go, pCloud jusqu'à 10 Go, OneDrive 5 Go, Dropbox 2 Go : ≈ 52 Go, et plus avec plusieurs comptes par service) et y répartit automatiquement
tes photos, vidéos et dossiers.

## Comment ça marche

- **Connexion simple, sans mot de passe à inventer** : l'utilisateur appuie sur « Continuer avec Google » (ou Microsoft, MEGA,
  pCloud, Dropbox). Ce compte devient son **compte principal**. Ensuite, un parcours guidé l'aide à brancher ses autres clouds :
  - **« J'ai déjà un compte »** : connexion en un clic. Nimbus n'utilise que l'**espace libre restant**, dans **son propre dossier**,
    et n'a pas accès aux fichiers existants.
  - **« Créer un compte gratuit »** : ouvre la page d'inscription officielle, puis le bouton devient « Compte créé ? Connecter → ».
  - Le même compte connecté deux fois est fusionné automatiquement.
- **Répartition automatique** : chaque fichier part sur le cloud qui a le plus d'espace libre (on garde 300 Mo de marge).
  Les gros fichiers (vidéos) sont découpés en morceaux de 32 Mo qui peuvent aller sur des clouds différents.
- **Pas de doublons** : un fichier déjà envoyé (même nom, taille et date) est ignoré. On peut donc renvoyer toute sa galerie.
- **Sécurité** : chaque espace a sa propre clé de chiffrement aléatoire (AES-256-GCM), créée à la première connexion et rangée
  dans le compte principal (fichier `Nimbus/nimbus-cle.json`). Les fichiers sont chiffrés **sur l'appareil, avant l'envoi** :
  les autres clouds ne voient que des fichiers `xxxx.bin` illisibles, et le catalogue (noms, dossiers) est lui aussi chiffré.
  Conseil à donner aux utilisateurs : activer la double authentification sur le compte principal.
  **Aucun serveur Nimbus** : tout va directement de l'appareil vers chaque cloud.
- **PC ⇄ téléphone** : sur un nouvel appareil, on se reconnecte avec le même compte principal, et tout réapparaît.
- **Déconnexion** (bouton ⏻) : efface tout de l'appareil. Les fichiers restent sur les clouds.
- **Android** : une fois l'appli installée, « Partager » depuis la Galerie affiche **Nimbus** et envoie directement les photos.
- **PC** : glisser-déposer, ou envoi d'un dossier entier avec ses sous-dossiers.

## Guide d'inscription (pour les utilisateurs)

L'appli contient un **parcours express** : ≈ 52 Go gratuits en ≈ 7 minutes, dans l'ordre le plus rentable.

| # | Cloud | Gratuit | Temps | Astuce |
|---|---|---|---|---|
| 1 | Google Drive | 15 Go | 0 min avec une Gmail | Déjà inclus avec Gmail |
| 2 | MEGA | 20 Go | ≈ 2 min | E-mail + mot de passe + clic dans l'e-mail de confirmation |
| 3 | pCloud | jusqu'à 10 Go | ≈ 1 min | « Continuer avec Google » ; les 10 Go se débloquent avec de petites actions |
| 4 | OneDrive | 5 Go | 0 min avec Hotmail/Outlook | Sinon, compte Microsoft créé avec sa Gmail |
| 5 | Dropbox | 2 Go | ≈ 1 min | « Continuer avec Google » |

Pour aller plus vite : la même adresse e-mail partout, « Continuer avec Google » dès que c'est proposé, et le gestionnaire de
mots de passe du navigateur. Pas besoin de tout faire d'un coup : Google + MEGA = 35 Go.

## Mise en ligne (GitHub Pages, gratuit)

1. Copie le dossier `nimbus/` dans ton dépôt (ex. `Z3LTO/bnia-lab`) → l'appli sera sur `https://z3lto.github.io/bnia-lab/nimbus/`.
2. Note cette URL **exacte, avec le `/` final** : c'est ton **URL de redirection**. Pour tester en local :
   `python3 -m http.server 8080` dans le dossier, puis `http://localhost:8080/`.
3. Crée les 4 identifiants ci-dessous et colle-les dans `config.js`. **MEGA ne demande aucun identifiant** : il marche tout de suite.

### Google Drive
1. https://console.cloud.google.com → crée un projet « Nimbus ».
2. « API et services » → Bibliothèque → active **Google Drive API**.
3. « Écran de consentement OAuth » → Externe → nom de l'appli, e-mail → champs d'application : `drive.file` et `userinfo.email`.
   Tant que l'appli est « en test », ajoute les adresses Gmail des testeurs (100 max). Publie-la ensuite pour l'ouvrir à tous
   (`drive.file` est un droit non sensible : validation légère).
4. Identifiants → Créer → **ID client OAuth** → **Application Web**
   - Origines JavaScript autorisées : `https://z3lto.github.io` (et `http://localhost:8080` pour tester)
   - URI de redirection autorisés : `https://z3lto.github.io/bnia-lab/nimbus/`
5. Copie l'**ID client** dans `config.js` → `google.clientId`.

### OneDrive (Microsoft)
1. https://entra.microsoft.com → Applications → **Inscriptions d'applications** → Nouvelle inscription.
2. Types de comptes : **Comptes Microsoft personnels uniquement**.
3. Redirection : plateforme **Application monopage (SPA)** → `https://z3lto.github.io/bnia-lab/nimbus/`.
4. Autorisations d'API → Microsoft Graph → Délégué : `Files.ReadWrite.AppFolder`, `User.Read`, `offline_access`.
5. Copie l'**ID d'application (client)** dans `config.js` → `onedrive.clientId`.

### Dropbox
1. https://www.dropbox.com/developers/apps → Create app → **Scoped access** → **App folder** → nom « Nimbus ».
2. Onglet **Permissions** : coche `files.content.write`, `files.content.read`, `account_info.read` → Submit.
3. Onglet **Settings** : Redirect URIs → ajoute `https://z3lto.github.io/bnia-lab/nimbus/` ;
   « Allow public clients (Implicit Grant & PKCE) » → **Allow**.
4. Copie l'**App key** dans `config.js` → `dropbox.clientId`.
   (En mode développement : 50 utilisateurs max ; demande le passage en « Production » pour ouvrir à tous.)

### pCloud
1. Connecte-toi sur https://docs.pcloud.com → **My applications** → New app.
2. Redirect URIs : `https://z3lto.github.io/bnia-lab/nimbus/`.
3. Accès : écriture sur un dossier d'application (ou « Private app folder »).
4. Copie le **Client ID** dans `config.js` → `pcloud.clientId`.

### MEGA
Rien à configurer. L'utilisateur se connecte une fois avec son e-mail et son mot de passe MEGA (directement avec MEGA,
via la bibliothèque open source `megajs` incluse dans `vendor/`). Le mot de passe n'est jamais enregistré : seule la session est gardée sur l'appareil.

## Limites de cette V1 (sans serveur)

- **Google** donne des sessions d'1 h sans serveur : après ça, un bouton « Reconnecter » apparaît (un clic).
  Pendant un gros envoi, Nimbus continue automatiquement sur les autres clouds.
- **OneDrive** : reconnexion environ toutes les 24 h (règle Microsoft pour les applis 100 % navigateur).
- Sur téléphone, garde l'écran allumé pendant un gros envoi (Nimbus bloque la mise en veille quand le navigateur le permet).
- Il n'y a pas de copie de secours : un fichier est sur un seul cloud. Si tu retires ce cloud, le fichier devient inaccessible.
- pCloud et MEGA gardent la connexion sans limite de durée.
- kDrive, Koofr, Box, Filen et Icedrive ont besoin d'un petit serveur : prévu en V2.

## Pistes V2

- Petit backend (ex. Supabase Edge Functions) pour garder des sessions permanentes et ajouter kDrive, Koofr, Box, Filen.
- Option « copie de secours » : chaque fichier sur 2 clouds.
- Compte Nimbus (e-mail) pour retrouver la liste de ses clouds sur un nouvel appareil sans rien reconnecter.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css` | Interface |
| `app.js` | Coffre, catalogue, envoi/répartition, synchro, visionneuse |
| `providers.js` | Connecteurs Google Drive, OneDrive, Dropbox, pCloud (OAuth 2), MEGA, et le guide d'inscription |
| `vendor/megajs.mjs` | Bibliothèque MEGA (licence MIT) |
| `crypto.js` | Chiffrement AES-256-GCM / PBKDF2 |
| `db.js` | Stockage local (IndexedDB) |
| `sw.js`, `manifest.webmanifest` | Installation, mode hors-ligne, partage depuis la galerie Android |
| `config.js` | **Tes identifiants (à remplir)** |
