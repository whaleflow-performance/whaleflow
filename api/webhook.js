import { sql } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const event = body.event;

    // ── ORDER_CREATE ──────────────────────────────
    if (event === 'ORDER_CREATE') {
      const c = body.customer;
      const p = body.product;
      const offer = p?.offer;

      // Parse phone
      const tel = (c?.phoneNumber||'').replace(/\D/g,'').replace(/^55/,'');

      // Parse address
      const addr = c?.address || {};

      // Check if pedido already exists (idempotency)
      const existing = await sql`SELECT id FROM pedidos WHERE id_externo = ${body.orderId} LIMIT 1`;
      if (existing.length) {
        return res.status(200).json({ ok: true, message: 'Pedido já existe', id: existing[0].id });
      }

      const result = await sql`
        INSERT INTO pedidos (
          nome, cpf, email, tel,
          cep, rua, numero, bairro, cidade, uf,
          produto_nome, plano_nome, plano_preco,
          pagamento, obs, data, id_externo
        ) VALUES (
          ${c?.name||''},
          ${(c?.document||'').replace(/\D/g,'')},
          ${c?.mail||''},
          ${tel},
          ${(addr.zipCode||'').replace(/\D/g,'')},
          ${addr.address||''},
          ${addr.number||''},
          ${addr.neighborhood||''},
          ${addr.city||''},
          ${addr.state||''},
          ${p?.name||''},
          ${offer?.title||''},
          ${offer?.price||0},
          'PENDENTE',
          ${`Qtd: ${offer?.numberOfItems||1} | Projeto: ${body.project?.name||''}`},
          CURRENT_DATE,
          ${body.orderId}
        )
        RETURNING *`;

      return res.status(201).json({ ok: true, pedido_id: result[0].id });
    }

    // ── RASTREAMENTO UPDATE ───────────────────────
    if (event === 'TRACKING_UPDATE' || event === 'ORDER_SHIPPED') {
      const { orderId, trackingCode, trackingStatus } = body;

      const statusMap = {
        'shipped':   'ENVIADO',
        'in_transit':'SAIU',
        'delivered': 'ENTREGUE',
        'failed':    'FALHOU',
        'returned':  'DEVOLVIDO',
      };
      const status = statusMap[trackingStatus?.toLowerCase()] || 'ENVIADO';

      // Find pedido
      const pedido = await sql`SELECT * FROM pedidos WHERE id_externo = ${orderId} LIMIT 1`;
      if (!pedido.length) return res.status(404).json({ error: 'Pedido não encontrado' });

      const p = pedido[0];

      // Upsert rastreamento
      const existing = await sql`SELECT id FROM rastreamentos WHERE cliente_nome = ${p.nome} LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE rastreamentos SET status_entrega=${status}, ultima_atualizacao=CURRENT_DATE WHERE id=${existing[0].id}`;
      } else {
        await sql`
          INSERT INTO rastreamentos (cliente_nome, codigo_rastreio, status_entrega, data_envio)
          VALUES (${p.nome}, ${trackingCode||''}, ${status}, CURRENT_DATE)`;
      }

      // If delivered → create lead D1
      if (status === 'ENTREGUE') {
        const leadExist = await sql`SELECT id FROM leads WHERE cliente_nome=${p.nome} LIMIT 1`;
        if (!leadExist.length) {
          await sql`
            INSERT INTO leads (cliente_nome, valor_divida, status_pipeline, prioridade, ultima_interacao)
            VALUES (${p.nome}, ${p.plano_preco||0}, 'D1', 'RISCO', CURRENT_DATE)`;
        }
      }

      return res.status(200).json({ ok: true, status });
    }

    // Unknown event - log and return ok
    return res.status(200).json({ ok: true, message: `Evento ${event} recebido` });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
