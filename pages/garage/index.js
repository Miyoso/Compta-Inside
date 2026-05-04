import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState, useEffect, useMemo } from 'react';

// ─── Données tarifaires (issues de la grille Excel) ──────────────────────────
const CATEGORIES = ['Compacts','Sedans','Coupés','Motos','Muscle','SUV','Sport','Sports classic','Super'];

const PERF_PRICES = {
  'Moteur 1':       [2000,2500,6000,9500,12500,20000,50000,60000,110000],
  'Moteur 2':       [3000,5000,8000,13000,15000,30000,60000,75000,120000],
  'Moteur 3':       [5000,8000,20000,20000,25000,50000,80000,85000,130000],
  'Moteur 4':       [10000,15000,35000,45000,40000,65000,95000,98000,140000],
  'Moteur 5':       [20000,35000,60000,75000,80000,90000,125000,110000,150000],
  'Turbo':          [50000,60000,75000,95000,120000,140000,160000,160000,200000],
  'Transmission 1': [8000,10000,10000,25000,25000,35000,40000,40000,50000],
  'Transmission 2': [12000,15000,15000,35000,35000,45000,55000,55000,60000],
  'Transmission 3': [15000,25000,25000,42500,42500,56000,62500,62500,75000],
  'Transmission 4': [20000,40000,40000,55000,55000,70000,75000,75000,90000],
  'Freins 1':       [6500,8000,8000,11000,11000,15000,20000,20000,30000],
  'Freins 2':       [9000,11000,11000,16500,16500,20000,30000,30000,40000],
  'Freins 3':       [11500,16500,16500,20000,20000,25000,40000,40000,60000],
  'Freins 4':       [18000,20000,20000,30000,30000,40000,60000,60000,85000],
  'Suspensions 1':  [5000,6000,8000,6000,20000,20000,25000,25000,30000],
  'Suspensions 2':  [7500,8000,11000,8000,25000,30000,40000,40000,50000],
  'Suspensions 3':  [10000,10000,13500,10000,30000,40000,60000,60000,70000],
};

const PERF_GROUPS = {
  '🔧 Moteur':       ['Moteur 1','Moteur 2','Moteur 3','Moteur 4','Moteur 5','Turbo'],
  '⚙️ Transmission': ['Transmission 1','Transmission 2','Transmission 3','Transmission 4'],
  '🛑 Freins':       ['Freins 1','Freins 2','Freins 3','Freins 4'],
  '🔩 Suspensions':  ['Suspensions 1','Suspensions 2','Suspensions 3'],
};

const CUSTOM_PRICES = {
  'Aileron':1500,'Bas de caisse':1200,'Pare-choc AV':1500,'Pare-choc AR':1500,
  'Échappement':800,'Arceaux de sécurité':800,'Grille':800,'Capot':1000,
  'Aile gauche':700,'Aile droite':700,'Toit':850,'Contour de plaque':400,
  'Calandre':400,'Néon intérieur':400,'Coffre':400,'Hydraulique':400,
  'Bloc moteur':400,'Filtre à air':400,'Accessoires':400,'Caches-roues':400,
  'Antennes':400,'Ailes':750,'Réservoir':400,'Fenêtre':400,'Rétroviseur':400,
  'Light bar':400,'Klaxon':150,'Phares':650,'Roues':900,'Vitres':900,
  'Intérieur':450,'Plaques':450,'Extra':1000,
};

const PAINT_GROUPS = {
  '🎨 Peinture principale': {
    'Principale - Normale':500,'Principale - Métallique':750,'Principale - Pearl':750,
    'Principale - Matte':850,'Principale - Metal':850,'Principale - Chrome':1200,
  },
  '🖌️ Peinture secondaire': {
    'Secondaire - Normale':500,'Secondaire - Métallique':750,'Secondaire - Pearl':750,
    'Secondaire - Matte':850,'Secondaire - Metal':850,'Secondaire - Chrome':1200,
  },
  '✨ Finitions': {
    'Nacrage':700,'Motifs':1000,'Stickers':1000,
    'Couleurs intérieur':500,'Couleurs tableau de bord':500,
  },
};

