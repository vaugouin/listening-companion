#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v docker >/dev/null || { echo "Docker est nécessaire sur le VPS." >&2; exit 1; }
docker compose version >/dev/null
if [[ $(id -u) == 0 ]]; then
  echo "Lance ce script avec le compte debian, qui possède l'accès Docker." >&2
  exit 1
fi
if [[ -f .env ]]; then
  echo "Une configuration .env existe déjà. Elle est conservée."
  echo "Pour changer le chemin des clés, édite ce fichier privé puis relance le déploiement."
  exit 0
fi

default_env="/home/debian/docker/fastapi-text2sql/.env"
echo "Indique le fichier privé du VPS contenant OPENAI_API_KEY et TEXT2SQL_API_KEY."
read -r -p "Chemin absolu [$default_env] : " source_env
source_env="${source_env:-$default_env}"
if [[ "$source_env" != /* || ! -f "$source_env" || ! -r "$source_env" ]]; then
  echo "Ce fichier doit exister sur le VPS et être lisible par ton compte." >&2
  exit 1
fi
source_env="$(realpath "$source_env")"
if [[ "$source_env" == *"'"* || "$source_env" == *$'\n'* ]]; then
  echo "Le chemin ne peut pas contenir d'apostrophe ou de saut de ligne." >&2
  exit 1
fi

umask 077
printf "EXTERNAL_ENV_FILE='%s'\nRUN_UID=%s\nRUN_GID=%s\n" "$source_env" "$(id -u)" "$(id -g)" > .env
chmod 600 .env
echo "Configuration créée. Les clés n'ont été ni affichées ni copiées."
echo "Le catalogue sera contacté sur le port Green 8187 de ce VPS."
echo "Pour un autre catalogue, ajoute TEXT2SQL_BASE_URL dans .env."
