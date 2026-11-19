import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { authApi, paymentApi } from "../services/api";
import { currentCurrency, setMoneyContext } from "../utils/money";
import {
  clearSessionMark,
  ensureSessionMark,
  isPlayPath,
  sessionExpired,
  sessionRemainingMs,
  touchSession,
  SESSION_MS,
} from "../utils/session";
import { applyPrefs, readPrefs, writePrefs } from "../utils/prefs";
import { showMascot } from "../utils/mascotBus";

const AuthContext = createContext(null);
const USER_CACHE = "bet_user";

const readCachedUser = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_CACHE) || "null");
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (next) => {
  try {
    if (next?.id) localStorage.setItem(USER_CACHE, JSON.stringify(next));
    else localStorage.removeItem(USER_CACHE);
  } catch {
    /* ignore */
  }
};

const greet = (user, kind) => {
  const name = user?.username || user?.name || "";
  if (kind === "register") {
    showMascot({
      mood: "ok",
      tone: "gold",
      title: "Aramıza hoş geldin",
      text: name ? `${name}, hoş geldin bonusun hesabında seni bekliyor.` : "Hoş geldin bonusun seni bekliyor.",
    });
    return;
  }
  showMascot({
    mood: "hello",
    tone: "calm",
    title: name ? `Hoş geldin ${name}` : "Hoş geldin",
    text: "Girişin başarılı. Bol şans!",
  });
};

