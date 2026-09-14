# PWA-SOMS — Vue 3 Student Mobile App

## Latest Session (September 14, 2026) — one card per transaction, receipt breakdown, notification deep-links

> Backend pairing in `SOMS/SOMS-SUMMARY.md` (Sept 14: one-receipt-per-batch + payment/shift notifications). Deployed: `e4726cd` pushed to `DevOkss/LUXMAP-PWA:main` (Vercel auto). No VPS/proxy changes.

### Payment history — one record per transaction
- **Grouping** (`src/pages/payments/History.vue`): flat `GET /payments` rows are grouped by `batch_id` into one card per transaction — `Payment #xxx`, org + term, `Fees: Tuition, Lab, Library`, `Total: ₱5,700 (N items)`, receipt number, date/method, expandable per-fee breakdown, `View receipt` → the single `receipts-show` id. Separate batches stay separate cards. Fixes “shows only the last receipt / multiple receipts for one payment”.
- **Receipts** (`src/pages/receipts/Index.vue`, `Show.vue`): list and detail use the new `ReceiptResource` `total`/`items`/`payments` (batch sum + fee breakdown) instead of the single linked payment amount; detail shows the breakdown table + batch id + amount-in-words.

### Notification deep-links (payment + shift)
- **`src/pages/notifications/Index.vue`**: tapping a notification now `markRead`s then `router.push()`es its `url` (`data.url` or nested `data.data.url`) — payment notifications open `/receipts/{id}`, shift-review notifications open `/shift`. Rows with a link show `↗ Tap to view`.
- **Types** (`src/types/index.ts`): `Payment` gains `uuid`/`batch_id`/`receipt.batch_id`; `Receipt` gains `batch_id`/`total`/`items`/`payments`.

### Deploy
- Pushed `e4726cd` (history grouping + receipt breakdown + deep-links + types) → Vercel auto-deploy; verified `https://luxmap-topaz.vercel.app/` 200. Backend `c2ea597`/`cafc647` already live, so `batch_id`/`total`/`items` are served.

## Previous Session (September 13, 2026) — notification delete, Processed by on receipts, Centavos words + fetch fix

> Backend pairing in `SOMS/SOMS-SUMMARY.md` (Sept 13). Deployed: PWA `ce72923` + fix `2e67699` pushed to `DevOkss/LUXMAP-PWA:main` (Vercel auto), backend `f213b81` SSH-deployed to `76.13.220.161` without proxy touch. Fixes the “delete did nothing” report and the `Processed by` / `00/100` receipt gaps.

### Notification delete (all + single) — student fix
- **Root cause of “delete did nothing”**: `stores/notificationStore.ts:15` `fetchNotifications` did `response.data.data || response.data.notifications` but Laravel API returns `{notifications:{data:[...]}, unread_count}` wrapped (Resource collection). So `notifications` became object `{data:[...]}` not array → `length`/`filter`/`slice` broke and deletes appeared to do nothing.
- **Fix** (`src/stores/notificationStore.ts:15`): robust parsing handles `Array` / `{data:[...]}` nested for both `notifications` and `data` keys, then `notifications.value = list` (array). `unread_count` still prefers server value.
- **Store** (`src/stores/notificationStore.ts:46`): `deleteNotification(id:string)` → `DELETE /api/notifications/{id}` then `filter`, `clearAll()` → `DELETE /api/notifications` then `[]`, both recompute `unreadCount`. `Notification.id` type fixed `number → string` (UUID) (`src/types/index.ts:302`).
- **UI** (`src/pages/notifications/Index.vue:37`): per-card **Delete** (red, `stopPropagation` + `confirm`) alongside unread dot, header **Delete All** (red, `confirm` “cannot be undone” → `clearAll`). `visibleNotifications` `slice(0,visibleCount)` now works because list is array.
- **Backend pairing**: `DELETE /api/notifications/{id}` (UUID) + `DELETE /api/notifications` (clear all) now live on `https://luxmap.devokss.online` (`SOMS` routes). `CORS` already `allowed_methods:['*']`, no header change.

### Receipt Processed by + Centavos words
- **Amount words** (`src/utils/amountWords.ts:1` new, mirrors `SOMS/resources/js/pages/admin/payments/Show.vue:140`): `550 → Five Hundred Fifty Pesos Only` (was `and 00/100`), `550.50 → ... and Fifty Centavos Only`, `1.01 → One Peso and One Centavo Only`. `receipts/Show.vue:6` imports helper and shows `${numberToWords(amount)} Only` italic under `₱` amount.
- **Processed by** (`src/types/index.ts:261`): `PaymentSubmissionGroup.verified_by?` + `Receipt.payment.processedBy/verifiedBy/exemptedBy?` (`src/types/index.ts:261`). `payments/Submissions.vue:110` approved line now `Processed by OfficerName on date — payment recorded.` (was `Verified date`). `receipts/Show.vue:58` adds `Processed by {{issued_by||processedBy||verifiedBy}}` row when present; API now supplies `verified_by` (`SOMS/app/Http/Controllers/Api/PaymentController.php:100`) and `ReceiptResource` `issued_by` + `payment.verifiedBy` (`SOMS`).

### Deploy
- Pushed `ce72923` (delete+receipt+amountWords) + follow-up `2e67699` (fetch wrapper fix) → Vercel. Backend `f213b81` already live, so `DELETE /api/notifications` no longer 404.

## Previous Session (September 5, 2026) — shared-VPS infra fixes; DEPLOYMENT.md added

> **No PWA code changes.** Production incidents on the backend VPS were fixed (details in `SOMS/SOMS-SUMMARY.md` + `AVILA/labsync/DEPLOYMENT.md`): luxmap TLS vhost restored (cert errors), and a sibling-app cookie leak (`SESSION_DOMAIN=.devokss.online`) that caused "419 Page Expired" on POSTs across subdomains. If API calls suddenly fail with 419s or TLS errors, suspect the VPS proxy/certs — not this app. New **`DEPLOYMENT.md`** (repo root) documents the Vercel env contract (`VITE_API_URL`, `VITE_QR_KEY` ↔ backend `QR_ENCRYPTION_KEY`, `VITE_VAPID_PUBLIC_KEY`, CORS origin pairing).

## Previous Session (August 22, 2026) — face verification hardened, verify-on-open, env fallbacks fix the Vercel 405

> Backend pairing in `SOMS/SOMS-SUMMARY.md` ("production launch on Hostinger VPS"). The system is LIVE: PWA at `https://luxmap-topaz.vercel.app`, API at `https://luxmap.devokss.online`.

### Face verification false-accept fixed (another person could pass before)
- **Root cause**: `MATCH_DISTANCE = 0.55` with **min-distance over enrolled samples** and a weak 1–2 sample template — same-person descriptors land ~0.35–0.45, different people ~0.50–0.65+, so 0.55 accepted lookalikes.
- **`src/services/face.ts`** changes:
  - `MATCH_DISTANCE` 0.55 → **0.45**.
  - `matchesEnrolled()` now uses **consensus**: average distance ≤ threshold AND at least half the enrolled samples individually under it (a single lucky sample can no longer pass).
  - `euclideanDistance()` returns `Infinity` on length mismatch instead of silently truncating.
  - Enrollment captures **3 samples** over a 3 s window with 250 ms gaps (progress shown as "n/3"); if fewer than 3 good samples arrive it keeps retrying within the burst instead of saving a weak template.
