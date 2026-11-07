(function () {
  var STEPS = {
    self: [
      ["i-wallet", "Log what you spend", "Add expenses as they happen, or in one batch at the end of the day."],
      ["i-pie", "Set a budget", "Pick a monthly limit overall or per category."],
      ["i-down", "Review and export", "Check the summary each week and export it when you need a copy."]
    ],
    small: [
      ["i-people", "Invite your group", "Add housemates, friends or colleagues to a shared list."],
      ["i-receipt", "Add shared bills", "Record who paid and how the cost is split."],
      ["i-down", "Settle up", "See who owes what and clear balances."]
    ],
    team: [
      ["i-receipt", "Collect receipts", "Members attach a photo to each expense as they go."],
      ["i-tag", "Categorise", "Apply categories and tags that match your chart of accounts."],
      ["i-down", "Export reports", "Download monthly reports for bookkeeping."]
    ]
  };
  var panel = document.getElementById("steps");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render(key) {
    panel.innerHTML = STEPS[key].map(function (s, i) {
      return '<article class="step"><svg class="ico" aria-hidden="true"><use href="#' + s[0] + '"/></svg><h3>' +
        (i + 1) + ". " + esc(s[1]) + "</h3><p>" + esc(s[2]) + "</p></article>";
    }).join("");
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-set") === key;
      t.setAttribute("aria-selected", on ? "true" : "false");
      if (on) panel.setAttribute("aria-labelledby", t.id);
    });
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { render(t.getAttribute("data-set")); });
    t.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(t);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        n.focus(); n.click(); e.preventDefault();
      }
    });
  });
  render("self");

  // Keep the "How it works" tab in sync with the chosen role.
  Array.prototype.forEach.call(document.querySelectorAll('input[name="role-hero"]'), function (r) {
    r.addEventListener("change", function () { render(r.value); });
  });

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE = /^\+?[0-9][0-9\s\-()]{6,17}$/;
  function wire(formId, inputId, msgId) {
    var form = document.getElementById(formId), input = document.getElementById(inputId), msg = document.getElementById(msgId);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      msg.className = "msg";
      if (!v) { input.setAttribute("aria-invalid", "true"); msg.className = "msg err"; msg.textContent = "Enter your email or phone number to continue."; input.focus(); return; }
      if (!EMAIL.test(v) && !PHONE.test(v)) { input.setAttribute("aria-invalid", "true"); msg.className = "msg err"; msg.textContent = "That doesn't look like an email or phone number. Check it and try again."; input.focus(); return; }
      input.removeAttribute("aria-invalid");
      try { sessionStorage.setItem("expensity_prefill", JSON.stringify(v)); } catch (err) {}
      window.location.href = "signup.html";
    });
    input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
  }
  wire("signup-hero", "contact-hero", "msg-hero");
  wire("signup-cta", "contact-cta", "msg-cta");

  document.getElementById("g-hero").addEventListener("click", function () {
    var m = document.getElementById("msg-hero"); m.className = "msg"; m.textContent = "Google sign-in isn't connected yet.";
  });
})();
