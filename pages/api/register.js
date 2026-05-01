import bcrypt from 'bcryptjs';
import sql from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { name, username, password, companyId } = req.body;

  if (!name || !username || !password || !companyId) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'L\'identifiant doit faire entre 3 et 30 caractères.' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'L\'identifiant ne peut contenir que des lettres, chiffres et underscores.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  // Vérification que l'identifiant n'est pas déjà pris
  const existingUsername = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
  if (existingUsername.length > 0) {
    return res.status(409).json({ error: 'Cet identifiant est déjà pris. Choisis-en un autre.' });
  }

  // Vérification que l'entreprise existe
  const company = await sql`SELECT id FROM companies WHERE id = ${companyId} LIMIT 1`;
  if (company.length === 0) {
    return res.status(400).json({ error: 'Entreprise introuvable.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // email généré automatiquement (non utilisé pour la connexion)
  const fakeEmail = `${username.toLowerCase()}@compta-inside.local`;

  await sql`
    INSERT INTO users (name, username, email, password_hash, role, company_id, status)
    VALUES (${name}, ${username}, ${fakeEmail}, ${passwordHash}, 'employee', ${companyId}, 'pending')
  `;

  return res.status(201).json({ success: true, pending: true });
}
