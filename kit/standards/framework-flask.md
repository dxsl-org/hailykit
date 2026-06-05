# Flask Standards

Detected via `flask` in `requirements.txt` / `pyproject.toml` / `Pipfile`.

## When to Use

- Small-to-medium Python web apps with minimal abstraction
- Microservices / single-purpose APIs
- Legacy codebases (Flask is one of the oldest, widely deployed)
- When FastAPI's async or Django's batteries-included feel like overkill

For new APIs needing async / type-safety, **prefer FastAPI**. For full-stack apps with admin/ORM, **prefer Django**.

## Project Structure

```
app/
├── __init__.py            # create_app() factory
├── extensions.py          # db, migrate, login_manager singletons
├── models.py              # SQLAlchemy models
├── blueprints/
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── routes.py
│   │   └── forms.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py
│   └── main/
├── templates/             # Jinja2
├── static/
└── config.py              # Config classes
wsgi.py                    # Production entry: from app import create_app; app = create_app()
```

## App Factory Pattern

Use a factory function — enables multiple configs (dev, prod, test) + cleaner imports:

```python
# app/__init__.py
from flask import Flask
from .extensions import db, migrate

def create_app(config_name='production'):
    app = Flask(__name__)
    app.config.from_object(f'app.config.{config_name.title()}Config')

    db.init_app(app)
    migrate.init_app(app, db)

    from .blueprints.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api')

    return app
```

## Blueprints (Route Organization)

```python
# app/blueprints/api/routes.py
from flask import Blueprint, jsonify, request
from app.models import User
from app.extensions import db

bp = Blueprint('api', __name__)

@bp.get('/users/<int:user_id>')
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify({'id': user.id, 'email': user.email})

@bp.post('/users')
def create_user():
    data = request.get_json()
    user = User(email=data['email'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'id': user.id}), 201
```

Blueprints group related routes — register them in the factory.

## Configuration

```python
# app/config.py
import os

class Config:
    SECRET_KEY = os.environ['SECRET_KEY']
    SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # Production-only settings
```

Set `FLASK_CONFIG=development` env var, factory picks the right class.

## Database (SQLAlchemy)

```python
# app/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

# app/models.py
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    posts = db.relationship('Post', backref='author', lazy=True)
```

Migrations via Flask-Migrate:
```bash
flask db init               # once per project
flask db migrate -m "Add users table"
flask db upgrade
```

## Validation

Use **marshmallow** or **pydantic** — never trust `request.get_json()`:

```python
from marshmallow import Schema, fields, validate

class UserSchema(Schema):
    email = fields.Email(required=True)
    age = fields.Int(validate=validate.Range(min=13))

@bp.post('/users')
def create_user():
    try:
        data = UserSchema().load(request.get_json())
    except ValidationError as e:
        return jsonify(e.messages), 400
    # ...
```

For pydantic, use `flask-pydantic` or call `Model.model_validate()` directly.

## Auth

- **Flask-Login** — session-based auth for browser apps (login_user, logout_user, current_user)
- **Flask-JWT-Extended** — JWT for APIs
- **Authlib** — OAuth client (Google, GitHub, etc.) + server
- For Better-Auth-style passwordless / passkeys: roll your own with `webauthn` package

## Error Handling

```python
@app.errorhandler(404)
def not_found(e):
    return jsonify(error='Not found'), 404

@app.errorhandler(500)
def server_error(e):
    app.logger.error(e)
    return jsonify(error='Internal server error'), 500
```

## Background Jobs

- **Celery** + Redis — see `framework-celery.md`
- **RQ** — simpler Redis-based queue
- **APScheduler** — in-process scheduler (only for single-instance apps)

## Testing

```python
# tests/conftest.py
import pytest
from app import create_app
from app.extensions import db

@pytest.fixture
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

# tests/test_users.py
def test_create_user(client):
    res = client.post('/api/users', json={'email': 'a@b.com'})
    assert res.status_code == 201
```

## Async

Flask 2.0+ supports async routes:
```python
@bp.get('/data')
async def get_data():
    data = await fetch_external()
    return jsonify(data)
```

But Flask still runs sync at the WSGI layer — for serious async, use FastAPI/Quart/Starlette.

## Production Deployment

- **gunicorn** as WSGI server: `gunicorn -w 4 -k gevent wsgi:app`
- **gevent** or **eventlet** workers for I/O-bound apps
- **nginx** in front for static files + SSL termination
- `FLASK_ENV=production`, never `DEBUG=True` in prod (exposes interactive debugger = RCE)

## Best Practices

- App factory pattern + blueprints for organization
- `flask shell` — auto-loads app context; great for debugging models
- Use `current_app` instead of importing the app instance (avoids circular imports)
- Centralize DB session management — never `db.session.commit()` in helpers
- Marshmallow/pydantic schemas for serialize + validate (don't dump model attrs directly)
- Configure logging early in factory — don't rely on `print`

## Common Pitfalls

- `DEBUG=True` in production → interactive debugger exposed = code execution vulnerability
- Circular imports between models + app → use the factory pattern
- Mutable default args in routes (`def foo(items=[])`) — Python footgun
- Forgetting `db.session.commit()` after `db.session.add()` → silent data loss
- Using `request.form` for JSON body → returns empty; use `request.get_json()`
- Not using app context in CLI scripts → `RuntimeError: Working outside of application context`

## Resources

- Docs: https://flask.palletsprojects.com
- Flask-SQLAlchemy: https://flask-sqlalchemy.palletsprojects.com
- Flask-Migrate: https://flask-migrate.readthedocs.io
- Cookie cutter template: https://github.com/cookiecutter-flask/cookiecutter-flask
