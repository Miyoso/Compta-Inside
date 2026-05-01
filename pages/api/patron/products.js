import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — liste des produits (avec nb d'ingrédients dans la recette)
  if (req.method === 'GET') {
    const products = await sql`
      SELECT p.id, p.name, p.category, p.price::float, p.image_url,
             COUNT(pr.id)::int AS recipe_count
      FROM products p
      LEFT JOIN product_recipes pr ON pr.product_id = p.id AND pr.company_id = ${companyId}
      WHERE p.company_id = ${companyId}
      GROUP BY p.id
      ORDER BY p.name ASC
    `;
    return res.status(200).json(products);
  }

  // POST — ajouter un produit
  if (req.method === 'POST') {
    const { name, category, price, image_url } = req.body;
    if (!name || price == null) {
      return res.status(400).json({ error: 'Nom et prix obligatoires.' });
    }
    const [p] = await sql`
      INSERT INTO products (company_id, name, category, price, image_url)
      VALUES (${companyId}, ${name}, ${category || 'Autre'}, ${price}, ${image_url || null})
      RETURNING id, name, category, price::float, image_url
    `;
    return res.status(201).json(p);
  }

  // PUT — modifier un produit
  if (req.method === 'PUT') {
    const { id, name, category, price, image_url } = req.body;
    await sql`
      UPDATE products
      SET name = ${name}, category = ${category}, price = ${price},
          image_url = ${image_url || null}
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  // DELETE — supprimer un produit
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID manquant.' });

      // Vérifier s'il existe des ventes liées à ce produit
      const [salesCheck] = await sql`
        SELECT COUNT(*)::int AS count FROM sales
        WHERE product_id = ${parseInt(id)} AND company_id = ${companyId}
      `;
      if (salesCheck.count > 0) {
        return res.status(409).json({
          error: `Ce produit a ${salesCheck.count} vente(s) enregistrée(s) et ne peut pas être supprimé. Modifiez son nom ou son prix si nécessaire.`,
        });
      }

      // Supprimer la recette liée d'abord (si la table existe)
      try {
        await sql`DELETE FROM product_recipes WHERE product_id = ${parseInt(id)} AND company_id = ${companyId}`;
      } catch {}
      // Supprimer le produit
      await sql`DELETE FROM products WHERE id = ${parseInt(id)} AND company_id = ${companyId}`;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE product error:', err);
      return res.status(500).json({ error: 'Erreur serveur lors de la suppression.' });
    }
  }

  return res.status(405).end();
}
