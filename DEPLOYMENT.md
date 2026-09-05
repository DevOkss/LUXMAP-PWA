# LuxMap Student PWA — Deployment (Vercel)

**Live at:** https://luxmap-topaz.vercel.app
**Backend:** https://luxmap.devokss.online — Laravel SOMS, see that repo's `DEPLOYMENT.md`
(`D:\2026 FREELANCE\SOMS`). The backend is NOT on Vercel; it lives on the shared
Hostinger VPS `76.13.220.161` behind the LabSync Docker proxy.

## Build & serve

Static Vite + React PWA. `vercel.json` SPA-rewrites everything to
`index.html` and sets `sw.js` to no-cache (service-worker updates).

```bash
npm ci && npm run build     # output: dist/
```

Deploy via the Vercel dashboard/CLI (`vercel --prod`) as usual for this project.

## Required Vercel environment variables (Settings → Environment Variables)

| Var | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://luxmap.devokss.online` | Backend base; the app appends `/api` itself. Local dev leaves it empty (Vite proxies `/api`). |
| `VITE_QR_KEY` | 64-char hex | MUST equal the VPS `/var/www/soms/.env` `QR_ENCRYPTION_KEY` — QR scan payloads are AES-decrypted with it. |
| `VITE_VAPID_PUBLIC_KEY` | public key pair | MUST match backend `VAPID_PUBLIC_KEY` (Web Push). |

Values live in the local `.env` (gitignored) and on Vercel — never commit them.

## Cross-origin contract with the backend

- The backend's `CORS_ALLOWED_ORIGINS` must contain the exact PWA origin
  (`https://luxmap-topaz.vercel.app`). If this project is ever moved to another
  subdomain/URL, update the VPS env **and** `PWA_URL` (backend) at the same time.
- Auth is Sanctum bearer tokens; device binding uses the `X-Device-Fingerprint`
  header. Face verification + QR logic are documented in `PWA-SUMMARY.md`.

## Verify after deploy

```bash
curl -sI https://luxmap-topaz.vercel.app/ | grep -i '^HTTP'                    # 200
curl -s -X OPTIONS https://luxmap.devokss.online/api/login \
  -H 'Origin: https://luxmap-topaz.vercel.app' -H 'Access-Control-Request-Method: POST' -i \
  | grep -i 'access-control'                                                    # ACAO must echo the PWA origin
```

If API calls fail with CORS errors after a backend redeploy, the VPS env drifted —
not this app.

## Shared-VPS warning (context for AI sessions)

The backend VPS hosts three Laravel apps behind one Docker nginx proxy
(labsync/hulagway/luxmap). Cookie-domain leaks and clobbered proxy vhosts on the
VPS have caused PWA outages (419s / TLS errors) even when the PWA itself was
unchanged. Debug checklists: `AVILA/labsync/DEPLOYMENT.md` + `SOMS/DEPLOYMENT.md`.
