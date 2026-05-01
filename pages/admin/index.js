import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('current'); // 'current' | 'all'

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

  return (
    <>
      <Head><title>Administration — Compta-Inside</title></Head>
      <div style={S.page}>

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navLeft}>
            <span style={S.navLogo}>📊 Compta-Inside</span>
            <span style={S.navBadge}>⚙️ Administration</span>
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
              <h1 style={S.pageTitle}>Vue d'ensemble — Toutes les entreprises</h1>
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })} · {companies.length} entreprise{companies.length > 1 ? 's' : ''} enregistrée{companies.length > 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={loadData} style={S.btnRefresh}>🔄 Actualiser</button>
          </div>

          {/* KPIs globaux */}
          <div style={S.kpiGrid}>
            <div style={{ ...S.kpiCard, borderColor: '#2563eb' }}>
              <div style={S.kpiIcon}>💵</div>
              <div style={S.kpiLabel}>CA total ce mois</div>
              <div style={S.kpiValue}>{fmt(totals.globalSales)}</div>
              <div style={S.kpiSub}>Cumulé : {fmt(totals.globalSalesAll)}</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#dc2626' }}>
              <div style={S.kpiIcon}>🏛️</div>
              <div style={S.kpiLabel}>Impôts dus ce mois</div>
              <div style={{ ...S.kpiValue, color: '#dc2626' }}>{fmt(totals.globalTaxes)}</div>
              <div style={S.kpiSub}>Cumulé : {fmt(totals.globalTaxesAll)}</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#16a34a' }}>
              <div style={S.kpiIcon}>🏢</div>
              <div style={S.kpiLabel}>Entreprises actives</div>
              <div style={{ ...S.kpiValue, color: '#16a34a' }}>{companies.length}</div>
              <div style={S.kpiSub}>{companies.reduce((a, c) => a + c.employeeCount, 0)} employés au total</div>
            </div>
            <div style={{ ...S.kpiCard, borderColor: '#f59e0b' }}>
              <div style={S.kpiIcon}>⚠️</div>
              <div style={S.kpiLabel}>Alertes stock globales</div>
              <div style={{ ...S.kpiValue, color: '#d97706' }}>{companies.reduce((a, c) => a + c.stockAlerts, 0)}</div>
              <div style={S.kpiSub}>matières premières en stock bas</div>
            </div>
          </div>

          {/* Tableau récapitulatif des impôts dus */}
          <div style={S.section}>
            <h2 style={S.sectionTitle}>🏛️ Impôts dus par entreprise</h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
              Calculés sur la base imposable = CA du mois − achats matières premières, taux 15%.
            </p>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Entreprise</th>
                    <th style={S.th}>CA du mois</th>
                    <th style={S.th}>Achats déduits</th>
                    <th style={S.th}>Base imposable</th>
                    <th style={S.th}>Impôts dus (15%)</th>
                    <th style={S.th}>Impôts cumulés</th>
                    <th style={S.th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} style={S.tr}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {c.patronCount} patron{c.patronCount > 1 ? 's' : ''} · {c.employeeCount} employé{c.employeeCount > 1 ? 's' : ''}
                          {c.pendingCount > 0 && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· ⏳ {c.pendingCount} en attente</span>}
                        </div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 600 }}>{fmt(c.totalSales)}</td>
                      <td style={{ ...S.td, color: '#d97706' }}>− {fmt(c.totalPurchases)}</td>
                      <td style={S.td}>{fmt(c.taxableBase)}</td>
                      <td style={{ ...S.td }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '5px 12px',
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 15,
                          background: c.taxes > 0 ? '#fee2e2' : '#f1f5f9',
                          color: c.taxes > 0 ? '#dc2626' : '#94a3b8',
                        }}>
                          {fmt(c.taxes)}
                        </span>
                      </td>
                      <td style={{ ...S.td, color: '#7c3aed', fontWeight: 600 }}>{fmt(c.totalTaxesAll)}</td>
                      <td style={S.td}>
                        {c.taxes > 0
                          ? <span style={{ ...S.badge, background: '#fee2e2', color: '#dc2626' }}>💰 À payer</span>
                          : <span style={{ ...S.badge, background: '#f1f5f9', color: '#94a3b8' }}>✅ Rien ce mois</span>
                        }
                        {c.stockAlerts > 0 && (
                          <span style={{ ...S.badge, background: '#fef3c7', color: '#d97706', marginLeft: 6 }}>⚠️ Stock bas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Ligne total */}
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td style={{ ...S.td, fontWeight: 700, color: '#1e293b' }}>TOTAL</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{fmt(totals.globalSales)}</td>
                    <td style={{ ...S.td, color: '#d97706', fontWeight: 700 }}>− {fmt(companies.reduce((a, c) => a + c.totalPurchases, 0))}</td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{fmt(companies.reduce((a, c) => a + c.taxableBase, 0))}</td>
                    <td style={S.td}>
                      <span style={{ display: 'inline-block', padding: '5px 12px', borderRadius: 20, fontWeight: 800, fontSize: 16, background: '#fee2e2', color: '#dc2626' }}>
                        {fmt(totals.globalTaxes)}
                      </span>
                    </td>
                    <td style={{ ...S.td, color: '#7c3aed', fontWeight: 800, fontSize: 16 }}>{fmt(totals.globalTaxesAll)}</td>
                    <td style={S.td} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Fiches détaillées par entreprise */}
          <h2 style={{ ...S.sectionTitle, marginTop: 36 }}>📋 Détail par entreprise</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>

        </main>
      </div>
    </>
  );
}

