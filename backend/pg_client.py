import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from config import settings


try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:  # pragma: no cover - handled at runtime with a clear error.
    psycopg2 = None
    RealDictCursor = None


IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

PRIMARY_KEYS = {
    "api_keys": ["id"],
    "ai_usage_events": ["id"],
    "chat_messages": ["id"],
    "chat_threads": ["id"],
    "coupons": ["code"],
    "checkout_requests": ["id"],
    "feedbacks": ["id"],
    "files": ["id"],
    "jobs": ["id"],
    "job_queue": ["id"],
    "ai_eval_runs": ["id"],
    "ai_quality_metrics": ["id"],
    "api_request_logs": ["id"],
    "operation_logs": ["id"],
    "output_files": ["id"],
    "payment_transactions": ["id"],
    "payment_webhook_events": ["id"],
    "business_metrics": ["id"],
    "plans": ["id"],
    "subscriptions": ["id"],
    "settings": ["key"],
    "saved_workflows": ["id"],
    "system_broadcasts": ["id"],
    "templates": ["id"],
    "user_settings": ["user_id", "key"],
    "user_sessions": ["id"],
    "users": ["id"],
    "workspace_members": ["id"],
    "workspaces": ["id"],
}


def _ident(value: str) -> str:
    if not IDENT_RE.match(value):
        raise ValueError(f"Unsafe SQL identifier: {value}")
    return value


def _columns(value: str) -> str:
    if value.strip() == "*":
        return "*"
    cols = []
    for raw in value.split(","):
        name = raw.strip()
        if not name:
            continue
        cols.append(_ident(name))
    return ", ".join(cols) or "*"


class LocalStorageBucket:
    def __init__(self, bucket: str):
        self.root = Path(settings.local_storage_dir) / bucket
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, path: str) -> Path:
        target = (self.root / path).resolve()
        if not str(target).startswith(str(self.root.resolve())):
            raise ValueError("Unsafe storage path")
        return target

    def upload(self, path: str, file: Any, file_options: dict | None = None):
        target = self._path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(file, bytes):
            content = file
        elif hasattr(file, "read"):
            content = file.read()
        else:
            content = bytes(file)
        target.write_bytes(content)
        return {"path": path}

    def download(self, path: str) -> bytes:
        return self._path(path).read_bytes()

    def remove(self, paths: list[str]):
        for path in paths:
            target = self._path(path)
            if target.exists():
                target.unlink()
        return {"removed": paths}


class LocalStorage:
    def from_(self, bucket: str) -> LocalStorageBucket:
        return LocalStorageBucket(bucket)


