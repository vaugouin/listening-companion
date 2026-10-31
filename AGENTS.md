# AGENTS.md

## Projet

Hors Champ est le compagnon visuel et muet de podcasts cinéma décrit dans
`Nestor/projets/t2s-backlog/app-ideas-001-listening-companion.md`.
Ne pas committer ni pousser sans demande. Lancement, configuration, déploiement,
contrats et vérifications : `readme.md`.

## Conventions

L'interface et la documentation sont en français. Fichiers applicatifs en minuscules
avec tirets. Chaque dossier source possède AGENTS.md et CLAUDE.md ; les dossiers
générés (`node_modules`, `dist`, `.git`) sont exclus de cette convention.
CLAUDE.md est uniquement un pointeur.

## Secrets

Ne jamais afficher, copier ni recopier une clé API. La clé OpenAI et la clé métier
Text2SQL sont distinctes ; `.env.local` ne contient qu'un chemin de fichier externe
et le port. Aucun fichier .env n'entre dans le contexte Docker.

## Pièges

- Sous le bac à sable Windows, le binaire esbuild peut refuser la traversée des
  parents. La compilation réussit hors sandbox ; ce n'est pas une erreur TypeScript.
- Les critères ET, les branches et les identifiants montrés sont la source de vérité.
  Le modèle peut confondre personne et films d'un réalisateur, ou ouvrir une pile
  sur « Et chez Godard » : la politique applicative (`server/statement-policy.ts`)
  doit conserver les marqueurs de continuité, retour et correction ; voir ses tests.
- L'extraction suit une file ordonnée ; les recherches ne bloquent pas l'écoute.
  La consultation de l'historique ne change jamais la tête de traitement en direct.
- Une exportation doit hydrater les cartes manquantes et n'exporter que celles de
  la séance choisie.
- `npm test` reste sans réseau et sans DB ; les probes externes sont optatifs.
- Garder HOST local tant qu'un déploiement explicite et son authentification ne
  sont pas demandés. Sur le VPS, ne jamais exposer le conteneur hors du réseau
  `reverseproxy` et de sa Basic Auth.
- `BASE_PATH` doit être identique à la compilation Vite et au lancement serveur ;
  API, upload et AudioWorklet passent par `src/urls.ts`.
- Le serveur de production est compilé en ESM (`type: module`) ; ne pas utiliser
  tsx après `npm ci --omit=dev`.
- Philippe peut piloter depuis ChatGPT sur iPhone (Codex Remote) : un lien
  `127.0.0.1` désigne alors le téléphone. Vérifier le dispositif de consultation
  avant de livrer une URL locale.
