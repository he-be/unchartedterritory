# WebSocket + Durable Objects Architecture Implementation Plan

## Overview
Complete overhaul from HTTP polling to real-time WebSocket + Durable Objects architecture.

## Architecture Components

### 1. Game Session Durable Object
- **Purpose**: Single source of truth for each game session
- **Features**:
  - Persistent game state with transactional storage
  - WebSocket connection management with hibernation
  - Real-time game loop using Alarms API (10Hz)
  - Automatic command queue processing
  - Cross-sector movement coordination

### 2. API Gateway Worker
- **Purpose**: Routes WebSocket connections to appropriate Durable Objects
- **Endpoints**:
  - `GET /api/game/:gameId/ws` - WebSocket upgrade
  - `POST /api/game/new` - Create new game session
  - `GET /api/game/:gameId/state` - Fallback HTTP endpoint

### 3. Frontend WebSocket Client
- **Purpose**: Real-time bidirectional communication
- **Features**:
  - Automatic reconnection
  - Command queueing during disconnection
  - Real-time state updates
  - Cross-sector movement visualization

## Implementation Flow

### Phase 1: Durable Object Implementation
1. Create GameSession Durable Object class
2. Implement WebSocket connection handling
3. Add game loop with Alarms API
4. Integrate existing game logic

### Phase 2: Worker Refactoring
1. Update main worker for WebSocket routing
2. Configure Durable Objects bindings
3. Maintain HTTP fallback for compatibility

### Phase 3: Frontend Overhaul
1. Implement WebSocket service
2. Update game store for real-time updates
3. Add connection status indicators
4. Handle reconnection scenarios

### Phase 4: Testing & Deployment
1. Update all existing tests
2. Add WebSocket-specific tests
3. Deploy to staging
4. Browser testing with cross-sector movement

## Benefits
- **Real-time Updates**: Immediate state synchronization
- **Cross-sector Movement**: Reliable command processing
- **Scalability**: Each game session is independently managed
- **Performance**: Reduced HTTP overhead
- **Reliability**: Transactional state persistence

## Implementation Status
- [ ] GameSession Durable Object
- [ ] WebSocket API endpoints  
- [ ] Frontend WebSocket client
- [ ] Game loop with Alarms
- [ ] Cross-sector movement testing
- [ ] Full integration testing