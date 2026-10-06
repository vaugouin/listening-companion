---
type: design-note
status: living
related: [topics/app-ideas.md, repos/synthetic-images.md, topics/look-picture-based-search.md, topics/an-image-for-everything/streamed-statement-extraction.md, app-ideas-001-listening-companion-mockup.html]
---

# Compagnon d'écoute (APP-IDEAS-001) : dossier de conception

Dossier de conception d'une nouvelle app : un **compagnon visuel pour un contenu audio**. L'app
écoute un podcast ou une émission en direct, extrait des énoncés de ce qui se dit, et construit à
l'écran un mur de cartes (affiches, portraits) organisé en couches, en piles et en arbres. Ce
dossier rassemble tout ce qui a été dit et décidé lors de la conversation du 2026-10-04 au
2026-10-06 entre Philippe et Nestor. Le ticket `APP-IDEAS-001` de `topics/app-ideas.md` en garde le
résumé ; ce fichier porte le raisonnement, les références et la maquette.

La maquette est rangée à côté, `app-ideas-001-listening-companion-mockup.html`, **temporairement** :
l'app a vocation à devenir un dépôt à part entière, et la maquette partira avec elle.

## Comment lire ce fichier

1. **Les décisions** sont marquées *décidé*, les **propositions** de Nestor non encore tranchées
   *proposé*, les **points ouverts** *ouvert*. Le §12 les regroupe par date.
2. **Carte du fichier** : §1 origine · §2 source sonore · §3 l'oreille et le cerveau · §4 le modèle
   (énoncés, couches, piles, arbres, forêt) · §5 navigation · §6 disposition du mur · §7 cartes-faits
   · §8 images par type d'entité · §9 stockage, partage, export · §10 la maquette · §11 questions
   ouvertes · §12 journal des décisions.

## 1. Origine et intention

**Le point de départ, d'après Philippe : l'extraction d'énoncés.** La pile T2S possède déjà une tâche
d'**extraction d'entités** (`data/entity_extraction.md` dans fastapi-text2sql). L'app repose sur sa
sœur, l'**extraction d'énoncés** (*statement extraction*), esquissée dans
`topics/an-image-for-everything/streamed-statement-extraction.md`. Un énoncé a trois parties :
*élément, propriété, valeur* (film, réalisateur, Stanley Kubrick). Les énoncés se combinent par ET
tant qu'ils portent sur la même question ; une nouvelle question ouvre une nouvelle pile ; chaque
énoncé s'affiche comme un résultat de recherche avec une image.

**Ce que l'app n'est pas.** Ce n'est ni un jeu de devinette ni un assistant qui parle. C'est un
**compagnon visuel** pour un contenu qui n'a que du son. Si l'orateur parle de la Nouvelle Vague, le
mur se remplit d'affiches de la Nouvelle Vague ; s'il resserre sur un réalisateur, le mur se filtre ;
s'il nomme un film, ce film passe au premier plan.

**La raison d'être** : *verba volant, scripta manent*. La parole s'envole ; l'arbre fixe à l'écran
ce qui a été dit, et l'auditeur peut y revenir pendant qu'il écoute encore.

**Le contexte de la conversation.** Elle est née d'un message d'un spectateur, après le dernier Short
de *Guess before my AI* : « faudrait que tu fasses jouer ton app à PixelGuess ». Cette idée a son
propre ticket, `APP-IDEAS-009` (reconnaître une image qui se dépixelise progressivement), et la
discussion sur les API temps réel a glissé de là vers `APP-IDEAS-001`.

**D'autres usages, plus tard** : une conférence, un cours, une sorte de professeur visuel. Cela fait
de ce ticket le premier cas concret, limité au cinéma, de `APP-IDEAS-007` (« l'audioguide pour
tout »). La cible reste pour l'instant les **podcasts de cinéma**.

## 2. Ce que l'app écoute

- *Décidé* : **temps réel**. La source est un **micro dans une pièce** ou une **émission en
  direct**.
