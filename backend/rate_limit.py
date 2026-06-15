from collections import defaultdict, deque
from time import monotonic, time

from fastapi import HTTPException, Request, status

from config import settings
from pg_client import _get_pool

try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
    SLOWAPI_AVAILABLE = True
except Exception:
    SLOWAPI_AVAILABLE = False
    RateLimitExceeded = None
    _rate_limit_exceeded_handler = None

    class _NoopLimiter:
        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

    limiter = _NoopLimiter()


class InMemoryRateLimiter:
    def __init__(self):
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        now = monotonic()
        bucket = self._buckets[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


class PostgresRateLimiter:
    def __init__(self):
        self._ready = False

    def _ensure_table(self) -> None:
        if self._ready:
            return
        pool = _get_pool(settings.database_url)
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
                        key VARCHAR(255) NOT NULL,
                        window_start BIGINT NOT NULL,
                        window_seconds INT NOT NULL,
                        hit_count INT NOT NULL DEFAULT 0,
                        updated_at TIMESTAMPTZ DEFAULT NOW(),
                        PRIMARY KEY (key, window_start)
                    )
                    """
                )
                cur.execute("CREATE INDEX IF NOT EXISTS rate_limit_buckets_updated_idx ON rate_limit_buckets(updated_at)")
            conn.commit()
            self._ready = True
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)

    def hit(self, key: str, limit: int, window_seconds: int) -> bool:
        self._ensure_table()
        window_start = int(time()) // int(window_seconds)
        pool = _get_pool(settings.database_url)
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO rate_limit_buckets (key, window_start, window_seconds, hit_count, updated_at)
                    VALUES (%s, %s, %s, 1, NOW())
                    ON CONFLICT (key, window_start) DO UPDATE
                    SET hit_count = CASE
                            WHEN rate_limit_buckets.hit_count < %s THEN rate_limit_buckets.hit_count + 1
                            ELSE rate_limit_buckets.hit_count
                        END,
                        updated_at = NOW()
                    RETURNING hit_count
                    """,
                    (key[:255], window_start, int(window_seconds), int(limit)),
                )
                row = cur.fetchone()
            conn.commit()
            return bool(row and int(row["hit_count"] or 0) <= int(limit))
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)


_local_rate_limiter = InMemoryRateLimiter()
_shared_rate_limiter = PostgresRateLimiter()


def client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    peer = request.client.host if request.client else "unknown"
    if peer in settings.trusted_proxy_ip_set:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return peer


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    try:
        allowed = _shared_rate_limiter.hit(key, limit, window_seconds) if settings.database_url else _local_rate_limiter.hit(key, limit, window_seconds)
    except Exception:
        allowed = _local_rate_limiter.hit(key, limit, window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )


def enforce_ip_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    enforce_rate_limit(f"ip:{scope}:{client_ip(request)}", limit, window_seconds)


def enforce_user_rate_limit(user_id: str, scope: str, limit: int, window_seconds: int) -> None:
    enforce_rate_limit(f"user:{scope}:{user_id}", limit, window_seconds)