class PgQuery:
    def __init__(self, client: "PgClient", table: str):
        self.client = client
        self.table = _ident(table)
        self.action = "select"
        self.select_cols = "*"
        self.payload = None
        self.filters: list[tuple[str, str, Any]] = []
        self.order_clause = ""
        self.limit_count: int | None = None
        self.offset_count: int | None = None

    def select(self, columns: str = "*"):
        self.action = "select"
        self.select_cols = _columns(columns)
        return self

    def insert(self, payload: Any):
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload: dict):
        self.action = "update"
        self.payload = payload
        return self

    def upsert(self, payload: dict):
        self.action = "upsert"
        self.payload = payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def eq(self, column: str, value: Any):
        self.filters.append((_ident(column), "=", value))
        return self

    def neq(self, column: str, value: Any):
        self.filters.append((_ident(column), "<>", value))
        return self

    def gte(self, column: str, value: Any):
        self.filters.append((_ident(column), ">=", value))
        return self

    def lte(self, column: str, value: Any):
        self.filters.append((_ident(column), "<=", value))
        return self

    def in_(self, column: str, values: list[Any]):
        self.filters.append((_ident(column), "IN", values))
        return self

    def order(self, column: str, desc: bool = False):
        self.order_clause = f" ORDER BY {_ident(column)} {'DESC' if desc else 'ASC'}"
        return self

    def limit(self, count: int):
        self.limit_count = count
        return self

    def range(self, start: int, end: int):
        self.offset_count = start
        self.limit_count = max(0, end - start + 1)
        return self

    def _where(self, params: list[Any]) -> str:
        if not self.filters:
            return ""
        parts = []
        for column, op, value in self.filters:
            if op == "IN":
                values = list(value or [])
                if not values:
                    parts.append("FALSE")
                    continue
                placeholders = ", ".join(["%s"] * len(values))
                parts.append(f"{column} IN ({placeholders})")
                params.extend(values)
            else:
                parts.append(f"{column} {op} %s")
                params.append(value)
        return " WHERE " + " AND ".join(parts)

    def execute(self):
        if self.action == "select":
            return self._execute_select()
        if self.action == "insert":
            return self._execute_insert()
        if self.action == "update":
            return self._execute_update()
        if self.action == "upsert":
            return self._execute_upsert()
        if self.action == "delete":
            return self._execute_delete()
        raise ValueError(f"Unsupported action: {self.action}")

    def _execute_select(self):
        params: list[Any] = []
        sql = f"SELECT {self.select_cols} FROM {self.table}{self._where(params)}{self.order_clause}"
        if self.limit_count is not None:
            sql += " LIMIT %s"
            params.append(self.limit_count)
        if self.offset_count is not None:
            sql += " OFFSET %s"
            params.append(self.offset_count)
        rows = self.client.fetch(sql, params)
        return SimpleNamespace(data=rows)

    def _execute_insert(self):
        rows = self.payload if isinstance(self.payload, list) else [self.payload]
        if not rows:
            return SimpleNamespace(data=[])
        result = []
        for row in rows:
            cols = [_ident(col) for col in row.keys()]
            values = list(row.values())
            placeholders = ", ".join(["%s"] * len(cols))
            sql = f"INSERT INTO {self.table} ({', '.join(cols)}) VALUES ({placeholders}) RETURNING *"
            result.extend(self.client.fetch(sql, values, commit=True))
        return SimpleNamespace(data=result)

    def _execute_update(self):
        params: list[Any] = []
        sets = []
        for col, value in self.payload.items():
            sets.append(f"{_ident(col)} = %s")
            params.append(value)
        sql = f"UPDATE {self.table} SET {', '.join(sets)}{self._where(params)} RETURNING *"
        return SimpleNamespace(data=self.client.fetch(sql, params, commit=True))

    def _execute_upsert(self):
        row = self.payload
        keys = PRIMARY_KEYS.get(self.table, ["id"])
        cols = [_ident(col) for col in row.keys()]
        values = list(row.values())
        placeholders = ", ".join(["%s"] * len(cols))
        update_cols = [col for col in cols if col not in keys]
        updates = ", ".join([f"{col} = EXCLUDED.{col}" for col in update_cols])
        if updates:
            conflict = f"DO UPDATE SET {updates}"
        else:
            conflict = "DO NOTHING"
        sql = (
            f"INSERT INTO {self.table} ({', '.join(cols)}) VALUES ({placeholders}) "
            f"ON CONFLICT ({', '.join(keys)}) {conflict} RETURNING *"
        )
        return SimpleNamespace(data=self.client.fetch(sql, values, commit=True))

    def _execute_delete(self):
        params: list[Any] = []
        sql = f"DELETE FROM {self.table}{self._where(params)} RETURNING *"
        return SimpleNamespace(data=self.client.fetch(sql, params, commit=True))


class PgClient:
    storage = LocalStorage()

    def __init__(self, database_url: str):
        if psycopg2 is None:
            raise RuntimeError("Thiếu psycopg2-binary. Chạy: pip install -r backend/requirements.txt")
        self.database_url = database_url

    def table(self, name: str) -> PgQuery:
        return PgQuery(self, name)

    def fetch(self, sql: str, params: list[Any] | None = None, commit: bool = False):
        with psycopg2.connect(self.database_url, cursor_factory=RealDictCursor) as conn:
            with conn.cursor() as cur:
                cur.execute(sql, params or [])
                try:
                    rows = [dict(row) for row in cur.fetchall()]
                except psycopg2.ProgrammingError:
                    rows = []
            if commit:
                conn.commit()
        return rows
