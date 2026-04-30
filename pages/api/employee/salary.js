// Salaire hebdomadaire de l'employé connecté — semaine en cours + 4 précédentes
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).json({ error: 'Non connecté.' });
  if (req.method !== 'GET') return res.status(405).end();

  const employeeId = parseInt(token.sub);
  const companyId  = token.companyId;

  // Récupérer le % de salaire de l'employé
  const [user] = await sql`
    SELECT salary_percent::float FROM users WHERE id = ${employeeId}
  `;
  const salaryPercent = user?.salary_percent ?? 0;

  // Ventes des 5 dernières semaines (lundi → dimanche), regroupées par semaine
  const rows = await sql`
    SELECT
      DATE_TRUNC('week', sale_date)            AS week_start,
      COALESCE(SUM(total_amount), 0)::float    AS total_sales,
      COUNT(*)::int                            AS nb_sales
    FROM sales
    WHERE employee_id = ${employeeId}
      AND company_id  = ${companyId}
      AND sale_date  >= DATE_TRUNC('week', NOW()) - INTERVAL '4 weeks'
    GROUP BY week_start
    ORDER BY week_start DESC
  `;

  // Construire les 5 semaines (même si certaines sont vides)
  const weeks = [];
  for (let i = 0; i < 5; i++) {
    const weekStart = new Date();
    // Lundi de la semaine i (0 = semaine en cours)
    const day = weekStart.getDay(); // 0=dim, 1=lun...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    weekStart.setDate(weekStart.getDate() + diffToMonday - i * 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const isoStart = weekStart.toISOString();
    const matched  = rows.find((r) => {
      const d = new Date(r.week_start);
      return d.toDateString() === weekStart.toDateString();
    });

    weeks.push({
      label:       i === 0 ? 'Cette semaine' : `Semaine du ${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
      week_start:  weekStart.toISOString(),
      week_end:    weekEnd.toISOString(),
      total_sales: matched?.total_sales ?? 0,
      nb_sales:    matched?.nb_sales    ?? 0,
      salary:      ((matched?.total_sales ?? 0) * salaryPercent) / 100,
      is_current:  i === 0,
    });
  }

  return res.status(200).json({ salaryPercent, weeks });
}