// ── Carte détaillée par entreprise ────────────────────────────
function CompanyCard({ company: c }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={S.companyCard}>
      {/* En-tête cliquable */}
      <div style={S.companyHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.companyIcon}>🏢</div>
          <div>
            <div style={S.companyName}>{c.name}</div>
            <div style={S.companySub}>
              {c.patronCount} patron{c.patronCount > 1 ? 's' : ''} · {c.employeeCount} employé{c.employeeCount > 1 ? 's' : ''}
              {c.pendingCount > 0 && <span style={{ color: '#f59e0b' }}> · ⏳ {c.pendingCount} en attente</span>}
              {c.stockAlerts > 0 && <span style={{ color: '#d97706' }}> · ⚠️ {c.stockAlerts} alerte(s) stock</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>Impôts ce mois</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.taxes > 0 ? '#dc2626' : '#94a3b8' }}>{fmt(c.taxes)}</div>
          </div>
          <div style={{ fontSize: 20, color: '#94a3b8' }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Détails dépliables */}
      {open && (
        <div style={S.companyBody}>
          {/* KPIs internes */}
          <div style={S.miniKpiGrid}>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>CA du mois</div>
              <div style={S.miniKpiValue}>{fmt(c.totalSales)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Achats matières</div>
              <div style={{ ...S.miniKpiValue, color: '#d97706' }}>− {fmt(c.totalPurchases)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Base imposable</div>
              <div style={S.miniKpiValue}>{fmt(c.taxableBase)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Impôts dus</div>
              <div style={{ ...S.miniKpiValue, color: '#dc2626' }}>{fmt(c.taxes)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Salaires du mois</div>
              <div style={{ ...S.miniKpiValue, color: '#7c3aed' }}>{fmt(c.totalSalaries)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Bénéfice net</div>
              <div style={{ ...S.miniKpiValue, color: c.netRevenue >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(c.netRevenue)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>CA cumulé (total)</div>
              <div style={S.miniKpiValue}>{fmt(c.totalSalesAll)}</div>
            </div>
            <div style={S.miniKpi}>
              <div style={S.miniKpiLabel}>Impôts cumulés</div>
              <div style={{ ...S.miniKpiValue, color: '#7c3aed' }}>{fmt(c.totalTaxesAll)}</div>
            </div>
          </div>

          {/* Mini graphique barres CA mensuel */}
          {c.monthlySales.length > 0 && (
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

// ── Mini graphique barres ─────────────────────────────────────
function MiniBarChart({ data }) {
  const max = Math.max(...data.map(d => d.total), 1);
  const monthLabel = (iso) => new Date(iso).toLocaleString('fr-FR', { month: 'short' });

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
      {data.map((d, i) => {
        const height = Math.max(4, (d.total / max) * 72);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>
              {new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 0 }).format(d.total)}
            </div>
            <div
              title={`${monthLabel(d.month)} : ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(d.total)}`}
              style={{ width: '100%', height, background: 'linear-gradient(180deg, #2563eb, #3b82f6)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }}
            />
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{monthLabel(d.month)}</div>
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

  nav:        { background: '#1e1b4b', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  navLeft:    { display: 'flex', alignItems: 'center', gap: 14 },
  navLogo:    { fontWeight: 700, fontSize: 18, color: '#fff' },
  navBadge:   { background: '#7c3aed', color: '#fff', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  navRight:   { display: 'flex', alignItems: 'center', gap: 12 },
  navUser:    { color: '#a5b4fc', fontSize: 14 },
  navBtn:     { padding: '6px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 },

  main:       { maxWidth: 1200, margin: '0 auto', padding: '32px 24px' },
  pageTitle:  { fontSize: 24, fontWeight: 800, color: '#1e293b', margin: 0 },
  section:    { marginTop: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 16 },

  btnRefresh: { padding: '8px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },

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

  miniKpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  miniKpi:      { background: '#fff', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0' },
  miniKpiLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase' },
  miniKpiValue: { fontSize: 18, fontWeight: 700, color: '#1e293b' },
};
