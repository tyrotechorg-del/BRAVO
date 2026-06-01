#!/bin/bash

# Database Seeding Script for Bravo Music Platform

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bravo Music Database Seeding Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if MongoDB is running
echo -e "${GREEN}Checking MongoDB connection...${NC}"
if ! mongo --eval "db.runCommand({ping:1})" > /dev/null 2>&1; then
    echo -e "${YELLOW}MongoDB is not running. Please start MongoDB first.${NC}"
    exit 1
fi

# Run seed script
echo -e "${GREEN}Seeding database...${NC}"
node backend/scripts/seedData.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database seeding completed successfully!${NC}"
else
    echo -e "${RED}❌ Database seeding failed!${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Seeding completed!${NC}"
echo -e "${GREEN}========================================${NC}"