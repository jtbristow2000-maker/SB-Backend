from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def new_uuid() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class Business(TimestampMixin, Base):
    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(200))
    owner_phone: Mapped[str | None] = mapped_column(String(40))
    business_phone: Mapped[str | None] = mapped_column(String(40), index=True)
    timezone: Mapped[str] = mapped_column(String(80), default="America/New_York", nullable=False)
    settings_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    profiles: Mapped[list[CustomerProfile]] = relationship(back_populates="business", cascade="all, delete-orphan")
    calls: Mapped[list[CallRecord]] = relationship(back_populates="business", cascade="all, delete-orphan")
    messages: Mapped[list[Message]] = relationship(back_populates="business", cascade="all, delete-orphan")
    quote_drafts: Mapped[list[QuoteDraft]] = relationship(back_populates="business", cascade="all, delete-orphan")
    tasks: Mapped[list[Task]] = relationship(back_populates="business", cascade="all, delete-orphan")
    attachments: Mapped[list[Attachment]] = relationship(back_populates="business", cascade="all, delete-orphan")
    audit_events: Mapped[list[AuditEvent]] = relationship(back_populates="business", cascade="all, delete-orphan")


class CustomerProfile(TimestampMixin, Base):
    __tablename__ = "customer_profiles"
    __table_args__ = (
        UniqueConstraint("business_id", "phone", name="uq_customer_profiles_business_phone"),
        Index("ix_customer_profiles_business_status", "business_id", "status"),
        Index("ix_customer_profiles_business_last_contact", "business_id", "last_contact_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(80))
    postal_code: Mapped[str | None] = mapped_column(String(40))
    source: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(80), default="new", nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    business: Mapped[Business] = relationship(back_populates="profiles")
    calls: Mapped[list[CallRecord]] = relationship(back_populates="customer_profile")
    messages: Mapped[list[Message]] = relationship(back_populates="customer_profile")
    quote_drafts: Mapped[list[QuoteDraft]] = relationship(back_populates="customer_profile")
    tasks: Mapped[list[Task]] = relationship(back_populates="customer_profile")
    attachments: Mapped[list[Attachment]] = relationship(back_populates="customer_profile")
    audit_events: Mapped[list[AuditEvent]] = relationship(back_populates="customer_profile")


class CallRecord(TimestampMixin, Base):
    __tablename__ = "call_records"
    __table_args__ = (
        Index("ix_call_records_business_provider_call", "business_id", "provider", "provider_call_id"),
        Index("ix_call_records_business_started", "business_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(80), default="sandbox", nullable=False)
    provider_call_id: Mapped[str | None] = mapped_column(String(120))
    direction: Mapped[str] = mapped_column(String(40), nullable=False)
    call_type: Mapped[str] = mapped_column(String(40), nullable=False)
    from_phone: Mapped[str | None] = mapped_column(String(40))
    to_phone: Mapped[str | None] = mapped_column(String(40))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    recording_url: Mapped[str | None] = mapped_column(String(1000))
    transcript: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    extracted_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    business: Mapped[Business] = relationship(back_populates="calls")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="calls")
    quote_drafts: Mapped[list[QuoteDraft]] = relationship(back_populates="source_call_record")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_business_provider_message", "business_id", "provider", "provider_message_id"),
        Index("ix_messages_business_sent", "business_id", "sent_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(80), default="sandbox", nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(120))
    direction: Mapped[str] = mapped_column(String(40), nullable=False)
    channel: Mapped[str] = mapped_column(String(40), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    media_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(80), default="received", nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    business: Mapped[Business] = relationship(back_populates="messages")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="messages")


class QuoteDraft(TimestampMixin, Base):
    __tablename__ = "quote_drafts"
    __table_args__ = (Index("ix_quote_drafts_business_status", "business_id", "status"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    source_call_record_id: Mapped[str | None] = mapped_column(ForeignKey("call_records.id", ondelete="SET NULL"))
    service_requested: Mapped[str | None] = mapped_column(String(255))
    job_address: Mapped[str | None] = mapped_column(String(500))
    scope_notes: Mapped[str | None] = mapped_column(Text)
    timeline: Mapped[str | None] = mapped_column(String(255))
    budget_hint: Mapped[str | None] = mapped_column(String(255))
    estimated_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(80), default="draft", nullable=False)

    business: Mapped[Business] = relationship(back_populates="quote_drafts")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="quote_drafts")
    source_call_record: Mapped[CallRecord | None] = relationship(back_populates="quote_drafts")


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_business_status", "business_id", "status"),
        Index("ix_tasks_business_due", "business_id", "due_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    task_type: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(80), default="open", nullable=False)

    business: Mapped[Business] = relationship(back_populates="tasks")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="tasks")


class Attachment(Base):
    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachments_business_customer", "business_id", "customer_profile_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    source_type: Mapped[str] = mapped_column(String(80), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(120))
    storage_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    business: Mapped[Business] = relationship(back_populates="attachments")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="attachments")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_business_created", "business_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False)
    customer_profile_id: Mapped[str | None] = mapped_column(ForeignKey("customer_profiles.id", ondelete="SET NULL"))
    actor: Mapped[str] = mapped_column(String(80), nullable=False)
    event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    event_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    business: Mapped[Business] = relationship(back_populates="audit_events")
    customer_profile: Mapped[CustomerProfile | None] = relationship(back_populates="audit_events")
