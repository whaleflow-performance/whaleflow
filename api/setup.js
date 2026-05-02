import { sql, setupDB } from './db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { chave, resetAdmin, novaSenha, novoEmail } = req.body;
  if (chave !== process.env.SETUP_KEY) {
    return res.status(403).json({ error: 'Chave inválida' });
  }

  try {
    await setupDB();

    if (resetAdmin && novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 10);
      const email = novoEmail || 'admin@whaleflow.com';
      const existing = await sql`SELECT id FROM usuarios WHERE tipo = 'ADMIN' LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE usuarios SET senha = ${hash}, email = ${email} WHERE tipo = 'ADMIN'`;
        return res.status(200).json({ ok: true, message: 'Senha do admin atualizada!' });
      }
    }

    const existing = await sql`SELECT id FROM usuarios WHERE email = 'admin@whaleflow.com' LIMIT 1`;
    if (!existing.length) {
      const hash = await bcrypt.hash('123456', 10);
      await sql`INSERT INTO usuarios (nome, email, senha, tipo) VALUES ('Admin WhaleFlow', 'admin@whaleflow.com', ${hash}, 'ADMIN')`;
    }

    return res.status(200).json({ ok: true, message: 'Setup concluído!' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
