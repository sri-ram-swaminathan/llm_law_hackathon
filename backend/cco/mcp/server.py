"""MCP server (Streamable HTTP, stateless) mounted at /mcp by main.py.

Auth: `Authorization: Bearer $CCO_MCP_TOKEN` (constant-time compare). The SDK session manager normally needs the
host app's lifespan; main.py does not run sub-app lifespans, so each request runs a short-lived stateless manager.
"""

from __future__ import annotations

import contextvars
import hmac
import json
import logging

from mcp.server.mcpserver import MCPServer
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

from .. import config
from ..activity import mcp_recorded, recorder, set_recorder_sessionmaker
from . import tools

log = logging.getLogger("cco.mcp")
DEFAULT_MCP_TOKEN = "dev-mcp-token"

_sm: contextvars.ContextVar = contextvars.ContextVar("cco_mcp_sessionmaker")
_client: contextvars.ContextVar[str] = contextvars.ContextVar("cco_mcp_client", default="unknown")

mcp = MCPServer("ccommit", instructions="CCOmmit release-compliance gate. AI pre-assessment, not legal advice.")


def _name() -> str:
    return _client.get()


def _run(fn, *a, **kw):
    with _sm.get()() as s:
        return fn(s, *a, **kw)


@mcp.tool()
@mcp_recorded("get_release_readiness", client=lambda *a, **k: _name())
def get_release_readiness(version: str | None = None) -> dict:
    """Launch gate, counts, labels and changes-since-previous for a release (default: latest assessed)."""
    return _run(tools.get_release_readiness, version)


@mcp.tool()
@mcp_recorded("list_findings", client=lambda *a, **k: _name())
def list_findings(version: str | None = None, severity: str | None = None, conclusion: str | None = None) -> list[dict]:
    """List findings of a release, optionally filtered by severity (blocker|high|medium|low) and conclusion."""
    return _run(tools.list_findings, version, severity, conclusion)


@mcp.tool()
@mcp_recorded("get_finding", client=lambda *a, **k: _name())
def get_finding(id: str) -> dict:
    """One finding with evidence, citations, requirement and legal provisions."""
    return _run(tools.get_finding, id)


@mcp.tool()
@mcp_recorded("get_remediation_plan", client=lambda *a, **k: _name())
def get_remediation_plan(version: str | None = None) -> str:
    """The deterministic fix plan (Markdown) for a release; identical to the REST fix-plan.md."""
    return _run(tools.get_remediation_plan, version)


def _expected_token() -> str:
    tok = config.mcp_token()
    if not tok:
        log.warning("CCO_MCP_TOKEN is not set; using the insecure default %r", DEFAULT_MCP_TOKEN)
        return DEFAULT_MCP_TOKEN
    return tok


def _authorized(scope) -> bool:
    auth = dict(scope["headers"]).get(b"authorization", b"").decode("latin-1")
    scheme, _, given = auth.partition(" ")
    return scheme.lower() == "bearer" and hmac.compare_digest(given.encode(), _expected_token().encode())


async def _reject(send):
    body = json.dumps({"detail": "invalid or missing MCP token"}).encode()
    await send({"type": "http.response.start", "status": 401, "headers": [
        (b"content-type", b"application/json"), (b"www-authenticate", b"Bearer"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


async def app(scope, receive, send):
    if scope["type"] != "http":
        return
    if scope["method"] != "POST":  # stateless mode: no GET stream / DELETE session
        await send({"type": "http.response.start", "status": 405, "headers": [(b"allow", b"POST"), (b"content-length", b"0")]})
        return await send({"type": "http.response.body", "body": b""})
    if not _authorized(scope):
        return await _reject(send)
    headers = dict(scope["headers"])
    _client.set(headers.get(b"x-client-name", headers.get(b"user-agent", b"unknown")).decode("latin-1")[:80])
    sm = scope["app"].state.sessionmaker
    _sm.set(sm)
    if recorder._sm is not sm:  # bind activity events to this app's DB
        set_recorder_sessionmaker(sm)
    # The mount strips "/mcp"; the SDK handler serves whatever path it is given.
    manager = StreamableHTTPSessionManager(app=mcp._lowlevel_server, stateless=True, json_response=True)
    async with manager.run():
        await manager.handle_request(scope, receive, send)
