/**
 * The Python half of the harness, as source.
 *
 * The seed challenges' Python tests are plain `assert` inside `def test_*`
 * functions, so there is no `expect` to provide — the runner just collects
 * `test_*` and runs them. A `SyntaxError` becomes a clean `compile_error`
 * result instead of an opaque NZEC, which matters because a broken submission
 * is a normal outcome here, not an exception.
 *
 * Same two jobs as the JS side: mark hidden tests, measure in-process.
 */

export const HARNESS_PY = String.raw`
import json as __json
import time as __time

__tests = []
__seen = set()

def hidden_test(fn):
    """Marks a test as hidden. Hidden tests carry the 50-point Correctness
    component (PRD FR8) and their names are redacted before the player sees
    their own results, so the suite cannot be enumerated from the UI."""
    if id(fn) not in __seen:
        __seen.add(id(fn))
        __tests.append({"name": fn.__name__, "fn": fn, "hidden": True})
    return fn

def __run():
    results = []
    passed = 0
    started_at = __time.perf_counter()

    for t in __tests:
        try:
            t["fn"]()
            passed += 1
            results.append({"name": t["name"], "hidden": t["hidden"], "passed": True})
        except AssertionError:
            results.append({"name": t["name"], "hidden": t["hidden"], "passed": False, "error": "assertion failed"})
        except Exception as exc:
            results.append({
                "name": t["name"],
                "hidden": t["hidden"],
                "passed": False,
                "error": (type(exc).__name__ + ": " + str(exc))[:300],
            })

    runtime_ms = (__time.perf_counter() - started_at) * 1000
    print("__CR__" + __json.dumps({
        "passed": passed,
        "total": len(__tests),
        "hiddenTotal": sum(1 for t in __tests if t["hidden"]),
        "hiddenPassed": sum(1 for r in results if r["hidden"] and r["passed"]),
        "runtimeMs": round(runtime_ms, 2),
        "results": results,
    }))

    # Deliberately exits 0 even when tests fail — see the note in harness/js.ts.
    # A non-zero exit reads as NZEC, which is indistinguishable from a crash.

# test_* functions are public; @hidden_test ones are hidden. Decorators run at
# definition time, so collect the public ones here, after the test code is loaded.
def __collect_public():
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn) and id(fn) not in __seen:
            __seen.add(id(fn))
            __tests.append({"name": name, "fn": fn, "hidden": False})
`
