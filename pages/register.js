import { useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/useUser";

export default function Register() {
  const router = useRouter();
  const { refresh } = useUser();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "TENANT" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      await refresh();
      router.push(form.role === "OWNER" ? "/owner/listings" : "/profile");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h2>Create your account</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="card" onSubmit={submit}>
        <div className="form-group">
          <label>I am a...</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="TENANT">Tenant — looking for a room</option>
            <option value="OWNER">Owner — listing a room</option>
          </select>
        </div>
        <div className="form-group">
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">{busy ? "Creating..." : "Register"}</button>
      </form>
    </div>
  );
}
