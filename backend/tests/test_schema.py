from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.db import models
from app.db.base import Base


def test_metadata_contains_first_backend_schema() -> None:
    expected_tables = {
        "businesses",
        "customer_profiles",
        "call_records",
        "messages",
        "quote_drafts",
        "tasks",
        "attachments",
        "audit_events",
    }

    assert expected_tables.issubset(Base.metadata.tables.keys())


def test_schema_can_create_and_link_core_records(sqlite_engine) -> None:
    Base.metadata.create_all(sqlite_engine)
    inspector = inspect(sqlite_engine)

    assert "businesses" in inspector.get_table_names()
    assert "customer_profiles" in inspector.get_table_names()
    assert "call_records" in inspector.get_table_names()

    with Session(sqlite_engine) as session:
        business = models.Business(name="Demo Detailers", business_phone="+15551234567")
        profile = models.CustomerProfile(
            business=business,
            display_name="Taylor Customer",
            phone="+15557654321",
            source="missed_call",
        )
        call = models.CallRecord(
            business=business,
            customer_profile=profile,
            provider="sandbox",
            direction="inbound",
            call_type="missed",
            from_phone=profile.phone,
            to_phone=business.business_phone,
        )
        task = models.Task(
            business=business,
            customer_profile=profile,
            task_type="callback",
            title="Call Taylor Customer back",
        )
        audit_event = models.AuditEvent(
            business=business,
            customer_profile=profile,
            actor="system",
            event_type="profile.created",
            event_json={"source": "test"},
        )

        session.add_all([business, profile, call, task, audit_event])
        session.commit()

        saved_profile = session.query(models.CustomerProfile).one()
        assert saved_profile.business_id == business.id
        assert saved_profile.calls[0].call_type == "missed"
        assert saved_profile.tasks[0].status == "open"
        assert saved_profile.audit_events[0].event_json == {"source": "test"}
