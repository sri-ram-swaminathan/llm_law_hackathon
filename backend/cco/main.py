"""FastAPI app. One uvicorn worker; routers mounted under /api with the deploy token; /healthz open."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .api import (
    assessments,
    demo,
    findings_read,
    github_ci,
    fixplan,
    product,
    provisions,
    readiness,
    releases_read,
    releases_write,
    reviews,
    runs,
    search,
)
from .auth import load_token, require_token
from .db import init_db, make_engine, make_sessionmaker
from .mcp import server as mcp_server

log = logging.getLogger("cco")

ROUTERS = [
    product.router,
    releases_read.router,
    releases_write.router,
    assessments.router,
    readiness.router,
    findings_read.router,
    reviews.router,
    runs.router,
    fixplan.router,
    provisions.router,
    search.router,
    demo.router,
    github_ci.router,
]


def create_app(database_url: str | None = None) -> FastAPI:
    """Tables are created in the lifespan (use `with TestClient(app)` in tests); import never touches the DB."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(app.state.engine)
        yield

    app = FastAPI(title="CCOmmit API", version="0.1.0", lifespan=lifespan)
    app.state.engine = make_engine(database_url)
    app.state.sessionmaker = make_sessionmaker(app.state.engine)
    app.state.deploy_token = load_token()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for r in ROUTERS:
        app.include_router(r, prefix="/api", dependencies=[Depends(require_token)])
    app.mount("/mcp", mcp_server.app)  # token check lives in the MCP app (T15)

    @app.get("/healthz", tags=["ops"])
    def healthz():
        return {"status": "ok"}

    return app


app = create_app()
