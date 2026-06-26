import { getDb, waitForDb } from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

await waitForDb();
const db = getDb();
const { rows: users } = await db.query("SELECT id, username, role FROM users WHERE username = 'test'");

let userId: string;
let role: string;
if (users.length === 0) {
  userId = crypto.randomUUID();
  const hash = bcrypt.hashSync('test123', 10);
  await db.query("INSERT INTO users (id, username, password_hash, role, created_at) VALUES ($1, $2, $3, 'user', $4)", [userId, 'test', hash, new Date().toISOString()]);
  role = 'user';
  console.log('Created test user');
} else {
  userId = users[0].id;
  role = users[0].role;
  console.log('Found test user, role=', role);
}
const token = jwt.sign({ userId, username: 'test', role }, 'dev-secret-change-in-production', { expiresIn: '1h' });
console.log('TOKEN=' + token);
console.log('USER_ID=' + userId);
process.exit(0);
