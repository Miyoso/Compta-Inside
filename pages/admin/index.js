import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && session.user.role !== 'admin') router.push('/');
  }, [status, session, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/overview');
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === 'authenticated') loadData();
  }, [status, loadData]);

  if (status === 'loading' || !session) return <div style={S.loadingPage}><div style={S.spinner} /></div>;
  if (loading || !data) return <div style={S.loadingPage}><div style={S.spinner} /></div>;

  const { companies, totals } = data;
  const weekLabel = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
  })();

  return (
    <>
      <Head><title>Administration — Compta-Inside</title></Head>
      <div style={S.page}>

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navLeft}>
            <span style={S.navLogo}>📊 Compta-Inside</span>
            <span style={S.navBadge}>⚙️ Administration IRS</span>
          </div>
          <div style={S.navRight}>
            <span style={S.navUser}>👤 {session.user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/' })} style={S.navBtn}>Déconnexion</button>
          </div>
        </nav>

        <main style={S.main}>

          {/* En-tête */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={S.pageTitle}>🏛️ Taxes IRS — Semaine du {weekLabel}</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                {companies.length} entreprise{companies.length > 1 ? 's' : ''} · Base = CA − salaires · Barème progressif hebdomadaire
              </p>
            </div>
            <button onClick={loadData} style={S.btnRefresh}>🔄 Actualiser</button>
          </div>

          {/* Barème rappel */}
          <div style={S.bracketBar}>
            {[
              { label: 'Exonéré', range: '< $15k', color: '#16a34a', bg: '#dcfce7' },
              { label: '10 %',    range: '$15k – $31k', color: '#d97706', bg: '#fef3c7' },
              { label: '20 %',    range: '$31k – $51k', color: '#ea580c', bg: '#ffedd5' },
              { label: '30 %',    range: '≥ $51k',      color: '#dc2626', bg: '#fee2e2' },
            ].map((b, i) => (
              <div key={i} style={{ flex: 1, background: b.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: b.color }}>{b.label}</div>
                <div style={{ fontSize: 12, color: b.color, opacity: 0.8 }}>{b.range}</div>
              </div>
            ))}
          </div>

          {/* KPIs globaux */}
          <div style={S.kpiGrid}>
            <div style={{ ...S.kpiCard, borderColor: '#dc2626' }}>
              <div style={S.kpiIcon}>🏛️</div>
              <div style={S.kpiLabel}>Total IRS dû cette semaine</div>
              <div style={{ ...S.kpiValue, color: '#dc2626', fontSize: 30 }}>{fmt(totals.globalWeekTax)}</div>
              <div style={S.kpiSub}>sur {fmt(totals.globalWeekSales)} de CA</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#7c3aed' }}>
              <div style={S.kpiIcon}>📅</div>
              <div style={S.kpiLabel}>IRS cumulé (5 semaines)</div>
              <div style={{ ...S.kpiValue, color: '#7c3aed' }}>{fmt(totals.globalTaxesDue)}</div>
              <div style={S.kpiSub}>semaine courante + 4 précédentes</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#16a34a' }}>
              <div style={S.kpiIcon}>🏢</div>
              <div style={S.kpiLabel}>Entreprises</div>
              <div style={{ ...S.kpiValue, color: '#16a34a' }}>{companies.length}</div>
              <div style={S.kpiSub}>{companies.reduce((a, c) => a + c.employeeCount, 0)} employés actifs</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#f59e0b' }}>
              <div style={S.kpiIcon}>⚠️</div>
              <div style={S.kpiLabel}>Alertes stock</div>
              <div style={{ ...S.kpiValue, color: '#d97706' }}>{companies.reduce((a, c) => a + c.stockAlerts, 0)}</div>
              <div style={S.kpiSub}>matières premières en stock bas</div>
            </div>
          </div>

          {/* Tableau récap taxes hebdo */}
          <div style={S.section}>
            <h2 style={S.sectionTitle}>Taxes IRS dues cette semaine par entreprise</h2>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Entreprise</th>
                    <th style={S.th}>CA semaine</th>
                    <th style={S.th}>− Achats</th>
                    <th style={S.th}>− Salaires</th>
                    <th style={S.th}>Base imposable</th>
                    <th style={S.th}>Tranche</th>
                    <th style={S.th}>Taxe IRS due</th>
                    <th style={S.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {c.patronCount} patron · {c.employeeCount} employé{c.employeeCount !== 1 ? 's' : ''}
                          {c.pendingCount > 0 && <span style={{ color: '#f59e0b' }}> · ⏳ {c.pendingCount}</span>}
                        </div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmt(c.weekSales)}</td>
                      <td style={{ ...S.td, color: '#d97706' }}>− {fmt(c.weekPurchases)}</td>
                      <td style={{ ...S.td, color: '#7c3aed' }}>− {fmt(c.weekSalaries)}</td>
                      <td style={S.td}>{fmt(c.weekNet)}</td>
                      <td style={{ ...S.td, fontSize: 12 }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 8, fontWeight: 600,
                          background: c.weekTaxRate === 0 ? '#dcfce7' : c.weekTaxRate === 0.10 ? '#fef3c7' : c.weekTaxRate === 0.20 ? '#ffedd5' : '#fee2e2',
                          color:      c.weekTaxRate === 0 ? '#16a34a' : c.weekTaxRate === 0.10 ? '#d97706' : c.weekTaxRate === 0.20 ? '#ea580c' : '#dc2626',
                        }}>{c.weekBracket}</span>
                      </td>
                      <td style={S.td}>
                        <span style={{
                          display: 'inline-block', padding: '5px 12px', borderRadius: 20,
                          fontWeight: 800, fontSize: 15,
                          background: c.weekTaxAmount > 0 ? '#fee2e2' : '#f1f5f9',
                          color:      c.weekTaxAmount > 0 ? '#dc2626' : '#94a3b8',
                        }}>{fmt(c.weekTaxAmount)}</span>
                      </td>
                      <td style={S.td}>
                        {c.weekTaxAmount > 0
                          ? <span style={{ ...S.badge, background: '#fee2e2', color: '#dc2626' }}>💰 À payer</span>
                          : <span style={{ ...S.badge, background: '#dcfce7', color: '#16a34a' }}>✅ Exonéré</span>
                        }
                        {c.stockAlerts > 0 && <span style={{ ...S.badge, background: '#fef3c7', color: '#d97706', marginLeft: 6 }}>⚠️ Stock</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1e1b4b', color: '#fff' }}>
                    <td style={{ ...S.td, color: '#fff', fontWeight: 700 }}>TOTAL IRS À PERCEVOIR</td>
                    <td style={{ ...S.td, color: '#a5b4fc', fontWeight: 700 }}>{fmt(totals.globalWeekSales)}</td>
                    <td style={{ ...S.td, color: '#c4b5fd' }}>—</td>
                    <td style={{ ...S.td, color: '#c4b5fd' }}>—</td>
                    <td colSpan={2} style={{ ...S.td, color: '#a5b4fc' }}>—</td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 20, fontWeight: 900, fontSize: 18, background: '#dc2626', color: '#fff' }}>
                        {fmt(totals.globalWeekTax)}
                      </span>
                    </td>
                    <td style={S.td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Fiches détaillées par entreprise */}
          <h2 style={{ ...S.sectionTitle, marginTop: 36 }}>📋 Détail & historique par entreprise</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {companies.map((c) => <CompanyCard key={c.id} company={c} />)}
          </div>

        </main>
      </div>
    </>
  );
}

