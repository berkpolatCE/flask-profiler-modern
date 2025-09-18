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
