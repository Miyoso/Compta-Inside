import bcrypt from 'bcryptjs';
import sql from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { name, email, password, companyId } = req.body;

  // Validation des champs
  if (!name || !email || !password || !companyId) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 6 caractères.' });
  }

  // Vérification que l'email n'est pas déjà utilisé
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
  }

  // Vérification que l'entreprise existe
  const company = await sql`SELECT id FROM companies WHERE id = ${companyId} LIMIT 1`;
  if (company.length === 0) {
    return res.status(400).json({ error: 'Entreprise introuvable.' });
  }

  // Hashage du mot de passe
  const passwordHash = await bcrypt.hash(password, 12);

  // Création de l'utilisateur
  await sql`
    INSERT INTO users (name, email, password_hash, role, company_id)
    VALUES (${name}, ${email}, ${passwordHash}, 'employee', ${companyId})
  `;

  return res.status(201).json({ success: true });
}