// ── Fiche entreprise dépliable ────────────────────────────────
function CompanyCard({ company: c }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={S.companyCard}>
      <div style={S.companyHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.companyIcon}>🏢</div>
          <div>
            <div style={S.companyName}>{c.name}</div>
            <div style={S.companySub}>
              {c.patronCount} patron · {c.employeeCount} employé{c.employeeCount !== 1 ? 's' : ''}
              {c.pendingCount > 0 && <span style={{ color: '#f59e0b' }}> · ⏳ {c.pendingCount} en attente</span>}
              {c.stockAlerts > 0 && <span style={{ color: '#d97706' }}> · ⚠️ {c.stockAlerts} alerte stock</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>IRS cette semaine</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.weekTaxAmount > 0 ? '#dc2626' : '#94a3b8' }}>{fmt(c.weekTaxAmount)}</div>
          </div>
          <div style={{ fontSize: 20, color: '#94a3b8' }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div style={S.companyBody}>
          {/* KPIs semaine courante */}
          <div style={S.miniKpiGrid}>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>CA semaine</div><div style={S.miniKpiValue}>{fmt(c.weekSales)}</div></div>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>− Achats semaine</div><div style={{ ...S.miniKpiValue, color: '#d97706' }}>− {fmt(c.weekPurchases)}</div></div>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>− Salaires semaine</div><div style={{ ...S.miniKpiValue, color: '#7c3aed' }}>− {fmt(c.weekSalaries)}</div></div>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>= Base imposable</div><div style={{ ...S.miniKpiValue, color: '#1e293b' }}>{fmt(c.weekNet)}</div></div>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>Taxe IRS ({(c.weekTaxRate * 100).toFixed(0)}%)</div><div style={{ ...S.miniKpiValue, color: '#dc2626' }}>{fmt(c.weekTaxAmount)}</div></div>
            <div style={S.miniKpi}><div style={S.miniKpiLabel}>IRS cumulé (5 sem.)</div><div style={{ ...S.miniKpiValue, color: '#7c3aed' }}>{fmt(c.totalTaxesDue)}</div></div>
          </div>

          {/* Historique 4 semaines précédentes */}
          {c.prevWeeks && c.prevWeeks.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Historique — 4 semaines précédentes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {c.prevWeeks.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b', minWidth: 80 }}>Sem. {fmtDate(w.weekStart)}</span>
                    <span style={{ fontSize: 13 }}>CA : <strong>{fmt(w.sales)}</strong></span>
                    <span style={{ fontSize: 13, color: '#7c3aed' }}>Sal : − {fmt(w.salaries)}</span>
                    <span style={{ fontSize: 13 }}>Base : {fmt(w.net)}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{w.bracket}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: w.tax > 0 ? '#dc2626' : '#94a3b8', fontSize: 14 }}>{fmt(w.tax)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini graphique CA mensuel */}
          {c.monthlySales && c.monthlySales.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>CA mensuel (6 derniers mois)</div>
              <MiniBarChart data={c.monthlySales} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini graphique ────────────────────────────────────────────
function MiniBarChart({ data }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {data.map((d, i) => {
        const height = Math.max(4, (d.total / max) * 72);
        const month  = new Date(d.month).toLocaleString('fr-FR', { month: 'short' });
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              {new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 0 }).format(d.total)}
            </div>
            <div style={{ width: '100%', height, background: 'linear-gradient(180deg, #4f46e5, #7c3aed)', borderRadius: '4px 4px 0 0' }} />
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{month}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  page:        { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', Arial, sans-serif" },
  loadingPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' },
  spinner:     { width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: '4px solid #7c3aed', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  nav:      { background: '#1e1b4b', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  navLeft:  { display: 'flex', alignItems: 'center', gap: 14 },
  navLogo:  { fontWeight: 700, fontSize: 18, color: '#fff' },
  navBadge: { background: '#7c3aed', color: '#fff', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser:  { color: '#a5b4fc', fontSize: 14 },
  navBtn:   { padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 },

  main:         { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  pageTitle:    { fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 },
  section:      { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 },
  btnRefresh:   { padding: '8px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },

  bracketBar: { display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' },

  kpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 },
  kpiCard:  { background: '#fff', borderRadius: 14, padding: 22, border: '2px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  kpiIcon:  { fontSize: 28, marginBottom: 8 },
  kpiLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  kpiValue: { fontSize: 26, fontWeight: 800, color: '#1e293b' },
  kpiSub:   { fontSize: 12, color: '#94a3b8', marginTop: 4 },

  tableWrap: { overflowX: 'auto', borderRadius: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)' },
  table:     { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 14, overflow: 'hidden' },
  th:        { background: '#1e1b4b', color: '#c4b5fd', padding: '13px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  tr:        { borderBottom: '1px solid #f1f5f9' },
  td:        { padding: '14px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },
  badge:     { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },

  companyCard:   { background: '#fff', borderRadius: 14, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', overflow: 'hidden' },
  companyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' },
  companyIcon:   { width: 44, height: 44, borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 },
  companyName:   { fontWeight: 700, fontSize: 16, color: '#1e293b' },
  companySub:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  companyBody:   { padding: '20px 24px', background: '#fafbff' },

  miniKpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  miniKpi:      { background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' },
  miniKpiLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' },
  miniKpiValue: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
};
