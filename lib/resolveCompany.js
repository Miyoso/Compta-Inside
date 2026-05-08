import sql from './db';

/**
 * Résout l'entreprise à utiliser pour les APIs patron.
 * Si ?cid= est fourni, vérifie que l'utilisateur est bien patron de cette entreprise.
 * Sinon, retourne le companyId du JWT.
 *
 * @param {object} req   - Next.js request
 * @param {object} token - JWT token from getToken()
 * @returns {number|null} companyId résolu, ou null si accès refusé
 */
export async function resolveCompanyId(req, token) {
  const requestedCid = req.query?.cid ? parseInt(req.query.cid) : null;

  // Pas de surcharge demandée → retourner le companyId du JWT
  if (!requestedCid || requestedCid === token.companyId) {
    return token.companyId;
  }

  // Vérifier que l'utilisateur a bien un rôle patron pour cette entreprise
  const userEmail = token.email;
  if (!userEmail) return null;

  const [row] = await sql`
    SELECT u.id FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.email = ${userEmail}
      AND u.company_id = ${requestedCid}
      AND u.role IN ('patron', 'admin')
      AND u.status = 'approved'
    LIMIT 1
  `;

  if (!row) return null; // Accès refusé
  return requestedCid;
}
