import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import './App.css';

function App() {
  const { stopPolling } = useGameStore();

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;