- Backend pairing: `FaceController::enroll` enforces `descriptors.min:3` server-side.

### Face verification now required per app open — not per refresh
- `securityStore.ts` `verified` flag moved from memory-only to **`sessionStorage`** (`soms_face_verified`): survives page refreshes/navigations but is wiped when the app/tab closes.
- Behavior: fresh app open → face verify; refresh mid-app → no re-prompt; logout/login still reset it (`resetVerified()`/`clear()` also clear storage); **QR scanning always runs its own live verification per scan** (unchanged, independent of this flag).

### 405 on login fixed — centralized env config with production fallbacks
- **Symptom**: deployed PWA posted to its own origin (`/api/login` → 405 from static hosting) because `VITE_API_URL` wasn't set in the Vercel build.
- **New `src/config/app.ts`**: single source for `API_URL`, `QR_KEY`, `VAPID_PUBLIC_KEY`. Env vars override; production builds fall back to the deployed backend (`https://luxmap.devokss.online/api`, server QR key, server VAPID public key) so deploys without configured env vars just work. Dev keeps `/api` + no key unless env provides them.
- Consumers updated: `services/api.ts` (baseURL), `utils/imageUrl.ts` (storage-asset prefixing), `services/crypto.ts` (QR decrypt), `services/push.ts` (push subscription).
- Note: the QR key ships inside the client bundle by design (the PWA decrypts QR payloads locally via Web Crypto) — it is functional, not secret. If you prefer not to commit it in source, set `VITE_QR_KEY` in Vercel and remove the fallback.

### Deployment notes
- Vercel auto-deploys on push to `DevOkss/LUXMAP-PWA` main. Verified live bundle contains the API host + keys; CORS preflight + POST against the API return correct headers/422 validation JSON from the PWA origin.
- Backend deployment (Hostinger VPS, CI/CD via GitHub Actions) is documented in `SOMS/SOMS-SUMMARY.md`.

## Previous Session (August 10, 2026) — security-gate hardening, offline scanner map, PWA install + deploy prep

> Backend pairing in `SOMS/SOMS-SUMMARY.md` ("single active session + PWA install landing page + deploy readiness"). This session focused on the PWA experience around face/device gating, offline scanning, and installability.

### Security gate now enforced at the route level
- **`src/services/securityGate.ts`** reworked: cached gate (localStorage, 60s TTL) + offline-safe `runSecurityGate` (skips `/device/status` when offline, uses cached binding so the scanner and face verification work without internet). Requirement order = **face enrollment → device binding → transfer → proceed**.
- **New `src/stores/securityStore.ts`**: `resolve(userId, {force})` caches the gate; `verified` flag (session-scoped) + `markVerified`/`resetVerified`/`clear`.
- **`src/router/index.ts`**: async `beforeEach` enforces the gate on every protected (non-`securityFlow`) route — `setup`/`enroll-face`/`transfer`/`offline-blocked` each redirect to the required step; when face+device are set up the student must first pass `/security/verify`. Security pages are `securityFlow` so they're always reachable. Back/refresh/direct-URL can't bypass.
- **`src/pages/security/Verify.vue`** (new): login-time face verification (`FaceCamera mode="verify"`) — every fresh login requires a face blink before entering the app.
- **`src/pages/security/Index.vue`**: now distinguishes *no binding* vs *bound to another device* (shows "Transfer to This Device" instead of "Bind This Device"), and `security/Setup.vue`/`Transfer.vue` gained a clear "Device Bound Successfully" state. `FullPageLayout.vue` shows a **Sign Out** button on `securityFlow` pages (the only escape from the gate).
- `api.ts` on **401** clears the session and dispatches `soms:session-expired`; `App.vue` listens and routes to login. `authStore.forceLogout()` resets local state without hitting the API.

### Face enrollment / verification UX (blink + distance)
- **`src/services/face.ts`**: split detection into a fast landmarks-only pass (inputSize 160) for the blink loop + a descriptor pass run only after a blink. Blink detection is **edge-triggered** with an **adaptive EAR baseline** (running max with decay) plus **dip** and **sharp-drop** detection so a straight-on face registers a blink reliably. `onDistance` callback reports close/far/ok.
- **`src/components/FaceCamera.vue`**: mirrored selfie preview, vertical face-shaped oval guide (turns red for too-close/too-far, green at good distance), animated scan-sweep, live guidance pill + step tracker (Position → Blink → Capture), and a "Blink now" badge. Models are **precached** in the SW so verification works offline.
- **`src/components/GeofenceMap.vue`**: offline-aware — when tiles fail (`tileerror`/`offline`) it shows a clean grid fallback with a "Map imagery unavailable offline" badge; custom divIcon markers (green center dot, blue user dot) replace the Leaflet default pin.

### PWA install + deploy prep
- **`src/services/installPrompt.ts`** (new): captures `beforeinstallprompt`; **`src/components/InstallPrompt.vue`** shows a bottom "Install LuxMap" banner on the PWA origin when the prompt is available.
- **`vercel.json`** (new): SPA rewrite (`/(.*)` → `/index.html`) + `no-cache` on `/sw.js`. **`.env.example`** added documenting `VITE_API_URL`/`VITE_QR_KEY`/`VITE_VAPID_PUBLIC_KEY`.
- **Icons fixed**: generated `public/icons/icon-192x192.png` + `icon-512x512.png` (from `logo.png`); manifest now lists real 192/512 (+ `maskable`) icons so the install prompt appears.
- **LuxMap rename**: manifest (`LuxMap Student` / `LuxMap`), `index.html` title, `sw.ts` notification title, and scanner/transfer messages.

## Earlier on August 9, 2026 — backend-only: admin dashboard overview + transactions export

> No PWA changes this session. The work landed entirely in the Laravel admin portal (`SOMS/`) — see `SOMS-SUMMARY.md` "admin dashboard overview + transactions Excel export":
> - `/admin/dashboard` rewritten as a full overview (income/exempted, per-org students+officers, monthly income chart).
> - Payments **Transactions total now excludes waived/exempted** amounts (paid money only).
> - New **transactions Excel export**: `GET /admin/payments/export` streams a `.xlsx` (receipt number, student, org, term, type, description, amount, method, reference, status, processed-by, notes; exempted rows highlighted amber) with a fee/penalty + individual-item selector dialog.
>
> The student PWA remains on the device-binding/face stack below; no API contract changes.

## Earlier on August 9, 2026 — device binding + face recognition (device + attendance hardening)

> Backend pairing lives in `SOMS/SOMS-SUMMARY.md` ("device binding + face recognition"). This session wires the PWA face/device stack on top of the new `/api/device/*` + `/api/face/*` endpoints.

