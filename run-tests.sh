#!/bin/bash

echo "Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo "Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Waiting for servers to start..."
sleep 5

echo "Running Playwright tests..."
cd frontend
npx playwright test

# Capture test exit code
TEST_EXIT_CODE=$?

# Kill the servers
echo "Stopping servers..."
kill $BACKEND_PID $FRONTEND_PID 2>/dev/null

# Exit with test exit code
exit $TEST_EXIT_CODE