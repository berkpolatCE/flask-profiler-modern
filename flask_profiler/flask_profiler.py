import functools
import logging
import re
import time
from pprint import pprint as pp

from flask import Blueprint
from flask import current_app
from flask import jsonify
from flask import request
from flask_httpauth import HTTPBasicAuth
from werkzeug.local import LocalProxy

from . import storage

logger = logging.getLogger("flask-profiler")

_EXTENSION_KEY = "flask-profiler"
_last_state = None


def _get_current_profiler(silent=False):
    try:
        app = current_app._get_current_object()
    except RuntimeError:
        if silent:
            return None
        raise RuntimeError("flask-profiler requires an active Flask application context")
    state = app.extensions.get(_EXTENSION_KEY)
    if state is None:
        if silent:
            return None
        raise RuntimeError("flask-profiler is not initialized for the current app")
    return state


current_profiler = LocalProxy(_get_current_profiler)


def _resolve_state(silent=False):
    state = _get_current_profiler(silent=True)
    if state is not None:
        return state
    if _last_state is not None:
        return _last_state
    if silent:
        return None
    raise RuntimeError("flask-profiler is not initialized")


def is_ignored(name, conf):
    ignore_patterns = conf.get("ignore", [])
    for pattern in ignore_patterns:
        if re.search(pattern, name):
            return True
    return False


class Measurement(object):
    DECIMAL_PLACES = 6

    def __init__(self, name, args, kwargs, method, context=None):
        super(Measurement, self).__init__()
        self.context = context
        self.name = name
        self.method = method
        self.args = args
        self.kwargs = kwargs
        self.startedAt = 0
        self.endedAt = 0
        self.elapsed = 0

    def __json__(self):
        return {
            "name": self.name,
            "args": self.args,
            "kwargs": self.kwargs,
            "method": self.method,
            "startedAt": self.startedAt,
            "endedAt": self.endedAt,
            "elapsed": self.elapsed,
            "context": self.context,
        }

    def __str__(self):
        return str(self.__json__())

    def start(self):
        self.startedAt = time.time()

    def stop(self):
        self.endedAt = time.time()
        self.elapsed = round(self.endedAt - self.startedAt, self.DECIMAL_PLACES)


