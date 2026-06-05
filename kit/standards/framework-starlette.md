# Starlette Standards

Detected via `starlette` in `requirements.txt` / `pyproject.toml` / `Pipfile`.

## What Starlette Is

Starlette is the **ASGI foundation** that FastAPI is built on. Lightweight, async, minimal. Use it directly when:
- You want less magic than FastAPI (no auto-OpenAPI, no pydantic-everywhere)
- Custom server frameworks / WebSocket-heavy apps
- Maximum performance with no per-request validation overhead
- Educational use — understanding what FastAPI does under the hood

## When NOT to Use

- Building a typical CRUD API → FastAPI is faster to write and more featureful
- Need OpenAPI / Swagger out of the box → use FastAPI
- Mostly want pydantic validation → FastAPI

## Setup

```bash
pip install starlette uvicorn
```

```python
# app.py
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

async def homepage(request):
    return JSONResponse({"hello": "world"})

app = Starlette(debug=True, routes=[
    Route('/', homepage),
])
```

```bash
uvicorn app:app --reload
```

## Routing

```python
from starlette.routing import Route, Mount, WebSocketRoute

routes = [
    Route('/', endpoint=homepage),
    Route('/users/{user_id:int}', endpoint=get_user),
    Route('/users', endpoint=create_user, methods=['POST']),
    WebSocketRoute('/ws', endpoint=websocket_handler),
    Mount('/api/v1', routes=v1_routes),       # nested
    Mount('/static', app=StaticFiles(directory='static')),
]
```

Path converters: `{name}` (str), `{n:int}`, `{f:float}`, `{p:path}` (rest of path).

## Endpoints

Function-based:
```python
async def get_user(request):
    user_id = request.path_params['user_id']
    user = await db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404)
    return JSONResponse({'id': user.id, 'email': user.email})
```

Class-based:
```python
from starlette.endpoints import HTTPEndpoint

class UserEndpoint(HTTPEndpoint):
    async def get(self, request):
        return JSONResponse({'method': 'GET'})

    async def post(self, request):
        body = await request.json()
        return JSONResponse(body, status_code=201)
```

## Request Parsing

```python
async def handler(request):
    # Query params
    name = request.query_params.get('name')

    # Path params
    user_id = request.path_params['user_id']

    # JSON body
    data = await request.json()

    # Form data
    form = await request.form()
    file = form['upload']  # UploadFile

    # Raw body
    body = await request.body()

    # Headers
    auth = request.headers.get('authorization')

    # Cookies
    session = request.cookies.get('session_id')
```

## Responses

```python
from starlette.responses import (
    JSONResponse, PlainTextResponse, HTMLResponse,
    RedirectResponse, FileResponse, StreamingResponse
)

# JSON
return JSONResponse({'data': value}, status_code=200, headers={'X-Custom': 'value'})

# Streaming
async def generator():
    for item in source:
        yield f"data: {item}\n\n"

return StreamingResponse(generator(), media_type='text/event-stream')

# File
return FileResponse('path/to/file.pdf')
```

## Middleware

```python
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

middleware = [
    Middleware(TrustedHostMiddleware, allowed_hosts=['example.com', '*.example.com']),
    Middleware(CORSMiddleware, allow_origins=['*']),
    Middleware(GZipMiddleware, minimum_size=1000),
]

app = Starlette(routes=routes, middleware=middleware)
```

Custom middleware:
```python
from starlette.middleware.base import BaseHTTPMiddleware

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.time()
        response = await call_next(request)
        response.headers['X-Process-Time'] = str(time.time() - start)
        return response
```

## WebSockets

```python
from starlette.websockets import WebSocket

async def websocket_handler(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"echo: {data}")
    except WebSocketDisconnect:
        pass
```

Class-based:
```python
from starlette.endpoints import WebSocketEndpoint

class ChatEndpoint(WebSocketEndpoint):
    encoding = 'json'

    async def on_connect(self, websocket): await websocket.accept()
    async def on_receive(self, websocket, data): await websocket.send_json({'echo': data})
    async def on_disconnect(self, websocket, close_code): pass
```

## Background Tasks

```python
from starlette.background import BackgroundTask, BackgroundTasks

async def send_email(to, subject):
    # ...

async def handler(request):
    task = BackgroundTask(send_email, to='a@b.com', subject='Hi')
    return JSONResponse({'sent': True}, background=task)

# Multiple
async def handler(request):
    tasks = BackgroundTasks()
    tasks.add_task(send_email, to='a@b.com', subject='Hi')
    tasks.add_task(log_event, 'user_signup', user_id=1)
    return JSONResponse({'ok': True}, background=tasks)
```

Tasks run **after the response is sent** — non-blocking for the client.

## Templates (Jinja2)

```python
from starlette.templating import Jinja2Templates

templates = Jinja2Templates(directory='templates')

async def homepage(request):
    return templates.TemplateResponse('index.html', {'request': request, 'name': 'World'})
```

## Lifespan / Startup

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # Startup
    db = await create_db_pool()
    yield {'db': db}
    # Shutdown
    await db.close()

app = Starlette(routes=routes, lifespan=lifespan)
```

In handlers: `db = request.state.db`.

## Best Practices

- Use Starlette directly only when FastAPI overhead matters or you need fine control
- Pair with **pydantic** manually if you want validation (without FastAPI's auto-magic)
- Use class-based endpoints for groups of related methods
- Lifespan for resource setup (DB pool, Redis, ML model load)
- Background tasks for fire-and-forget post-response work

## Common Pitfalls

- Building a full CRUD framework on top of Starlette → just use FastAPI/Litestar
- Forgetting `await` on `request.json()` / `request.body()` → returns coroutine
- Not registering middleware in `Starlette(middleware=[...])` — adding after init doesn't work
- WebSocket handlers without `accept()` first → connection closes immediately
- Heavy CPU work in handler → blocks event loop; offload to `asyncio.to_thread`

## Resources

- Docs: https://www.starlette.io
- GitHub: https://github.com/encode/starlette
- Encode (org behind Starlette + httpx + uvicorn): https://www.encode.io
