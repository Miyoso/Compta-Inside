import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — liste des matières premières
  if (req.method === 'GET') {
    const materials = await sql`
      SELECT id, name, unit, quantity::float, min_alert::float
      FROM raw_materials
      WHERE company_id = ${companyId}
      ORDER BY name ASC
    `;
    return res.status(200).json(materials);
  }

  // POST — ajouter une matière première
  if (req.method === 'POST') {
    const { name, unit, quantity, min_alert } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom obligatoire.' });
    const [m] = await sql`
      INSERT INTO raw_materials (company_id, name, unit, quantity, min_alert)
      VALUES (${companyId}, ${name}, ${unit || 'unité'}, ${quantity || 0}, ${min_alert || 5})
      RETURNING id, name, unit, quantity::float, min_alert::float
    `;
    return res.status(201).json(m);
  }

  // PUT — modifier une matière première (nom, unité, seuil) ou ajuster le stock
  if (req.method === 'PUT') {
    const { id, name, unit, quantity, min_alert } = req.body;
    await sql`
      UPDATE raw_materials
      SET name      = COALESCE(${name}, name),
          unit      = COALESCE(${unit}, unit),
          quantity  = COALESCE(${quantity !== undefined ? quantity : null}::numeric, quantity),
          min_alert = COALESCE(${min_alert !== undefined ? min_alert : null}::numeric, min_alert)
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  // DELETE — supprimer une matière première
  if (req.method === 'DELETE') {
    const { id } = req.body;
    await sql`DELETE FROM raw_materials WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
