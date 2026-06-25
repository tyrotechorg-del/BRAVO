# Bravo Music — Frontend (React rebuild, complete)

Zambia's Premier Music Streaming & Promotion Platform, fully rebuilt on a modern React stack. **All original pages, services, and components are ported.**

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 |
| Language | TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v3 (design tokens ported from the original CSS) |
| State | Zustand (auth, player, toast stores) |
| Real-time | Socket.io client (singleton service) |
| Routing | React Router v6 — BrowserRouter, clean `/paths` |

## Getting started

```bash
npm install
cp .env.example .env     # point VITE_API_URL / VITE_WS_URL at your backend
npm run dev              # http://localhost:3000
npm run build            # type-check + production build
```

> Ships without `node_modules`. Run `npm install` first — `tsc` only fully resolves React/Router/Zustand types after install.

## Layouts

Three shells select per route:

- **Layout** — full-width (auth pages, detail pages, 404).
- **AppLayout** — left **Sidebar** (Home/Browse/Trending/Search, library, account, artist hub, admin shortcuts) for the main listener experience.
- **AdminLayout** — left **AdminSidebar** for the admin area, guarded by `requiredRole="admin"`.

A global **AudioPlayer** bar (real `<audio>` element wired to the Zustand player store) is mounted in every layout: play/pause, prev/next, seek, repeat, volume, like.

## Pages (every original page ported — 100% coverage)

**Public / core:** Home, Browse, Trending, Search, Albums listing, Videos
**Auth:** Login, Register, Forgot Password, Reset Password, Verify Email
**Library:** Listener Dashboard, Liked Songs, Recently Played, Playlists, Downloads, Notifications, Settings
**Detail:** Song Detail, Artist Profile, Album View
**Account / finance:** Wallet (deposit + transactions), Subscription (plans), Payment History
**Artist:** Artist Dashboard, Upload (audio/video, drag-drop, progress), Earnings (withdrawals), My Albums, Upgrade-to-Artist
**Admin (all 12):** Dashboard, Users, Artists, All Songs, Pending Songs, Albums (+manage tracks), Videos, Withdrawals, Reports, Comments, Settings

## Services (one per file, mirroring the original `api/` + `services/` modules)

`apiClient` (token storage + single-flight 401→refresh→retry interceptor, `{success,data,error,status}` result shape), `authService`, `userService`, `songsService`, `artistsService`, `albumsService`, `playlistsService`, `searchService`, `notificationsService`, `walletService`, `paymentsService` (incl. status polling), `subscriptionsService`, `uploadService` (XHR upload with progress + cancel), `adminService`, `socketService`.

## State (Zustand)

- `authStore` — current user, login/register/logout, role helpers; connects the socket on login.
- `playerStore` — current song, queue, play/pause/next/prev, volume (persisted to localStorage).
- `toastStore` — toast queue + imperative `toast.show()` for non-component code.

## Utils

`lib/config.ts` (API URLs, GENRES, MOBILE_MONEY, image/number helpers), `lib/formatters.ts` (currency, duration, relative dates, file size), `lib/validators.ts` (email, username, password, Zambian phone), `lib/library.ts` (local play-history + liked-id tracking).

## Project structure

```
src/
├── components/
│   ├── admin/DataTable.tsx
│   ├── layout/   Navbar, Sidebar, AdminSidebar, AudioPlayer, Layout(+App/Admin), ProtectedRoute
│   └── ui/       Modal(+Confirm), Toast, SongCard, common(Spinner/EmptyState/Pagination/Avatar)
├── hooks/useConfirm.tsx
├── lib/          config, formatters, validators, library
├── pages/
│   ├── admin/    the 12 admin pages
│   ├── Home, Browse, Trending, Login, Register, Upload
│   ├── Library (listener/liked/recent), AuthFlow (forgot/reset/verify)
│   ├── Content (song/artist), Albums (album/list/videos)
│   ├── Discovery (search/playlists/downloads/notifications/upgrade/artist-albums)
│   ├── Finance (wallet/earnings/subscription/payment-history)
│   └── Misc (dashboards/settings/404)
├── services/     (listed above)
├── store/        authStore, playerStore, toastStore
├── types/index.ts
├── App.tsx       full route table (44 routes)
└── main.tsx
```

## Notes on fidelity

- Routing converts the original hash routes (`#admin/users`) to clean paths (`/admin/users`).
- The original imperative `Modal.show` / `Modal.confirm` / `Toast.show` patterns become declarative React (`<Modal>`, `useConfirm`, `<ToastContainer>` + `toast.show`).
- Upload uses a real `XMLHttpRequest` for progress + cancel, matching the original `upload.js`.
- `paymentsService.pollStatus` reproduces the original exponential-backoff payment confirmation poll.
