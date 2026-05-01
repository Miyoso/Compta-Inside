import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;
  const patronId  = parseInt(token.sub);

  // GET — achats du mois + total
  if (req.method === 'GET') {
    const purchases = await sql`
      SELECT p.id, p.name, p.quantity::float, p.unit_price::float,
             p.total_amount::float, p.purchase_date, p.notes,
             rm.name AS material_name, rm.unit AS material_unit
      FROM purchases p
      LEFT JOIN raw_materials rm ON rm.id = p.raw_material_id
      WHERE p.company_id = ${companyId}
        AND DATE_TRUNC('month', p.purchase_date) = DATE_TRUNC('month', NOW())
      ORDER BY p.purchase_date DESC
    `;
    const [totRow] = await sql`
      SELECT COALESCE(SUM(total_amount), 0)::float AS total
      FROM purchases
      WHERE company_id = ${companyId}
        AND DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', NOW())
    `;
    return res.status(200).json({ purchases, totalPurchases: totRow.total });
  }

  // POST — enregistrer un achat + réapprovisionner + logguer mouvement
  if (req.method === 'POST') {
    const { name, raw_material_id, quantity, unit_price, notes } = req.body;

    if (!name || !unit_price || unit_price <= 0) {
      return res.status(400).json({ error: 'Nom et prix unitaire obligatoires.' });
    }

    const qty          = parseFloat(quantity) || 1;
    const total_amount = parseFloat(unit_price) * qty;

    if (raw_material_id) {
      const [mat] = await sql`
        SELECT id FROM raw_materials WHERE id = ${raw_material_id} AND company_id = ${companyId}
      `;
      if (!mat) return res.status(404).json({ error: 'Matière première introuvable.' });
    }

    const [purchase] = await sql`
      INSERT INTO purchases (company_id, patron_id, name, raw_material_id, quantity, unit_price, total_amount, notes)
      VALUES (${companyId}, ${patronId}, ${name}, ${raw_material_id || null}, ${qty}, ${parseFloat(unit_price)}, ${total_amount}, ${notes || null})
      RETURNING id
    `;

    // Réapprovisionner et logguer
    if (raw_material_id && qty > 0) {
      const [updated] = await sql`
        UPDATE raw_materials SET quantity = quantity + ${qty}
        WHERE id = ${raw_material_id} AND company_id = ${companyId}
        RETURNING quantity::float AS new_qty, name
      `;
      if (updated) {
        await sql`
          INSERT INTO stock_movements
            (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_id, reference_label)
          VALUES
            (${companyId}, ${raw_material_id}, 'purchase', ${qty},
             ${updated.new_qty}, ${purchase.id}, ${`Achat — ${name}`})
        `;
      }
    }

    return res.status(201).json({ success: true, total_amount });
  }

  // DELETE — annuler un achat + déduire stock + logguer
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const [purchase] = await sql`
      SELECT id, raw_material_id, quantity::float, name FROM purchases
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    if (!purchase) return res.status(404).json({ error: 'Achat introuvable.' });

    if (purchase.raw_material_id && purchase.quantity) {
      const [updated] = await sql`
        UPDATE raw_materials
        SET quantity = GREATEST(0, quantity - ${purchase.quantity})
        WHERE id = ${purchase.raw_material_id} AND company_id = ${companyId}
        RETURNING quantity::float AS new_qty
      `;
      if (updated) {
        await sql`
          INSERT INTO stock_movements
            (company_id, raw_material_id, movement_type, quantity_change, quantity_after, reference_id, reference_label)
          VALUES
            (${companyId}, ${purchase.raw_material_id}, 'purchase_cancel', ${-purchase.quantity},
             ${updated.new_qty}, ${id}, ${`Annulation achat — ${purchase.name}`})
        `;
      }
    }

    await sql`DELETE FROM purchases WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
