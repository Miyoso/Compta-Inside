// Lecture seule des produits — accessible à tous les employés connectés
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  if (req.method !== 'GET') return res.status(405).end();

  const products = await sql`
    SELECT id, name, category, price::float, stock_quantity
    FROM products
    WHERE company_id = ${token.companyId}
    ORDER BY name ASC
  `;
  return res.status(200).json(products);
}