### Face enrollment (liveness) — new
- **`src/services/face.ts`**: loads `@vladmandic/face-api` models (`face_landmark_68` + `face_expression` from `public/models/`), then exposes:
  - `captureDescriptor()` → 128-float descriptor from the live view.
  - `runLiveness()` — runs the **expression** network and requires a "non-neutral" expression above a threshold before capture is accepted (reduces photo/spoof enrollment).
  - descriptor validation (`128 floats`, mapped/constrained range) mirrored by the backend.
- **`src/components/FaceCamera.vue`** — camera preview + liveness prompt ("keep your face in frame, move your head"), runs `captureDescriptor` → returned to the caller.
- **`src/views/security/FaceEnroll.vue`** — top of the security flow: `captureDescriptor` → `POST /face/enroll` → caches descriptor to IndexedDB, updatesProfileCard badge.
- **`src/services/db.ts`** now **v3**: added a `local_profile` store (persists the last enroll descriptor + binding state) so the gating screens can show instantly offline-tolerant states.
- Face models shipped under `public/models/` → `dist/models/` (≈20 MB `.bin` files); the SW serves them cache-first via a new **`/models/` CacheFirst route** (`face-models` cache, 30-day expiry) so offline enrollment/verification still loads.

### Device binding + fingerprint — new
- **`src/services/device.ts`** — hardware fingerprint: Canvas/WebGL `renderer`+`vendor`, `userAgent`, `language`, `platform`, `screen`, `timezone`; SHA‑256-hashed; sent as the **`X-Device-Fingerprint`** header (axios interceptor adds it when present).
- **`src/composables/securityGate.ts`** — `securityState` exposes `faceEnrolled`, `deviceBound`, `lastCheck`; `requireSecurity()` redirects a route to `/security` when face/device aren't set up; used by the router guard for `/scanner` + dashboard cards.
- **`src/views/security/BindDevice.vue`** — shows `GET /device/status`, then `POST /devices/bind` when online; renders "approved" on success; surfaces the 422 "already bound elsewhere" (user gets a Transfer flow next).
- **`src/views/security/SecurityGate.vue`** — landing/copy step combining face enrollment + device binding + explainer (why each), routing between the two forms.

### Router / gating
- New routes `/security`, `/security/face`, `/security/device`. **`/scanner`** now requires `securityGate`; `handleScan` at the top checks the face descriptor + bound device are present (server re-authorizes the liveness signature); if missing, shows a one-time inline "Security check" sheet instead of silently scanning (`Login`/`Onboarding` also point at faces setup).

### Backend
- All binding/face/transfer work is done in `SOMS/` (encrypted descriptors, one-device binding + transfer requests, admin unbind) — see `SOMS-SUMMARY.md`.

### Build / verification
- `npm run build` (vue-tsc + vite) passes; `dist/models/**` present; SW emits the `/models/` route + 46 precache entries. Backend suite passes 307 (25 new device/face tests).

## Earlier on August 9, 2026 — payments UX polish, receipts full-screen, notifications, profile redesign, push fixes

### Payment account: QR image view + channel from account
- **`src/utils/paymentChannel.ts`** (new): `paymentChannelForProvider(provider)` maps the account's `account_provider` → backend channel (`gcash`/`maya`/`bank_transfer`/`other`; case-insensitive substring match, else `other`); `paymentChannelLabel(channel)` → display labels (incl. legacy `cashless`).
- **`payments/Create.vue`**: the QR thumbnail is now a tappable button that opens a **full-screen lightbox** (Teleport to body, backdrop/✕ close, account details + "Open image" link); shows a "No QR set" placeholder otherwise. The hardcoded channel dropdown (GCash / Maya / Bank Transfer / Other) was **replaced with a read-only channel auto-derived from the payment account** (`account_provider`); it recomputes when switching org. **Submission is blocked** when the selected org has no payment account (Pay button disabled + submit guard), matching the amber "no account set up yet" warning.
- **`payments/Submissions.vue`**: now imports the shared `paymentChannelLabel` (its inline map was removed).

### Storage image URLs fixed (QR + receipt images)
- The backend API returned **absolute** `APP_URL/storage/...` URLs (e.g. `http://localhost:8000/...`), which broke on LAN devices/phones (`localhost` = the phone, not the dev machine). Backend `Api\PaymentController` now returns **relative** `/storage/...` paths for `qr_code_image_url` and `receipt_image_url`.
- New **`src/utils/imageUrl.ts`** `resolveImageUrl()`: passes absolute URLs through, prefixes relative paths with the `VITE_API_URL` origin when set, else leaves them relative (same-origin/proxied). Applied in `Create.vue` (QR) and `Submissions.vue` (receipt link).
- **`vite.config.ts`**: added a `/storage` dev-server proxy → `http://127.0.0.1:8000` (alongside `/api`), so storage images load on LAN devices in dev.

### FormData multipart upload fixed (`services/api.ts`)
- The axios instance set a global default `Content-Type: application/json`, which made axios serialize `FormData` to JSON (dropping the file) → "The receipt image field is required." even after attaching a file. The request interceptor now **deletes the Content-Type for `FormData` requests** so the browser sends `multipart/form-data; boundary=...`. Other JSON requests are unaffected.

### Payments history: full screen + filters (`payments/History.vue`)
- Route moved to **`FullPageLayout`** (back → Dashboard); still the Payments bottom-tab target.
- **Status select**: All / Paid / Pending. "Paid" filters confirmed payments (`status === 'paid'`); "Pending" renders the pending-verification submissions (org, term, reference, itemized totals, channel, receipt link).
- **Term select**: "All terms" + each distinct academic term in the student's data (payments + submissions); filters whichever list is shown. `Payment` type gained `academic_term`.

### Receipts pages full screen
- `receipts` + `receipts/:id` moved to **`FullPageLayout`** (back → Payments / Receipts).

### Notifications improvements
- **Descriptive body**: `notifications/Index.vue` was reading `data.message` but the backend stores `data.body` → the message never displayed. Now shows `body` (fallback `message`); title falls back to a friendly "Notification".
- **On-demand loading**: the list renders the first **10** with a **"Show more"** button (+10 per click) instead of showing all 50 at once.
- **Unread badge**: `notificationStore` now uses the server-provided `unread_count` (falling back to deriving from the loaded list) and recomputes after mark read / all read. `BottomTabBar.vue` shows a red unread badge on the Notifications bell and fetches notifications on mount. (`NotificationBell.vue` remains unused.)

### Profile redesign (`profile/Index.vue`)
- Modern, on-theme redesign: gradient green **hero card** (initials avatar, name, student number, "Student" + academic-term chips), **Student Information** grid of pastel icon tiles (Institute, Program/Course, Year Level, Email, Phone, Sex), the **Push Notifications** toggle card, and a red-accented **Sign Out** card.
- Refreshes profile data via `POST /me/refresh` on mount (falls back to the cached `user` offline).
- **Removed**: Biometric Settings, Attendance History, and Payment History buttons. Deleted the dead `profile/Settings.vue`, `services/webauthn.ts`, and the `WebAuthnCredential` type; removed the `profile/settings` route. `User` type gained `academic_term`.

