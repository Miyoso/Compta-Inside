// Lecture seule des produits — accessible à tous les employés connectés
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  if (req.method !== 'GET') return res.status(405).end();

  const products = await sql`
    SELECT p.id, p.name, p.category, p.price::float, p.image_url,
           COUNT(pr.id)::int AS recipe_count
    FROM products p
    LEFT JOIN product_recipes pr ON pr.product_id = p.id AND pr.company_id = ${token.companyId}
    WHERE p.company_id = ${token.companyId}
    GROUP BY p.id
    ORDER BY p.name ASC
  `;
  return res.status(200).json(products);
}
