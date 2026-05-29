"use client";

import { useState, type FormEvent } from "react";

export function AdminLogin() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setMessage(payload?.error || "Login failed");
      setBusy(false);
      return;
    }

    window.location.reload();
  }

  return (
    <main className="login-shell">
      <section className="auth-panel">
        <h1>DJun CMS</h1>
        <p>Travel journal control room</p>
        <form onSubmit={onSubmit}>
          <input value={username} onChange={(event) => setUsername(event.target.value)} aria-label="Username" />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            aria-label="Password"
          />
          <button className="ghost-button" type="submit" disabled={busy}>
            {busy ? "Signing in" : "Sign in"}
          </button>
          {message ? <p>{message}</p> : null}
        </form>
      </section>
    </main>
  );
}
