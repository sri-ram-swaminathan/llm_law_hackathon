"""Decorator that records MCP tool calls as run_kind=mcp events (client name only, never the token)."""

from __future__ import annotations

import functools
import inspect
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Callable

from ..contracts.activity import AgentEvent
from .recorder import get_recorder

_SECRET_KEYS = ("token", "authorization", "secret", "password", "api_key", "apikey")


def _safe_args(kwargs: dict) -> str:
    return json.dumps({k: v for k, v in kwargs.items() if not any(x in k.lower() for x in _SECRET_KEYS)},
                      default=str, ensure_ascii=False)


def mcp_recorded(tool: str, client: str | Callable[..., str] = "unknown"):
    """Wrap an MCP handler. `client` is a name or a callable(*args, **kwargs) -> name."""

    def deco(fn):
        def _begin(args, kwargs):
            name = client(*args, **kwargs) if callable(client) else client
            run_id = f"mcp-{uuid.uuid4().hex[:12]}"
            rec = get_recorder()
            rec.record(AgentEvent(run_id=run_id, run_kind="mcp", seq=0, ts=datetime.now(timezone.utc),
                                  type="tool_call", tool=tool, summary=f"{name} called {tool}",
                                  input_preview=_safe_args(kwargs)))
            return rec, run_id, name, time.monotonic()

        def _end(rec, run_id, name, t0, out, err):
            rec.record(AgentEvent(run_id=run_id, run_kind="mcp", seq=0, ts=datetime.now(timezone.utc),
                                  type="tool_result", tool=tool, summary=f"{tool} {'failed' if err else 'ok'} for {name}",
                                  output_preview=None if err else json.dumps(out, default=str)[:4096],
                                  latency_ms=int((time.monotonic() - t0) * 1000), error=err))
            rec.record(AgentEvent(run_id=run_id, run_kind="mcp", seq=0, ts=datetime.now(timezone.utc),
                                  type="run_end", summary="error" if err else "ok"))

        if inspect.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def aw(*a, **kw):
                ctx = _begin(a, kw)
                try:
                    out = await fn(*a, **kw)
                except Exception as e:
                    _end(*ctx, None, f"{type(e).__name__}: {e}")
                    raise
                _end(*ctx, out, None)
                return out
            return aw

        @functools.wraps(fn)
        def w(*a, **kw):
            ctx = _begin(a, kw)
            try:
                out = fn(*a, **kw)
            except Exception as e:
                _end(*ctx, None, f"{type(e).__name__}: {e}")
                raise
            _end(*ctx, out, None)
            return out
        return w

    return deco
