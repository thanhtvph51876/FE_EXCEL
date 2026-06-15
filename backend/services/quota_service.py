import asyncio
from contextlib import contextmanager
from datetime import date

from fastapi import HTTPException, status

from config import settings
from dependencies import tier_limit
from pg_client import _get_pool


@contextmanager
def _pool_conn():
    pool = _get_pool(settings.database_url)
    conn = pool.getconn()
    try:
        yield conn
    finally:
        pool.putconn(conn)


def _feature_limit(tier: str) -> int:
    if tier == "enterprise":
        return 99999
    return tier_limit(tier)


def _insert_ai_usage_event(
    cur,
    user_id: str | None,
    tier: str,
    feature_name: str,
    status_value: str,
    file_id: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
) -> None:
    estimated_cost = round(((input_tokens + output_tokens) / 1000) * 0.00035, 6)
    cur.execute(
        """
        INSERT INTO ai_usage_events
            (user_id, tier, feature_name, model, input_tokens, output_tokens, estimated_cost, status, latency_ms, file_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            tier or "free",
            feature_name[:50],
            settings.gemini_model or "",
            int(input_tokens or 0),
            int(output_tokens or 0),
            estimated_cost,
            status_value,
            int(latency_ms or 0),
            file_id,
        ),
    )


def record_ai_usage_event(
    user_id: str | None,
    tier: str,
    feature_name: str,
    status_value: str,
    file_id: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: int = 0,
) -> None:
    try:
        with _pool_conn() as conn:
            with conn.cursor() as cur:
                _insert_ai_usage_event(cur, user_id, tier, feature_name, status_value, file_id, input_tokens, output_tokens, latency_ms)
            conn.commit()
    except Exception:
        pass  # Non-critical telemetry; do not fail the caller


def _check_and_increment_sync(user_id: str, feature_name: str = "ai", token_count: int = 0) -> bool:
    today = date.today()
    feature = feature_name[:50]
    with _pool_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, usage_count, usage_limit, tier FROM users WHERE id = %s FOR UPDATE", (user_id,))
                user = cur.fetchone()
                if not user:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

                usage_limit = user["usage_limit"]
                tier = user["tier"] or "free"
                limit = int(usage_limit or _feature_limit(tier))

                cur.execute(
                    """
                    INSERT INTO ai_usage (user_id, tier, usage_date, feature_name, request_count, token_count)
                    VALUES (%s, %s, %s, %s, 0, 0)
                    ON CONFLICT (user_id, usage_date, feature_name) DO UPDATE
                    SET tier = EXCLUDED.tier, updated_at = NOW()
                    RETURNING id
                    """,
                    (user_id, tier, today, feature),
                )
                usage_row = cur.fetchone()
                usage_id = usage_row["id"]
                cur.execute(
                    """
                    UPDATE ai_usage
                    SET request_count = request_count + 1,
                        token_count = token_count + %s,
                        updated_at = NOW()
                    WHERE id = %s AND request_count < %s
                    RETURNING request_count
                    """,
                    (int(token_count or 0), usage_id, limit),
                )
                incremented = cur.fetchone()
                if not incremented:
                    _insert_ai_usage_event(cur, user_id, tier, feature, "quota_exceeded")
                    conn.commit()
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI usage limit reached for your current plan.",
                    )
                cur.execute("UPDATE users SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = %s", (user_id,))
                _insert_ai_usage_event(cur, user_id, tier, feature, "success", input_tokens=token_count)
            conn.commit()
            return True
        except HTTPException:
            conn.rollback()
            raise
        except Exception:
            conn.rollback()
            raise


async def check_and_increment(user_id: str, db, feature_name: str = "ai", token_count: int = 0) -> bool:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _check_and_increment_sync, user_id, feature_name, token_count)


def _mark_failed_usage_sync(user_id: str, feature_name: str) -> None:
    today = date.today()
    with _pool_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_usage (user_id, tier, usage_date, feature_name, failed_count)
                SELECT id, COALESCE(tier, 'free'), %s, %s, 1
                FROM users
                WHERE id = %s
                ON CONFLICT (user_id, usage_date, feature_name) DO UPDATE
                SET failed_count = ai_usage.failed_count + 1, updated_at = NOW()
                """,
                (today, feature_name[:50], user_id),
            )
        conn.commit()


async def mark_failed_usage(user_id: str, feature_name: str) -> None:
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(None, _mark_failed_usage_sync, user_id, feature_name)
    except Exception:
        pass  # Non-critical; do not fail the main request flow


def _reset_daily_quota_sync() -> int:
    today = date.today()
    with _pool_conn() as conn:
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE users
                    SET usage_count = 0
                    WHERE id <> %s
                    """,
                    ("00000000-0000-0000-0000-000000000000",),
                )
                count = cur.rowcount
                cur.execute(
                    """
                    DELETE FROM ai_usage
                    WHERE usage_date < %s
                    """,
                    (today,),
                )
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    print(f"Daily quota reset completed for {count} users.")
    return count


async def reset_daily_quota(db) -> int:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _reset_daily_quota_sync)
