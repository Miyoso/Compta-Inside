import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
        <p style={{ color: '#64748b' }}>Chargement…</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <Head>
        <title>Tableau de bord — Compta-Inside</title>
      </Head>
      <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        {/* Barre de navigation */}
        <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <span style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>📊 Compta-Inside</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#64748b', fontSize: 14 }}>
              👤 {session.user.name} · <span style={{ color: '#2563eb' }}>{session.user.companyName}</span>
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              style={{ padding: '7px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}
            >
              Déconnexion
            </button>
          </div>
        </nav>

        {/* Contenu principal */}
        <main style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              Tableau de bord en construction
            </h1>
            <p style={{ color: '#64748b', fontSize: 15 }}>
              Bienvenue <strong>{session.user.name}</strong> ! La section comptabilité de <strong>{session.user.companyName}</strong> arrive bientôt.
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
