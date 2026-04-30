import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — recette d'un produit spécifique
  if (req.method === 'GET') {
    const { product_id } = req.query;
    if (!product_id) return res.status(400).json({ error: 'product_id requis.' });

    const recipe = await sql`
      SELECT pr.id, pr.quantity_per_unit::float,
             rm.id AS raw_material_id, rm.name, rm.unit,
             rm.quantity::float AS stock, rm.min_alert::float
      FROM product_recipes pr
      JOIN raw_materials rm ON rm.id = pr.raw_material_id
      WHERE pr.product_id = ${parseInt(product_id)} AND pr.company_id = ${companyId}
      ORDER BY rm.name ASC
    `;
    return res.status(200).json(recipe);
  }

  // POST — ajouter / mettre à jour un ingrédient dans la recette
  if (req.method === 'POST') {
    const { product_id, raw_material_id, quantity_per_unit } = req.body;

    // Vérifier que le produit appartient à l'entreprise
    const [product] = await sql`
      SELECT id FROM products WHERE id = ${product_id} AND company_id = ${companyId}
    `;
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });

    // Vérifier que la matière première appartient à l'entreprise
    const [rm] = await sql`
      SELECT id FROM raw_materials WHERE id = ${raw_material_id} AND company_id = ${companyId}
    `;
    if (!rm) return res.status(404).json({ error: 'Matière première introuvable.' });

    const qty = parseFloat(quantity_per_unit);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantité invalide.' });

    await sql`
      INSERT INTO product_recipes (company_id, product_id, raw_material_id, quantity_per_unit)
      VALUES (${companyId}, ${product_id}, ${raw_material_id}, ${qty})
      ON CONFLICT (product_id, raw_material_id)
      DO UPDATE SET quantity_per_unit = EXCLUDED.quantity_per_unit
    `;
    return res.status(201).json({ success: true });
  }

  // DELETE — retirer un ingrédient de la recette
  if (req.method === 'DELETE') {
    const { id } = req.body;
    await sql`DELETE FROM product_recipes WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
