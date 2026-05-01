import { getToken } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import sql from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caractères.' });
  }

  const [user] = await sql`SELECT id, password_hash FROM users WHERE id = ${token.id}`;
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect.' });

  const newHash = await bcrypt.hash(newPassword, 12);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${token.id}`;

  return res.status(200).json({ success: true });
}
