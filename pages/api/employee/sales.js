// Ventes de l'employé connecté — plus de gestion de stock sur les produits
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });

  const employeeId = parseInt(token.sub);
  const companyId  = token.companyId;

  // GET — ventes de la semaine en cours
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

  return res.status(405).end();
}
