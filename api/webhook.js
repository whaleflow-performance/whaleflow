import { sql } from './db.js';

const statusMap = {
  'POSTED':                 'ENVIADO',
  'IN_TRANSIT':             'SAIU',
  'IN_TRANSIT_TO_DELIVERY': 'SAIU',
  'OUT_FOR_DELIVERY':       'SAIU',
  'DELIVERED':              'ENTREGUE',
  'READY_FOR_PICKUP':       'RETIRAR',
  'FAILED':                 'FALHOU',
  'RETURNED':               'DEVOLVIDO',
  'WAITING_PICKUP':         'RETIRAR',
};

function brazilDate() {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
}

async function getNextCobrador() {
  const cobradores = await sql`SELECT id FROM usuarios WHERE tipo = 'COBRADOR' ORDER BY id`;
  if (!cobradores.length) return null;
  if (cobradores.length === 1) return cobradores[0].id;

  const cfg = await sql`SELECT valor FROM config WHERE chave = 'ultimo_cobrador_idx' LIMIT 1`;
  const lastIdx = parseInt(cfg[0]?.valor || '0');
  const nextIdx = (lastIdx + 1) % cobradores.length;
  await sql`UPDATE config SET valor = ${nextIdx.toString()} WHERE chave = 'ultimo_cobrador_idx'`;

  return cobradores[nextIdx].id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    const event = body.event;
    const orderId = body.orderId;
    const c = body.customer;
    const p = body.product;
    const offer = p?.offer;
    const shipping = body.shipping;

    if (event === 'ORDER_CREATE') {
      const addr = c?.address || {};
      const tel = (c?.phoneNumber||'').replace(/\D/g,'').replace(/^55/,'');

      const existing = await sql`SELECT id FROM pedidos WHERE id_externo = ${orderId} LIMIT 1`;
      if (existing.length) {
        return res.status(200).json({ ok: true, message: 'Pedido já existe', id: existing[0].id });
      }

      const cobradorId = await getNextCobrador();

      const result = await sql`
        INSERT INTO pedidos (
          nome, cpf, email, tel,
          cep, rua, numero, bairro, cidade, uf,
          produto_nome, plano_nome, plano_preco,
          pagamento, obs, data, id_externo, cobrador_id
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
          ${brazilDate()},
          ${orderId},
          ${cobradorId}
        )
        RETURNING *`;

      return res.status(201).json({ ok: true, pedido_id: result[0].id, cobrador_id: cobradorId });
    }

    if (event === 'SHIPPING_REGISTER') {
      const trackingCode = shipping?.shippingCode || '';
      const pedido = await sql`SELECT * FROM pedidos WHERE id_externo = ${orderId} LIMIT 1`;
      const nome = pedido.length ? pedido[0].nome : (c?.name||'');

      const existing = await sql`SELECT id FROM rastreamentos WHERE id_externo = ${orderId} LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE rastreamentos SET codigo_rastreio=${trackingCode}, status_entrega='ENVIADO', ultima_atualizacao=${brazilDate()} WHERE id=${existing[0].id}`;
      } else {
        await sql`
          INSERT INTO rastreamentos (cliente_nome, codigo_rastreio, status_entrega, data_envio, ultima_atualizacao, id_externo)
          VALUES (${nome}, ${trackingCode}, 'ENVIADO', ${brazilDate()}, ${brazilDate()}, ${orderId})`;
      }

      return res.status(200).json({ ok: true, status: 'ENVIADO', tracking: trackingCode });
    }

    if (event === 'SHIPPING_UPDATE') {
      const trackingCode = shipping?.shippingCode || '';
      const fiveStatus   = shipping?.shippingStatus || '';
      const wfStatus     = statusMap[fiveStatus] || 'SAIU';

      const pedido = await sql`SELECT * FROM pedidos WHERE id_externo = ${orderId} LIMIT 1`;
      const nome = pedido.length ? pedido[0].nome : (c?.name||'');

      const existing = await sql`SELECT id FROM rastreamentos WHERE id_externo = ${orderId} LIMIT 1`;
      if (existing.length) {
        await sql`UPDATE rastreamentos SET status_entrega=${wfStatus}, ultima_atualizacao=${brazilDate()} WHERE id=${existing[0].id}`;
      } else {
        await sql`
          INSERT INTO rastreamentos (cliente_nome, codigo_rastreio, status_entrega, data_envio, ultima_atualizacao, id_externo)
          VALUES (${nome}, ${trackingCode}, ${wfStatus}, ${brazilDate()}, ${brazilDate()}, ${orderId})`;
      }

      if (wfStatus === 'ENTREGUE') {
        const cobradorId = pedido.length ? pedido[0].cobrador_id : null;
        const leadExist = await sql`SELECT id FROM leads WHERE cliente_nome = ${nome} LIMIT 1`;
        if (!leadExist.length) {
          const valor = pedido.length ? (pedido[0].plano_preco||0) : (offer?.price||0);
          await sql`
            INSERT INTO leads (cliente_nome, valor_divida, status_pipeline, prioridade, ultima_interacao, cobrador_id)
            VALUES (${nome}, ${valor}, 'D1', 'RISCO', ${brazilDate()}, ${cobradorId})`;
        }
      }

      return res.status(200).json({ ok: true, status: wfStatus });
    }

    return res.status(200).json({ ok: true, message: `Evento ${event} recebido` });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
