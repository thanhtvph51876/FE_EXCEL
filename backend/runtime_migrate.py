import psycopg2

from config import settings


def main() -> None:
    with open("schema.sql", encoding="utf-8") as handle:
        sql = handle.read()
    with psycopg2.connect(settings.database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("migration ok")


if __name__ == "__main__":
    main()
