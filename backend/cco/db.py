"""Engine and session helpers. Postgres from CCO_DATABASE_URL; tests use SQLite."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from . import config
from .models import Base


def make_engine(url: str | None = None) -> Engine:
    url = url or config.database_url()
    if url.startswith("sqlite"):
        kw: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kw["poolclass"] = StaticPool
        return create_engine(url, **kw)
    return create_engine(url, pool_pre_ping=True)


def init_db(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def make_sessionmaker(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, committed by the handler."""
    with request.app.state.sessionmaker() as s:
        yield s


@contextmanager
def session_scope(url: str | None = None) -> Iterator[Session]:
    """For scripts (seed, CLI): creates tables, commits on success."""
    engine = make_engine(url)
    init_db(engine)
    with make_sessionmaker(engine)() as s:
        yield s
        s.commit()
