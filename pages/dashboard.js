import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ─── Page principale ─────────────────────────────────────────
export default function EmployeeDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('ventes');

  // Données
  const [products, setProducts]   = useState([]);
  const [sales, setSales]         = useState([]);
  const [salaryData, setSalaryData] = useState(null);

  // Formulaire vente
  const [selProduct, setSelProduct] = useState('');
  const [qty, setQty]               = useState('1');
  const [loading, setLoading]       = useState(false);
  const [toast, setToast]           = useState(null);

  // Redirection selon le rôle
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && ['patron', 'admin'].includes(session?.user?.role)) {
      router.push('/patron');
    }
  }, [status, session, router]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProducts = useCallback(async () => {
    const r = await fetch('/api/employee/products');
    setProducts(await r.json());
  }, []);

  const loadSales = useCallback(async () => {
    const r = await fetch('/api/employee/sales');
    setSales(await r.json());
  }, []);

  const loadSalary = useCallback(async () => {
    const r = await fetch('/api/employee/salary');
    setSalaryData(await r.json());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadProducts();
    if (tab === 'ventes') loadSales();
    if (tab === 'salaire') loadSalary();
  }, [tab, status, loadProducts, loadSales, loadSalary]);

  // Enregistrement d'une vente
  async function handleAddSale(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/employee/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: parseInt(selProduct), quantity: parseInt(qty) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) {
      showToast(`✅ Vente enregistrée : ${d.product_name} × ${qty} = ${fmt(d.total_amount)}`);
      setSelProduct(''); setQty('1');
      loadSales(); loadProducts();
    } else {
      showToast(d.error, 'error');
    }
  }

  if (status === 'loading' || !session) {
    return <div style={S.loadingPage}><div style={S.spinner} /></div>;
  }

  const selectedProduct = products.find(p => String(p.id) === String(selProduct));
  const estimatedTotal  = selectedProduct ? selectedProduct.price * parseInt(qty || 0) : 0;

  return (
    <>
      <Head><title>Mon espace — {session.user.companyName}</title></Head>
      <div style={S.page}>

        {/* Toast */}
        {toast && (
          <div style={{ ...S.toast, background: toast.type === 'error' ? '#dc2626' : '#16a34a' }}>
            {toast.msg}
          </div>
        )}

        {/* Nav */}
        <nav style={S.nav}>
          <div style={S.navLeft}>
            <span style={S.navLogo}>📊 Compta-Inside</span>
            <span style={S.navCompany}>{session.user.companyName}</span>
          </div>
          <div style={S.navRight}>
            <span style={S.navUser}>👤 {session.user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/' })} style={S.navBtn}>Déconnexion</button>
          </div>
        </nav>

        {/* Onglets */}
        <div style={S.tabBar}>
          <button style={tab === 'ventes'  ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn} onClick={() => setTab('ventes')}>
            🛒 Mes ventes
          </button>
          <button style={tab === 'salaire' ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn} onClick={() => setTab('salaire')}>
            💵 Mon salaire
          </button>
        </div>

        <main style={S.main}>

          {/* ══════════════════════════════════════
              ONGLET : MES VENTES
          ══════════════════════════════════════ */}
          {tab === 'ventes' && (
            <div>
              <h2 style={S.title}>Enregistrer une vente</h2>

              {/* Formulaire vente */}
              <div style={S.card}>
                {products.length === 0 ? (
                  <p style={S.empty}>Aucun produit disponible. Contactez votre patron.</p>
                ) : (
                  <form onSubmit={handleAddSale}>
                    <div style={S.formRow}>
                      {/* Sélecteur de produit sous forme de cartes */}
                      <div style={{ flex: 1 }}>
                        <label style={S.label}>Choisir le produit vendu</label>
                        <div style={S.productGrid}>
                          {products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelProduct(String(p.id))}
                              disabled={p.stock_quantity === 0}
                              style={{
                                ...S.productCard,
                                ...(String(selProduct) === String(p.id) ? S.productCardSelected : {}),
                                ...(p.stock_quantity === 0 ? S.productCardDisabled : {}),
                              }}
                            >
                              <div style={S.productName}>{p.name}</div>
                              <div style={S.productCategory}>{p.category}</div>
                              <div style={S.productPrice}>{fmt(p.price)}</div>
                              <div style={{ ...S.productStock, color: p.stock_quantity <= p.stock_min_alert ? '#dc2626' : '#16a34a' }}>
                                {p.stock_quantity === 0 ? '❌ Épuisé' : `Stock : ${p.stock_quantity}`}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Quantité + résumé */}
                      {selProduct && (
                        <div style={S.sidePanel}>
                          <div style={S.selectedProductInfo}>
                            <div style={S.selectedLabel}>Produit sélectionné</div>
                            <div style={S.selectedName}>{selectedProduct?.name}</div>
                            <div style={S.selectedPrice}>{fmt(selectedProduct?.price)} / unité</div>
                          </div>

                          <label style={S.label}>Quantité</label>
                          <div style={S.qtyRow}>
                            <button type="button" style={S.qtyBtn} onClick={() => setQty(String(Math.max(1, parseInt(qty) - 1)))}>−</button>
                            <input
                              type="number" min="1" max={selectedProduct?.stock_quantity}
                              value={qty}
                              onChange={e => setQty(e.target.value)}
                              required style={S.qtyInput}
                            />
                            <button type="button" style={S.qtyBtn} onClick={() => setQty(String(Math.min(selectedProduct?.stock_quantity ?? 99, parseInt(qty) + 1)))}>+</button>
                          </div>

                          <div style={S.totalPreview}>
                            <span>Total</span>
                            <span style={S.totalAmount}>{fmt(estimatedTotal)}</span>
                          </div>

                          <button type="submit" disabled={loading} style={loading ? { ...S.btnSubmit, opacity: 0.6 } : S.btnSubmit}>
                            {loading ? 'Enregistrement…' : '✅ Confirmer la vente'}
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                )}
              </div>

              {/* Historique ventes du jour */}
              <h3 style={S.subTitle}>Mes ventes de cette semaine</h3>
              {sales.length === 0 ? (
                <p style={S.empty}>Aucune vente enregistrée cette semaine.</p>
              ) : (
                <>
                  <div style={S.weekTotal}>
                    Total semaine : <strong>{fmt(sales.reduce((a, s) => a + s.total_amount, 0))}</strong>
                    <span style={S.weekCount}> · {sales.length} vente{sales.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Produit</th>
                          <th style={S.th}>Quantité</th>
                          <th style={S.th}>Prix unit.</th>
                          <th style={S.th}>Total</th>
                          <th style={S.th}>Heure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={s.id} style={S.tr}>
                            <td style={S.td}><strong>{s.product_name}</strong></td>
                            <td style={S.td}>{s.quantity}</td>
                            <td style={S.td}>{fmt(s.unit_price)}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#2563eb' }}>{fmt(s.total_amount)}</td>
                            <td style={{ ...S.td, color: '#94a3b8', fontSize: 12 }}>{fmtDate(s.sale_date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════
              ONGLET : MON SALAIRE
          ══════════════════════════════════════ */}
          {tab === 'salaire' && (
            <div>
              <h2 style={S.title}>Mon salaire hebdomadaire</h2>

              {!salaryData ? (
                <p style={S.empty}>Chargement…</p>
              ) : (
                <>
                  {/* Info taux */}
                  <div style={S.infoBox}>
                    <span style={S.infoIcon}>ℹ️</span>
                    <span>
                      Ton salaire est calculé à <strong>{salaryData.salaryPercent}%</strong> de tes ventes.
                      {salaryData.salaryPercent === 0 && ' Contacte ton patron pour définir ton taux.'}
                    </span>
                  </div>

                  {/* Semaine en cours — mise en avant */}
                  {salaryData.weeks[0] && (
                    <div style={S.currentWeekCard}>
                      <div style={S.cwHeader}>
                        <span style={S.cwBadge}>📅 Cette semaine</span>
                        <span style={S.cwDates}>
                          {new Date(salaryData.weeks[0].week_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          {' → '}
                          {new Date(salaryData.weeks[0].week_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <div style={S.cwStats}>
                        <div style={S.cwStat}>
                          <div style={S.cwStatLabel}>Ventes réalisées</div>
                          <div style={S.cwStatValue}>{fmt(salaryData.weeks[0].total_sales)}</div>
                          <div style={S.cwStatSub}>{salaryData.weeks[0].nb_sales} vente{salaryData.weeks[0].nb_sales !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={S.cwDivider} />
                        <div style={{ ...S.cwStat, textAlign: 'right' }}>
                          <div style={S.cwStatLabel}>💵 Salaire à recevoir</div>
                          <div style={{ ...S.cwStatValue, color: '#16a34a', fontSize: 32 }}>{fmt(salaryData.weeks[0].salary)}</div>
                          <div style={S.cwStatSub}>{salaryData.salaryPercent}% des ventes</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Historique 4 semaines précédentes */}
                  <h3 style={{ ...S.subTitle, marginTop: 28 }}>Historique des semaines passées</h3>
                  <div style={S.weekList}>
                    {salaryData.weeks.slice(1).map((w, i) => (
                      <div key={i} style={S.weekRow}>
                        <div style={S.weekRowLeft}>
                          <div style={S.weekRowLabel}>{w.label}</div>
                          <div style={S.weekRowDates}>
                            {new Date(w.week_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            {' → '}
                            {new Date(w.week_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </div>
                        </div>
                        <div style={S.weekRowMid}>
                          <span style={S.weekRowSales}>{fmt(w.total_sales)}</span>
                          <span style={S.weekRowSub}>{w.nb_sales} vente{w.nb_sales !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={S.weekRowRight}>
                          <span style={w.salary > 0 ? S.weekRowSalary : S.weekRowSalaryZero}>
                            {fmt(w.salary)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  page:        { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', Arial, sans-serif" },
  loadingPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' },
  spinner:     { width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  toast: { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: 360 },

  nav:     { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  navLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  navLogo: { fontWeight: 700, fontSize: 18, color: '#1e293b' },
  navCompany: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser: { color: '#64748b', fontSize: 14 },
  navBtn:  { padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 },

  tabBar:   { background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 24px' },
  tabBtn:   { padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: '#64748b', borderBottom: '2px solid transparent' },
  tabActive:{ color: '#2563eb', borderBottom: '2px solid #2563eb', background: '#f8faff' },

  main:    { maxWidth: 900, margin: '0 auto', padding: '28px 24px' },
  title:   { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
  subTitle:{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12, marginTop: 28 },
  card:    { background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: 24, marginBottom: 28 },
  empty:   { color: '#94a3b8', textAlign: 'center', padding: 32, background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' },

  // Formulaire vente
  formRow: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  label:   { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, display: 'block' },

  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
  productCard: { background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
  productCardSelected: { background: '#eff6ff', border: '2px solid #2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.12)' },
  productCardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  productName:     { fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 3 },
  productCategory: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  productPrice:    { fontSize: 15, fontWeight: 700, color: '#2563eb' },
  productStock:    { fontSize: 11, marginTop: 4, fontWeight: 600 },

  sidePanel: { minWidth: 200, maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 },
  selectedProductInfo: { background: '#eff6ff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bfdbfe' },
  selectedLabel: { fontSize: 11, color: '#60a5fa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 },
  selectedName:  { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  selectedPrice: { fontSize: 13, color: '#64748b', marginTop: 2 },

  qtyRow:   { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn:   { width: 36, height: 36, border: '1.5px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#374151' },
  qtyInput: { width: 60, textAlign: 'center', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 16, fontWeight: 700, color: '#1e293b' },

  totalPreview: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', borderRadius: 10, padding: '12px 16px', border: '1px solid #bbf7d0' },
  totalAmount:  { fontSize: 20, fontWeight: 800, color: '#16a34a' },

  btnSubmit: { width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' },

  weekTotal: { marginBottom: 12, fontSize: 15, color: '#374151', fontWeight: 500 },
  weekCount: { color: '#94a3b8' },

  tableWrap: { overflowX: 'auto', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' },
  th:    { background: '#f8fafc', padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' },
  tr:    { borderBottom: '1px solid #f1f5f9' },
  td:    { padding: '13px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },

  // Salaire
  infoBox:  { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#0369a1', display: 'flex', gap: 10, alignItems: 'center' },
  infoIcon: { fontSize: 18 },

  currentWeekCard: { background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 8 },
  cwHeader: { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cwBadge:  { color: '#fff', fontWeight: 700, fontSize: 15 },
  cwDates:  { color: '#bfdbfe', fontSize: 13 },
  cwStats:  { padding: '24px', display: 'flex', alignItems: 'center', gap: 24 },
  cwStat:   { flex: 1 },
  cwStatLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  cwStatValue: { fontSize: 26, fontWeight: 800, color: '#1e293b' },
  cwStatSub:   { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cwDivider:   { width: 1, height: 60, background: '#e2e8f0' },

  weekList: { display: 'flex', flexDirection: 'column', gap: 10 },
  weekRow:  { background: '#fff', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  weekRowLeft:  { flex: 2 },
  weekRowMid:   { flex: 2, textAlign: 'center' },
  weekRowRight: { flex: 1, textAlign: 'right' },
  weekRowLabel: { fontWeight: 600, fontSize: 14, color: '#374151' },
  weekRowDates: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  weekRowSales: { fontSize: 15, fontWeight: 600, color: '#1e293b', display: 'block' },
  weekRowSub:   { fontSize: 12, color: '#94a3b8' },
  weekRowSalary:      { fontSize: 18, fontWeight: 800, color: '#16a34a' },
  weekRowSalaryZero:  { fontSize: 16, fontWeight: 600, color: '#94a3b8' },
};
