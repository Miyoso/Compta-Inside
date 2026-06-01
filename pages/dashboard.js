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

  // Changement de mot de passe
  const [cpCurrent,  setCpCurrent]  = useState('');
  const [cpNew,      setCpNew]      = useState('');
  const [cpConfirm,  setCpConfirm]  = useState('');
  const [cpLoading,  setCpLoading]  = useState(false);

  const [selEmployee, setSelEmployee] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [toast,    setToast]    = useState(null);
  const [expanded, setExpanded] = useState(null); // id facture dépliée

  // Garage employee state
  const [myQuotes, setMyQuotes] = useState([]);
  const [expandedQ, setExpandedQ] = useState(null);

  // Immo employee state
  const [immoLocations, setImmoLocations] = useState([]);
  const [immoBiens,     setImmoBiens]     = useState([]);
  const [immoSearch,    setImmoSearch]    = useState('');
  const [immoLoading,   setImmoLoading]   = useState(false);
  const defaultImmoForm = { bien_id:'', bien_nom:'', adresse:'', client_prenom:'', client_nom:'', client_numero:'', tier_stock:1000, nb_jours:1, notes:'' };
  const [immoForm, setImmoForm] = useState(defaultImmoForm);
  const [immoSelectedBien, setImmoSelectedBien] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
    if (status === 'authenticated' && ['patron', 'admin'].includes(session?.user?.role))
      router.push('/patron');
    if (status === 'authenticated' && session?.user?.companyType === 'immobilier')
      setTab('locations');
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

  const loadMyQuotes = useCallback(async () => {
    const r = await fetch('/api/garage/devis?mine=1');
    if (r.ok) { const d = await r.json(); setMyQuotes(d.quotes || []); }
  }, []);

  const isGarage = session?.user?.companyType === 'garage';
  const isImmo   = session?.user?.companyType === 'immobilier';

  const loadImmoLocations = useCallback(async () => {
    const r = await fetch('/api/employee/immo-locations');
    if (r.ok) setImmoLocations(await r.json());
  }, []);

  const loadImmoBiens = useCallback(async () => {
    const r = await fetch('/immo_biens.json');
    if (r.ok) setImmoBiens(await r.json());
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (isImmo) {
      loadImmoBiens();
      if (tab === 'locations') loadImmoLocations();
      if (tab === 'salaire')   loadSalary();
    } else if (isGarage) {
      if (tab === 'devis')   loadMyQuotes();
      if (tab === 'salaire') loadSalary();
    } else {
      loadProducts();
      if (tab === 'ventes')  loadInvoices();
      if (tab === 'salaire') loadSalary();
    }
  }, [tab, status, isGarage, isImmo, loadProducts, loadInvoices, loadSalary, loadMyQuotes, loadImmoLocations, loadImmoBiens]);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (cpNew !== cpConfirm) return showToast('Les deux nouveaux mots de passe ne correspondent pas.', 'error');
    setCpLoading(true);
    const r = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
    });
    const d = await r.json();
    setCpLoading(false);
    if (r.ok) { showToast('✅ Mot de passe modifié !'); setCpCurrent(''); setCpNew(''); setCpConfirm(''); }
    else showToast(d.error, 'error');
  }

  // ── Gestion du panier ─────────────────────────────────────
  function addToCart(product) {
    setCart((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) {
        return prev.map((i) =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
  }

  function removeFromCart(product_id) {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));
  }

  function setCartQty(product_id, qty) {
    const n = parseInt(qty);
    if (isNaN(n) || n < 1) return;
    setCart((prev) =>
      prev.map((i) => i.product_id === product_id ? { ...i, quantity: n } : i)
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
        <nav className="ci-nav">
          <div className="ci-nav-left">
            <span className="ci-nav-logo">{isGarage ? '🔧' : isImmo ? '🏠' : '📊'} Compta-Inside</span>
            <span className="ci-nav-company">{session.user.companyName}</span>
          </div>
          <div className="ci-nav-right">
            <span className="ci-nav-user">👤 {session.user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="ci-nav-btn">Déconnexion</button>
          </div>
        </nav>

        {/* Onglets */}
        <div className="ci-tabs">
          {isImmo ? (
            <>
              <button className={`ci-tab-btn${tab==='locations'?' active':''}`} onClick={()=>setTab('locations')}>🏠 Locations</button>
              <button className={`ci-tab-btn${tab==='biens'    ?' active':''}`} onClick={()=>setTab('biens')}>🗂️ Catalogue Biens</button>
              <button className={`ci-tab-btn${tab==='compte'   ?' active':''}`} onClick={()=>setTab('compte')}>⚙️ Mon compte</button>
            </>
          ) : isGarage ? (
            <>
              <button className={`ci-tab-btn${tab==='devis'  ?' active':''}`} onClick={()=>setTab('devis')}>🔧 Mes devis</button>
              <button className={`ci-tab-btn${tab==='salaire'?' active':''}`} onClick={()=>setTab('salaire')}>💵 Mon salaire</button>
              <button className={`ci-tab-btn${tab==='compte' ?' active':''}`} onClick={()=>setTab('compte')}>⚙️ Mon compte</button>
            </>
          ) : (
            <>
              <button className={`ci-tab-btn${tab==='ventes' ?' active':''}`} onClick={()=>setTab('ventes')}>🛒 Mes ventes</button>
              <button className={`ci-tab-btn${tab==='salaire'?' active':''}`} onClick={()=>setTab('salaire')}>💵 Mon salaire</button>
              <button className={`ci-tab-btn${tab==='compte' ?' active':''}`} onClick={()=>setTab('compte')}>⚙️ Mon compte</button>
            </>
          )}
        </div>

        <main className="ci-page">

          {/* ══ ONGLETS IMMOBILIER ══ */}
          {isImmo && tab === 'locations' && (
            <div>
              <h2 style={S.title}>🏠 Enregistrer une location</h2>
              {/* Formulaire */}
              <div style={{background:'linear-gradient(145deg,#16102a,#1e1435)',borderRadius:16,padding:24,marginBottom:28,border:'1px solid rgba(224,64,251,0.15)',maxWidth:600}}>
                {/* Recherche bien */}
                <div style={{marginBottom:14}}>
                  <label style={S.label}>Rechercher un bien</label>
                  <input style={S.input} placeholder="Nom ou catégorie..." value={immoSearch}
                    onChange={e=>{ setImmoSearch(e.target.value); setImmoSelectedBien(null); setImmoForm(f=>({...f,bien_id:'',bien_nom:''})); }} />
                  {immoSearch.length >= 2 && !immoSelectedBien && (
                    <div style={{background:'#0a061a',border:'1px solid rgba(224,64,251,0.2)',borderRadius:8,marginTop:4,maxHeight:200,overflowY:'auto'}}>
                      {immoBiens.filter(b=>b.nom.toLowerCase().includes(immoSearch.toLowerCase())||b.categorie.toLowerCase().includes(immoSearch.toLowerCase())).slice(0,10).map(b=>(
                        <div key={b.id} onClick={()=>{ setImmoSelectedBien(b); setImmoSearch(b.nom); setImmoForm(f=>({...f,bien_id:b.id,bien_nom:b.nom,tier_stock:1000})); }}
                          style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid rgba(224,64,251,0.08)',color:'#d0b8f8',fontSize:14}}>
                          <strong>{b.nom}</strong> <span style={{color:'#8060a0',fontSize:12}}>— {b.categorie}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Palier et prix */}
                {immoSelectedBien && (
                  <div style={{marginBottom:14}}>
                    <label style={S.label}>Palier de stockage</label>
                    <select style={S.input} value={immoForm.tier_stock} onChange={e=>setImmoForm(f=>({...f,tier_stock:parseInt(e.target.value)}))}>
                      {immoSelectedBien.tiers.map(t=>(
                        <option key={t.stock} value={t.stock}>{t.stock} — {fmt(t.prix_jour)}/jour</option>
                      ))}
                    </select>
                    <div style={{marginTop:6,fontSize:13,color:'#8060a0'}}>
                      Prix/jour : <strong style={{color:'#e040fb'}}>{fmt(immoSelectedBien.tiers.find(t=>t.stock===immoForm.tier_stock)?.prix_jour||0)}</strong>
                    </div>
                  </div>
                )}
                {/* Nb jours */}
                <div style={{marginBottom:14}}>
                  <label style={S.label}>Nombre de jours</label>
                  <input style={S.input} type="number" min="1" value={immoForm.nb_jours}
                    onChange={e=>setImmoForm(f=>({...f,nb_jours:parseInt(e.target.value)||1}))} />
                </div>
                {/* Client */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                  <div>
                    <label style={S.label}>Prénom client</label>
                    <input style={S.input} value={immoForm.client_prenom} onChange={e=>setImmoForm(f=>({...f,client_prenom:e.target.value}))} />
                  </div>
                  <div>
                    <label style={S.label}>Nom client</label>
                    <input style={S.input} value={immoForm.client_nom} onChange={e=>setImmoForm(f=>({...f,client_nom:e.target.value}))} />
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                  <div>
                    <label style={S.label}>N° IC / Téléphone</label>
                    <input style={S.input} value={immoForm.client_numero} onChange={e=>setImmoForm(f=>({...f,client_numero:e.target.value}))} />
                  </div>
                  <div>
                    <label style={S.label}>Adresse du bien</label>
                    <input style={S.input} value={immoForm.adresse} onChange={e=>setImmoForm(f=>({...f,adresse:e.target.value}))} />
                  </div>
                </div>
                <div style={{marginBottom:18}}>
                  <label style={S.label}>Notes</label>
                  <input style={S.input} value={immoForm.notes} onChange={e=>setImmoForm(f=>({...f,notes:e.target.value}))} />
                </div>
                {/* Résumé prix */}
                {immoSelectedBien && (
                  <div style={{background:'rgba(224,64,251,0.07)',border:'1px solid rgba(224,64,251,0.18)',borderRadius:10,padding:'12px 16px',marginBottom:18,fontSize:14,color:'#d0b8f8'}}>
                    {(() => {
                      const tier = immoSelectedBien.tiers.find(t=>t.stock===immoForm.tier_stock);
                      const pj   = tier?.prix_jour || 0;
                      const tot  = pj * (immoForm.nb_jours||1);
                      const ben  = tot * ((immoSelectedBien.marge_pct||20)/100);
                      const tax  = tot * ((immoSelectedBien.taxe_pct||10)/100);
                      return (
                        <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
                          <div>Total : <strong style={{color:'#f0e8ff'}}>{fmt(tot)}</strong></div>
                          <div>Bénéfice agence : <strong style={{color:'#e040fb'}}>{fmt(ben)}</strong></div>
                          <div>Taxe : <strong style={{color:'#fbbf24'}}>{fmt(tax)}</strong></div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <button disabled={immoLoading || !immoForm.bien_id || !immoForm.client_prenom || !immoForm.client_nom}
                  style={{...S.btnPrimary,opacity:(!immoForm.bien_id||!immoForm.client_prenom||!immoForm.client_nom)?0.5:1}}
                  onClick={async()=>{
                    if (!immoSelectedBien) return;
                    const tier = immoSelectedBien.tiers.find(t=>t.stock===immoForm.tier_stock);
                    setImmoLoading(true);
                    const r = await fetch('/api/employee/immo-locations',{
                      method:'POST',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({
                        bien_id:immoForm.bien_id, bien_nom:immoForm.bien_nom, adresse:immoForm.adresse,
                        client_prenom:immoForm.client_prenom, client_nom:immoForm.client_nom, client_numero:immoForm.client_numero,
                        tier_stock:immoForm.tier_stock, nb_jours:immoForm.nb_jours, prix_jour:tier?.prix_jour||0,
                        taxe_pct:immoSelectedBien.taxe_pct||10, marge_pct:immoSelectedBien.marge_pct||20, notes:immoForm.notes
                      })
                    });
                    setImmoLoading(false);
                    if (r.ok) {
                      showToast('Location enregistree !');
                      setImmoForm(defaultImmoForm); setImmoSelectedBien(null); setImmoSearch('');
                      loadImmoLocations();
                    } else { const d=await r.json(); showToast(d.error,'error'); }
                  }}>
                  {immoLoading ? 'Enregistrement...' : '✅ Enregistrer la location'}
                </button>
              </div>
              {/* Mes locations */}
              <h3 style={{...S.subTitle,marginBottom:12}}>📋 Mes locations</h3>
              {immoLocations.length===0 ? (
                <p style={S.empty}>Aucune location enregistrée.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {immoLocations.map(l=>(
                    <div key={l.id} style={{background:'linear-gradient(145deg,#16102a,#1e1435)',borderRadius:12,padding:'14px 18px',border:'1px solid rgba(224,64,251,0.12)',display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{fontWeight:700,color:'#d0b8f8',fontSize:15}}>{l.bien_nom}</div>
                        <div style={{fontSize:12,color:'#8060a0',marginTop:2}}>{l.client_prenom} {l.client_nom} — {l.nb_jours}j</div>
                      </div>
                      <div style={{fontWeight:800,color:'#e040fb',fontSize:16}}>{fmt(l.prix_total)}</div>
                      <div style={{fontSize:12,color:'#5a4080'}}>{new Date(l.created_at).toLocaleDateString('fr-FR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isImmo && tab === 'biens' && (
            <div>
              <h2 style={S.title}>🗂️ Catalogue Biens</h2>
              <input style={{...S.input,marginBottom:18,maxWidth:360}} placeholder="Rechercher un bien..." value={immoSearch}
                onChange={e=>setImmoSearch(e.target.value)} />
              {(['Hébergement','Appartement','Villa & Maison','Bureau','Parking & Garage','Stockage']).map(cat=>{
                const biens = immoBiens.filter(b=>b.categorie===cat&&(immoSearch.length<2||b.nom.toLowerCase().includes(immoSearch.toLowerCase())));
                if (!biens.length) return null;
                return (
                  <div key={cat} style={{marginBottom:24}}>
                    <h3 style={{...S.subTitle,marginBottom:10}}>{cat}</h3>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:12}}>
                      {biens.map(b=>(
                        <div key={b.id} style={{background:'linear-gradient(145deg,#16102a,#1e1435)',borderRadius:12,padding:'14px 16px',border:'1px solid rgba(224,64,251,0.12)'}}>
                          <div style={{fontWeight:700,color:'#f0e8ff',fontSize:14,marginBottom:6}}>{b.nom}</div>
                          <div style={{fontSize:11,color:'#5a4080',marginBottom:8}}>Taxe {b.taxe_pct}% · Marge {b.marge_pct}%</div>
                          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                            {b.tiers.map(t=>(
                              <div key={t.stock} style={{background:'rgba(224,64,251,0.08)',border:'1px solid rgba(224,64,251,0.18)',borderRadius:6,padding:'4px 8px',fontSize:11,color:'#d0b8f8'}}>
                                {t.stock} — {fmt(t.prix_jour)}/j
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ ONGLET DEVIS (garage employees) ══ */}
          {isGarage && tab === 'devis' && (
            <div>
              <h2 style={S.title}>🔧 Mes devis</h2>
              {myQuotes.length === 0 ? (
                <p style={S.empty}>Aucun devis enregistré pour toi.</p>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {myQuotes.map(q=>{
                    const isOpen = expandedQ === q.id;
                    const fmtN = n => '$'+Number(n||0).toLocaleString('fr-CA',{maximumFractionDigits:0});
                    return (
                      <div key={q.id} style={{background:'linear-gradient(145deg,#16102a,#1e1435)',borderRadius:12,border:'1px solid rgba(251,191,36,0.15)',overflow:'hidden'}}>
                        <div onClick={()=>setExpandedQ(isOpen?null:q.id)} style={{display:'flex',alignItems:'center',padding:'14px 20px',cursor:'pointer',gap:16}}>
                          <div style={{flex:1}}>
                            <span style={{fontWeight:700,color:'#d0b8f8',fontSize:15}}>{q.client_first_name} {q.client_last_name}</span>
                            <span style={{marginLeft:10,fontSize:12,color:'#8060a0'}}>{q.vehicle_model} · {q.vehicle_category}</span>
                          </div>
                          <div style={{fontWeight:800,color:'#fbbf24',fontSize:16}}>{fmtN(q.grand_total)}</div>
                          <div style={{fontSize:12,color:'#8060a0'}}>{new Date(q.created_at).toLocaleDateString('fr-FR')}</div>
                          <div style={{color:'#5a4080'}}>{isOpen?'▲':'▼'}</div>
                        </div>
                        {isOpen && (
                          <div style={{padding:'0 20px 16px',borderTop:'1px solid rgba(120,60,180,0.2)'}}>
                            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginTop:14}}>
                              {q.selected_performances?.length>0&&(
                                <div>
                                  <div style={{fontSize:11,color:'#8060a0',textTransform:'uppercase',marginBottom:4}}>⚡ Performances</div>
                                  {q.selected_performances.map((p,i)=><div key={i} style={{fontSize:12,color:'#c0a0e0',display:'flex',justifyContent:'space-between'}}><span>{p.type}</span><span>{fmtN(p.price)}</span></div>)}
                                  <div style={{marginTop:4,fontWeight:700,color:'#d0b8f8',fontSize:12}}>Sous-total: {fmtN(q.perfs_total)}</div>
                                </div>
                              )}
                              {q.selected_customs?.length>0&&(
                                <div>
                                  <div style={{fontSize:11,color:'#8060a0',textTransform:'uppercase',marginBottom:4}}>🔩 Customs</div>
                                  {q.selected_customs.map((c,i)=><div key={i} style={{fontSize:12,color:'#c0a0e0',display:'flex',justifyContent:'space-between'}}><span>{c.type}</span><span>{fmtN(c.price)}</span></div>)}
                                  <div style={{marginTop:4,fontWeight:700,color:'#d0b8f8',fontSize:12}}>Sous-total: {fmtN(q.customs_total)}</div>
                                </div>
                              )}
                              {q.selected_paints?.length>0&&(
                                <div>
                                  <div style={{fontSize:11,color:'#8060a0',textTransform:'uppercase',marginBottom:4}}>🎨 Peintures</div>
                                  {q.selected_paints.map((p,i)=><div key={i} style={{fontSize:12,color:'#c0a0e0',display:'flex',justifyContent:'space-between'}}><span>{p.type}</span><span>{fmtN(p.price)}</span></div>)}
                                  <div style={{marginTop:4,fontWeight:700,color:'#d0b8f8',fontSize:12}}>Sous-total: {fmtN(q.paints_total)}</div>
                                </div>
                              )}
                            </div>
                            {q.notes && <div style={{marginTop:10,padding:'8px 12px',background:'rgba(120,60,180,0.08)',borderRadius:8,fontSize:12,color:'#a080c0'}}>📝 {q.notes}</div>}
                            <div style={{marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid rgba(120,60,180,0.1)',paddingTop:10}}>
                              <span style={{fontSize:12,color:'#604080'}}>Enregistré le {new Date(q.created_at).toLocaleString('fr-FR')}</span>
                              <span style={{fontWeight:800,color:'#fbbf24',fontSize:16}}>Total: {fmtN(q.grand_total)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ ONGLET VENTES ══ */}
          {!isGarage && tab === 'ventes' && (
            <div style={S.splitLayout}>

              {/* Gauche : catalogue produits */}
              <div style={S.catalog}>
                <h2 style={S.title}>Créer une facture</h2>
                <p style={S.hint}>Clique sur un produit pour l'ajouter au panier. Tu peux en ajouter plusieurs.</p>

                {products.length === 0 ? (
                  <p style={S.empty}>Aucun produit disponible. Contacte ton patron.</p>
                ) : (
                  (() => {
                    const cats = [...new Set(products.map(p => p.category || 'Autre'))];
                    return cats.map(cat => (
                      <div key={cat} style={{ marginBottom: 22 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, height: 1, background: 'rgba(192,132,252,0.2)', display: 'inline-block' }} />
                          {cat}
                          <span style={{ flex: 6, height: 1, background: 'rgba(192,132,252,0.2)', display: 'inline-block' }} />
                        </div>
                        <div style={S.productGrid}>
                          {products.filter(p => (p.category || 'Autre') === cat).map((p) => {
                            const inCart = cart.find((i) => i.product_id === p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => addToCart(p)}
                                style={{ ...S.productCard, ...(inCart ? S.productCardInCart : {}) }}
                              >
                                {inCart && <div style={S.cartBadge}>× {inCart.quantity}</div>}
                                {p.image_url
                                  ? <img src={p.image_url} alt={p.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, margin: '0 auto 12px', display: 'block' }} onError={e => e.target.style.display='none'} />
                                  : <div style={{ fontSize: 50, marginBottom: 12 }}>📦</div>
                                }
                                <div style={S.productName}>{p.name}</div>
                                <div style={S.productPrice}>{fmt(p.price)}</div>
                                {p.recipe_count > 0 && (
                                  <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, marginTop: 4 }}>🧪 -{p.recipe_count} mat.</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()
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
                              <button style={S.qtyBtn} onClick={() => setCartQty(item.product_id, item.quantity + 1)}>+</button>
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
          {!isGarage && tab === 'ventes' && (
            <div style={{ marginTop: 32 }}>
              <h3 style={S.subTitle}>Mes factures de cette semaine</h3>
              {invoices.length === 0 ? (
                <p style={S.empty}>Aucune facture cette semaine.</p>
              ) : (
                <>
                  <div style={S.weekTotal}>
                    Total semaine : <strong>{fmt(invoices.reduce((a, i) => a + i.total_amount, 0))}</strong>
                    <span style={{ color: '#5c4230' }}> · {invoices.length} facture{invoices.length > 1 ? 's' : ''}</span>
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
              <h2 style={S.title}>💵 Mon salaire</h2>
              {!salaryData ? <p style={S.empty}>Chargement…</p> : (() => {
                const cp = salaryData.currentPeriod;
                const lp = salaryData.lastPaid;
                return (
                  <>
                    <div style={S.infoBox}>
                      ℹ️ Ton salaire est calculé à <strong>{salaryData.salaryPercent}%</strong> de ta marge ({isGarage ? 'devis − coût pièces' : 'vente − coût matières'}).
                      {salaryData.salaryPercent === 0 && ' Contacte ton patron pour définir ton taux.'}
                    </div>

                    {/* Bloc période en cours */}
                    <div style={S.currentWeekCard}>
                      <div style={S.cwHeader}>
                        <span style={S.cwBadge}>⏳ Période en cours</span>
                        <span style={S.cwDates}>
                          {salaryData.everPaid
                            ? `Depuis le ${new Date(lp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                            : 'Depuis le début'}
                        </span>
                      </div>
                      <div style={S.cwStats}>
                        <div style={S.cwStat}>
                          <div style={S.cwStatLabel}>CA brut réalisé</div>
                          <div style={S.cwStatValue}>{fmt(cp.grossSales)}</div>
                          <div style={S.cwStatSub}>{cp.nbSales} {isGarage ? 'devis' : 'vente'}{cp.nbSales !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={S.cwDivider} />
                        <div style={S.cwStat}>
                          <div style={S.cwStatLabel}>Marge (base)</div>
                          <div style={{ ...S.cwStatValue, color: '#a78bfa', fontSize: 22 }}>{fmt(cp.margin)}</div>
                          <div style={S.cwStatSub}>{isGarage ? 'après coût pièces' : 'après coût matières'}</div>
                        </div>
                        <div style={S.cwDivider} />
                        <div style={{ ...S.cwStat, textAlign: 'right' }}>
                          <div style={S.cwStatLabel}>💵 À recevoir</div>
                          <div style={{ ...S.cwStatValue, color: '#4ade80', fontSize: 32 }}>{fmt(cp.salary)}</div>
                          <div style={S.cwStatSub}>{salaryData.salaryPercent}% de la marge</div>
                        </div>
                      </div>
                    </div>

                    {/* Historique des paiements passés */}
                    {salaryData.paymentHistory?.length > 0 && (
                      <>
                        <h3 style={{ ...S.subTitle, marginTop: 28 }}>Paiements reçus</h3>
                        <div style={S.weekList}>
                          {salaryData.paymentHistory.map((p, i) => (
                            <div key={i} style={S.weekRow}>
                              <div style={{ flex: 2 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: '#4ade80' }}>✅ Salaires payés</div>
                                <div style={{ fontSize: 12, color: '#5a4080', marginTop: 2 }}>
                                  {new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                              <div style={{ flex: 1, textAlign: 'right' }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#fbbf24' }}>Clôture semaine</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {/* ══ ONGLET MON COMPTE ══ */}
          {tab === 'compte' && (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <h2 style={S.title}>⚙️ Mon compte</h2>

              {/* Infos */}
              <div style={{ background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 14, padding: '20px 24px', marginBottom: 24, border: '1px solid rgba(224,64,251,0.18)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 11, color: '#8060a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Nom affiché</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f0e8ff', marginBottom: 18 }}>{session.user.name}</div>
                <div style={{ fontSize: 11, color: '#8060a0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 700 }}>Identifiant de connexion</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e040fb' }}>@{session.user.username}</div>
              </div>

              {/* Formulaire changement mdp */}
              <div style={{ background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 14, padding: '20px 24px', border: '1px solid rgba(224,64,251,0.18)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0e8ff', marginBottom: 16 }}>🔒 Changer mon mot de passe</h3>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={S.label}>Mot de passe actuel</label>
                    <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required placeholder="••••••••" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Nouveau mot de passe <span style={{ fontWeight: 400, color: '#5a4080', fontSize: 12 }}>(6 car. min.)</span></label>
                    <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required minLength={6} placeholder="••••••••" style={S.input} />
                  </div>
                  <div>
                    <label style={S.label}>Confirmer le nouveau mot de passe</label>
                    <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required placeholder="••••••••"
                      style={{ ...S.input, borderColor: cpConfirm && cpNew !== cpConfirm ? '#ef4444' : 'rgba(224,64,251,0.18)' }} />
                    {cpConfirm && cpNew !== cpConfirm && (
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Les mots de passe ne correspondent pas.</div>
                    )}
                  </div>
                  <button type="submit" disabled={cpLoading || (cpConfirm && cpNew !== cpConfirm)}
                    style={{ ...S.btnPrimary, opacity: cpLoading ? 0.6 : 1 }}>
                    {cpLoading ? 'Modification…' : '🔒 Modifier le mot de passe'}
                  </button>
                </form>
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}

// ─── Styles — Thème cosmique (Inside Roleplay)
// Fond #0d0818 · Surface #16102a · Accent #e040fb · Or #f0a820 · Texte #f0e8ff
const S = {
  page:        { minHeight: '100vh', background: '#080614', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },
  loadingPage: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080614' },
  spinner:     { width: 44, height: 44, border: '4px solid #2a1050', borderTop: '4px solid #e040fb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  toast:       { position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '13px 22px', borderRadius: 12, color: '#fff', fontWeight: 600, fontSize: 15, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', maxWidth: 380 },

  nav: {}, navLeft: {}, navLogo: {}, navCompany: {}, navRight: {}, navUser: {}, navBtn: {},
  tabBar: {}, tabBtn: {}, tabActive: {}, main: {},
  title:    { fontSize: 24, fontWeight: 700, color: '#f0e8ff', marginBottom: 8 },
  hint:     { fontSize: 15, color: '#5a4080', marginBottom: 20 },
  subTitle: { fontSize: 16, fontWeight: 600, color: '#d0b8f8', marginBottom: 12 },
  empty:    { color: '#5a4080', textAlign: 'center', padding: '40px 24px', background: 'rgba(255,255,255,0.015)', borderRadius: 12, border: '1px dashed rgba(224,64,251,0.12)', fontSize: 15 },
  weekTotal: { marginBottom: 12, fontSize: 16, color: '#d0b8f8', fontWeight: 500 },

  // Layout split catalogue / panier
  splitLayout: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', minWidth: 0 },
  catalog: { flex: 3, minWidth: 280 },
  cartPanel: { flex: '0 0 300px', minWidth: 260, background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 14, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', padding: 20, position: 'sticky', top: 90, border: '1px solid rgba(224,64,251,0.18)' },
  cartTitle: { fontSize: 17, fontWeight: 700, color: '#f0e8ff', marginBottom: 16 },
  cartEmpty: { color: '#5a4080', fontSize: 15, textAlign: 'center', lineHeight: 1.6, padding: '16px 0' },

  // Produits
  productGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))', gap: 16 },
  productCard: { position: 'relative', background: 'linear-gradient(145deg, #16102a, #1e1435)', border: '1px solid rgba(224,64,251,0.15)', borderRadius: 16, padding: '20px 14px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' },
  productCardInCart: { background: 'linear-gradient(145deg, #1e0a30, #280d40)', border: '2px solid #e040fb', boxShadow: '0 4px 20px rgba(224,64,251,0.25)' },
  productCardDisabled: { opacity: 0.45, cursor: 'not-allowed' },
  cartBadge:   { position: 'absolute', top: -10, right: -10, background: 'linear-gradient(135deg, #b020d0, #f060ff)', color: '#fff', borderRadius: '50%', width: 30, height: 30, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  productName: { fontWeight: 700, fontSize: 17, color: '#f0e8ff', marginBottom: 5 },
  productCat:  { fontSize: 10, color: '#5a4080', marginBottom: 6 },
  productPrice:{ fontSize: 20, fontWeight: 700, color: '#e040fb' },
  productStock:{ fontSize: 10, marginTop: 4, fontWeight: 600 },

  // Panier items
  cartItems: { display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 },
  cartItem:  { background: '#120c22', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(224,64,251,0.1)' },
  cartItemName: { fontWeight: 600, fontSize: 15, color: '#f0e8ff', marginBottom: 8 },
  cartItemRow:  { display: 'flex', alignItems: 'center', gap: 8 },
  cartItemTotal:{ fontSize: 15, fontWeight: 700, color: '#e040fb', flex: 1, textAlign: 'right' },

  qtyRow: { display: 'flex', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 28, height: 28, border: '1px solid rgba(224,64,251,0.22)', borderRadius: 6, background: 'rgba(224,64,251,0.08)', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#c090e0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { width: 28, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#f0e8ff' },
  removeBtn: { background: 'none', border: 'none', color: '#5a4080', cursor: 'pointer', fontSize: 15, padding: '0 4px' },

  cartFooter: { borderTop: '1px solid rgba(224,64,251,0.12)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  cartTotalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, color: '#d0b8f8' },
  cartTotalAmt: { fontSize: 22, fontWeight: 800, color: '#f0e8ff' },
  btnSubmit:  { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #b020d0, #f060ff)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 18px rgba(224,64,251,0.4)' },
  btnClear:   { width: '100%', padding: '8px', background: 'none', color: '#5a4080', border: '1px solid rgba(224,64,251,0.18)', borderRadius: 8, fontSize: 14, cursor: 'pointer' },

  // Factures
  invoiceList: { display: 'flex', flexDirection: 'column', gap: 8 },
  invoiceCard: { background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', border: '1px solid rgba(224,64,251,0.12)' },
  invoiceHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' },
  invoiceNum:  { fontWeight: 700, fontSize: 15, color: '#f0e8ff', marginRight: 10 },
  invoiceDate: { fontSize: 13, color: '#5a4080' },
  invoiceTotal:{ fontSize: 16, fontWeight: 800, color: '#e040fb' },
  invoiceToggle:{ fontSize: 13, color: '#5a4080' },
  invoiceItems:{ padding: '0 18px 14px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(224,64,251,0.08)' },
  invoiceItem: { display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#d0b8f8', paddingTop: 6 },

  // Salaire
  infoBox: { background: 'rgba(224,64,251,0.07)', border: '1px solid rgba(224,64,251,0.18)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 15, color: '#c090e0' },
  currentWeekCard: { background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden', marginBottom: 8, border: '1px solid rgba(224,64,251,0.18)' },
  cwHeader: { background: 'linear-gradient(135deg, #160830 0%, #200c40 100%)', borderBottom: '1px solid rgba(224,64,251,0.18)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cwBadge:  { color: '#f060ff', fontWeight: 700, fontSize: 15 },
  cwDates:  { color: '#8060a0', fontSize: 13 },
  cwStats:  { padding: '24px', display: 'flex', alignItems: 'center', gap: 24 },
  cwStat:   { flex: 1 },
  cwStatLabel: { fontSize: 14, color: '#8060a0', marginBottom: 4 },
  cwStatValue: { fontSize: 26, fontWeight: 800, color: '#f0e8ff' },
  cwStatSub:   { fontSize: 13, color: '#5a4080', marginTop: 2 },
  cwDivider:   { width: 1, height: 60, background: 'rgba(224,64,251,0.12)' },
  weekList: { display: 'flex', flexDirection: 'column', gap: 10 },
  weekRow:  { background: 'linear-gradient(145deg, #16102a, #1e1435)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', border: '1px solid rgba(224,64,251,0.1)' },

  // Compte
  label:      { fontSize: 12, fontWeight: 700, color: '#8060a0', marginBottom: 5, display: 'block', textTransform: 'uppercase', letterSpacing: 0.6 },
  input:      { width: '100%', padding: '11px 14px', border: '1.5px solid rgba(224,64,251,0.18)', borderRadius: 9, fontSize: 15, color: '#f0e8ff', background: '#0a061a', boxSizing: 'border-box', outline: 'none' },
  btnPrimary: { padding: '10px 20px', background: 'linear-gradient(135deg, #b020d0, #f060ff)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 15, fontWeight: 700, width: '100%', boxShadow: '0 4px 18px rgba(224,64,251,0.4)' },
};
