import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // GET — comptes en attente de validation pour cette entreprise
  if (req.method === 'GET') {
    const pending = await sql`
      SELECT u.id, u.name, u.email, u.created_at, u.status
      FROM users u
      WHERE u.company_id = ${companyId}
        AND u.status IN ('pending', 'rejected')
      ORDER BY u.created_at DESC
    `;
    return res.status(200).json(pending);
  }

  // PUT — approuver ou rejeter un compte
  if (req.method === 'PUT') {
    const { id, action } = req.body; // action: 'approve' | 'reject'

    if (!id || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide.' });
    }

    // Vérifier que l'utilisateur appartient bien à la même entreprise
    const [user] = await sql`
      SELECT id FROM users WHERE id = ${id} AND company_id = ${companyId}
    `;
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const newStatus = action === 'approve' ? 'active' : 'rejected';
    await sql`UPDATE users SET status = ${newStatus} WHERE id = ${id}`;

    return res.status(200).json({ success: true, status: newStatus });
  }

  return res.status(405).end();
}
