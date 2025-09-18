# -*- coding: utf8 -*-
import unittest
import sys
from os import environ, path

from flask import Flask

sys.path.append(path.dirname(path.dirname(path.abspath(__file__))))

from flask_profiler import collection
from flask_profiler import flask_profiler
from flask_profiler import measure
from flask_profiler import storage

_CONFS = {
    "mongodb": {
        "enabled": True,
        "storage": {
            "engine": "mongodb",
            "DATABASE": "flask_profiler_test",
            "COLLECTION": "profiler",
            "MONGO_URL": "mongodb://localhost"
        },
        "ignore": [
            "^/static/.*"
        ]
    },
    "sqlite": {
        "enabled": True,
        "storage": {
            "engine": "sqlite",
            "db_url": "sqlite:///:memory:"
        },
        "ignore": [
            "^/static/.*"
        ]
    },
    "sqlalchemy": {
        "enabled": True,
        "storage": {
            "engine": "sqlalchemy",
            "db_url": "sqlite:///:memory:"
        },
        "ignore": [
            "^/static/.*"
        ]
    }
}
CONF = _CONFS[environ.get('FLASK_PROFILER_TEST_CONF', 'sqlalchemy')]


class BasetTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._app = Flask(__name__)
        cls._app.config["flask_profiler"] = CONF
        cls._app.config["TESTING"] = True
        flask_profiler.init_app(cls._app)
        cls._ctx = cls._app.app_context()
        cls._ctx.push()

    @classmethod
    def tearDownClass(cls):
        cls._ctx.pop()

    def setUp(self):
        super().setUp()
        collection.truncate()

    def tearDown(self):
        collection.truncate()
        super().tearDown()

    def create_app(self):
        app = Flask(__name__)
        app.config["flask_profiler"] = CONF
        app.config['TESTING'] = True

        @app.route("/api/people/<firstname>")
        def sayHello(firstname):
            return firstname

        @app.route("/static/photo/")
        def getStaticPhoto():
            return "your static photo"

        @app.route("/static/")
        def getStatic():
            return "your static"

        @app.route("/api/static/")
        def getApiStatic():
            return "your api static"

        @app.route("/api/settings/system/secret/")
        def getSystemSettingsSecret():
            return "your system settings secret"

        @app.route("/api/settings/personal/secret/")
        def getPersonalSettingsSecret():
            return "your personal settings secret"

        @app.route("/api/settings/personal/name/")
        def getPersonalSettingsName():
            return "your personal settings name"

        flask_profiler.init_app(app)

        @app.route("/api/without/profiler")
        def withoutProfiler():
            return "without profiler"

        @app.route("/api/with/profiler/<message>")
        @flask_profiler.profile()
        def customProfilerEP(message):
            return "with profiler"

        return app


class BaseTest2(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls._app = Flask(__name__)
        cls._app.config["flask_profiler"] = CONF
        cls._app.config["TESTING"] = True
        profiler = flask_profiler.Profiler()
        profiler.init_app(cls._app)
        cls._ctx = cls._app.app_context()
        cls._ctx.push()

    @classmethod
    def tearDownClass(cls):
        cls._ctx.pop()

    def setUp(self):
        super().setUp()
        collection.truncate()

    def tearDown(self):
        collection.truncate()
        super().tearDown()

    def create_app(self):
        app = Flask(__name__)
        app.config["flask_profiler"] = CONF
        app.config['TESTING'] = True

        @app.route("/api/people/<firstname>")
        def sayHello(firstname):
            return firstname

        @app.route("/api/with/profiler/<message>")
        def customProfilerEP(message):
            return "with profiler"

        profiler = flask_profiler.Profiler()
        profiler.init_app(app)

        return app
