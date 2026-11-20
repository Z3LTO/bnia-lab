// ─────────────────────────────────────────────────────────────
//  Nimbus — configuration
//  Colle ici les identifiants (Client ID) obtenus chez chaque
//  fournisseur (voir README.md). Ces identifiants sont PUBLICS :
//  aucune clé secrète n'est nécessaire, tout se passe dans le
//  navigateur de l'utilisateur.
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  appFolder: 'Nimbus',                 // dossier créé chez Google Drive
  chunkSize: 32 * 1024 * 1024,         // les gros fichiers sont découpés en morceaux de 32 Mo
  safetyMargin: 300 * 1024 * 1024,     // on laisse toujours 300 Mo libres sur chaque cloud

  google:   { clientId: '' },          // ex. 1234-abcd.apps.googleusercontent.com
  onedrive: { clientId: '' },          // ex. 00000000-0000-0000-0000-000000000000
  dropbox:  { clientId: '' },          // « App key » Dropbox
};
