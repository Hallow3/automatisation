#!/bin/sh
set -eu
out_dir=/opt/fallajobs-monitoring/metrics
tmp="$out_dir/containers.prom.tmp"
{
  printf '# HELP fallajobs_container_state Container state as last observed by the host collector.\n'
  printf '# TYPE fallajobs_container_state gauge\n'
  printf '# HELP fallajobs_container_health Docker health status; health=none means no healthcheck is configured.\n'
  printf '# TYPE fallajobs_container_health gauge\n'
  docker ps -a --format '{{.Names}}|{{.State}}|{{.Status}}' | while IFS='|' read -r name state status; do
    [ -n "$name" ] || continue
    case "$name" in *[!a-zA-Z0-9_.-]*) continue ;; esac
    case "$state" in running|exited|created|restarting|paused|dead) ;; *) state=unknown ;; esac
    printf 'fallajobs_container_state{container="%s",state="%s"} 1\n' "$name" "$state"
    health=none
    case "$status" in *"(healthy)"*) health=healthy ;; *"(unhealthy)"*) health=unhealthy ;; *"(health: starting)"*) health=starting ;; esac
    printf 'fallajobs_container_health{container="%s",health="%s"} 1\n' "$name" "$health"
  done
} > "$tmp"
chmod 0644 "$tmp"
mv "$tmp" "$out_dir/containers.prom"

# Produce Alloy targets on the host, where Docker metadata is available. Alloy only
# receives this read-only file and the read-only JSON logs, never the Docker socket.
targets_tmp="$out_dir/docker-log-targets.json.tmp"
printf '[' > "$targets_tmp"
first=1
docker ps -a --format '{{.ID}}|{{.Names}}' | while IFS='|' read -r id name; do
  [ -n "$id" ] || continue
  case "$name" in *[!a-zA-Z0-9_.-]*) continue ;; esac
  log_path=$(docker inspect --format '{{.LogPath}}' "$id" 2>/dev/null) || continue
  case "$log_path" in /var/lib/docker/containers/*/*-json.log) ;; *) continue ;; esac
  if [ "$first" -eq 0 ]; then printf ','; fi
  first=0
  printf '\n{"__path__":"%s","job":"docker","service":"%s"}' "$log_path" "$name"
done >> "$targets_tmp"
printf '\n]\n' >> "$targets_tmp"
chmod 0644 "$targets_tmp"
mv "$targets_tmp" "$out_dir/docker-log-targets.json"
