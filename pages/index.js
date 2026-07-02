import { useUser } from "../lib/useUser";
import Link from "next/link";

export default function Home() {
  const { user, loading } = useUser();

  return (
    <div className="container">
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <h1>Find your perfect room, or your perfect tenant.</h1>
        <p style={{ color: "#6b7280", maxWidth: 560, margin: "0 auto 20px" }}>
          List rooms or browse them with AI-powered compatibility scoring based on
          budget and location, then chat in real time once interest is mutual.
        </p>
        {!loading && !user && (
          <div>
            <Link href="/register" className="btn">Get started</Link>{" "}
            <Link href="/login" className="btn secondary">Log in</Link>
          </div>
        )}
        {!loading && user && user.role === "TENANT" && (
          <Link href="/listings" className="btn">Browse listings</Link>
        )}
        {!loading && user && user.role === "OWNER" && (
          <Link href="/owner/listings/new" className="btn">Post a listing</Link>
        )}
        {!loading && user && user.role === "ADMIN" && (
          <Link href="/admin" className="btn">Go to admin panel</Link>
        )}
      </div>
    </div>
  );
}
