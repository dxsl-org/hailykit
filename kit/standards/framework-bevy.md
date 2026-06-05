# Bevy Standards

Detected via `bevy` in `Cargo.toml` `[dependencies]`.

## What Bevy Is

Bevy is a data-driven game engine in Rust — modern ECS (Entity-Component-System), parallel by default, plugin-based, free and open source (MIT/Apache-2). Used for games, simulations, visualizations, custom editors.

## Setup

```toml
[dependencies]
bevy = "0.15"   # check latest; Bevy has frequent breaking changes

# Optional perf: dynamic linking in dev for faster compile
[features]
default = []
dev = ["bevy/dynamic_linking"]
```

Add to `[profile.dev]` for faster compile + reasonable runtime:
```toml
[profile.dev.package."*"]
opt-level = 3
```

## Hello World

```rust
use bevy::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_systems(Startup, setup)
        .add_systems(Update, (move_player, rotate_camera))
        .run();
}

fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    commands.spawn(Camera3dBundle::default());
    commands.spawn(PbrBundle {
        mesh: asset_server.load("models/player.glb#Mesh0/Primitive0"),
        ..default()
    });
}
```

## ECS Mental Model

- **Entity** = a unique ID (no data)
- **Component** = data attached to an entity (`struct Position { ... }`)
- **System** = a function that queries entities + their components, mutates them
- **Resource** = global singleton data (`struct GameState { ... }`)

Systems are scheduled — Bevy figures out which can run in parallel based on what they access (read vs write).

## Components

```rust
use bevy::prelude::*;

#[derive(Component)]
struct Player;     // Marker component (no fields)

#[derive(Component)]
struct Health(f32);

#[derive(Component, Default)]
struct Velocity(Vec3);

#[derive(Component)]
struct Enemy { aggression: f32 }
```

Attach via `commands.spawn((Player, Health(100.0), Velocity::default()))`.

## Systems

```rust
fn move_entities(time: Res<Time>, mut query: Query<(&mut Transform, &Velocity)>) {
    for (mut transform, velocity) in &mut query {
        transform.translation += velocity.0 * time.delta_seconds();
    }
}

fn damage_player(
    mut player_query: Query<&mut Health, With<Player>>,
    enemy_query: Query<&Transform, With<Enemy>>,
    player_transform_query: Query<&Transform, With<Player>>,
) {
    let Ok(player_pos) = player_transform_query.get_single() else { return };
    for enemy_pos in &enemy_query {
        if player_pos.translation.distance(enemy_pos.translation) < 1.0 {
            if let Ok(mut health) = player_query.get_single_mut() {
                health.0 -= 10.0;
            }
        }
    }
}
```

`Query<...>` declares what data the system reads/writes. Bevy parallelizes non-conflicting systems automatically.

## Resources (Singletons)

```rust
#[derive(Resource)]
struct Score(u32);

fn setup(mut commands: Commands) {
    commands.insert_resource(Score(0));
}

fn increment_score(mut score: ResMut<Score>) {
    score.0 += 1;
}
```

`Res<T>` for read, `ResMut<T>` for write.

## Events

```rust
#[derive(Event)]
struct PlayerDied { final_score: u32 }

fn detect_death(
    query: Query<&Health, With<Player>>,
    mut events: EventWriter<PlayerDied>,
    score: Res<Score>,
) {
    if let Ok(health) = query.get_single() {
        if health.0 <= 0.0 {
            events.send(PlayerDied { final_score: score.0 });
        }
    }
}

fn on_player_death(mut events: EventReader<PlayerDied>) {
    for event in events.read() {
        println!("Player died with score: {}", event.final_score);
    }
}

// Register in main:
.add_event::<PlayerDied>()
```

Events are the canonical way for systems to communicate without direct coupling.

## States (Game Phases)

