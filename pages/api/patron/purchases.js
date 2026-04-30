import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;
  const patronId  = parseInt(token.sub);

  // GET — liste des achats (mois en cours)
  if (req.method === 'GET') {
    const purchases = await sql`
      SELECT
        p.id, p.name, p.quantity, p.unit_price::float,
        p.total_amount::float, p.purchase_date, p.notes,
        pr.name AS product_name
      FROM purchases p
      LEFT JOIN products pr ON pr.id = p.product_id
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

  // POST — enregistrer un achat (+ réapprovisionnement stock si product_id)
  if (req.method === 'POST') {
    const { name, product_id, quantity, unit_price, notes } = req.body;

    if (!name || !unit_price || unit_price <= 0) {
      return res.status(400).json({ error: 'Nom et prix unitaire obligatoires.' });
    }

    const qty          = parseInt(quantity) || 1;
    const total_amount = parseFloat(unit_price) * qty;

    // Si un produit est lié, vérifier qu'il appartient à l'entreprise
    if (product_id) {
      const [prod] = await sql`SELECT id FROM products WHERE id = ${product_id} AND company_id = ${companyId}`;
      if (!prod) return res.status(404).json({ error: 'Produit introuvable.' });
    }

    // Créer l'achat
    const [purchase] = await sql`
      INSERT INTO purchases (company_id, patron_id, name, product_id, quantity, unit_price, total_amount, notes)
      VALUES (
        ${companyId}, ${patronId}, ${name},
        ${product_id || null}, ${product_id ? qty : null},
        ${parseFloat(unit_price)}, ${total_amount},
        ${notes || null}
      )
      RETURNING id, total_amount::float
    `;

    // Réapprovisionnement automatique du stock si produit lié
    if (product_id && qty > 0) {
      await sql`
        UPDATE products
        SET stock_quantity = stock_quantity + ${qty}
        WHERE id = ${product_id} AND company_id = ${companyId}
      `;
    }

    return res.status(201).json({ success: true, id: purchase.id, total_amount: purchase.total_amount });
  }

  // DELETE — annuler un achat (et déduire le stock si applicable)
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID manquant.' });

    const [purchase] = await sql`
      SELECT id, product_id, quantity FROM purchases
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    if (!purchase) return res.status(404).json({ error: 'Achat introuvable.' });

    // Annuler le réapprovisionnement si applicable
    if (purchase.product_id && purchase.quantity) {
      await sql`
        UPDATE products
        SET stock_quantity = GREATEST(0, stock_quantity - ${purchase.quantity})
        WHERE id = ${purchase.product_id} AND company_id = ${companyId}
      `;
    }

    await sql`DELETE FROM purchases WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
