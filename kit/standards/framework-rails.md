# Rails Standards

Detected via `gem "rails"` in `Gemfile`. Target Rails 7.1+ / 8.

## Project Structure

```
app/
├── controllers/         # ApplicationController + REST controllers
├── models/              # ActiveRecord models
├── views/               # ERB templates (or Hotwire/Turbo)
├── helpers/
├── mailers/
├── jobs/                # ActiveJob (background work)
├── channels/            # ActionCable (WebSockets)
├── services/            # Custom — for business logic
└── policies/            # Authorization (e.g. Pundit)
config/
├── routes.rb
├── database.yml
└── application.rb
db/
├── migrate/
└── schema.rb
test/ or spec/           # Minitest or RSpec
```

## Routing

```ruby
# config/routes.rb
Rails.application.routes.draw do
  resources :posts, only: [:index, :show, :create, :update, :destroy] do
    resources :comments
  end

  namespace :api do
    namespace :v1 do
      resources :users
    end
  end

  root "home#index"
  get "/health", to: ->(_) { [200, {}, ["OK"]] }
end
```

`resources` generates the full REST suite. Use `only:` / `except:` to limit.

## Controllers (Thin!)

```ruby
class PostsController < ApplicationController
  before_action :authenticate!
  before_action :load_post, only: [:show, :update, :destroy]

  def index
    @posts = Post.published.with_author.page(params[:page])
    render json: @posts
  end

  def create
    @post = current_user.posts.new(post_params)
    if @post.save
      render json: @post, status: :created
    else
      render json: { errors: @post.errors }, status: :unprocessable_entity
    end
  end

  private

  def load_post
    @post = Post.find(params[:id])
  end

  def post_params
    params.require(:post).permit(:title, :body)
  end
end
```

**Strong parameters** (`params.require(...).permit(...)`) — prevents mass-assignment vulns. Always whitelist.

## ActiveRecord Models

```ruby
class Post < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy

  validates :title, presence: true, length: { maximum: 200 }
  validates :slug, uniqueness: true

  scope :published, -> { where.not(published_at: nil) }
  scope :recent, -> { order(created_at: :desc) }

  before_save :generate_slug, if: -> { slug.blank? }

  def published?
    published_at.present?
  end

  private

  def generate_slug
    self.slug = title.parameterize
  end
end
```

## N+1 Prevention (Critical!)

```ruby
# Bad — N+1 query
posts = Post.all
posts.each { |p| puts p.user.name }   # N+1!

# Good — eager load
posts = Post.includes(:user)
# Or with multiple
posts = Post.includes(user: :profile, comments: :author)
```

Use **bullet** gem in dev to catch N+1s automatically. **rack-mini-profiler** for query times.

## Migrations

```bash
bin/rails generate migration CreatePosts title:string body:text user:references
bin/rails db:migrate
bin/rails db:rollback
```

```ruby
class CreatePosts < ActiveRecord::Migration[7.1]
  def change
    create_table :posts do |t|
      t.references :user, null: false, foreign_key: true
      t.string :title, null: false
      t.text :body
      t.string :slug, index: { unique: true }
      t.datetime :published_at
      t.timestamps
    end
    add_index :posts, [:user_id, :published_at]
  end
end
```

Reversible by default. Use `up`/`down` for non-reversible changes (data migrations).

## Authentication

- Rails 8 introduced **built-in authentication generator** — `bin/rails g authentication`
- **Devise** — feature-rich, battle-tested, but verbose
- **Sorcery** — lighter alternative
- **Rodauth** — robust auth toolkit
- **rails_authentication_zero** / homegrown — simplest

```ruby
# Rails 8+ built-in
class SessionsController < ApplicationController
  def create
    if user = User.authenticate_by(email: params[:email], password: params[:password])
      start_new_session_for user
      redirect_to root_path
    else
      redirect_to new_session_path, alert: "Invalid login"
    end
  end
end
```

## Authorization — Pundit

```ruby
class PostPolicy < ApplicationPolicy
  def update?
    user.admin? || record.user_id == user.id
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      user.admin? ? scope.all : scope.where(user: user)
    end
  end
end

# Controller
def update
  @post = Post.find(params[:id])
  authorize @post     # raises Pundit::NotAuthorizedError if not allowed
  # ...
end
```

