import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — toutes les ventes du mois par employé
  if (req.method === 'GET') {
    const sales = await sql`
      SELECT s.id, u.name AS employee_name, p.name AS product_name,
             s.quantity, s.unit_price::float, s.total_amount::float, s.sale_date
      FROM sales s
      JOIN users u ON u.id = s.employee_id
      JOIN products p ON p.id = s.product_id
      WHERE s.company_id = ${companyId}
      ORDER BY s.sale_date DESC
    `;
    return res.status(200).json(sales);
  }

  // POST — enregistrer une vente (décrémente le stock automatiquement)
  if (req.method === 'POST') {
    const { employee_id, product_id, quantity } = req.body;

    if (!employee_id || !product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
    }

    // Récupérer le prix du produit
    const [product] = await sql`
      SELECT id, price::float, stock_quantity, name
      FROM products
      WHERE id = ${product_id} AND company_id = ${companyId}
    `;
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
    if (product.stock_quantity < quantity) {
      return res.status(400).json({ error: `Stock insuffisant (disponible : ${product.stock_quantity}).` });
    }

    const unit_price = product.price;
    const total_amount = unit_price * quantity;

    // Insérer la vente
    await sql`
      INSERT INTO sales (company_id, employee_id, product_id, quantity, unit_price, total_amount)
      VALUES (${companyId}, ${employee_id}, ${product_id}, ${quantity}, ${unit_price}, ${total_amount})
    `;

    // Décrémenter le stock
    await sql`
      UPDATE products
      SET stock_quantity = stock_quantity - ${quantity}
      WHERE id = ${product_id}
    `;

    return res.status(201).json({ success: true, total_amount });
  }

  // DELETE — supprimer une vente et remettre le stock
  if (req.method === 'DELETE') {
    const { id } = req.body;
    const [sale] = await sql`SELECT product_id, quantity FROM sales WHERE id = ${id} AND company_id = ${companyId}`;
    if (!sale) return res.status(404).json({ error: 'Vente introuvable.' });

    await sql`DELETE FROM sales WHERE id = ${id} AND company_id = ${companyId}`;
    await sql`UPDATE products SET stock_quantity = stock_quantity + ${sale.quantity} WHERE id = ${sale.product_id}`;

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
