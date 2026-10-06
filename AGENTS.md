# AGENTS.md

## Projet

Hors Champ est le compagnon visuel et muet de podcasts cinéma décrit dans
`Nestor/projets/t2s-backlog/app-ideas-001-listening-companion.md`.
Le dépôt est autonome et commence sur `main`. Ne pas committer ni pousser sans demande.

## Conventions

L'interface et la documentation sont en français. Fichiers applicatifs en minuscules
avec tirets. Chaque dossier source possède AGENTS.md et CLAUDE.md ; les dossiers
générés (`node_modules`, `dist`, `.git`) sont exclus de cette convention.
CLAUDE.md est uniquement un pointeur. Ne jamais afficher ni copier une clé API.

## Intégrations

La clé OpenAI et la clé métier Text2SQL sont distinctes. Le serveur lit uniquement
les variables nécessaires dans le fichier externe autorisé par Philippe.
Les clés restent côté serveur. Les résultats cinéma viennent de fastapi-text2sql.
Les critères ET, les branches et les identifiants montrés sont la source de vérité.
Un export JSON peut figer l'apparence ; la sauvegarde ordinaire garde les IDs.

## Stack et commandes

React, TypeScript et Vite pour le mur ; Node.js, Express et WebSocket pour le serveur.
`npm install`, `npm run dev`, `npm run build`, `npm test`, `npm start`.
Lire `readme.md` pour les contrats, la configuration et les limites vérifiées.

## Pièges vérifiés le 2026-10-06

- Node installé : 22.14.0 ; Vite 7.3.7. Sous le bac à sable Windows, le binaire
  esbuild peut refuser la traversée des parents. La compilation réussit hors
  sandbox ; ne pas traiter ce refus comme une erreur TypeScript.
- Le REST métier est Green 8187. Les réponses utilisent `result[].data`, sans
  `total_results`. Les routes de détail retournent un objet plat.
- OpenAI et catalogue utilisent deux clés distinctes. `.env.local` contient
  uniquement un chemin de fichier externe et le port local. Ne pas recopier les clés.
- La transcription `gpt-live-transcribe` ne propose ni server_vad ni orateurs :
  commit côté client après silence, sélection de voix manuelle. Le fichier utilise
  `gpt-4o-transcribe-diarize` et `diarized_json` avec `chunking_strategy=auto`.
- Un modèle peut mal distinguer personne et films d'un réalisateur, ou ouvrir
  une pile sur « Et chez Godard ». La politique applicative doit conserver les
  marqueurs de continuité, retour et correction ; voir ses tests de régression.
- L'extraction suit une file ordonnée ; les recherches ne bloquent pas l'écoute.
  La consultation de l'historique ne change jamais la tête de traitement en direct.
- Le stockage ordinaire garde les identifiants, pas les apparences. Une exportation
  doit hydrater les cartes manquantes et n'exporter que celles de la séance choisie.
- Les probes externes sont optatifs. `npm test` reste sans réseau et sans DB.
- Aucune authentification multi-utilisateur n'est implémentée : garder HOST local
  tant qu'un déploiement explicite et son authentification ne sont pas demandés.
- Le VPS utilise `/hors-champ/`, une image Node 22 compilée et le réseau Docker
  `reverseproxy`, sans port hôte. Basic Auth est dans le dépôt privé reverseproxy
  et protège le préfixe entier, y compris WebSocket. Ne pas exposer le conteneur.
- `BASE_PATH` doit être identique à la compilation Vite et au lancement serveur.
  API, upload et AudioWorklet passent par src/urls.ts. `PUBLIC_ORIGIN` est une
  origine, sans préfixe, lue aussi depuis les fichiers .env.
- Le serveur de production est compilé par esbuild en dist-server/index.js.
  Ne pas utiliser tsx après npm ci --omit=dev. Aucun fichier .env n'entre dans
  le contexte Docker. Les clés restent dans un fichier du VPS monté en lecture seule.
- scripts/deploy-vps.sh attend un proxy déjà lancé, son dépôt propre et sa Basic
  Auth existante. Il distribue les changements par Git et recharge sans restart.
- Philippe peut travailler depuis ChatGPT sur iPhone avec Codex Remote : un lien
  `127.0.0.1` ouvert sur le téléphone désigne le téléphone, pas le laptop Windows.
  Vérifier le dispositif de consultation avant de livrer une URL locale. Un accès
  mobile hors du réseau local nécessite une adresse distante et HTTPS pour le micro.
