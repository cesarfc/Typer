// ============================================================
// TypeQuest — jsdom UI smoke test. Boots index.html with every
// shipping script, then drives the main player, level, catch,
// and Trainer School flows through their real DOM controls.
// ============================================================

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSDOM_VERSION = "26.1.0";
const installRoot = path.join(os.tmpdir(), `typequest-jsdom-${JSDOM_VERSION}`);
const packageFile = path.join(installRoot, "node_modules", "jsdom", "package.json");
let installedVersion = null;
try {
  installedVersion = JSON.parse(fs.readFileSync(packageFile, "utf8")).version;
} catch (_) {}

if (installedVersion !== JSDOM_VERSION) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, [
    "install", "--prefix", installRoot, "--no-package-lock", "--no-save",
    "--no-audit", "--no-fund", `jsdom@${JSDOM_VERSION}`,
  ], {
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: path.join(os.tmpdir(), "typequest-smoke-npm-cache"),
    },
  });
  if (result.status !== 0) {
    throw new Error(`Could not install jsdom@${JSDOM_VERSION}`);
  }
}

const require = createRequire(path.join(installRoot, "package.json"));
const { JSDOM, VirtualConsole } = require("jsdom");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test("boots the game and drives its core UI flows", async t => {
  const runtimeErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => runtimeErrors.push(error));

  const indexFile = path.join(ROOT, "index.html");
  const dom = new JSDOM(fs.readFileSync(indexFile, "utf8"), {
    url: pathToFileURL(indexFile).href,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.Math.random = () => 0.5;
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.setTimeout = (callback, ms, ...args) =>
        nativeSetTimeout(callback, Math.min(Number(ms) || 0, 10), ...args);
      window.fetch = async () => ({ ok: false });
      window.matchMedia = media => ({
        matches: media === "(prefers-reduced-motion: reduce)",
        media,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() { return false; },
      });
      window.CSS = {
        escape(value) {
          return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        },
      };
      window.Element.prototype.scrollIntoView = function () {};
      window.Element.prototype.animate = function () {
        return { cancel() {}, finished: Promise.resolve(), onfinish: null };
      };
      window.HTMLCanvasElement.prototype.getContext = () => ({
        globalAlpha: 1,
        fillStyle: "",
        clearRect() {},
        fillRect() {},
        beginPath() {},
        arc() {},
        fill() {},
      });
    },
  });
  t.after(() => dom.window.close());

  const { window } = dom;
  const { document } = window;
  window.addEventListener("error", event => {
    runtimeErrors.push(event.error || new Error(event.message));
  });
  window.addEventListener("unhandledrejection", event => {
    runtimeErrors.push(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
  });

  const scripts = [...document.querySelectorAll("script[src]")];
  assert.ok(scripts.length, "index.html must load game scripts");
  for (const script of scripts) {
    const scriptFile = fileURLToPath(new URL(script.src));
    assert.ok(scriptFile.startsWith(path.join(ROOT, "js") + path.sep),
      `unexpected script outside js/: ${script.src}`);
    vm.runInContext(fs.readFileSync(scriptFile, "utf8"), dom.getInternalVMContext(), {
      filename: scriptFile,
    });
  }

  const errorText = () => runtimeErrors.map(error => error.stack || error.message || String(error)).join("\n\n");
  const assertClean = () => assert.equal(runtimeErrors.length, 0, errorText());
  const must = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, `missing UI target: ${selector}`);
    return element;
  };
  const assertScreen = name => {
    assert.equal(window.TQ.UI.current, name);
    assert.ok(!must(`#screen-${name}`).classList.contains("hidden"), `${name} screen is hidden`);
  };
  const waitFor = async (predicate, label, timeout = 3000) => {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
      assertClean();
      if (Date.now() >= deadline) {
        const session = window.TQ && window.TQ.Engine.session;
        assert.fail(`timed out waiting for ${label}; screen=${window.TQ && window.TQ.UI.current}, state=${session && session.state}`);
      }
      await delay(5);
    }
    assertClean();
  };
  const typeUntil = async (predicate, label) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assertClean();
      const session = window.TQ.Engine.session;
      if (window.TQ.UI.current === "game" && session &&
          ["play", "catch", "evolve", "welcome"].includes(session.state) &&
          session.pos < session.text.length) {
        must("#prompt-word .ch.cur");
        for (const key of session.text.slice(session.pos)) {
          window.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
        }
      } else {
        await delay(5);
      }
      if (Date.now() >= deadline) {
        assert.fail(`timed out typing ${label}; screen=${window.TQ.UI.current}, state=${session && session.state}`);
      }
    }
    assertClean();
  };

  await waitFor(() => window.TQ, "game boot");
  assertScreen("title");
  assert.ok(!must("#title-new").classList.contains("hidden"), "new-player form is hidden");

  must("#name-input").value = "Smoke";
  must("#btn-start").click();
  assertScreen("tutorial");
  must("#tut-skip").click();
  assertScreen("map");
  assert.equal(window.TQ.SAVE.state.profile.name, "Smoke");
  const played = { mastery: 0, level: 0, record: 0, fanfare: 0 };
  for (const sound of Object.keys(played)) {
    window.TQ.SFX[sound] = () => { played[sound]++; };
  }
  window.TQ.SAVE.state.stats.perKey = {
    f: { ok: 19, miss: 0 },
    j: { ok: 19, miss: 0 },
  };

  const firstStage = must('.mnode[data-w="0"][data-s="0"]');
  assert.ok(!firstStage.classList.contains("locked"), "world 1 level 1 is locked");
  firstStage.click();
  assertScreen("game");
  assert.match(must("#hud-stage").textContent, /Pallet Meadow/);

  await typeUntil(() => {
    const session = window.TQ.Engine.session;
    return session && session.state === "catch";
  }, "world 1 level");
  assert.match(must("#target").textContent, /\S/, "catch target is empty");
  assert.ok(must("#prompt-word .ch.cur"), "catch prompt is missing");
  await typeUntil(() => window.TQ.UI.current === "results", "catch round");
  assertScreen("results");
  assert.match(must("#results-title").textContent, /Complete/);
  assert.equal(must("#results-grid").children.length, 4);
  assert.ok(!must("#results-catch").classList.contains("hidden"), "catch result is hidden");
  assert.match(must("#results-mastery").textContent, /You mastered the F key!/);
  assert.deepEqual(JSON.parse(JSON.stringify(window.TQ.SAVE.state.flags.masteredKeys)), { f: true });
  assert.deepEqual(played, { mastery: 1, level: 0, record: 0, fanfare: 0 });
  window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assertScreen("results");
  window.TQ.UI.showDefeat(window.TQ.Engine.session);
  assert.ok(must("#results-mastery").classList.contains("hidden"), "mastery chip leaked onto defeat");
  assert.equal(must("#results-mastery").textContent, "");

  must("#btn-tomap").click();
  assertScreen("map");
  must("#school-chip").click();
  assertScreen("practice");
  const practice = must('.tier-card[data-tier="target"]');
  assert.match(practice.textContent, /Target Practice/);
  assert.match(practice.textContent, /Practice your trickiest keys/);
  practice.click();
  assertScreen("game");
  assert.match(must("#hud-stage").textContent, /Practice/);
  assert.equal(window.TQ.Engine.session.practice.id, "target");
  assert.ok(must("#timer-bar").classList.contains("hidden"), "practice countdown is visible");
  assert.ok(!must("#stopwatch").classList.contains("hidden"), "practice stopwatch is hidden");

  must("#btn-pause").click();
  assert.ok(!must("#pause-overlay").classList.contains("hidden"), "pause overlay is hidden");
  must("#btn-restart").click();
  await waitFor(() => {
    const session = window.TQ.Engine.session;
    return session && session.practice && session.state === "play";
  }, "practice restart");
  assertScreen("game");

  await typeUntil(() => window.TQ.UI.current === "results", "Trainer School practice");
  assertScreen("results");
  assert.match(must("#results-title").textContent, /Practice/);
  assert.ok(window.TQ.SAVE.state.practice.target.time > 0, "Target Practice best time was not saved");
  assert.ok(window.TQ.SAVE.state.practice.target.wpm > 0, "Target Practice best WPM was not saved");
  assert.deepEqual(played, { mastery: 1, level: 0, record: 1, fanfare: 0 });
  must("#btn-replay").click();
  assertScreen("practice");
  must('.navbtn[data-nav="map"]').click();
  assertScreen("map");

  window.TQ.SAVE.state.stats.perKey = {
    q: { ok: 8, miss: 0 },
    w: { ok: 7, miss: 1 },
    e: { ok: 4, miss: 4 },
    r: { ok: 3, miss: 4 },
  };
  window.TQ.SAVE.state.stats.history = [
    { d: "2026-07-23", wpm: 12, acc: 0.75 },
    { d: "2026-07-24", wpm: 15, acc: 0.82 },
    { d: "2026-07-25", wpm: 18, acc: 0.9 },
  ];
  must('.navbtn[data-nav="stats"]').click();
  assertScreen("stats");
  assert.equal(document.querySelectorAll(".heat-row").length, 3);
  assert.ok(must('.heat-key[data-key="q"]').classList.contains("strong"));
  assert.ok(must('.heat-key[data-key="w"]').classList.contains("growing"));
  assert.ok(must('.heat-key[data-key="e"]').classList.contains("practice"));
  assert.ok(must('.heat-key[data-key="r"]').classList.contains("neutral"));
  assert.ok(must('.heat-key[data-key="q"]').classList.contains("f0"));
  assert.equal(document.querySelectorAll(".trend-line").length, 2);
  assert.match(must("#parent-stats").textContent, /at least 8 tries/);

  window.TQ.SAVE.state.stats.history = [];
  window.TQ.UI.renderStats();
  assert.match(must("#stats-chart").textContent, /progress trail will appear/);
  assertClean();
});
