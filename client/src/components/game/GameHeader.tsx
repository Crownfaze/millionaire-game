import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';

export default function GameHeader() {
  const location = useLocation();

  const navItems = [
    { label: 'ИГРАТЬ', path: '/', primary: true },
    { label: 'ПРАВИЛА', path: '/rules', primary: false },
    { label: 'РЕЙТИНГ', path: '/rating', primary: false },
    { label: 'АККАУНТ', path: '/admin', primary: false },
  ];

  return (
    <header className="game-header" id="game-header">
      <div className="header-logo">
        <div className="logo-badge">
          <span>M</span>
        </div>
        <span className="logo-text">МИЛЛИОНЕР</span>
      </div>

      <nav className="header-nav" id="main-nav">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-btn ${item.primary ? 'nav-btn--primary' : 'nav-btn--secondary'} ${
              location.pathname === item.path ? 'nav-btn--active' : ''
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="header-account">
        <div className="account-info">
          <div className="account-name">Иван К.</div>
          <div className="account-balance">100 000 ₽</div>
        </div>
        <div className="account-avatar" id="user-avatar">
          <User size={22} strokeWidth={1.5} />
        </div>
      </div>
    </header>
  );
}
