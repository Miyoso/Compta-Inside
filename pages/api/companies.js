import sql from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const companies = await sql`SELECT id, name FROM companies ORDER BY name ASC`;
  return res.status(200).json(companies);
}
