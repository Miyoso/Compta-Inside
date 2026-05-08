import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

/**
 * GET /api/patron/my-companies
 * Retourne toutes les entreprises où l'utilisateur a un rôle patron ou admin.
 * Permet au front de proposer un sélecteur si l'utilisateur est patron de plusieurs boîtes.
 */
export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role))
    return res.status(403).json({ error: 'Accès refusé' });
  if (req.method !== 'GET') return res.status(405).end();

  // On cherche toutes les entreprises qui ont au moins un utilisateur
  // avec le même email ET role=patron (pour le cas où le patron a plusieurs comptes)
  // Sinon on renvoie juste sa propre entreprise.
  const userEmail = token.email || '';

  let companies;
  if (userEmail) {
    companies = await sql`
      SELECT DISTINCT c.id, c.name, COALESCE(c.company_type, 'cafe') AS company_type
      FROM companies c
      JOIN users u ON u.company_id = c.id
      WHERE u.email = ${userEmail}
        AND u.role IN ('patron', 'admin')
        AND u.status = 'approved'
      ORDER BY c.name
    `;
  } else {
    companies = await sql`
      SELECT id, name, COALESCE(company_type, 'cafe') AS company_type
      FROM companies WHERE id = ${token.companyId}
    `;
  }

  return res.status(200).json({ companies });
}
