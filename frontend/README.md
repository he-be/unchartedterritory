# Uncharted Territory Frontend MVP

This is the minimum viable frontend for the Uncharted Territory space economic simulation game.

## Features

- Game creation and loading
- Real-time game state updates via polling (will be migrated to WebSocket)
- Sector map visualization with interactive elements
- Fleet management and ship control
- Trading interface with station interaction
- Trade opportunity tracking

## Tech Stack

- React 18 with TypeScript
- Vite for fast development and building
- Zustand for state management (WebSocket-ready)
- Axios for REST API calls
- React Router for navigation

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will be available at http://localhost:3000 and will proxy API requests to the backend at http://localhost:3001.

## Architecture

The frontend is designed with future WebSocket migration in mind:

- **State Management**: Zustand store with centralized game state
- **API Layer**: Separate service layer for easy protocol switching
- **Polling System**: Currently uses polling for real-time updates, easily replaceable with WebSocket events
- **Component Structure**: Modular components that react to state changes

## Key Components

- **GameHeader**: Displays player stats and game information
- **SectorMap**: Interactive canvas-based map visualization
- **ShipPanel**: Fleet management and ship selection
- **StationPanel**: Station information and interaction
- **TradePanel**: Trading interface with buy/sell functionality

## Next Steps

1. Implement WebSocket connection for real-time updates
2. Add sound effects and visual feedback
3. Implement multiplayer features
4. Enhance UI/UX with animations and transitions