#!/bin/bash

# Kill any existing processes on port 39173
echo "Cleaning up existing processes..."
lsof -ti:39173 | xargs kill -9 2>/dev/null || true

echo "Starting frontend server (includes backend worker)..."
cd frontend
npx wrangler dev --port 39173 &
SERVER_PID=$!
cd ..

echo "Waiting for server to start..."
# Wait for server to be ready with shorter timeout
timeout=30
while ! curl -s http://localhost:39173 > /dev/null 2>&1; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -eq 0 ]; then
    echo "Server failed to start within 30 seconds"
    kill $SERVER_PID 2>/dev/null
    exit 1
  fi
done

echo "Server ready! Running Playwright tests..."
cd frontend
npx playwright test --max-failures=1 --timeout=30000

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill the server
echo "Stopping server..."
kill $SERVER_PID 2>/dev/null

# Exit with test exit code
exit $TEST_EXIT_CODE