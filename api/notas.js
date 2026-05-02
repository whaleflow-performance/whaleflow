import { sql } from './db.js';
import jwt from 'jsonwebtoken';

function auth(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = auth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const { pedido_id, texto } = req.body;
    const nota = { texto, autor: user.nome, data: new Date().toISOString() };
    await sql`
      UPDATE pedidos 
      SET notas = notas || ${JSON.stringify([nota])}::jsonb
      WHERE id = ${pedido_id}`;
    return res.status(200).json({ ok: true, nota });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
