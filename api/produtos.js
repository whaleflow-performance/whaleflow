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
      const produtos = await sql`SELECT * FROM produtos ORDER BY nome`;
      const planos   = await sql`SELECT * FROM planos ORDER BY produto_id, nome`;
      return res.status(200).json({ produtos, planos });
    }

    if (req.method === 'POST') {
      const { tipo, ...data } = req.body;
      if (tipo === 'produto') {
        const r = await sql`
          INSERT INTO produtos (nome, descricao, estoque_controlado)
          VALUES (${data.nome}, ${data.descricao||''}, ${data.estoque_controlado||false})
          RETURNING *`;
        return res.status(201).json(r[0]);
      }
      if (tipo === 'plano') {
        const r = await sql`
          INSERT INTO planos (produto_id, nome, preco, quantidade, unidade, estoque, comissao_afil, custo_produto, frete, inativo, payt_checkout_id)
          VALUES (${data.produto_id}, ${data.nome}, ${data.preco||0}, ${data.quantidade||1}, ${data.unidade||'un'}, ${data.estoque||null}, ${data.comissao_afil||null}, ${data.custo_produto||null}, ${data.frete||null}, ${data.inativo||false}, ${data.payt_checkout_id||null})
          RETURNING *`;
        return res.status(201).json(r[0]);
      }
    }

    if (req.method === 'PUT') {
      const { tipo, id, ...data } = req.body;
      if (tipo === 'produto') {
        await sql`UPDATE produtos SET 
          nome=${data.nome}, 
          descricao=${data.descricao||''}, 
          estoque_controlado=${data.estoque_controlado||false} 
        WHERE id=${id}`;
      }
      if (tipo === 'plano') {
        await sql`UPDATE planos SET 
          nome=${data.nome}, 
          preco=${data.preco||0}, 
          estoque=${data.estoque||null}, 
          comissao_afil=${data.comissao_afil||null}, 
          custo_produto=${data.custo_produto||null}, 
          frete=${data.frete||null},
          inativo=${data.inativo||false},
          payt_checkout_id=${data.payt_checkout_id||null}
        WHERE id=${id}`;
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { tipo, id } = req.query;
      if (tipo === 'produto') await sql`DELETE FROM produtos WHERE id=${id}`;
      if (tipo === 'plano')   await sql`DELETE FROM planos WHERE id=${id}`;
      return res.status(200).json({ ok: true });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
