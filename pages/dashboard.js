import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);
const fmtDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function EmployeeDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('ventes');

  const [products,   setProducts]   = useState([]);
  const [invoices,   setInvoices]   = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [cart,       setCart]       = useState([]);

  const [selEmployee, setSelEmployee] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [expanded, setExpanded] = useState(null); // id facture dépliée

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && ['patron', 'admin'].includes(session?.user?.role))
      router.push('/patron');
  }, [status, session, router]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadProducts = useCallback(async () => {
    const r = await fetch('/api/employee/products');
    setProducts(await r.json());
  }, []);

  const loadInvoices = useCallback(async () => {
    const r = await fetch('/api/invoices?scope=week');
    setInvoices(await r.json());
  }, []);

  const loadSalary = useCallback(async () => {
    const r = await fetch('/api/employee/salary');
    setSalaryData(await r.json());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadProducts();
    if (tab === 'ventes')  loadInvoices();
    if (tab === 'salaire') loadSalary();
  }, [tab, status, loadProducts, loadInvoices, loadSalary]);

  // ── Gestion du panier ─────────────────────────────────────
  function addToCart(product) {
    if (product.stock_quantity === 0) return;
    setCart((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, product.stock_quantity) }
            : i
        );
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1, max: product.stock_quantity }];
    });
  }

  function removeFromCart(product_id) {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));
  }

  function setCartQty(product_id, qty) {
    const n = parseInt(qty);
    if (isNaN(n) || n < 1) return;
    setCart((prev) =>
      prev.map((i) => i.product_id === product_id ? { ...i, quantity: Math.min(n, i.max) } : i)
    );
  }

  const cartTotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);

  async function submitCart() {
    if (cart.length === 0) return showToast('Le panier est vide.', 'error');
    setLoading(true);
    const r = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) {
      showToast(`✅ Facture #${d.invoice_id} validée — Total : ${fmt(d.total_amount)}`);
      setCart([]);
      loadProducts();
      loadInvoices();
    } else {
      showToast(d.error, 'error');
    }
  }

  if (status === 'loading' || !session)
    return <div style={S.loadingPage}><div style={S.spinner} /></div>;

  return (
    <>
      <Head><title>Mon espace — {session.user.companyName}</title></Head>
      <div style={S.page}>

        {toast && (
          <div style={{ ...S.toast, background: toast.type === 'error' ? '#dc2626' : '#16a34a' }}>{toast.msg}</div>
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
          <button style={tab === 'ventes'  ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn} onClick={() => setTab('ventes')}>🛒 Mes ventes</button>
          <button style={tab === 'salaire' ? { ...S.tabBtn, ...S.tabActive } : S.tabBtn} onClick={() => setTab('salaire')}>💵 Mon salaire</button>
        </div>

        <main style={S.main}>

          {/* ══ ONGLET VENTES ══ */}
          {tab === 'ventes' && (
            <div style={S.splitLayout}>

              {/* Gauche : catalogue produits */}
              <div style={S.catalog}>
                <h2 style={S.title}>Créer une facture</h2>
                <p style={S.hint}>Clique sur un produit pour l'ajouter au panier. Tu peux en ajouter plusieurs.</p>

                {products.length === 0 ? (
                  <p style={S.empty}>Aucun produit disponible. Contacte ton patron.</p>
                ) : (
                  <div style={S.productGrid}>
                    {products.map((p) => {
                      const inCart = cart.find((i) => i.product_id === p.id);
                      const outOfStock = p.stock_quantity === 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={outOfStock}
                          onClick={() => addToCart(p)}
                          style={{
                            ...S.productCard,
                            ...(inCart ? S.productCardInCart : {}),
                            ...(outOfStock ? S.productCardDisabled : {}),
                          }}
                        >
                          {inCart && <div style={S.cartBadge}>× {inCart.quantity}</div>}
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, margin: '0 auto 8px', display: 'block' }} onError={e => e.target.style.display='none'} />
                            : <div style={{ fontSize: 34, marginBottom: 8 }}>📦</div>
                          }
                          <div style={S.productName}>{p.name}</div>
                          <div style={S.productCat}>{p.category}</div>
                          <div style={S.productPrice}>{fmt(p.price)}</div>
                          <div style={{ ...S.productStock, color: outOfStock ? '#dc2626' : p.stock_quantity <= p.stock_min_alert ? '#f59e0b' : '#16a34a' }}>
                            {outOfStock ? '❌ Épuisé' : `Stock : ${p.stock_quantity}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Droite : panier */}
              <div style={S.cartPanel}>
                <h3 style={S.cartTitle}>🛒 Panier</h3>

                {cart.length === 0 ? (
                  <p style={S.cartEmpty}>Aucun article.<br />Clique sur un produit pour l'ajouter.</p>
                ) : (
                  <>
                    <div style={S.cartItems}>
                      {cart.map((item) => (
                        <div key={item.product_id} style={S.cartItem}>
                          <div style={S.cartItemName}>{item.name}</div>
                          <div style={S.cartItemRow}>
                            <div style={S.qtyRow}>
                              <button style={S.qtyBtn} onClick={() => item.quantity === 1 ? removeFromCart(item.product_id) : setCartQty(item.product_id, item.quantity - 1)}>−</button>
                              <span style={S.qtyVal}>{item.quantity}</span>
                              <button style={S.qtyBtn} onClick={() => setCartQty(item.product_id, item.quantity + 1)} disabled={item.quantity >= item.max}>+</button>
                            </div>
                            <span style={S.cartItemTotal}>{fmt(item.price * item.quantity)}</span>
                            <button style={S.removeBtn} onClick={() => removeFromCart(item.product_id)}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={S.cartFooter}>
                      <div style={S.cartTotalRow}>
                        <span>Total facture</span>
                        <span style={S.cartTotalAmt}>{fmt(cartTotal)}</span>
                      </div>
                      <button onClick={submitCart} disabled={loading} style={loading ? { ...S.btnSubmit, opacity: 0.6 } : S.btnSubmit}>
                        {loading ? 'Validation…' : '✅ Valider la facture'}
                      </button>
                      <button onClick={() => setCart([])} style={S.btnClear}>🗑️ Vider le panier</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Historique factures (sous le split) */}
          {tab === 'ventes' && (
            <div style={{ marginTop: 32 }}>
              <h3 style={S.subTitle}>Mes factures de cette semaine</h3>
              {invoices.length === 0 ? (
                <p style={S.empty}>Aucune facture cette semaine.</p>
              ) : (
                <>
                  <div style={S.weekTotal}>
                    Total semaine : <strong>{fmt(invoices.reduce((a, i) => a + i.total_amount, 0))}</strong>
                    <span style={{ color: '#94a3b8' }}> · {invoices.length} facture{invoices.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={S.invoiceList}>
                    {invoices.map((inv) => (
                      <div key={inv.id} style={S.invoiceCard}>
                        <div style={S.invoiceHeader} onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                          <div>
                            <span style={S.invoiceNum}>Facture #{inv.id}</span>
                            <span style={S.invoiceDate}>{fmtDate(inv.created_at)}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={S.invoiceTotal}>{fmt(inv.total_amount)}</span>
                            <span style={S.invoiceToggle}>{expanded === inv.id ? '▲' : '▼'}</span>
                          </div>
                        </div>
                        {expanded === inv.id && (
                          <div style={S.invoiceItems}>
                            {inv.items.map((item, idx) => (
                              <div key={idx} style={S.invoiceItem}>
                                <span>{item.product_name} × {item.quantity}</span>
                                <span style={{ fontWeight: 600 }}>{fmt(item.total_amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ ONGLET SALAIRE ══ */}
          {tab === 'salaire' && (
            <div>
              <h2 style={S.title}>Mon salaire hebdomadaire</h2>
              {!salaryData ? <p style={S.empty}>Chargement…</p> : (
                <>
                  <div style={S.infoBox}>
                    ℹ️ Ton salaire est calculé à <strong>{salaryData.salaryPercent}%</strong> de tes ventes.
                    {salaryData.salaryPercent === 0 && ' Contacte ton patron pour définir ton taux.'}
                  </div>

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

                  <h3 style={{ ...S.subTitle, marginTop: 28 }}>Semaines précédentes</h3>
                  <div style={S.weekList}>
                    {salaryData.weeks.slice(1).map((w, i) => (
                      <div key={i} style={S.weekRow}>
                        <div style={{ flex: 2 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#374151' }}>{w.label}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                            {new Date(w.week_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → {new Date(w.week_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </div>
                        </div>
                        <div style={{ flex: 2, textAlign: 'center' }}>
                          <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', display: 'block' }}>{fmt(w.total_sales)}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{w.nb_sales} vente{w.nb_sales !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: w.salary > 0 ? '#16a34a' : '#94a3b8' }}>{fmt(w.salary)}</span>
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
  toast:       { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxWidth: 380 },

  nav:     { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  navLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  navLogo: { fontWeight: 700, fontSize: 18, color: '#1e293b' },
  navCompany: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser: { color: '#64748b', fontSize: 14 },
  navBtn:  { padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 },

  tabBar:   { background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 24px' },
  tabBtn:   { padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: '#64748b', borderBottom: '2px solid transparent' },
  tabActive: { color: '#2563eb', borderBottom: '2px solid #2563eb', background: '#f8faff' },

  main:    { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
  title:   { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 },
  hint:    { fontSize: 14, color: '#64748b', marginBottom: 20 },
  subTitle:{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 },
  empty:   { color: '#94a3b8', textAlign: 'center', padding: 32, background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' },
  weekTotal: { marginBottom: 12, fontSize: 15, color: '#374151', fontWeight: 500 },

  // Layout split catalogue / panier
  splitLayout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  catalog: { flex: 3, minWidth: 280 },
  cartPanel: { flex: 1, minWidth: 260, background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: 20, position: 'sticky', top: 20 },
  cartTitle: { fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 16 },
  cartEmpty: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 1.6, padding: '16px 0' },

  // Produits
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 },
  productCard: { position: 'relative', background: '#fff', border: '2px solid #e2e8f0', borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' },
  productCardInCart: { background: '#eff6ff', border: '2px solid #2563eb' },
  productCardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  cartBadge:   { position: 'absolute', top: -8, right: -8, background: '#2563eb', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  productName: { fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 3 },
  productCat:  { fontSize: 10, color: '#94a3b8', marginBottom: 6 },
  productPrice:{ fontSize: 15, fontWeight: 700, color: '#2563eb' },
  productStock:{ fontSize: 10, marginTop: 4, fontWeight: 600 },

  // Panier items
  cartItems: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  cartItem:  { background: '#f8fafc', borderRadius: 10, padding: '10px 12px' },
  cartItemName: { fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 8 },
  cartItemRow:  { display: 'flex', alignItems: 'center', gap: 8 },
  cartItemTotal:{ fontSize: 14, fontWeight: 700, color: '#2563eb', flex: 1, textAlign: 'right' },

  qtyRow: { display: 'flex', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700 },
  removeBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, padding: '0 4px' },

  cartFooter: { borderTop: '1px solid #e2e8f0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  cartTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, color: '#374151' },
  cartTotalAmt: { fontSize: 20, fontWeight: 800, color: '#1e293b' },
  btnSubmit:  { width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnClear:   { width: '100%', padding: '8px', background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer' },

  // Factures
  invoiceList: { display: 'flex', flexDirection: 'column', gap: 8 },
  invoiceCard: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  invoiceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' },
  invoiceNum:  { fontWeight: 700, fontSize: 14, color: '#1e293b', marginRight: 10 },
  invoiceDate: { fontSize: 12, color: '#94a3b8' },
  invoiceTotal:{ fontSize: 16, fontWeight: 800, color: '#2563eb' },
  invoiceToggle:{ fontSize: 12, color: '#94a3b8' },
  invoiceItems:{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #f1f5f9' },
  invoiceItem: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', paddingTop: 6 },

  // Salaire
  infoBox: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#0369a1' },
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
};
