import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useLogout, useMe, useSettings, useSidebar } from "../api/hooks";
import { QUICK_ADD } from "../forms/config";
import { useForms } from "../forms/FormHost";
import { DocSidebarMenu } from "./DocSidebar";
import { useEditMode } from "./EditMode";
import { NAV_ITEMS } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

const isMac =
  typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

function Brand({ onClick }: { onClick?: () => void }) {
  const { data: s } = useSettings();
  return (
    <Link to="/" className="navbar__brand" onClick={onClick}>
      {s?.logo ? (
        <img className="navbar__logo" src={s.logo} alt="" />
      ) : (
        <svg className="navbar__logo" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="var(--ifm-color-primary)" />
          <path d="M8 22V10h5a4 4 0 0 1 0 8h-2v4z M19 10h6v3h-6z" fill="#fff" />
        </svg>
      )}
      <b className="navbar__title text--truncate">
        {s?.site_title ?? "Notebook"}
      </b>
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [secondary, setSecondary] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: sidebar } = useSidebar(
    !!me && (me.authenticated || !!me.public_read),
  );
  const onDocs = pathname.startsWith("/docs");
  const { editing, toggle: toggleEdit } = useEditMode();
  const { openForm, openImport } = useForms();

  useEffect(() => {
    setOpen(false);
    setSecondary(false);
  }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav
      className={`navbar navbar--fixed-top${open ? " navbar-sidebar--show" : ""}`}
      aria-label="Main"
    >
      <div className="navbar__inner">
        <div className="navbar__items">
          <button
            type="button"
            aria-label="Toggle navigation bar"
            aria-expanded={open}
            className="navbar__toggle clean-btn"
            onClick={() => setOpen(true)}
          >
            <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeMiterlimit="10"
                strokeWidth="2"
                d="M4 7h22M4 15h22M4 23h22"
              />
            </svg>
          </button>
          <Brand />
          {NAV_ITEMS.map((item) =>
            item.children ? (
              <div
                key={item.label}
                className="navbar__item dropdown dropdown--hoverable"
              >
                <a
                  className="navbar__link"
                  href="#"
                  role="button"
                  onClick={(e) => e.preventDefault()}
                >
                  {item.label}
                </a>
                <ul className="dropdown__menu">
                  {item.children.map((c) => (
                    <li key={c.to}>
                      <NavLink to={c.to} className="dropdown__link">
                        {c.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <NavLink
                key={item.label}
                to={item.to!}
                className={({ isActive }) =>
                  `navbar__item navbar__link${isActive ? " navbar__link--active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </div>
        <div className="navbar__items navbar__items--right">
          <button
            type="button"
            className="search-button"
            aria-label="Search (coming soon)"
            disabled
            title="Search arrives in Phase 4"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M14.386 14.386l4.0877 4.0877-4.0877-4.0877c-2.9418 2.9419-7.7115 2.9419-10.6533 0-2.9419-2.9418-2.9419-7.7115 0-10.6533 2.9418-2.9419 7.7115-2.9419 10.6533 0 2.9419 2.9418 2.9419 7.7115 0 10.6533z"
                stroke="currentColor"
                fill="none"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Search</span>
            <span className="search-button__keys">
              {isMac ? "⌘" : "Ctrl"} K
            </span>
          </button>
          <ThemeToggle />
          {me?.authenticated && (
            <>
              <div className="navbar__item dropdown dropdown--hoverable dropdown--right">
                <button
                  type="button"
                  className="clean-btn toggle-button"
                  aria-label="Quick add"
                  aria-haspopup="menu"
                  title="Quick add"
                >
                  <span aria-hidden="true" className="quick-add__plus">
                    ＋
                  </span>
                </button>
                <ul className="dropdown__menu" role="menu">
                  {QUICK_ADD.map((q) => (
                    <li key={q.model} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown__link clean-btn"
                        onClick={() => openForm(q.model)}
                      >
                        {q.label}
                      </button>
                    </li>
                  ))}
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className="dropdown__link clean-btn"
                      onClick={openImport}
                    >
                      Import papers…
                    </button>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                className={`clean-btn toggle-button${editing ? " toggle-button--on" : ""}`}
                aria-pressed={editing}
                aria-label={
                  editing ? "Turn edit mode off" : "Turn edit mode on"
                }
                title={editing ? "Edit mode: on" : "Edit mode: off"}
                onClick={toggleEdit}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
              </button>
            </>
          )}
          {me?.authenticated ? (
            <div className="navbar__item dropdown dropdown--hoverable dropdown--right">
              <a
                className="navbar__link"
                href="#"
                role="button"
                onClick={(e) => e.preventDefault()}
              >
                {me.username}
              </a>
              <ul className="dropdown__menu">
                <li>
                  <button
                    type="button"
                    className="dropdown__link clean-btn"
                    onClick={() =>
                      logout.mutate(undefined, {
                        onSuccess: () => navigate("/"),
                      })
                    }
                  >
                    Log out
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <Link className="navbar__item navbar__link" to="/login">
              Log in
            </Link>
          )}
        </div>
      </div>
      <div
        role="presentation"
        className="navbar-sidebar__backdrop"
        onClick={() => setOpen(false)}
      />
      <div className="navbar-sidebar">
        <div className="navbar-sidebar__brand">
          <Brand onClick={() => setOpen(false)} />
          <ThemeToggle />
          <button
            type="button"
            className="clean-btn navbar-sidebar__close"
            aria-label="Close navigation bar"
            onClick={() => setOpen(false)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M4 4l12 12M16 4L4 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div
          className={`navbar-sidebar__items${secondary ? " navbar-sidebar__items--show-secondary" : ""}`}
        >
          <div className="navbar-sidebar__item menu">
            <ul className="menu__list">
              {NAV_ITEMS.map((item) =>
                item.children ? (
                  <li key={item.label} className="menu__list-item">
                    <span className="menu__link menu__link--sublist menu__link--sublist-caret">
                      {item.label}
                    </span>
                    <ul className="menu__list">
                      {item.children.map((c) => (
                        <li key={c.to} className="menu__list-item">
                          <NavLink to={c.to} className="menu__link">
                            {c.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </li>
                ) : item.to === "/docs" && onDocs ? (
                  <li key={item.label} className="menu__list-item">
                    <button
                      type="button"
                      className="menu__link menu__link--sublist clean-btn menu__link--active"
                      onClick={() => setSecondary(true)}
                    >
                      {item.label}
                    </button>
                  </li>
                ) : (
                  <li key={item.label} className="menu__list-item">
                    <NavLink to={item.to!} className="menu__link">
                      {item.label}
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="navbar-sidebar__item menu">
            <button
              type="button"
              className="clean-btn navbar-sidebar__back"
              onClick={() => setSecondary(false)}
            >
              ← Back to main menu
            </button>
            {sidebar && <DocSidebarMenu items={sidebar} />}
          </div>
        </div>
      </div>
    </nav>
  );
}
