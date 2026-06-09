from collections import defaultdict, deque
from time import monotonic

from fastapi import HTTPException, Request, status

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


_local_rate_limiter = InMemoryRateLimiter()


def client_ip(request: Request | None) -> str:
    if request is None:
        return "unknown"
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def enforce_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    if not _local_rate_limiter.hit(key, limit, window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )


def enforce_ip_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    enforce_rate_limit(f"ip:{scope}:{client_ip(request)}", limit, window_seconds)


def enforce_user_rate_limit(user_id: str, scope: str, limit: int, window_seconds: int) -> None:
    enforce_rate_limit(f"user:{scope}:{user_id}", limit, window_seconds)
