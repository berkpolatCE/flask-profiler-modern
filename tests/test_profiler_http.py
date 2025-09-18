import flask_profiler


def test_auto_wrapped_routes_record_measurements(client, profiler_collection):
    profiler_collection.truncate()
    response = client.get("/api/people/john")
    assert response.status_code == 200
    assert response.data.decode() == "john"

    measurements = list(profiler_collection.filter())
    assert len(measurements) == 1
    entry = measurements[0]
    assert entry["name"] == "/api/people/<firstname>"
    assert entry["method"] == "GET"


def test_routes_registered_after_init_are_not_tracked(client, profiler_collection):
    profiler_collection.truncate()
    response = client.get("/api/without/profiler")
    assert response.status_code == 200
    assert response.data.decode() == "without profiler"

    measurements = list(profiler_collection.filter())
    assert measurements == []


def test_decorated_routes_registered_late_are_tracked(client, profiler_collection):
    profiler_collection.truncate()
    response = client.get("/api/with/profiler/hello?q=1")
    assert response.status_code == 200
    assert response.data.decode() == "with profiler"

    measurements = list(profiler_collection.filter())
    assert len(measurements) == 1
    entry = measurements[0]
    assert entry["name"] == "/api/with/profiler/<message>"
    assert entry["context"]["args"] == {"q": "1"}


def test_ignore_patterns_skip_static_routes(client, profiler_collection):
    profiler_collection.truncate()
    response = client.get("/static/photo/")
    assert response.status_code == 200

    measurements = list(profiler_collection.filter())
    assert measurements == []


def test_measure_function_records_custom_call(app, profiler_collection):
    profiler_collection.truncate()

    def do_wait(seconds):
        return seconds

    wrapped = flask_profiler.measure(do_wait, "do_wait", "call")
    assert wrapped(3) == 3

    measurements = list(profiler_collection.filter())
    assert len(measurements) == 1
    entry = measurements[0]
    assert entry["name"] == "do_wait"
    assert entry["method"] == "call"
