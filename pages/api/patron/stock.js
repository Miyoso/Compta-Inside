import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // PUT — ajuster manuellement le stock d'un produit
  if (req.method === 'PUT') {
    const { id, stock_quantity } = req.body;
    if (stock_quantity == null || stock_quantity < 0) {
      return res.status(400).json({ error: 'Quantité invalide.' });
    }
    await sql`
      UPDATE products
      SET stock_quantity = ${stock_quantity}
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
