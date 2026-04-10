import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

export function roomRoutes(db: Database.Database): Router {
  const router = Router();

  // Create room
  router.post('/', (req, res) => {
    try {
      const { name, timerDuration = 30, difficulty = 'mixed', categoryId } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Room name is required' });
        return;
      }

      const code = uuidv4().slice(0, 6).toUpperCase();
      const hostId = uuidv4();

      db.prepare(
        'INSERT INTO rooms (code, name, host_id, timer_duration, difficulty, category_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(code, name, hostId, timerDuration, difficulty, categoryId ?? null);

      res.status(201).json({ code, name, hostId, timerDuration, difficulty, categoryId: categoryId ?? null, status: 'waiting' });
    } catch (error) {
      console.error('Error creating room:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // Get all rooms
  router.get('/', (_req, res) => {
    try {
      const rooms = db.prepare(
        `SELECT r.*,
        (SELECT COUNT(*) FROM participants WHERE room_code = r.code) as participant_count
        FROM rooms r ORDER BY created_at DESC`
      ).all();
      res.json(rooms);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // Get room by code
  router.get('/:code', (req, res) => {
    try {
      const room = db.prepare(
        `SELECT r.*,
        (SELECT COUNT(*) FROM participants WHERE room_code = r.code) as participant_count
        FROM rooms r WHERE r.code = ?`
      ).get(req.params.code);

      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }
      res.json(room);
    } catch (error) {
      console.error('Error fetching room:', error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  // Close room (set status to finished)
  router.patch('/:code/close', (req, res) => {
    try {
      db.prepare("UPDATE rooms SET status = 'finished' WHERE code = ?").run(req.params.code);
      db.prepare('DELETE FROM participants WHERE room_code = ?').run(req.params.code);
      res.json({ success: true });
    } catch (error) {
      console.error('Error closing room:', error);
      res.status(500).json({ error: 'Failed to close room' });
    }
  });

  // Delete room permanently
  router.delete('/:code', (req, res) => {
    try {
      db.prepare('DELETE FROM participants WHERE room_code = ?').run(req.params.code);
      db.prepare('DELETE FROM game_logs WHERE room_code = ?').run(req.params.code);
      db.prepare('DELETE FROM rooms WHERE code = ?').run(req.params.code);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting room:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  return router;
}
