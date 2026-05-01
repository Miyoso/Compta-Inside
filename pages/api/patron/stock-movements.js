import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const companyId = token.companyId;
  const { raw_material_id, limit = 60 } = req.query;

  const movements = raw_material_id
    ? await sql`
        SELECT sm.id, sm.movement_type, sm.quantity_change::float,
               sm.quantity_after::float, sm.reference_id, sm.reference_label,
               sm.created_at,
               rm.name AS material_name, rm.unit AS material_unit
        FROM stock_movements sm
        JOIN raw_materials rm ON rm.id = sm.raw_material_id
        WHERE sm.company_id = ${companyId}
          AND sm.raw_material_id = ${parseInt(raw_material_id)}
        ORDER BY sm.created_at DESC
        LIMIT ${parseInt(limit)}
      `
    : await sql`
        SELECT sm.id, sm.movement_type, sm.quantity_change::float,
               sm.quantity_after::float, sm.reference_id, sm.reference_label,
               sm.created_at,
               rm.name AS material_name, rm.unit AS material_unit
        FROM stock_movements sm
        JOIN raw_materials rm ON rm.id = sm.raw_material_id
        WHERE sm.company_id = ${companyId}
        ORDER BY sm.created_at DESC
        LIMIT ${parseInt(limit)}
      `;

  return res.status(200).json(movements);
}
