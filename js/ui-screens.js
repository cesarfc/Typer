// ============================================================
// TypeQuest — UI (menu screens): dex, museum (trophies, diplomas,
// stats, hiccups), journal, Family Trading Post, My Words packs and
// the Typing License. Extends the UI object from ui.js (loaded first).
// ============================================================
Object.assign(UI, {

  // ---------- Family Trading Post ----------
  // Two family trainers swap one Pokemon each on a single shared device. The
  // whole trade is rebuilt from live save data on open, so deleting a profile
  // elsewhere can never corrupt a half-built swap. Nothing is written until the
  // both-agree confirm; cancelling is always free.
  openTradePost() {
    if (!Object.keys(SAVE.state.dex).length) {
      this.toast("🤝 Catch a Pokemon first — then you'll have something to trade!");
      return;
    }
    const partners = SAVE.tradePartners();
    if (!partners.length) {
      this.toast("🤝 Ask a family member to make a trainer and catch a Pokemon — then you can trade together!");
      return;
    }
    this._trade = { partnerPid: null, mine: null, theirs: null, stage: "partner" };
    this.renderTrade();
  },

  closeTradePanel() {
    this._trade = null;
    this.$("trade-panel").classList.add("hidden");
  },

  // one owned Pokemon as a selectable tile in an offer column
  tradeMonTile(c, side, sel) {
    return `<button class="trade-mon ${sel ? "sel" : ""}" data-side="${side}" data-key="${c.key}"
      title="${this.esc(c.n)}">
      <span class="tm-sprite">${this.pokeHtml(c.id, c.e, { shiny: c.shiny })}</span>
      <span class="tm-name">${c.shiny ? "✨" : ""}${this.esc(c.n)}</span></button>`;
  },

  renderTrade() {
    const panel = this.$("trade-panel");
    const T = this._trade;
    if (!T) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    const close = `<button id="trade-close" aria-label="Close">✕</button>`;

    // --- stage 1: pick a family trainer to trade with (rebuilt every open) ---
    if (T.stage === "partner") {
      const partners = SAVE.tradePartners();
      if (!partners.length) { this.closeTradePanel(); return; }
      const cards = partners.map(p => `<button class="trade-partner" data-pid="${p.pid}">
        <span class="tp-av">${this.avatarHtml({ avatar: p.avatar, trainer: p.trainer })}</span>
        <span class="tp-info"><b>${this.esc(p.name)}</b><i>🐾 ${p.count}</i></span></button>`).join("");
      panel.innerHTML = `<div class="trade-card">${close}
        <h3>🤝 Trading Post</h3>
        <p class="trade-sub">Pick a family trainer to trade with:</p>
        <div class="trade-partners">${cards}</div></div>`;
      return;
    }

    const partner = SAVE.root.players[T.partnerPid];
    // a partner deleted mid-trade drops us safely back to the picker
    if (!partner) { T.stage = "partner"; T.partnerPid = T.mine = T.theirs = null; this.renderTrade(); return; }
    const myName = SAVE.state.profile.name;

    // --- stage 3: the both-agree ritual ---
    if (T.stage === "confirm") {
      const mine = SAVE.creatureByKey(T.mine);
      const theirs = (() => { const [w, i] = T.theirs.split("-").map(Number); const c = CREATURES[w][i];
        return { ...c, w, i, key: T.theirs, shiny: !!partner.dex[T.theirs].shiny }; })();
      panel.innerHTML = `<div class="trade-card">${close}
        <div class="trade-ritual">
          <div class="tr-face"><span class="tr-av">${this.avatarHtml(SAVE.state.profile)}</span><b>${this.esc(myName)}</b></div>
          <span class="tr-hands">🤝</span>
          <div class="tr-face"><span class="tr-av">${this.avatarHtml(partner.profile)}</span><b>${this.esc(partner.profile.name)}</b></div>
        </div>
        <p class="trade-ask">Do you <b>BOTH</b> agree to trade<br>
          <span class="tr-mon">${this.pokeHtml(mine.id, mine.e, { shiny: mine.shiny })} ${mine.shiny ? "✨" : ""}${this.esc(mine.n)}</span>
          for
          <span class="tr-mon">${this.pokeHtml(theirs.id, theirs.e, { shiny: theirs.shiny })} ${theirs.shiny ? "✨" : ""}${this.esc(theirs.n)}</span>?</p>
        <button id="trade-go" class="big-btn trade-go">✅ Yes — trade!</button>
        <button id="trade-cancel" class="link-btn">not yet — go back</button></div>`;
      return;
    }

    // --- stage 4: the celebration after a completed swap ---
    if (T.stage === "done") {
      const got = T.gotCreature, gave = T.gaveCreature;
      panel.innerHTML = `<div class="trade-card trade-done-card">${close}
        <div class="trade-balls"><span class="trade-ball tb-l">${this.ballHtml()}</span><span class="trade-ball tb-r">${this.ballHtml()}</span></div>
        <h3>🤝 Trade complete!</h3>
        <div class="trade-done">
          <div class="td-mon"><span>${this.pokeHtml(got.id, got.e, { shiny: got.shiny })}</span>
            <b>${got.shiny ? "✨" : ""}${this.esc(got.n)}</b><i>joined your team!</i></div>
        </div>
        <p class="trade-sub">You sent ${this.esc(gave.n)} to ${this.esc(partner.profile.name)}. Best friends! 🤝</p>
        <button id="trade-done-ok" class="big-btn">🎉 Yay!</button></div>`;
      return;
    }

    // --- stage 2: each side picks exactly one Pokemon to offer ---
    const myList = SAVE.dexList(SAVE.root.active);
    const theirList = SAVE.dexList(T.partnerPid);
    const col = (title, list, side, selKey) => `<div class="trade-col">
      <h4>${this.esc(title)}</h4>
      <div class="trade-grid">${list.map(c => this.tradeMonTile(c, side, c.key === selKey)).join("")}</div></div>`;
    const ready = T.mine && T.theirs;
    const chosen = (key, list) => { const c = list.find(x => x.key === key); return c
      ? `${this.pokeHtml(c.id, c.e, { shiny: c.shiny })} ${c.shiny ? "✨" : ""}${this.esc(c.n)}` : "<i>pick one</i>"; };
    panel.innerHTML = `<div class="trade-card trade-offer-card">${close}
      <h3>🤝 ${this.esc(myName)} &amp; ${this.esc(partner.profile.name)}</h3>
      <p class="trade-sub">Each trainer picks ONE Pokemon to offer.</p>
      <div class="trade-cols">
        ${col("Your offer", myList, "mine", T.mine)}
        ${col(`${partner.profile.name}'s offer`, theirList, "theirs", T.theirs)}
      </div>
      <div class="trade-summary">
        <span class="ts-side">${chosen(T.mine, myList)}</span>
        <span class="ts-swap">🔁</span>
        <span class="ts-side">${chosen(T.theirs, theirList)}</span>
      </div>
      <div class="trade-actions">
        <button id="trade-back" class="link-btn">← partners</button>
        <button id="trade-next" class="big-btn ${ready ? "" : "disabled"}" ${ready ? "" : "disabled"}>Trade ▶</button>
      </div></div>`;
  },

  // run the confirmed swap, then celebrate
  doTrade() {
    const T = this._trade;
    if (!T || !T.partnerPid || !T.mine || !T.theirs) return;
    const partner = SAVE.root.players[T.partnerPid];
    if (!partner) { T.stage = "partner"; this.renderTrade(); return; }
    // capture display info BEFORE the swap moves the shiny flags around
    const gave = SAVE.creatureByKey(T.mine);
    const [tw, ti] = T.theirs.split("-").map(Number);
    const got = { ...CREATURES[tw][ti], id: CREATURES[tw][ti].id, key: T.theirs, shiny: !!partner.dex[T.theirs].shiny };
    const res = SAVE.executeTrade(T.partnerPid, T.mine, T.theirs);
    if (!res.ok) { this.toast("🤝 That trade could not be completed — nothing changed."); this.closeTradePanel(); return; }
    T.stage = "done";
    T.gotCreature = got;
    T.gaveCreature = gave;
    this.renderTrade();
    SFX.catchJingle();
    this.confetti();
    this.toast(`🤝 You traded <b>${this.esc(gave.n)}</b> and got <b>${got.shiny ? "✨" : ""}${this.esc(got.n)}</b>!`, "gold");
    (res.myTrophies || []).forEach((t, i) => setTimeout(() => this.trophyToast(t), 700 + i * 800));
    // refresh everything the trade touched so it's fresh when the panel closes
    this.renderPartyBar();
    if (this.current === "map") this.renderMap();
  },

  // ---------- dex ----------
  renderDex() {
    const total = CREATURES.flat().length;
    this.$("dex-count").textContent = `${SAVE.caughtCount()} / ${total}`;
    this.$("dex-list").innerHTML = WORLDS.map((w, wi) => {
      const cards = CREATURES[wi].map((c, ci) => {
        const key = `${wi}-${ci}`;
        const got = SAVE.state.dex[key];
        const rar = RARITY[c.r];
        if (!got) {
          // evolution-only Pokemon hint at how to get them
          const fam = c.evoOnly ? EVOLUTIONS.find(f =>
            (f.chain || f.choices || []).includes(key)) : null;
          const hint = fam ? `evolves from ${this.esc(CREATURES[fam.base.split("-")[0]][fam.base.split("-")[1]].n)}` : "???";
          return `<div class="dex-card unknown"><div class="dex-emoji">${this.pokeHtml(c.id, c.e)}</div>
            <div class="dex-name ${fam ? "evo-hint" : ""}">${hint}</div>${fam ? "" : this.whereLine(wi, ci)}</div>`;
        }
        const candy = SAVE.state.candy[key] || 0;
        const fam = SAVE.familyFor(key);
        const targets = SAVE.evoTargetsFor(key);
        const candyHtml = fam
          ? `<div class="dex-candy">🍬 ${candy}/${CANDY_COST}${
              SAVE.state.vouchers > 0 ? ` <button class="btn-voucher" data-vbase="${key}" title="Spend a candy voucher here">🎟+1</button>` : ""
            }</div>` : "";
        const evoBtn = targets.length
          ? `<button class="btn-evolve" data-base="${key}">EVOLVE!</button>` : "";
        const inParty = SAVE.state.party.includes(key);
        const partyBtn = `<button class="btn-party ${inParty ? "on" : ""}" data-pkey="${key}"
          title="${inParty ? "Remove from party" : "Add to party"}">${inParty ? "✔ Party" : "+ Party"}</button>`;
        return `<div class="dex-card ${got.shiny ? "shiny" : ""}" style="--rc:${rar.color}">${partyBtn}
          <div class="dex-emoji">${this.pokeHtml(c.id, c.e, { shiny: got.shiny })}</div>
          <div class="dex-name">${got.shiny ? "✨" : ""}${this.esc(c.n)}</div>
          <div class="dex-rar">${rar.label}</div>${this.whereLine(wi, ci)}${candyHtml}${evoBtn}</div>`;
      }).join("");
      const caught = CREATURES[wi].filter((c, ci) => SAVE.state.dex[`${wi}-${ci}`]).length;
      return `<div class="dex-world"><h3>${w.emoji} ${w.name} <span>${caught}/${CREATURES[wi].length}</span></h3><div class="dex-grid">${cards}</div></div>`;
    }).join("");
  },

  // pick which evolution (only Eevee has a real choice)
  evoChooser(baseKey, targets) {
    const box = this.$("evo-chooser");
    const base = CREATURES[baseKey.split("-")[0]][baseKey.split("-")[1]];
    box.innerHTML = `<div class="pause-box">
      <h2>🧬 Evolve ${this.esc(base.n)} into...</h2>
      <div class="evo-options">${targets.map(k => {
        const [tw, ti] = k.split("-").map(Number);
        const t = CREATURES[tw][ti];
        const owned = SAVE.state.dex[k];
        return `<button class="evo-opt" data-base="${baseKey}" data-target="${k}">
          <span class="evo-opt-img ${owned ? "" : "unknown"}">${this.pokeHtml(t.id, t.e)}</span>
          <b>${this.esc(t.n)}</b>${owned ? `<i>${owned.shiny ? "make it stronger" : "make it ✨ shiny"}</i>` : ""}
        </button>`;
      }).join("")}</div>
      <button id="evo-cancel" class="link-btn">never mind</button>
    </div>`;
    box.classList.remove("hidden");
  },

  // ---- My Words: list custom spelling packs as playable tier-cards, each with
  // edit/delete, plus a "New word pack" card that opens the form. ----
  renderWordPacks() {
    const list = this.$("wordpack-list");
    if (!list) return;
    const packs = SAVE.wordPacks();
    let html = packs.map(pk => {
      const pb = SAVE.state.practice["custom-" + pk.id];
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : `no record yet — set one!`;
      const card = `<button class="tier-card wordpack-card" data-pack="${this.esc(pk.id)}">
        <span class="tier-e">📚</span>
        <span class="tier-info">
          <b>${this.esc(pk.name)}</b>
          <i>${pk.words.length} word${pk.words.length === 1 ? "" : "s"}</i>
          <em>${pbHtml}</em>
        </span>
      </button>`;
      const actions = `<div class="wp-actions">
        <button class="wp-edit" data-pack="${this.esc(pk.id)}" title="Edit this pack">✏️ Edit</button>
        <button class="wp-del" data-pack="${this.esc(pk.id)}" title="Delete this pack">🗑️</button>
      </div>`;
      return `<div class="tier-wrap"><div class="wordpack-row">${card}${actions}</div>${this.ghostRaceHtml("pack", pk.name, pb)}</div>`;
    }).join("");

    if (packs.length < WORDPACK_MAX) {
      html += `<button class="tier-card wordpack-new" data-newpack="1">
        <span class="tier-e">➕</span>
        <span class="tier-info"><b>New word pack</b><i>Turn a spelling list into a drill</i></span>
      </button>`;
    } else {
      html += `<p class="wordpack-full">📚 You have all ${WORDPACK_MAX} word packs — delete one to add more.</p>`;
    }
    list.innerHTML = html;
  },

  // open the create/edit form. packId null → create; otherwise prefill for edit.
  openWordPackForm(packId) {
    SFX.click();
    const form = this.$("wordpack-form");
    const pack = packId ? SAVE.wordPackById(packId) : null;
    const name = pack ? pack.name : "";
    const words = pack ? pack.words.join("\n") : "";
    form.dataset.editing = packId || "";
    form.innerHTML = `
      <div class="wp-form-inner">
        <h4>${pack ? "✏️ Edit word pack" : "📚 New word pack"}</h4>
        <label class="wp-field">
          <span>Pack name</span>
          <input id="wp-name" type="text" maxlength="${WORDPACK_NAME_MAXLEN}" placeholder="e.g. Week 12 Spelling" value="${this.esc(name)}">
        </label>
        <label class="wp-field">
          <span>Words — one per line (up to ${WORDPACK_WORDS_MAX})</span>
          <textarea id="wp-words" rows="7" placeholder="friend\nbecause\nlittle\n...">${this.esc(words)}</textarea>
        </label>
        <p class="wp-hint">Letters, spaces, and . , ' ! ? are welcome. Capitals are fine!</p>
        <div id="wp-error" class="wp-error hidden"></div>
        <div class="wp-form-btns">
          <button id="wp-save" class="btn primary">💾 Save pack</button>
          <button id="wp-cancel" class="btn">Cancel</button>
        </div>
      </div>`;
    form.classList.remove("hidden");
    this.$("wp-save").addEventListener("click", () => this.saveWordPackForm());
    this.$("wp-cancel").addEventListener("click", () => this.closeWordPackForm());
    const nameEl = this.$("wp-name");
    nameEl.focus();
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },

  closeWordPackForm() {
    SFX.click();
    const form = this.$("wordpack-form");
    form.classList.add("hidden");
    form.innerHTML = "";
    form.dataset.editing = "";
  },

  saveWordPackForm() {
    const form = this.$("wordpack-form");
    const editing = form.dataset.editing || null;
    const name = this.$("wp-name").value;
    const words = this.$("wp-words").value;
    const res = SAVE.saveWordPack(editing, name, words);
    if (!res.ok) {
      SFX.error();
      const err = this.$("wp-error");
      err.textContent = res.error;
      err.classList.remove("hidden");
      return;
    }
    SFX.word();
    this.closeWordPackForm();
    this.renderWordPacks();
    this.toast(editing ? `📚 Updated “${res.pack.name}”!` : `📚 New pack “${res.pack.name}” ready — go practice!`, "gold");
  },

  deleteWordPackFlow(packId) {
    const pack = SAVE.wordPackById(packId);
    if (!pack) return;
    if (!confirm(`Delete “${pack.name}”? Its best times go too, but any XP and trophies you earned stay yours. 💛`)) return;
    SAVE.deleteWordPack(packId);
    SFX.click();
    this.closeWordPackForm();
    this.renderWordPacks();
    this.toast(`📚 “${pack.name}” removed.`);
  },

  // ---- Typing License: post-Champion number-row exam. Shows a locked teaser
  // until you're Champion; then four stamp-collectible tiers that unlock in
  // order. License records live under practice["license-"+id] and share ghosts
  // across profiles via the "practice" kind (ids match, unlike word packs). ----
  renderLicense() {
    const list = this.$("license-list");
    if (!list) return;
    if (!SAVE.state.trophies.champion) {
      list.innerHTML = `<div class="license-teaser">🔒 Become the 👑 Champion first — then your Typing License opens!</div>`;
      return;
    }
    list.innerHTML = LICENSE_TIERS.map((t, i) => {
      const key = "license-" + t.id;
      const pb = SAVE.state.practice[key];
      const open = SAVE.licenseTierOpen(i);
      const stamped = !!(pb && pb.stamp);
      const pbHtml = pb
        ? `⏱ best ${this.fmtTime(pb.time)} · ⚡ best ${pb.wpm} wpm`
        : (open ? `no stamp yet — earn 90%!` : `🔒 finish the last tier to unlock`);
      const card = `<button class="tier-card license-card ${open ? "" : "locked"} ${stamped ? "stamped" : ""}" data-license="${t.id}" ${open ? "" : "disabled"}>
        <span class="tier-e">${t.e}</span>
        <span class="tier-info">
          <b>${t.label}${stamped ? " <span class=\"license-stamp\">🪪 STAMPED</span>" : ""}</b>
          <i>${this.esc(t.desc)}</i>
          <em>${pbHtml}</em>
        </span>
      </button>`;
      const race = open ? this.ghostRaceHtml("practice", key, pb) : "";
      return `<div class="tier-wrap">${card}${race}</div>`;
    }).join("");
  },

  // ---------- trophies ----------
  _museumTab: "trophies",
  _failCount: {},

  // ---------- Diplomas: printable certificates for the biggest milestones ----------
  DIPLOMAS: [
    { id: "champion", e: "🏆", title: "Champion of the Island",
      line: "defeated the Elite Four and became the Champion",
      earned: () => !!SAVE.state.trophies.champion,
      need: "Become the Champion to earn this one!" },
    { id: "puzzle-code", e: "💻", title: "Puzzle Master Coder",
      line: "earned a star on every coding stage in the Puzzle Lab",
      earned: () => !!SAVE.state.trophies["puzzle-code"],
      need: "Star every coding stage in the Puzzle Lab to earn this one!" },
    { id: "puzzle-math", e: "🔢", title: "Number Wizard",
      line: "earned a star on every math stage in the Puzzle Lab",
      earned: () => !!SAVE.state.trophies["puzzle-math"],
      need: "Star every math stage in the Puzzle Lab to earn this one!" },
    { id: "license-1", e: "🪪", title: "Licensed Typist",
      line: "earned all four Typing License stamps",
      earned: () => !!SAVE.state.trophies["license-1"],
      need: "Earn all four Typing License stamps to unlock this one!" },
    { id: "dex-all", e: "📕", title: "Pokedex Master",
      line: "caught every Pokemon in the Pokedex",
      earned: () => SAVE.caughtCount() >= CREATURES.flat().length,
      need: "Complete the whole Pokedex to earn this one!" },
  ],

  renderDiplomas() {
    this.$("diploma-wing").innerHTML = this.DIPLOMAS.map(d => {
      const got = d.earned();
      if (!got) {
        return `<div class="diploma-card locked">
          <div class="dip-seal dim">${d.e}</div>
          <div class="dip-info"><b>${this.esc(d.title)}</b>
            <i class="dip-need">🔒 ${this.esc(d.need)}</i></div>
        </div>`;
      }
      const date = SAVE.diplomaDate(d.id);
      const nice = this.diplomaNiceDate(date);
      return `<div class="diploma-card">
        <div class="dip-seal">${d.e}</div>
        <div class="dip-info"><b>${this.esc(d.title)}</b>
          <i>Earned ${nice}</i></div>
        <button class="dip-print" data-diploma="${d.id}">🖨️ Print</button>
      </div>`;
    }).join("");
  },

  diplomaNiceDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  },

  // build the certificate into #diploma-print, then hand off to the browser's
  // print dialog. @media print hides everything but the certificate.
  printDiploma(id) {
    const d = this.DIPLOMAS.find(x => x.id === id);
    if (!d || !d.earned()) return;
    const date = SAVE.diplomaDate(id);
    const p = SAVE.state.profile || {};
    const name = p.name || "Trainer";
    const party = (SAVE.state.party || []).map(k => SAVE.creatureByKey(k)).filter(Boolean);
    const partyHtml = party.length
      ? party.map(c => `<span class="dp-mon">${this.pokeHtml(c.id, c.e, { shiny: c.shiny, cls: "poke-img dp-mon-img" })}</span>`).join("")
      : "";
    this.$("diploma-print").innerHTML = `
      <div class="dp-cert">
        <div class="dp-inner">
          <div class="dp-logo">TypeQuest ⚡</div>
          <div class="dp-kicker">Certificate of Achievement</div>
          <div class="dp-seal-big">${d.e}</div>
          <div class="dp-cert-body">
            <span class="dp-line">This certifies that</span>
            <div class="dp-name">${this.esc(name)}</div>
            <span class="dp-line">has earned the rank of</span>
            <div class="dp-rank">${this.esc(d.title)}</div>
            <span class="dp-line">and ${this.esc(d.line)}.</span>
          </div>
          <div class="dp-trainer">${this.avatarHtml(p, "dp-av")}</div>
          ${partyHtml ? `<div class="dp-party-row"><span class="dp-party-label">My team</span><div class="dp-party">${partyHtml}</div></div>` : ""}
          <div class="dp-foot">
            <span>Awarded ${this.diplomaNiceDate(date)}</span>
            <span class="dp-sig">Professor Oak ✒️</span>
          </div>
        </div>
      </div>`;
    const trophies = SAVE.awardDiplomaPrint();
    window.print();
    if (this.current === "trophies") this.renderTrophies();
    trophies.forEach((t, i) => setTimeout(() => this.trophyToast(t), 500 + i * 800));
  },

  renderTrophies() {
    const got = SAVE.state.trophies;
    const fresh = (SAVE.state.flags && SAVE.state.flags.newTrophies) || {};
    this.$("trophy-count").textContent = `${Object.keys(got).length} / ${TROPHIES.length}`;

    // ---- ledger: every long-term collection at a glance ----
    const dexGot = SAVE.caughtCount(), dexAll = CREATURES.flat().length;
    const shiny = SAVE.shinyCount();
    let medals = 0;
    WORLDS.forEach((w, wi) => { medals += SAVE.worldMedal(wi); });
    const fams = EVOLUTIONS.filter(f => {
      if (!SAVE.state.dex[f.base]) return false;
      const links = f.chain || f.choices;
      return f.choices ? links.some(k => SAVE.state.dex[k]) : links.every(k => SAVE.state.dex[k]);
    }).length;
    const rows = [
      { e: "🏆", label: "Trophies", n: Object.keys(got).length, max: TROPHIES.length },
      { e: "🎖", label: "Medals", n: medals, max: WORLDS.length * 4 },
      { e: "📕", label: "Pokedex", n: dexGot, max: dexAll, link: "dex" },
      { e: "✨", label: "Shinies", n: shiny, max: dexAll },
      { e: "🧬", label: "Families", n: fams, max: EVOLUTIONS.length },
    ];
    this.$("museum-ledger").innerHTML = rows.map(r => {
      const pct = r.n / r.max;
      const segs = 20, fill = Math.round(pct * segs);
      const closing = pct >= 0.9 && r.n < r.max;
      return `<div class="ledger-row">
        <span class="ledger-label">${r.e} ${r.label}</span>
        <span class="ledger-meter">${Array.from({ length: segs }, (_, i) =>
          `<i class="${i < fill ? "on" : ""}"></i>`).join("")}</span>
        <span class="ledger-count ${closing ? "closing" : ""}">${closing
          ? `${r.max - r.n} to find! ${r.link ? `<button class="ledger-link" data-link="${r.link}">show me</button>` : ""}`
          : `${r.n} / ${r.max}`}</span>
      </div>`;
    }).join("");

    // ---- tabs ----
    document.querySelectorAll("#museum-tabs .mtab").forEach(b =>
      b.classList.toggle("active", b.dataset.tab === this._museumTab));
    this.$("trophy-grid").classList.toggle("hidden", this._museumTab !== "trophies");
    this.$("medal-wing").classList.toggle("hidden", this._museumTab !== "medals");
    this.$("diploma-wing").classList.toggle("hidden", this._museumTab !== "diplomas");
    this.$("gallery-wing").classList.toggle("hidden", this._museumTab !== "gallery");
    if (this._museumTab === "diplomas") this.renderDiplomas();

    // ---- trophies wing ----
    this.$("trophy-grid").innerHTML = TROPHIES.map(t => `
      <div class="trophy-card ${got[t.id] ? "on" : ""}">
        ${fresh[t.id] ? `<span class="new-chip">NEW</span>` : ""}
        <div class="trophy-emoji">${t.e}</div>
        <div class="trophy-name">${t.name}</div>
        <div class="trophy-desc">${t.desc}</div>
      </div>`).join("");
    if (this._museumTab === "trophies" && SAVE.state.flags && Object.keys(fresh).length) {
      SAVE.state.flags.newTrophies = {};
      SAVE.save();
    }

    // ---- medal wing: per region, what the next medal needs ----
    this.$("medal-wing").innerHTML = WORLDS.map((w, wi) => {
      const tier = SAVE.worldMedal(wi);
      const unlocked = SAVE.worldUnlocked(wi);
      let nextLine = "";
      if (!unlocked) nextLine = `<i class="medal-next dim">🔒 Reach this region first</i>`;
      else if (tier >= 4) nextLine = `<i class="medal-next done">Fully mastered. Legendary work!</i>`;
      else {
        const t = MEDAL_TIERS[tier]; // the next tier up
        const p = SAVE.medalProgress(wi, t.tier);
        const req = t.tier === 1 ? "3-star every level"
          : t.tier === 4 ? "clear every level in 🥷 Ninja Mode (95%+ accuracy)"
          : `best ≥ ${Math.round(t.acc * 100)}% accuracy and ≥ ${t.wpm} wpm on every level`;
        nextLine = `<i class="medal-next">${t.e} ${t.name}: <b>${p.ok}/${p.total}</b> levels — ${req}</i>`;
      }
      return `<div class="medal-card ${tier ? "has" : ""}">
        <span class="medal-big">${tier ? MEDAL_E[tier] : "⚪"}</span>
        <div class="medal-info"><b>${w.emoji} ${this.esc(w.name)}</b>${nextLine}</div>
      </div>`;
    }).join("");

    // ---- gallery wing: Hall of Fame photos, then the shiny showcase ----
    const hof = (SAVE.state.hof || []).map(h => `
      <div class="hof-photo">
        <div class="hof-party">${(h.party || []).slice(0, 6).map(k => {
          const c = SAVE.creatureByKey(k);
          return c ? `<span>${this.pokeHtml(c.id, c.e, { shiny: c.shiny, cls: "poke-img hof-img" })}</span>` : "";
        }).join("")}</div>
        <div class="hof-plate">🏆 Hall of Fame — ${this.esc(SAVE.state.profile.name)}, ${h.date} · ${h.wpm} wpm</div>
      </div>`).join("");
    const hofShelf = hof ? `<div class="shelf"><div class="shelf-title">🏛️ Hall of Fame</div>${hof}</div>` : "";
    this.$("gallery-wing").innerHTML = hofShelf + WORLDS.map((w, wi) => {
      const shelf = CREATURES[wi].map((c, ci) => {
        const d = SAVE.state.dex[`${wi}-${ci}`];
        return `<span class="pedestal ${d && d.shiny ? "lit" : ""}" title="${d && d.shiny ? `✨ ${this.esc(c.n)}` : "Still to shine..."}">
          ${d && d.shiny ? this.pokeHtml(c.id, c.e, { shiny: true, cls: "poke-img shelf-img" }) : `<i>?</i>`}
        </span>`;
      }).join("");
      const n = CREATURES[wi].filter((c, ci) => {
        const d = SAVE.state.dex[`${wi}-${ci}`];
        return d && d.shiny;
      }).length;
      return `<div class="shelf"><div class="shelf-title">${w.emoji} ${this.esc(w.name)} <span>✨ ${n}/${CREATURES[wi].length}</span></div>
        <div class="shelf-row">${shelf}</div></div>`;
    }).join("");

    // received Professor's letters, replayable
    const letters = FEATURE_INTROS.filter(f => SAVE.state.flags.intros && SAVE.state.flags.intros[f.id]);
    if (letters.length) {
      this.$("museum-ledger").innerHTML += `<div class="letters-row">📬 Letters:
        ${letters.map(f => `<button class="letter-chip" data-letter="${f.id}">${f.icon} ${this.esc(f.title)}</button>`).join("")}</div>`;
    }
  },

  // ---------- stats ----------
  renderStats() {
    const s = SAVE.state.stats;
    const acc = s.keys ? Math.round(100 * s.correct / s.keys) : 100;
    this.$("stats-cards").innerHTML = `
      <div class="stat-card"><div class="stat-v">${s.bestWpm}</div><div class="stat-l">best words/min</div></div>
      <div class="stat-card"><div class="stat-v">${acc}%</div><div class="stat-l">accuracy</div></div>
      <div class="stat-card"><div class="stat-v">x${s.bestCombo}</div><div class="stat-l">best combo</div></div>
      <div class="stat-card"><div class="stat-v">${s.keys.toLocaleString()}</div><div class="stat-l">keys pressed</div></div>
      <div class="stat-card"><div class="stat-v">${SAVE.caughtCount()}</div><div class="stat-l">Pokemon</div></div>
      <div class="stat-card"><div class="stat-v">${s.evolutions || 0}</div><div class="stat-l">evolutions</div></div>
      <div class="stat-card"><div class="stat-v">${SAVE.state.streak.count || 0}</div><div class="stat-l">day streak</div></div>
      ${SAVE.state.tower && SAVE.state.tower.best ? `<div class="stat-card"><div class="stat-v">🗼 ${SAVE.state.tower.best}</div><div class="stat-l">best tower floor</div></div>` : ""}`;

    const hist = s.history.slice(-12);
    const max = Math.max(10, ...hist.map(h => h.wpm));
    this.$("stats-chart").innerHTML = hist.length
      ? hist.map(h => `<div class="bar-wrap" title="${h.wpm} wpm · ${Math.round(h.acc * 100)}%">
          <div class="bar" style="height:${Math.max(6, 100 * h.wpm / max)}%"></div><span>${h.wpm}</span></div>`).join("")
      : `<p class="dim">Play some levels to see your speed grow! 📈</p>`;

    // grown-ups corner: recent form + backup nudge
    const ps = this.$("parent-stats");
    if (ps) {
      const recent = s.history.slice(-7);
      const avgW = recent.length ? Math.round(recent.reduce((a, h) => a + h.wpm, 0) / recent.length) : 0;
      const avgA = recent.length ? Math.round(100 * recent.reduce((a, h) => a + h.acc, 0) / recent.length) : 0;
      let totalStars = 0;
      WORLDS.forEach((w, wi) => { totalStars += SAVE.worldStars(wi); });
      const sinceBackup = SAVE.state.xp - ((SAVE.state.flags && SAVE.state.flags.lastBackupXp) || 0);
      ps.innerHTML = recent.length
        ? `Recent form (last ${recent.length === 1 ? "game" : `${recent.length} games`}): <b>${avgW} wpm</b> at <b>${avgA}%</b> accuracy.<br>
           Total stars: <b>${totalStars}</b> · Pokemon: <b>${SAVE.caughtCount()}</b> · Day streak: <b>${SAVE.state.streak.count || 0}</b>.
           ${sinceBackup > 150 ? `<br><span class="backup-nudge">📥 Lots of new progress since the last backup — a download is wise!</span>` : ""}`
        : `No games played yet — the trend will appear here.`;
    }

    const entries = Object.entries(s.perKey)
      .map(([k, v]) => ({ k, total: v.ok + v.miss, acc: v.ok / (v.ok + v.miss) }))
      .filter(e => e.total >= 8);
    entries.sort((a, b) => b.acc - a.acc);
    const best = entries.slice(0, 3);
    const worst = entries.filter(e => e.acc < 0.97 && !best.includes(e)).slice(-3).reverse();
    this.$("stats-keys").innerHTML = entries.length
      ? `<div class="key-list"><h4>💪 Power keys</h4>${best.map(e =>
          `<span class="key-pill good">${this.esc(e.k)} ${Math.round(e.acc * 100)}%</span>`).join("")}</div>
         <div class="key-list"><h4>🎯 Train these</h4>${worst.length ? worst.map(e =>
          `<span class="key-pill bad">${this.esc(e.k)} ${Math.round(e.acc * 100)}%</span>`).join("")
          : `<span class="dim">No tricky keys — amazing! 🌟</span>`}</div>`
      : `<p class="dim">Type more to discover your power keys! 🔑</p>`;

    this.renderHiccups();
  },

  // grown-ups' "recent hiccups" list — a quiet, parent-only view of the rolling
  // error log (see Hiccups in main.js). Kids never see stack traces.
  renderHiccups() {
    const box = this.$("hiccups-list");
    if (!box || typeof Hiccups === "undefined") return;
    const items = Hiccups.list().slice().reverse(); // newest first
    box.innerHTML = items.length
      ? `<ul class="hiccup-list">${items.map(h => {
          const when = new Date(h.time);
          const stamp = isNaN(when) ? "" : when.toLocaleString();
          const where = h.src ? ` <span class="dim">(${this.esc(h.src)}${h.line ? ":" + h.line : ""})</span>` : "";
          return `<li><span class="dim">${this.esc(stamp)}</span> — ${this.esc(h.msg)}${where}</li>`;
        }).join("")}</ul>`
      : `<p class="dim">No hiccups — smooth sailing! ⛵</p>`;
    const clearBtn = this.$("hiccups-clear");
    if (clearBtn) {
      clearBtn.classList.toggle("hidden", items.length === 0);
      clearBtn.onclick = () => { Hiccups.clear(); this.renderHiccups(); this.toast("🧹 Cleared the hiccup list.", "gold"); };
    }
  },

  // ---------- Journal: daily drill, research board, Elite Four ----------
  renderJournal() {
    const d = SAVE.dailyInfo();
    const muts = d.mutators.map(id => DAILY_MUTATORS.find(m => m.id === id)).filter(Boolean);
    const wk = SAVE.state.dailyWeek && SAVE.state.dailyWeek.week === SAVE.weekKey()
      ? SAVE.state.dailyWeek.count : 0;
    this.$("jr-daily").innerHTML = `
      <h3>📋 Daily Drill</h3>
      <div class="jr-muts">${muts.map(m =>
        `<span class="src-chip" title="${this.esc(m.desc)}">${m.e} ${m.name}</span>`).join("")}</div>
      <p class="jr-note">${d.done
        ? "✅ Done today! The Professor preps a fresh drill overnight."
        : "One special run — 12 words under today's rules."}</p>
      <p class="jr-note">This week: <b>${Math.min(5, wk)}/5</b> drills ${wk >= 5
        ? "— bonus egg sent! 🥚" : "<span class=\"dim\">(5 earns a special Mystery Egg)</span>"}</p>
      ${d.done ? "" : `<button id="btn-daily" class="mid-btn">▶ Start today's drill</button>`}
      <p class="jr-note">🎟 Candy vouchers: <b>${SAVE.state.vouchers}</b> — spend them in the Pokedex.</p>`;

    const r = SAVE.researchNow();
    this.$("jr-research").innerHTML = `
      <h3>🔬 Research Tasks <span class="jr-sub">fresh every week</span></h3>
      ${r.tasks.map(t => {
        const p = SAVE.taskProgress(t);
        return `<div class="task-row ${t.claimed ? "claimed" : p.done ? "ready" : ""}">
          <span class="task-e">${p.def.e}</span>
          <div class="task-info"><b>${this.esc(p.def.text)}</b>
            <div class="task-meter"><i style="width:${Math.round(100 * p.now / p.def.need)}%"></i></div></div>
          ${t.claimed ? `<span class="task-done">✔</span>`
            : p.done ? `<button class="task-claim" data-claim="${t.id}">CLAIM</button>`
            : `<span class="task-count">${p.now}/${p.def.need}</span>`}
        </div>`;
      }).join("")}
      <p class="jr-note">📮 Stamps: <b>${SAVE.state.unlocks.stamps}</b> — they unlock trainer outfits in the builder!</p>`;

    const el = SAVE.state.elite || { bestRound: 0, clears: 0 };
    const pts = SAVE.medalPoints();
    const open = Engine.eliteUnlocked();
    const hof = SAVE.state.hof || [];
    this.$("jr-elite").innerHTML = `
      <h3>⚔️ The Elite Four</h3>
      ${open
        ? `<p class="jr-note">${el.clears > 0
            ? `🏆 Champion ×${el.clears}! Your photos hang in the Museum Gallery.`
            : el.bestRound > 0
              ? `Best run so far: <b>Round ${el.bestRound} of ${ELITE.length}</b>. They remember you...`
              : "Four masters back to back — your hearts carry between rounds. Then... someone is waiting."}</p>
           <button id="btn-elite" class="mid-btn">⚔️ ${el.clears ? "Challenge again" : "Begin the challenge"}</button>`
        : `<p class="jr-note">🔒 Opens when the story is complete and you hold
            <b>${ELITE_NEED_MEDALS} medal points</b> (you have <b>${pts}</b> — grow them in the Museum's Medal Case).</p>`}
      ${hof.length ? `<p class="jr-note">📸 Hall of Fame entries: <b>${hof.length}</b></p>` : ""}`;

    // Gym Rematches: refight beaten bosses on a faster clock for medals
    const rms = SAVE.state.rematch || {};
    const beaten = [];
    for (let w = 0; w <= HALL_W; w++) {
      if (SAVE.stageStars(w, WORLDS[w].levels.length) > 0) beaten.push(w);
    }
    this.$("jr-rematch").innerHTML = `
      <h3>🥊 Gym Rematches</h3>
      ${beaten.length ? `
        <p class="jr-note">Refight a boss you've beaten — the clock runs faster! Finish with
          <b>2+ hearts</b> for 🥈 Silver, a <b>flawless 3</b> for 🥇 Gold.</p>
        <div class="rematch-list">${beaten.map(w => {
          const b = WORLDS[w].boss;
          const best = rms[w] || 0;
          const bestHtml = best === 2 ? "🥇 <b>Gold</b>"
            : best === 1 ? "🥈 <b>Silver</b>"
            : `<span class="dim">no medal yet</span>`;
          return `<div class="rematch-row">
            <span class="rematch-boss">${this.pokeHtml(b.id, b.emoji, { cls: "poke-img rematch-img" })}<b>${this.esc(b.name)}</b></span>
            <span class="rematch-best">${bestHtml}</span>
            <span class="rematch-btns">
              <button class="rematch-go ${best >= 1 ? "won" : ""}" data-rw="${w}" data-tier="silver" title="Silver rematch — a faster clock">🥈</button>
              <button class="rematch-go ${best >= 2 ? "won" : ""}" data-rw="${w}" data-tier="gold" title="Gold rematch — much faster!">🥇</button>
            </span>
          </div>`;
        }).join("")}</div>`
        : `<p class="jr-note">🔒 Beat a Gym boss first — then come back to refight them for shiny medals!</p>`}`;

    // Weekly Raid contribution board: who chipped the family boss, for how much
    const raid = SAVE.raidNow();
    if (!raid) {
      this.$("jr-raid").innerHTML = `
        <h3>⚔️ Weekly Raid</h3>
        <p class="jr-note">🔒 Reach the ${WORLDS[3].emoji} ${WORLDS[3].name} to join the weekly family raid!</p>`;
    } else {
      const active = SAVE.root.active;
      const myContrib = (active && raid.contrib[active]) || 0;
      const claimedByMe = SAVE.raidClaimedByMe();
      const rows = Object.keys(raid.contrib)
        .map(pid => ({ pid, dmg: raid.contrib[pid] || 0 }))
        .filter(r => r.dmg > 0)
        .sort((a, b) => b.dmg - a.dmg);
      const topDmg = rows.length ? rows[0].dmg : 0;
      const nameOf = pid => {
        const p = (SAVE.root.players || {})[pid];
        return p && p.profile && p.profile.name ? p.profile.name : "A trainer";
      };
      const board = rows.length
        ? `<div class="raid-board">${rows.map(r => {
            const status = raid.defeated
              ? (raid.claimed[r.pid]
                  ? `<span class="raid-status claimed">✓ claimed</span>`
                  : `<span class="raid-status waiting">🎁 prize waiting</span>`)
              : "";
            return `<div class="raid-row${r.pid === active ? " me" : ""}">
              <span class="raid-who">${r.dmg === topDmg ? "👑 " : ""}${this.esc(nameOf(r.pid))}</span>
              <span class="raid-dmg">${r.dmg} dmg</span>
              ${status}
            </div>`;
          }).join("")}</div>`
        : `<p class="jr-note">No hits yet this week — be the first! ⚔️</p>`;
      const hpFrac = raid.maxHp ? Math.max(0, raid.hp) / raid.maxHp : 0;
      const head = raid.defeated
        ? `<div class="raid-head down">${this.pokeHtml(raid.id, raid.e, { cls: "poke-img rematch-img" })}
             <b>${this.esc(raid.n)}</b><span class="raid-downtag">DOWN! 🎉</span></div>`
        : `<div class="raid-head">${this.pokeHtml(raid.id, raid.e, { cls: "poke-img rematch-img" })}
             <b>${this.esc(raid.n)}</b>
             <div class="raid-hpbar jr-raid-hp"><div class="raid-hpfill" style="width:${hpFrac * 100}%"></div></div></div>`;
      const canClaim = raid.defeated && myContrib > 0 && !claimedByMe;
      const btn = !raid.defeated
        ? `<button id="btn-raid" class="mid-btn">⚔️ To battle!</button>`
        : canClaim ? `<button id="btn-raid" class="mid-btn">🎁 Claim your prize!</button>` : "";
      this.$("jr-raid").innerHTML = `
        <h3>⚔️ Weekly Raid <span class="jr-sub">the whole family fights together</span></h3>
        ${head}
        ${board}
        ${btn}`;
    }
  },
});
