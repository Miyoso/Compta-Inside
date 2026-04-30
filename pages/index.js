import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mode, setMode] = useState('login'); // 'login' ou 'register'
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Formulaire connexion
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulaire inscription
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompany, setRegCompany] = useState('');

  // Redirection selon le rôle
  useEffect(() => {
    if (status === 'authenticated') {
      if (['patron', 'admin'].includes(session?.user?.role)) {
        router.push('/patron');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, session, router]);

  // Chargement des entreprises depuis la BDD
  useEffect(() => {
    fetch('/api/companies')
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        if (data.length > 0) setRegCompany(String(data[0].id));
      });
  }, []);

  // Gestion de la connexion
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', {
      redirect: false,
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (result?.error) {
      if (result.error === 'AccountPending') {
        setError('⏳ Ton compte est en attente de validation par ton patron. Tu recevras l\'accès dès qu\'il l\'aura approuvé.');
      } else if (result.error === 'AccountRejected') {
        setError('❌ Ton compte a été refusé. Contacte ton patron pour plus d\'informations.');
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    } else {
      router.push('/dashboard');
    }
  }

  // Gestion de l'inscription
  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: regName,
        email: regEmail,
        password: regPassword,
        companyId: regCompany,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Une erreur est survenue.');
    } else {
      setSuccess('✅ Compte créé ! Ton patron doit valider ton accès avant que tu puisses te connecter. Reviens ici une fois qu\'il t\'a confirmé.');
      setMode('login');
      setLoginEmail(regEmail);
      setRegName('');
      setRegEmail('');
      setRegPassword('');
    }
  }

  if (status === 'loading') {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <p style={{ color: '#555', marginTop: 16 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Compta-Inside — GTA RP</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Gestion comptable pour entreprises GTA RP" />
      </Head>

      <div style={styles.page}>
        {/* En-tête */}
        <header style={styles.header}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>📊</span>
            <span style={styles.logoText}>Compta-Inside</span>
          </div>
          <p style={styles.headerSub}>Gestion comptable · GTA RP</p>
        </header>

        {/* Carte principale */}
        <main style={styles.main}>
          <div style={styles.card}>
            {/* Onglets */}
            <div style={styles.tabs}>
              <button
                style={mode === 'login' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              >
                Connexion
              </button>
              <button
                style={mode === 'register' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              >
                Créer un compte
              </button>
            </div>

            {/* Messages */}
            {error && <div style={styles.alertError}>{error}</div>}
            {success && <div style={styles.alertSuccess}>{success}</div>}

            {/* ─── Formulaire Connexion ─── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} style={styles.form}>
                <h2 style={styles.formTitle}>Bienvenue 👋</h2>
                <p style={styles.formSub}>Connectez-vous pour accéder à votre espace.</p>

                <label style={styles.label}>Adresse email</label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  style={styles.input}
                />

                <label style={styles.label}>Mot de passe</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  style={styles.input}
                />

                <button type="submit" disabled={loading} style={loading ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}>
                  {loading ? 'Connexion en cours…' : 'Se connecter'}
                </button>

                <p style={styles.switchText}>
                  Pas encore de compte ?{' '}
                  <button type="button" style={styles.link} onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
                    Créer un compte
                  </button>
                </p>
              </form>
            )}

            {/* ─── Formulaire Inscription ─── */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} style={styles.form}>
                <h2 style={styles.formTitle}>Créer un compte</h2>
                <p style={styles.formSub}>Rejoignez votre entreprise sur Compta-Inside.</p>

                <label style={styles.label}>Votre prénom / pseudo</label>
                <input
                  type="text"
                  placeholder="Ex : Alyarya K Rosell"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  style={styles.input}
                />

                <label style={styles.label}>Adresse email</label>
                <input
                  type="email"
                  placeholder="votre@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  style={styles.input}
                />

                <label style={styles.label}>Mot de passe <span style={styles.hint}>(6 caractères minimum)</span></label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  minLength={6}
                  style={styles.input}
                />

                <label style={styles.label}>Votre entreprise</label>
                <select
                  value={regCompany}
                  onChange={(e) => setRegCompany(e.target.value)}
                  required
                  style={styles.select}
                >
                  {companies.length === 0 && <option value="">Chargement…</option>}
                  {companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button type="submit" disabled={loading} style={loading ? { ...styles.btn, ...styles.btnDisabled } : styles.btn}>
                  {loading ? 'Création en cours…' : 'Créer mon compte'}
                </button>

                <p style={styles.switchText}>
                  Déjà un compte ?{' '}
                  <button type="button" style={styles.link} onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                    Se connecter
                  </button>
                </p>
              </form>
            )}
          </div>

          {/* Entreprises visibles */}
          <div style={styles.companiesSection}>
            <p style={styles.companiesTitle}>Entreprises disponibles</p>
            <div style={styles.companiesGrid}>
              {companies.map((c) => (
                <div key={c.id} style={styles.companyBadge}>
                  🏢 {c.name}
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer style={styles.footer}>
          Compta-Inside · GTA RP · Tous droits réservés
        </footer>
      </div>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    padding: '0 16px',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f7fa',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  spinner: {
    width: 40,
    height: 40,
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    textAlign: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoIcon: {
    fontSize: 36,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: '-0.5px',
  },
  headerSub: {
    color: '#64748b',
    marginTop: 6,
    fontSize: 14,
  },
  main: {
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
  },
  card: {
    background: '#ffffff',
    borderRadius: 16,
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    width: '100%',
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
  },
  tab: {
    flex: 1,
    padding: '14px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: '500',
    color: '#64748b',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#2563eb',
    borderBottom: '2px solid #2563eb',
    background: '#f8faff',
  },
  alertError: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#dc2626',
    fontSize: 14,
  },
  alertSuccess: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 8,
    color: '#16a34a',
    fontSize: 14,
  },
  form: {
    padding: '24px 28px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    margin: '0 0 4px',
  },
  formSub: {
    color: '#64748b',
    fontSize: 14,
    margin: '0 0 20px',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  hint: {
    fontWeight: '400',
    color: '#94a3b8',
    fontSize: 12,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    color: '#1e293b',
    background: '#fafafa',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: 8,
    fontSize: 15,
    color: '#1e293b',
    background: '#fafafa',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  btn: {
    marginTop: 20,
    width: '100%',
    padding: '13px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnDisabled: {
    background: '#93c5fd',
    cursor: 'not-allowed',
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748b',
    marginTop: 16,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
    textDecoration: 'underline',
  },
  companiesSection: {
    width: '100%',
    textAlign: 'center',
  },
  companiesTitle: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  companiesGrid: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  companyBadge: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 13,
    color: '#374151',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  footer: {
    marginTop: 'auto',
    padding: '32px 0 20px',
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
  },
};
