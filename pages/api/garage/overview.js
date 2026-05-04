import { getToken } from 'next-auth/jwt';
import sql from '../../../lib/db';
import { computeTax } from '../../../lib/tax';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return res.status(401).end();
  const companyId = token.companyId;

  // Revenus : devis validés de la semaine courante
  const [rev] = await sql`
    SELECT
      COALESCE(SUM(grand_total) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW())), 0)                           AS week_revenue,
      COALESCE(SUM(grand_total) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())), 0)      AS month_revenue,
      COALESCE(SUM(grand_total) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW()) - INTERVAL '7 days'
                                          AND created_at <  DATE_TRUNC('week', NOW())), 0)                           AS prev_week_revenue,
      COUNT(*)    FILTER (WHERE created_at >= DATE_TRUNC('week', NOW()))                                             AS week_count,
      COUNT(*)    FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW()))                        AS month_count
    FROM garage_quotes WHERE company_id = ${companyId}
  `;

  // Dépenses de la semaine
  const [exp] = await sql`
    SELECT COALESCE(SUM(amount) FILTER (WHERE expense_date >= DATE_TRUNC('week', NOW())), 0)    AS week_expenses,
           COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', NOW())), 0) AS month_expenses
    FROM garage_expenses WHERE company_id = ${companyId}
  `;

  // Salaires payés cette semaine
  const [sal] = await sql`
    SELECT COALESCE(SUM(total_amount) FILTER (WHERE paid_at >= DATE_TRUNC('week', NOW())), 0) AS week_salaries
    FROM salary_payments WHERE company_id = ${companyId}
  `;

  // Solde bancaire
  const [comp] = await sql`
    SELECT account_balance, balance_set_at FROM companies WHERE id = ${companyId}
  `;
  const refBalance = Number(comp?.account_balance || 0);
  const refDate    = comp?.balance_set_at || new Date(0);
  const [balData] = await sql`
    SELECT
      COALESCE(SUM(gq.grand_total) FILTER (WHERE gq.created_at >= ${refDate}), 0) AS revenue_since,
      COALESCE(SUM(ge.amount)      FILTER (WHERE ge.expense_date >= ${refDate}::date), 0) AS expenses_since,
      COALESCE((SELECT SUM(total_amount) FROM salary_payments WHERE company_id = ${companyId} AND paid_at >= ${refDate}), 0) AS salaries_since
    FROM garage_quotes gq
    FULL OUTER JOIN garage_expenses ge ON ge.company_id = gq.company_id AND FALSE
    WHERE COALESCE(gq.company_id, ge.company_id) = ${companyId}
  `;

  // Sparkline 8 semaines
  const sparkRows = await sql`
    SELECT week_start,
      COALESCE(SUM(revenue),0) AS revenue,
      COALESCE(SUM(expenses),0) AS expenses,
      COALESCE(SUM(salaries),0) AS salaries
    FROM (
      SELECT DATE_TRUNC('week', created_at)::date AS week_start, grand_total AS revenue, 0 AS expenses, 0 AS salaries
      FROM garage_quotes WHERE company_id = ${companyId} AND created_at >= NOW() - INTERVAL '8 weeks'
      UNION ALL
      SELECT DATE_TRUNC('week', expense_date)::date, 0, amount, 0
      FROM garage_expenses WHERE company_id = ${companyId} AND expense_date >= NOW() - INTERVAL '8 weeks'
      UNION ALL
      SELECT DATE_TRUNC('week', paid_at)::date, 0, 0, total_amount
      FROM salary_payments WHERE company_id = ${companyId} AND paid_at >= NOW() - INTERVAL '8 weeks'
    ) t
    GROUP BY week_start ORDER BY week_start
  `;

  const weekRevenue   = Number(rev.week_revenue);
  const weekExpenses  = Number(exp.week_expenses);
  const weekSalaries  = Number(sal.week_salaries);
  const weekNet       = weekRevenue - weekExpenses - weekSalaries;
  const { rate: weekTaxRate, amount: weekTaxAmount, bracket: weekBracket } = computeTax(Math.max(0, weekNet));

  const revSince = Number(balData?.revenue_since || 0);
  const expSince = Number(balData?.expenses_since || 0);
  const salSince = Number(balData?.salaries_since || 0);
  const currentBalance = refBalance + revSince - expSince - salSince;

  const weeklyHistory = sparkRows.map(r => ({
    week_start: r.week_start,
    delta: Number(r.revenue) - Number(r.expenses) - Number(r.salaries),
  }));

  res.json({
    weekRevenue, weekExpenses, weekSalaries, weekNet,
    weekTaxRate, weekTaxAmount, weekBracket,
    monthRevenue: Number(rev.month_revenue),
    weekCount: Number(rev.week_count),
    monthCount: Number(rev.month_count),
    prevWeekRevenue: Number(rev.prev_week_revenue),
    balance: { currentBalance, refBalance, revSince, expSince, salSince, refDate, weeklyHistory },
  });
}
