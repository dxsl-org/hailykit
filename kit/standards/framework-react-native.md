# React Native Standards

## Project Setup

- **Expo** for most apps — managed workflow, easier OTA updates, EAS Build
- **Bare RN** when native modules are required outside Expo's prebuild set
- TypeScript by default — `tsx`/`tsconfig.json` with `strict: true`
- Pin React Native version exactly; do not use `^` for `react-native` in package.json

## Architecture

- MVVM or feature-folder layout — keep screens, navigation, state, and API in separate folders
- State: **Zustand** for global, **TanStack Query** for server state, Context only for theme/auth
- Navigation: **React Navigation v7+** with typed routes via `RootStackParamList`
- Avoid Redux unless team is already deep in it — Zustand is enough for 95% of apps

## Performance

- **FlatList** / **FlashList** (Shopify) for any list — never `.map()` over arrays of items
- `getItemLayout` when item heights are known — disables runtime measurement
- `removeClippedSubviews={true}` for long lists on Android
- `InteractionManager.runAfterInteractions` for work that can wait until animation finishes
- Hermes engine is default — keep it on; profile with Flipper or React DevTools Profiler

## Images

- `expo-image` over `react-native fast-image` — better caching, AVIF/WebP support
- Always specify `width`/`height` to prevent layout shift
- Use `prefetch` for above-the-fold images on next screen
- Compress assets before bundling — don't ship 4K source images

## Offline-First

- **MMKV** (`react-native-mmkv`) for sync key-value storage — 30x faster than AsyncStorage
- **WatermelonDB** or **Realm** for relational offline data
- Queue mutations when offline, replay on reconnect (TanStack Query persistence helps)
- Detect connectivity: `@react-native-community/netinfo`

## Security

- **Keychain** (iOS) / **Keystore** (Android) for tokens — `react-native-keychain`
- Never hardcode API keys — use `react-native-config` or Expo's `extra` field
- Certificate pinning via `react-native-ssl-pinning` for high-security apps
- OAuth via `expo-auth-session` (PKCE built-in) or `react-native-app-auth`
- Biometric: `expo-local-authentication` or `react-native-biometrics`

## Animations

- **Reanimated 3** for all custom animations — runs on UI thread, 60fps guaranteed
- **Gesture Handler v2** for any touch interaction beyond `TouchableOpacity`
- Avoid `LayoutAnimation` — limited control, no shared values
- `useAnimatedStyle` + `useSharedValue` is the standard idiom

## Platform Conventions

- iOS: tab bar at bottom, navigation bar with back button, swipe-back gesture
- Android: top app bar, hardware back button (`useBackHandler`), bottom nav OR drawer
- Use `Platform.OS` sparingly — prefer platform-specific files: `Component.ios.tsx` / `Component.android.tsx`

## Testing

- **Jest** + **React Native Testing Library** for unit/component tests
- **Detox** for E2E — runs on real iOS simulator + Android emulator
- Mock native modules in `jest.setup.js`, not inline per-test
- Real-device smoke testing mandatory before any store submission

## Deployment

- **EAS Build** (Expo) — cloud builds for iOS + Android without local Xcode/Android Studio
- **EAS Update** for JS-only OTA fixes — no store review needed
- **Fastlane** for bare RN — automates code signing, screenshots, store submission
- Staged rollout: TestFlight (iOS) / Internal track (Android) → 10% → 50% → 100%

## Common Pitfalls

- Forgetting `key` props on list items → re-render entire list on update
- Inline arrow functions in `renderItem` → new function each render → kills memoization
- Reading state inside long animation callbacks → use refs or shared values
- Using `console.log` in production builds → memory leak; strip via babel-plugin

## Performance Budgets

- Launch time: <2s cold start, <1s warm
- JS thread: 60 FPS (16.67ms/frame) — anything that blocks the JS thread above this drops frames
- Memory: <150MB typical screen, <250MB peak
- Bundle: <30MB initial JS bundle (smaller = faster startup)
