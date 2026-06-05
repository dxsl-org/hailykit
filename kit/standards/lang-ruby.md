# Ruby Standards

## Comments

### RDoc (public methods)
```ruby
# Why this method exists + non-obvious contract.
#
# @param user_id [String] must be a valid UUID
# @return [User, nil] nil when user is soft-deleted
# @raise [NotFoundError] when user_id doesn't exist
def get_user(user_id)
```

- `#` single-line for inline notes; `=begin/=end` only for multi-paragraph API docs
- `frozen_string_literal: true` at top of every file — prevents accidental mutation

## Key Idioms

### Error Handling
```ruby
# Raise for unexpected failures; return nil/false for expected ones
def find_user(id)
  User.find(id)       # raises ActiveRecord::NotFoundError
rescue ActiveRecord::NotFoundError
  nil
end

# Result-like pattern for explicit error paths
def create_user(params)
  user = User.new(params)
  return [nil, user.errors] unless user.save
  [user, nil]
end
```

### Blocks and Enumerables
Prefer functional iteration over loops:
```ruby
# Bad
results = []
users.each { |u| results << u.name if u.active? }

# Good
results = users.select(&:active?).map(&:name)

# Chaining
users
  .select { |u| u.created_at > 1.week.ago }
  .sort_by(&:name)
  .first(10)
```

### Duck Typing and Guards
```ruby
# Guard clauses over nested if
def process(user)
  return unless user
  return if user.banned?
  perform_action(user)
end

# respond_to? for duck typing
def format(obj)
  obj.respond_to?(:to_json) ? obj.to_json : obj.to_s
end
```

### Frozen Literals and Symbols
```ruby
# frozen_string_literal: true   ← always include at file top

STATUS = %i[pending active archived].freeze  # frozen array of symbols
ROLES  = { admin: 0, user: 1 }.freeze
```

## Naming
- Classes/Modules: `PascalCase`
- Methods/variables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Predicates: end with `?` (`valid?`, `admin?`)
- Dangerous/mutating: end with `!` (`save!`, `upcase!`)
- Private methods: `private` below public interface
