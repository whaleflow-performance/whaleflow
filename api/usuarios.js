import { sql } from './db.js';
import bcrypt from 'bcryptjs';
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
  if (user.tipo !== 'ADMIN') return res.status(403).json({ error: 'Sem permissão' });

  try {
    // GET - listar usuários
    if (req.method === 'GET') {
      const users = await sql`SELECT id, nome, email, tipo, vendedores, cobradores, comissao_pct, created_at FROM usuarios ORDER BY nome`;
      return res.status(200).json(users);
    }

    // POST - criar usuário
    if (req.method === 'POST') {
      const u = req.body;
      const hash = await bcrypt.hash(u.senha, 10);
      const result = await sql`
        INSERT INTO usuarios (nome, email, senha, tipo, vendedores, cobradores, comissao_pct)
        VALUES (${u.nome}, ${u.email}, ${hash}, ${u.tipo},
                ${JSON.stringify(u.vendedores||[])}::jsonb,
                ${JSON.stringify(u.cobradores||[])}::jsonb,
                ${u.comissao_pct||30})
        RETURNING id, nome, email, tipo, vendedores, cobradores, comissao_pct`;
      return res.status(201).json(result[0]);
    }

    // PUT - atualizar usuário
    if (req.method === 'PUT') {
      const u = req.body;
      if (u.senha) {
        const hash = await bcrypt.hash(u.senha, 10);
        await sql`UPDATE usuarios SET nome=${u.nome}, email=${u.email}, senha=${hash}, tipo=${u.tipo},
          vendedores=${JSON.stringify(u.vendedores||[])}::jsonb,
          cobradores=${JSON.stringify(u.cobradores||[])}::jsonb
          WHERE id=${u.id}`;
      } else {
        await sql`UPDATE usuarios SET nome=${u.nome}, email=${u.email}, tipo=${u.tipo},
          vendedores=${JSON.stringify(u.vendedores||[])}::jsonb,
          cobradores=${JSON.stringify(u.cobradores||[])}::jsonb
          WHERE id=${u.id}`;
      }
      return res.status(200).json({ ok: true });
    }

    // DELETE - remover usuário
    if (req.method === 'DELETE') {
      cons