- L'analyse d'un fichier ou d'une URL de podcast, transcrit à l'avance avec horodatage puis rejoué
  en synchronisation, reste une solution de repli valable, moins chère et reproductible, mais ce
  n'est pas la cible.
- *Décidé* : c'est une **nouvelle app**, qui tourne sur **tout appareil** (app web, comme
  voice-agent). **Le coût n'est pas une contrainte** pour l'instant.
- *Décidé* : premier écran de test, **iPad en paysage**.

## 3. La chaîne technique : l'oreille et le cerveau

Le ticket demande deux choses distinctes : une **oreille**, qui transforme la parole en texte au fil
de l'eau, et un **cerveau**, qui extrait les énoncés, les combine, détecte les changements de sujet
et pilote le mur.

**OpenAI** (recherche web du 2026-10-04) :
- en **oreille seule**, la [transcription temps réel](https://developers.openai.com/api/docs/guides/realtime-transcription)
  renvoie le texte par fragments ; son modèle,
  [`gpt-live-transcribe`](https://developers.openai.com/api/docs/models/gpt-live-transcribe),
  n'appelle pas d'outils : tout le raisonnement reste dans notre chaîne ;
- en **oreille et cerveau**, une session `gpt-realtime` complète appelle un outil à chaque entité
  entendue. Mais le modèle est conçu pour le dialogue : il prend chaque orateur du podcast pour un
  utilisateur et veut répondre. Il faut couper ses réponses automatiques pour ne garder que les
  appels d'outils, ce qui va contre sa nature.

**Gemini Live** ([guide des capacités](https://ai.google.dev/gemini-api/docs/live-api/capabilities),
[vue d'ensemble](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api))
colle mieux, sur le papier, à la version « oreille et cerveau » :
- l'**audio proactif** : le modèle ne répond que si c'est pertinent, il ignore la parole qui ne lui
  est pas adressée ;
- les **appels d'outils non bloquants** de Gemini 3.8 Live : il continue d'écouter pendant que nos
  recherches tournent ;
- la **compression de contexte** par fenêtre glissante et la **reprise de session**, nécessaires pour
  un podcast d'une heure ;
- la **transcription** de l'entrée, pour les sous-titres ;
- l'entrée **vidéo**, pour un podcast filmé.

Deux réserves : ce n'est pas le fournisseur de voice-agent, et rien de tout cela n'a été mesuré.

*Proposé* : prendre l'API **comme oreille seulement**, et garder le cerveau dans notre propre
chaîne. La combinaison d'énoncés et la détection de changement de sujet sont le cœur de l'app, et
c'est la seule version qu'on puisse évaluer avec l'outillage existant.

*Décidé* : un **délai de 3 à 5 s** entre la parole et le mur est acceptable : il se lit comme un
temps de réflexion. Les **sous-titres**, qui arrivent vite, comblent l'attente avec des informations
intermédiaires.

*Décidé* : le compagnon est **muet et entièrement visuel**. Il affiche des sous-titres de ce qu'il
entend et des énoncés qu'il retient, « une vue de ce que le cerveau entend et pense ». Le cerveau
devient donc le produit visible, pas une étape cachée.

## 4. Le modèle : énoncés, couches, piles, arbres, forêt

- **Un tour, c'est un nouvel énoncé** (*décidé*). Il fait l'une de deux choses :
  - **affiner** la pile courante, en ajoutant une condition, donc une **couche** au-dessus des
    précédentes ;
  - **ouvrir une nouvelle pile**, parce que l'orateur parle d'autre chose. La détection du
    changement de sujet est donc une exigence centrale, pas un raffinement.
- **Chaque couche est un filtre** sur la couche du dessous : c'est l'opération « ensemble de
  résultats → ensemble de résultats » d'`APP-IDEAS-002`. *Proposé* : construire 002 d'abord, comme
  moteur de 001.
- **Une contradiction crée une branche, elle n'écrase rien** (*décidé*). Godard, puis « non,
  Truffaut » : la couche Truffaut s'affiche **à côté** de la couche Godard, et la conversation
  continue sur cette **sous-pile**. Le modèle est donc un **arbre**, pas une pile. C'est le *Jardin
  aux sentiers qui bifurquent* de Borges : chaque contradiction ouvre un sentier, aucun n'est effacé.
- **Plusieurs orateurs alimentent le même arbre** (*décidé*), puisqu'ils sont dans la même
  conversation. On les distingue, **seulement s'ils sont plusieurs**, par une **couleur** (le cadre de
  la couche) **et une icône**, qui devient un **avatar** quand l'app sait qui parle. Distinguer les
  voix (« orateur 1, orateur 2 ») est un problème classique ; les nommer est plus difficile, sauf pour
  des voix connues comme les animateurs réguliers d'une émission. Avec la règle de contradiction, le
  Godard d'un critique et le Truffaut de l'autre deviennent deux branches sœurs, de deux couleurs :
  le désaccord devient visible.
- **Le retour à un ancien sujet se fait par la voix** (*décidé*). Une formule explicite comme
  « revenons à Godard » commande le retour : l'app cherche la conversation correspondante et la
  rouvre. Si elle ne la trouve pas, ouvrir une nouvelle pile est acceptable. Contrairement à un
  chatbot, où l'on choisit dans un historique, tout se passe à la voix. *Proposé* : chercher d'abord
  dans la séance en cours, et ne remonter aux séances anciennes que si l'orateur les nomme (« comme
  on disait la semaine dernière »).
- **Une forêt** (*décidé*) : chaque conversation est un arbre, et les conversations passées restent
  consultables. Les séances sont donc **conservées**, pas seulement affichées en direct.

## 5. Navigation

*Décidé* :
- **Une pile ancienne devient une icône avec un titre**, rangée sur l'écran. On peut la rouvrir, la
  rendre visible et s'y déplacer, comme dans une conversation passée.
- **L'écoute ne s'arrête jamais** pendant la navigation : l'app continue d'extraire des énoncés et
  d'ajouter couches et piles à la conversation en direct, en arrière-plan.
- **Retour automatique au direct** : après environ **10 s sans action** sur une pile ancienne, l'app
  revient à la pile courante. **5 s avant**, un **compte à rebours** s'affiche, pour qu'un utilisateur
  présent puisse annuler.

*Proposé* : un **panneau latéral** montre la même structure à plat (forêt, arbres, piles, couches),
comme le panneau des calques de Photoshop ou l'« outliner » de Blender à côté de la scène 3D. C'est
aussi par lui qu'on choisit l'étendue d'un partage (§9).

## 6. Le mur : disposition des cartes

**Le principe** (formulé par Philippe) : on ne peut pas utiliser la même dimension pour deux choses.
La profondeur est prise par les couches successives ; les cartes d'une même couche occupent donc la
**surface**. Une ligne horizontale ou verticale utilise mal l'espace, et une pile réutiliserait la
dimension des couches.

**Ce qui existe ailleurs** (références apportées par Nestor) :
- **Time Machine** (Apple, 2007) : la profondeur est le temps, les états anciens reculent et pâlissent ;
- les **interfaces à zoom** (Pad++, Ken Perlin, années 1990 ; Prezi, Google Maps) : le zoom remplace
  le défilement, et le *zoom sémantique* change ce qu'on voit selon la distance ;
- l'**écran d'accueil de l'Apple Watch** : une grille en alvéoles, grande au centre, plus petite
  vers les bords ;
- les **treemaps** (Ben Shneiderman, 1991) : remplir l'espace selon l'importance ;
- le **panneau des calques** de Photoshop, l'**outliner** de Blender : la scène et une liste.

**Ce qui est décidé** :
- **Des alvéoles rangées par rang à partir du centre** : rang 1 à l'origine, rangs 2 à 7 sur le premier
  anneau, 8 à 19 sur le deuxième (l'anneau *k* compte 6*k* cases), donc 50 cartes sur quatre anneaux.
  Charger plus ajoute des anneaux au bord ; la couche a une lisière.
- **La taille est une loupe, pas une note.** Il faut séparer deux mécanismes : le **placement** (où
  la carte est posée, décidé par son rang, fixe) et la **loupe** (quelle taille elle prend à l'écran,
  décidée par sa distance au **centre de l'écran**). C'est l'effet de l'Apple Watch, la *vue fisheye*
  théorisée par George Furnas en 1986, et c'est l'image de la sphère proposée par Philippe. Au repos,
  centrée sur l'origine, la plus grande carte est aussi la mieux classée ; dès qu'on se déplace, la
  plus grande carte est simplement celle qu'on regarde, et l'on n'est jamais « décentré ».
- **Aucun signe visuel d'importance** : ni couleur, ni badge, ni rang affiché. C'est déjà le cas dans
  tmdb-front et voice-agent, où la popularité classe les personnes sans jamais s'afficher.
- **Le contenu d'une carte** suit tmdb-front et voice-agent : affiche ou portrait ; titre et note IMDb
  pour une œuvre ; nom et dates pour une personne. Ces informations n'apparaissent peut-être qu'au
  survol. Sur écran tactile, où le survol n'existe pas, **la carte au centre de la loupe affiche ses
  informations**.
- **Une couche est un résultat de recherche** : **50 cartes** par défaut, la suite par blocs de 50.
  Ordre : **personnes par popularité décroissante ; films et séries par note IMDb pondérée
  décroissante**. Un résultat vide affiche une **carte spéciale « pas de résultat »**, dans l'esprit
  d'une page 404 amusante.

*Proposé* :
- **Charger plus, c'est reculer.** Le pincement agit sur la couche, le glissement en profondeur agit
  sur la pile : deux gestes pour deux dimensions. Cela évite le conflit entre le défilement d'une
  couche et la navigation entre couches.
- **Un filtre devient une animation** : quand l'orateur dit « Godard », les films de Godard
  *s'avancent* depuis la couche Nouvelle Vague vers la nouvelle couche, et les autres restent
  derrière, estompés.
- **Les branches de contradiction** se placent côte à côte, à la même profondeur.
- Réserve : sur téléphone, la profondeur est coûteuse (deux ou trois couches lisibles au plus). La
  pile complète convient mieux à une tablette ou à une télévision.

## 7. Cartes-faits et cartes-résultats

**L'intuition de Philippe** : dire « Godard », c'est poser une carte, son portrait, comme une carte
qu'on joue et qui change la partie. Il y a donc deux sortes de cartes :
- la **carte-fait** : ce qui a été dit ;
- les **cartes-résultats** : ce que ce fait fait apparaître.

*Décidé* : un **film nommé** forme une nouvelle couche d'**une seule carte**, devant, la couche
Godard restant derrière.

*Proposé* : la **carte-fait au centre de sa couche**, les résultats en anneaux autour, la cause au
centre et les conséquences autour. Trois avantages :
- un film nommé n'est plus une exception, c'est une couche dont la carte-fait est son propre résultat ;
- mises bout à bout, les cartes-faits se lisent comme le **résumé de la conversation** (Nouvelle
  Vague, Godard, *Pierrot le fou*) : c'est ce que montrent le panneau latéral et le titre d'une pile
  rangée ;
- les branches sœurs ont chacune leur carte-fait au centre, dans la couleur de leur orateur.

L'autre option, la carte-fait posée en onglet au bord de la couche, est plus sobre mais sépare la
cause de l'effet.

## 8. Images par type d'entité

**Le constat de Philippe** : films, séries et personnes sont bien pourvus. Les autres types
(genres, topics, lieux, mouvements, listes, certaines collections, récompenses et nominations,
techniques…) n'ont pas d'image, ou des images incohérentes d'une entité à l'autre. D'où le projet
« une image pour tout » (dépôt `synthetic-images`), **en pause pour des raisons de coût** : il
faudrait plusieurs milliers d'images.

*Décidé* : **la source d'image se définit par type d'entité.**

| Type d'entité | Source d'image | Ticket |
|---|---|---|
| Films, séries, personnes | images natives TMDb | (existant) |
| Genres | images synthétiques : peu de valeurs, faciles à illustrer | `SYNTHETIC-IMAGES-011` |
| Mouvements, listes, collections additionnelles | **mosaïque** des meilleures affiches (`poster-mix`), comme Spotify pour les playlists sans pochette | `-012` (listes), `-015` |
| Techniques (Technicolor, CinemaScope, Dolby) | peu de valeurs mais difficiles à représenter, ce sont des procédés. Piste : logos réels via le `logo-pad` gratuit ; le cadre lui-même pour un format d'image | `-017` |
| Tout le reste | **typographie** : le mot en grand, une couleur et un pictogramme par type, dans l'esprit des génériques de Saul Bass ; à explorer | `-016` |

Le dépôt avait déjà choisi la mosaïque pour les listes dès l'origine (`poster-mix`, choisi par défaut,
voir `-012`), et `-007` notait « un assemblage de trois affiches pour une trilogie ». *Proposé*, dans
`SYNTHETIC-IMAGES-018` : un ordre par type (image native, sinon image synthétique ou logo, sinon
mosaïque, sinon typographie), et une génération **dans l'ordre de l'usage** : l'app peut dire quoi
générer en premier, les entités réellement prononcées.

*Ouvert* : **qu'est-ce qui coûte, au juste ?** `SYNTHETIC-IMAGES-008` relève FLUX.1 schnell à
0,006 $ l'image et Nano Banana à 0,039 $ (prix relevés, non revérifiés), soit environ 30 à 195 $ pour
5 000 images. Si le frein est ailleurs (appels au LLM qui écrit les prompts, essais ratés, temps de
relecture, qualité exigeant le modèle le plus cher), la stratégie change.

## 9. Stockage, partage, export

**Trois niveaux de stockage** (distinction posée par Philippe, *décidé*) :
1. **les critères** : *pourquoi* une couche existe ;
2. **la liste ordonnée des identifiants de cartes affichées, datée** : *ce qui* a été montré ;
3. **l'apparence des cartes** (affiche, titre, note), qui change en permanence.

*Décidé* :
- **Le stockage garde 1 et 2.** L'arbre est un compte rendu fidèle de ce qui a été montré et
  pourquoi, et il reste compact (environ 50 identifiants par couche). L'apparence est recalculée à
  partir des données du moment : un film dont l'affiche a changé reste la même carte. C'est le bateau
  de Thésée : l'identité tient à l'identifiant, pas à l'image. Une fiche TMDb supprimée ou fusionnée
  affiche la carte « pas de résultat ». Un bouton **rejouer** relance les critères pour montrer ce qui
  a changé depuis.
- **L'export garde 1, 2 et 3** : un export est un document, il est figé. Format **JSON**, la forme
  naturelle d'un arbre, avec critères, identifiants, titres et chemins d'affiches du moment.
- **Le partage** peut être l'un ou l'autre : un lien vers l'arbre vivant, ou une copie figée.
- **La durée de conservation** est un réglage, comme le cache de l'API (environ un mois aujourd'hui).
  Le volume est faible, puisque nommer une société de production qui a produit 3 000 films, c'est un
  seul fait.

*Ouvert* : **choisir l'étendue** d'un partage ou d'un export (une couche, un arbre, la forêt) dans
une interface qui donne l'impression de la 3D. La piste de Philippe : une sélection à la manière des
logiciels de modélisation 3D (Ctrl ou Maj pour étendre, un cadre au survol qui montre couche, arbre
ou forêt). *Proposé* : la faire dans le panneau latéral à plat (§5).

## 10. La maquette

- **Fichier** : `app-ideas-001-listening-companion-mockup.html`, copie de travail ; version publiée
  et privée : <https://claude.ai/artifact/TWUQ7Zfj4uESWsWB3br8Dn>.
- **Format** : écran d'iPad en paysage (1180 × 820), adapté à la largeur de la page.
- **Scénario** : un podcast fictif, *Hors Champ*, avec deux voix, Claire et Malik. Les faits sont
  pris dans un discours naturel, pas énumérés, puisque les extraire de la parole est tout l'enjeu
  (*décidé*). Les six phrases :
  1. Claire présente l'épisode, la fin des années cinquante et **la Nouvelle Vague** → nouvelle pile,
     carte-fait en mosaïque ;
  2. « le premier nom qui vient, c'est forcément **Godard** » → couche Godard, ses films s'avancent ;
  3. « celui qui ne me quitte pas, c'est **Pierrot le fou** » → couche d'une seule carte ;
  4. Malik conteste : « ce n'est pas Godard, c'est **Truffaut** », puis *Les Quatre Cents Coups* →
     branche voisine, les couleurs d'orateurs apparaissent ;
  5. « ça n'a rien à voir, mais vous avez vu le dernier **Nolan** ? *L'Odyssée* » → nouvelle pile, la
     Nouvelle Vague se range en icône ;
  6. « **pour revenir à la Nouvelle Vague** », chez Godard, *À bout de souffle* → la pile est rouverte,
     Nolan se range.
- **Ce qu'elle montre** : sous-titres mot à mot ; ligne du « cerveau » (énoncé extrait, son effet :
  nouvelle pile, affine, branche, retour ; puis « je cherche… » et le nombre de films) ; couches qui
  reculent ; cartes-faits au centre ; loupe (glisser pour se déplacer, pincer ou molette pour reculer) ;
  branche voisine ; piles rangées ; forêt dans le panneau gauche ; retour au direct après 10 s avec
  compte à rebours et « Rester ici ».
- **Limites** : affiches dessinées (la page ne peut pas charger d'images externes), ordre indicatif
  sans vraie note, délai de recherche simulé à 2 s, **pas testée sur un vrai iPad** (seulement la
  validité du code).

## 11. Questions ouvertes

1. **Profondeur de la recherche d'un retour vocal** : séance en cours seulement, ou séances anciennes
   quand l'orateur les nomme (§4) ?
2. **Disposition fine dans une couche** : forme exacte des alvéoles pour des cartes 2:3, réglage de la
   loupe, ce qui se passe à la lisière.
3. **Carte-fait au centre ou en onglet** (§7).
4. **Typographie** : police, palette par type, noms longs ; rendu en direct ou images figées (`-016`).
5. **Coût réel de `synthetic-images`** (§8).
6. **Étendue d'un partage ou d'un export** (§9).
7. **Langues** des podcasts visés, et comportement sur un débat à plusieurs voix qui se coupent.
8. **Ordre de construction** : `APP-IDEAS-002` d'abord comme moteur, puis l'oreille, puis le mur ?

## 12. Journal des décisions

- **2026-10-04** : source temps réel (micro ou direct) ; compagnon muet et visuel, avec sous-titres
  du « cerveau » ; mur en couches qui se filtrent ; un tour = un énoncé qui affine ou ouvre une pile ;
  nouvelle app, tout appareil, coût non contraignant ; piles anciennes en icônes, écoute continue,
  retour au direct après 10 s avec compte à rebours de 5 s ; une contradiction crée une sous-pile à
  côté ; une forêt d'arbres consultables ; retour à un sujet par la voix ; 50 cartes par couche, ordre
  des recherches actuelles, carte « pas de résultat » ; un seul arbre pour plusieurs orateurs,
  couleur et icône ; délai de 3 à 5 s acceptable ; conservation réglable ; partage et export liés,
  en JSON ; stockage des critères et des identifiants affichés, export figé.
- **2026-10-05** : alvéoles par rang depuis le centre ; la taille suit la loupe, pas l'importance ;
  aucun signe d'importance ; informations au survol, ou au centre sur tactile ; un film nommé = une
  couche d'une carte ; la carte-fait est identifiée comme notion (sa place reste *proposée*).
- **2026-10-06** : source d'image par type d'entité (tableau §8), versée en `SYNTHETIC-IMAGES-015..018` ;
  origine du projet dans l'extraction d'énoncés ; maquette sur iPad en paysage, avec un discours de
  podcast naturel ; maquette et dossier rangés dans le backlog en attendant un dépôt dédié.
