#!/bin/bash

echo "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo "Starting frontend server..."
cd frontend
npx wrangler dev --port 39173 &
FRONTEND_PID=$!
cd ..

echo "Waiting for servers to start..."
sleep 10

echo "Running Playwright tests..."
cd frontend
npx playwright test --max-failures=1

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill the servers
echo "Stopping servers..."
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null

# Exit with test exit code
exit $TEST_EXIT_CODE