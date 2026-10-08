import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useLogin } from "../api/hooks";
import { Layout } from "../theme/Layout";

export function Login() {
  const login = useLogin();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password }, { onSuccess: () => navigate("/") });
  };
  return (
    <Layout title="Log in">
      <div className="container margin-vert--xl login-page">
        <h1>Log in</h1>
        <form onSubmit={submit}>
          <label htmlFor="u">Username</label>
          <input
            id="u"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <label htmlFor="p">Password</label>
          <input
            id="p"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {login.error && (
            <div className="alert alert--danger margin-bottom--md" role="alert">
              {login.error instanceof ApiError && login.error.status === 429
                ? "Too many attempts. Try again shortly."
                : "Invalid username or password."}
            </div>
          )}
          <button
            className="button button--primary"
            type="submit"
            disabled={login.isPending}
          >
            Log in
          </button>
        </form>
      </div>
    </Layout>
  );
}

export function Placeholder({
  title,
  phase,
}: {
  title: string;
  phase: number;
}) {
  return (
    <Layout title={title}>
      <div className="container margin-vert--lg">
        <h1>{title}</h1>
        <div className="alert alert--info">
          This section is built in Phase {phase}.
        </div>
      </div>
    </Layout>
  );
}

export function NotFound() {
  return (
    <Layout title="Page not found">
      <div className="container margin-vert--xl text--center">
        <h1>Page not found</h1>
        <p>We could not find what you were looking for.</p>
      </div>
    </Layout>
  );
}
