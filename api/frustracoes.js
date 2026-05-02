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
      let frustracoes;
      if (user.tipo === 'ADMIN') {
        frustracoes = await sql`SELECT * FROM frustracoes ORDER BY data DESC`;
      } else {
        frustracoes = await sql`SELECT * FROM frustracoes WHERE vendedor_id = ${user.id} ORDER BY data DESC`;
      }
      return res.status(200).json(frustracoes);
    }

    if (req.method === 'POST') {
      const f = req.body;
      const r = await sql`
        INSERT INTO frustracoes (tipo, pedido_nome, valor, motivo, obs, status, vendedor_id, data)
        VALUES (${f.tipo}, ${f.pedido_nome}, ${f.valor||0}, ${f.motivo||''}, ${f.obs||''}, 
                ${f.status||'PENDENTE'}, ${user.id}, CURRENT_DATE)
        RETURNING *`;
      return res.status(201).json(r[0]);
    }

    if (req.method === 'PUT') {
      const { id, status } = req.body;
      await sql`UPDATE frustracoes SET status = ${status} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM frustracoes WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
