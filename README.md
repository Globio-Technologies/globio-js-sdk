# @globio/sdk

The official JavaScript and TypeScript SDK for [Globio](https://globio.stanlink.online) — game backend infrastructure built on Cloudflare.

[![npm version](https://img.shields.io/npm/v/@globio/sdk)](https://npmjs.com/package/@globio/sdk)
[![JSR](https://jsr.io/badges/@globio/sdk)](https://jsr.io/@globio/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What is Globio?

Globio is a backend-as-a-service platform built specifically for game developers. Instead of stitching together Firebase, Supabase, PlayFab, and a handful of other services, you get everything in one SDK at one URL.

| Module | Service | What it does |
|---|---|---|
| `globio.id` | Globio ID | Authentication — email, Google, Apple, Discord, anonymous |
| `globio.doc` | GlobalDoc | Document database — NoSQL, JSON documents |
| `globio.vault` | GlobalVault | File storage — assets, avatars, replays, saves |
| `globio.pulse` | GlobalPulse | Live config and feature flags |
| `globio.sync` | GlobalSync | Real-time multiplayer rooms over WebSocket |
| `globio.signal` | GlobalSignal | Push notifications — iOS, Android, Web Push |
| `globio.mart` | GlobalMart | Virtual economy — currencies, items, IAP |
| `globio.brain` | GlobalBrain | AI inference and content moderation |
| `globio.code` | GlobalCode | Serverless functions |
| `globio.scope` | GlobalScope | Game analytics — events, funnels, retention |

---

## Installation

```bash
# npm
npm install @globio/sdk

# JSR (Deno / Bun)
deno add @globio/sdk
```

---

## Quick Start

```typescript
import { Globio } from '@globio/sdk';

const globio = new Globio({
  apiKey: 'glo_client_your_key_here',
});
```

Get your API key from the [Globio Console](https://console.globio.stanlink.online).

---

## Authentication — `globio.id`

```typescript
// Sign up
const result = await globio.id.signUp({
  email: 'player@example.com',
  password: 'securepassword',
  display_name: 'Player One',
});

// Sign in
const result = await globio.id.signIn({
  email: 'player@example.com',
  password: 'securepassword',
});

// Get current user
const user = await globio.id.getUser();

// Check if signed in
if (globio.id.isSignedIn()) {
  // player is authenticated
}

// Sign out
await globio.id.signOut();

// Update profile
await globio.id.updateProfile({
  display_name: 'New Name',
  avatar_url: 'https://...',
  metadata: { level: 5, clan: 'dragons' },
});
```

Sessions are stored automatically and tokens are refreshed transparently.
In browsers, sessions persist in `localStorage`. In Node.js/server environments,
sessions are stored in memory.

---

## Documents — `globio.doc`

```typescript
// Write a document
await globio.doc.set('scores', userId, {
  score: 1500,
  level: 12,
  updated_at: Date.now(),
});

// Read a document
const result = await globio.doc.get('scores', userId);
if (result.success) {
  console.log(result.data.score); // 1500
}

// Add a document (auto-generated ID)
const result = await globio.doc.add('game_sessions', {
  player_id: userId,
  duration_seconds: 300,
  map: 'desert_storm',
});

// Query documents
const result = await globio.doc.query('scores', {
  where: [{ field: 'level', op: '>=', value: 10 }],
  orderBy: { field: 'score', direction: 'desc' },
  limit: 10,
});

// Delete a document
await globio.doc.delete('scores', documentId);
```

---

## File Storage — `globio.vault`

```typescript
// Upload a file
const file = new File([buffer], 'avatar.png', { type: 'image/png' });
const result = await globio.vault.upload(file, `avatars/${userId}.png`);

// Download a file
const result = await globio.vault.download('avatars/player.png');

// List files in a path
const result = await globio.vault.list('avatars/');

// Delete a file
await globio.vault.delete('avatars/old-avatar.png');

// Get a public URL (if bucket is configured for public access)
const url = await globio.vault.getUrl('avatars/player.png');
```

---

## Live Config & Feature Flags — `globio.pulse`

```typescript
// Get all configs and flags at once (cached for 5 minutes)
const result = await globio.pulse.getAll('production');
const { configs, flags } = result.data;

// Get a specific config value (typed)
const maxPlayers = await globio.pulse.get<number>('max_players');

// Check a feature flag
const isNewMapEnabled = await globio.pulse.isEnabled('new_map_feature');

if (isNewMapEnabled) {
  loadNewMap();
}
```

Results are cached client-side for 5 minutes. Call `globio.pulse.clearCache()`
to force a fresh fetch.

---

## Analytics — `globio.scope`

```typescript
// Track an event (fire-and-forget, automatically batched)
globio.scope.track('level_completed', {
  level: 5,
  time_seconds: 120,
  deaths: 2,
});

globio.scope.track('item_purchased', {
  sku: 'sword_of_fire',
  currency: 'GEMS',
  amount: 50,
});

// Force-flush for critical events (e.g. purchases)
// Always flush immediately after economy events — don't let them sit in the buffer
await globio.scope.flush();
```

Events are batched automatically and sent every 2 seconds or when 20 events
accumulate. For critical events like purchases, always call `await globio.scope.flush()`
to ensure the event is not lost if the browser closes.

---

## Multiplayer — `globio.sync`

```typescript
// Create a room
const { data: room } = await globio.sync.createRoom({
  template_id: 'battle_room',
});

// Join a room
const connection = await globio.sync.joinRoom(room.id);

// Listen for events
connection.on('state_update', (event) => {
  updateGameState(event.payload);
});

connection.on('player_update', (event) => {
  updatePlayerList(event.payload);
});

// Listen to all events (useful for debugging)
connection.on('*', (event) => {
  console.log('room event:', event.type, event.payload);
});

// Send state to all players in the room
connection.send('state_update', {
  position: { x: 100, y: 200 },
  health: 85,
});

// Clean up when leaving
connection.disconnect();
```

---

## Push Notifications — `globio.signal`

```typescript
// Subscribe a player to a topic
await globio.signal.subscribe('game_events', devicePushToken, 'android');

// Unsubscribe
await globio.signal.unsubscribe('game_events', devicePushToken);

// Send a notification to a topic (server-side only — use server key)
await globio.signal.send('game_events', {
  title: 'Season 2 is live!',
  body: 'New maps, items, and ranked mode.',
  data: { screen: 'season2' },
});

// Send directly to a specific player (server-side only)
await globio.signal.sendToUser(userId, {
  title: 'Your friend joined!',
  body: 'PlayerOne is now online.',
});
```

---

## Virtual Economy — `globio.mart`

```typescript
// Get player wallet (all currency balances)
const { data: wallet } = await globio.mart.getWallet();
// → [{ currency_code: 'COINS', balance: 500 }, { currency_code: 'GEMS', balance: 12 }]

// Purchase an item
const result = await globio.mart.purchase('sword_of_fire', 'GEMS');
if (!result.success) {
  if (result.error.status === 402) {
    showInsufficientFundsDialog();
  }
}

// Get player inventory
const { data: inventory } = await globio.mart.getInventory();

// Validate a mobile store receipt (Apple/Google/Steam)
await globio.mart.validateReceipt({
  store: 'apple',
  receipt_data: appleReceiptString,
  product_id: 'com.mygame.gems_1000',
});
```

---

## AI & Moderation — `globio.brain`

```typescript
// Chat with an AI agent (persistent conversation history per player)
const result = await globio.brain.chat('blacksmith_npc', {
  message: 'Do you have any swords?',
  context_key: `player_${userId}`, // maintains memory per player
});
console.log(result.data.response);
// → "Aye, I've got a fine selection. What's yer budget, traveler?"

// Moderate player-generated content
const mod = await globio.brain.moderate({
  content_type: 'chat',
  content: userMessage,
});

if (mod.data.result === 'block') {
  showWarningToPlayer();
  return;
}

// Clear a conversation (start fresh)
await globio.brain.clearConversation(conversationId);
```

---

## Serverless Functions — `globio.code`

```typescript
// Invoke a deployed function by slug
const result = await globio.code.invoke('get-leaderboard', {
  game_mode: 'ranked',
  limit: 10,
});

if (result.success) {
  renderLeaderboard(result.data);
}
```

Functions are deployed via the Globio CLI (`globio deploy`) or the Globio Console.

---

## Error Handling

Every SDK method returns a typed result — it never throws unless the network
is completely unavailable:

```typescript
const result = await globio.id.signIn({ email, password });

if (!result.success) {
  console.log(result.error.code);    // e.g. 'INVALID_CREDENTIALS'
  console.log(result.error.message); // e.g. 'Email or password is incorrect'
  console.log(result.error.status);  // HTTP status — 401, 404, 429 etc.
  return;
}

// result.data is now typed and safe to use
console.log(result.data.user.display_name);
```

---

## TypeScript

The SDK is written in TypeScript and ships complete type definitions.
All methods are fully typed — arguments, return values, and error codes.

```typescript
import type { GlobioUser, GlobioSession, GlobioResult } from '@globio/sdk';
```

---

## Configuration

```typescript
const globio = new Globio({
  // Required
  apiKey: 'glo_client_...',

  // Optional — defaults to Globio's production API
  baseUrl: 'https://api.globio.stanlink.online',

  // Optional — 'localStorage' (browser default) or 'memory' (Node.js default)
  storage: 'localStorage',
});
```

---

## Runtime Compatibility

| Runtime | Supported |
|---|---|
| Browsers | ✅ |
| Node.js 18+ | ✅ |
| Deno | ✅ |
| Bun | ✅ |
| Cloudflare Workers | ✅ |

Zero dependencies. Uses only native `fetch`, `WebSocket`, and Web Crypto APIs.

---

## SDK Roadmap

| Version | Modules |
|---|---|
| `0.1.0` ✅ | GlobioId, GlobalDoc, GlobalVault |
| `0.2.0` | GlobioPulse, GlobioScope |
| `0.3.0` | GlobioSync |
| `0.4.0` | GlobioSignal, GlobioMart |
| `0.5.0` | GlobioBrain, GlobioCode |
| `1.0.0` | All 10 modules — stable release |

---

## License

MIT © [Globio Technologies](https://github.com/globio-technologies)