### Push notification toggle fixed
- Root cause: the service worker was **not served in dev** (`vite-plugin-pwa` `devOptions` disabled) and `ensureRegistration()` permanently cached a null result → `pushManager.subscribe` silently failed → the toggle "did nothing".
- `vite.config.ts`: added `devOptions: { enabled: true, type: 'module' }`.
- `main.ts`: replaced the manual `navigator.serviceWorker.register('/sw.js')` with `registerSW({ immediate: true })` from `virtual:pwa-register` (registers the dev SW in dev, `/sw.js` in prod). `tsconfig.app.json`: added `vite-plugin-pwa/client` types.
- `services/push.ts`: `ensureRegistration()` now retries waiting for the registered SW instead of caching a null.
- `src/sw.ts`: the navigation `createHandlerBoundToURL('index.html')` handler is only registered when `index.html` is actually precached — fixes the dev **"non-precached-url"** workbox error (empty dev manifest); `__WB_MANIFEST` is referenced once so workbox's inject-manifest assertion passes.
- The profile toggle now surfaces an error message when enabling fails (e.g. insecure origin — push requires HTTPS/localhost).

## Earlier on August 8, 2026 — cashless payment submissions + verification status + receipts

### Cashless payment submission flow (`/payments/create` → `/payments/submissions`)
- **`payments/Create.vue` rebuilt** around the backend "pending verification" workflow (replaces the old legacy `createPayment` POST). Grouped obligations by organization (org picker when multiple):
  - Shows each org's **official payment account** (account name / provider / number + QR image) from the new `feeStore.paymentAccounts`, sourced via `GET /payments/outstanding` (`payment_accounts[]`); warns when an org has no account set up.
  - Multi-select **fees + penalties** (checkbox pills, live ₱ total), reference number, **payment channel** dropdown (GCash / Maya / Bank Transfer / Other), and a **receipt screenshot/photo upload** (JPG/PNG/WEBP).
  - Submit → `paymentStore.submitPayment()` sends a **multipart** `POST /payments/submissions` with `fee_ids[]`/`event_ids[]`/`reference_number`/`payment_channel`/`receipt_image`, then routes to `/payments/submissions`. Errors surface the backend message / first validation error inline.
- **New `payments/Submissions.vue` (route `payments-submissions`, "Pending Verification")**: groups submissions by `group_key`; each card shows org · academic term · submitted time · reference, item list + grand total, channel label, "View uploaded receipt" link to `receipt_image_url`, and a status badge — **Pending Verification** (amber) / **Verified** (green, with `verified_at` note) / **Rejected** (red, with `rejection_reason` + "Resubmit payment" → create). Refresh button + empty state ("No payment submissions yet").
- **`fees/Index.vue`** now shows a **"Pending Verifications" counter**: an amber-count link (from `feeStore.pendingVerification`) to `/payments/submissions`; fee and penalty rows that already have an unresolved submission show a **"Pending Verification"** badge (via `feeStore.isPending()`).

### Outstanding → store rework (`feeStore.ts`, `types/index.ts`)
- `loadOutstanding()` now reads the richer **`GET /payments/outstanding`** payload `{ fees, penalties, unresolved, payment_accounts }`; `fetchFees`/`fetchPenalties`/`fetchSummary` all populate `fees`, `unresolved`, and the new `payment_accounts`.
- New `pendingVerification` computed + `isPending(obligation_key)` (`unresolved` keys) drive the pending badges.
- New types: `PaymentAccount`, `PaymentSubmissionGroup` (+ `PaymentSubmissionItem`), `OutstandingPayload`; `Receipt` now nests the payment (`amount`, `payment_method`, `status`, `paid_at`, `user`, `organization`).

### Payment history + receipts pages
- **`payments/History.vue`** rewritten for the real API ledger: item name (fee/penalty/event), org, amount, paid/created date + method badge (Cash / E-payment / Exemption), status badge (Paid / Exempted / Refunded), "View receipt" shortcut, **Receipts** link.
- **`receipts/Index.vue` + `receipts/Show.vue`** (new): list from `GET /receipts`; detail from `GET /receipts/{id}` with the receipt-style card (receipt number, issued date, amount, status, organization, paid date, student).
- **Router**: new FullPageLayout routes `payments/create` and `payments/submissions`.

> The old flagged issue ("`paymentStore.createPayment` still posts legacy `payable_type`/`method`, QRPH enum missing → **Pay submits 422**") is **resolved by this flow** — students no longer POST a raw payment; they submit a verification request via `/payments/submissions`.

## Earlier on August 8, 2026 — admin payment roles reallocated (backend-only context)

