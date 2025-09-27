from pathlib import Path

import pytest
from flask import Flask

import flask_profiler


def _build_config(db_path):
    path = Path(db_path)
    if path.suffix != ".db":
        path = path.with_suffix(".db")
    return {
        "enabled": True,
        "storage": {
            "engine": "sqlalchemy",
            "db_url": f"sqlite:///{path}"
        },
        "basicAuth": {
            "enabled": False
        },
        "ignore": []
    }


@pytest.mark.parametrize("late_route", [False, True])
def test_profiler_records_per_app(tmp_path, late_route):
    app = Flask(f"app-{late_route}")
    db_path = tmp_path / ("late" if late_route else "early")
    app.config["flask_profiler"] = _build_config(db_path)
    app.config["TESTING"] = True

    @app.route("/tracked")
    def tracked():
        return "ok"

    flask_profiler.init_app(app)

    if late_route:
        @app.route("/late")
        @flask_profiler.profile()
        def late():
            return "late"

    with app.app_context():
        flask_profiler.collection.truncate()

    client = app.test_client()
    client.get("/tracked")
    if late_route:
        client.get("/late")

    with app.app_context():
        data = list(flask_profiler.collection.filter())

    if late_route:
        assert {m["name"] for m in data} == {"/tracked", "/late"}
    else:
        assert {m["name"] for m in data} == {"/tracked"}


def test_profiler_state_isolated_between_apps(tmp_path):
    app1 = Flask("app1")
    app2 = Flask("app2")

    app1.config["flask_profiler"] = _build_config(tmp_path / "one")
    app2.config["flask_profiler"] = _build_config(tmp_path / "two")

    @app1.route("/ping")
    def ping():
        return "pong"

    @app2.route("/ping")
    def pong():
        return "pong"

    flask_profiler.init_app(app1)
    flask_profiler.init_app(app2)

    with app1.app_context():
        flask_profiler.collection.truncate()
    with app2.app_context():
        flask_profiler.collection.truncate()

    client1 = app1.test_client()
    client1.get("/ping")

    with app1.app_context():
        data1 = list(flask_profiler.collection.filter())
    with app2.app_context():
        data2 = list(flask_profiler.collection.filter())

    assert len(data1) == 1
    assert len(data2) == 0

    client2 = app2.test_client()
    client2.get("/ping")

    with app1.app_context():
        data1 = list(flask_profiler.collection.filter())
    with app2.app_context():
        data2 = list(flask_profiler.collection.filter())

    assert len(data1) == 1
    assert len(data2) == 1


def test_dashboard_uses_flask_login_when_enabled(tmp_path):
    pytest.importorskip("flask_login")
    from flask_login import LoginManager, UserMixin, login_user

    class _User(UserMixin):
        def __init__(self, user_id: str):
            self.id = user_id

    app = Flask("flask-login-app")
    app.secret_key = "testing-secret"
    app.config["TESTING"] = True
    app.config["flask_profiler"] = {
        "enabled": True,
        "storage": {
            "engine": "sqlalchemy",
            "db_url": f"sqlite:///{tmp_path / 'flask_login.db'}",
        },
        "flaskLogin": {"enabled": True},
    }

    login_manager = LoginManager(app)
    login_manager.login_view = "login"

    user = _User("demo")

    @login_manager.user_loader
    def load_user(user_id: str):
        return user if user_id == user.id else None

    @app.route("/login", methods=["POST"])
    def login():
        login_user(user)
        return "ok"

    flask_profiler.init_app(app)

    with app.app_context():
        assert flask_profiler.current_profiler._auth_strategy == "flask-login"

    client = app.test_client()

    unauthenticated = client.get("/flask-profiler/")
    assert unauthenticated.status_code in {302, 401}

    with client:
        client.post("/login")
        response = client.get("/flask-profiler/")

    assert response.status_code == 200


def test_dashboard_uses_flask_security_when_enabled(tmp_path, monkeypatch):
    import sys
    import types

    call_log = []

    fake_security = types.ModuleType("flask_security")

    def _fake_auth_required(*args, **kwargs):
        call_log.append(("factory", args, kwargs))

        def _decorator(func):
            call_log.append(("decorator", func.__name__))
            return func

        return _decorator

    fake_security.auth_required = _fake_auth_required

    def _fail_login_required(func):
        raise AssertionError("login_required fallback should not be used when auth_required exists")

    fake_security.login_required = _fail_login_required

    fake_decorators = types.ModuleType("flask_security.decorators")
    fake_decorators.login_required = _fail_login_required

    monkeypatch.setitem(sys.modules, "flask_security", fake_security)
    monkeypatch.setitem(sys.modules, "flask_security.decorators", fake_decorators)

    app = Flask("flask-security-app")
    app.config["TESTING"] = True
    app.config["flask_profiler"] = {
        "enabled": True,
        "storage": {
            "engine": "sqlalchemy",
            "db_url": f"sqlite:///{tmp_path / 'flask_security.db'}",
        },
        "flaskSecurity": {
            "enabled": True,
            "args": "token",
            "within": "1 hour",
            "roles": ["admin"],
        },
    }

    flask_profiler.init_app(app)

    with app.app_context():
        assert flask_profiler.current_profiler._auth_strategy == "flask-security"

    expected_args = ("token",)
    expected_kwargs = {"within": "1 hour", "roles": ["admin"]}
    assert call_log, "auth_required decorator should decorate internal routes"
    assert call_log[0] == ("factory", expected_args, expected_kwargs)
    assert any(entry[0] == "decorator" for entry in call_log)

    client = app.test_client()
    response = client.get("/flask-profiler/")

    assert response.status_code == 200
