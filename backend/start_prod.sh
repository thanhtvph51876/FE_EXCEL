#!/bin/bash
# Script khởi động backend cho môi trường production
# Chạy: bash backend/start_prod.sh

set -e

cd "$(dirname "$0")"

# Kiểm tra .env tồn tại
if [ ! -f ".env" ]; then
    echo "ERROR: .env không tồn tại. Copy từ .env.example và điền giá trị thực."
    exit 1
fi

export $(grep -v '^#' .env | xargs)

# Kiểm tra biến bắt buộc
: "${JWT_SECRET:?ERROR: JWT_SECRET chưa được set}"
: "${DATABASE_URL:?ERROR: DATABASE_URL chưa được set (hoặc DB_HOST/DB_NAME/DB_USER/DB_PASSWORD)}"
: "${CORS_ORIGINS:?ERROR: CORS_ORIGINS chưa được set}"

echo "Starting ExcelAI backend (production)..."
echo "  Environment : ${ENVIRONMENT:-production}"
echo "  DB pool     : min=${DB_POOL_MIN:-2} max=${DB_POOL_MAX:-20}"
echo "  Gemini conc : ${GEMINI_MAX_CONCURRENCY:-8}"

exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8002}" \
    --workers 1 \
    --limit-concurrency 200 \
    --timeout-keep-alive 30 \
    --log-level warning \
    --no-access-log