- This earlier pass touched only the **Laravel admin portal** (`SOMS/`); the student-facing PWA was unchanged at that point. Payment roles were reallocated admin-side — **officers** (in the admin panel) record cash payments, grant exemptions, and **approve/reject the cashless submissions this PWA now submits**; **heads** set fee + penalty amounts and manage the payment accounts the PWA shows; super admin no longer manages fees/payments/verification/accounts.
- The current session (above) builds the matching **student side**: submit cashless payment → shows as "Pending Verification" in the admin for an officer to approve → creates a paid transaction + receipt (viewable in the PWA's Receipts).

## Earlier on August 8, 2026 — fees & penalties full-screen combined balance

### Fees & Penalties — full-screen combined balance with accordion
- **`/fees` moved to `FullPageLayout`** (no header/bottom nav, back → Dashboard). Hero gradient card (primary-700→900, wallet icon) shows the **combined total** (`totalCombined = due fees + pending penalties`) with a `fees · absences` count; tapping rotates a chevron.
- **Accordion breakdown** (`fees/Index.vue`, `Transition`):
  - **Fees** section — each due fee: name, org · term, due date, amount, Pending badge (from `feeStore.dueFees`).
  - **Penalties** section — red alert header + total + "N absences recorded"; per-penalty row: event title, **initiating organization** (`event.organization.name`), date, `N missing scan(s)`, amount, Unpaid badge. Each penalty row is itself an accordion ("View absent details") listing the **missing QR configurations** (Time In / Time Out label + valid window).
  - **Pay** button → `payments-create`.
- **Penalties are computed, not stored** (backend deleted auto-population): `feeStore` fetches them from the new **`GET /fees/my/penalties`** endpoint instead of `GET /payments?fee_type=penalty`. Both `fetchPenalties()`/`fetchSummary()` hit `/fees/my/penalties`. `fetchPenalties()` no longer takes a `userId`.
- `Penalty` + `Payment` types gained `absences?`, `missing_qr_configurations?`, and nested `event.organization`; `feeStore.absences` is now the **sum of per-penalty `absences`** (was `penalties.length`).
- **QR type labels**: `qrTypeLabel()` maps `time_in` → "Time In", `time_out` → "Time Out" (was raw string); added `fmtTime()` (12-hour).
- **`/payments/create`** is full-screen (`FullPageLayout`, back → Fees), **QRPH-only** (method locked `qrph`), single QRPH panel (cash option removed). `/payments/history` uses `payment.payment_method`.
- Dashboard pending fees use `feeStore.dueFees.slice(0,3)` + `fee.amount`.
- Build passes (Vite 8.1, PWA v1.3.0, 39 precache entries).
- **Note**: `paymentStore.createPayment` still posts legacy `payable_type`/`method` fields and backend `payment_method` enum (`cash,gcash,maya,bank_transfer,card`) lacks `qrph` → Pay submit 422s. Flagged, not yet fixed.

## Previous Session (August 7, 2026)

### Push notifications (Web Push / VAPID) — new (same day, ~after headless fees)
- **Purpose**: students receive a visible notification for fee/event postings and upcoming fee deadlines without a third-party push service.
- **Service worker converted to `injectManifest`** (`vite.config.ts`): custom `src/sw.ts` replaces the auto-generated `generateSW` worker so we can add `push` + `notificationclick` listeners. Setup: `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`. The old `workbox` runtime-caching was preserved (NavigationShell cache fallback + API `NetworkFirst` runtime cache) and re-implemented in `src/sw.ts`.
- **`src/services/push.ts`** — `subscribeToPush()` (requests permission, subscribes via `PushManager` with `VITE_VAPID_PUBLIC_KEY`, persistently stores the `PushSubscription` via `PUT /api/notifications/push-token`), `unsubscribeFromPush()` (calls the new `DELETE /api/notifications/push-subscription`, then unsubscribes), plus `pushSupported()` gating. Adds base64→Uint8Array conversion for the VAPID public key.
- **`src/sw.ts`** — precaches via workbox, handles `push` events (shows a `Notification` with title/body/icon from the payload), and `notificationclick` (focuses an existing `window` client then navigates to the payload URL, or `openWindow`s it).
- **`vite.config.ts`**: manifest keeps the icon; `gcm_sender_id` unused/removed. `injectManifest` uses `src/sw.ts` and `dist/sw.js` output.
- **Types/build note**: `tsconfig.app.json` now `exclude`s `src/sw.ts` (dedicated worker lib check). Imported workbox modules `workbox-core`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration` are available locally.
- **Auth wiring**: `src/stores/authStore.ts` calls `subscribeToPush()` after a successful `login()` and `unsubscribeFromPush()` during `logout()`.
- **`.env`**: added `VITE_VAPID_PUBLIC_KEY` (must match the Laravel `VAPID_PUBLIC_KEY`).
- **Incoming push payloads** carry `{ title, body, data: { url, fee_id/event_id }, icon, badge }`; tapping opens `url` (default `/notifications`).
- **Backend (Laravel, in `SOMS/`)** supplies the VAPID support + triggers; see `SOMS-SUMMARY.md`. The PWA itself depends on: `PUT /api/notifications/push-token`, `DELETE /api/notifications/push-subscription`, and pushes emitted on fee/event posting + the 3-day fee-due scheduler (`notifications:fees-due`, daily 08:00).

### Architecture change — PWA is now **students-only**
- The Officer Workspace has been **migrated to the Laravel SOMS admin panel** and removed from the PWA.
- Deleted `src/pages/officer/**` (Dashboard, events CRUD, QrConfig).
- Removed all `/officer/*` routes from the router (incl. `officer-scanner`; student `/scanner` remains) and the officer role-guard branch.
- `AppLayout.vue`: removed the officer role pill + workspace switcher (student-only header).
- `BottomTabBar.vue`: removed the officer pill (student FAB Scan only).
- **Backend**: `WorkspaceService::getAvailableWorkspaces` now returns only the student workspace, so officers get no officer workspace in the PWA.
- Students (including officers who are also enrolled students) keep: dashboard, events browser, attendance, scanner, fees/payments/receipts, notifications, profile.
- **Remaining dead code** (left as-is): `src/stores/eventStore.ts` + `src/stores/qrStore.ts` (were officer-only), `stores/workspaceStore.ts`, `components/WorkspaceSwitcher.vue`, `services/qr.ts`.

### Fees now reflect real assignments (same session)
- Backend fees were rebuilt: heads create/post fees (SSC/ISC/SRO scope × required year levels); posting assigns students via the new `fee_user` pivot. `GET /fees` is now scoped to the student's assignments and returns a real `pivot` (amount/status).
- `Fee` type updated (added `term`, `required_years`; removed stale `type`/`is_mandatory`); `fees/Index.vue` shows the org + term and real **pending/paid** status from the pivot.

### Offline sync fixes (same session)
- **Duplicate offline saves fixed**: `db.queueAttendance()` now skips adding a record when an unsynced record with the same `qr_configuration_id` is already queued; `Scanner.vue` `confirmAttendance()` guards against double-submit (`if (saving.value) return`) and uses one `scanned_at` timestamp.
- **Sync now actually saves**: backend `POST /attendance/sync` processes records inline instead of dispatching a queue job (no worker was running), so synced records are persisted; the PWA still removes them from IndexedDB after a 200.

## Previous Session (August 7, 2026)

### Completed — Attendance Hub + Per-Org Event Accordion

**`/attendance` hub (`attendance/StudentIndex.vue`)**:
- Cards are now **identical to the events hub** (`events/OrgIndex.vue`): gradient letter block (SSC/ISC/SRO) + org name + type badge + chevron only (no stats). Still driven by `GET /attendance/student-stats` for org id/name resolution.
- **Top-right "Sync" button with a red badge** showing the offline pending count (`db.getQueueCount()`) → navigates to the `/attendance/queue` sync page (now a **full-page** route under `FullPageLayout` with back to Attendance). The old amber "Sync All" banner was removed.

**`/attendance/:orgId` (`attendance/OrgDetail.vue`)**:
- Now fetches the new backend endpoint `GET /attendance/events?organization_id=X` instead of the flat history list.
- Renders one **event card per attended event**: title, date/venue, and `attended_count / total_qr_configs` with a "Complete" badge when all QR sessions were attended.
- Clicking a card opens an **accordion** (rotating chevron) listing that event's attendance rows: Time In/Out badge + scanned time + "Pending" (if the `qr_configuration_id` is still in the offline IndexedDB queue) / "Synced" status.
- Org header uses the gradient + type passed via `?type=` query from the hub (fallback to `organization.type` from the response); added an offline retry state.

**`/attendance/queue` sync page (`attendance/Queue.vue`)**:
- Offline records are now **grouped per event** (via `qr_payload.event_id`/`event_title`), each card listing its Time In/Out records (scanned time + valid window) with a per-event **Sync** button.
- **Sync All** button in the header; both buttons disable while a sync is in progress.
- **Synced records are deleted from the IndexedDB queue** (replaces the old `markSynced` flag) — `db.deleteQueuedAttendance()` + `sync.ts` updated; after a sync the page re-fetches so synced events are removed from the list.
- Empty state ("All caught up") when nothing is pending.

**No background auto-sync**:
- `syncManager.start()` removed from `AppLayout.vue`; `SyncManager.start()/stop()` and the 30s interval + `online` listener deleted from `services/sync.ts`. Syncing now happens **only** when the user explicitly triggers it (sync page buttons).
- **Open-app prompt**: when `AppLayout` mounts (first screen after login) it reads the IndexedDB queue count; if > 0 it shows a modal — "Attendance needs to sync" — with **Go to Sync** (→ `/attendance/queue`) and **Later** (dismiss). Reuses the attendance hub's existing badge too.

**Required-students display**:
- `EventResource` now ships `required_years` (merged across QR configs), so no more per-event `/qr-configurations` fetches.
- New helper `src/utils/requiredStudents.ts`: `requiredYearsLabel()` ("All students required" / "1st, 2nd Year required") and `isStudentRequired()` (checks the student's `year_level` from `authStore.user`).
- **Dashboard** upcoming events and **`/events` list cards** (`events/OrgEvents.vue`) show the required-years line plus an amber **"You're required"** badge when the student's year is included.

**Officer workspace upcoming events (`officer/Dashboard.vue`)**:
- Now mirrors the student upcoming card: clickable (→ `officer-events-show`), org badge (colored by type), venue, time, and the required-years label — but **no "You're required" badge** (student-only indicator).
- Events are scoped to the officer's own organization by the backend (fetch already sends `currentWorkspace.organization_id`; the API now enforces manage-scope isolation), so only the officer org's events appear.

**"Published" → "Posted" wording**:
- New `src/utils/eventStatus.ts` maps the backend status value to display labels (`published` → "Posted"). Applied across the officer workspace: event status badges, the filter dropdown, the dashboard "Posted" stat, and the Post/Unpost buttons + toasts. The API/DB status value remains `published` — this is display-only.

**Attendance export (officer)**:
- `officer/events/Show.vue` has a **"Download Attendance"** button that fetches `GET /events/{id}/attendance/export` as a blob (bearer token auto-attached) and saves `{event-title}-attendance.xlsx`; success/error toasts.

### Backend dependency
- New endpoint `GET /api/attendance/events` (Laravel) — must be deployed before these pages return data.
- `required_years` on `EventResource` (Laravel) — must be deployed for the dashboard/events pages to show requirement info.
- Event listing/view scoped to the officer's manage orgs (Laravel) — must be deployed for the officer workspace isolation.
- `GET /api/events/{event}/attendance/export` (Laravel + `phpoffice/phpspreadsheet`) — must be deployed for the officer Download Attendance button.

## Previous Session (August 6, 2026)

### Completed — New Student Feature Pages

**Events browser (`/events`)**:
- `events/OrgIndex.vue` — "My Organizations" hub: static SSC / ISC / SRO cards → navigates to `events-org`.
- `events/OrgEvents.vue` — per-org event browser. Resolves org id via `GET /events/student` (cached per type in localStorage), lists events via `GET /events?organization_id=`, filters out drafts. **List/Calendar toggle** (custom month grid with per-day event-count badges + drill-down), status filter (upcoming/ongoing/done/completed via `getEventStatus()` + `useNow()` live clock), offline state with retry.
- `events/StudentShow.vue` — student event detail. Fetches event + QR configs + attendance history in parallel; renders "QR Attendance" list (Time In/Out) with time ranges and **Attended / Not Attended** badges computed from history `qr_configuration_id`s. Live status badge.

**Attendance overview (`/attendance`)**:
- `attendance/StudentIndex.vue` — `GET /attendance/student-stats` → per-org (SSC/ISC/SRO) total/complete cards; pending-sync banner + "Sync All" via `syncStore`; navigates to `attendance-org`.
- `attendance/OrgDetail.vue` — per-org attendance history: paginated `GET /attendance/history?organization_id=&per_page=10&page=` with "Load More"; marks offline-queued records pending (from `db.getQueuedAttendance()`); per-record "Sync" + "Sync This Org" bulk actions (single-record `POST /attendance/sync`).

**Announcements**:
- `announcements/Index.vue` — placeholder "Coming Soon" page only (no API calls).

**Payload shift (important)**:
- Attendance now keyed by **`qr_configuration_id`** everywhere, not `event_id`: `scanOnline({ qr_configuration_id, scanned_at })`, `scanOffline({ qr_configuration_id, user_id, scanned_at, qr_payload })`, `AttendanceQueueRecord` includes `qr_payload`, sync sends `{ records: [{ qr_configuration_id, user_id, scanned_at }] }`.
- `eventStore` no longer has `startEvent()`/`cancelEvent()` — no start/cancel actions exist in the UI (backend has no such endpoints either).

### Known Mismatch — WebAuthn
`profile/Settings.vue` once implemented **Biometric Settings** using `services/webauthn.ts` and called `GET /webauthn/credentials`, `POST /webauthn/register/options`, `POST /webauthn/register`, `DELETE /webauthn/credentials/:id`. **The Laravel backend has NO WebAuthn routes** (removed server-side on Aug 2), so all those calls 404'd. **Resolved on Aug 9**: the Biometric Settings button/page/route/service/type were removed entirely (profile redesigned).

### Previous Sessions (August 2, 2026)
- Offline-first QR decrypt via `crypto.subtle` (AES-256-CBC, shared `QR_ENCRYPTION_KEY`).
- Scanner page (`ScanLayout`), QrScanner camera states, upload via `Html5Qrcode.scanFile()`.
- Attendance preview: live map + geofence circle + GPS dot; time-window (hours/minutes), geofence (Haversine), not-started/ended checks.
- "Submit Now" / "Save & Sync Later"; `SyncManager` polls 30s + on `online`, bulk `POST /attendance/sync`.
- Officer event management: create/edit draft, publish/unpublish/complete/delete, QR config with Leaflet geofence map, QR download, required-students checkboxes.
- Workspace switcher, toast system, route role guards, `FullPageLayout`/`ScanLayout`.

## 1. Tech Stack
- **Framework**: Vue 3.5 (Composition API, `<script setup>`, TypeScript)
- **Build**: Vite 8.1
- **State**: Pinia 4
- **Routing**: Vue Router 4 (lazy-loaded routes)
- **HTTP**: Axios (with token interceptor)
- **CSS**: Tailwind CSS 3.4 + @tailwindcss/forms
- **PWA**: vite-plugin-pwa (Workbox, offline caching)
- **Maps**: Leaflet (ESRI World Imagery satellite tiles)
- **QR**: html5-qrcode (scanner)
- **Offline DB**: IndexedDB via `idb` wrapper

## 2. Architecture

### Route Structure
```
/auth/login          — Student ID + password login
/auth/onboarding     — Institute + program selection

/ (Student — AppLayout)
├── /dashboard       — Quick access + upcoming events + pending fees
├── /scanner         — QR code attendance scanner
├── /attendance/queue     — Offline queue
├── /attendance/history   — History
└── /payments/history — (FullPageLayout page; the Payments bottom-tab target)

(FullPageLayout — no header, no bottom nav)
├── /security           — Face + Device security center (Aug 9)
├── /security/face      — Face enrollment (liveness camera)
├── /security/device    — Device binding
├── /events              — My Organizations hub (SSC/ISC/SRO cards)
├── /events/:type        — Per-org event browser (list/calendar toggle)
├── /events/:type/:eventId — Student event detail + QR attendance list
├── /fees                — Fees & Penalties (hero total + accordion)
├── /payments/create     — Cashless payment submission form (QR lightbox, channel from account)
├── /payments/history    — Payment history (All/Paid/Pending + term filters)
├── /payments/submissions — "Pending Verification" submissions list
├── /receipts            — Receipts list
├── /receipts/:id        — Receipt detail
├── /attendance          — Per-org attendance stats overview
├── /attendance/:orgId   — Per-org attendance history + offline sync
├── /attendance/queue    — Offline sync queue
├── /announcements       — Placeholder
├── /notifications       — Notification list (10-at-a-time "Show more")
└── /profile             — Student profile (redesigned)
```

`/scanner` uses the full-screen **ScanLayout** (not AppLayout). Officer routes/pages were removed from the PWA (Aug 7 migration to the admin panel). `/scanner` + dashboard scan entry now require the **security gate** (face enrolled + device bound; Aug 9).

### Route Guards
```ts
router.beforeEach((to, _from, next) => {
  // 1. Auth token check → redirect to login
  // 2. Onboarding check → redirect to onboarding
  // 3. Role check: if meta.role === 'officer' && ws.role === 'student' → redirect to dashboard
  next()
})
```

### Layouts
| Layout | Header | Bottom Nav | Transition | Used By |
|---|---|---|---|---|
| `AppLayout` | Gradient green + avatar | Floating pill with center FAB | `page` slide+fade | Dashboard, attendance history/queue |
| `FullPageLayout` | Back button only | None | `page` slide+fade | Events, fees, payments, receipts, attendance, notifications, profile |
| `AuthLayout` | Split screen with TCGC image | None | None | Login, onboarding |

### Bottom Tab Bar (AppLayout)
- **Student**: Home / **Payments** / Notifications / Profile (note: *Payments*, not Fees — fees live on the Home dashboard)
- **Officer**: Home / Events / Notifications / Profile
- Center raised FAB: Scan QR (student) / Create Event (officer)
- Active tab: green indicator dot + `text-primary-700`

## 3. Design System

### Colors
```js
// tailwind.config.js
primary: {
  50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0',
  600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b'
}
```
- Background: `#F3F4F1` (warm light sage)
- Cards: `bg-white rounded-3xl shadow-sm`
- Inputs: `rounded-xl border-gray-300 focus:ring-2 focus:ring-[#20673A]`
- Buttons: `rounded-xl bg-[#20673A]` (dark green)

### Header Design
- Gradient: `linear-gradient(160deg, #064E3B, #065F46, #047857)`
- Avatar circle with user initials
- "Welcome back, Name" + role label
- Decorative bottom swoosh SVG (green + amber curves)

## 4. Stores (Pinia)

### authStore
```
user, token, workspaces[], currentWorkspace, onboardingData
login(), logout(), fetchOnboarding(), completeOnboarding(),
refreshFromInstitution(), fetchWorkspaces(), switchWorkspace(), fetchUser()
```
- Workspaces persisted to localStorage on login
- Loaded from localStorage on refresh
- Re-fetched from API on mount if stale

### eventStore
```
events[], loading
fetchEvents(params), fetchEvent(id), createDraft(), updateEvent(),
publishEvent(), unpublishEvent(), completeEvent(), deleteEvent(), loadCached()
```
- **Note**: no `startEvent()`/`cancelEvent()` — there are no start/cancel endpoints or UI actions.

### qrStore
```
configs[], loading
fetchConfigs(eventId), getLast(eventId), createConfig(),
updateConfig(), generateQr(), deleteConfig()
```

### Other Stores
- `feeStore` — fees + penalties + outstanding summary from `GET /payments/outstanding`; state: `fees`, `penalties`, `unresolved` (obligation keys with a pending submission), `paymentAccounts` (official payment accounts per org); computed `dueFees`/`totalFees`/`totalPenalties`/`absences`/`totalCombined`/`pendingVerification`; `isPending(key)`; actions `fetchFees`/`fetchPenalties`/`fetchSummary`
- `paymentStore` — payment history + **submissions**: `payments`, `submissions`, `loading`, `submitting`; actions `fetchHistory()` (`GET /payments`), `fetchSubmissions()` (`GET /payments/submissions`), `submitPayment(payload)` (multipart `POST /payments/submissions` with fee_ids[]/event_ids[]/reference_number/payment_channel/receipt_image)
- `attendanceStore` — attendance records + offline queue; `scanOnline({ qr_configuration_id, scanned_at })`, `scanOffline({ qr_configuration_id, user_id, scanned_at, qr_payload })`, `refreshQueueCount()`
- `notificationStore` — notifications + unread badge: uses server `unread_count` (fallback: derived from the loaded list), `markRead`/`markAllRead` recompute; drives the bottom-tab bell badge
- `syncStore` — offline sync queue count + `triggerSync()`
- `workspaceStore` — ⚠️ **dead code**, not imported anywhere

## 5. Toast System

**Composable**: `src/composables/useToast.ts`
- Reactive toast queue with auto-dismiss (3s)
- `show(message, type)` — type: 'success' | 'error'
- Slide-down animation from top center

**Component**: `src/components/AppToast.vue`
- Teleported to `<body>` (z-index: 3000)
- Green for success, red for error
- Rendered globally in `App.vue`

## 6. Event Management Flow

### Create
1. Officer fills draft form: title, description, venue, event_date
2. `POST /events/draft/store` → status = 'draft'
3. Redirected to QR Configuration page

### QR Configuration
1. Select type: Time In / Time Out
2. Set valid_from and valid_until (time only, date from event_date)
3. Pin geofence location on Leaflet map (ESRI satellite, Zoom 17, centered on TCGC)
4. Drag marker + set radius (10–500m slider)
5. Select required students: All / 1st / 2nd / 3rd / 4th Year
6. Save → `POST /events/:id/qr-configurations`
7. Generate → `POST /events/:id/qr-configurations/:cid/generate`
8. QR SVG stored in `qr_data`, displayed on page
9. Download button → printable HTML page (letter size, title + date + QR)

### Status Transitions
```
draft → published (requires QR configured)
published → unpublished (back to draft)
published/ongoing → delete (soft delete)
ongoing → cancelled
completed — no further actions
```

### Action Logging
All state changes logged in `event_logs` table (user_id, action, details, timestamp).

## 7. Workspace System

### Backend (`WorkspaceService::getAvailableWorkspaces`)
- Always returns a Student workspace (`id: 'student'`, `role: 'student'`)
- Returns officer workspaces for each org where user has a staff role (ssc_officer, isc_officer, sro_officer)
- Each workspace has: `id`, `name`, `code`, `type`, `role`, `organization_id`

### PWA
- `WorkspaceSwitcher` — header button with swap icon, dropdown lists all workspaces
- Switching calls `authStore.switchWorkspace()` → `PUT /api/workspace/:orgId`
- Redirects to appropriate dashboard (student vs officer)
- Bottom tab bar changes based on `isOfficer` computed

## 8. Data Scoping

### Events per Organization
- Events list passes `organization_id` from `currentWorkspace.organization_id`
- Backend filters events by org — officers only see their org's events

### Student Search (Officer Assignment on Admin)
- SSC Head: all students
- ISC Adviser: `WHERE institute_id = X`
- SRO Adviser: `WHERE program_id = X`
- All: `WHERE is_enrolled = true` + excludes staff/adviser/head roles

## 9. Pages Summary

| Page | Layout | Key Features |
|---|---|---|
| `auth/Login` | AuthLayout | Student ID + password form, green accent |
| `auth/Onboarding` | AuthLayout | Institute → Program cascade select |
| `dashboard/Index` | AppLayout | Quick access grid, upcoming events (date badges), pending fees, location permission modal |
| `events/OrgIndex` | FullPageLayout | **NEW** "My Organizations" hub (SSC/ISC/SRO cards) |
| `events/OrgEvents` | FullPageLayout | **NEW** per-org event browser, list/calendar toggle, status filter, live clock |
| `events/StudentShow` | FullPageLayout | **NEW** student event detail + QR Attendance list (attended/not-attended badges) |
| `attendance/StudentIndex` | FullPageLayout | **NEW** per-org attendance stats + sync-all banner |
| `attendance/OrgDetail` | FullPageLayout | **NEW** paginated history, per-record/org offline sync |
| `announcements/Index` | FullPageLayout | **NEW** placeholder ("Coming Soon") |
| `fees/Index` | FullPageLayout | **NEW (Aug 8)** hero combined total, fees+penalties accordion, pending-verification badges + count, Pay → `payments-create` |
| `payments/Create` | FullPageLayout | **NEW (Aug 8, polished Aug 9)** cashless **payment submission** form: org picker, official payment account with **tappable QR → lightbox**, multi-select fees/penalties, reference #, **read-only channel auto-derived from account**, receipt photo upload → multipart `POST /payments/submissions`; blocked when org has no account |
| `payments/History` | FullPageLayout | **Full-screen (Aug 9)** ledger with **All/Paid/Pending status select** (Pending shows submissions) + **term filter** (distinct terms); receipts link |
| `payments/Submissions` | FullPageLayout | **NEW (Aug 8)** "Pending Verification" list grouped by `group_key` — status badges (Pending/Verified/Rejected), rejection reason + resubmit, uploaded-receipt link, Refresh |
| `receipts/Index` | FullPageLayout | **Full-screen (Aug 9)** receipts list (`GET /receipts`), amount/date per receipt |
| `receipts/Show` | FullPageLayout | **Full-screen (Aug 9)** receipt detail card (`GET /receipts/{id}`) — receipt number, amount, status, org, paid date, student |
| `officer/Dashboard` | AppLayout | 3 stat cards, quick access grid, upcoming events |
| `officer/events/Index` | FullPageLayout | Card list, status filter dropdown, delete/unpublish/cancel actions, confirm dialog |
| `officer/events/Create` | FullPageLayout | Draft form, saves + redirects to QR |
| `officer/events/Edit` | FullPageLayout | Pre-filled draft form, PUT update |
| `officer/events/Show` | FullPageLayout | Event detail, status actions, QR codes list |
| `officer/events/QrConfig` | FullPageLayout | Type select, time range, Leaflet map, radius slider, year checkboxes, generate/download QR |
| `profile/Index` | FullPageLayout | **Redesigned (Aug 9)** gradient hero card + Student Information grid (institute/program/year/email/phone/sex), push toggle, sign out; biometric/attendance/payment buttons removed |
| `notifications/Index` | FullPageLayout | List with **descriptive `body` text**, **first 10 + "Show more"**, read/unread state, mark-all-read |
| `security/SecurityGate` | FullPageLayout | **NEW (Aug 9)** face+device security center — explainer, links to the two setup steps |
| `security/FaceEnroll` | FullPageLayout | **NEW (Aug 9)** liveness camera (FaceCamera) → 128-float descriptor → `POST /face/enroll`, cached to IndexedDB |
| `security/BindDevice` | FullPageLayout | **NEW (Aug 9)** shows `GET /device/status`, `POST /devices/bind` via `X-Device-Fingerprint`; surfaces "bound elsewhere" 422 |

## 10. Dependencies
```json
{
  "dependencies": {
    "vue": "^3.5.39",
    "vue-router": "^4.6.4",
    "pinia": "^4.0.2",
    "axios": "^1.18.1",
    "leaflet": "^1.9.4",
    "@types/leaflet": "^1.9.22",
    "html5-qrcode": "^2.3.8",
    "idb": "^8.0.3",
    "@tailwindcss/forms": "^0.5.11",
    "@vladmandic/face-api": "^1.7.15"
  },
  "devDependencies": {
    "vite": "^8.1.1",
    "vite-plugin-pwa": "^1.3.0",
    "tailwindcss": "^3.4.19",
    "typescript": "~6.0.2",
    "vue-tsc": "^3.3.5"
  }
}
```

## 11. Dev Server
- Port: 9000 (host `0.0.0.0`, LAN-accessible)
- API proxy: `/api` → `http://127.0.0.1:8000`; **`/storage` → `http://127.0.0.1:8000`** (so payment-QR / receipt images load on LAN devices)
- Manifest: "SOMS Student", green theme `#20673A`, portrait-only
- `.env`: `VITE_QR_KEY` (64-hex, must match backend `QR_ENCRYPTION_KEY`); `VITE_VAPID_PUBLIC_KEY` (must match backend VAPID key); `VITE_API_URL` optional for deployed backend

## 12. Key UI Conventions
- All inputs: `rounded-xl border-gray-300 px-5 py-3 focus:ring-2 focus:ring-[#20673A]`
- All primary buttons: `rounded-xl bg-[#20673A] py-4 font-semibold text-white`
- Labels: `text-sm font-semibold text-gray-700`
- Cards: `bg-white rounded-3xl shadow-sm p-5`
- Date formatting: `new Date(d).toLocaleDateString('en', { year:'numeric', month:'long', day:'numeric' })`
- Status badges: draft=gray, published=blue, ongoing=green, completed=purple, cancelled=red
- Loading: CSS spinner `w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin`
- No CSS files beyond `style.css` — all Tailwind utility classes inline

## 13. Known Issues & Dead Code

**Known issues:**
- **Missing PWA icon**: `public/icons/` is empty but the manifest + Workbox `includeAssets` reference `icons/icon.png` → install icon / manifest icon is broken.
- **Stray log**: `AppLayout.vue` logs `roleLabel` on mount (`console.log`).
- **API 401 handling**: response interceptor clears token and logs out; the `isRefreshing`/`failedQueue` scaffolding has no actual refresh call.
- **Attendance model on MySQL**: backend's attendances unique constraint is `[qr_configuration_id, user_id]` (MySQL). The PWA sends `qr_configuration_id` everywhere — matches.
- **Push requires a secure context**: `PushManager` is unavailable over plain HTTP LAN IPs — use `localhost` or HTTPS (the profile toggle now shows a message in that case).

**Dead code (not imported anywhere):**
- `src/services/qr.ts` (Html5Qrcode wrapper — Scanner/QrScanner use the package directly)
- `src/stores/workspaceStore.ts`
- `src/components/WorkspaceSwitcher.vue` (AppLayout has an inline switcher)
- `src/components/NotificationBell.vue` (bottom tab bar has its own bell + badge)
- `src/components/SyncStatus.vue` (pending-sync UI is inline in attendance pages)
- `src/layouts/EmptyLayout.vue`
