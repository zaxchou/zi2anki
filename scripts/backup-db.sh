#!/bin/bash
# zi2anki PostgreSQL 数据库自动备份脚本
# 每天凌晨 3:00 运行，保留最近 7 天

set -e

BACKUP_DIR="/opt/zi2anki/backups"
DB_NAME="zi2anki"
DB_USER="zi2anki"
PGPASSWORD="zi2anki_pg_2026"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

export PGPASSWORD

# 确保备份目录存在
mkdir -p "$BACKUP_DIR"

# 执行备份并 gzip 压缩
pg_dump -h localhost -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

# 设置权限
chmod 600 "$BACKUP_DIR/$FILENAME"

# 删除过期备份
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成: $FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
