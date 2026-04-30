import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import sql from '../../../lib/db';

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Email et mot de passe',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Recherche de l'utilisateur en base
        const rows = await sql`
          SELECT u.id, u.email, u.name, u.password_hash, u.role, u.company_id, c.name AS company_name
          FROM users u
          LEFT JOIN companies c ON c.id = u.company_id
          WHERE u.email = ${credentials.email}
          LIMIT 1
        `;

        const user = rows[0];
        if (!user) return null;

        // Vérification du mot de passe
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.company_id,
          companyName: user.company_name,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.companyId = user.companyId;
        token.companyName = user.companyName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role;
        session.user.companyId = token.companyId;
        session.user.companyName = token.companyName;
      }
      return session;
    },
  },

  pages: {
    signIn: '/',       // Page de connexion = page d'accueil
    error: '/',        // Erreurs renvoyées sur la page d'accueil
  },

  secret: process.env.NEXTAUTH_SECRET,
});
