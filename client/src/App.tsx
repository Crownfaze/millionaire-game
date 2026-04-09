import { Routes, Route } from 'react-router-dom';
import GamePage from './pages/GamePage';
import AdminPage from './pages/AdminPage';
import RulesPage from './pages/RulesPage';
import RoomPage from './pages/RoomPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/room/:code" element={<RoomPage />} />
    </Routes>
  );
}
