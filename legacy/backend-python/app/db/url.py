from pathlib import Path

from sqlalchemy.engine import make_url


def ensure_database_parent_dir(database_url: str) -> None:
    url = make_url(database_url)
    if not url.drivername.startswith("sqlite") or not url.database or url.database == ":memory:":
        return

    Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)
