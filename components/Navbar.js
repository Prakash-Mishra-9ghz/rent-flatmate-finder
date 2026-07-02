import Link from "next/link";
import { useUser } from "../lib/useUser";

export default function Navbar() {
  const { user, loading, logout } = useUser();

  return (
    <div className="navbar">
      <Link href="/" className="brand">🏠 Rent & Flatmate Finder</Link>
      <nav>
        {!loading && !user && (
          <>
            <Link href="/login">Log in</Link>
            <Link href="/register">Register</Link>
          </>
        )}
        {!loading && user && user.role === "TENANT" && (
          <>
            <Link href="/listings">Browse Listings</Link>
            <Link href="/profile">My Profile</Link>
            <Link href="/interests">My Interests</Link>
          </>
        )}
        {!loading && user && user.role === "OWNER" && (
          <>
            <Link href="/owner/listings">My Listings</Link>
            <Link href="/owner/listings/new">+ New Listing</Link>
            <Link href="/interests">Interest Requests</Link>
          </>
        )}
        {!loading && user && user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
        {!loading && user && (
          <>
            <span className="role-badge">{user.role}</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Log out</a>
          </>
        )}
      </nav>
    </div>
  );
}
