"""Assessment pipeline (SPEC §6.4).

Public API:
    prepare_run(sm, release_id, model=None) -> PreparedRun      takes the per-product lock (RunInFlight if busy)
    await execute_run(sm, prep, model=None) -> assessment_id    steps 1-8; always releases the lock
    await run_assessment(release_id, sm, model=None)            both of the above
    run_assessment_sync(session_url, release_id, model=None)    for the CLI (T16)
    MODEL_OVERRIDE                                              inject a pydantic-ai model (tests)
"""

from . import runner
from .runner import (
    PreparedRun,
    RunInFlight,
    ensure_base,
    execute_run,
    lock_holder,
    prepare_run,
    run_assessment,
    run_assessment_sync,
)

__all__ = [
    "PreparedRun", "RunInFlight", "ensure_base", "execute_run", "lock_holder", "prepare_run",
    "run_assessment", "run_assessment_sync", "runner",
]
