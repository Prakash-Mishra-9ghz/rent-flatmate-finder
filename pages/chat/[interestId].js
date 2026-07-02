import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../lib/useUser";
import { io } from "socket.io-client";

let socketInstance = null;

function getSocket() {
  if (!socketInstance) {
    socketInstance = io({ path: "/api/socket", autoConnect: false });
  }
  return socketInstance;
}

export default function ChatPage() {
  const router = useRouter();
  const { interestId } = router.query;
  const { user, loading } = useUser();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [interest, setInterest] = useState(null);
  const bottomRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading]);

  useEffect(() => {
    if (!interestId || !user) return;

    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) socket.connect();

    socket.on("connect", () => {
      setStatus("joining");
      socket.emit("join_chat", { interestId }, (res) => {
        if (res?.error) {
          setError(res.error);
          setStatus("error");
        } else {
          setMessages(res.history || []);
          setInterest(res.interest);
          setStatus("ready");
        }
      });
    });

    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("error"));

    return () => {
      socket.off("connect");
      socket.off("new_message");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, [interestId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || status !== "ready") return;
    const socket = socketRef.current;
    socket.emit("send_message", { interestId, body: input.trim() }, (res) => {
      if (res?.error) setError(res.error);
    });
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;

  return (
    <div className="container" style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button className="btn secondary" onClick={() => router.push("/interests")}>← Back</button>
        <div>
          <h2 style={{ margin: 0 }}>💬 Chat</h2>
          {interest && (
            <div style={{ fontSize: 13, color: "#6b7280" }}>
              Listing: <strong>{interest?.listing?.location}</strong>
            </div>
          )}
        </div>
        <span style={{
          marginLeft: "auto",
          fontSize: 12, padding: "3px 10px", borderRadius: 999,
          background: status === "ready" ? "#dcfce7" : status === "error" ? "#fee2e2" : "#fef9c3",
          color: status === "ready" ? "#166534" : status === "error" ? "#991b1b" : "#854d0e"
        }}>
          {status === "ready" ? "● Connected" : status === "connecting" || status === "joining" ? "● Connecting…" : status === "disconnected" ? "● Disconnected" : "● Error"}
        </span>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {status === "connecting" || status === "joining" ? (
        <div className="card"><p style={{ color: "#6b7280", margin: 0 }}>Connecting to chat…</p></div>
      ) : (
        <>
          <div className="chat-window">
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", paddingTop: 40 }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((msg) => {
              const mine = msg.senderId === user?.id;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <div className={`chat-bubble ${mine ? "mine" : "theirs"}`}>
                    <div>{msg.body}</div>
                    <div className="chat-meta">
                      {!mine && <span>{msg.sender?.name} · </span>}
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, resize: "none" }}
              disabled={status !== "ready"}
            />
            <button className="btn" onClick={sendMessage} disabled={status !== "ready" || !input.trim()}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}
