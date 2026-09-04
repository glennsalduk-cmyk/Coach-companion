// Doit être appelé une fois avant toute utilisation de LiveKit (enregistre les
// globals WebRTC nécessaires). Fichier `.native.ts` : Metro ne le résout que
// pour iOS/Android, jamais pour le bundle web — @livekit/react-native-webrtc
// est un module natif sans équivalent web, l'importer depuis le bundle web
// casserait la génération de toute l'app, pas seulement l'écran d'appel.
import { registerGlobals } from '@livekit/react-native';

registerGlobals();
