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

  // Formulaire vente
  const [sEmployee, setSEmployee] = useState('');
  const [sProduct, setSProduct] = useState('');
  const [sQty, setSQty] = useState('1');

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

  useEffect(() => {
    if (status !== 'authenticated') return;
    loadOverview();
    if (tab === 'salaires') { loadEmployees(); loadProducts(); loadSales(); }
    if (tab === 'produits') loadProducts();
    if (tab === 'stocks') loadProducts();
  }, [tab, status, loadOverview, loadEmployees, loadProducts, loadSales]);

  // ── Actions produits ──
  async function handleAddProduct(e) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch('/api/patron/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: pName, category: pCategory, price: parseFloat(pPrice), stock_quantity: parseInt(pStock) || 0, stock_min_alert: parseInt(pAlert) || 5 }),
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
      body: JSON.stringify({ id: editingProduct.id, name: pName, category: pCategory, price: parseFloat(pPrice), stock_min_alert: parseInt(pAlert) || 5 }),
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
    setPName(p.name); setPCategory(p.category); setPPrice(String(p.price)); setPAlert(String(p.stock_min_alert));
    setShowAddProduct(false);
  }

  function resetProductForm() { setPName(''); setPCategory(''); setPPrice(''); setPStock(''); setPAlert('5'); }

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

  const tabs = [
    { key: 'overview', label: '🏠 Vue d\'ensemble' },
    { key: 'salaires', label: '💰 Salaires & Impôts' },
    { key: 'produits', label: '📦 Produits' },
    { key: 'stocks', label: '📊 Stocks' },
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
                    <div style={{ ...S.kpiCard, borderColor: '#dc2626' }}>
                      <div style={S.kpiIcon}>🏛️</div>
                      <div style={S.kpiLabel}>Impôts à payer (15%)</div>
                      <div style={{ ...S.kpiValue, color: '#dc2626' }}>{fmt(overview.taxes)}</div>
                    </div>
                    <div style={{ ...S.kpiCard, borderColor: '#f59e0b' }}>
                      <div style={S.kpiIcon}>👥</div>
                      <div style={S.kpiLabel}>Salaires à distribuer</div>
                      <div style={{ ...S.kpiValue, color: '#d97706' }}>{fmt(overview.totalSalaries)}</div>
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
                    {!editingProduct && (
                      <div>
                        <label style={S.label}>Stock initial</label>
                        <input type="number" min="0" value={pStock} onChange={e => setPStock(e.target.value)} placeholder="0" style={S.input} />
                      </div>
                    )}
                    <div>
                      <label style={S.label}>Alerte stock bas (seuil)</label>
                      <input type="number" min="0" value={pAlert} onChange={e => setPAlert(e.target.value)} style={S.input} />
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
                        <th style={S.th}>Stock</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} style={S.tr}>
                          <td style={S.td}><strong>{p.name}</strong></td>
                          <td style={S.td}><span style={S.chip}>{p.category}</span></td>
                          <td style={{ ...S.td, fontWeight: 600 }}>{fmt(p.price)}</td>
                          <td style={S.td}>
                            <span style={{ color: p.stock_quantity <= p.stock_min_alert ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                              {p.stock_quantity <= p.stock_min_alert ? '⚠️ ' : ''}
                              {p.stock_quantity}
                            </span>
                          </td>
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
              ONGLET : STOCKS
          ══════════════════════════════════════════ */}
          {tab === 'stocks' && (
            <div>
              <h2 style={S.sectionTitle}>Gestion des stocks</h2>

              {products.filter(p => p.stock_quantity <= p.stock_min_alert).length > 0 && (
                <div style={S.alertBanner}>
                  ⚠️ <strong>{products.filter(p => p.stock_quantity <= p.stock_min_alert).length} produit(s)</strong> en stock bas ou épuisé(s) !
                </div>
              )}

              {products.length === 0 ? (
                <p style={S.empty}>Aucun produit. Allez dans "Produits" pour en ajouter.</p>
              ) : (
                <div style={S.tableWrap}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Produit</th>
                        <th style={S.th}>Catégorie</th>
                        <th style={S.th}>Stock actuel</th>
                        <th style={S.th}>Seuil alerte</th>
                        <th style={S.th}>Statut</th>
                        <th style={S.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => {
                        const isLow = p.stock_quantity <= p.stock_min_alert;
                        return (
                          <tr key={p.id} style={{ ...S.tr, background: isLow ? '#fff7f7' : '#fff' }}>
                            <td style={S.td}><strong>{p.name}</strong></td>
                            <td style={S.td}><span style={S.chip}>{p.category}</span></td>
                            <td style={S.td}>
                              {editingStock === p.id ? (
                                <StockEditor current={p.stock_quantity} onSave={(v) => handleUpdateStock(p.id, v)} onCancel={() => setEditingStock(null)} />
                              ) : (
                                <span style={{ fontSize: 16, fontWeight: 700, color: isLow ? '#dc2626' : '#1e293b' }}>{p.stock_quantity}</span>
                              )}
                            </td>
                            <td style={S.td}>{p.stock_min_alert}</td>
                            <td style={S.td}>
                              {p.stock_quantity === 0
                                ? <span style={{ ...S.badge, background: '#fee2e2', color: '#dc2626' }}>❌ Épuisé</span>
                                : isLow
                                ? <span style={{ ...S.badge, background: '#fef3c7', color: '#d97706' }}>⚠️ Stock bas</span>
                                : <span style={{ ...S.badge, background: '#dcfce7', color: '#16a34a' }}>✅ OK</span>
                              }
                            </td>
                            <td style={S.td}>
                              {editingStock !== p.id && (
                                <button style={S.btnSmall} onClick={() => setEditingStock(p.id)}>✏️ Modifier</button>
                              )}
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
};
