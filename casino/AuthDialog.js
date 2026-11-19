import React, { useCallback, useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import TelegramIcon from "@mui/icons-material/Telegram";
import { useLocation, useNavigate } from "react-router-dom";
import AuthPage from "../pages/AuthPage";
import { useAuth } from "../auth/AuthContext";
import { subscribeAuth } from "../utils/authBus";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "./SiteFooter";

const AuthDialog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const routeMode = location.pathname === "/register" ? "register" : location.pathname === "/login" ? "login" : "";
  const [open, setOpen] = useState(Boolean(routeMode));
  const [mode, setMode] = useState(routeMode || "login");

  const close = useCallback(() => {
    setOpen(false);
    if (routeMode) navigate({ pathname: "/", search: location.search }, { replace: true });
  }, [navigate, routeMode, location.search]);

  useEffect(() => subscribeAuth((detail) => {
    setMode(detail.mode === "register" ? "register" : "login");
    setOpen(true);
  }), []);

  useEffect(() => {
    if (!routeMode) return;
    setMode(routeMode);
    setOpen(true);
  }, [routeMode]);

  useEffect(() => {
    if (!user) return;
    setOpen(false);
    if (routeMode) navigate("/", { replace: true });
  }, [user, routeMode, navigate]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") close();
    };
    document.body.classList.add("auth-modal-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("auth-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open || user) return null;

  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Giriş ve kayıt">
      <button type="button" className="auth-modal-scrim" onClick={close} aria-label="Kapat" />
      <div className="auth-modal-card">
        <button type="button" className="auth-modal-close" onClick={close} aria-label="Kapat">
          <CloseRoundedIcon fontSize="small" />
        </button>
        <AuthPage embedded initialMode={mode} onDone={close} />
        <a className="auth-modal-tg" href={TELEGRAM_URL} target="_blank" rel="noreferrer noopener">
          <TelegramIcon fontSize="small" />
          <span>{TELEGRAM_HANDLE}</span>
        </a>
      </div>
    </div>
  );
};

export default AuthDialog;
