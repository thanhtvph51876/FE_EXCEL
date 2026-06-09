from datetime import date

import psycopg2
from fastapi import HTTPException, status

from config import settings
from dependencies import tier_limit


def _feature_limit(tier: str) -> int:
    if tier == "enterprise":
        return 99999
    return tier_limit(tier)


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
    estimated_cost = round(((input_tokens + output_tokens) / 1000) * 0.00035, 6)
    with psycopg2.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
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
        conn.commit()


async def check_and_increment(user_id: str, db, feature_name: str = "ai", token_count: int = 0) -> bool:
    today = date.today()
    with psycopg2.connect(settings.database_url) as conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT id, usage_count, usage_limit, tier FROM users WHERE id = %s FOR UPDATE", (user_id,))
                user = cur.fetchone()
                if not user:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy người dùng.")

                _, usage_count, usage_limit, tier = user
                tier = tier or "free"
                limit = int(usage_limit or _feature_limit(tier))
                if int(usage_count or 0) >= limit:
                    record_ai_usage_event(user_id, tier, feature_name, "quota_exceeded")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI usage limit reached for your current plan.",
                    )

                cur.execute(
                    """
                    INSERT INTO ai_usage (user_id, tier, usage_date, feature_name, request_count, token_count)
                    VALUES (%s, %s, %s, %s, 0, 0)
                    ON CONFLICT (user_id, usage_date, feature_name) DO UPDATE
                    SET tier = EXCLUDED.tier, updated_at = NOW()
                    RETURNING id
                    """,
                    (user_id, tier, today, feature_name[:50]),
                )
                usage_id = cur.fetchone()[0]
                cur.execute("SELECT request_count FROM ai_usage WHERE id = %s FOR UPDATE", (usage_id,))
                request_count = int(cur.fetchone()[0] or 0)
                if request_count >= limit:
                    record_ai_usage_event(user_id, tier, feature_name, "quota_exceeded")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="AI usage limit reached for your current plan.",
                    )

                cur.execute(
                    """
                    UPDATE ai_usage
                    SET request_count = request_count + 1,
                        token_count = token_count + %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (int(token_count or 0), usage_id),
                )
                cur.execute("UPDATE users SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = %s", (user_id,))
            conn.commit()
            record_ai_usage_event(user_id, tier, feature_name, "success", input_tokens=token_count)
            return True
        except HTTPException:
            conn.rollback()
            raise


async def mark_failed_usage(user_id: str, feature_name: str) -> None:
    today = date.today()
    with psycopg2.connect(settings.database_url) as conn:
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


async def reset_daily_quota(db) -> int:
    result = db.table("users").update({"usage_count": 0}).neq("id", "00000000-0000-0000-0000-000000000000").execute()
    count = len(result.data) if result.data else 0
    print(f"Daily quota reset completed for {count} users.")
    return count
