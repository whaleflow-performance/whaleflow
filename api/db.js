import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export async function setupDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT NOT NULL,
      vendedores JSONB DEFAULT '[]',
      cobradores JSONB DEFAULT '[]',
      comissao_pct INTEGER DEFAULT 30,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      nome TEXT,
      cpf TEXT,
      email TEXT,
      tel TEXT,
      cep TEXT,
      rua TEXT,
      numero TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      produto_nome TEXT,
      plano_nome TEXT,
      plano_preco NUMERIC,
      pagamento TEXT DEFAULT 'PENDENTE',
      forma_pagamento TEXT,
      vendedor_id INTEGER,
      obs TEXT,
      data DATE DEFAULT CURRENT_DATE,
      notas JSONB DEFAULT '[]',
      suspenso BOOLEAN DEFAULT FALSE,
      followup_data DATE,
      followup_obs TEXT,
      followup_concluido BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      cliente_nome TEXT,
      valor_divida NUMERIC,
      status_pipeline TEXT DEFAULT 'D1',
      prioridade TEXT DEFAULT 'RISCO',
      cobrador_id INTEGER,
      ultima_interacao DATE DEFAULT CURRENT_DATE,
      observacoes TEXT,
      followup_data DATE,
      followup_obs TEXT,
      followup_concluido BOOLEAN DEFAULT FALSE,
      notas JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  return true;
}

export { sql };
