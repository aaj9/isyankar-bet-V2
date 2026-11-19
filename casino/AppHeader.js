import React, { useEffect, useState } from "react";
import { Button, Divider, IconButton, InputAdornment, Menu, MenuItem, Popover, TextField } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import BrandMark from "./BrandMark";
import { fiatList, fiatOf, fromTRY, setMoneyContext } from "../utils/money";
import { useLanguage } from "../i18n/LanguageContext";
import LangFlag from "./LangFlag";
import FxMark from "./FxMark";
import { supportApi } from "../services/api";
import { readPrefs } from "../utils/prefs";
import { openAuth } from "../utils/authBus";

const LANG_OPTIONS = [
  { code: "tr", label: "Türkçe" },
  { code: "en", label: "English" },
];


const AppHeader = ({ search, onSearch, onMenu }) => {
  const { user, logout, setCurrency, fx, savePrefs, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const [anchor, setAnchor] = useState(null);
  const [searchEl, setSearchEl] = useState(null);
  const [walletEl, setWalletEl] = useState(null);
  const [unread, setUnread] = useState(0);
  const [mobileDock, setMobileDock] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches
  );
  const [mobileNav, setMobileNav] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches
  );
  const balance = Number(user?.balance) || 0;
  const prefs = { ...readPrefs(), ...(user?.prefs || {}) };
  const hideMoney = Boolean(prefs.hideBalance || prefs.streamer);
  const coin = fiatOf(fx);
  const moneyLocale = lang === "en" ? "en-US" : "tr-TR";
  const formatFx = (_code, value) =>
    new Intl.NumberFormat(moneyLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const symbol = coin.symbol;
  const formatted = formatFx(coin.code, fromTRY(balance, fx));
  const amount = hideMoney ? "••••" : symbol === "$" || symbol === "€" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;

  useEffect(() => {
    const mqDock = window.matchMedia("(max-width: 720px)");
    const mqNav = window.matchMedia("(max-width: 1100px)");
    const sync = () => {
      setMobileDock(mqDock.matches);
      setMobileNav(mqNav.matches);
    };
    sync();
    mqDock.addEventListener("change", sync);
    mqNav.addEventListener("change", sync);
    return () => {
      mqDock.removeEventListener("change", sync);
      mqNav.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return undefined;
    }
    let active = true;
    supportApi
      .inbox()
      .then((data) => {
        if (!active) return;
        setUnread((data.items || []).filter((item) => !item.read).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, location.pathname]);

  const doLogout = () => {
    close();
    logout();
    navigate("/");
  };

  const close = () => setAnchor(null);
  const go = (path) => {
    close();
    navigate(path);
  };

  const changeSearch = (value) => {
    onSearch?.(value);
    if (location.pathname !== "/" && location.pathname !== "/games") {
      navigate("/");
    }
  };

  const langSwitch = (
    <div className="fx-switch lang-switch" role="group" aria-label="Language">
      {LANG_OPTIONS.map((item) => (
        <button
          key={item.code}
          type="button"
          className={lang === item.code ? "on" : ""}
          aria-label={item.label}
          title={item.label}
          onClick={() => setLang(item.code)}
        >
          <LangFlag code={item.code} />
        </button>
      ))}
    </div>
  );

  const pickFx = async (code) => {
    setMoneyContext({ currency: code });
    await setCurrency(code);
    setWalletEl(null);
  };

  const walletMenu = (
    <Popover
      open={Boolean(walletEl)}
      anchorEl={walletEl}
      onClose={() => setWalletEl(null)}
      anchorOrigin={{ vertical: mobileDock ? "top" : "bottom", horizontal: "center" }}
      transformOrigin={{ vertical: mobileDock ? "bottom" : "top", horizontal: "center" }}
      PaperProps={{ className: "wallet-fx-pop" }}
    >
      <div className="wallet-fx">
        <div className="wallet-fx-head">{t("header.balance")}</div>
        <ul className="wallet-fx-list">
          {fiatList().map((item) => (
            <li key={item.code}>
              <button type="button" className={fx === item.code ? "on" : ""} onClick={() => pickFx(item.code)}>
                <FxMark code={item.code} />
                <span className="wallet-fx-copy">
                  <b>{item.symbol}</b>
                  <small>{item.name}</small>
                </span>
                <span className="wallet-fx-amt">
                  {hideMoney ? "••••" : formatFx(item.code, fromTRY(balance, item.code))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="wallet-fx-settings"
          onClick={() => {
            setWalletEl(null);
            go("/hesabim");
          }}
        >
          {t("header.walletSettings")}
        </button>
      </div>
    </Popover>
  );

  const balanceButton = (className) => (
    <button
      type="button"
      className={className}
      onClick={(event) => setWalletEl(event.currentTarget)}
      aria-label={t("header.balance")}
    >
      <FxMark code={coin.code} />
      <span className="wallet-amount">{amount}</span>
      <ExpandMoreIcon className={`wallet-caret${walletEl ? " open" : ""}`} fontSize="small" />
    </button>
  );

  const wallet = !isAuthPage ? (
    <div className="wallet-cluster">
      {balanceButton("wallet-balance")}
      {user ? (
        <button type="button" className="wallet-cta" onClick={() => go("/cuzdan")}>
          <AccountBalanceWalletOutlinedIcon fontSize="small" />
          <span>{t("header.wallet")}</span>
        </button>
      ) : null}
      {walletMenu}
    </div>
  ) : null;

  const walletFloat = mobileDock && !isAuthPage ? balanceButton("wallet-balance wallet-float") : null;

  return (
    <>
    {walletFloat}
    <header className="topbar">
      <div className="topbar-left">
        {mobileNav && !isAuthPage ? (
          <IconButton className="menu-btn menu-btn-mobile" color="inherit" onClick={onMenu} aria-label={t("header.menu")}>
            <MenuIcon />
          </IconButton>
        ) : null}
        <span className="topbar-brand topbar-brand-fixed">
          <BrandMark />
        </span>
      </div>

      <div className="topbar-center">
        {isAuthPage ? (
          mobileDock ? null : (
            <Button className="auth-cta" variant="outlined" color="secondary" startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/")}>
              {t("header.home")}
            </Button>
          )
        ) : (
          wallet
        )}
      </div>

      <div className="topbar-right">
        {isAuthPage ? null : (
          <>
            <button type="button" className="topbar-icon" onClick={(event) => setSearchEl(event.currentTarget)} aria-label={t("header.search")}>
              <SearchIcon fontSize="small" />
            </button>
            <Popover
              open={Boolean(searchEl)}
              anchorEl={searchEl}
              onClose={() => setSearchEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ className: "topbar-search-pop" }}
            >
              <TextField
                autoFocus
                size="small"
                fullWidth
                value={search || ""}
                onChange={(event) => changeSearch(event.target.value)}
                placeholder={t("header.search")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: "#8b9bb0" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Popover>
          </>
        )}

        {user ? (
          <>
            <button type="button" className="topbar-icon topbar-icon-inbox" onClick={() => go("/bildirimler")} aria-label={t("header.inbox")}>
              <MailOutlineIcon fontSize="small" />
              {unread > 0 ? <em className="topbar-badge">{unread > 9 ? "9+" : unread}</em> : null}
            </button>
            <button type="button" className="topbar-icon topbar-icon-profile" onClick={(event) => setAnchor(event.currentTarget)} aria-label={t("header.accountMenu")}>
              {user.avatar ? <img className="topbar-ava" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <PersonOutlineIcon fontSize="small" />}
            </button>
            <Menu
              anchorEl={anchor}
              open={Boolean(anchor)}
              onClose={close}
              disableScrollLock
              BackdropProps={{ invisible: true }}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ className: "profile-menu profile-menu-compact", elevation: 0 }}
            >
              <div className="profile-menu-tools">
                {langSwitch}
              </div>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 0.5 }} />
              <MenuItem onClick={() => { savePrefs({ ...prefs, streamer: !prefs.streamer }); close(); }}>
                <VideocamOutlinedIcon fontSize="small" />
                {prefs.streamer ? t("account.streamerOn") : t("account.streamer")}
              </MenuItem>
              <MenuItem onClick={() => { savePrefs({ ...prefs, ghost: !prefs.ghost }); close(); }}>
                <PersonOffOutlinedIcon fontSize="small" />
                {prefs.ghost ? t("account.ghostOn") : t("account.hideName")}
              </MenuItem>
              <MenuItem onClick={() => go("/hesabim")}>
                <PersonOutlineIcon fontSize="small" />
                {t("header.account")}
              </MenuItem>
              <MenuItem onClick={() => go("/bildirimler")}>
                <MailOutlineIcon fontSize="small" />
                {t("header.inbox")}
              </MenuItem>
              <MenuItem onClick={() => go("/cuzdan")}>
                <AccountBalanceWalletOutlinedIcon fontSize="small" />
                {t("header.wallet")}
              </MenuItem>
              {user.role === "founder" || user.role === "admin" || user.role === "manager" || user.role === "sahaci" ? (
                <MenuItem onClick={() => go("/admin")}>
                  <AdminPanelSettingsOutlinedIcon fontSize="small" />
                  {user.role === "sahaci"
                    ? t("header.cashier")
                    : user.role === "admin"
                      ? t("header.supportDesk")
                      : user.role === "manager"
                        ? "Müdür paneli"
                        : t("header.admin")}
                </MenuItem>
              ) : null}
              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 0.5 }} />
              <MenuItem className="profile-menu-out" onClick={doLogout}>
                <LogoutRoundedIcon fontSize="small" />
                {t("header.logout")}
              </MenuItem>
            </Menu>
          </>
        ) : loading ? (
          <i className="topbar-auth-skel" aria-hidden />
        ) : (
          <>
            <div className="topbar-tools guest-tools">
              {langSwitch}
            </div>
            <button type="button" className="auth-ghost" onClick={() => openAuth("login")}>
              {t("header.login")}
            </button>
            <Button className="auth-cta" variant="contained" color="secondary" onClick={() => openAuth("register")}>
              <span className="cta-full">{t("auth.register")}</span>
              <span className="cta-short">{t("auth.register")}</span>
            </Button>
          </>
        )}
      </div>
    </header>
    </>
  );
};

export default AppHeader;
