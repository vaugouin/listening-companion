# Journal du projet

## 2026-10-06 · Préparation VPS et dépôt public

**Fait.** Philippe a choisi une adresse permanente et demandé la création d'un dépôt GitHub public. Ajout d'une image Docker avec serveur JavaScript compilé, de scripts de configuration et de déploiement, et du préfixe `/hors-champ/`. La route correspondante est préparée dans le dépôt privé reverseproxy, avec sa Basic Auth existante sur tous les chemins. Les clés restent dans un fichier du VPS monté en lecture seule.

**Vérifié.** Dix-huit tests passés, compilation locale et compilation préfixée réussies. Le contrôle de déploiement confirme redirection, assets, worklet, origines et WebSocket connecté à OpenAI sans audio. Les scripts Bash passent la vérification de syntaxe. La CI Docker et les vérifications de publication complètent le contrôle ; l'installation sur le VPS sera effectuée par Philippe avec les commandes livrées.

**Appris.** Le serveur esbuild doit explicitement produire du format ESM, puisque le paquet utilise `type: module`. La base Vite et le préfixe serveur doivent correspondre. Le délai du proxy vient du snippet partagé ; les pings WebSocket maintiennent les périodes de silence.

## 2026-10-06 · Consultation sur iPhone

**Constaté.** Philippe pilote Codex depuis ChatGPT sur iPhone, connecté en 5G au moment de la capture. Le serveur fonctionne sur le laptop, mais le lien `127.0.0.1` pointe vers le téléphone dans Safari. La documentation précise désormais cette différence. Le choix entre accès HTTPS temporaire protégé et hébergement permanent reste à définir.

## 2026-10-06

**Fait.** Création de Hors Champ à partir du document de conception, dans un dépôt local autonome sur `main`, sans commit. Mur hexagonal, séances, piles, branches, historique, persistance, export et import sont disponibles. OpenAI transcrit le direct et les fichiers puis interprète les questions ; le catalogue Text2SQL fournit les résultats et les images. Les clés existantes sont lues côté serveur depuis le fichier externe autorisé.

**Vérifié.** Compilation réussie, 16 tests automatiques passés, appels réels OpenAI et catalogue validés. Le scénario de six passages produit neuf couches. Le navigateur affiche les films de Kubrick et le résultat d’un fichier audio synthétique avec identification de la voix.

**Appris.** La transcription en direct exige des commits après silence et une sélection manuelle de la voix. Les marqueurs « et », « plutôt » et « revenons » nécessitent une politique applicative pour préserver les branches. Le catalogue retourne `result[].data`, sans total. Le microphone et Safari sur iPad restent à vérifier sur les appareils réels.
