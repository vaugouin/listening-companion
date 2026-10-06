# Hors Champ

Un compagnon visuel et muet pour écouter des conversations cinéma. Il transcrit
la parole, retient des énoncés, interroge le catalogue `fastapi-text2sql` et construit
un mur de cartes en alvéoles. Les sujets deviennent une forêt de piles, de couches
et de branches que l'on peut parcourir pendant que l'écoute continue.

La conception de référence est conservée dans [docs/conception.md](docs/conception.md),
avec sa [maquette initiale](docs/maquette-originale.html). Le document provient de
`Nestor/projets/t2s-backlog/app-ideas-001-listening-companion.md`, copié le 2026-10-06.

## Lancer l'application

Node.js 22.12 ou supérieur est nécessaire.

```powershell
npm install
npm run build
npm start
```

Ouvrir **http://127.0.0.1:4310**. En développement, `npm run dev` ouvre le serveur
sur 4310 et le mur Vite sur **http://127.0.0.1:5178**.

Ces adresses sont à ouvrir sur le PC qui exécute le serveur. Depuis ChatGPT sur
iPhone avec Codex Remote, le code tourne toujours sur le laptop, mais un lien
`127.0.0.1` ouvert par Safari désigne l'iPhone. Pour consulter le mur depuis un
téléphone en 5G, il faut un accès distant HTTPS protégé ou un hébergement serveur.
Changer seulement `HOST` ne suffit pas pour cet usage.

Sur le PC de Philippe, `.env.local`, ignoré par Git, pointe vers le fichier autorisé :

```dotenv
EXTERNAL_ENV_FILE=C:/Users/vaugo/Code/fastapi-text2sql/eval/.env
PORT=4310
```

Le serveur lit `OPENAI_API_KEY`, `TEXT2SQL_API_KEY`, `TEXT2SQL_API_URL` et le port
Green en mémoire. Il ne copie aucune clé et ne charge pas les identifiants MariaDB.
Les clés ne sont jamais envoyées au navigateur. Sur une autre machine, copier
`.env.example` en `.env.local` et adapter le chemin du fichier de configuration.
Les variables du processus ont priorité sur les fichiers.

| Réglage facultatif | Défaut |
| --- | --- |
| `TEXT2SQL_BASE_URL` | URL du fichier externe et `API_PORT_GREEN`, actuellement port 8187 |
| `OPENAI_MODEL` | `gpt-4.1-mini` |
| `TRANSCRIPTION_MODEL` | `gpt-live-transcribe` |
| `FILE_TRANSCRIPTION_MODEL` | `gpt-4o-transcribe-diarize` |
| `PORT` | `4310` |
| `HOST` | `127.0.0.1` |
| `BASE_PATH` | `/` en local ; `/hors-champ/` dans Docker |
| `PUBLIC_ORIGIN` | vide en local ; `https://www.vaugouin.com` dans Docker |

## Déployer sur le VPS

