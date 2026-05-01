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
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulaire inscription
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompany, setRegCompany] = useState('');

  // Redirection selon le rôle
  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role === 'admin') {
        router.push('/admin');
      } else if (session?.user?.role === 'patron') {
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
      username: loginUsername,
      password: loginPassword,
    });
    setLoading(false);
    if (result?.error) {
      if (result.error === 'AccountPending') {
        setError('⏳ Ton compte est en attente de validation par ton patron.');
      } else if (result.error === 'AccountRejected') {
        setError('❌ Ton compte a été refusé. Contacte ton patron.');
      } else if (result.error === 'AccountInactive') {
        setError('🚫 Ce compte a été désactivé. Contacte ton patron.');
      } else {
        setError('Identifiant ou mot de passe incorrect.');
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
        username: regUsername,
        password: regPassword,
        companyId: regCompany,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Une erreur est survenue.');
    } else {
      setSuccess('✅ Compte créé ! Ton patron doit valider ton accès. Reviens te connecter une fois approuvé.');
      setMode('login');
      setLoginUsername(regUsername);
      setRegName('');
      setRegUsername('');
      setRegPassword('');
    }
  }

  if (status === 'loading') {
    return (
      <div style={styles.loadingPage}>
        <div style={styles.spinner} />
        <p style={{ color: '#6050a0', marginTop: 16 }}>Chargement…</p>
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

                <label style={styles.label}>Identifiant</label>
                <input
                  type="text"
                  placeholder="ton_identifiant"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  required
                  autoComplete="username"
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

                <label style={styles.label}>Identifiant de connexion <span style={styles.hint}>(lettres, chiffres, _)</span></label>
                <input
                  type="text"
                  placeholder="Ex: john_doe"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  required
                  minLength={3}
                  maxLength={30}
                  autoComplete="username"
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

// ─── Styles — Thème cosmique (Inside Roleplay)
// Fond #0d0818 · Surface #16102a · Accent #e040fb · Or #f0a820 · Texte #f0e8ff
const styles = {
  page: {
    minHeight: '100vh',
    background: '#0d0818',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Segoe UI', system-ui, Arial, sans-serif",
    padding: '0 16px',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0818',
    fontFamily: "'Segoe UI', system-ui, Arial, sans-serif",
  },
  spinner: {
    width: 44,
    height: 44,
    border: '4px solid #2a1050',
    borderTop: '4px solid #e040fb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    textAlign: 'center',
    paddingTop: 56,
    paddingBottom: 28,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logoIcon: {
    fontSize: 40,
    filter: 'drop-shadow(0 0 12px rgba(224,64,251,0.5))',
  },
  logoText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f0e8ff',
    letterSpacing: '-0.5px',
    textShadow: '0 0 30px rgba(224,64,251,0.3)',
  },
  headerSub: {
    color: '#6050a0',
    marginTop: 8,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  main: {
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  card: {
    background: 'linear-gradient(145deg, #16102a, #1e1435)',
    borderRadius: 20,
    boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 40px rgba(224,64,251,0.06), inset 0 1px 0 rgba(224,64,251,0.08)',
    border: '1px solid rgba(224,64,251,0.2)',
    width: '100%',
    overflow: 'hidden',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(224,64,251,0.12)',
  },
  tab: {
    flex: 1,
    padding: '15px 0',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: '500',
    color: '#5a4080',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#f060ff',
    borderBottom: '2px solid #e040fb',
    background: 'rgba(224,64,251,0.05)',
    textShadow: '0 0 16px rgba(224,64,251,0.5)',
  },
  alertError: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #180610, #200810)',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 10,
    color: '#fca5a5',
    fontSize: 14,
  },
  alertSuccess: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    background: 'rgba(74,222,128,0.07)',
    border: '1px solid rgba(74,222,128,0.22)',
    borderRadius: 10,
    color: '#4ade80',
    fontSize: 14,
  },
  form: {
    padding: '26px 28px 30px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0e8ff',
    margin: '0 0 4px',
  },
  formSub: {
    color: '#5a4080',
    fontSize: 14,
    margin: '0 0 20px',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8060a0',
    marginTop: 14,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: {
    fontWeight: '400',
    color: '#4a3070',
    fontSize: 11,
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid rgba(224,64,251,0.18)',
    borderRadius: 9,
    fontSize: 15,
    color: '#f0e8ff',
    background: '#0a061a',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid rgba(224,64,251,0.18)',
    borderRadius: 9,
    fontSize: 15,
    color: '#f0e8ff',
    background: '#0a061a',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  btn: {
    marginTop: 22,
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #b020d0, #f060ff)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    fontSize: 15,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(224,64,251,0.45)',
    transition: 'opacity 0.2s',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  switchText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#5a4080',
    marginTop: 18,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#e040fb',
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
    fontSize: 11,
    color: '#4a3070',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    fontWeight: 700,
  },
  companiesGrid: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  companyBadge: {
    background: 'linear-gradient(145deg, #16102a, #1e1435)',
    border: '1px solid rgba(224,64,251,0.18)',
    borderRadius: 20,
    padding: '7px 16px',
    fontSize: 13,
    color: '#d0b8f8',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
  },
  footer: {
    marginTop: 'auto',
    padding: '36px 0 20px',
    color: '#3a2860',
    fontSize: 12,
    textAlign: 'center',
  },
};
