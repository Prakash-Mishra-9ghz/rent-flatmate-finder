import { useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/useUser";
import Link from "next/link";

export default function Login() {
  const router = useRouter();
  const { refresh } = useUser();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      await refresh();
      const role = data.user.role;
      if (role === "TENANT") router.push("/listings");
      else if (role === "OWNER") router.push("/owner/listings");
      else router.push("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h2>Log in</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="card" onSubmit={submit}>
        <div className="form-group">
          <label>Email</label>
          <input required type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input required type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>
      <p style={{ fontSize: 14, color: "#6b7280" }}>
        No account? <Link href="/register">Register here</Link>
      </p>
    </div>
  );
}
