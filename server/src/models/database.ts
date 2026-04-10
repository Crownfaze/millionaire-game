import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function initDatabase(): Database.Database {
  const dataDir = path.join(__dirname, '..', '..', 'data');
  // Ensure data directory exists (important for Docker containers)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'millionaire.db');
  const db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      answer_a TEXT NOT NULL,
      answer_b TEXT NOT NULL,
      answer_c TEXT NOT NULL,
      answer_d TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK(correct_index BETWEEN 0 AND 3),
      category_id INTEGER REFERENCES categories(id),
      difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting','playing','finished')),
      host_id TEXT NOT NULL,
      timer_duration INTEGER DEFAULT 30,
      difficulty TEXT DEFAULT 'mixed',
      category_id INTEGER REFERENCES categories(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL REFERENCES rooms(code),
      socket_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','answered','error','eliminated')),
      score INTEGER DEFAULT 0,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      event_type TEXT NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate: add category_id to rooms if not exists (for existing DBs)
  try {
    db.exec('ALTER TABLE rooms ADD COLUMN category_id INTEGER REFERENCES categories(id)');
  } catch {
    // Column already exists — ignore
  }

  // Seed default categories
  const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (categoryCount.count === 0) {
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
    const defaultCategories = ['История', 'Наука', 'Кино', 'Музыка', 'IT', 'Спорт', 'География', 'Литература', 'Астрономия'];
    for (const cat of defaultCategories) {
      insertCat.run(cat);
    }
  }

  // Seed demo questions
  const qCount = db.prepare('SELECT COUNT(*) as count FROM questions').get() as { count: number };
  if (qCount.count === 0) {
    const historyId = (db.prepare("SELECT id FROM categories WHERE name = 'История'").get() as { id: number })?.id;
    const scienceId = (db.prepare("SELECT id FROM categories WHERE name = 'Наука'").get() as { id: number })?.id;
    const astroId = (db.prepare("SELECT id FROM categories WHERE name = 'Астрономия'").get() as { id: number })?.id;
    const litId = (db.prepare("SELECT id FROM categories WHERE name = 'Литература'").get() as { id: number })?.id;
    const itId = (db.prepare("SELECT id FROM categories WHERE name = 'IT'").get() as { id: number })?.id;

    const insertQ = db.prepare(`
      INSERT INTO questions (text, answer_a, answer_b, answer_c, answer_d, correct_index, category_id, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const demoQuestions = [
      // История
      ['В каком году Юрий Гагарин совершил первый полёт в космос?', '1957', '1961', '1965', '1970', 1, historyId, 'medium'],
      ['В каком году началась Вторая мировая война?', '1937', '1938', '1939', '1941', 2, historyId, 'medium'],
      ['В каком городе находится Эрмитаж?', 'Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 1, historyId, 'easy'],
      // Наука
      ['Какой элемент обозначается символом "Au" в периодической таблице?', 'Серебро', 'Алюминий', 'Золото', 'Аргон', 2, scienceId, 'easy'],
      ['Какой газ составляет большую часть атмосферы Земли?', 'Кислород', 'Углекислый газ', 'Азот', 'Водород', 2, scienceId, 'easy'],
      // Астрономия
      ['Какая планета Солнечной системы самая большая?', 'Сатурн', 'Нептун', 'Уран', 'Юпитер', 3, astroId, 'easy'],
      ['Сколько планет в Солнечной системе?', '7', '8', '9', '10', 1, astroId, 'easy'],
      // Литература
      ['Кто написал роман "Войну и мир"?', 'Достоевский', 'Толстой', 'Чехов', 'Пушкин', 1, litId, 'easy'],
      // IT — 10 вопросов
      ['В каком году была основана компания Apple?', '1974', '1976', '1978', '1980', 1, itId, 'medium'],
      ['Кто является создателем языка программирования Python?', 'Линус Торвальдс', 'Гвидо ван Россум', 'Джеймс Гослинг', 'Деннис Ритчи', 1, itId, 'easy'],
      ['Что означает аббревиатура HTML?', 'Hyper Text Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Language', 'Home Tool Markup Language', 0, itId, 'easy'],
      ['Какой язык программирования используется для стилизации веб-страниц?', 'JavaScript', 'Python', 'CSS', 'Java', 2, itId, 'easy'],
      ['Кто основал компанию Microsoft?', 'Стив Джобс', 'Билл Гейтс', 'Марк Цукерберг', 'Илон Маск', 1, itId, 'easy'],
      ['Что такое SQL?', 'Язык разметки', 'Язык стилей', 'Язык запросов к базам данных', 'Операционная система', 2, itId, 'medium'],
      ['Сколько бит в одном байте?', '4', '8', '16', '32', 1, itId, 'easy'],
      ['Какая компания разработала операционную систему Android?', 'Apple', 'Microsoft', 'Google', 'Samsung', 2, itId, 'medium'],
      ['Что означает аббревиатура API?', 'Application Programming Interface', 'Advanced Program Integration', 'Automated Process Instruction', 'Application Process Interface', 0, itId, 'medium'],
      ['В каком году был выпущен первый iPhone?', '2005', '2006', '2007', '2008', 2, itId, 'medium'],
      ['Какой протокол используется для безопасной передачи данных в интернете?', 'HTTP', 'FTP', 'HTTPS', 'SMTP', 2, itId, 'hard'],
    ];

    for (const q of demoQuestions) {
      insertQ.run(...q);
    }
  }

  console.log('✅ Database initialized');
  return db;
}
