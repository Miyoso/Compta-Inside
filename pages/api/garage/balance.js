import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).end();
  const companyId = token.companyId;

  if (req.method === 'POST') {
    const { balance } = req.body;
    await sql`UPDATE companies SET account_balance = ${balance}, balance_set_at = NOW() WHERE id = ${companyId}`;
    return res.json({ ok: true });
  }
  res.status(405).end();
}
