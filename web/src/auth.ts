import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Comma-separated allowlist of emails permitted to sign in — set in Vercel
// env vars (ALLOWED_EMAILS). This dashboard has internal company numbers,
// so it must never be publicly reachable.
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      if (allowedEmails.length === 0) return false; // fail closed if misconfigured
      return allowedEmails.includes(user.email.toLowerCase());
    },
    async session({ session }) {
      return session;
    },
  },
});
