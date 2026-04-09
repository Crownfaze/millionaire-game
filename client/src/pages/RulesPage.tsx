import StudioBackground from '../components/game/StudioBackground';
import { BookOpen, Clock, HelpCircle, Award, Users, Zap } from 'lucide-react';
import '../styles/rules.css';

const rules = [
  {
    icon: <HelpCircle size={24} />,
    title: '15 вопросов',
    desc: 'Отвечайте на вопросы возрастающей сложности. Каждый правильный ответ увеличивает ваш выигрыш.',
  },
  {
    icon: <Clock size={24} />,
    title: 'Ограниченное время',
    desc: 'На каждый вопрос даётся ограниченное время. Не успели — ваш ответ не засчитывается.',
  },
  {
    icon: <Zap size={24} />,
    title: '3 подсказки',
    desc: '50/50 убирает два неправильных ответа. Звонок другу — мнение эксперта. Помощь зала — голосование.',
  },
  {
    icon: <Award size={24} />,
    title: 'Несгораемые суммы',
    desc: 'Суммы 1 000 ₽, 50 000 ₽ и 100 000 ₽ — несгораемые. Ошибка не обнулит ваш выигрыш.',
  },
  {
    icon: <Users size={24} />,
    title: 'Онлайн-игра',
    desc: 'Подключайтесь к комнате ведущего по ссылке. Отвечайте в реальном времени вместе с другими участниками.',
  },
  {
    icon: <BookOpen size={24} />,
    title: 'Забрать выигрыш',
    desc: 'В любой момент можете забрать текущий выигрыш. Рискуйте или играйте наверняка — решать вам!',
  },
];

export default function RulesPage() {
  return (
    <>
      <StudioBackground />
      <div className="rules-page" id="rules-page">
        <header className="rules-header">
          <div className="header-logo">
            <div className="logo-badge"><span>M</span></div>
            <span className="logo-text">ПРАВИЛА</span>
          </div>
          <a href="/" className="admin-back-btn">← На игру</a>
        </header>

        <div className="rules-grid">
          {rules.map((rule, idx) => (
            <div
              key={idx}
              className="rule-card"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="rule-icon">{rule.icon}</div>
              <h3 className="rule-title">{rule.title}</h3>
              <p className="rule-desc">{rule.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
