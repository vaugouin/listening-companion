#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

proxy_dir="${REVERSEPROXY_DIR:-/home/debian/docker/reverseproxy}"
[[ -f .env ]] || { echo "Lance d'abord bash scripts/configure-vps.sh." >&2; exit 1; }
[[ -d "$proxy_dir/.git" ]] || { echo "Le dépôt reverseproxy est introuvable : $proxy_dir" >&2; exit 1; }
[[ -s "$proxy_dir/htpasswd/vaugouin.htpasswd" ]] || { echo "Le fichier d'authentification du proxy manque." >&2; exit 1; }
docker compose version >/dev/null
docker network inspect reverseproxy >/dev/null
[[ $(docker inspect --format '{{.State.Running}}' reverseproxy) == true ]] || { echo "Le proxy doit déjà fonctionner." >&2; exit 1; }
git -C "$proxy_dir" diff --quiet
git -C "$proxy_dir" diff --cached --quiet
git -C "$proxy_dir" pull --ff-only
grep -q 'location \^~ /hors-champ/' "$proxy_dir/sites-enabled/vaugouin-site.conf" || {
  echo "La route Hors Champ n'est pas encore dans le dépôt du proxy." >&2; exit 1;
}

docker compose build --pull
docker compose up -d --wait --wait-timeout 120
docker exec reverseproxy nginx -t
docker exec reverseproxy nginx -s reload

status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' https://www.vaugouin.com/hors-champ/api/health)"
if [[ "$status" != 401 ]]; then
  echo "La vérification de protection attendait HTTP 401, mais a reçu $status." >&2
  echo "Vérifie la configuration montée du proxy avant d'utiliser l'application." >&2
  exit 1
fi
echo "Hors Champ est disponible : https://www.vaugouin.com/hors-champ/"
echo "Connecte-toi avec les identifiants Restricted Area déjà utilisés sur ce site."