Le dépôt public est [vaugouin/listening-companion](https://github.com/vaugouin/listening-companion).
Sur le VPS, connecté avec le compte `debian` :

```bash
cd ~/docker
git clone https://github.com/vaugouin/listening-companion.git
cd listening-companion
bash scripts/configure-vps.sh
bash scripts/deploy-vps.sh
```

Le premier script demande le chemin absolu du fichier privé **déjà présent sur le
VPS** contenant `OPENAI_API_KEY` et `TEXT2SQL_API_KEY`. Le chemin Windows ne peut
pas être utilisé ici. Le choix proposé est `/home/debian/docker/fastapi-text2sql/.env` :
confirmer seulement si ce fichier existe et contient les deux clés. Sinon, préparer
un fichier privé sur le VPS avec ces deux variables, puis indiquer son chemin.
Les clés ne sont ni copiées dans le projet ni affichées. Le fichier de configuration
`.env` créé, ignoré par Git, contient uniquement ce chemin et l'identité Unix.

Le catalogue est contacté sur le port Green 8187 du même VPS, via la passerelle
Docker. Un autre catalogue peut être indiqué par `TEXT2SQL_BASE_URL` dans `.env`.
La lecture du fichier de clés reprend l'identité Unix du compte qui configure
le projet, pour conserver ses permissions privées.

Le deuxième script construit et démarre l'application, attend son état sain,
met à jour le dépôt privé `~/docker/reverseproxy`, valide Nginx puis le recharge.
Il refuse un dépôt proxy avec des modifications non enregistrées et ne force
aucune opération Git. Il ne redémarre pas le proxy partagé. Docker Compose V2,
le réseau `reverseproxy`, le conteneur Nginx et son fichier d'authentification
doivent déjà exister.

L'adresse est **https://www.vaugouin.com/hors-champ/**. Utiliser les identifiants
**Restricted Area** déjà employés sur ce site. La protection couvre les affiches,
les API et le WebSocket. Le conteneur n'expose aucun port sur l'hôte. Aucun nouveau
DNS ni certificat n'est nécessaire. Ouvrir l'adresse dans Safari pour l'essai micro
sur iPhone ; le navigateur intégré à ChatGPT peut avoir des restrictions propres.

Pour les mises à jour :

```bash
cd ~/docker/listening-companion
git pull --ff-only
bash scripts/deploy-vps.sh
```

En cas d'état malsain, `docker compose logs --tail=60` donne le diagnostic sans
afficher les clés. Une clé absente du fichier ou un fichier illisible empêchent
la vérification de santé. La construction Docker vérifie les tests et compile
le mur ainsi que le serveur ; Node n'est pas requis sur l'hôte.

## Utiliser Hors Champ

- **Écouter** active le microphone. La source « Audio d'un onglet » permet de partager
  un podcast dans les navigateurs qui proposent le son d'un onglet.
- Une phrase saisie emprunte la même chaîne d'extraction et de recherche que la voix.
  Une question factuelle, comme « Qui a réalisé Pierrot le fou ? », est transmise au
  catalogue en tant que question complète.
- Le sélecteur de voix attribue les prochains passages à un orateur. Le mode direct
  ne reconnaît pas automatiquement les voix. Un fichier audio, limité à 25 Mo,
  utilise le modèle avec séparation des orateurs.
- Le centre du mur agit comme une loupe. Glisser déplace les cartes ; la molette,
  les boutons ou le pincement déplacent leur lisière. La taille dépend de la distance
  au centre de l'écran, jamais de la note ni de la popularité.
- Un sujet nouveau ouvre une pile. Un affinage ajoute une condition ET. Une
  contradiction ouvre une branche sœur. « Revenons à Godard » retrouve la couche
  correspondante dans la séance courante. Un film explicitement cité a sa propre
  couche d'une carte.
- La forêt ouvre les sujets précédents. Après dix secondes sans interaction, le
  mur revient au direct. Le compte à rebours apparaît pendant les cinq dernières
  secondes ; **Rester ici** suspend ce retour. Le microphone reste indépendant.
- **Rejouer** relance les critères d'une couche. Les pages comportent 50 résultats ;
  une page pleine propose d'en charger 50 de plus, sans inventer de total.

La démonstration **Hors Champ** reproduit les six passages de la conception :
Nouvelle Vague, Godard, Pierrot, branche Truffaut, Nolan, puis retour à Godard.
Ses affiches typographiques et ses notes sont illustratives. Elle fonctionne sans
appel à une API et reste clairement identifiée comme démonstration.

## Conservation et partage

Les séances sont sauvegardées dans le stockage local du navigateur, avec les
critères, l'arbre et les identifiants ordonnés effectivement montrés. Les titres,
affiches et notes restent en mémoire et sont reconstruits depuis les routes de
détail du catalogue après un rechargement. Un identifiant supprimé donne une carte
« Pas de résultat » ; une panne réseau est signalée comme telle.

Les réglages permettent une conservation de 7, 30 ou 90 jours, ou sans limite.
La séance active n'est pas supprimée par cette purge. Le stockage appartient à
ce navigateur : il ne constitue pas une synchronisation entre appareils.

**Exporter** produit un JSON avec les critères, identifiants et apparences actuelles.
**Importer une séance** restaure ce JSON. Le bouton de partage copie un lien de
copie figée, dont les données sont dans le fragment de l'URL. Les grandes séances
sont partagées par fichier. Le destinataire doit avoir accès à une installation
de l'application ; une adresse `127.0.0.1` désigne son propre ordinateur. Il n'y a
pas encore de service partagé hébergeant des arbres vivants.

## Contrats et architecture

`src/domain.ts` contient l'arbre, l'algèbre des critères et la spirale hexagonale.
`server/statement-policy.ts` applique les marqueurs explicites de continuité,
correction et retour. Le modèle identifie les faits ; l'application gère leur
effet sur l'arbre. L'extraction est validée par un schéma JSON strict.

`server/realtime.ts` ouvre une session de transcription OpenAI. Un AudioWorklet
produit du PCM mono à 24 kHz ; une détection locale des silences délimite les
passages. Les deltas et les transcriptions finales sont rapprochés par identifiant.
L'application ne crée jamais de réponse audio et n'enregistre pas de fichier micro.

`server/cinema.ts` adapte l'API métier :

- `POST /search/text2sql`, en-tête `X-API-Key`, corps `question`, `page`,
  `rows_per_page:50`, `ui_language:fr` ; lecture de **`result[].data`**.
- `GET /movies/{id}`, `/series/{id}`, `/persons/{id}`, et routes des autres entités
  pour reconstruire les cartes. Le détail est un objet plat.
- Les films et séries sont triés par `IMDB_RATING_WEIGHTED` ; les personnes par
  `POPULARITY`. Une ligne scalaire sans identifiant reste une réponse textuelle.
- Un `error` dans un HTTP 200 est une erreur. Les clauses abandonnées et les
  homonymes restent visibles, pour que l'utilisateur puisse préciser sa demande.

Les affiches et portraits viennent des chemins TMDb renvoyés par le catalogue.
Les faits de type mouvement, sujet, liste ou collection utilisent les affiches
disponibles comme mosaïque ; les autres entités ont un repli typographique.
Aucune génération d'images n'est déclenchée.

Le serveur expose uniquement les routes locales `/api/health`, `/api/extract`,
`/api/search`, `/api/hydrate`, `/api/transcribe` et le WebSocket `/listen`.
Il écoute sur la boucle locale par défaut. Un déploiement multi-appareils demande
HTTPS pour le microphone, une authentification applicative et `PUBLIC_ORIGIN`
pour l'origine publique attendue. Le REST métier Green ne possède pas actuellement
de proxy HTTPS équivalent dans la configuration consultée.

## Vérification

```powershell
npm test
npm run build
npm run check:live
```

`npm test` vérifie hors réseau les branches, le scénario, la pagination, les imports,
les erreurs métier et le PCM. `check:live` appelle les services réels avec les clés
du serveur ; il affiche uniquement des résultats de test et des métadonnées sûres.
`server/check-scenario.ts` vérifie l'extraction réelle des six passages fictifs.
`server/check-audio.ts` exige un WAV PCM16 de test dans `tests/sample-cinema.wav`.
Après une compilation avec `BASE_PATH=/hors-champ/`,
`node scripts/check-deployment.mjs` vérifie les routes et assets du VPS ;
`--live` ouvre aussi une session OpenAI sans audio. La CI construit l'image Docker
et vérifie son démarrage sans clés. `check-publication.mjs` contrôle les fichiers
dans l'index Git avant publication et ne révèle aucune valeur.

Le 2026-10-06 : compilation réussie, 16 tests réussis, extraction du scénario réel
en neuf couches, recherche réelle et détail de Pierrot le fou avec affiche,
session de transcription configurée, transcription d'un audio synthétique en
fichier et en PCM réussies. Le microphone réel et Safari sur un iPad physique
restent à essayer. La latence dépend du catalogue ; les 3 à 5 secondes de la
conception sont un objectif à mesurer, pas une garantie.

Références officielles utilisées : [transcription en direct](https://developers.openai.com/api/docs/guides/realtime-transcription),
[sorties structurées](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
et [transcription de fichiers](https://developers.openai.com/api/docs/guides/speech-to-text).
