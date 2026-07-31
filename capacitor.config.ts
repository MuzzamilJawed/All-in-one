import type { CapacitorConfig } from '@capacitor/cli';

// The native Android/iOS shells load your DEPLOYED Next.js server (this app needs
// its API routes + MongoDB, so it can't be bundled fully offline). Set the URL:
//
//   • Production:  set CAP_SERVER_URL to your https domain, e.g.
//       CAP_SERVER_URL=https://solotrackr.example.com npx cap sync
//   • LAN dev:     point at your machine's IP while `npm run dev` is running, e.g.
//       CAP_SERVER_URL=http://192.168.1.20:3005 npx cap sync
//
// Change the fallback below to your own LAN IP so a bare `npx cap sync` works.
const SERVER_URL = process.env.CAP_SERVER_URL || 'http://192.168.100.10:3005';
const isHttps = SERVER_URL.startsWith('https://');

const config: CapacitorConfig = {
  appId: 'com.solotrackr.app',
  appName: 'SoloTrackr',
  // Fallback web assets shipped inside the app (used before the remote URL loads
  // and if the server is unreachable). `npm run mobile:web` populates it.
  webDir: 'mobile-shell',
  server: {
    url: SERVER_URL,
    // Allow plain-HTTP only for LAN development against http:// URLs.
    cleartext: !isHttps,
    androidScheme: 'https',
  },
  backgroundColor: '#050505',
  android: {
    backgroundColor: '#050505',
  },
  ios: {
    backgroundColor: '#050505',
    contentInset: 'always',
  },
  plugins: {
    // The app boots from a remote URL, so hiding at a fixed 800ms left a blank
    // WebView on screen. It now stays until the web splash mounts and calls
    // hide() — with launchShowDuration as a backstop if the server is unreachable.
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#050505',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // Initial value only — <SafeArea> re-applies the style at runtime to match
    // the active light/dark theme, otherwise the clock and signal icons end up
    // white-on-white in light mode. `backgroundColor` is a no-op under the
    // mandatory edge-to-edge of Android 15+; the app paints that strip itself.
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },
  },
};

export default config;
