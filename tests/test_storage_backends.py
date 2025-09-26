import time

import pytest


@pytest.mark.usefixtures("app")
def test_storage_round_trip(profiler_state, profiler_collection):
    profiler_collection.truncate()

    def record(name, method, context=None, **kwargs):
        def target(*args, **kw):
            return "ok"

        wrapped = profiler_state.measure(target, name, method, context=context)
        return wrapped(**kwargs)

    record("endpoint-one", "GET", context={"tag": "one"})
    record("endpoint-one", "GET", context={"tag": "two"})
    record("endpoint-two", "POST", context={"tag": "three"})

    entries = list(profiler_collection.filter())
    assert len(entries) == 3
    assert {e["name"] for e in entries} == {"endpoint-one", "endpoint-two"}

    summary = list(profiler_collection.getSummary({"sort": "count,desc"}))
    names = {item["name"] for item in summary}
    assert {"endpoint-one", "endpoint-two"}.issubset(names)
    counts = {item["name"]: item["count"] for item in summary}
    assert counts["endpoint-one"] >= 2

    bounds = {
        "startedAt": time.time() - 10,
        "endedAt": time.time() + 10,
    }

    series = profiler_collection.getTimeseries(bounds)
    assert sum(series.values()) == 3

    distribution = profiler_collection.getMethodDistribution(bounds)
    assert distribution["GET"] >= 2
    assert distribution["POST"] >= 1


@pytest.mark.usefixtures("app")
def test_storage_get_and_delete(profiler_state, profiler_collection):
    profiler_collection.truncate()

    def target():
        return "ok"

    wrapped = profiler_state.measure(target, "detail-endpoint", "GET")
    wrapped()

    entries = list(profiler_collection.filter())
    assert len(entries) == 1
    entry = entries[0]
    identifier = entry.get("id", entry.get("_id"))
    if identifier is not None:
        assert profiler_collection.delete(identifier) is True
        assert list(profiler_collection.filter()) == []

    profiler_collection.truncate()
    assert list(profiler_collection.filter()) == []


@pytest.mark.usefixtures("app")
def test_storage_filter_respects_limit(profiler_state, profiler_collection):
    profiler_collection.truncate()

    total_records = 7

    def record(idx):
        def target():
            return idx

        wrapped = profiler_state.measure(target, f"endpoint-{idx}", "GET")
        assert wrapped() == idx

    for i in range(total_records):
        record(i)

    limited = list(profiler_collection.filter({"limit": 5}))
    assert len(limited) == 5

    remaining = list(profiler_collection.filter({"skip": 5}))
    assert len(remaining) == total_records - 5
