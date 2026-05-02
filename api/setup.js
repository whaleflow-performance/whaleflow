import { sql, setupDB } from './db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Chave de segurança para não qualquer um rodar o setup
  const { chave } = req.body;
  if (chave !== process.env.SETUP_KEY) {
    return res.status(403).json({ error: 'Chave inválida' });
  }

  try {
    // Cria as tabelas
    await setupDB();

    // Cria usuário admin padrão se não existir
    const existing = await sql`SELECT id FROM usuarios WHERE email = 'admin@whaleflow.com' LIMIT 1`;
    
    if (!existing.length) {
      const hash = await bcrypt.hash('123456', 10);
      await sql`
        INSERT INTO usuarios (nome, email, senha, tipo)
        VALUES ('Admin WhaleFlow', 'admin@whaleflow.com', ${hash}, 'ADMIN')
      `;

      // Cria usuários demo
      const senhaHash = await bcrypt.hash('123456', 10);
      await sql`INSERT INTO usuarios (nome, email, senha, tipo) VALUES 
        ('João Vendedor', 'vendedor@whaleflow.com', ${senhaHash}, 'VENDEDOR'),
        ('Carlos Cobrador', 'cobrador@whaleflow.com', ${senhaHash}, 'COBRADOR'),
        ('Maria Afiliada', 'afiliado@whaleflow.com', ${senhaHash}, 'AFILIADO')
      `;
    }

    return res.status(200).json({ 
      ok: true, 
      message: 'Banco configurado com sucesso! Tabelas criadas e usuário admin criado.' 
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
