# SwiftUI Standards

Detected via `SwiftUI` references in `Package.swift` or `.xcodeproj`. Apple's declarative UI framework — iOS 13+, macOS 10.15+, watchOS, tvOS, visionOS.

## Core Concepts

SwiftUI is **declarative + reactive**: describe what the UI should look like for any given state; the framework figures out what to draw.

```swift
import SwiftUI

struct ContentView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
                .font(.largeTitle)
            Button("Increment") { count += 1 }
        }
        .padding()
    }
}
```

## Property Wrappers (Critical to Understand)

| Wrapper | Use |
|---|---|
| `@State` | Local view state, value type, view-owned |
| `@Binding` | Two-way ref to parent's `@State` |
| `@StateObject` | Reference type, view owns the lifecycle |
| `@ObservedObject` | Reference type, parent owns lifecycle |
| `@EnvironmentObject` | Inject reference type from environment |
| `@Environment(\.x)` | Read environment values (color scheme, locale, etc.) |
| `@FocusState` | Track focus state (TextField, etc.) |
| `@AppStorage("key")` | UserDefaults-backed |
| `@SceneStorage("key")` | Per-scene state restoration |

**Modern (iOS 17+): `@Observable` macro** replaces `ObservableObject` + `@Published`:
```swift
@Observable
class UserStore {
    var user: User?
    var isLoading = false
}

// In view
@State private var store = UserStore()       // owned
@Bindable var store: UserStore                 // bind to passed-in
```

## Composition

Build complex UIs by composing small `View`s:

```swift
struct PostListView: View {
    let posts: [Post]
    var body: some View {
        List(posts) { post in
            PostRow(post: post)
        }
    }
}

struct PostRow: View {
    let post: Post
    var body: some View {
        VStack(alignment: .leading) {
            Text(post.title).font(.headline)
            Text(post.body).font(.caption).foregroundStyle(.secondary)
        }
    }
}
```

Views are cheap to create — re-create them often, don't try to "preserve" them.

## Navigation (iOS 16+ NavigationStack)

```swift
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    List(posts) { post in
        NavigationLink(post.title, value: post)
    }
    .navigationDestination(for: Post.self) { post in
        PostDetailView(post: post)
    }
    .navigationDestination(for: User.self) { user in
        UserProfileView(user: user)
    }
}
```

Type-driven destinations. Programmatic nav via `path.append(post)`.

For older iOS (13-15): use `NavigationView` (deprecated in iOS 16+).

## Layout Containers

```swift
VStack { /* vertical stack */ }
HStack { /* horizontal stack */ }
ZStack { /* layered */ }
LazyVStack { /* lazy-loaded vertical */ }
Grid { /* grid layout (iOS 16+) */ }
LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))]) { /* ... */ }
```

`Lazy*` only render on-screen items — use for long scrollable lists.

## State Management Patterns

For small apps: `@State` + `@Observable`.

For larger apps: **MV pattern** (Model-View, no separate ViewModel layer needed for SwiftUI):

```swift
@Observable
class FeedStore {
    var posts: [Post] = []
    var isLoading = false
    var error: Error?

    private let api: APIClient

    init(api: APIClient) { self.api = api }

    func loadPosts() async {
        isLoading = true
        defer { isLoading = false }
        do { posts = try await api.fetchPosts() }
        catch { self.error = error }
    }
}

struct FeedView: View {
    @State private var store: FeedStore

    init(api: APIClient) {
        _store = State(initialValue: FeedStore(api: api))
    }

    var body: some View {
        List(store.posts) { post in PostRow(post: post) }
            .task { await store.loadPosts() }
    }
}
```

`.task { }` runs async work tied to view lifecycle — cancelled on view disappearance.

## Async / Await

SwiftUI is fully async-aware:

```swift
.task { await viewModel.load() }
.refreshable { await viewModel.refresh() }
.task(id: postId) { await viewModel.loadPost(postId) }   // re-run on id change
```

For old-style callbacks: wrap in `withCheckedContinuation`.

## Forms + TextField

```swift
@State private var email = ""
@State private var password = ""
@State private var submitting = false

Form {
    TextField("Email", text: $email)
        .keyboardType(.emailAddress)
        .textContentType(.emailAddress)
        .textInputAutocapitalization(.never)

    SecureField("Password", text: $password)
        .textContentType(.password)

    Button("Sign In") {
        Task { await signIn() }
    }
    .disabled(submitting || email.isEmpty)
}
```

`$email` = binding. Without `$`, you'd pass the value not the writable reference.

## Modifiers (Chained)

```swift
Text("Hello")
    .font(.largeTitle)
    .foregroundStyle(.blue)
    .padding()
    .background(Color.yellow.cornerRadius(8))
    .shadow(radius: 4)
```

Each modifier returns a new view. Order matters: `.padding().background()` ≠ `.background().padding()`.

## Animation

```swift
@State private var isExpanded = false

VStack {
    if isExpanded {
        Text("Details").transition(.slide)
    }
    Button("Toggle") {
        withAnimation(.spring(duration: 0.3)) { isExpanded.toggle() }
    }
}
```

Implicit + explicit animations both work. `withAnimation { }` for explicit; `.animation(...)` modifier for implicit.

## Previews

```swift
#Preview {
    PostListView(posts: Post.previewData)
}

#Preview("Dark Mode") {
    PostListView(posts: Post.previewData)
        .preferredColorScheme(.dark)
}
```

Xcode 15+ syntax. Old: `struct PostListView_Previews: PreviewProvider { ... }`.

**Use previews extensively** — they're SwiftUI's killer DX feature. Set up `previewData` static stub for every model.

## Accessibility

```swift
Image("logo")
    .accessibilityLabel("Company logo")
    .accessibilityHidden(false)

Button("Save") { /* ... */ }
    .accessibilityHint("Saves the form")
```

VoiceOver works out of the box for most views — refine with labels/hints/traits.

## Best Practices

- **Small composable views** — < 30 lines each
- `@Observable` + MV pattern over MVVM ceremony in SwiftUI
- `.task` over `onAppear { Task { ... } }` — cancellation built in
- Always test in dark mode + dynamic type (Larger Accessibility Sizes)
- Use **Previews** liberally — they catch UI bugs faster than running the app
- `LazyVStack` / `LazyHStack` / `LazyVGrid` for long lists
- Move expensive computations out of `body` — `body` runs often, on every state change

## Common Pitfalls

- Heavy logic in `body` — re-runs on every state change
- Forgetting `@State` for view-local mutable values — won't trigger re-render
- Using `@StateObject` in parent + `@ObservedObject` in child = correct; reversed = bugs
- Modifier order changing semantics (`.frame().background()` vs `.background().frame()`)
- Massive view files (1000+ lines) — split into smaller views
- Force-unwrapping bindings (`$obj.value!`) → crash; use `Binding` initializers properly
- iOS-only modifiers used on macOS/tvOS — guard with `#if os(iOS)`

## Resources

- Apple Tutorials: https://developer.apple.com/tutorials/swiftui
- Swift by Sundell: https://www.swiftbysundell.com
- HackingWithSwift SwiftUI: https://www.hackingwithswift.com/quick-start/swiftui
- Sample apps: https://github.com/apple/sample-apps
