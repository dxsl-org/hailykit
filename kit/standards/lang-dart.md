# Dart Standards

## Comments

### DartDoc (public symbols)
```dart
/// Why this function exists + non-obvious contract.
///
/// Throws [NotFoundException] when [userId] doesn't exist.
/// Returns `null` when user is soft-deleted.
Future<User?> getUser(String userId) async {
```

- `///` for all public API; `//` for inline notes
- Document `throws` behavior — Dart has unchecked exceptions
- `@deprecated('Use getUser instead')` for migration guidance

## Key Idioms

### Null Safety (Sound Null Safety)
```dart
// Non-nullable by default — explicit ? for nullable
String name = 'required';
String? maybeName = null;

// Null-aware operators
final city = user?.address?.city;          // safe chain
final display = user?.name ?? 'Unknown';   // null-coalescing
user?.sendEmail();                         // null-conditional call

// Late — for guaranteed-but-deferred initialization
late final UserRepository _repo;  // initialized in setUp, not constructor

// SAFETY: late assert — only when invariant is provable
```

### Async/Await
```dart
// Future for one-shot async, Stream for multiple values
Future<User> fetchUser(String id) async {
  final response = await http.get(Uri.parse('/users/$id'));
  if (response.statusCode != 200) throw NotFoundException(id);
  return User.fromJson(jsonDecode(response.body));
}

// Parallel execution
final results = await Future.wait([
  fetchUser(id1),
  fetchUser(id2),
]);

// Stream for reactive data
Stream<User> watchUser(String id) async* {
  while (true) {
    yield await fetchUser(id);
    await Future.delayed(const Duration(seconds: 5));
  }
}
```

### Error Handling
```dart
// Typed exceptions
class NotFoundException implements Exception {
  const NotFoundException(this.id);
  final String id;
  @override String toString() => 'Not found: $id';
}

// try/catch with specific types
try {
  final user = await fetchUser(id);
} on NotFoundException catch (e) {
  log.warning(e);
} catch (e, stack) {
  log.error('Unexpected', e, stack);
}
```

### Collections and Patterns
```dart
// Collection if/for (Flutter-idiomatic)
final items = [
  if (isAdmin) const AdminPanel(),
  ...userWidgets,
  for (final tag in tags) TagChip(tag),
];

// Destructuring (Dart 3+)
final (name, age) = ('Alice', 30);
final {'name': String n, 'age': int a} = map;

// Switch expressions (Dart 3+)
final label = switch (role) {
  Role.admin => 'Admin',
  Role.user  => 'User',
  _          => 'Guest',
};
```

## Naming
- Classes/Enums/Mixins: `PascalCase`
- Functions/variables/parameters: `camelCase`
- Constants: `camelCase` (Dart has no ALL_CAPS convention)
- Private: prefix with `_` (`_privateField`, `_privateMethod`)
- Libraries: `lowercase_with_underscores` (file names)
