# Bravo Music API Documentation

## Base URL

Production: https://api.bravomusic.com/api
Development: http://localhost:5000/api

text

## Authentication

Most endpoints require a JWT token. Include it in the Authorization header:
Authorization: Bearer <your_jwt_token>

text




## Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh-token` | Refresh JWT token | No |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password/:token` | Reset password | No |
| GET | `/auth/verify-email/:token` | Verify email | No |
| POST | `/auth/logout` | Logout user | Yes |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users/profile` | Get user profile | Yes |
| PUT | `/users/profile` | Update profile | Yes |
| GET | `/users/followers` | Get user followers | Yes |
| GET | `/users/following` | Get users followed | Yes |
| POST | `/users/follow/:userId` | Follow user | Yes |
| DELETE | `/users/unfollow/:userId` | Unfollow user | Yes |
| GET | `/users/history` | Get listening history | Yes |
| GET | `/users/playlists` | Get user playlists | Yes |
| PUT | `/users/settings` | Update settings | Yes |
| DELETE | `/users/account` | Delete account | Yes |

### Songs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/songs` | Get all songs | No |
| GET | `/songs/:id` | Get song details | No |
| POST | `/songs/upload` | Upload song | Artist |
| GET | `/songs/:id/stream` | Stream song | Yes |
| POST | `/songs/:id/like` | Like song | Yes |
| DELETE | `/songs/:id/like` | Unlike song | Yes |
| GET | `/songs/trending` | Get trending songs | No |
| GET | `/songs/featured` | Get featured songs | No |
| GET | `/songs/artist/:artistId` | Get artist songs | No |
| GET | `/songs/genre/:genre` | Get songs by genre | No |

### Albums

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/albums` | Get all albums | No |
| GET | `/albums/:id` | Get album details | No |
| POST | `/albums/create` | Create album | Artist |
| PUT | `/albums/:id` | Update album | Artist |
| DELETE | `/albums/:id` | Delete album | Artist |
| POST | `/albums/:id/add-song` | Add song to album | Artist |
| POST | `/albums/:id/purchase` | Purchase album | Yes |

### Artists

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/artists/dashboard` | Get dashboard | Artist |
| GET | `/artists/analytics` | Get analytics | Artist |
| GET | `/artists/earnings` | Get earnings | Artist |
| PUT | `/artists/profile` | Update profile | Artist |
| GET | `/artists/songs` | Get artist songs | Artist |
| POST | `/artists/withdraw` | Request withdrawal | Artist |
| GET | `/artists/withdrawals` | Get withdrawal history | Artist |
| POST | `/artists/purchase-credits` | Buy upload credits | Artist |

### Subscriptions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/subscriptions/plans` | Get plans | No |
| POST | `/subscriptions/subscribe` | Subscribe | Yes |
| GET | `/subscriptions/my-subscription` | Get subscription | Yes |
| POST | `/subscriptions/cancel` | Cancel subscription | Yes |
| POST | `/subscriptions/renew` | Renew subscription | Yes |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments/initiate` | Initiate payment | Yes |
| POST | `/payments/callback/:provider` | Payment webhook | No |
| GET | `/payments/status/:reference` | Check status | Yes |
| GET | `/payments/history` | Get history | Yes |
| POST | `/payments/refund/:paymentId` | Refund payment | Admin |

### Wallet

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/wallet/balance` | Get balance | Yes |
| GET | `/wallet/transactions` | Get transactions | Yes |
| POST | `/wallet/deposit` | Deposit funds | Yes |
| POST | `/wallet/withdraw` | Withdraw funds | Artist |
| GET | `/wallet/earnings` | Get earnings | Artist |

### Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | Get all users | Admin |
| PUT | `/admin/users/:userId/status` | Update user status | Admin |
| GET | `/admin/songs/pending` | Get pending songs | Admin |
| POST | `/admin/songs/:songId/approve` | Approve song | Admin |
| POST | `/admin/songs/:songId/reject` | Reject song | Admin |
| GET | `/admin/analytics` | Get analytics | Admin |
| POST | `/admin/backup` | Trigger backup | Admin |
| GET | `/admin/withdrawals` | Get withdrawals | Admin |
| POST | `/admin/withdrawals/:withdrawalId/process` | Process withdrawal | Admin |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/search/all` | Search everything | No |
| GET | `/search/songs` | Search songs | No |
| GET | `/search/artists` | Search artists | No |
| GET | `/search/albums` | Search albums | No |
| GET | `/search/playlists` | Search playlists | No |
| GET | `/search/suggestions` | Get search suggestions | No |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | Get notifications | Yes |
| GET | `/notifications/unread-count` | Get unread count | Yes |
| POST | `/notifications/:id/read` | Mark as read | Yes |
| POST | `/notifications/read-all` | Mark all as read | Yes |
| DELETE | `/notifications/:id` | Delete notification | Yes |
| PUT | `/notifications/settings` | Update settings | Yes |

## Response Format

### Success Response
```json
{
    "success": true,
    "message": "Operation successful",
    "data": { ... },
    "timestamp": "2024-01-15T10:30:00Z"
}