class _ProfilerState(object):
    def __init__(self, app):
        self.app = app
        self.conf = self._load_config(app)
        self.enabled = bool(self.conf.get("enabled", False))
        self.collection = None
        self.auth = HTTPBasicAuth()
        self.auth.verify_password(self._verify_password)
        if not self.enabled:
            return
        self.collection = storage.getCollection(self.conf.get("storage", {}))
        self._wrap_app_endpoints()
        self._register_internal_routes()
        basic_auth = self.conf.get("basicAuth")
        if not basic_auth or not basic_auth.get("enabled"):
            logging.warning(" * CAUTION: flask-profiler is working without basic auth!")

    def _load_config(self, app):
        try:
            return app.config["flask_profiler"]
        except KeyError:
            try:
                return app.config["FLASK_PROFILER"]
            except KeyError:
                raise Exception(
                    "to init flask-profiler, provide required config through flask app's config. "
                    "please refer: https://github.com/muatik/flask-profiler"
                )

    def _verify_password(self, username, password):
        basic = self.conf.get("basicAuth", {})
        if not basic.get("enabled"):
            return True
        if username == basic.get("username") and password == basic.get("password"):
            return True
        logging.warning("flask-profiler authentication failed")
        return False

    def _wrap_app_endpoints(self):
        for endpoint, func in list(self.app.view_functions.items()):
            if endpoint.startswith("flask-profiler."):
                continue
            self.app.view_functions[endpoint] = self.wrap_http_endpoint(func)

    def _register_internal_routes(self):
        url_path = self.conf.get("endpointRoot", "flask-profiler")
        fp = Blueprint(
            "flask-profiler",
            __name__,
            url_prefix="/" + url_path,
            static_folder="static/dist/",
            static_url_path="/static/dist",
        )

        @fp.route("/")
        @self.auth.login_required
        def index():
            return fp.send_static_file("index.html")

        @fp.route("/api/measurements/")
        @self.auth.login_required
        def filter_measurements():
            args = dict(request.args.items())
            measurements = self.collection.filter(args)
            return jsonify({"measurements": list(measurements)})

        @fp.route("/api/measurements/grouped")
        @self.auth.login_required
        def get_measurements_summary():
            args = dict(request.args.items())
            measurements = self.collection.getSummary(args)
            return jsonify({"measurements": list(measurements)})

        @fp.route("/api/measurements/<measurement_id>")
        @self.auth.login_required
        def get_context(measurement_id):
            return jsonify(self.collection.get(measurement_id))

        @fp.route("/api/measurements/timeseries/")
        @self.auth.login_required
        def get_requests_timeseries():
            args = dict(request.args.items())
            return jsonify({"series": self.collection.getTimeseries(args)})

        @fp.route("/api/measurements/methodDistribution/")
        @self.auth.login_required
        def get_method_distribution():
            args = dict(request.args.items())
            return jsonify({"distribution": self.collection.getMethodDistribution(args)})

        @fp.route("/db/dumpDatabase")
        @self.auth.login_required
        def dump_database():
            response = jsonify({"summary": self.collection.getSummary({})})
            response.headers["Content-Disposition"] = "attachment; filename=dump.json"
            return response

        @fp.route("/db/deleteDatabase")
        @self.auth.login_required
        def delete_database():
            response = jsonify({"status": self.collection.truncate()})
            return response

        @fp.after_request
        def x_robots_tag_header(response):
            response.headers["X-Robots-Tag"] = "noindex, nofollow"
            return response

        if "flask-profiler" not in self.app.blueprints:
            self.app.register_blueprint(fp)

    def _is_ignored(self, name):
        return is_ignored(name, self.conf)

    def _should_sample(self):
        if "sampling_function" not in self.conf:
            return True
        sampling_fn = self.conf["sampling_function"]
        if not callable(sampling_fn):
            raise Exception(
                "if sampling_function is provided to flask-profiler via config, it must be callable, refer to: "
                "https://github.com/muatik/flask-profiler#sampling"
            )
        return bool(sampling_fn())

    def _record_call(self, func, name, method, context, args, kwargs):
        if self._is_ignored(name):
            return func(*args, **kwargs)
        if not self._should_sample():
            return func(*args, **kwargs)
        measurement = Measurement(name, args, kwargs, method, context)
        measurement.start()
        try:
            return func(*args, **kwargs)
        finally:
            measurement.stop()
            if self.conf.get("verbose", False):
                pp(measurement.__json__())
            self.collection.insert(measurement.__json__())

    def _invoke_http(self, func, args, kwargs):
        if not self.enabled:
            return func(*args, **kwargs)
        if request.url_rule is not None:
            name = str(request.url_rule)
        else:
            name = func.__name__
        context = {
            "url": request.base_url,
            "args": dict(request.args.items()),
            "form": dict(request.form.items()),
            "body": request.data.decode("utf-8", "strict"),
            "headers": dict(request.headers.items()),
            "func": request.endpoint,
            "ip": request.remote_addr,
        }
        return self._record_call(func, name, request.method, context, args, kwargs)

    def wrap_http_endpoint(self, func):
        if getattr(func, "_flask_profiler_wrapped", False):
            return func

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not self.enabled:
                return func(*args, **kwargs)
            return self._invoke_http(func, args, kwargs)

        wrapper._flask_profiler_wrapped = True
        return wrapper

    def measure(self, func, name, method, context=None):
        if not self.enabled:
            return func

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return self._record_call(func, name, method, context, args, kwargs)

        return wrapper


class Profiler(object):
    def __init__(self, app=None):
        if app is not None:
            self.init_app(app)

    def init_app(self, app):
        state = _ProfilerState(app)
        app.extensions[_EXTENSION_KEY] = state
        global _last_state
        _last_state = state
        return state


_default_profiler = Profiler()


def init_app(app):
    return _default_profiler.init_app(app)


def measure(func, name, method, context=None):
    state = _resolve_state()
    return state.measure(func, name, method, context)


def wrapHttpEndpoint(func):
    state = _resolve_state()
    return state.wrap_http_endpoint(func)


def profile():
    def decorator(func):
        if getattr(func, "_flask_profiler_wrapped", False):
            return func

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            state = _resolve_state(silent=True)
            if state is None or not state.enabled:
                return func(*args, **kwargs)
            return state._invoke_http(func, args, kwargs)

        wrapper._flask_profiler_wrapped = True
        return wrapper

    return decorator


collection = LocalProxy(lambda: _resolve_state().collection)
