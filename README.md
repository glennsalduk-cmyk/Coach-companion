# Coach Companion

Application mobile (iOS/Android, React Native via Expo) pour coachs sportifs indépendants et
petits collectifs de coachs — gestion des clients, programmes d'entraînement et séances loguées
par le coaché. Pensée pour le coach indépendant ou le petit collectif (2-8 coachs), pas pour un
gérant de salle de sport : pas de contrôle d'accès physique, pas de multi-site, pas de gros
inventaire de matériel.

## Stack

- **Expo** (React Native + TypeScript), routage par fichiers avec **Expo Router**.
- **Supabase** (Postgres + Auth + Storage) comme backend, avec RLS sur toutes les tables.
- Cible principale : iOS/Android natif. Le target web (`expo start --web`, mode SPA) sert de
  surface de vérification rapide en développement — ce n'est pas un mode de distribution prévu.

## Prérequis

- Node.js 18+ et npm.
- Un compte [Supabase](https://supabase.com) (le plan gratuit suffit pour développer).
- Pour tester sur un vrai device/simulateur : Xcode (iOS) et/ou Android Studio (Android). Sans
  Xcode, seul le target web reste disponible en local.

## Mise en route

### 1. Créer le projet Supabase et appliquer le schéma

1. Crée un nouveau projet sur [supabase.com](https://supabase.com/dashboard).
2. Dans l'éditeur SQL du dashboard, exécute le contenu de
   [`supabase/migrations/0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql)
   (ou via la CLI Supabase : `supabase link` puis `supabase db push`).
3. Dans **Project Settings → API**, récupère l'URL du projet et la clé `anon public`.

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Renseigne `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` dans `.env` avec les
valeurs récupérées à l'étape précédente. `.env` n'est jamais commité (voir `.gitignore`).

### 3. Installer les dépendances

```bash
npm install
```

### 4. Lancer l'application

```bash
npm start
```

Puis choisis une cible : `i` pour le simulateur iOS, `a` pour un émulateur/device Android, ou
`w` pour le web (`npm run web` lance directement le target web).

### 5. Appels vidéo (visio) — LiveKit

Les appels vidéo (caméra/micro réels, coach ↔ coaché) reposent sur
[LiveKit](https://livekit.io) : notre backend ne gère que l'autorisation (qui a le droit de
rejoindre quelle salle), LiveKit gère tout le WebRTC (signalisation, SFU, TURN).

1. Crée un projet sur [LiveKit Cloud](https://cloud.livekit.io) (gratuit pour démarrer).
2. Récupère l'URL WebSocket du projet (`wss://...livekit.cloud`), la clé API et le secret API
   (onglet **Settings → Keys**).
3. Renseigne `EXPO_PUBLIC_LIVEKIT_URL` dans `.env` avec l'URL WebSocket — c'est la seule valeur
   LiveKit qui va côté client, elle est publique par design.
4. La clé et le secret API ne vont **jamais** dans `.env` ni dans l'app : ils sont définis comme
   secrets du projet Supabase, lus uniquement par la fonction Edge qui signe les tokens d'appel :
   ```bash
   supabase secrets set LIVEKIT_API_KEY=xxxx LIVEKIT_API_SECRET=xxxx
   supabase functions deploy mint-livekit-token
   ```
5. Applique aussi [`supabase/migrations/0002_video_calls.sql`](supabase/migrations/0002_video_calls.sql)
   (même méthode que le schéma initial).

**Important** : `@livekit/react-native` embarque des modules natifs (caméra/micro) sans
équivalent sur le target web — voir [`lib/livekit-native-setup.native.ts`](lib/livekit-native-setup.native.ts)
et [`app/(app)/calls/[id].web.tsx`](<app/(app)/calls/[id].web.tsx>). La visio ne peut donc être
testée que sur un simulateur/appareil réel via un **Expo Dev Client** (`eas build --profile
development`) — le target web affiche un écran de repli explicite. Sans Xcode/Android Studio en
local, EAS Build (cloud) est le seul moyen de générer ce dev client.

## Vérification

```bash
npm run typecheck
```

## Structure

- `app/` — écrans et routage (Expo Router). `(auth)/` = connexion/inscription/choix de rôle,
  `(app)/` = zone connectée (accueil, programmes, clients, profil, appels), gardées par la
  logique de redirection dans [`app/_layout.tsx`](app/_layout.tsx).
- `lib/` — client Supabase ([`supabase.ts`](lib/supabase.ts)), contexte d'auth
  ([`auth-context.tsx`](lib/auth-context.tsx)), client LiveKit ([`livekit.ts`](lib/livekit.ts)),
  thème, types de la base.
- `components/` — composants UI partagés.
- `supabase/migrations/` — schéma SQL versionné (source de vérité de la base).
- `supabase/functions/` — fonctions Edge (Deno) ; `mint-livekit-token` signe les tokens d'appel
  vidéo côté serveur.

## Roadmap (MVP en 3 phases)

1. **Phase 1 (en cours)** — Auth, profils, programmes d'entraînement, séances loguées.
2. **Phase 2** — Nutrition, messagerie, CRM (fiche client, activité, pipeline prospects).
3. **Phase 3** — Facturation, calendrier, marketing.
