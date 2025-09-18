import copy
import os
from typing import Dict, Tuple

import pytest
from flask import Flask

import flask_profiler


def _mongo_storage_config(monkeypatch: pytest.MonkeyPatch) -> Dict[str, object]:
    mongo_uri = os.environ.get("FLASK_PROFILER_TEST_MONGO_URI")
    if mongo_uri:
        return {
            "engine": "mongodb",
            "MONGO_URL": mongo_uri,
            "DATABASE": "flask_profiler_test",
            "COLLECTION": "measurements",
        }

    try:
        import mongomock
    except ImportError:  # pragma: no cover
        pytest.skip("mongomock is not installed and no MongoDB URI provided")

    from flask_profiler.storage import mongo as mongo_storage

    if not hasattr(mongomock, "DESCENDING"):
        setattr(mongomock, "DESCENDING", -1)
    if not hasattr(mongomock, "ASCENDING"):
        setattr(mongomock, "ASCENDING", 1)
    if not hasattr(mongomock, "version_tuple"):
        setattr(mongomock, "version_tuple", (4, 0, 0))

    monkeypatch.setattr(mongo_storage, "pymongo", mongomock)

    return {
        "engine": "mongodb",
        "MONGO_URL": "mongodb://localhost",
        "DATABASE": "flask_profiler_test",
        "COLLECTION": "measurements",
    }


@pytest.fixture(params=["sqlite", "sqlalchemy", "mongo"], ids=str)
def storage_backend(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> Tuple[str, Dict[str, object]]:
    backend = request.param
    if backend == "sqlite":
        config = {"engine": "sqlite", "db_url": "sqlite:///:memory:"}
    elif backend == "sqlalchemy":
        config = {"engine": "sqlalchemy", "db_url": "sqlite:///:memory:"}
    elif backend == "mongo":
        config = _mongo_storage_config(monkeypatch)
    else:  # pragma: no cover
        raise AssertionError(f"Unknown backend {backend}")

    return backend, config


def _register_example_routes(app: Flask) -> None:
    @app.route("/api/people/<firstname>")
    def say_hello(firstname: str):
        return firstname

    @app.route("/static/photo/")
    def get_static_photo():
        return "your static photo"

    @app.route("/static/")
    def get_static():
        return "your static"

    @app.route("/api/static/")
    def get_api_static():
        return "your api static"

    @app.route("/api/settings/system/secret/")
    def get_system_settings_secret():
        return "your system settings secret"

    @app.route("/api/settings/personal/secret/")
    def get_personal_settings_secret():
        return "your personal settings secret"

    @app.route("/api/settings/personal/name/")
    def get_personal_settings_name():
        return "your personal settings name"


@pytest.fixture
def app(storage_backend: Tuple[str, Dict[str, object]]):
    _, storage_config = storage_backend
    app = Flask(__name__)
    app.config["TESTING"] = True
    app.config["flask_profiler"] = {
        "enabled": True,
        "verbose": False,
        "storage": copy.deepcopy(storage_config),
        "ignore": ["^/static/.*"],
        "basicAuth": {"enabled": False},
    }

    _register_example_routes(app)
    flask_profiler.init_app(app)

    @app.route("/api/without/profiler")
    def without_profiler():
        return "without profiler"

    @app.route("/api/with/profiler/<message>")
    @flask_profiler.profile()
    def with_profiler(message: str):
        return "with profiler"

    ctx = app.app_context()
    ctx.push()
    flask_profiler.collection.truncate()

    yield app

    flask_profiler.collection.truncate()
    ctx.pop()


@pytest.fixture
def client(app: Flask):
    return app.test_client()


@pytest.fixture
def profiler_state(app: Flask):
    return flask_profiler.current_profiler


@pytest.fixture
def profiler_collection(app: Flask):
    return flask_profiler.collection
