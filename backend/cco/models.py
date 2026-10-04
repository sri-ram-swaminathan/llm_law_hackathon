"""SQLAlchemy 2 ORM (SPEC §6.2). Domain objects are stored as JSON documents next to the key columns
used for lookups; pydantic models in cco.contracts are the (de)serialisation boundary."""

from __future__ import annotations

from sqlalchemy import JSON, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OrganizationRow(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict] = mapped_column(JSON)


class ProductRow(Base):
    __tablename__ = "products"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    organization_id: Mapped[str] = mapped_column(String, index=True)
    data: Mapped[dict] = mapped_column(JSON)  # Product
    profile: Mapped[dict] = mapped_column(JSON)  # RegulatoryProfile


class ReleaseRow(Base):
    __tablename__ = "releases"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    version: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default="")
    data: Mapped[dict] = mapped_column(JSON)


class ArtifactRow(Base):
    __tablename__ = "artifacts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    release_id: Mapped[str] = mapped_column(String, index=True)
    data: Mapped[dict] = mapped_column(JSON)


class AssessmentRow(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    release_id: Mapped[str] = mapped_column(String, index=True)
    run_id: Mapped[str] = mapped_column(String, index=True)
    started_at: Mapped[str] = mapped_column(String, default="")
    data: Mapped[dict] = mapped_column(JSON)


class FindingRow(Base):
    __tablename__ = "findings"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    assessment_id: Mapped[str] = mapped_column(String, index=True)
    requirement_id: Mapped[str] = mapped_column(String, index=True)
    ord: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict] = mapped_column(JSON)  # Finding (AI values, immutable)


class ReviewRow(Base):
    __tablename__ = "reviews"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    finding_id: Mapped[str] = mapped_column(String, index=True)
    requirement_id: Mapped[str] = mapped_column(String, index=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[str] = mapped_column(String)
    data: Mapped[dict] = mapped_column(JSON)  # Review; only revoked_at is ever updated


class RequirementRow(Base):
    __tablename__ = "requirements"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    pack_version: Mapped[str] = mapped_column(String, default="")
    ord: Mapped[int] = mapped_column(Integer, default=0)
    data: Mapped[dict] = mapped_column(JSON)


class AgentEventRow(Base):
    __tablename__ = "agent_events"
    __table_args__ = (UniqueConstraint("run_id", "seq"),)
    pk: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String, index=True)
    seq: Mapped[int] = mapped_column(Integer)
    data: Mapped[dict] = mapped_column(JSON)