## Background Jobs (ActiveJob)

```ruby
class WelcomeEmailJob < ApplicationJob
  queue_as :default
  retry_on Net::SMTPError, wait: :polynomially_longer

  def perform(user_id)
    user = User.find(user_id)
    UserMailer.welcome(user).deliver_now
  end
end

# Enqueue
WelcomeEmailJob.perform_later(user.id)
WelcomeEmailJob.set(wait: 5.minutes).perform_later(user.id)
```

Backends: **Sidekiq** (Redis) is standard for production. **GoodJob** (Postgres-backed) increasingly popular.

## Hotwire (Turbo + Stimulus)

Rails 7+ ships with **Hotwire** — SPA-like UX without writing JS:

```erb
<!-- Turbo Frame: only this section reloads on click -->
<%= turbo_frame_tag "posts" do %>
  <% @posts.each do |post| %>
    <%= render post %>
  <% end %>
<% end %>

<!-- Turbo Stream: broadcast updates via WebSocket -->
<%= turbo_stream_from @post %>
```

```ruby
# Update via Turbo Stream
class PostsController < ApplicationController
  def create
    @post = Post.create!(post_params)
    respond_to do |format|
      format.turbo_stream  # renders create.turbo_stream.erb
      format.html { redirect_to @post }
    end
  end
end
```

Stimulus controllers for sprinkles of interactivity:
```js
// app/javascript/controllers/toggle_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel"]

  toggle() {
    this.panelTarget.classList.toggle("hidden")
  }
}
```

```erb
<div data-controller="toggle">
  <button data-action="click->toggle#toggle">Show/Hide</button>
  <div data-toggle-target="panel" class="hidden">Secret</div>
</div>
```

## Caching

```ruby
# Fragment cache
<% cache @post do %>
  <%= render @post %>
<% end %>

# Russian-doll caching auto-invalidates when nested records change

# Low-level
Rails.cache.fetch("expensive_query", expires_in: 1.hour) { Post.heavy_calculation }
```

Use **Redis** as cache store in production. Solid Cache (Rails 8+) for DB-backed cache.

## Testing

```ruby
# test/models/post_test.rb (Minitest, default)
class PostTest < ActiveSupport::TestCase
  test "valid with title and body" do
    post = Post.new(title: "Hi", body: "World")
    assert post.valid?
  end

  test "requires title" do
    post = Post.new
    assert_not post.valid?
    assert_includes post.errors[:title], "can't be blank"
  end
end

# spec/models/post_spec.rb (RSpec, popular alternative)
RSpec.describe Post do
  it { should validate_presence_of(:title) }
  it { should belong_to(:user) }
end
```

```bash
bin/rails test
bundle exec rspec
```

Use **factory_bot** for test data, **vcr** for recorded HTTP responses.

## Best Practices

- **Skinny controllers, fat models** — but split fat models into concerns / service objects past ~150 LOC
- **Strong params** mandatory — never `params.permit!` blindly
- **Eager load** with `includes` to dodge N+1
- **Scopes** for reusable query fragments — composable
- **`bin/rails generate`** liberally — enforces conventions
- **dotenv-rails** or `Rails.application.credentials` for secrets — never commit credentials
- **rubocop-rails-omakase** or **standard** for linting

## Common Pitfalls

- N+1 queries from forgotten `includes` — biggest perf killer
- `User.find(params[:id])` in controllers without rescue → 500 on missing record (use `find_by` + check, or rescue)
- Mass assignment via `params.permit!` → security hole
- `save` without checking return value → silent failures
- `save!` in transactions then catching `RecordInvalid` for control flow → expensive; check `valid?` first
- Putting logic in views → extract to helpers / presenters / view components
- Default development cache settings shipped to prod → catastrophic perf

## Resources

- Docs: https://guides.rubyonrails.org
- API: https://api.rubyonrails.org
- Hotwire: https://hotwired.dev
- Edge Guides (upcoming): https://edgeguides.rubyonrails.org
- The Rails Way (book): https://leanpub.com/therailsway
- GoRails (tutorials): https://gorails.com
