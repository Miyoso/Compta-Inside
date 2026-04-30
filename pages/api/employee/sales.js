// Ventes de l'employé connecté — il ne voit et saisit que les siennes
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });

  const employeeId = parseInt(token.sub);
  const companyId  = token.companyId;

  // GET — historique des ventes de l'employé (semaine en cours)
  if (req.method === 'GET') {
    const sales = await sql`
      SELECT s.id, p.name AS product_name, s.quantity,
             s.unit_price::float, s.total_amount::float, s.sale_date
      FROM sales s
      JOIN products p ON p.id = s.product_id
      WHERE s.employee_id = ${employeeId}
        AND s.company_id  = ${companyId}
        AND s.sale_date >= DATE_TRUNC('week', NOW())
      ORDER BY s.sale_date DESC
    `;
    return res.status(200).json(sales);
  }

  // POST — enregistrer une nouvelle vente
  if (req.method === 'POST') {
    const { product_id, quantity } = req.body;

    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Produit et quantité obligatoires.' });
    }

    // Vérifier que le produit appartient bien à la même entreprise
    const [product] = await sql`
      SELECT id, price::float, stock_quantity, name
      FROM products
      WHERE id = ${product_id} AND company_id = ${companyId}
    `;
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
    if (product.stock_quantity < quantity) {
      return res.status(400).json({ error: `Stock insuffisant — il reste ${product.stock_quantity} unité(s).` });
    }

    const unit_price   = product.price;
    const total_amount = unit_price * quantity;

    // Enregistrer la vente
    await sql`
      INSERT INTO sales (company_id, employee_id, product_id, quantity, unit_price, total_amount)
      VALUES (${companyId}, ${employeeId}, ${product_id}, ${quantity}, ${unit_price}, ${total_amount})
    `;

    // Décrémenter le stock
    await sql`
      UPDATE products SET stock_quantity = stock_quantity - ${quantity}
      WHERE id = ${product_id}
    `;

    return res.status(201).json({ success: true, total_amount, product_name: product.name });
  }

  return res.status(405).end();
}
