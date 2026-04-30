import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';

const TAX_RATE = 0.15;

// ─── Helpers ────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ─── Composant principal ─────────────────────────────────────
export default function PatronDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState('overview');

  // Données
  const [overview, setOverview] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchasesData, setPurchasesData] = useState({ purchases: [], totalPurchases: 0 });
  const [pendingUsers, setPendingUsers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);

  // Formulaire achat
  const [acName, setAcName]         = useState('');
  const [acMaterial, setAcMaterial] = useState(''); // remplace acProduct
  const [acQty, setAcQty]           = useState('1');
  const [acPrice, setAcPrice]       = useState('');
  const [acNotes, setAcNotes]       = useState('');

  // Formulaire matière première
  const [rmName, setRmName]       = useState('');
  const [rmUnit, setRmUnit]       = useState('unité');
  const [rmQty, setRmQty]         = useState('0');
  const [rmAlert, setRmAlert]     = useState('5');
  const [editingRm, setEditingRm] = useState(null);
  const [editingRmStock, setEditingRmStock] = useState(null);

  // États UI
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Modales / formulaires
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Formulaire produit
  const [pName, setPName] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [pAlert, setPAlert] = useState('5');
  const [pImageUrl, setPImageUrl] = useState('');

  // Formulaire vente (ancien, gardé pour compat)
  const [sEmployee, setSEmployee] = useState('');
  const [sProduct, setSProduct] = useState('');
  const [sQty, setSQty] = useState('1');

  // Panier (onglet Ventes)
  const [cart, setCart] = useState([]);
  const [cartEmployee, setCartEmployee] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [expandedInv, setExpandedInv] = useState(null);

  // Redirection si pas patron
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && !['patron', 'admin'].includes(session.user.role)) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Chargements des données selon l'onglet
  const loadOverview = useCallback(async () => {
    const r = await fetch('/api/patron/overview');
    const d = await r.json();
    setOverview(d);
  }, []);

  const loadEmployees = useCallback(async () => {
    const r = await fetch('/api/patron/employees');
    setEmployees(await r.json());
  }, []);

  const loadProducts = useCallback(async () => {
    const r = await fetch('/api/patron/products');
    setProducts(await r.json());
  }, []);

  const loadSales = useCallback(async () => {
    const r = await fetch('/api/patron/sales');
    setSales(await r.json());
  }, []);

  const loadInvoices = useCallback(async () => {
    const r = await fetch('/api/invoices');
    setInvoices(await r.json());
  }, []);

  const loadPurchases = useCallback(async () => {
    const r = await fetch('/api/patron/purchases');
    setPurchasesData(await r.json());
  }, []);

  const loadPending = useCallback(async () => {
    const r = await fetch('/api/patron/pending');
    setPendingUsers(await r.json());
  }, []);

  const loadRawMaterials = useCallback(async () => {
    const r = await fetch('/api/patron/raw-materials');
    setRawMaterials(await r.json());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadOverview();
    loadPending(); // toujours chargé pour le badge
    if (tab === 'salaires') { loadEmployees(); loadProducts(); loadSales(); }
    if (tab === 'ventes')   { loadProducts(); loadEmployees(); loadInvoices(); }
    if (tab === 'produits') loadProducts();
    if (tab === 'stocks')   loadRawMaterials();
    if (tab === 'achats')   { loadPurchases(); loadRawMaterials(); }
  }, [tab, status, loadOverview, loadEmployees, loadProducts, loadSales, loadInvoices, loadPurchases, loadPending, loadRawMaterials]);

  // ── Actions matières premières ─────────────────────────────
  async function handleAddRm(e) {
    e.preventDefault();
    setLoading(true);
    const body = editingRm
      ? { id: editingRm.id, name: rmName, unit: rmUnit, min_alert: parseFloat(rmAlert) }
      : { name: rmName, unit: rmUnit, quantity: parseFloat(rmQty) || 0, min_alert: parseFloat(rmAlert) || 5 };
    const r = await fetch('/api/patron/raw-materials', {
      method: editingRm ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (r.ok) { showToast(editingRm ? 'Matière première modifiée !' : 'Matière première ajoutée !'); setEditingRm(null); setRmName(''); setRmUnit('unité'); setRmQty('0'); setRmAlert('5'); loadRawMaterials(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleDeleteRm(id) {
    if (!confirm('Supprimer cette matière première ?')) return;
    await fetch('/api/patron/raw-materials', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Supprimée.'); loadRawMaterials();
  }

  async function handleUpdateRmStock(id, qty) {
    await fetch('/api/patron/raw-materials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, quantity: parseFloat(qty) }) });
    showToast('Stock mis à jour !'); setEditingRmStock(null); loadRawMaterials(); loadOverview();
  }

  // ── Actions validation comptes ─────────────────────────────
  async function handleAccountAction(id, action) {
    const label = action === 'approve' ? 'approuver' : 'refuser';
    if (!confirm(`Veux-tu ${label} ce compte ?`)) return;
    const r = await fetch('/api/patron/pending', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (r.ok) {
      showToast(action === 'approve' ? '✅ Compte approuvé !' : '❌ Compte refusé.');
      loadPending();
      loadEmployees();
    }
  }

  // ── Actions achats ─────────────────────────────────────────
  async function handleAddPurchase(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: acName,
        raw_material_id: acMaterial || null,
        quantity: parseFloat(acQty) || 1,
        unit_price: parseFloat(acPrice),
        notes: acNotes || null,
      }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) {
      showToast(`✅ Achat enregistré — ${fmt(d.total_amount)}${acMaterial ? ' · Stock matière réapprovisionné' : ''}`);
      setAcName(''); setAcMaterial(''); setAcQty('1'); setAcPrice(''); setAcNotes('');
      loadPurchases(); loadOverview(); if (acMaterial) loadRawMaterials();
    } else {
      showToast(d.error, 'error');
    }
  }

  async function handleDeletePurchase(id) {
    if (!confirm('Supprimer cet achat ? Le stock sera ajusté si applicable.')) return;
    await fetch('/api/patron/purchases', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Achat supprimé.'); loadPurchases(); loadOverview(); loadRawMaterials();
  }

  // ── Gestion du panier (onglet Ventes) ────────────────────
  function addToCart(product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) return prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }
  function removeFromCart(product_id) { setCart((prev) => prev.filter((i) => i.product_id !== product_id)); }
  function setCartQty(product_id, qty) {
    const n = parseInt(qty); if (isNaN(n) || n < 1) return;
    setCart((prev) => prev.map((i) => i.product_id === product_id ? { ...i, quantity: n } : i));
  }
  const cartTotal = cart.reduce((a, i) => a + i.price * i.quantity, 0);

  async function submitCart() {
    if (cart.length === 0) return showToast('Le panier est vide.', 'error');
    if (!cartEmployee) return showToast('Sélectionne un employé.', 'error');
    setLoading(true);
    const r = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: parseInt(cartEmployee), items: cart.map((i) => ({ product_id: i.product_id, quantity: i.quantity })) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) { showToast(`✅ Facture #${d.invoice_id} créée — ${fmt(d.total_amount)}`); setCart([]); loadInvoices(); loadOverview(); }
    else showToast(d.error, 'error');
  }

  async function handleDeleteInvoice(id) {
    if (!confirm('Annuler cette facture et remettre le stock ?')) return;
    await fetch('/api/invoices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Facture annulée.'); loadInvoices(); loadOverview();
  }

  // ── Actions produits ──
  async function handleAddProduct(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName, category: pCategory, price: parseFloat(pPrice), image_url: pImageUrl || null }),
    });
    setLoading(false);
    if (r.ok) { showToast('Produit ajouté !'); setShowAddProduct(false); resetProductForm(); loadProducts(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleEditProduct(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingProduct.id, name: pName, category: pCategory, price: parseFloat(pPrice), image_url: pImageUrl || null }),
    });
    setLoading(false);
    if (r.ok) { showToast('Produit modifié !'); setEditingProduct(null); resetProductForm(); loadProducts(); }
    else { const d = await r.json(); showToast(d.error, 'error'); }
  }

  async function handleDeleteProduct(id) {
    if (!confirm('Supprimer ce produit ?')) return;
    await fetch('/api/patron/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Produit supprimé.'); loadProducts();
  }

  function openEditProduct(p) {
    setEditingProduct(p);
    setPName(p.name); setPCategory(p.category); setPPrice(String(p.price)); setPImageUrl(p.image_url || '');
    setShowAddProduct(false);
  }

  function resetProductForm() { setPName(''); setPCategory(''); setPPrice(''); setPImageUrl(''); }

  // ── Actions stock ──
  async function handleUpdateStock(id, qty) {
    const r = await fetch('/api/patron/stock', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, stock_quantity: parseInt(qty) }),
    });
    if (r.ok) { showToast('Stock mis à jour !'); setEditingStock(null); loadProducts(); loadOverview(); }
    else { showToast('Erreur lors de la mise à jour.', 'error'); }
  }

  // ── Actions ventes ──
  async function handleAddSale(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: parseInt(sEmployee), product_id: parseInt(sProduct), quantity: parseInt(sQty) }),
    });
    const d = await r.json();
    setLoading(false);
    if (r.ok) { showToast(`Vente enregistrée : ${fmt(d.total_amount)}`); setShowAddSale(false); setSEmployee(''); setSProduct(''); setSQty('1'); loadEmployees(); loadSales(); loadOverview(); }
    else showToast(d.error, 'error');
  }

  async function handleDeleteSale(id) {
    if (!confirm('Annuler cette vente ?')) return;
    await fetch('/api/patron/sales', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Vente annulée.'); loadSales(); loadEmployees(); loadOverview();
  }

  // ── Actions employés ──
  async function handleUpdateSalaryPercent(id, pct) {
    const r = await fetch('/api/patron/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, salary_percent: parseFloat(pct) }),
    });
    if (r.ok) { showToast('Pourcentage mis à jour !'); setEditingEmployee(null); loadEmployees(); }
    else showToast('Erreur.', 'error');
  }

  if (status === 'loading' || !session) {
    return <div style={S.loadingPage}><div style={S.spinner} /></div>;
  }

  const pendingCount = pendingUsers.filter(u => u.status === 'pending').length;
  const tabs = [
    { key: 'overview', label: '🏠 Vue d\'ensemble', badge: pendingCount },
    { key: 'ventes',   label: '🧾 Ventes' },
    { key: 'achats',   label: '🛍️ Achats' },
    { key: 'salaires', label: '💰 Salaires & Impôts' },
    { key: 'produits', label: '📦 Produits' },
    { key: 'stocks',   label: '📊 Stocks' },
  ];

  return (
    <>
      <Head><title>Dashboard Patron — {session.user.companyName}</title></Head>
      <div style={S.page}>

        {/* Toast notification */}
        {toast && (
          <div style={{ ...S.toast, background: toast.type === 'error' ? '#dc2626' : '#16a34a' }}>
            {toast.type === 'error' ? '❌ ' : '✅ '}{toast.msg}
          </div>
        )}

        {/* Barre de navigation */}
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
          {tabs.map((t) => (
            <button
              key={t.key}
              style={tab === t.key ? { ...S.tabBtn, ...S.tabBtnActive } : S.tabBtn}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.badge > 0 && (
                <span style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderRadius: '50%', fontSize: 11, fontWeight: 700, padding: '1px 6px', verticalAlign: 'middle' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <main style={S.main}>

          {/* ══════════════════════════════════════════
              ONGLET : VUE D'ENSEMBLE
          ══════════════════════════════════════════ */}
          {tab === 'overview' && (
            <div>
              <h2 style={S.sectionTitle}>Vue d'ensemble — {new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}</h2>

              {!overview ? <p style={S.loading}>Chargement…</p> : (
                <>
                  {/* KPI Cards */}
                  <div style={S.kpiGrid}>
                    <div style={S.kpiCard}>
                      <div style={S.kpiIcon}>💵</div>
                      <div style={S.kpiLabel}>Chiffre d'affaires</div>
                      <div style={S.kpiValue}>{fmt(overview.totalSales)}</div>
                    </div>
                    <div style={{ ...S.kpiCard, borderColor: '#f59e0b' }}>
                      <div style={S.kpiIcon}>🛍️</div>
                      <div style={S.kpiLabel}>Achats matières premières</div>
                      <div style={{ ...S.kpiValue, color: '#d97706' }}>− {fmt(overview.totalPurchases)}</div>
                    </div>
                    <div style={{ ...S.kpiCard, borderColor: '#dc2626' }}>
                      <div style={S.kpiIcon}>🏛️</div>
                      <div style={S.kpiLabel}>Impôts (15% sur {fmt(overview.taxableBase)})</div>
                      <div style={{ ...S.kpiValue, color: '#dc2626' }}>{fmt(overview.taxes)}</div>
                    </div>
                    <div style={{ ...S.kpiCard, borderColor: '#8b5cf6' }}>
                      <div style={S.kpiIcon}>👥</div>
                      <div style={S.kpiLabel}>Salaires à distribuer</div>
                      <div style={{ ...S.kpiValue, color: '#7c3aed' }}>{fmt(overview.totalSalaries)}</div>
                    </div>
                    <div style={{ ...S.kpiCard, borderColor: '#16a34a' }}>
                      <div style={S.kpiIcon}>📈</div>
                      <div style={S.kpiLabel}>Bénéfice net</div>
                      <div style={{ ...S.kpiValue, color: '#16a34a' }}>{fmt(overview.netRevenue)}</div>
                    </div>
                  </div>

                  {/* Alerte stock */}
                  {overview.alertsCount > 0 && (
                    <div style={S.alertBanner}>
                      ⚠️ <strong>{overview.alertsCount} produit{overview.alertsCount > 1 ? 's' : ''}</strong> en stock bas !{' '}
                      <button style={S.alertLink} onClick={() => setTab('stocks')}>Voir les stocks →</button>
                    </div>
                  )}

                  {/* Comptes en attente de validation */}
                  {pendingUsers.filter(u => u.status === 'pending').length > 0 && (
                    <div style={S.pendingBox}>
                      <div style={S.pendingTitle}>
                        🔔 Comptes en attente de validation ({pendingUsers.filter(u => u.status === 'pending').length})
                      </div>
                      <div style={S.pendingList}>
                        {pendingUsers.filter(u => u.status === 'pending').map(u => (
                          <div key={u.id} style={S.pendingRow}>
                            <div style={S.pendingInfo}>
                              <strong>{u.name}</strong>
                              <span style={S.pendingEmail}>{u.email}</span>
                              <span style={S.pendingDate}>Inscrit le {new Date(u.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <div style={S.pendingActions}>
                              <button style={S.btnApprove} onClick={() => handleAccountAction(u.id, 'approve')}>✅ Approuver</button>
                              <button style={S.btnReject}  onClick={() => handleAccountAction(u.id, 'reject')}>❌ Refuser</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comptes refusés */}
                  {pendingUsers.filter(u => u.status === 'rejected').length > 0 && (
                    <div style={{ ...S.pendingBox, borderColor: '#fca5a5', background: '#fff7f7' }}>
                      <div style={{ ...S.pendingTitle, color: '#dc2626' }}>
                        ❌ Comptes refusés ({pendingUsers.filter(u => u.status === 'rejected').length})
                      </div>
                      <div style={S.pendingList}>
                        {pendingUsers.filter(u => u.status === 'rejected').map(u => (
                          <div key={u.id} style={S.pendingRow}>
                            <div style={S.pendingInfo}>
                              <strong>{u.name}</strong>
                              <span style={S.pendingEmail}>{u.email}</span>
                            </div>
                            <button style={S.btnApprove} onClick={() => handleAccountAction(u.id, 'approve')}>↩️ Réapprouver</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dernières ventes */}
                  <h3 style={S.subTitle}>Dernières ventes enregistrées</h3>
                  {overview.recentSales.length === 0 ? (
                    <p style={S.empty}>Aucune vente ce mois-ci. Allez dans "Salaires & Impôts" pour en ajouter.</p>
                  ) : (
                    <div style={S.tableWrap}>
                      <table style={S.table}>
                        <thead>
                          <tr>
                            <th style={S.th}>Employé</th>
                            <th style={S.th}>Produit</th>
                            <th style={S.th}>Qté</th>
                            <th style={S.th}>Montant</th>
                            <th style={S.th}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.recentSales.map((s) => (
                            <tr key={s.id} style={S.tr}>
                              <td style={S.td}>{s.employee_name}</td>
                              <td style={S.td}>{s.product_name}</td>
                              <td style={S.td}>{s.quantity}</td>
                              <td style={{ ...S.td, fontWeight: 600 }}>{fmt(s.total_amount)}</td>
                              <td style={{ ...S.td, color: '#94a3b8', fontSize: 13 }}>{fmtDate(s.sale_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : VENTES (panier multi-produits)
          ══════════════════════════════════════════ */}
          {tab === 'ventes' && (
            <div>
              <h2 style={S.sectionTitle}>Créer une facture</h2>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* Catalogue */}
                <div style={{ flex: 3, minWidth: 280 }}>
                  <label style={S.label}>Employé concerné</label>
                  <select value={cartEmployee} onChange={e => setCartEmployee(e.target.value)} style={{ ...S.select, marginBottom: 20, maxWidth: 300 }}>
                    <option value="">-- Sélectionner un employé --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role === 'patron' ? 'Patron' : 'Employé'})</option>)}
                  </select>

                  <label style={S.label}>Produits</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                    {products.map((p) => {
                      const inCart = cart.find((i) => i.product_id === p.id);
                      return (
                        <button key={p.id} type="button" onClick={() => addToCart(p)}
                          style={{ position: 'relative', background: inCart ? '#eff6ff' : '#f8fafc', border: `2px solid ${inCart ? '#2563eb' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 10px', cursor: 'pointer', textAlign: 'center' }}>
                          {inCart && <div style={{ position: 'absolute', top: -8, right: -8, background: '#2563eb', color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×{inCart.quantity}</div>}
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} onError={e => e.target.style.display='none'} />
                            : <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                          }
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 3 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>{p.category}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: '#2563eb' }}>{fmt(p.price)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Panier */}
                <div style={{ flex: 1, minWidth: 250, background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: 20, position: 'sticky', top: 20 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>🛒 Panier</h3>
                  {cart.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>Aucun article sélectionné.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        {cart.map((item) => (
                          <div key={item.product_id} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>{item.name}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button style={S.qtyBtn2} onClick={() => item.quantity === 1 ? removeFromCart(item.product_id) : setCartQty(item.product_id, item.quantity - 1)}>−</button>
                                <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>{item.quantity}</span>
                                <button style={S.qtyBtn2} onClick={() => setCartQty(item.product_id, item.quantity + 1)}>+</button>
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#2563eb', flex: 1, textAlign: 'right' }}>{fmt(item.price * item.quantity)}</span>
                              <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }} onClick={() => removeFromCart(item.product_id)}>✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#374151' }}>
                          <span>Total</span>
                          <span style={{ fontSize: 20, fontWeight: 800, color: '#1e293b' }}>{fmt(cartTotal)}</span>
                        </div>
                        <button onClick={submitCart} disabled={loading} style={{ ...S.btnPrimary, width: '100%', padding: 12, fontSize: 14, opacity: loading ? 0.6 : 1 }}>
                          {loading ? 'Validation…' : '✅ Valider la facture'}
                        </button>
                        <button onClick={() => setCart([])} style={{ width: '100%', padding: 8, background: 'none', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                          🗑️ Vider le panier
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Historique toutes les factures */}
              <h3 style={{ ...S.subTitle, marginTop: 36 }}>Historique des factures</h3>
              {invoices.length === 0 ? (
                <p style={S.empty}>Aucune facture enregistrée.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {invoices.map((inv) => (
                    <div key={inv.id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}
                        onClick={() => setExpandedInv(expandedInv === inv.id ? null : inv.id)}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginRight: 10 }}>Facture #{inv.id}</span>
                          <span style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>👤 {inv.employee_name}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{fmtDate(inv.created_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#2563eb' }}>{fmt(inv.total_amount)}</span>
                          <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(inv.id); }}>🗑️ Annuler</button>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>{expandedInv === inv.id ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedInv === inv.id && (
                        <div style={{ padding: '0 18px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {inv.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', paddingTop: 6 }}>
                              <span>{item.product_name} × {item.quantity} ({fmt(item.unit_price)} / unité)</span>
                              <span style={{ fontWeight: 600 }}>{fmt(item.total_amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : ACHATS MATIÈRES PREMIÈRES
          ══════════════════════════════════════════ */}
          {tab === 'achats' && (
            <div>
              <h2 style={S.sectionTitle}>Achats — Matières premières</h2>

              {/* Récap déduction fiscale */}
              {overview && (
                <div style={S.purchaseSummary}>
                  <div style={S.pSumItem}>
                    <div style={S.pSumLabel}>CA du mois</div>
                    <div style={S.pSumValue}>{fmt(overview.totalSales)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#dc2626' }}>
                    <div style={S.pSumLabel}>Achats déduits</div>
                    <div style={{ ...S.pSumValue, color: '#dc2626' }}>− {fmt(overview.totalPurchases)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#64748b' }}>
                    <div style={S.pSumLabel}>Base imposable</div>
                    <div style={{ ...S.pSumValue, color: '#64748b' }}>{fmt(overview.taxableBase)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#16a34a' }}>
                    <div style={S.pSumLabel}>💚 Économie impôts (15%)</div>
                    <div style={{ ...S.pSumValue, color: '#16a34a' }}>{fmt(overview.taxSaving)}</div>
                  </div>
                  <div style={{ ...S.pSumItem, color: '#dc2626' }}>
                    <div style={S.pSumLabel}>🏛️ Impôts dus</div>
                    <div style={{ ...S.pSumValue, color: '#dc2626' }}>{fmt(overview.taxes)}</div>
                  </div>
                </div>
              )}

              {/* Formulaire d'ajout d'achat */}
              <div style={S.formCard}>
                <h3 style={S.subTitle}>➕ Enregistrer un achat</h3>
                <form onSubmit={handleAddPurchase} style={S.formGrid}>
                  <div>
                    <label style={S.label}>Nom de la matière première *</label>
                    <input value={acName} onChange={e => setAcName(e.target.value)} required placeholder="Ex: Café en grains, Lait, Alcool…" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Prix unitaire ($) *</label>
                    <input type="number" min="0" step="0.01" value={acPrice} onChange={e => setAcPrice(e.target.value)} required placeholder="0.00" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Quantité achetée</label>
                    <input type="number" min="1" value={acQty} onChange={e => setAcQty(e.target.value)} style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>
                      Lier à une matière première{' '}
                      <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(optionnel — ajoute au stock automatiquement)</span>
                    </label>
                    <select value={acMaterial} onChange={e => setAcMaterial(e.target.value)} style={S.select}>
                      <option value="">-- Aucune (achat sans lien stock) --</option>
                      {rawMaterials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} (stock : {m.quantity} {m.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.label}>Notes <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(optionnel)</span></label>
                    <input value={acNotes} onChange={e => setAcNotes(e.target.value)} placeholder="Ex: Fournisseur X, livraison urgente…" style={S.input} />
                  </div>

                  {/* Aperçu du total */}
                  {acPrice && acQty && (
                    <div style={{ gridColumn: '1 / -1', background: '#fefce8', border: '1px solid #fde047', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, color: '#713f12' }}>Total achat : <strong>{fmt(parseFloat(acPrice || 0) * parseFloat(acQty || 1))}</strong></span>
                        <span style={{ fontSize: 13, color: '#92400e', marginLeft: 16 }}>
                          → Économie impôts : <strong>{fmt(parseFloat(acPrice || 0) * parseFloat(acQty || 1) * 0.15)}</strong>
                        </span>
                      </div>
                      {acMaterial && (
                        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                          + {acQty} {rawMaterials.find(m => String(m.id) === String(acMaterial))?.unit || 'unité(s)'} au stock
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" style={S.btnPrimary} disabled={loading}>
                      {loading ? 'Enregistrement…' : '💾 Enregistrer l\'achat'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Liste des achats du mois */}
              <h3 style={S.subTitle}>Achats du mois en cours</h3>
              {purchasesData.purchases.length === 0 ? (
                <p style={S.empty}>Aucun achat enregistré ce mois-ci.</p>
              ) : (
                <>
                  <div style={{ marginBottom: 12, fontSize: 15, color: '#374151', fontWeight: 500 }}>
                    Total dépensé : <strong style={{ color: '#dc2626' }}>{fmt(purchasesData.totalPurchases)}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: 12, fontSize: 13 }}>
                      · Économie impôts : <span style={{ color: '#16a34a', fontWeight: 600 }}>{fmt(purchasesData.totalPurchases * 0.15)}</span>
                    </span>
                  </div>
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={S.th}>Matière première</th>
                          <th style={S.th}>Qté</th>
                          <th style={S.th}>Prix unit.</th>
                          <th style={S.th}>Total</th>
                          <th style={S.th}>Stock lié</th>
                          <th style={S.th}>Notes</th>
                          <th style={S.th}>Date</th>
                          <th style={S.th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchasesData.purchases.map((p) => (
                          <tr key={p.id} style={S.tr}>
                            <td style={S.td}><strong>{p.name}</strong></td>
                            <td style={S.td}>{p.quantity ?? '—'}</td>
                            <td style={S.td}>{fmt(p.unit_price)}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#dc2626' }}>− {fmt(p.total_amount)}</td>
                            <td style={S.td}>
                              {p.material_name
                                ? <span style={{ ...S.badge, background: '#dcfce7', color: '#16a34a' }}>🧪 {p.material_name} ({p.material_unit})</span>
                                : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                              }
                            </td>
                            <td style={{ ...S.td, color: '#64748b', fontSize: 13 }}>{p.notes || '—'}</td>
                            <td style={{ ...S.td, color: '#94a3b8', fontSize: 12 }}>{fmtDate(p.purchase_date)}</td>
                            <td style={S.td}>
                              <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeletePurchase(p.id)}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : SALAIRES & IMPÔTS
          ══════════════════════════════════════════ */}
          {tab === 'salaires' && (
            <div>
              <div style={S.sectionHeader}>
                <h2 style={S.sectionTitle}>Salaires & Impôts</h2>
                <button style={S.btnPrimary} onClick={() => setShowAddSale(true)}>+ Enregistrer une vente</button>
              </div>

              {/* Modale : Ajouter une vente */}
              {showAddSale && (
                <div style={S.modal}>
                  <div style={S.modalBox}>
                    <h3 style={S.modalTitle}>Enregistrer une vente</h3>
                    <form onSubmit={handleAddSale} style={S.form}>
                      <label style={S.label}>Employé</label>
                      <select value={sEmployee} onChange={e => setSEmployee(e.target.value)} required style={S.select}>
                        <option value="">-- Choisir --</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <label style={S.label}>Produit vendu</label>
                      <select value={sProduct} onChange={e => setSProduct(e.target.value)} required style={S.select}>
                        <option value="">-- Choisir --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)} (stock: {p.stock_quantity})</option>
                        ))}
                      </select>
                      <label style={S.label}>Quantité</label>
                      <input type="number" min="1" value={sQty} onChange={e => setSQty(e.target.value)} required style={S.input} />
                      {sProduct && sQty && (
                        <div style={S.calcPreview}>
                          Total estimé : <strong>{fmt((products.find(p => String(p.id) === String(sProduct))?.price || 0) * parseInt(sQty || 0))}</strong>
                        </div>
                      )}
                      <div style={S.modalActions}>
                        <button type="button" style={S.btnSecondary} onClick={() => setShowAddSale(false)}>Annuler</button>
                        <button type="submit" style={S.btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : 'Enregistrer'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Récap impôts */}
              {employees.length > 0 && (() => {
                const totalSales = employees.reduce((a, e) => a + e.total_sales, 0);
                const totalSal = employees.reduce((a, e) => a + e.salary_due, 0);
                return (
                  <div style={S.taxBox}>
                    <div style={S.taxRow}>
                      <span>CA total du mois</span>
                      <strong>{fmt(totalSales)}</strong>
                    </div>
                    <div style={{ ...S.taxRow, color: '#dc2626' }}>
                      <span>Impôts à reverser (15%)</span>
                      <strong>{fmt(totalSales * TAX_RATE)}</strong>
                    </div>
                    <div style={{ ...S.taxRow, color: '#d97706' }}>
                      <span>Total salaires à distribuer</span>
                      <strong>{fmt(totalSal)}</strong>
                    </div>
                    <div style={{ ...S.taxRow, borderTop: '2px solid #e2e8f0', paddingTop: 10, marginTop: 4, color: '#16a34a' }}>
                      <span>Bénéfice net</span>
                      <strong>{fmt(totalSales - totalSales * TAX_RATE - totalSal)}</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Tableau des employés */}
              <h3 style={S.subTitle}>Salaires par employé ce mois-ci</h3>
              {employees.length === 0 ? <p style={S.loading}>Chargement…</p> : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Employé</th>
                        <th style={S.th}>Rôle</th>
                        <th style={S.th}>Ventes du mois</th>
                        <th style={S.th}>% Salaire</th>
                        <th style={S.th}>Salaire à payer</th>
                        <th style={S.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} style={S.tr}>
                          <td style={S.td}><strong>{emp.name}</strong></td>
                          <td style={S.td}>
                            <span style={{ ...S.badge, background: emp.role === 'patron' ? '#dbeafe' : '#f1f5f9', color: emp.role === 'patron' ? '#1d4ed8' : '#475569' }}>
                              {emp.role === 'patron' ? '👑 Patron' : '👤 Employé'}
                            </span>
                          </td>
                          <td style={S.td}>{fmt(emp.total_sales)}</td>
                          <td style={S.td}>
                            {editingEmployee === emp.id ? (
                              <SalaryEditor current={emp.salary_percent} onSave={(v) => handleUpdateSalaryPercent(emp.id, v)} onCancel={() => setEditingEmployee(null)} />
                            ) : (
                              <span>{emp.salary_percent}%</span>
                            )}
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#d97706' }}>{fmt(emp.salary_due)}</td>
                          <td style={S.td}>
                            {editingEmployee !== emp.id && (
                              <button style={S.btnSmall} onClick={() => setEditingEmployee(emp.id)}>✏️ Modifier %</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Historique des ventes */}
              <h3 style={{ ...S.subTitle, marginTop: 32 }}>Historique des ventes</h3>
              {sales.length === 0 ? (
                <p style={S.empty}>Aucune vente enregistrée pour le moment.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Employé</th>
                        <th style={S.th}>Produit</th>
                        <th style={S.th}>Qté</th>
                        <th style={S.th}>Prix unit.</th>
                        <th style={S.th}>Total</th>
                        <th style={S.th}>Date</th>
                        <th style={S.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id} style={S.tr}>
                          <td style={S.td}>{s.employee_name}</td>
                          <td style={S.td}>{s.product_name}</td>
                          <td style={S.td}>{s.quantity}</td>
                          <td style={S.td}>{fmt(s.unit_price)}</td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{fmt(s.total_amount)}</td>
                          <td style={{ ...S.td, color: '#94a3b8', fontSize: 12 }}>{fmtDate(s.sale_date)}</td>
                          <td style={S.td}>
                            <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteSale(s.id)}>🗑️ Annuler</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : PRODUITS
          ══════════════════════════════════════════ */}
          {tab === 'produits' && (
            <div>
              <div style={S.sectionHeader}>
                <h2 style={S.sectionTitle}>Gestion des produits</h2>
                <button style={S.btnPrimary} onClick={() => { setShowAddProduct(true); setEditingProduct(null); resetProductForm(); }}>+ Ajouter un produit</button>
              </div>

              {/* Formulaire ajout/modif produit */}
              {(showAddProduct || editingProduct) && (
                <div style={S.formCard}>
                  <h3 style={S.subTitle}>{editingProduct ? '✏️ Modifier le produit' : '➕ Nouveau produit'}</h3>
                  <form onSubmit={editingProduct ? handleEditProduct : handleAddProduct} style={S.formGrid}>
                    <div>
                      <label style={S.label}>Nom du produit *</label>
                      <input value={pName} onChange={e => setPName(e.target.value)} required placeholder="Ex: Café expresso" style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Catégorie</label>
                      <input value={pCategory} onChange={e => setPCategory(e.target.value)} placeholder="Ex: Boissons" style={S.input} />
                    </div>
                    <div>
                      <label style={S.label}>Prix de vente ($) *</label>
                      <input type="number" min="0" step="0.01" value={pPrice} onChange={e => setPPrice(e.target.value)} required placeholder="0" style={S.input} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={S.label}>Image du produit <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(lien URL — ex: goopics, imgur…)</span></label>
                      <input type="url" value={pImageUrl} onChange={e => setPImageUrl(e.target.value)} placeholder="https://i.goopics.net/abc123.png" style={S.input} />
                      {pImageUrl && (
                        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img src={pImageUrl} alt="Aperçu" onError={e => e.target.style.display='none'}
                            style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid #e2e8f0' }} />
                          <span style={{ fontSize: 12, color: '#64748b' }}>Aperçu de l'image</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <button type="button" style={S.btnSecondary} onClick={() => { setShowAddProduct(false); setEditingProduct(null); resetProductForm(); }}>Annuler</button>
                      <button type="submit" style={S.btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : (editingProduct ? 'Enregistrer les modifications' : 'Ajouter le produit')}</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Liste des produits */}
              {products.length === 0 ? (
                <p style={S.empty}>Aucun produit. Ajoutez-en un ci-dessus.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Produit</th>
                        <th style={S.th}>Catégorie</th>
                        <th style={S.th}>Prix</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} style={S.tr}>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {p.image_url
                                ? <img src={p.image_url} alt={p.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', flexShrink: 0 }} onError={e => e.target.style.display='none'} />
                                : <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                              }
                              <strong>{p.name}</strong>
                            </div>
                          </td>
                          <td style={S.td}><span style={S.chip}>{p.category}</span></td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{fmt(p.price)}</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button style={S.btnSmall} onClick={() => openEditProduct(p)}>✏️ Modifier</button>
                              <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteProduct(p.id)}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              ONGLET : STOCKS (matières premières)
          ══════════════════════════════════════════ */}
          {tab === 'stocks' && (
            <div>
              <h2 style={S.sectionTitle}>Stocks — Matières premières</h2>

              {/* Alertes stock bas */}
              {rawMaterials.filter(m => m.quantity <= m.min_alert).length > 0 && (
                <div style={S.alertBanner}>
                  ⚠️ <strong>{rawMaterials.filter(m => m.quantity <= m.min_alert).length} matière(s) première(s)</strong> en stock bas !
                </div>
              )}

              {/* Formulaire ajout / modification matière première */}
              <div style={S.formCard}>
                <h3 style={S.subTitle}>{editingRm ? '✏️ Modifier la matière première' : '➕ Nouvelle matière première'}</h3>
                <form onSubmit={handleAddRm} style={S.formGrid}>
                  <div>
                    <label style={S.label}>Nom *</label>
                    <input value={rmName} onChange={e => setRmName(e.target.value)} required placeholder="Ex: Café en grains, Lait…" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Unité</label>
                    <input value={rmUnit} onChange={e => setRmUnit(e.target.value)} placeholder="unité, kg, L…" style={S.input} />
                  </div>
                  {!editingRm && (
                    <div>
                      <label style={S.label}>Stock initial</label>
                      <input type="number" min="0" step="0.01" value={rmQty} onChange={e => setRmQty(e.target.value)} placeholder="0" style={S.input} />
                    </div>
                  )}
                  <div>
                    <label style={S.label}>Seuil d'alerte</label>
                    <input type="number" min="0" step="0.01" value={rmAlert} onChange={e => setRmAlert(e.target.value)} placeholder="5" style={S.input} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    {editingRm && (
                      <button type="button" style={S.btnSecondary} onClick={() => { setEditingRm(null); setRmName(''); setRmUnit('unité'); setRmQty('0'); setRmAlert('5'); }}>Annuler</button>
                    )}
                    <button type="submit" style={S.btnPrimary} disabled={loading}>{loading ? 'Enregistrement…' : (editingRm ? 'Enregistrer' : '➕ Ajouter')}</button>
                  </div>
                </form>
              </div>

              {/* Liste des matières premières */}
              {rawMaterials.length === 0 ? (
                <p style={S.empty}>Aucune matière première. Ajoutez-en une ci-dessus.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Matière première</th>
                        <th style={S.th}>Unité</th>
                        <th style={S.th}>Stock actuel</th>
                        <th style={S.th}>Seuil alerte</th>
                        <th style={S.th}>Statut</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rawMaterials.map((m) => {
                        const isLow = m.quantity <= m.min_alert;
                        return (
                          <tr key={m.id} style={{ ...S.tr, background: isLow ? '#fff7f7' : '#fff' }}>
                            <td style={S.td}><strong>{m.name}</strong></td>
                            <td style={S.td}><span style={S.chip}>{m.unit}</span></td>
                            <td style={S.td}>
                              {editingRmStock === m.id ? (
                                <StockEditor current={m.quantity} onSave={(v) => handleUpdateRmStock(m.id, v)} onCancel={() => setEditingRmStock(null)} />
                              ) : (
                                <span style={{ fontSize: 16, fontWeight: 700, color: isLow ? '#dc2626' : '#1e293b' }}>{m.quantity}</span>
                              )}
                            </td>
                            <td style={S.td}>{m.min_alert}</td>
                            <td style={S.td}>
                              {m.quantity === 0
                                ? <span style={{ ...S.badge, background: '#fee2e2', color: '#dc2626' }}>❌ Épuisé</span>
                                : isLow
                                ? <span style={{ ...S.badge, background: '#fef3c7', color: '#d97706' }}>⚠️ Stock bas</span>
                                : <span style={{ ...S.badge, background: '#dcfce7', color: '#16a34a' }}>✅ OK</span>
                              }
                            </td>
                            <td style={S.td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {editingRmStock !== m.id && (
                                  <button style={S.btnSmall} onClick={() => setEditingRmStock(m.id)}>📦 Stock</button>
                                )}
                                <button style={S.btnSmall} onClick={() => { setEditingRm(m); setRmName(m.name); setRmUnit(m.unit); setRmAlert(String(m.min_alert)); }}>✏️ Modifier</button>
                                <button style={{ ...S.btnSmall, color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleDeleteRm(m.id)}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Sous-composants ─────────────────────────────────────────
function StockEditor({ current, onSave, onCancel }) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: 70, padding: '4px 8px', border: '1.5px solid #2563eb', borderRadius: 6, fontSize: 14 }} />
      <button style={{ ...S.btnSmall, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} onClick={() => onSave(val)}>✓</button>
      <button style={S.btnSmall} onClick={onCancel}>✕</button>
    </div>
  );
}

function SalaryEditor({ current, onSave, onCancel }) {
  const [val, setVal] = useState(String(current));
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" min="0" max="100" step="0.5" value={val} onChange={e => setVal(e.target.value)}
        style={{ width: 70, padding: '4px 8px', border: '1.5px solid #2563eb', borderRadius: 6, fontSize: 14 }} />
      <span>%</span>
      <button style={{ ...S.btnSmall, background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} onClick={() => onSave(val)}>✓</button>
      <button style={S.btnSmall} onClick={onCancel}>✕</button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Segoe UI', Arial, sans-serif" },
  loadingPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' },
  spinner: { width: 40, height: 40, border: '4px solid #e0e0e0', borderTop: '4px solid #2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  toast: { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, color: '#fff', fontWeight: 600, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' },

  nav: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 },
  navLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  navLogo: { fontWeight: 700, fontSize: 18, color: '#1e293b' },
  navCompany: { background: '#dbeafe', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser: { color: '#64748b', fontSize: 14 },
  navBtn: { padding: '6px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 },

  tabBar: { background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 24px', overflowX: 'auto' },
  tabBtn: { padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#64748b', whiteSpace: 'nowrap', borderBottom: '2px solid transparent' },
  tabBtnActive: { color: '#2563eb', borderBottom: '2px solid #2563eb', background: '#f8faff' },

  main: { maxWidth: 1100, margin: '0 auto', padding: '28px 24px' },
  sectionTitle: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 },
  subTitle: { fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 12 },
  loading: { color: '#94a3b8', fontStyle: 'italic' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1px dashed #e2e8f0' },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  kpiCard: { background: '#fff', borderRadius: 12, padding: '20px', border: '2px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  kpiIcon: { fontSize: 28, marginBottom: 8 },
  kpiLabel: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  kpiValue: { fontSize: 24, fontWeight: 700, color: '#1e293b' },

  alertBanner: { background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#92400e', fontSize: 14 },
  alertLink: { background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: 14 },

  taxBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420 },
  taxRow: { display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#374151' },

  tableWrap: { overflowX: 'auto', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden' },
  th: { background: '#f8fafc', padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '13px 16px', fontSize: 14, color: '#374151', verticalAlign: 'middle' },

  badge: { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  chip: { background: '#f1f5f9', color: '#475569', padding: '2px 10px', borderRadius: 20, fontSize: 12 },

  btnPrimary: { padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnSecondary: { padding: '9px 18px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnSmall: { padding: '5px 10px', background: '#fff', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 },

  formCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px', marginBottom: 24 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' },
  input: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fafafa', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fafafa', boxSizing: 'border-box' },
  calcPreview: { padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, fontSize: 14, color: '#0369a1' },

  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modalBox: { background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 },
  modalActions: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  qtyBtn2: { width: 28, height: 28, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#374151' },

  // Validation comptes
  pendingBox:     { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, padding: '16px 20px', marginBottom: 20 },
  pendingTitle:   { fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 12 },
  pendingList:    { display: 'flex', flexDirection: 'column', gap: 10 },
  pendingRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 10, padding: '12px 16px', flexWrap: 'wrap', gap: 10 },
  pendingInfo:    { display: 'flex', flexDirection: 'column', gap: 2 },
  pendingEmail:   { fontSize: 13, color: '#64748b' },
  pendingDate:    { fontSize: 12, color: '#94a3b8' },
  pendingActions: { display: 'flex', gap: 8 },
  btnApprove:     { padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnReject:      { padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

  // Achats
  purchaseSummary: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  pSumItem:  { background: '#fff', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 150, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  pSumLabel: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: 500 },
  pSumValue: { fontSize: 20, fontWeight: 800, color: '#1e293b' },
};
