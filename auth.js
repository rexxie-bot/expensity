/*
 * Expensity auth (signup, login, forgot password)
 *
 * This is a FRONT-END DEMO. There is no server yet, so accounts are stored in this
 * browser's localStorage only. Passwords are never stored as plain text (they are
 * hashed with PBKDF2 and a random salt), but real authentication must run on a
 * server. To connect a backend, replace the three functions in the "API" section
 * below (apiSignup, apiLogin, apiRequestReset) with fetch() calls and keep the rest.
 */
(function () {
  "use strict";

  var KEYS = { users: "expensity_users", session: "expensity_session", prefill: "expensity_prefill" };
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^\+?[0-9][0-9\s\-()]{6,17}$/;

  /* ---------- storage helpers (always safe if storage is blocked) ---------- */
  function read(store, key, fallback) {
    try { var v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(store, key, value) {
    try { store.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  /* ---------- small utilities ---------- */
  function $(id) { return document.getElementById(id); }

  function normalizeContact(raw) {
    var c = raw.trim();
    if (EMAIL.test(c)) return { type: "email", value: c.toLowerCase() };
    if (PHONE.test(c)) return { type: "phone", value: c.replace(/[\s\-()]/g, "") };
    return null;
  }

  function toHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }

  function randomSalt() {
    var a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return toHex(a);
  }

  function hashPassword(password, salt) {
    if (!window.crypto || !crypto.subtle) {
      return Promise.reject(new Error("nocrypto"));
    }
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
      .then(function (key) {
        return crypto.subtle.deriveBits(
          { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 150000 }, key, 256
        );
      })
      .then(toHex);
  }

  /* ---------- form UI helpers ---------- */
  function showError(input, message) {
    input.setAttribute("aria-invalid", "true");
    var el = $("err-" + input.id);
    if (el) el.textContent = message;
  }
  function clearError(input) {
    input.removeAttribute("aria-invalid");
    var el = $("err-" + input.id);
    if (el) el.textContent = "";
  }
  function clearOnInput(form) {
    form.addEventListener("input", function (e) { if (e.target && e.target.id) clearError(e.target); });
    form.addEventListener("change", function (e) { if (e.target && e.target.id) clearError(e.target); });
  }
  function setStatus(message, kind) {
    var el = $("form-status");
    el.className = "msg" + (kind ? " " + kind : "");
    el.textContent = message;
  }
  function setBusy(button, busy) {
    button.disabled = busy;
    button.textContent = busy ? "Please wait..." : button.getAttribute("data-label");
  }
  function initPasswordToggles() {
    Array.prototype.forEach.call(document.querySelectorAll(".pw-toggle"), function (btn) {
      btn.addEventListener("click", function () {
        var input = $(btn.getAttribute("aria-controls"));
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        btn.setAttribute("aria-label", (show ? "Hide" : "Show") + " password");
      });
    });
  }
  function prefillContact(input) {
    try {
      var v = JSON.parse(sessionStorage.getItem(KEYS.prefill));
      if (v && typeof v === "string") input.value = v;
      sessionStorage.removeItem(KEYS.prefill);
    } catch (e) { /* ignore */ }
  }
  function validatorFor(form) {
    var state = { ok: true, first: null };
    return {
      bad: function (input, message) {
        showError(input, message);
        state.ok = false;
        if (!state.first) state.first = input;
      },
      finish: function () {
        if (!state.ok && state.first) state.first.focus();
        return state.ok;
      }
    };
  }
  function passwordProblem(pw) {
    if (pw.length < 8) return "Use at least 8 characters.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
    return "";
  }
  function strengthLevel(pw) {
    if (!pw) return 0;
    var s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.max(1, s);
  }

  /* ---------- API (replace these with fetch() calls when you have a backend) ---------- */
  function apiSignup(user) {
    var users = read(localStorage, KEYS.users, []);
    if (users.some(function (u) { return u.contact === user.contact; })) {
      return Promise.reject({ code: "exists" });
    }
    users.push(user);
    return write(localStorage, KEYS.users, users) ? Promise.resolve(user) : Promise.reject({ code: "storage" });
  }
  function apiLogin(contact, password) {
    var users = read(localStorage, KEYS.users, []);
    var user = users.filter(function (u) { return u.contact === contact; })[0];
    if (!user) return Promise.reject({ code: "invalid" });
    return hashPassword(password, user.salt).then(function (hash) {
      if (hash !== user.hash) throw { code: "invalid" };
      return user;
    });
  }
  function apiRequestReset(/* contact */) {
    // A real reset needs a server to send the message. Nothing is sent from here.
    return Promise.resolve({ sent: false });
  }

  function startSession(user, persist) {
    var data = { name: user.name, contact: user.contact, at: new Date().toISOString() };
    write(persist ? localStorage : sessionStorage, KEYS.session, data);
  }
  function friendlyError(err) {
    if (err && err.message === "nocrypto") return "This page needs a secure connection (https or localhost) to protect your password.";
    if (err && err.code === "storage") return "Your browser blocked saving. Turn off private mode or allow site data and try again.";
    return "Something went wrong. Please try again.";
  }

  /* ---------- pages ---------- */
  function initSignup() {
    var form = $("signup-form"), btn = $("submit-btn");
    var name = $("su-name"), contact = $("su-contact"), pw = $("su-pw"), pw2 = $("su-pw2"), terms = $("su-terms");
    var meter = $("su-meter"), meterLabel = $("su-meter-label");
    var LABELS = ["", "Weak", "Fair", "Good", "Strong"];

    prefillContact(contact);
    clearOnInput(form);

    pw.addEventListener("input", function () {
      var level = strengthLevel(pw.value);
      meter.setAttribute("data-level", String(level));
      meter.firstElementChild.style.width = (level * 25) + "%";
      meterLabel.textContent = level ? "Password strength: " + LABELS[level] : "";
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("");
      var v = validatorFor(form);
      var fullName = name.value.trim().replace(/\s+/g, " ");
      var c = normalizeContact(contact.value);
      var problem = passwordProblem(pw.value);

      if (fullName.length < 2) v.bad(name, "Enter your full name.");
      if (!c) v.bad(contact, contact.value.trim() ? "That doesn't look like an email or phone number." : "Enter your email or phone number.");
      if (problem) v.bad(pw, problem);
      if (!pw2.value) v.bad(pw2, "Type your password again.");
      else if (pw2.value !== pw.value) v.bad(pw2, "The passwords don't match.");
      if (!terms.checked) v.bad(terms, "Agree to the terms to create an account.");
      if (!v.finish()) return;

      setBusy(btn, true);
      var salt = randomSalt();
      hashPassword(pw.value, salt)
        .then(function (hash) {
          return apiSignup({
            name: fullName, contact: c.value, type: c.type, salt: salt, hash: hash,
            created: new Date().toISOString()
          });
        })
        .then(function (user) {
          startSession(user, false);
          form.reset();
          meter.firstElementChild.style.width = "0";
          meterLabel.textContent = "";
          setStatus("Account created for " + user.name + ". It is saved in this browser only, because no server is connected yet. Your dashboard comes next.", "ok");
          setBusy(btn, false);
        })
        .catch(function (err) {
          setBusy(btn, false);
          if (err && err.code === "exists") {
            showError(contact, "An account with this email or phone number already exists. Log in instead.");
            contact.focus();
          } else {
            setStatus(friendlyError(err), "err");
          }
        });
    });
  }

  function initLogin() {
    var form = $("login-form"), btn = $("submit-btn");
    var contact = $("li-contact"), pw = $("li-pw"), remember = $("li-remember");

    prefillContact(contact);
    clearOnInput(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("");
      var v = validatorFor(form);
      var c = normalizeContact(contact.value);

      if (!c) v.bad(contact, contact.value.trim() ? "That doesn't look like an email or phone number." : "Enter your email or phone number.");
      if (!pw.value) v.bad(pw, "Enter your password.");
      if (!v.finish()) return;

      setBusy(btn, true);
      apiLogin(c.value, pw.value)
        .then(function (user) {
          startSession(user, remember.checked);
          pw.value = "";
          setStatus("Logged in as " + user.name + ". Your dashboard isn't built yet, so there is nowhere to go next.", "ok");
          setBusy(btn, false);
        })
        .catch(function (err) {
          setBusy(btn, false);
          if (err && err.code === "invalid") {
            setStatus("The email or phone number, or the password, is incorrect.", "err");
            pw.value = "";
            pw.focus();
          } else {
            setStatus(friendlyError(err), "err");
          }
        });
    });
  }

  function initForgot() {
    var form = $("forgot-form"), btn = $("submit-btn"), contact = $("fp-contact");
    prefillContact(contact);
    clearOnInput(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("");
      var v = validatorFor(form);
      var c = normalizeContact(contact.value);
      if (!c) v.bad(contact, contact.value.trim() ? "That doesn't look like an email or phone number." : "Enter your email or phone number.");
      if (!v.finish()) return;

      setBusy(btn, true);
      apiRequestReset(c.value)
        .then(function (res) {
          setBusy(btn, false);
          if (res && res.sent) {
            setStatus("If an account exists for that email or phone number, reset instructions are on the way.", "ok");
          } else {
            setStatus("Nothing was sent. Password reset needs a server to deliver the message, and none is connected yet.", "err");
          }
        })
        .catch(function () {
          setBusy(btn, false);
          setStatus("Something went wrong. Please try again.", "err");
        });
    });
  }

  /* ---------- boot ---------- */
  initPasswordToggles();
  var page = document.body.getAttribute("data-page");
  if (page === "signup") initSignup();
  else if (page === "login") initLogin();
  else if (page === "forgot") initForgot();
})();
