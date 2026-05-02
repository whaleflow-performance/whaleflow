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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = auth(req);
  if (!user) return res.status(401).json({ error: 'Não autorizado' });

  try {
    if (req.method === 'GET') {
      let pedidos;
      if (user.tipo === 'ADMIN') {
        pedidos = await sql`SELECT id, nome, produto_nome, plano_nome, plano_preco, vendedor_id, followup_data, followup_obs, followup_concluido FROM pedidos WHERE followup_data IS NOT NULL ORDER BY followup_data`;
      } else {
        pedidos = await sql`SELECT id, nome, produto_nome, plano_nome, plano_preco, vendedor_id, followup_data, followup_obs, followup_concluido FROM pedidos WHERE followup_data IS NOT NULL AND vendedor_id = ${user.id} ORDER BY followup_data`;
      }
      return res.status(200).json(pedidos);
    }

    if (req.method === 'PUT') {
      const { id, followup_data, followup_obs, followup_concluido } = req.body;
      await sql`UPDATE pedidos SET followup_data = ${followup_data||null}, followup_obs = ${followup_obs||null}, followup_concluido = ${followup_concluido||false} WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