const fmt = (n) => {
  if (n === null || n === undefined) return '$0';
  return '$' + Number(n).toLocaleString('fr-CA', { maximumFractionDigits: 0 });
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';

export default function GarageDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab]         = useState('devis');
  const [toast, setToast]     = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Devis builder state ──────────────────────────────────────────
  const [client, setClient]   = useState({ firstName:'', lastName:'', model:'', category:'Sport' });
  const [selPerfs, setSelPerfs]     = useState(new Set());
  const [selCustoms, setSelCustoms] = useState(new Set());
  const [selPaints, setSelPaints]   = useState(new Set());
  const [devisNotes, setDevisNotes] = useState('');
  const [activeSection, setActiveSection] = useState('perfs');

  // ── Registre state ───────────────────────────────────────────────
  const [quotes, setQuotes]   = useState([]);
  const [expandedQuote, setExpandedQuote] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  useEffect(() => {
    if (tab === 'registre') loadQuotes();
  }, [tab]);

  const loadQuotes = async () => {
    const r = await fetch('/api/garage/devis');
    if (r.ok) { const d = await r.json(); setQuotes(d.quotes || []); }
  };

  // ── Totaux calculés ──────────────────────────────────────────────
  const catIdx = CATEGORIES.indexOf(client.category);

  const perfsTotal = useMemo(() => {
    let t = 0;
    selPerfs.forEach(p => { t += (PERF_PRICES[p]?.[catIdx] || 0); });
    return t;
  }, [selPerfs, catIdx]);

  const customsTotal = useMemo(() => {
    let t = 0;
    selCustoms.forEach(c => { t += (CUSTOM_PRICES[c] || 0); });
    return t;
  }, [selCustoms]);

  const paintsTotal = useMemo(() => {
    let t = 0;
    selPaints.forEach(p => {
      for (const grp of Object.values(PAINT_GROUPS)) { if (grp[p]) { t += grp[p]; break; } }
    });
    return t;
  }, [selPaints]);

  const grandTotal = perfsTotal + customsTotal + paintsTotal;

  const togglePerf = (p) => {
    setSelPerfs(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  };
  const toggleCustom = (c) => {
    setSelCustoms(prev => { const s = new Set(prev); s.has(c) ? s.delete(c) : s.add(c); return s; });
  };
  const togglePaint = (p) => {
    setSelPaints(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s; });
  };

  const resetDevis = () => {
    setClient({ firstName:'', lastName:'', model:'', category:'Sport' });
    setSelPerfs(new Set()); setSelCustoms(new Set()); setSelPaints(new Set());
    setDevisNotes(''); setActiveSection('perfs');
  };

  const submitDevis = async () => {
    if (!client.firstName && !client.lastName) return showToast('Indiquez au moins un nom client', false);
    setLoading(true);
    const r = await fetch('/api/garage/devis', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        clientFirstName: client.firstName,
        clientLastName:  client.lastName,
        vehicleModel:    client.model,
        vehicleCategory: client.category,
        selectedPerformances: [...selPerfs].map(p => ({ type:p, price: PERF_PRICES[p]?.[catIdx]||0 })),
        selectedCustoms:      [...selCustoms].map(c => ({ type:c, price: CUSTOM_PRICES[c]||0 })),
        selectedPaints:       [...selPaints].map(p => {
          let price = 0;
          for (const grp of Object.values(PAINT_GROUPS)) { if (grp[p]) { price = grp[p]; break; } }
          return { type:p, price };
        }),
        perfsTotal, customsTotal, paintsTotal, grandTotal,
        notes: devisNotes,
      }),
    });
    setLoading(false);
    if (r.ok) { showToast('Devis enregistré !'); resetDevis(); }
    else showToast('Erreur lors de l\'enregistrement', false);
  };

  if (status === 'loading') return <div style={{ background:'#0a061a', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#8060a0', fontFamily:'system-ui' }}>Chargement…</div>;
  if (!session) return null;

  const TABS = [
    { key:'devis',    label:'🔧 Nouveau Devis' },
    { key:'registre', label:'📋 Registre' },
    { key:'compte',   label:'👤 Mon Compte' },
  ];

  return (
    <div style={{ background:'#0a061a', minHeight:'100vh', fontFamily:"'Inter','Segoe UI',system-ui,sans-serif", color:'#f0e8ff' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, padding:'13px 22px', borderRadius:12, color:'#fff', fontWeight:600, fontSize:15, boxShadow:'0 8px 32px rgba(0,0,0,0.6)', background: toast.ok ? 'linear-gradient(135deg,#15803d,#16a34a)' : 'linear-gradient(135deg,#b91c1c,#dc2626)' }}>
          {toast.msg}
        </div>
      )}

      {/* Navbar */}
      <nav style={{ background:'rgba(10,6,26,0.95)', borderBottom:'1px solid rgba(224,64,251,0.12)', padding:'0 48px', display:'flex', alignItems:'center', justifyContent:'space-between', height:58, position:'sticky', top:0, zIndex:100, backdropFilter:'blur(12px)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:22, fontWeight:800, color:'#f0e8ff', letterSpacing:0.3 }}>🔧 Piers 76</span>
          <span style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:700 }}>GARAGE</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ color:'#8060a0', fontSize:14 }}>{session.user.name}</span>
          <button onClick={() => signOut({ callbackUrl:'/' })} style={{ padding:'6px 16px', background:'rgba(224,64,251,0.08)', border:'1px solid rgba(224,64,251,0.2)', borderRadius:8, color:'#c090e0', cursor:'pointer', fontSize:13 }}>Déconnexion</button>
        </div>
      </nav>

      {/* Tab bar */}
      <div style={{ background:'#0f0820', borderBottom:'1px solid rgba(224,64,251,0.12)', display:'flex', padding:'0 48px', overflowX:'auto' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'14px 22px', background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:500, color: tab === t.key ? '#f0e8ff' : '#5a4080', borderBottom: tab === t.key ? '2.5px solid #e040fb' : '2.5px solid transparent', whiteSpace:'nowrap', transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ maxWidth:1600, margin:'0 auto', padding:'24px 48px' }}>

        {/* ══ ONGLET : NOUVEAU DEVIS ══ */}
        {tab === 'devis' && (
          <div>
            <h2 style={{ fontSize:24, fontWeight:700, color:'#f0e8ff', marginBottom:22 }}>Nouveau Devis</h2>

            <div style={{ display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap' }}>

              {/* ── Colonne gauche : formulaire ── */}
              <div style={{ flex:3, minWidth:340 }}>

                {/* Infos client + véhicule */}
                <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:16, padding:'22px 26px', marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#fbbf24', textTransform:'uppercase', letterSpacing:1, marginBottom:16 }}>👤 Client & Véhicule</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14 }}>
                    <div>
                      <label style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:5, display:'block' }}>Prénom</label>
                      <input value={client.firstName} onChange={e => setClient(c => ({...c, firstName:e.target.value}))}
                        style={{ width:'100%', background:'#0a061a', border:'1.5px solid rgba(224,64,251,0.25)', borderRadius:9, padding:'10px 14px', fontSize:14, color:'#f0e8ff', boxSizing:'border-box' }} placeholder="Michel" />
                    </div>
                    <div>
                      <label style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:5, display:'block' }}>Nom</label>
                      <input value={client.lastName} onChange={e => setClient(c => ({...c, lastName:e.target.value}))}
                        style={{ width:'100%', background:'#0a061a', border:'1.5px solid rgba(224,64,251,0.25)', borderRadius:9, padding:'10px 14px', fontSize:14, color:'#f0e8ff', boxSizing:'border-box' }} placeholder="Dupont" />
                    </div>
                    <div>
                      <label style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:5, display:'block' }}>Modèle du véhicule</label>
                      <input value={client.model} onChange={e => setClient(c => ({...c, model:e.target.value}))}
                        style={{ width:'100%', background:'#0a061a', border:'1.5px solid rgba(224,64,251,0.25)', borderRadius:9, padding:'10px 14px', fontSize:14, color:'#f0e8ff', boxSizing:'border-box' }} placeholder="Sultan RS" />
                    </div>
                    <div>
                      <label style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:5, display:'block' }}>Catégorie</label>
                      <select value={client.category} onChange={e => setClient(c => ({...c, category:e.target.value}))}
                        style={{ width:'100%', background:'#0a061a', border:'1.5px solid rgba(224,64,251,0.25)', borderRadius:9, padding:'10px 14px', fontSize:14, color:'#f0e8ff', boxSizing:'border-box' }}>
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section tabs */}
                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  {[['perfs','🔧 Performances', selPerfs.size],['customs','🎨 Customs', selCustoms.size],['paints','💅 Peintures', selPaints.size]].map(([key, label, count]) => (
                    <button key={key} onClick={() => setActiveSection(key)}
                      style={{ padding:'10px 18px', borderRadius:10, border: activeSection === key ? '2px solid #e040fb' : '1px solid rgba(224,64,251,0.2)', background: activeSection === key ? 'rgba(224,64,251,0.12)' : 'rgba(255,255,255,0.03)', color: activeSection === key ? '#f0e8ff' : '#5a4080', fontWeight:600, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                      {label}
                      {count > 0 && <span style={{ background:'#e040fb', color:'#fff', borderRadius:'50%', width:20, height:20, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{count}</span>}
                    </button>
                  ))}
                </div>

                {/* ── PERFORMANCES ── */}
                {activeSection === 'perfs' && (
                  <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', border:'1px solid rgba(224,64,251,0.18)', borderRadius:16, padding:'22px 26px' }}>
                    <div style={{ fontSize:12, color:'#8060a0', marginBottom:16 }}>
                      Prix basés sur la catégorie : <strong style={{ color:'#fbbf24' }}>{client.category}</strong>
                    </div>
                    {Object.entries(PERF_GROUPS).map(([groupName, items]) => (
                      <div key={groupName} style={{ marginBottom:20 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#c084fc', marginBottom:10 }}>{groupName}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
                          {items.map(item => {
                            const price = PERF_PRICES[item]?.[catIdx] || 0;
                            const sel = selPerfs.has(item);
                            return (
                              <button key={item} onClick={() => togglePerf(item)}
                                style={{ background: sel ? 'linear-gradient(145deg,#1e0a30,#280d40)' : '#120c22', border: sel ? '2px solid #e040fb' : '1px solid rgba(224,64,251,0.15)', borderRadius:10, padding:'12px 16px', cursor:'pointer', textAlign:'left', transition:'all 0.15s', boxShadow: sel ? '0 4px 16px rgba(224,64,251,0.2)' : 'none' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                  <span style={{ fontWeight:600, fontSize:14, color: sel ? '#f0e8ff' : '#c0a0d8' }}>{item}</span>
                                  {sel && <span style={{ color:'#e040fb', fontSize:16 }}>✓</span>}
                                </div>
                                <div style={{ fontSize:15, fontWeight:700, color: sel ? '#e040fb' : '#8060a0', marginTop:4 }}>{fmt(price)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── CUSTOMS ── */}
                {activeSection === 'customs' && (
                  <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', border:'1px solid rgba(224,64,251,0.18)', borderRadius:16, padding:'22px 26px' }}>
                    <div style={{ fontSize:12, color:'#8060a0', marginBottom:16 }}>Prix fixe quelle que soit la catégorie du véhicule</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:10 }}>
                      {Object.entries(CUSTOM_PRICES).map(([item, price]) => {
                        const sel = selCustoms.has(item);
                        return (
                          <button key={item} onClick={() => toggleCustom(item)}
                            style={{ background: sel ? 'linear-gradient(145deg,#1e0a30,#280d40)' : '#120c22', border: sel ? '2px solid #e040fb' : '1px solid rgba(224,64,251,0.15)', borderRadius:10, padding:'12px 14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <span style={{ fontWeight:600, fontSize:13, color: sel ? '#f0e8ff' : '#c0a0d8' }}>{item}</span>
                              {sel && <span style={{ color:'#e040fb' }}>✓</span>}
                            </div>
                            <div style={{ fontSize:14, fontWeight:700, color: sel ? '#e040fb' : '#8060a0', marginTop:3 }}>{fmt(price)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── PEINTURES ── */}
                {activeSection === 'paints' && (
                  <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', border:'1px solid rgba(224,64,251,0.18)', borderRadius:16, padding:'22px 26px' }}>
                    {Object.entries(PAINT_GROUPS).map(([groupName, items]) => (
                      <div key={groupName} style={{ marginBottom:22 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#c084fc', marginBottom:10 }}>{groupName}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
                          {Object.entries(items).map(([item, price]) => {
                            const sel = selPaints.has(item);
                            return (
                              <button key={item} onClick={() => togglePaint(item)}
                                style={{ background: sel ? 'linear-gradient(145deg,#1e0a30,#280d40)' : '#120c22', border: sel ? '2px solid #e040fb' : '1px solid rgba(224,64,251,0.15)', borderRadius:10, padding:'12px 14px', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                  <span style={{ fontWeight:600, fontSize:13, color: sel ? '#f0e8ff' : '#c0a0d8' }}>{item}</span>
                                  {sel && <span style={{ color:'#e040fb' }}>✓</span>}
                                </div>
                                <div style={{ fontSize:14, fontWeight:700, color: sel ? '#e040fb' : '#8060a0', marginTop:3 }}>{fmt(price)}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div style={{ marginTop:16 }}>
                  <label style={{ fontSize:12, color:'#8060a0', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:5, display:'block' }}>Notes (optionnel)</label>
                  <textarea value={devisNotes} onChange={e => setDevisNotes(e.target.value)} rows={3}
                    style={{ width:'100%', background:'#0a061a', border:'1.5px solid rgba(224,64,251,0.25)', borderRadius:9, padding:'10px 14px', fontSize:14, color:'#f0e8ff', resize:'vertical', boxSizing:'border-box' }} placeholder="Remarques, demandes spéciales…" />
                </div>
              </div>

              {/* ── Colonne droite : résumé devis (sticky) ── */}
              <div style={{ flex:'0 0 320px', minWidth:280, position:'sticky', top:80 }}>
                <div style={{ background:'linear-gradient(145deg,#100820,#180c30)', border:'2px solid rgba(251,191,36,0.3)', borderRadius:18, padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fbbf24', textTransform:'uppercase', letterSpacing:1, marginBottom:20 }}>📄 Récapitulatif</div>

                  {/* Client */}
                  {(client.firstName || client.lastName) && (
                    <div style={{ marginBottom:16, padding:'12px 14px', background:'rgba(255,255,255,0.04)', borderRadius:10 }}>
                      <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', letterSpacing:0.6, marginBottom:4 }}>Client</div>
                      <div style={{ fontWeight:700, fontSize:15, color:'#f0e8ff' }}>{client.firstName} {client.lastName}</div>
                      {client.model && <div style={{ fontSize:13, color:'#8060a0', marginTop:2 }}>{client.model} · {client.category}</div>}
                    </div>
                  )}

                  {/* Lignes */}
                  <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#c0a0d8' }}>
                      <span>🔧 Performances <span style={{ color:'#6a4890' }}>({selPerfs.size})</span></span>
                      <strong style={{ color: perfsTotal > 0 ? '#f0e8ff' : '#3a2060' }}>{fmt(perfsTotal)}</strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#c0a0d8' }}>
                      <span>🎨 Customs <span style={{ color:'#6a4890' }}>({selCustoms.size})</span></span>
                      <strong style={{ color: customsTotal > 0 ? '#f0e8ff' : '#3a2060' }}>{fmt(customsTotal)}</strong>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, color:'#c0a0d8' }}>
                      <span>💅 Peintures <span style={{ color:'#6a4890' }}>({selPaints.size})</span></span>
                      <strong style={{ color: paintsTotal > 0 ? '#f0e8ff' : '#3a2060' }}>{fmt(paintsTotal)}</strong>
                    </div>
                  </div>

                  <div style={{ borderTop:'2px solid rgba(251,191,36,0.2)', paddingTop:16, marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:15, color:'#d0b8f8', fontWeight:600 }}>TOTAL DEVIS</span>
                      <span style={{ fontSize:30, fontWeight:900, color:'#fbbf24', letterSpacing:-1 }}>{fmt(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Détail des sélections */}
                  {selPerfs.size > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Performances sélectionnées</div>
                      {[...selPerfs].map(p => (
                        <div key={p} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#a080c8', padding:'3px 0' }}>
                          <span>{p}</span><span>{fmt(PERF_PRICES[p]?.[catIdx]||0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selCustoms.size > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Customs sélectionnées</div>
                      {[...selCustoms].map(c => (
                        <div key={c} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#a080c8', padding:'3px 0' }}>
                          <span>{c}</span><span>{fmt(CUSTOM_PRICES[c]||0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selPaints.size > 0 && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:6 }}>Peintures sélectionnées</div>
                      {[...selPaints].map(p => {
                        let price = 0;
                        for (const grp of Object.values(PAINT_GROUPS)) { if (grp[p]) { price = grp[p]; break; } }
                        return (
                          <div key={p} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#a080c8', padding:'3px 0' }}>
                            <span>{p}</span><span>{fmt(price)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button onClick={submitDevis} disabled={loading || grandTotal === 0}
                    style={{ width:'100%', padding:'14px', background: grandTotal === 0 ? '#1a0c2e' : 'linear-gradient(135deg,#d97706,#fbbf24)', color: grandTotal === 0 ? '#3a2060' : '#1a0c00', border:'none', borderRadius:12, cursor: grandTotal === 0 ? 'not-allowed' : 'pointer', fontSize:15, fontWeight:900, boxShadow: grandTotal > 0 ? '0 4px 20px rgba(251,191,36,0.35)' : 'none', marginBottom:10 }}>
                    {loading ? 'Enregistrement…' : '✅ Valider le devis'}
                  </button>
                  <button onClick={resetDevis} style={{ width:'100%', padding:'10px', background:'none', color:'#5a4080', border:'1px solid rgba(224,64,251,0.18)', borderRadius:10, cursor:'pointer', fontSize:13 }}>
                    🗑️ Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ ONGLET : REGISTRE ══ */}
        {tab === 'registre' && (
          <div>
            <h2 style={{ fontSize:24, fontWeight:700, color:'#f0e8ff', marginBottom:22 }}>Registre des clients</h2>
            {quotes.length === 0 ? (
              <div style={{ color:'#5a4080', textAlign:'center', padding:48, background:'#120c22', borderRadius:16, border:'1px dashed rgba(224,64,251,0.18)' }}>
                Aucun devis enregistré pour le moment.
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {quotes.map((q, i) => (
                  <div key={q.id} style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', border:'1px solid rgba(224,64,251,0.18)', borderRadius:14, overflow:'hidden' }}>
                    <button onClick={() => setExpandedQuote(expandedQuote === q.id ? null : q.id)}
                      style={{ width:'100%', background:'none', border:'none', padding:'16px 22px', cursor:'pointer', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                      <span style={{ background:'rgba(251,191,36,0.12)', color:'#fbbf24', borderRadius:8, padding:'4px 10px', fontSize:13, fontWeight:700 }}>#{i+1}</span>
                      <span style={{ fontWeight:700, fontSize:15, color:'#f0e8ff', flex:1, textAlign:'left' }}>{q.client_first_name} {q.client_last_name}</span>
                      <span style={{ fontSize:13, color:'#8060a0' }}>{q.vehicle_model} · <strong style={{ color:'#c084fc' }}>{q.vehicle_category}</strong></span>
                      <span style={{ fontSize:20, fontWeight:800, color:'#fbbf24' }}>{fmt(q.grand_total)}</span>
                      <span style={{ fontSize:12, color:'#5a4080' }}>{fmtDate(q.created_at)}</span>
                      <span style={{ color:'#5a4080', fontSize:14 }}>{expandedQuote === q.id ? '▲' : '▼'}</span>
                    </button>

                    {expandedQuote === q.id && (
                      <div style={{ padding:'0 22px 20px', borderTop:'1px solid rgba(224,64,251,0.1)' }}>
                        <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginTop:16 }}>
                          {q.selected_performances?.length > 0 && (
                            <div style={{ flex:1, minWidth:200 }}>
                              <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>🔧 Performances — {fmt(q.perfs_total)}</div>
                              {q.selected_performances.map(p => (
                                <div key={p.type} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#a080c8', padding:'3px 0' }}>
                                  <span>{p.type}</span><span>{fmt(p.price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {q.selected_customs?.length > 0 && (
                            <div style={{ flex:1, minWidth:200 }}>
                              <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>🎨 Customs — {fmt(q.customs_total)}</div>
                              {q.selected_customs.map(c => (
                                <div key={c.type} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#a080c8', padding:'3px 0' }}>
                                  <span>{c.type}</span><span>{fmt(c.price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {q.selected_paints?.length > 0 && (
                            <div style={{ flex:1, minWidth:200 }}>
                              <div style={{ fontSize:11, color:'#6a4890', fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>💅 Peintures — {fmt(q.paints_total)}</div>
                              {q.selected_paints.map(p => (
                                <div key={p.type} style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#a080c8', padding:'3px 0' }}>
                                  <span>{p.type}</span><span>{fmt(p.price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {q.notes && (
                          <div style={{ marginTop:14, padding:'10px 14px', background:'rgba(255,255,255,0.04)', borderRadius:8, fontSize:13, color:'#8060a0' }}>
                            📝 {q.notes}
                          </div>
                        )}
                        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid rgba(224,64,251,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:12, color:'#5a4080' }}>Par : {q.employee_name || 'Inconnu'}</span>
                          <span style={{ fontSize:18, fontWeight:800, color:'#fbbf24' }}>Total : {fmt(q.grand_total)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ ONGLET : MON COMPTE ══ */}
        {tab === 'compte' && (
          <div style={{ maxWidth:480 }}>
            <h2 style={{ fontSize:24, fontWeight:700, color:'#f0e8ff', marginBottom:22 }}>Mon Compte</h2>
            <div style={{ background:'linear-gradient(145deg,#16102a,#1e1435)', borderRadius:14, padding:'20px 24px', border:'1px solid rgba(224,64,251,0.18)' }}>
              <div style={{ fontSize:11, color:'#8060a0', marginBottom:4, textTransform:'uppercase', letterSpacing:0.6, fontWeight:700 }}>Nom affiché</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#f0e8ff', marginBottom:18 }}>{session.user.name}</div>
              <div style={{ fontSize:11, color:'#8060a0', marginBottom:4, textTransform:'uppercase', letterSpacing:0.6, fontWeight:700 }}>Identifiant</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#e040fb', marginBottom:18 }}>@{session.user.username}</div>
              <div style={{ fontSize:11, color:'#8060a0', marginBottom:4, textTransform:'uppercase', letterSpacing:0.6, fontWeight:700 }}>Entreprise</div>
              <div style={{ fontSize:15, fontWeight:600, color:'#d0b8f8' }}>{session.user.companyName}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
