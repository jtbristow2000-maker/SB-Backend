"""Initial customer intake schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-31
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "businesses",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("owner_name", sa.String(length=200), nullable=True),
        sa.Column("owner_phone", sa.String(length=40), nullable=True),
        sa.Column("business_phone", sa.String(length=40), nullable=True),
        sa.Column("timezone", sa.String(length=80), nullable=False),
        sa.Column("settings_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_businesses_business_phone"), "businesses", ["business_phone"], unique=False)

    op.create_table(
        "customer_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=200), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address_line1", sa.String(length=255), nullable=True),
        sa.Column("address_line2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=80), nullable=True),
        sa.Column("postal_code", sa.String(length=40), nullable=True),
        sa.Column("source", sa.String(length=80), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("last_contact_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "phone", name="uq_customer_profiles_business_phone"),
    )
    op.create_index("ix_customer_profiles_business_last_contact", "customer_profiles", ["business_id", "last_contact_at"], unique=False)
    op.create_index("ix_customer_profiles_business_status", "customer_profiles", ["business_id", "status"], unique=False)

    op.create_table(
        "call_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("provider_call_id", sa.String(length=120), nullable=True),
        sa.Column("direction", sa.String(length=40), nullable=False),
        sa.Column("call_type", sa.String(length=40), nullable=False),
        sa.Column("from_phone", sa.String(length=40), nullable=True),
        sa.Column("to_phone", sa.String(length=40), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("recording_url", sa.String(length=1000), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("extracted_json", sa.JSON(), nullable=False),
        sa.Column("needs_review", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_call_records_business_provider_call", "call_records", ["business_id", "provider", "provider_call_id"], unique=False)
    op.create_index("ix_call_records_business_started", "call_records", ["business_id", "started_at"], unique=False)

    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("provider_message_id", sa.String(length=120), nullable=True),
        sa.Column("direction", sa.String(length=40), nullable=False),
        sa.Column("channel", sa.String(length=40), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("media_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=80), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_business_provider_message", "messages", ["business_id", "provider", "provider_message_id"], unique=False)
    op.create_index("ix_messages_business_sent", "messages", ["business_id", "sent_at"], unique=False)

    op.create_table(
        "quote_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("source_call_record_id", sa.String(length=36), nullable=True),
        sa.Column("service_requested", sa.String(length=255), nullable=True),
        sa.Column("job_address", sa.String(length=500), nullable=True),
        sa.Column("scope_notes", sa.Text(), nullable=True),
        sa.Column("timeline", sa.String(length=255), nullable=True),
        sa.Column("budget_hint", sa.String(length=255), nullable=True),
        sa.Column("estimated_amount", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_call_record_id"], ["call_records.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quote_drafts_business_status", "quote_drafts", ["business_id", "status"], unique=False)

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("task_type", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_business_due", "tasks", ["business_id", "due_at"], unique=False)
    op.create_index("ix_tasks_business_status", "tasks", ["business_id", "status"], unique=False)

    op.create_table(
        "attachments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("source_type", sa.String(length=80), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("storage_url", sa.String(length=1000), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attachments_business_customer", "attachments", ["business_id", "customer_profile_id"], unique=False)

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("business_id", sa.String(length=36), nullable=False),
        sa.Column("customer_profile_id", sa.String(length=36), nullable=True),
        sa.Column("actor", sa.String(length=80), nullable=False),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("event_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["customer_profile_id"], ["customer_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_events_business_created", "audit_events", ["business_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_events_business_created", table_name="audit_events")
    op.drop_table("audit_events")
    op.drop_index("ix_attachments_business_customer", table_name="attachments")
    op.drop_table("attachments")
    op.drop_index("ix_tasks_business_status", table_name="tasks")
    op.drop_index("ix_tasks_business_due", table_name="tasks")
    op.drop_table("tasks")
    op.drop_index("ix_quote_drafts_business_status", table_name="quote_drafts")
    op.drop_table("quote_drafts")
    op.drop_index("ix_messages_business_sent", table_name="messages")
    op.drop_index("ix_messages_business_provider_message", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_call_records_business_started", table_name="call_records")
    op.drop_index("ix_call_records_business_provider_call", table_name="call_records")
    op.drop_table("call_records")
    op.drop_index("ix_customer_profiles_business_status", table_name="customer_profiles")
    op.drop_index("ix_customer_profiles_business_last_contact", table_name="customer_profiles")
    op.drop_table("customer_profiles")
    op.drop_index(op.f("ix_businesses_business_phone"), table_name="businesses")
    op.drop_table("businesses")