```rust
#[derive(States, Default, Debug, Clone, Eq, PartialEq, Hash)]
enum AppState {
    #[default]
    Menu,
    InGame,
    GameOver,
}

App::new()
    .add_plugins(DefaultPlugins)
    .init_state::<AppState>()
    .add_systems(OnEnter(AppState::InGame), setup_game)
    .add_systems(Update, gameplay_systems.run_if(in_state(AppState::InGame)))
    .add_systems(OnExit(AppState::InGame), cleanup_game)
    .run();
```

`OnEnter` / `OnExit` for setup/teardown; `run_if(in_state(...))` to gate systems by state.

## Plugins

```rust
struct CombatPlugin;

impl Plugin for CombatPlugin {
    fn build(&self, app: &mut App) {
        app
            .add_event::<DamageEvent>()
            .add_systems(Update, (apply_damage, check_deaths).chain());
    }
}

App::new()
    .add_plugins((DefaultPlugins, CombatPlugin))
```

Organize game features into plugins — each is self-contained.

## Assets

```rust
fn setup(mut commands: Commands, asset_server: Res<AssetServer>) {
    let texture: Handle<Image> = asset_server.load("textures/player.png");
    let mesh: Handle<Mesh> = asset_server.load("models/player.glb#Mesh0/Primitive0");
    let sound: Handle<AudioSource> = asset_server.load("audio/jump.ogg");
}
```

`Handle<T>` is a cheap clone reference — store it in components. Assets are loaded async; check `AssetEvent` to react.

## UI (bevy_ui)

```rust
fn setup_ui(mut commands: Commands) {
    commands.spawn(NodeBundle {
        style: Style {
            width: Val::Percent(100.0),
            height: Val::Percent(100.0),
            align_items: AlignItems::Center,
            justify_content: JustifyContent::Center,
            ..default()
        },
        ..default()
    }).with_children(|parent| {
        parent.spawn(TextBundle::from_section("Hello", TextStyle::default()));
    });
}
```

Bevy UI is flexbox-like — declarative. For complex UI, consider `bevy_egui` (immediate-mode IMGUI port) for tooling/editors.

## Performance Tips

- Bevy auto-parallelizes systems — don't fight it with shared mutable state
- Use `Query` filters: `With<Player>`, `Without<Dead>`, `Changed<Transform>`, `Added<Enemy>`
- Batch `commands.spawn()` calls via `commands.spawn_batch`
- For thousands of entities, prefer **sparse-set components** (rare, hot data) over **table components** (default)
- Profile with `bevy_diagnostic` + `LogDiagnosticsPlugin::default()` — frame time, entity count
- Compile with `--release` for benchmarking — debug is 10x slower

## Best Practices

- ECS-first: avoid OOP-style "GameObject" abstractions; components are data only
- One responsibility per system — small, focused, easy to schedule
- Use **states** to gate gameplay phases — clean separation of menu/game/pause
- **Plugins** organize features — keep `main.rs` thin, registering plugins
- Use **events** for cross-system communication — not direct calls
- `#[derive(Component, Default)]` to enable `..default()` in spawn
- Read Bevy migration guides between versions — API churn is real (0.13 → 0.14 → 0.15 each had breaking changes)

## Common Pitfalls

- Borrowing the same `World` mutably twice in one system → panic at runtime
- `Query::single()` when zero/multiple entities match → panic; use `get_single()` returning Result
- Forgetting `time.delta_seconds()` in movement → frame-rate-dependent speed
- Hot-reloading shaders without restarting → state drift
- Following old tutorials (Bevy 0.10 / 0.11 / 0.12) → API moved; check version
- Heavy debug logging in tight loops → frame time spikes

## Resources

- Docs: https://bevyengine.org/learn
- Examples: https://github.com/bevyengine/bevy/tree/main/examples
- Cheat Book: https://bevy-cheatbook.github.io
- Awesome Bevy: https://github.com/bevyengine/awesome-bevy
- Discord: https://discord.gg/bevy
