# Lustre Standards (Gleam UI Framework)

## TEA Architecture — Model / Message / Update / View

Every Lustre app follows The Elm Architecture strictly:

```gleam
import lustre
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

// 1. Model — immutable app state
pub type Model {
  Model(count: Int, loading: Bool)
}

fn init(_flags) -> #(Model, lustre.Effect(Msg)) {
  #(Model(count: 0, loading: False), lustre.none())
}

// 2. Msg — all possible state transitions
pub type Msg {
  Increment
  Decrement
  Reset
  GotData(Result(String, String))
}

// 3. Update — pure function, always returns new model + effect
fn update(model: Model, msg: Msg) -> #(Model, lustre.Effect(Msg)) {
  case msg {
    Increment -> #(Model(..model, count: model.count + 1), lustre.none())
    Decrement -> #(Model(..model, count: model.count - 1), lustre.none())
    Reset     -> #(init(Nil).0, lustre.none())
    GotData(Ok(data))    -> #(Model(..model, loading: False), lustre.none())
    GotData(Error(_))    -> #(Model(..model, loading: False), lustre.none())
  }
}

// 4. View — pure function, model → HTML
fn view(model: Model) -> Element(Msg) {
  html.div([], [
    html.button([event.on_click(Decrement)], [element.text("-")]),
    html.p([], [element.text(int.to_string(model.count))]),
    html.button([event.on_click(Increment)], [element.text("+")]),
  ])
}

// 5. Wire it together
pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
}
```

## Effects

Side effects (HTTP, timers, random) are values — never imperative calls:

```gleam
import lustre/effect.{type Effect}

fn fetch_data(url: String) -> Effect(Msg) {
  effect.from(fn(dispatch) {
    // perform side effect, dispatch a Msg when done
    use response <- promise.await(fetch(url))
    dispatch(GotData(response))
  })
}

// Return effect from update
fn update(model, msg) -> #(Model, Effect(Msg)) {
  case msg {
    FetchClicked -> #(Model(..model, loading: True), fetch_data("/api/data"))
    GotData(result) -> #(Model(..model, loading: False, data: result), effect.none())
  }
}
```

## Component vs Application

```gleam
// Application — full app with its own runtime
lustre.application(init, update, view)

// Component — reusable, embeddable, can accept props
lustre.component(init, update, view, on_attribute_change)
```

## Key Rules

- `update` must be a **pure function** — no side effects inline, return `Effect` instead
- All state lives in `Model` — no local mutable state anywhere
- `Msg` constructors are the only way to trigger state changes
- View functions are pure — same model always produces same HTML
- Use `Model(..model, field: new_value)` spread syntax for updates (never mutate)
