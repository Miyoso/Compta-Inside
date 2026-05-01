import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // PUT — ajuster manuellement le stock d'une matière première
  if (req.method === 'PUT') {
    const { id, stock_quantity } = req.body;
    if (stock_quantity == null || stock_quantity < 0) {
      return res.status(400).json({ error: 'Quantité invalide.' });
    }

    // Lire la valeur avant pour calculer le delta
    const [before] = await sql`
      SELECT quantity::float AS qty, name FROM raw_materials
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    if (!before) return res.status(404).json({ error: 'Matière introuvable.' });

    await sql`
      UPDATE raw_materials
      SET quantity = ${stock_quantity}
      WHERE id = ${id} AND company_id = ${companyId}
    `;

    const delta = stock_quantity - before.qty;
    if (delta !== 0) {
      await sql`
        INSERT INTO stock_movements
          (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_label)
        VALUES
          (${companyId}, ${id}, 'adjustment', ${delta}, ${stock_quantity},
           ${`Ajustement manuel — ${before.name}`})
      `;
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
