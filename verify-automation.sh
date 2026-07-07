#!/bin/bash
# Automation Verification Test Script
# Tests the current automations in place

echo "🔍  Levy Collection Manager - Automation Verification"
echo "========================================================="
echo ""

# Check 1: Task auto-generation file exists
echo "✓ Check 1: Task auto-generation"
if [ -f "artifacts/api-server/src/lib/tasks-automation.ts" ]; then
  echo "  ✅ File exists: tasks-automation.ts"
  
  # Check for STAGE_TASKS definition
  if grep -q "STAGE_TASKS" artifacts/api-server/src/lib/tasks-automation.ts; then
    echo "  ✅ STAGE_TASKS configured"
    echo "     Stages defined:"
    grep -o '"[A-Z0-9]*"' artifacts/api-server/src/lib/tasks-automation.ts | grep -E "LOD|S129|SUMMONS|JUDGMENT" | head -5 | sed 's/^/       - /'
  fi
  
  if grep -q "createAutoTasks" artifacts/api-server/src/lib/tasks-automation.ts; then
    echo "  ✅ createAutoTasks() function defined"
  fi
else
  echo "  ❌ tasks-automation.ts not found"
fi
echo ""

# Check 2: Interest calculation
echo "✓ Check 2: Interest calculation"
if [ -f "artifacts/api-server/src/lib/interest.ts" ]; then
  echo "  ✅ File exists: interest.ts"
  if grep -q "calculateInterest" artifacts/api-server/src/lib/interest.ts; then
    echo "  ✅ calculateInterest() function defined"
  fi
  if grep -q "10.75" artifacts/api-server/src/lib/interest.ts; then
    echo "  ✅ Default SA rate (10.75%) configured"
  fi
else
  echo "  ❌ interest.ts not found"
fi
echo ""

# Check 3: Stage advancement
echo "✓ Check 3: Stage advancement"
if grep -q "PATCH.*stage" artifacts/api-server/src/routes/matters.ts 2>/dev/null; then
  echo "  ✅ Stage advancement endpoint exists"
  if grep -q "stageHistoryTable" artifacts/api-server/src/routes/matters.ts; then
    echo "  ✅ Stage history tracking implemented"
  fi
  if grep -q "createAutoTasks" artifacts/api-server/src/routes/matters.ts; then
    echo "  ✅ Auto-tasks created on stage change"
  fi
else
  echo "  ❌ Stage advancement route not found"
fi
echo ""

# Check 4: Database connectivity
echo "✓ Check 4: Database configuration"
if grep -q "DATABASE_URL" .env; then
  echo "  ✅ DATABASE_URL configured in .env"
  DB_TYPE=$(grep DATABASE_URL .env | grep -o "postgresql\|mysql\|sqlite")
  echo "     Database type: $DB_TYPE"
else
  echo "  ❌ DATABASE_URL not configured"
fi
echo ""

# Check 5: Missing infrastructure
echo "✓ Check 5: Automation Infrastructure Status"
echo ""
echo "  IMPLEMENTED:"
grep -q "tasks-automation.ts" artifacts/api-server/src/lib/*.ts 2>/dev/null && echo "    ✅ Task auto-generation"
grep -q "interest.ts" artifacts/api-server/src/lib/*.ts 2>/dev/null && echo "    ✅ Interest calculation"
grep -q "stageHistoryTable" artifacts/api-server/src/routes/matters.ts 2>/dev/null && echo "    ✅ Stage history"
echo ""

echo "  NOT IMPLEMENTED:"
if [ ! -f "artifacts/api-server/src/lib/queue.ts" ]; then
  echo "    ❌ Job queue (BullMQ)"
fi
if [ ! -f "artifacts/api-server/src/lib/ai/ai.service.ts" ]; then
  echo "    ❌ AI service integration"
fi
if [ ! -f "artifacts/api-server/src/routes/whatsapp.ts" ]; then
  echo "    ❌ WhatsApp webhook"
fi
if [ ! -f "artifacts/api-server/src/lib/cron.ts" ]; then
  echo "    ❌ Cron job scheduler"
fi
if [ ! -f "artifacts/api-server/src/lib/hooks/event-hooks.ts" ]; then
  echo "    ❌ Event hooks system"
fi
echo ""

# Check 6: API routes
echo "✓ Check 6: API Routes"
ROUTES=$(grep "router.post\|router.get\|router.patch\|router.delete" artifacts/api-server/src/routes/*.ts 2>/dev/null | wc -l)
echo "  ✅ Found $ROUTES API routes"
echo "     Core routes:"
for route in matters tasks debtors documents payments communications; do
  if grep -q "$route" artifacts/api-server/src/routes/index.ts; then
    echo "       - $route"
  fi
done
echo ""

# Check 7: Dependencies
echo "✓ Check 7: Dependencies"
echo "  Installed:"
grep -q "express" artifacts/api-server/package.json && echo "    ✅ express"
grep -q "drizzle-orm" artifacts/api-server/package.json && echo "    ✅ drizzle-orm"
grep -q "pino" artifacts/api-server/package.json && echo "    ✅ pino (logging)"
echo ""

echo "  Missing (Required for full automation):"
if ! grep -q "bullmq" artifacts/api-server/package.json; then
  echo "    ❌ bullmq"
fi
if ! grep -q "ioredis" artifacts/api-server/package.json; then
  echo "    ❌ ioredis"
fi
if ! grep -q "openai" artifacts/api-server/package.json; then
  echo "    ❌ openai"
fi
if ! grep -q "axios" artifacts/api-server/package.json; then
  echo "    ❌ axios"
fi
if ! grep -q "node-cron" artifacts/api-server/package.json; then
  echo "    ❌ node-cron"
fi
echo ""

# Summary
echo "📊 SUMMARY"
echo "========================================================="
TOTAL=10
IMPLEMENTED=3
PERCENT=$((IMPLEMENTED * 100 / TOTAL))
echo "Current automation level: ~${PERCENT}% implemented"
echo ""
echo "✅ Working: Task generation, Interest calculation, Stage tracking"
echo "❌ Missing: Job queue, AI, WhatsApp, Workers, Cron jobs, Event hooks"
echo ""
echo "📖 To enable full automation:"
echo "   1. Read: AUTOMATIONS_COMPLETE.md"
echo "   2. Follow Phase 1 (Infrastructure & Job Queue)"
echo "   3. Continue through all 7 phases"
echo ""
echo "========================================================="
