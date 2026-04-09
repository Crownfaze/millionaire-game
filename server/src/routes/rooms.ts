import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type Database from 'better-sqlite3';

export function roomRoutes(db: Database.Database): Router {
  const router = Router();

  // Create room
  router.post('/', (req, res) => {
    try {
      const { name, timerDuration = 30, difficulty = 'mixed' } = req.body;
      if (!name) {
        res.status(400).json({ error: 'Room name is required' });
        return;
      }

      const code = uuidv4().slice(0, 6).toUpperCase();
      const hostId = uuidv4();

      db.prepare(
        'INSERT INTO rooms (code, name, host_id, timer_duration, difficulty) VALUES (?, ?, ?, ?, ?)'
      ).run(code, name, hostId, timerDuration, difficulty);

      res.status(201).json({ code, name, hostId, timerDuration, difficulty, status: 'waiting' });
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

  return router;
}
