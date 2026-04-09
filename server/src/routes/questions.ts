import { Router } from 'express';
import type Database from 'better-sqlite3';

export function questionRoutes(db: Database.Database): Router {
  const router = Router();

  // Get all questions
  router.get('/', (req, res) => {
    try {
      const { category, difficulty } = req.query;
      let query = `
        SELECT q.*, c.name as category_name
        FROM questions q
        LEFT JOIN categories c ON q.category_id = c.id
      `;
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (category) {
        conditions.push('c.name = ?');
        params.push(category);
      }
      if (difficulty) {
        conditions.push('q.difficulty = ?');
        params.push(difficulty);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY q.created_at DESC';

      const questions = db.prepare(query).all(...params);
      res.json(questions);
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  });

  // Create question
  router.post('/', (req, res) => {
    try {
      const { text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty = 'medium' } = req.body;

      if (!text || !answerA || !answerB || !answerC || !answerD || correctIndex === undefined) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const result = db.prepare(
        `INSERT INTO questions (text, answer_a, answer_b, answer_c, answer_d, correct_index, category_id, difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty);

      res.status(201).json({ id: result.lastInsertRowid, text, correctIndex });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({ error: 'Failed to create question' });
    }
  });

  // Update question
  router.put('/:id', (req, res) => {
    try {
      const { text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty } = req.body;

      db.prepare(
        `UPDATE questions SET text=?, answer_a=?, answer_b=?, answer_c=?, answer_d=?, correct_index=?, category_id=?, difficulty=?
         WHERE id=?`
      ).run(text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty, req.params.id);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question' });
    }
  });

  // Delete question
  router.delete('/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  });

  // Get categories
  router.get('/categories/all', (_req, res) => {
    try {
      const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Create category
  router.post('/categories', (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Category name is required' });
        return;
      }

      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
      res.status(201).json({ id: result.lastInsertRowid, name });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  return router;
}
