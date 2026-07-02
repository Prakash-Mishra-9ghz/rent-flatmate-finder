import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../../lib/useUser";

export default function NewListing() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    location: "", rent: "", availableFrom: "",
    roomType: "PRIVATE_ROOM", furnishingStatus: "FURNISHED",
    description: "", photos: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "OWNER") router.push("/");
  }, [user, loading]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const photos = form.photos ? form.photos.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, photos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create listing");
      router.push("/owner/listings");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <h2>Post a New Listing</h2>
      {error && <div className="error-banner">{error}</div>}
      <form className="card" onSubmit={submit}>
        <div className="form-group">
          <label>Location / Area</label>
          <input required placeholder="e.g. Koramangala, Bangalore"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Monthly Rent (₹)</label>
            <input required type="number" min="0" value={form.rent}
              onChange={(e) => setForm({ ...form, rent: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Available From</label>
            <input required type="date" value={form.availableFrom}
              onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Room Type</label>
            <select value={form.roomType} onChange={(e) => setForm({ ...form, roomType: e.target.value })}>
              <option value="PRIVATE_ROOM">Private Room</option>
              <option value="SHARED_ROOM">Shared Room</option>
              <option value="ENTIRE_FLAT">Entire Flat</option>
            </select>
          </div>
          <div className="form-group">
            <label>Furnishing Status</label>
            <select value={form.furnishingStatus} onChange={(e) => setForm({ ...form, furnishingStatus: e.target.value })}>
              <option value="FURNISHED">Furnished</option>
              <option value="SEMI_FURNISHED">Semi-Furnished</option>
              <option value="UNFURNISHED">Unfurnished</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Description (optional)</label>
          <textarea rows={3} placeholder="Describe the room, amenities, house rules..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Photo URLs (optional, comma-separated)</label>
          <input placeholder="https://example.com/photo1.jpg, https://..."
            value={form.photos}
            onChange={(e) => setForm({ ...form, photos: e.target.value })} />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? "Posting..." : "Post Listing"}
        </button>
      </form>
    </div>
  );
}
