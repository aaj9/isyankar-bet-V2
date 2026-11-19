import React, { useState } from "react";
import { Button } from "@mui/material";
import CakeRoundedIcon from "@mui/icons-material/CakeRounded";
import { useAuth } from "../auth/AuthContext";
import { authApi } from "../services/api";
import { formatTRY } from "../utils/money";
import { MASCOT } from "../utils/mascotBus";

const storageKey = (id, year) => `marsilya_birthday_${id}_${year}`;

const BirthdayBonusModal = () => {
  const { user, refresh } = useAuth();
  const info = user?.birthday;
  const year = new Date().getFullYear();
  const [hidden, setHidden] = useState(() =>
    Boolean(user && sessionStorage.getItem(storageKey(user.id, year)))
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  if (!user || !info?.canClaim || hidden) return null;

  const close = () => {
    sessionStorage.setItem(storageKey(user.id, year), "1");
    setHidden(true);
  };

  const claim = () => {
    setBusy(true);
    setError("");
    authApi
      .claimBirthday()
      .then((data) => {
        setDone(data.message || "Bonus eklendi");
        refresh().catch(() => {});
        setTimeout(close, 2500);
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  };

  return (
    <div className="promo-overlay" role="dialog" aria-modal="true" aria-label="Doğum günü bonusu">
      <div className="promo-modal promo-birthday">
        <button type="button" className="promo-close" onClick={close} aria-label="Kapat">
          ×
        </button>
        <div className="promo-glow" />
        <img className="promo-mascot" src={MASCOT.win} alt="" aria-hidden />
        <div className="promo-badge">
          <CakeRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />
          DOĞUM GÜNÜ
        </div>
        <h2>
          İyi ki doğdun {user.username}
          <span>{formatTRY(info.amount)} doğum günü bonusu</span>
        </h2>
        <p>
          Kimliği onaylı üyelerimize özel doğum günü hediyesi seni bekliyor. Bonus bakiyene eklenir.
          Çekim için 10x çevirim şartı vardır.
        </p>
        <ul className="promo-points">
          <li>Kimlik doğrulaman onaylı</li>
          <li>Yılda bir kez, doğum gününde ±{info.windowDays} gün</li>
          <li>Seviyene göre artan tutar</li>
        </ul>
        {error ? <p className="promo-error">{error}</p> : null}
        {done ? <p className="promo-done">{done}</p> : null}
        <div className="promo-actions">
          <Button variant="contained" color="primary" size="large" disabled={busy || Boolean(done)} onClick={claim}>
            {busy ? "Ekleniyor…" : "Bonusu al"}
          </Button>
          <button type="button" className="promo-skip" onClick={close}>
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  );
};

export default BirthdayBonusModal;
