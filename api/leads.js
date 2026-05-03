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
  if (!user) return res.status(401).json({ error: 'Nao autorizado' });

  try {
    if (req.method === 'GET') {
      let leads;
      if (user.tipo === 'ADMIN') {
        leads = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      } else if (user.tipo === 'COBRADOR') {
        leads = await sql`SELECT * FROM leads WHERE cobrador_id = ${user.id} ORDER BY created_at DESC`;
      } else {
        leads = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      }
      return res.status(200).json(leads);
    }

    if (req.method === 'POST') {
      const l = req.body;
      const result = await sql`
        INSERT INTO leads (cliente_nome, valor_divida, status_pipeline, prioridade, cobrador_id, observacoes)
        VALUES (${l.cliente_nome}, ${l.valor_divida}, ${l.status_pipeline||'D1'}, ${l.prioridade||'RISCO'}, ${l.cobrador_id||null}, ${l.observacoes||''})
        RETURNING *`;
      return res.status(201).json(result[0]);
    }

    if (req.method === 'PUT') {
      const l = req.body;
      const result = await sql`
        UPDATE leads SET
          status_pipeline = ${l.status_pipeline},
          prioridade = ${l.prioridade||'RISCO'},
          observacoes = ${l.observacoes||''},
          ultima_interacao = CURRENT_DATE,
          followup_data = ${l.followup_data||null},
          followup_obs = ${l.followup_obs||null},
          followup_concluido = ${l.followup_concluido||false},
          notas = ${JSON.stringify(l.notas||[])}::jsonb
        WHERE id = ${l.id}
        RETURNING *`;
      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM leads WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
