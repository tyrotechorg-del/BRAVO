#!/bin/bash

# System Monitoring Script for Bravo Music Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Bravo Music System Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# System Information
echo -e "${GREEN}System Information:${NC}"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Date: $(date)"
echo

# CPU Usage
echo -e "${GREEN}CPU Usage:${NC}"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo -e "${RED}CPU: ${CPU_USAGE}% (CRITICAL)${NC}"
else
    echo -e "${GREEN}CPU: ${CPU_USAGE}%${NC}"
fi
echo

# Memory Usage
echo -e "${GREEN}Memory Usage:${NC}"
MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
MEM_FREE=$(free -m | awk '/^Mem:/{print $4}')
MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))

if [ $MEM_PERCENT -gt 90 ]; then
    echo -e "${RED}Memory: ${MEM_PERCENT}% (CRITICAL)${NC}"
elif [ $MEM_PERCENT -gt 75 ]; then
    echo -e "${YELLOW}Memory: ${MEM_PERCENT}% (WARNING)${NC}"
else
    echo -e "${GREEN}Memory: ${MEM_PERCENT}%${NC}"
fi
echo "Total: ${MEM_TOTAL}MB | Used: ${MEM_USED}MB | Free: ${MEM_FREE}MB"
echo

# Disk Usage
echo -e "${GREEN}Disk Usage:${NC}"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo -e "${RED}Disk: ${DISK_USAGE}% (CRITICAL)${NC}"
elif [ $DISK_USAGE -gt 75 ]; then
    echo -e "${YELLOW}Disk: ${DISK_USAGE}% (WARNING)${NC}"
else
    echo -e "${GREEN}Disk: ${DISK_USAGE}%${NC}"
fi
df -h /
echo

# Docker Containers
echo -e "${GREEN}Docker Containers:${NC}"
if command -v docker &> /dev/null; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "Docker not installed"
fi
echo

# Node.js Backend
echo -e "${GREEN}Backend Status:${NC}"
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    # Check API health
    if curl -s -f http://localhost:5000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is responding${NC}"
    else
        echo -e "${RED}✗ API is not responding${NC}"
    fi
else
    echo -e "${RED}✗ Backend is not running${NC}"
fi
echo

# MongoDB Status
echo -e "${GREEN}MongoDB Status:${NC}"
if pgrep -f mongod > /dev/null; then
    echo -e "${GREEN}✓ MongoDB is running${NC}"
    # Check MongoDB connection
    if mongo --eval "db.runCommand({ping:1})" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ MongoDB is responsive${NC}"
    else
        echo -e "${RED}✗ MongoDB is not responding${NC}"
    fi
else
    echo -e "${RED}✗ MongoDB is not running${NC}"
fi
echo

# Redis Status
echo -e "${GREEN}Redis Status:${NC}"
if pgrep -f redis-server > /dev/null; then
    echo -e "${GREEN}✓ Redis is running${NC}"
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is responsive${NC}"
    else
        echo -e "${RED}✗ Redis is not responding${NC}"
    fi
else
    echo -e "${RED}✗ Redis is not running${NC}"
fi
echo

# Nginx Status
echo -e "${GREEN}Nginx Status:${NC}"
if pgrep -f nginx > /dev/null; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
    if curl -s -f http://localhost/ > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Nginx is serving requests${NC}"
    else
        echo -e "${RED}✗ Nginx is not responding${NC}"
    fi
else
    echo -e "${RED}✗ Nginx is not running${NC}"
fi
echo

# Log Files
echo -e "${GREEN}Recent Errors (last 5 lines):${NC}"
if [ -f logs/error.log ]; then
    tail -5 logs/error.log 2>/dev/null || echo "No errors found"
else
    echo "No log file found"
fi
echo

# Backup Status
echo -e "${GREEN}Backup Status:${NC}"
if [ -d backups ]; then
    LATEST_BACKUP=$(ls -t backups/*.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_DATE=$(stat -c %y "$LATEST_BACKUP" | cut -d' ' -f1)
        BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
        echo "Latest backup: $LATEST_BACKUP"
        echo "Backup date: $BACKUP_DATE"
        echo "Backup size: $BACKUP_SIZE"
    else
        echo "No backups found"
    fi
else
    echo "Backup directory not found"
fi
echo

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Monitor completed at $(date)${NC}"
echo -e "${BLUE}========================================${NC}"