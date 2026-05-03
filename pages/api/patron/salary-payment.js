// Enregistrement du paiement des salaires hebdomadaires
// POST → marque la semaine comme payée + déduit du solde bancaire
// GET  → statut semaine en cours + historique des 8 derniers paiements
import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

// Lundi de la semaine contenant `date`
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;
  const weekStart = getMonday(new Date()).toISOString().split('T')[0];

  // ── GET : statut + historique ─────────────────────────────────
  if (req.method === 'GET') {
    // Déjà payée cette semaine ?
    const [existing] = await sql`
      SELECT id, total_amount::float, paid_at
      FROM salary_payments
      WHERE company_id = ${companyId} AND week_start = ${weekStart}
    `;

    // Total à payer cette semaine (base = marge)
    const [totalRow] = await sql`
      WITH avg_prices AS (
        SELECT raw_material_id,
               SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
        FROM purchases
        WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
        GROUP BY raw_material_id
      ),
      product_costs AS (
        SELECT pr.product_id,
               COALESCE(SUM(pr.quantity_per_unit * COALESCE(ap.avg_unit_price, 0)), 0) AS cost_price
        FROM product_recipes pr
        LEFT JOIN avg_prices ap ON ap.raw_material_id = pr.raw_material_id
        WHERE pr.company_id = ${companyId}
        GROUP BY pr.product_id
      )
      SELECT COALESCE(SUM(
        GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))
        * u.salary_percent / 100
      ), 0)::float AS total
      FROM sales s
      JOIN  users u ON u.id = s.employee_id
      LEFT JOIN product_costs pc ON pc.product_id = s.product_id
      WHERE s.company_id = ${companyId}
        AND s.sale_date  >= DATE_TRUNC('week', NOW())
    `;

    // Historique des 10 derniers paiements
    const history = await sql`
      SELECT sp.id,
             sp.week_start,
             sp.total_amount::float,
             sp.paid_at,
             u.name AS paid_by_name
      FROM salary_payments sp
      LEFT JOIN users u ON u.id = sp.paid_by
      WHERE sp.company_id = ${companyId}
      ORDER BY sp.paid_at DESC
      LIMIT 10
    `;

    return res.status(200).json({
      weekStart,
      isPaid:      !!existing,
      paidAt:      existing?.paid_at   ?? null,
      paidAmount:  existing?.total_amount ?? null,
      totalToPay:  totalRow.total,
      history,
    });
  }

  // ── POST : enregistrer le paiement ───────────────────────────
  if (req.method === 'POST') {
    // Anti-doublon
    const [existing] = await sql`
      SELECT id FROM salary_payments
      WHERE company_id = ${companyId} AND week_start = ${weekStart}
    `;
    if (existing) return res.status(409).json({ error: 'Salaires déjà payés pour cette semaine.' });

    // Calculer le total (même CTE)
    const [totalRow] = await sql`
      WITH avg_prices AS (
        SELECT raw_material_id,
               SUM(total_amount) / NULLIF(SUM(quantity), 0) AS avg_unit_price
        FROM purchases
        WHERE company_id = ${companyId} AND raw_material_id IS NOT NULL
        GROUP BY raw_material_id
      ),
      product_costs AS (
        SELECT pr.product_id,
               COALESCE(SUM(pr.quantity_per_unit * COALESCE(ap.avg_unit_price, 0)), 0) AS cost_price
        FROM product_recipes pr
        LEFT JOIN avg_prices ap ON ap.raw_material_id = pr.raw_material_id
        WHERE pr.company_id = ${companyId}
        GROUP BY pr.product_id
      )
      SELECT COALESCE(SUM(
        GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))
        * u.salary_percent / 100
      ), 0)::float AS total
      FROM sales s
      JOIN  users u ON u.id = s.employee_id
      LEFT JOIN product_costs pc ON pc.product_id = s.product_id
      WHERE s.company_id = ${companyId}
        AND s.sale_date  >= DATE_TRUNC('week', NOW())
    `;

    const total = totalRow.total;
    if (total <= 0) return res.status(400).json({ error: 'Aucun salaire à payer cette semaine.' });

    // Enregistrer le paiement
    await sql`
      INSERT INTO salary_payments (company_id, week_start, total_amount, paid_by)
      VALUES (${companyId}, ${weekStart}, ${total}, ${parseInt(token.sub)})
    `;

    return res.status(200).json({ ok: true, total, weekStart });
  }

  return res.status(405).end();
}
