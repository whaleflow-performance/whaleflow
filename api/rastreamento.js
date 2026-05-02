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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = auth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });

  try {
    if (req.method === 'GET') {
      const r = await sql`SELECT * FROM rastreamentos ORDER BY created_at DESC`;
      return res.status(200).json(r);
    }
    if (req.method === 'POST') {
      const d = req.body;
      const r = await sql`
        INSERT INTO rastreamentos (cliente_nome, codigo_rastreio, status_entrega, data_envio, ultima_atualizacao)
        VALUES (${d.cliente_nome}, ${d.codigo_rastreio}, ${d.status_entrega||'PENDENTE'}, ${d.data_envio||null}, CURRENT_DATE)
        RETURNING *`;
      return res.status(201).json(r[0]);
    }
    if (req.method === 'PUT') {
      const { id, status_entrega } = req.body;
      await sql`UPDATE rastreamentos SET status_entrega = ${status_entrega}, ultima_atualizacao = CURRENT_DATE WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM rastreamentos WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
