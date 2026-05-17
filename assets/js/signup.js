(function () {
  const form = document.getElementById("signup-form");
  const status = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");
  const cfg = window.TOURNAMENT_CONFIG || {};

  function setStatus(msg, kind) {
    status.textContent = msg;
    status.className = "form-status" + (kind ? " " + kind : "");
  }

  function validate(data) {
    const errs = [];
    if (!data.teamName || data.teamName.length < 2) errs.push("Team name");
    if (!data.captainName || data.captainName.length < 2) errs.push("Captain name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) errs.push("Email");
    if (!data.phone || data.phone.replace(/\D/g, "").length < 6) errs.push("Phone");
    return errs;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    setStatus("", "");

    const data = {
      teamName: form.teamName.value.trim(),
      captainName: form.captainName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      partnerName: form.partnerName.value.trim(),
    };

    const errs = validate(data);
    if (errs.length) {
      setStatus("Check these fields: " + errs.join(", "), "err");
      return;
    }

    if (!cfg.appsScriptUrl) {
      setStatus(
        "Signup endpoint not configured yet. Ask the organizer to set appsScriptUrl in assets/js/config.js.",
        "err"
      );
      return;
    }

    submitBtn.disabled = true;
    setStatus("Submitting…");

    try {
      // Use text/plain to avoid a CORS preflight against Apps Script.
      const res = await fetch(cfg.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "signup", payload: data }),
      });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || ("HTTP " + res.status));
      }
      setStatus(
        "Registered. You're team #" + (json.position || "?") + ".",
        "ok"
      );
      form.reset();
    } catch (err) {
      setStatus("Could not register: " + err.message, "err");
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
