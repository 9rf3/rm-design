/* ticketsale.uz — autobus booking flow (UI only) */
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
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 3200);
  }

  function plural(n, forms) {
    var n10 = n % 10;
    var n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* ---------------------------------------------------- state */
  var state = {
    mode: "solo",
    pax: 1,
    seats: [],
    trip: null,
    price: 95000,
    maxStep: 1
  };

  /* ---------------------------------------------------- dates */
  var MONTHS = [
    "янв.", "февр.", "мар.", "апр.", "мая", "июн.",
    "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."
  ];

  function formatDate(v) {
    var parts = (v || "").split("-");
    if (parts.length !== 3) return "";
    return parseInt(parts[2], 10) + " " + MONTHS[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  var dateOutInput = $("#dateOutInput");
  var dateBackInput = $("#dateBackInput");
  dateOutInput.addEventListener("change", function () {
    $("#dateOutValue").textContent = formatDate(dateOutInput.value);
  });
  dateBackInput.addEventListener("change", function () {
    $("#dateBackValue").textContent = formatDate(dateBackInput.value);
  });

  /* ---------------------------------------------------- places */
  var PLACES = [
    {
      city: "Ташкент",
      items: [
        { name: "Автовокзал «Салют»", addr: "ул. Бунёдкор, 1А · м. Мирзо-Улугбек" },
        { name: "Южный автовокзал", addr: "ул. Ангарская, 67 · м. Миллий" },
        { name: "Северный автовокзал", addr: "ул. Боткинская, 208 · м. Туабе" },
        { name: "Автостанция «Ойбек»", addr: "ул. Шота Руставели, 12 · м. Ойбек" },
        { name: "Автостанция «Чорсу»", addr: "пл. Чорсу, 4 · м. Чорсу" }
      ]
    },
    {
      city: "Самарканд",
      items: [
        { name: "Автовокзал рег. №2", addr: "ул. Фаргона, 64 · мкр. Дўстлик" },
        { name: "Ж/д вокзал", addr: "ул. Регистан, 47 · центр" },
        { name: "Автостанция «Университет»", addr: "мкр. Университет, 12" }
      ]
    },
    {
      city: "Бухара",
      items: [
        { name: "Автовокзал", addr: "ул. Навои, 132 · ж/д вокзал рядом" },
        { name: "Ж/д вокзал", addr: "ул. Бустон, 3" }
      ]
    },
    {
      city: "Фергана",
      items: [
        { name: "Автовокзал Фергана", addr: "ул. Мустақиллик, 106" },
        { name: "Автостанция «Маргилан»", addr: "ул. Университетская, 15" }
      ]
    },
    {
      city: "Андижан",
      items: [{ name: "Автовокзал Андижан", addr: "ул. Ислама Каримова, 47" }]
    },
    {
      city: "Наманган",
      items: [{ name: "Автовокзал Наманган", addr: "ул. Дўстлик, 4" }]
    },
    {
      city: "Хива",
      items: [{ name: "Автовокзал Хива", addr: "ул. Нова, 42 · Ичан-Кала рядом" }]
    },
    {
      city: "Ургенч",
      items: [{ name: "Автостанция «Центральная»", addr: "ул. Али-Ханова, 2" }]
    },
    {
      city: "Нукус",
      items: [{ name: "Автовокзал Нукус", addr: "ул. Айтеке би, 32" }]
    },
    {
      city: "Термез",
      items: [{ name: "Автовокзал Термез", addr: "ул. Саодат, 12" }]
    },
    {
      city: "Карши",
      items: [{ name: "Автовокзал Карши", addr: "ул. Мустақиллик, 18" }]
    },
    {
      city: "Джизак",
      items: [{ name: "Автовокзал Джизак", addr: "ул. Олмазор, 9" }]
    }
  ];

  var PLACE_INDEX = {};
  PLACES.forEach(function (g) {
    g.items.forEach(function (it) {
      PLACE_INDEX[g.city + ", " + it.name] = it;
    });
  });

  function placeAddr(full) {
    var hit = PLACE_INDEX[full];
    return hit ? hit.addr : "";
  }

  function cityOf(val) {
    return (val || "").split(",")[0].trim();
  }

  function buildPlaceMenu(menu, input) {
    menu.innerHTML = "";
    PLACES.forEach(function (g) {
      var head = document.createElement("div");
      head.className = "place-group";
      head.textContent = g.city;
      menu.appendChild(head);
      g.items.forEach(function (it) {
        var full = g.city + ", " + it.name;
        var opt = document.createElement("button");
        opt.type = "button";
        opt.className = "place-opt";
        opt.setAttribute("role", "option");
        opt.dataset.value = full;
        opt.innerHTML =
          '<i class="ph ph-map-pin" aria-hidden="true"></i><span><b></b><span></span></span>';
        opt.querySelector("b").textContent = full;
        opt.querySelector("span span").textContent = it.addr;
        opt.addEventListener("click", function () {
          input.value = full;
          closePlaceMenus();
          input.focus();
        });
        menu.appendChild(opt);
      });
    });
    markCurrent(menu, input.value);
  }

  function filterPlaceMenu(menu, query) {
    var q = (query || "").trim().toLowerCase();
    var any = false;
    $$(".place-opt", menu).forEach(function (opt) {
      var hit = !q || opt.dataset.value.toLowerCase().indexOf(q) > -1 ||
        opt.textContent.toLowerCase().indexOf(q) > -1;
      opt.hidden = !hit;
      if (hit) any = true;
    });
    $$(".place-group", menu).forEach(function (head) {
      var next = head.nextElementSibling;
      var visible = false;
      while (next && !next.classList.contains("place-group")) {
        if (!next.hidden) visible = true;
        next = next.nextElementSibling;
      }
      head.hidden = !visible;
    });
    var empty = menu.querySelector(".place-empty");
    if (!any) {
      if (!empty) {
        empty = document.createElement("div");
        empty.className = "place-empty";
        empty.textContent = "Ничего не найдено — попробуйте другой запрос";
        menu.appendChild(empty);
      }
      empty.hidden = false;
    } else if (empty) {
      empty.hidden = true;
    }
  }

  function markCurrent(menu, value) {
    $$(".place-opt", menu).forEach(function (opt) {
      opt.classList.toggle("is-current", opt.dataset.value === value);
    });
  }

  function closePlaceMenus() {
    $$(".field--place").forEach(function (f) {
      f.classList.remove("is-open");
      var inp = $("input", f);
      if (inp) inp.setAttribute("aria-expanded", "false");
    });
  }

  $$(".field--place").forEach(function (field) {
    var input = $("input", field);
    var menu = $(".place-menu", field);
    buildPlaceMenu(menu, input);

    var open = function () {
      closePlaceMenus();
      field.classList.add("is-open");
      input.setAttribute("aria-expanded", "true");
      filterPlaceMenu(menu, input.value);
      markCurrent(menu, input.value);
    };

    input.addEventListener("focus", open);
    input.addEventListener("click", open);
    input.addEventListener("input", function () {
      field.classList.add("is-open");
      filterPlaceMenu(menu, input.value);
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".field--place")) closePlaceMenus();
  });

  $("#swapBtn").addEventListener("click", function () {
    var a = $("#fromPlace");
    var b = $("#toPlace");
    var tmp = a.value;
    a.value = b.value;
    b.value = tmp;
    $("#swapBtn").classList.toggle("is-flipped");
    closePlaceMenus();
  });

  /* ---------------------------------------------------- group */
  var groupField = $("#groupField");
  var groupPopover = $("#groupPopover");
  var paxCountEl = $("#paxCount");
  var groupValueEl = $("#groupValue");
  var paxMinus = $("#paxMinus");
  var paxPlus = $("#paxPlus");

  function toggleGroup(open) {
    groupPopover.classList.toggle("is-open", open);
    groupField.setAttribute("aria-expanded", String(open));
  }

  function renderPax() {
    paxCountEl.textContent = String(state.pax);
    if (state.mode === "solo") {
      groupValueEl.textContent = "Индивидуально";
      $("#paxHint").textContent = "Один путешественник";
      paxMinus.disabled = true;
      paxPlus.disabled = true;
    } else {
      groupValueEl.textContent = "Группа · " + state.pax;
      $("#paxHint").textContent =
        state.pax + " " + plural(state.pax, ["человек", "человека", "человек"]) + " в группе";
      paxMinus.disabled = state.pax <= 2;
      paxPlus.disabled = state.pax >= 9;
    }
    $("#needSel").textContent = String(state.pax);
    $$("#groupSeg .seg__btn").forEach(function (b) {
      b.classList.toggle("is-active", b.dataset.mode === state.mode);
    });
  }

  groupField.addEventListener("click", function (e) {
    if (e.target.closest("#groupPopover")) return;
    toggleGroup(!groupPopover.classList.contains("is-open"));
  });
  groupField.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleGroup(!groupPopover.classList.contains("is-open"));
    }
    if (e.key === "Escape") toggleGroup(false);
  });
  document.addEventListener("click", function (e) {
    if (!groupField.contains(e.target)) toggleGroup(false);
  });
  $("#groupDone").addEventListener("click", function () {
    toggleGroup(false);
  });

  $$("#groupSeg .seg__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      state.mode = btn.dataset.mode;
      state.pax = state.mode === "solo" ? 1 : Math.max(2, Math.min(9, state.pax));
      state.seats = [];
      renderPax();
      renderSeatState();
    });
  });

  paxMinus.addEventListener("click", function () {
    if (state.pax > (state.mode === "solo" ? 1 : 2)) {
      state.pax--;
      state.seats = state.seats.slice(0, state.pax);
      renderPax();
      renderSeatState();
    }
  });
  paxPlus.addEventListener("click", function () {
    if (state.pax < 9) {
      state.pax++;
      renderPax();
      renderSeatState();
    }
  });

  /* ---------------------------------------------------- steps */
  var scrollTarget = $("#steps");

  function goToStep(n) {
    $$(".step-panel").forEach(function (p) {
      p.classList.toggle("is-active", Number(p.dataset.panel) === n);
    });
    $$("#steps .step").forEach(function (s) {
      var i = Number(s.dataset.step);
      s.classList.toggle("is-active", i === n);
      s.classList.toggle("is-done", i < n);
    });
    if (n > state.maxStep) state.maxStep = n;
    var offset = (header ? header.offsetHeight : 0) + 10;
    var top =
      scrollTarget.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion ? "auto" : "smooth"
    });
  }

  $$("#steps .step").forEach(function (s) {
    s.addEventListener("click", function () {
      var n = Number(s.dataset.step);
      if (n <= state.maxStep) goToStep(n);
    });
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto]");
    if (t) goToStep(Number(t.dataset.goto));
  });

  /* ---------------------------------------------------- search */
  var searchForm = $("#busSearch");
  var searchBtn = $("#busSearchBtn");
  var searchLabel = searchBtn.querySelector("span");
  var searchIcon = searchBtn.querySelector(".ph");
  var results = $("#results");

  function paxLabel() {
    return state.pax + " " + plural(state.pax, ["пассажир", "пассажира", "пассажиров"]);
  }

  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (searchBtn.classList.contains("is-loading")) return;
    closePlaceMenus();
    toggleGroup(false);

    searchBtn.classList.add("is-loading");
    searchIcon.classList.remove("ph-magnifying-glass");
    searchIcon.classList.add("ph-spinner");
    searchLabel.textContent = "Ищем…";

    setTimeout(function () {
      searchBtn.classList.remove("is-loading");
      searchIcon.classList.add("ph-magnifying-glass");
      searchIcon.classList.remove("ph-spinner");
      searchLabel.textContent = "Найти рейсы";

      var from = cityOf($("#fromPlace").value);
      var to = cityOf($("#toPlace").value);
      $(".results__title").innerHTML = "";
      $(".results__title").append(from, " ");
      var arr = document.createElement("i");
      arr.className = "ph ph-arrow-right";
      $(".results__title").append(arr, " " + to);
      $("#resultsMeta").textContent =
        formatDate(dateOutInput.value) + " · " + paxLabel() + " · найдено 4 рейса";

      $$(".trip").forEach(function (t) {
        t.dataset.date = formatDate(dateOutInput.value);
      });

      results.hidden = false;
      results.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start"
      });
    }, 900);
  });

  $$(".sort-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      $$(".sort-chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
    });
  });

  /* ---------------------------------------------------- seat map */
  var seatCols = $("#seatCols");
  var MAN_SEATS = [1, 2, 3, 4, 5, 6];
  var WOMAN_SEATS = [];

  function seatEl(n) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "seat";
    b.textContent = String(n);
    b.dataset.seat = String(n);
    if (MAN_SEATS.indexOf(n) > -1) b.classList.add("is-man");
    if (WOMAN_SEATS.indexOf(n) > -1) b.classList.add("is-woman");
    if (MAN_SEATS.indexOf(n) > -1 || WOMAN_SEATS.indexOf(n) > -1) {
      b.setAttribute("aria-disabled", "true");
      b.title = "Место занято";
    }
    b.addEventListener("click", onSeatClick);
    return b;
  }

  function aisleEl() {
    var d = document.createElement("div");
    d.className = "seat-aisle";
    d.setAttribute("aria-hidden", "true");
    return d;
  }

  function buildSeatMap() {
    seatCols.innerHTML = "";
    for (var n = 13; n >= 1; n--) {
      var col = document.createElement("div");
      col.className = "seat-col" + (n === 13 ? " seat-col--rear" : "");

      var label = document.createElement("span");
      label.className = "seat-col__n";
      label.textContent = String(n);
      col.appendChild(label);

      var stack = document.createElement("div");
      stack.className = "seat-col__stack";

      if (n <= 11) {
        stack.appendChild(seatEl(4 * n - 3));
        stack.appendChild(seatEl(4 * n - 2));
        stack.appendChild(aisleEl());
        stack.appendChild(seatEl(4 * n));
        stack.appendChild(seatEl(4 * n - 1));
      } else if (n === 12) {
        stack.appendChild(seatEl(45));
        stack.appendChild(seatEl(46));
        stack.appendChild(aisleEl());
      } else {
        stack.appendChild(seatEl(49));
        stack.appendChild(seatEl(50));
        stack.appendChild(seatEl(51));
        stack.appendChild(seatEl(48));
        stack.appendChild(seatEl(47));
      }

      col.appendChild(stack);
      seatCols.appendChild(col);
    }
  }

  function onSeatClick(e) {
    var seat = e.currentTarget;
    var n = Number(seat.dataset.seat);
    if (seat.classList.contains("is-man") || seat.classList.contains("is-woman")) {
      toast("Место " + n + " уже занято — выберите другое");
      return;
    }
    var idx = state.seats.indexOf(n);
    if (idx > -1) {
      state.seats.splice(idx, 1);
    } else {
      if (state.seats.length >= state.pax) {
        toast(
          "Выбрано мест: " + state.seats.length + " из " + state.pax +
            ". Сначала снимите одно из них."
        );
        return;
      }
      state.seats.push(n);
      state.seats.sort(function (a, b) {
        return a - b;
      });
    }
    renderSeatState();
  }

  function renderSeatState() {
    $$(".seat", seatCols).forEach(function (s) {
      s.classList.toggle("is-selected", state.seats.indexOf(Number(s.dataset.seat)) > -1);
    });
    var sel = state.seats.length;
    $("#cntSel").textContent = String(sel);
    $("#cntFree").textContent = String(45 - sel);
    $("#cntMan").textContent = String(MAN_SEATS.length);
    $("#cntWoman").textContent = String(WOMAN_SEATS.length);
    $("#needSel").textContent = String(Math.max(state.pax - sel, 0));
    $("#seatPicked").textContent = sel
      ? "Места: " + state.seats.join(", ")
      : "Места не выбраны";
  }

  /* ---------------------------------------------------- trip pick */
  function fillTripBar(trip) {
    $("#s2Route").innerHTML = "";
    $("#s2Route").append(trip.dataset.from, " ");
    var a1 = document.createElement("i");
    a1.className = "ph ph-arrow-right";
    $("#s2Route").append(a1, " " + trip.dataset.to);
    $("#s2Terminals").textContent =
      trip.dataset.termFrom + "  →  " + trip.dataset.termTo;
    $("#s2Date").textContent = trip.dataset.date;
    $("#s2Times").textContent = trip.dataset.dep + " — " + trip.dataset.arr;
    $("#s2Bus").textContent = trip.dataset.bus;
    $("#s2Class").textContent = trip.dataset.class;
  }

  document.addEventListener("click", function (e) {
    var pick = e.target.closest(".trip__pick");
    if (!pick) return;
    var trip = pick.closest(".trip");
    state.trip = trip;
    state.price = Number(trip.dataset.price);
    state.seats = [];
    fillTripBar(trip);
    renderSeatState();
    goToStep(2);
  });

  /* ---------------------------------------------------- passengers */
  var paxList = $("#paxList");

  function renderPassengers() {
    paxList.innerHTML = "";
    for (var i = 0; i < state.pax; i++) {
      var seat = state.seats[i] || "—";
      var card = document.createElement("div");
      card.className = "pax-card";
      card.innerHTML =
        '<div class="pax-card__head">' +
          '<div class="pax-card__who">' +
            '<span class="pax-card__n">' + (i + 1) + "</span>" +
            "<div><b>Пассажир " + (i + 1) + "</b><span>Данные документа</span></div>" +
          "</div>" +
          '<span class="pax-seat"><i class="ph ph-armchair"></i>Место ' + seat + "</span>" +
        "</div>" +
        '<div class="pax-grid">' +
          '<label class="inp"><span>Имя</span><input type="text" id="paxName' + i + '" placeholder="Джасур" /></label>' +
          '<label class="inp"><span>Фамилия</span><input type="text" id="paxLast' + i + '" placeholder="Каримов" /></label>' +
          '<label class="inp"><span>Номер паспорта / ID</span><input type="text" id="paxId' + i + '" placeholder="АВ1234567" /></label>' +
          '<label class="inp"><span>Дата рождения</span><input type="text" id="paxBirth' + i + '" placeholder="14.03.1994" /></label>' +
          '<label class="inp"><span>Телефон</span><input type="text" id="paxPhone' + i + '" placeholder="+998 90 123 45 67" /></label>' +
          '<div class="gender"><span>Пол</span><div class="gender__seg">' +
            '<button type="button" class="gender__btn is-active" data-gender="М"><i class="ph ph-gender-male"></i>Мужской</button>' +
            '<button type="button" class="gender__btn" data-gender="Ж"><i class="ph ph-gender-female"></i>Женский</button>' +
          "</div></div>" +
        "</div>";
      paxList.appendChild(card);
    }

    $$(".gender__btn", paxList).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var seg = btn.closest(".gender__seg");
        $$(".gender__btn", seg).forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
      });
    });

    $$("input", paxList).forEach(function (inp) {
      inp.addEventListener("input", function () {
        inp.classList.remove("is-invalid");
      });
    });
  }

  function paxData(i) {
    var name = ($("#paxName" + i) || {}).value || "";
    var last = ($("#paxLast" + i) || {}).value || "";
    var id = ($("#paxId" + i) || {}).value || "";
    var phone = ($("#paxPhone" + i) || {}).value || "";
    var nameFull = (name + " " + last).trim();
    return {
      name: nameFull || "Пассажир " + (i + 1),
      id: id || "АВ1234567",
      phone: phone || "+998 90 000 00 00",
      seat: state.seats[i] || "—"
    };
  }

  function fillStep3() {
    var t = state.trip.dataset;
    $("#s3Route").textContent = t.from + " → " + t.to;
    $("#s3Terminals").textContent = t.termFrom + " → " + t.termTo;
    $("#s3Date").textContent = t.date;
    $("#s3Dep").textContent = t.dep;
    $("#s3Arr").textContent = t.arr;
    $("#s3Bus").textContent = t.bus + " · " + t.class;

    var wrap = $("#s3Seats");
    wrap.innerHTML = "";
    state.seats.forEach(function (s) {
      var b = document.createElement("span");
      b.className = "seat-tag";
      b.textContent = "№ " + s;
      wrap.appendChild(b);
    });

    $("#s3PriceLabel").textContent =
      state.pax + " " + plural(state.pax, ["место", "места", "мест"]) +
      " × " + money(state.price) + " UZS";
    $("#s3Price").textContent = money(state.price * state.pax);
    $("#s3Total").textContent = money(state.price * state.pax) + " UZS";
  }

  $("#toPassengers").addEventListener("click", function () {
    if (state.seats.length !== state.pax) {
      toast(
        "Нужно выбрать " + state.pax + " " +
          plural(state.pax, ["место", "места", "мест"]) +
          ", выбрано: " + state.seats.length
      );
      return;
    }
    if (!state.trip) {
      toast("Сначала выберите рейс");
      return;
    }
    renderPassengers();
    fillStep3();
    goToStep(3);
  });

  /* ---------------------------------------------------- payment */
  $("#toPayment").addEventListener("click", function () {
    var inputs = $$("#paxList input");
    var bad = inputs.filter(function (inp) { return !inp.value.trim(); });
    inputs.forEach(function (inp) {
      inp.classList.toggle("is-invalid", !inp.value.trim());
    });
    if (bad.length) {
      bad[0].focus();
      bad[0].scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center"
      });
      toast("Заполните данные всех пассажиров");
      return;
    }

    var t = state.trip.dataset;
    $("#s4Route").textContent = t.from + " → " + t.to;
    $("#s4Date").textContent = t.date + " · " + t.dep;

    var lines = $("#orderLines");
    lines.innerHTML = "";
    for (var i = 0; i < state.pax; i++) {
      var p = paxData(i);
      var li = document.createElement("li");
      li.innerHTML =
        '<span class="ol-who"><span class="ol-seat">' + p.seat + '</span>' +
        '<span class="ol-name"></span></span><b>' + money(state.price) + "</b>";
      li.querySelector(".ol-name").textContent =
        p.name + " · место № " + p.seat;
      lines.appendChild(li);
    }

    var total = state.price * state.pax;
    $("#s4Total").textContent = money(total) + " UZS";
    $("#payBtnLabel").textContent = "Оплатить " + money(total) + " UZS";
    goToStep(4);
  });

  $$("#payMethods .pay-method").forEach(function (m) {
    m.addEventListener("click", function () {
      $$("#payMethods .pay-method").forEach(function (x) {
        x.classList.toggle("is-active", x === m);
      });
      var isCard = m.querySelector("input").value === "card";
      $("#payCard").hidden = !isCard;
      $("#payApp").hidden = isCard;
    });
  });

  /* ---------------------------------------------------- QR */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeQr(el, seed) {
    var N = 25;
    var rndState = hashStr(seed) || 1;
    var rnd = function () {
      rndState = (rndState * 1664525 + 1013904223) >>> 0;
      return rndState / 4294967296;
    };
    el.style.gridTemplateColumns = "repeat(" + N + ", 1fr)";

    var grid = [];
    var r, c;
    for (r = 0; r < N; r++) {
      grid[r] = [];
      for (c = 0; c < N; c++) grid[r][c] = 0;
    }

    var finder = function (row, col) {
      for (var i = -1; i <= 7; i++) {
        for (var j = -1; j <= 7; j++) {
          var rr = row + i;
          var cc = col + j;
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
          if (i < 0 || j < 0 || i > 6 || j > 6) {
            grid[rr][cc] = 0;
          } else {
            grid[rr][cc] =
              i === 0 || i === 6 || j === 0 || j === 6 ||
              (i >= 2 && i <= 4 && j >= 2 && j <= 4) ? 1 : 0;
          }
        }
      }
    };

    finder(0, 0);
    finder(0, N - 7);
    finder(N - 7, 0);

    for (c = 8; c < N - 8; c++) grid[6][c] = c % 2 === 0 ? 1 : 0;
    for (r = 8; r < N - 8; r++) grid[r][6] = r % 2 === 0 ? 1 : 0;

    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        if ((r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8)) continue;
        if (r === 6 || c === 6) continue;
        grid[r][c] = rnd() > 0.52 ? 1 : 0;
      }
    }

    var frag = document.createDocumentFragment();
    for (r = 0; r < N; r++) {
      for (c = 0; c < N; c++) {
        var cell = document.createElement("i");
        if (grid[r][c]) cell.className = "on";
        frag.appendChild(cell);
      }
    }
    el.appendChild(frag);
  }

  /* ---------------------------------------------------- ticket */
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildTickets() {
    var t = state.trip.dataset;
    var total = state.price * state.pax;
    var wrap = $("#tickets");
    wrap.innerHTML = "";
    $("#okSum").textContent = money(total) + " UZS";

    var fromCity = t.from;
    var toCity = t.to;
    var fromTerm = t.termFrom.split(", ").slice(1).join(", ") || t.termFrom;
    var toTerm = t.termTo.split(", ").slice(1).join(", ") || t.termTo;
    var fromAddr = placeAddr(t.termFrom);
    var toAddr = placeAddr(t.termTo);
    var busNo = (t.bus.split("·")[0] || "").replace("Рейс", "").trim() || t.bus;

    for (var i = 0; i < state.pax; i++) {
      var p = paxData(i);
      var booking = "TS-" + busNo.replace(/\s/g, "") + "-" + String(i + 1).padStart(2, "0");
      var art = document.createElement("article");
      art.className = "ticket";
      art.innerHTML =
        '<div class="ticket__main">' +
          '<div class="ticket__top">' +
            '<span class="ticket__brand"><i class="ph ph-bus"></i>ticketsale.uz · Автобус</span>' +
            '<span class="ticket__no">Номер брони: <b></b></span>' +
          "</div>" +
          '<div class="ticket__route">' +
            '<div class="ticket__point"><b></b><span class="tk-city-a"></span><em class="tk-term-a"></em></div>' +
            '<div class="ticket__arrow"><em class="tk-dur"></em><i class="ph ph-bus"></i></div>' +
            '<div class="ticket__point ticket__point--right"><b></b><span class="tk-city-b"></span><em class="tk-term-b"></em></div>' +
          "</div>" +
          '<div class="ticket__grid">' +
            '<div class="tcell"><span>Дата</span><b class="tk-date"></b></div>' +
            '<div class="tcell"><span>Отправление</span><b class="tk-dep"></b></div>' +
            '<div class="tcell"><span>Рейс / автобус</span><b class="tk-bus"></b></div>' +
            '<div class="tcell tcell--seat"><span>Место</span><b class="tk-seat"></b></div>' +
          "</div>" +
          '<div class="ticket__pax">' +
            '<div class="ticket__pax-item"><i></i><div><b class="tk-name"></b><span class="tk-id"></span></div></div>' +
            '<div class="ticket__pax-item"><i class="ph ph-phone" style="background:#f1f6ff"></i><div><b class="tk-phone"></b><span>Контакт для связи</span></div></div>' +
            '<div class="ticket__pax-item"><i class="ph ph-clock" style="background:#fff5e6"></i><div><b class="tk-arr"></b><span>Прибытие по расписанию</span></div></div>' +
          "</div>" +
        "</div>" +
        '<div class="ticket__side">' +
          '<div class="qr"></div>' +
          "<small>Покажите QR-код проводнику<br>при посадке<b></b></small>" +
          '<span class="ticket__side-stub"><i class="ph ph-check-circle"></i>Оплачено</span>' +
        "</div>";

      art.querySelector(".ticket__no b").textContent = booking;
      var pts = art.querySelectorAll(".ticket__point");
      pts[0].querySelector("b").textContent = t.dep;
      pts[1].querySelector("b").textContent = t.arr;
      art.querySelector(".tk-city-a").textContent = fromCity;
      art.querySelector(".tk-city-b").textContent = toCity;
      art.querySelector(".tk-term-a").textContent = fromTerm + (fromAddr ? ", " + fromAddr : "");
      art.querySelector(".tk-term-b").textContent = toTerm + (toAddr ? ", " + toAddr : "");
      art.querySelector(".tk-dur").textContent = t.dur;
      art.querySelector(".tk-date").textContent = t.date;
      art.querySelector(".tk-dep").textContent = t.dep + " · " + t.dur;
      art.querySelector(".tk-bus").textContent = t.bus;
      art.querySelector(".tk-seat").textContent = "№ " + p.seat;
      art.querySelector(".ticket__pax-item i").textContent = String(i + 1);
      art.querySelector(".tk-name").textContent = p.name;
      art.querySelector(".tk-id").textContent = "Паспорт / ID: " + p.id;
      art.querySelector(".tk-phone").textContent = p.phone;
      art.querySelector(".tk-arr").textContent = t.arr;
      art.querySelector(".ticket__side small b").textContent = booking;
      art.querySelector(".ticket__side-stub").append(" " + money(state.price) + " UZS");

      makeQr(art.querySelector(".qr"), booking + p.name + p.seat);
      wrap.appendChild(art);
    }
  }

  var payBtn = $("#payBtn");
  payBtn.addEventListener("click", function () {
    if (payBtn.classList.contains("is-loading")) return;
    payBtn.classList.add("is-loading");
    $("#payBtnLabel").textContent = "Обрабатываем…";
    setTimeout(function () {
      payBtn.classList.remove("is-loading");
      buildTickets();
      goToStep(5);
      toast("Оплата успешна — билеты готовы");
    }, 1100);
  });

  $("#dlAll").addEventListener("click", function () {
    toast("Демо-режим: PDF со всеми билетами будет скачан");
  });
  $("#printAll").addEventListener("click", function () {
    toast("Демо-режим: откроется окно печати");
  });

  $("#headerSearch").addEventListener("click", function () {
    goToStep(1);
    setTimeout(function () {
      $("#fromPlace").focus();
      $("#fromPlace").select();
    }, reduceMotion ? 0 : 450);
  });

  /* ---------------------------------------------------- init */
  buildSeatMap();
  renderPax();
  renderSeatState();
})();
