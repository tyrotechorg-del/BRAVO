#!/bin/bash

# Database Restore Script for Bravo Music Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bravo Music Database Restore Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please specify backup file${NC}"
    echo "Usage: ./restore.sh <backup-file.gz>"
    exit 1
fi

BACKUP_FILE=$1

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Confirm restore
echo -e "${YELLOW}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure you want to continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Restore cancelled.${NC}"
    exit 0
fi

echo -e "${GREEN}Starting database restore...${NC}"

# Create backup of current database before restore
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CURRENT_BACKUP="backup_before_restore_${TIMESTAMP}.gz"
echo -e "${GREEN}Creating backup of current database...${NC}"
mongodump --uri="${MONGODB_URI}" --archive="backups/${CURRENT_BACKUP}" --gzip

# Restore from backup
echo -e "${GREEN}Restoring from $BACKUP_FILE...${NC}"
mongorestore --uri="${MONGODB_URI}" --archive="${BACKUP_FILE}" --gzip --drop

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database restore completed successfully!${NC}"
    echo -e "${GREEN}Backup of previous database saved to: backups/${CURRENT_BACKUP}${NC}"
else
    echo -e "${RED}❌ Database restore failed!${NC}"
    exit 1
fi

# Verify restore
echo -e "${GREEN}Verifying restore...${NC}"
mongo "${MONGODB_URI}" --eval "db.runCommand({ping: 1})" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database is responsive${NC}"
else
    echo -e "${RED}❌ Database is not responding${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Restore completed!${NC}"
echo -e "${GREEN}========================================${NC}"