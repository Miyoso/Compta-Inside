import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';

export default async function handler(req, res) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || !['patron', 'admin'].includes(token.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const companyId = token.companyId;

  // ── GET ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Calcul des coûts de revient par produit (prix moyen pondéré des achats)
    // puis marge par vente = total_vente − quantité × coût_unitaire
    // Le salaire est calculé sur la MARGE, pas sur le CA brut.
    const employees = await sql`
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
      ),
      -- Semaine en cours
      week_data AS (
        SELECT s.employee_id,
               COALESCE(SUM(s.total_amount), 0)::float                                                                   AS gross_sales,
               COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float     AS margin
        FROM sales s
        LEFT JOIN product_costs pc ON pc.product_id = s.product_id
        WHERE s.company_id = ${companyId}
          AND s.sale_date >= DATE_TRUNC('week', NOW())
        GROUP BY s.employee_id
      ),
      -- Mois en cours
      month_data AS (
        SELECT s.employee_id,
               COALESCE(SUM(s.total_amount), 0)::float                                                                   AS gross_sales,
               COALESCE(SUM(GREATEST(0, s.total_amount - s.quantity::float * COALESCE(pc.cost_price, 0))), 0)::float     AS margin
        FROM sales s
        LEFT JOIN product_costs pc ON pc.product_id = s.product_id
        WHERE s.company_id = ${companyId}
          AND DATE_TRUNC('month', s.sale_date) = DATE_TRUNC('month', NOW())
        GROUP BY s.employee_id
      )
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.salary_percent::float,
        -- Semaine
        COALESCE(wd.gross_sales, 0)::float                                       AS week_sales,
        COALESCE(wd.margin, 0)::float                                            AS week_margin,
        (COALESCE(wd.margin, 0) * u.salary_percent / 100)::float                AS week_salary,
        -- Mois
        COALESCE(md.gross_sales, 0)::float                                       AS total_sales,
        COALESCE(md.margin, 0)::float                                            AS total_margin,
        (COALESCE(md.margin, 0) * u.salary_percent / 100)::float                AS salary_due
      FROM users u
      LEFT JOIN week_data  wd ON wd.employee_id  = u.id
      LEFT JOIN month_data md ON md.employee_id  = u.id
      WHERE u.company_id = ${companyId}
        AND u.status = 'active'
      ORDER BY week_salary DESC, u.name ASC
    `;
    return res.status(200).json(employees);
  }

  // ── PUT : modifier le % de salaire ──────────────────────────
  if (req.method === 'PUT') {
    const { id, salary_percent } = req.body;
    if (salary_percent == null || salary_percent < 0 || salary_percent > 100) {
      return res.status(400).json({ error: 'Pourcentage invalide (0-100).' });
    }
    await sql`
      UPDATE users SET salary_percent = ${salary_percent}
      WHERE id = ${id} AND company_id = ${companyId}
    `;
    return res.status(200).json({ success: true });
  }

  // ── DELETE : virer un employé ────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID manquant.' });
    const [target] = await sql`SELECT id, role FROM users WHERE id = ${id} AND company_id = ${companyId}`;
    if (!target) return res.status(404).json({ error: 'Employé introuvable.' });
    if (target.role === 'patron' && token.role !== 'admin') {
      return res.status(403).json({ error: 'Impossible de virer un patron.' });
    }
    await sql`UPDATE users SET status = 'inactive' WHERE id = ${id} AND company_id = ${companyId}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
