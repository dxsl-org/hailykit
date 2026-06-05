# Flutter Standards

## Project Setup

- Dart 3.x with sound null safety (default in recent versions)
- `pubspec.yaml` pins SDK constraints: `sdk: '>=3.0.0 <4.0.0'`
- Use `flutter_lints` package + analyzer options for consistent style
- Folder structure: `lib/features/{feature}/` with `data`, `domain`, `presentation` subfolders for medium-to-large apps

## State Management

- **Riverpod 3** is the modern default — type-safe, compile-time DI, no `BuildContext` coupling
- **Bloc** for teams that prefer explicit event-driven state
- **Provider** for very small apps (Riverpod's older sibling, simpler API)
- Avoid `setState` outside of leaf widgets — leads to whole-tree rebuilds

```dart
// Riverpod
final userProvider = FutureProvider<User>((ref) async {
  return ref.watch(apiProvider).fetchUser();
});

// Widget
final userAsync = ref.watch(userProvider);
return userAsync.when(
  data: (user) => Text(user.name),
  loading: () => const CircularProgressIndicator(),
  error: (e, _) => Text('Error: $e'),
);
```

## Widget Patterns

- `const` everywhere possible — `const Text('hello')` skips rebuild
- Split large widgets into smaller `const` widgets, not helper methods returning `Widget`
- `StatelessWidget` by default; reach for `StatefulWidget` only when local state is unavoidable
- Use `Builder` to scope `BuildContext` access deeper in the tree

## Performance

- `const` constructors prevent unnecessary rebuilds
- `ListView.builder` / `GridView.builder` for any list — never `ListView(children: [...])` for large lists
- `RepaintBoundary` around animated widgets that don't affect siblings
- `cached_network_image` for remote images — disk cache + memory cache + placeholder
- Profile with DevTools timeline view — look for jank (frames >16ms)

## Async + Streams

- `Future` for one-shot async work
- `Stream` for reactive sequences (form fields, WebSocket events)
- `StreamBuilder` + `FutureBuilder` for in-widget reactivity
- Always handle `.connectionState` — `waiting`, `active`, `done`

## Navigation

- **go_router** is the official recommendation — declarative routes, deep links, type safety
- Avoid raw `Navigator.push` for app-wide navigation — use named routes via go_router
- Deep linking: configure `androidManifest.xml` + `Info.plist` with go_router's URL strategy

## Offline & Storage

- **Drift** (formerly Moor) — type-safe SQLite, generates code from SQL or Dart DSL
- **Isar** — fast NoSQL with reactive queries, good for offline-first
- **shared_preferences** for tiny key-value (theme mode, last viewed item)
- **flutter_secure_storage** for tokens — uses Keychain (iOS) / Keystore (Android)

## Networking

- **dio** is the standard HTTP client — interceptors, retries, multipart, cancellation
- **Retrofit** (`retrofit_generator`) — typed API clients via annotations
- Use `freezed` for immutable response models + `json_serializable` for codegen

## Testing

- **flutter_test** for widgets — `testWidgets` + `WidgetTester.pumpWidget`
- **mocktail** over `mockito` — null-safe, no codegen
- **integration_test** package for E2E on real devices/emulators
- Golden tests (`matchesGoldenFile`) for visual regression on critical screens

## Platform-Specific

- iOS: respect safe area (`SafeArea` widget), use `CupertinoApp` widgets for iOS-feel apps
- Android: Material 3 (`useMaterial3: true` in `ThemeData`), respect back button
- Platform channels for native APIs not covered by packages: `MethodChannel`, `EventChannel`

## Deployment

- **flutter build apk --release** / **flutter build ipa --release** for stores
- **Fastlane** for automation (works for Flutter too)
- **Codemagic** or **Bitrise** for cloud CI/CD
- App size: enable R8 (Android) + bitcode strip (iOS) — auto in release builds

## Common Pitfalls

- Calling `setState` after `dispose()` — guard with `if (mounted)`
- Building large widgets inline in `build()` — extract to const widgets
- Forgetting `await` on async calls in tests — flakes intermittently
- Using `print()` in production — use `debugPrint()` or a logger package
- Putting business logic in widget classes — keep widgets dumb, logic in providers/blocs

## Performance Budgets

- App launch: <2s cold start
- Frame budget: 16ms (60fps) — 8ms (120fps) on ProMotion / high-refresh Android
- APK size: <20MB initial, <50MB total with assets
- Memory: <100MB typical, <200MB peak

## Resources

- Flutter docs: https://docs.flutter.dev
- Dart docs: https://dart.dev
- Pub: https://pub.dev
- Riverpod: https://riverpod.dev
