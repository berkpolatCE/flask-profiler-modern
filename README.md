# flask-profiler-modern

A fully modernized fork of the original [flask-profiler](https://github.com/muatik/flask-profiler) project. It delivers the profiling simplicity you expect with a refreshed UI, secure defaults, first-class support for Flask 3.x, and seamless reuse of your existing `flask-login` or `flask-security` setup. Modernization and ongoing maintenance are led by **Berk Polat**, building on the foundation created by **Mustafa Atik**.

---

## Table of Contents
1. [Features](#features)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Instrumentation Model](#instrumentation-model)
5. [Dashboard Tour](#dashboard-tour)
6. [Storage Backends](#storage-backends)
7. [Configuration Cheat Sheet](#configuration-cheat-sheet)
8. [Sampling & Filtering](#sampling--filtering)
9. [API Endpoints](#api-endpoints)
10. [Development](#development)
11. [Contributing](#contributing)
12. [Credits & License](#credits--license)

---

## Features
- **Flask 3.x compatible** – Extension-style initialization with per-app state and thread safety.
- **Modern dashboard** – Vite-built UI, responsive layout, and syntax-highlighted measurement detail.
- **Multi-backend storage** – SQLite, SQLAlchemy, and MongoDB (or custom engines) with parametrized pytest coverage.
- **Drop-in authentication** – Ship with built-in basic auth or reuse the `flask-login` / `flask-security` protection already in your app.
- **Secure defaults** – Ignore patterns, highlighted configuration guidance, and headers that keep the dashboard private.
- **Simple integration** – One `init_app` call profiles existing routes; decorators cover factory or late-registered endpoints.

---

## Installation

```bash
pip install flask-profiler-modern
```

Optional extras bring in backend-specific dependencies:

| Extra               | Command                                         | Includes                     |
|---------------------|-------------------------------------------------|------------------------------|
| SQLAlchemy storage  | `pip install flask-profiler-modern[sqlalchemy]` | `SQLAlchemy>=2.0.0`          |
| MongoDB storage     | `pip install flask-profiler-modern[mongo]`      | `pymongo>=4.14.1,<5`         |
| Everything          | `pip install flask-profiler-modern[all]`        | Both of the above            |

---

## Quick Start

```python
from flask import Flask
import flask_profiler

app = Flask(__name__)
app.config["DEBUG"] = True
app.config["flask_profiler"] = {
    "enabled": True,
    "storage": {
        "engine": "sqlite",              # sqlite | sqlalchemy | mongodb | dotted path
        "db_url": "sqlite:///profiler.db"
    },
    "basicAuth": {
        "enabled": False                  # enable
    },
    "flaskLogin": {
        "enabled": False                  # reuse your existing Flask-Login setup when True
    },
    "flaskSecurity": {
        "enabled": False                  # wrap dashboard with Flask-Security's auth_required/login_required
    },
    "ignore": ["^/static/.*"]
}

@app.route("/ping")
def ping():
    return "pong"

flask_profiler.init_app(app)

# Routes registered after init_app need explicit opt-in.
@app.route("/late")
@flask_profiler.profile()
def late_route():
    return "tracked"

if __name__ == "__main__":
    app.run()
```

Open `http://127.0.0.1:5000/flask-profiler/` to view the dashboard.

---

## Instrumentation Model

| Scenario                              | How to profile it                                                                               |
|---------------------------------------|--------------------------------------------------------------------------------------------------|
| Routes defined before `init_app`      | Automatically wrapped when you call `flask_profiler.init_app(app)`                              |
| Routes added after `init_app`         | Decorate with `@flask_profiler.profile()`                                                       |
| Factory/blueprint pattern             | Call `init_app` inside your factory once routes are registered, or decorate the blueprint views |
| Custom instrumentation                | Use `flask_profiler.measure(func, name, method)` to wrap arbitrary callables                    |

> TIP: `flask_profiler.current_profiler` exposes the active profiler state if you need low-level access.

---

## Dashboard Tour

- **Overview** – Request timeline & method distribution with range controls.
- **Filtering** – Server-side table with sort/search plus quick filters from the dashboard.
- **Details** – Syntax-highlighted JSON modal enumerating request context, headers, args, and body.

![Dashboard](resources/new_dashboard_screen.png?raw=true "Dashboard overview")

![Filtering](resources/new_filtering_all_screen.png?raw=true "Filtering table")

![Request detail](resources/new_filtering_detail_screen.png?raw=true "Measurement detail")

---

## Storage Backends

Configuration lives under `app.config["flask_profiler"]["storage"]`.

| Engine       | Minimal config                                     | Notes                                        |
|--------------|----------------------------------------------------|----------------------------------------------|
| SQLite       | `{ "engine": "sqlite", "db_url": "sqlite:///profiler.db" }` | Default if omitted                           |
| SQLAlchemy   | `{ "engine": "sqlalchemy", "db_url": "postgresql://..." }` | Works with any SQLAlchemy URL                |
| MongoDB      | `{ "engine": "mongodb", "MONGO_URL": "mongodb://..." }`    | Requires `pymongo` (or `mongomock` for tests) |
| Custom class | `{ "engine": "package.module.CustomStorage" }`               | Must subclass `flask_profiler.storage.BaseStorage` |

Extras control dependency installation; see [Installation](#installation).

---

## Configuration Cheat Sheet

| Key                               | Type      | Default                        | Description                                             |
|-----------------------------------|-----------|--------------------------------|---------------------------------------------------------|
| `enabled`                         | bool      | `False`                        | Toggle profiling globally                                |
| `storage.engine`                  | str       | `"sqlite"`                    | Storage backend identifier                               |
| `storage.db_url`                  | str       | engine-specific                | Optional database URL for SQL storage                    |
| `basicAuth.enabled`               | bool      | `False`                        | Enable dashboard authentication                          |
| `basicAuth.username/password`     | str       | `admin/admin` (example)        | Credentials if basic auth is enabled                     |
| `flaskLogin.enabled`              | bool      | `False`                        | Protect dashboard using Flask-Login's `login_required`   |
| `flaskSecurity.enabled`           | bool      | `False`                        | Protect dashboard using Flask-Security decorators        |
| `ignore`                          | list[str] | `[]`                           | Regex patterns to skip profiling                         |
| `sampling_function`               | callable  | `None`                         | Return truthy to record, falsy to skip                  |
| `endpointRoot`                    | str       | `"flask-profiler"`            | URL prefix for dashboard and API                         |
| `verbose`                         | bool      | `False`                        | Print measurement JSON to stdout                         |

---

### Authentication

`flask-profiler` keeps the dashboard private with either built-in HTTP basic auth or your application's existing authentication stack (`flask-login` or `flask-security`).

- Basic auth: provide `basicAuth.enabled`, `basicAuth.username`, and `basicAuth.password`. The client will be prompted for credentials.
- Flask-Login: set `flaskLogin.enabled` to `True` once you've configured `LoginManager`. The extension simply wraps its routes with `flask_login.login_required`, so your usual login flow applies. `basicAuth` settings are ignored in this mode.
- Flask-Security: set `flaskSecurity.enabled` to `True` after wiring Flask-Security (or Flask-Security-Too). `flask-profiler` will use `auth_required()` when available, falling back to `login_required`. `flaskLogin` and `basicAuth` settings are ignored in this mode.

Make sure the relevant authentication package is installed when you enable these options.

---

## Sampling & Filtering

### Sampling function
Use a callable to decide per-request whether to record data.

```python
import random

app.config["flask_profiler"] = {
    "sampling_function": lambda: random.random() < 0.05  # 5% sample rate
}
```

### Ignoring routes

```python
app.config["flask_profiler"] = {
    "ignore": [
        "^/static/.*",
        "/healthz",
        "/metrics"
    ]
}
```

Ignored routes and unsuccessful samples are never written to storage.

---

## API Endpoints

The dashboard uses a small JSON API rooted at `/flask-profiler/` by default. You can call these directly:

| Endpoint                                      | Method | Description                                 |
|-----------------------------------------------|--------|---------------------------------------------|
| `/flask-profiler/api/measurements/`           | GET    | Paged measurements (supports filters)        |
| `/flask-profiler/api/measurements/grouped`    | GET    | Aggregated per endpoint statistics           |
| `/flask-profiler/api/measurements/<id>`       | GET    | Full measurement payload                     |
| `/flask-profiler/api/measurements/timeseries/`| GET    | Request counts over time                     |
| `/flask-profiler/api/measurements/methodDistribution/` | GET | Count of requests per HTTP method           |
| `/flask-profiler/db/dumpDatabase`             | GET    | Download all measurements as JSON            |
| `/flask-profiler/db/deleteDatabase`           | GET    | Delete all stored measurements               |

Parameters such as `startedAt`, `endedAt`, `skip`, `limit`, and `sort` mirror those used by the UI. All endpoints require basic auth if you enable it.

---

## Development

Clone the repo and set up your environment:

```bash
git clone https://github.com/berkpolatCE/flask-profiler-modern.git
cd flask-profiler-modern

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd flask_profiler/static
npm install
npm run dev
```

Run tests before submitting changes:

```bash
source .venv/bin/activate
pytest
```

Building frontend assets:

```bash
cd flask_profiler/static
npm run build
```

`FLASK_PROFILER_TEST_MONGO_URI` points pytest at a real MongoDB. Without it, tests fall back to `mongomock`.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor workflow, coding standards, and test requirements. Open issues and roadmap items live at [github.com/berkpolatCE/flask-profiler-modern/issues](https://github.com/berkpolatCE/flask-profiler-modern/issues).

---

## Credits & License

- **Original author:** Mustafa Atik — [github.com/muatik/flask-profiler](https://github.com/muatik/flask-profiler)
- **Modernization & maintenance:** [Berk Polat](https://www.linkedin.com/in/berk-polat-56171a109/)
- Licensed under the [MIT License](LICENSE)

If this project helps you, please star the repository or share your improvements with the community!
