/* ticketsale.uz — interactions */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) {
    return (root || document).querySelector(sel);
  };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------- header */
  var header = $("#siteHeader");
  var onScroll = function () {
    header.classList.toggle("is-stuck", window.scrollY > 6);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------- drawer */
  var burger = $("#burger");
  var drawer = $("#drawer");
  var closeDrawer = function () {
    drawer.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  };
  burger.addEventListener("click", function () {
    var open = drawer.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", String(open));
  });
  $$("#drawer a").forEach(function (a) {
    a.addEventListener("click", closeDrawer);
  });
  document.addEventListener("click", function (e) {
    if (!drawer.contains(e.target) && !burger.contains(e.target)) closeDrawer();
  });

  /* ---------------------------------------------------- toast */
  var toastEl = $("#toast");
  var toastTimer;
  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 3200);
  }

  /* ---------------------------------------------------- tabs */
  var tabs = $$(".search-tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
    });
  });

  /* ---------------------------------------------------- swap */
  var fromInput = $("#fromCity");
  var toInput = $("#toCity");
  var swapBtn = $("#swapBtn");
  swapBtn.addEventListener("click", function () {
    var tmp = fromInput.value;
    fromInput.value = toInput.value;
    toInput.value = tmp;
    swapBtn.classList.toggle("is-flipped");
  });

  /* ---------------------------------------------------- date */
  var MONTHS = [
    "янв.", "февр.", "мар.", "апр.", "мая", "июн.",
    "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."
  ];
  var dateInput = $("#dateInput");
  var dateValue = $("#dateValue");

  function formatDate(v) {
    var parts = (v || "").split("-");
    if (parts.length !== 3) return dateValue.textContent;
    var d = parseInt(parts[2], 10);
    var m = parseInt(parts[1], 10) - 1;
    var y = parts[0];
    return d + " " + MONTHS[m] + " " + y;
  }
  dateInput.addEventListener("change", function () {
    dateValue.textContent = formatDate(dateInput.value);
  });

  /* ---------------------------------------------------- passengers */
  function plural(n, forms) {
    var n10 = n % 10;
    var n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  var passField = $("#passField");
  var passPopover = $("#passPopover");
  var passCountEl = $("#passCount");
  var passValueEl = $("#passValue");
  var passMinus = $("#passMinus");
  var passPlus = $("#passPlus");
  var passDone = $("#passDone");
  var passCount = 2;

  function renderPassengers() {
    passCountEl.textContent = String(passCount);
    passValueEl.textContent =
      passCount + " " + plural(passCount, ["человек", "человека", "человек"]);
    passMinus.disabled = passCount <= 1;
    passPlus.disabled = passCount >= 9;
  }

  function togglePopover(open) {
    passPopover.classList.toggle("is-open", open);
    passField.setAttribute("aria-expanded", String(open));
  }

  passField.addEventListener("click", function (e) {
    if (e.target.closest("#passPopover")) return;
    togglePopover(!passPopover.classList.contains("is-open"));
  });
  passField.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePopover(!passPopover.classList.contains("is-open"));
    }
    if (e.key === "Escape") togglePopover(false);
  });
  passMinus.addEventListener("click", function () {
    if (passCount > 1) passCount--;
    renderPassengers();
  });
  passPlus.addEventListener("click", function () {
    if (passCount < 9) passCount++;
    renderPassengers();
  });
  passDone.addEventListener("click", function () {
    togglePopover(false);
  });
  document.addEventListener("click", function (e) {
    if (!passField.contains(e.target)) togglePopover(false);
  });
  renderPassengers();

  /* ---------------------------------------------------- price range */
  var priceMin = $("#priceMin");
  var priceMax = $("#priceMax");
  var rangeFill = $("#rangeFill");
  var STEP = parseInt(priceMin.step, 10);
  var BOUNDS_MIN = parseInt(priceMin.min, 10);
  var BOUNDS_MAX = parseInt(priceMax.max, 10);

  function renderRange() {
    var hi = parseInt(priceMax.value, 10);
    var span = BOUNDS_MAX - BOUNDS_MIN;
    var right = ((hi - BOUNDS_MIN) / span) * 100;
    rangeFill.style.left = "0%";
    rangeFill.style.width = right + "%";
  }

  priceMin.addEventListener("input", function () {
    if (parseInt(priceMin.value, 10) > parseInt(priceMax.value, 10) - STEP) {
      priceMin.value = parseInt(priceMax.value, 10) - STEP;
    }
    renderRange();
  });
  priceMax.addEventListener("input", function () {
    if (parseInt(priceMax.value, 10) < parseInt(priceMin.value, 10) + STEP) {
      priceMax.value = parseInt(priceMin.value, 10) + STEP;
    }
    renderRange();
  });
  renderRange();

  /* ---------------------------------------------------- search */
  var form = $("#searchForm");
  var submit = $("#searchSubmit");
  var submitLabel = submit.querySelector("span");
  var submitIcon = submit.querySelector(".ph");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submit.classList.contains("is-loading")) return;

    var from = fromInput.value.trim() || "Ташкент";
    var to = toInput.value.trim() || "Самарканд";
    submit.classList.add("is-loading");
    submitIcon.classList.remove("ph-magnifying-glass");
    submitIcon.classList.add("ph-spinner");
    submitLabel.textContent = "Ищем…";

    setTimeout(function () {
      submit.classList.remove("is-loading");
      submitIcon.classList.add("ph-magnifying-glass");
      submitIcon.classList.remove("ph-spinner");
      submitLabel.textContent = "Найти билеты";
      toast(
        "Демо-режим: " +
          from +
          " → " +
          to +
          ", " +
          dateValue.textContent +
          ", " +
          passValueEl.textContent
      );
    }, 1400);
  });

  /* header search button -> focus the form */
  $("#headerSearch").addEventListener("click", function () {
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    setTimeout(function () {
      fromInput.focus();
      fromInput.select();
    }, reduceMotion ? 0 : 500);
  });

  /* ---------------------------------------------------- reveal */
  var revealEls = $$("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) {
      el.classList.add("is-in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  }
})();