export function AuthProvider({ children }) {
  const location = useLocation();
  const playing = isPlayPath(location.pathname);
  const [sessionOn, setSessionOn] = useState(() => Boolean(localStorage.getItem("bet_session_at")));
  const [user, setUser] = useState(() => (localStorage.getItem("bet_session_at") ? readCachedUser() : null));
  const [fx, setFx] = useState(() => currentCurrency());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("bet_session_at")));
  const logoutRef = useRef(() => {});
  const bumping = useRef(false);

  const applyFx = (next) => {
    const currency = next?.currency || currentCurrency();
    setMoneyContext({
      currency,
      usd: next?.fx?.usd,
    });
    setFx(currency);
  };

  const applyUser = (next) => {
    if (next) applyFx(next);
    setUser(next || null);
    writeCachedUser(next || null);
  };

  const hardLogout = (reason, redirect) => {
    authApi.logout().catch(() => {});
    localStorage.removeItem("bet_token");
    writeCachedUser(null);
    clearSessionMark();
    setSessionOn(false);
    setUser(null);
    if (redirect && window.location.pathname !== "/login") {
      window.location.href = redirect;
      return;
    }
    if (reason && window.location.pathname !== "/login") {
      window.dispatchEvent(new CustomEvent("session-expired", { detail: reason }));
    }
  };

  logoutRef.current = () => hardLogout();

  useEffect(() => {
    applyPrefs({ ...readPrefs(), ...(user?.prefs || {}) });
  }, [user]);

  useEffect(() => {
    let active = true;
    const syncFx = () => {
      paymentApi
        .fx()
        .then((data) => {
          if (!active || !(Number(data.usd) > 0)) return;
          setMoneyContext({ usd: data.usd });
        })
        .catch(() => {});
    };
    syncFx();
    const timer = setInterval(syncFx, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onReplaced = (event) => {
      hardLogout(event.detail || "Hesabınız başka bir cihazda açıldı.", "/login?replaced=1");
    };
    window.addEventListener("session-replaced", onReplaced);
    return () => window.removeEventListener("session-replaced", onReplaced);
  }, []);

  useEffect(() => {
    if (!sessionOn) {
      writeCachedUser(null);
      setUser(null);
      setLoading(false);
      return;
    }
    ensureSessionMark();
    if (!playing && sessionExpired()) {
      hardLogout("Oturum süresi doldu. Tekrar giriş yap.");
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((data) => {
        applyUser(data.user);
      })
      .catch((err) => {
        if (err.code === "SESSION_REPLACED") {
          hardLogout(err.message, "/login?replaced=1");
          return;
        }
        if (playing) return;
        if (err.status === 401 || err.status === 403 || err.code === "SESSION_LEGACY") {
          hardLogout(err.message || "Oturum geçersiz. Tekrar giriş yap.");
        }
      })
      .finally(() => setLoading(false));
  }, [sessionOn, playing]);

  useEffect(() => {
    if (!sessionOn || !user) return undefined;

    const expireNow = () => {
      hardLogout("6 saatlik oturum süren doldu.");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login?expired=1";
      }
    };

    const bumpToken = () => {
      if (sessionRemainingMs() > 90 * 60 * 1000 || bumping.current) return;
      bumping.current = true;
      authApi
        .refresh()
        .then((data) => {
          touchSession();
          if (data.user) applyUser(data.user);
        })
        .catch(() => {})
        .finally(() => {
          bumping.current = false;
        });
    };

    const check = () => {
      if (playing || isPlayPath()) {
        bumpToken();
        return;
      }
      if (sessionExpired()) {
        expireNow();
        return;
      }
      bumpToken();
    };

    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [sessionOn, user, playing]);

  useEffect(() => {
    if (!sessionOn || !playing) return undefined;
    let stop = false;
    const tick = () => {
      authApi
        .me()
        .then((data) => {
          if (stop || !data.user) return;
          setUser((prev) => {
            if (!prev) return data.user;
            const same = Number(prev.balance) === Number(data.user.balance)
              && Number(prev.bonusBalance) === Number(data.user.bonusBalance)
              && Number(prev.realBalance) === Number(data.user.realBalance);
            if (same) return prev;
            const next = {
              ...prev,
              balance: data.user.balance,
              bonusBalance: data.user.bonusBalance,
              realBalance: data.user.realBalance,
              fakeBalance: data.user.fakeBalance,
            };
            writeCachedUser(next);
            return next;
          });
        })
        .catch(() => {});
    };
    tick();
    const timer = setInterval(tick, 1200);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [sessionOn, playing]);

  const value = useMemo(
    () => ({
      token: sessionOn ? "1" : "",
      user,
      fx,
      loading,
      sessionMs: SESSION_MS,
      async login(payload) {
        const data = await authApi.login(payload);
        if (data.require2fa) return data;
        localStorage.removeItem("bet_token");
        touchSession();
        setSessionOn(true);
        applyUser(data.user);
        writePrefs({ ...readPrefs(), ...(data.user?.prefs || {}) });
        greet(data.user, "login");
        return data;
      },
      async login2fa(payload) {
        const data = await authApi.login2fa(payload);
        localStorage.removeItem("bet_token");
        touchSession();
        setSessionOn(true);
        applyUser(data.user);
        greet(data.user, "login");
        return data.user;
      },
      async register(payload) {
        const data = await authApi.register(payload);
        localStorage.removeItem("bet_token");
        touchSession();
        setSessionOn(true);
        applyUser(data.user);
        greet(data.user, "register");
        return data.user;
      },
      async setCurrency(currency) {
        setMoneyContext({ currency });
        setFx(currency);
        if (!sessionOn) return null;
        try {
          const data = await authApi.setCurrency(currency);
          applyUser(data.user);
          return data.user;
        } catch {
          return null;
        }
      },
      logout() {
        hardLogout();
      },
      refresh() {
        if (!sessionOn) return Promise.resolve();
        return authApi.me().then((data) => {
          applyUser(data.user);
          writePrefs({ ...readPrefs(), ...(data.user?.prefs || {}) });
        }).catch((err) => {
          if (err.code === "SESSION_REPLACED") {
            hardLogout(err.message, "/login?replaced=1");
          }
          throw err;
        });
      },
      async savePrefs(next) {
        const local = writePrefs({ ...readPrefs(), ...(user?.prefs || {}), ...next });
        if (!sessionOn) return local;
        try {
          const data = await authApi.savePrefs(local);
          applyUser(data.user);
          return writePrefs({ ...local, ...(data.user?.prefs || {}) });
        } catch {
          return local;
        }
      },
    }),
    [sessionOn, user, fx, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth AuthProvider içinde kullanılmalı");
  }
  return context;
}
