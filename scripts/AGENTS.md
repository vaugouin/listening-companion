# Déploiement

Les règles de ../AGENTS.md s'appliquent. Scripts Bash exécutés sur le VPS Debian,
avec Docker Compose V2. Ne pas supposer Node ou Python installés sur l'hôte.
La configuration du proxy vient de son dépôt privé par Git, jamais par modification
manuelle du serveur. Aucun secret dans un script ou dans sa sortie.
Le fichier .env local stocke uniquement le chemin du fichier de clés déjà présent
sur le VPS et l'identité Unix à utiliser pour le lire. Ne pas recopier ses clés.
Les scripts doivent être enregistrés en mode Git 100755 et en LF.
