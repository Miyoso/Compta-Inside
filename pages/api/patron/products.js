import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — liste des produits
  if (req.method === 'GET') {
    const products = await sql`
      SELECT id, name, category, price::float, stock_quantity, stock_min_alert, image_url
      FROM products
      WHERE company_id = ${companyId}
      ORDER BY name ASC
    `;
    return res.status(200).json(products);
  }

  // POST — ajouter un produit
  if (req.method === 'POST') {
    const { name, category, price, stock_quantity, stock_min_alert, image_url } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'Nom et prix obligatoires.' });
    }
    const [p] = await sql`
      INSERT INTO products (company_id, name, category, price, stock_quantity, stock_min_alert, image_url)
      VALUES (${companyId}, ${name}, ${category || 'Autre'}, ${price}, ${stock_quantity || 0}, ${stock_min_alert || 5}, ${image_url || null})
      RETURNING id, name, category, price::float, stock_quantity, stock_min_alert, image_url
    `;
    return res.status(201).json(p);
  }

  // PUT — modifier un produit
  if (req.method === 'PUT') {
    const { id, name, category, price, stock_min_alert, image_url } = req.body;
    await sql`
      UPDATE products
      SET name = ${name}, category = ${category}, price = ${price},
          stock_min_alert = ${stock_min_alert}, image_url = ${image_url || null}
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  // DELETE — supprimer un produit
  if (req.method === 'DELETE') {
    const { id } = req.body;
    await sql`DELETE FROM products WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
