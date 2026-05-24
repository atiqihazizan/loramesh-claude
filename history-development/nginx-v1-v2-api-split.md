# Pisah API v1 vs v2 (elak clash `/api`)

**Masalah:** Satu domain `lora2u.com` dengan `location ^~ /api/` → 5002 membuat UI legacy di `/` (PM2 `lora2u` :5001) panggil API v2 + DB berbeza.

**Penyelesaian:** v1 kekal **`/api/`** → **5001**; v2 guna **`/v2/api/`** dan **`/v2/socket.io/`** → **5002** (backend masih mount `/api` dan `/socket.io` — nginx strip prefix `/v2`).

## Frontend (repo mesh_pro_claude)

| Persekitaran | REST | Socket.IO |
|--------------|------|-----------|
| Dev | `VITE_API_URL=http://localhost:5002` → `/api` | `VITE_SOCKET_URL` + path `/socket.io` |
| Prod + `VITE_APP_BASE=/v2/` | Same-origin **`/v2/api`** | path **`/v2/socket.io`** |

Kosongkan `VITE_API_URL` / `VITE_SOCKET_URL` semasa `npm run build` production.

## Nginx (`loramesh.conf` — server block `lora2u.com`)

Letak **sebelum** `location /` (legacy). **Jangan** guna `location ^~ /api/` global ke 5002.

```nginx
  location = /v2 {
      return 301 /v2/;
  }

  location ^~ /v2/ {
      alias /var/www/loramesh/mesh_v2/public/;
      index index.html;
      try_files $uri $uri/ @mesh_v2_spa;
  }

  location @mesh_v2_spa {
      rewrite ^ /v2/index.html last;
  }

  location = /v2/index.html {
      alias /var/www/loramesh/mesh_v2/public/index.html;
  }

  # v2 API — strip /v2, backend 5002 tetap /api/...
  location ^~ /v2/api/ {
      proxy_pass http://127.0.0.1:5002/api/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ^~ /v2/socket.io/ {
      proxy_pass http://127.0.0.1:5002/socket.io/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      proxy_cache_bypass $http_upgrade;
  }

  # v1 legacy
  location ^~ /api/ {
      proxy_pass http://127.0.0.1:5001;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }

  location ^~ /socket.io/ {
      proxy_pass http://127.0.0.1:5001;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_read_timeout 86400s;
      proxy_send_timeout 86400s;
      proxy_cache_bypass $http_upgrade;
  }

  location / {
      proxy_pass http://127.0.0.1:5001;
      ...
  }
```

**Buang** block lama `location ^~ /assets/` di root (v2 asset sudah di `/v2/assets/` dari build Vite).

## Ujian

```bash
curl -sS -o /dev/null -w 'v1 api: %{http_code}\n' -X POST https://lora2u.com/api/auth/login -H 'Content-Type: application/json' -d '{}'
curl -sS https://lora2u.com/api/health/ping   # v1 — mungkin 404 jika route tiada pada v1
curl -sS https://lora2u.com/v2/api/health/ping  # v2 — 200
```

Rebuild UI, sync `public/` ke server, `nginx -t && systemctl reload nginx`, `pm2 start mesh_v2`.
