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
    // GET - listar pedidos
    if (req.method === 'GET') {
      let pedidos;
      if (user.tipo === 'ADMIN') {
        pedidos = await sql`SELECT * FROM pedidos ORDER BY created_at DESC`;
      } else {
        pedidos = await sql`SELECT * FROM pedidos WHERE vendedor_id = ${user.id} ORDER BY created_at DESC`;
      }
      return res.status(200).json(pedidos);
    }

    // POST - criar pedido
    if (req.method === 'POST') {
      const p = req.body;
      const result = await sql`
        INSERT INTO pedidos (nome, cpf, email, tel, cep, rua, numero, bairro, cidade, uf,
          produto_nome, plano_nome, plano_preco, pagamento, forma_pagamento, vendedor_id, obs, data)
        VALUES (${p.nome}, ${p.cpf}, ${p.email}, ${p.tel}, ${p.cep}, ${p.rua}, ${p.numero},
          ${p.bairro}, ${p.cidade}, ${p.uf}, ${p.produto_nome}, ${p.plano_nome}, ${p.plano_preco},
          ${p.pagamento||'PENDENTE'}, ${p.forma_pagamento}, ${user.id}, ${p.obs}, CURRENT_DATE)
        RETURNING *`;
      return res.status(201).json(result[0]);
    }

    // PUT - atualizar pedido
    if (req.method === 'PUT') {
      const { id, ...p } = req.body;
      const result = await sql`
        UPDATE pedidos SET
          pagamento = ${p.pagamento},
          forma_pagamento = ${p.forma_pagamento},
          notas = ${JSON.stringify(p.notas || [])}::jsonb,
          suspenso = ${p.suspenso || false},
          followup_data = ${p.followup_data || null},
          followup_obs = ${p.followup_obs || null},
          followup_concluido = ${p.followup_concluido || false}
        WHERE id = ${id}
        RETURNING *`;
      return res.status(200).json(result[0]);
    }

    // DELETE - remover pedido
    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM pedidos WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
