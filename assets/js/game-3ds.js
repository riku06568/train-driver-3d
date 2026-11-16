(function(){
  if (window.__SHIOMI_3DS_LOADED) {
    if (window.__SHIOMI_3DS_SHOW_MENU) window.__SHIOMI_3DS_SHOW_MENU();
    return;
  }
  window.__SHIOMI_3DS_LOADED = true;

  var RAW_NAMES = "汐見,しおみ|朝霧橋,あさぎりばし|若葉野,わかばの|御影坂,みかげざか|朱雀台,すざくだい|白鷺町,しらさぎちょう|千鳥橋,ちどりばし|月見ヶ丘,つきみがおか|花園口,はなぞのぐち|紅葉通,もみじどおり|小春町,こはるちょう|瑞穂町,みずほちょう|桜並木,さくらなみき|蒼海中央,そうかいちゅうおう|石畳,いしだたみ|風早台,かざはやだい|鈴蘭坂,すずらんざか|港見,みなとみ|青嵐,せいらん|灯籠坂,とうろうざか|霞ヶ原,かすみがはら|翠湖,すいこ|柳川原,やながわら|星ヶ浦,ほしがうら|萩野,はぎの|琴音町,ことねちょう|水晶台,すいしょうだい|雪見坂,ゆきみざか|野分,のわき|茜町,あかねちょう|陽ノ宮,ひのみや|雲雀野,ひばりの|松風,まつかぜ|羽衣橋,はごろもばし|楓原,かえではら|鶺鴒町,せきれいちょう|朧月,おぼろづき|宵待橋,よいまちばし|白峰,しらみね|潮騒,しおさい|宝来,ほうらい|波止場口,はとばぐち|岬台,みさきだい|貝塚通,かいづかどおり|真砂町,まさごちょう|夕凪,ゆうなぎ|砂丘口,さきゅうぐち|金波中央,きんぱちゅうおう|銀杏並木,いちょうなみき|曙橋,あけぼのばし|若竹,わかたけ|藤棚,ふじだな|蛍川,ほたるがわ|菖蒲台,あやめだい|竹林,ちくりん|黎明中央,れいめいちゅうおう|朝凪,あさなぎ|七星,ななほし|虹ヶ丘,にじがおか|流星町,りゅうせいちょう|天神坂,てんじんざか|銀河通,ぎんがどおり|彩雲,さいうん|花水木,はなみずき|紫雲新都,しうんしんと|鳴砂橋,なりすなばし|霧笛台,むてきだい|若草,わかくさ|杉木立,すぎこだち|桔梗町,ききょうちょう|紅梅,こうばい|瑠璃坂,るりざか|碧浜,あおはま|白砂,しらすな|帆立浜,ほたてはま|浮雲町,うきぐもちょう|月影,つきかげ|暁台,あかつきだい|神楽橋,かぐらばし|花筏,はないかだ|陽炎,かげろう|天宮,あまみや|早瀬,はやせ|春霞,はるがすみ|夕映,ゆうばえ";
  var parts = RAW_NAMES.split('|');
  var MAINS = {4:1,13:1,21:1,30:1,38:1,47:1,55:1,64:1,72:1,81:1};
  var EXP_S = {0:1,38:1,53:1,62:1,71:1,79:1};
  var RAP_S = {3:1,5:1,7:1,10:1,11:1,12:1,16:1,18:1,19:1,22:1,24:1,27:1,28:1,31:1,33:1,34:1,36:1,42:1,43:1,45:1,48:1,50:1,51:1,57:1,58:1,60:1,65:1,66:1,68:1,73:1,74:1,77:1,79:1,83:1};
  var STATIONS = [];
  var sAcc = 0;
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].split(',');
    var cls = MAINS[i] ? 'M' : (EXP_S[i] ? 'X' : (RAP_S[i] ? 'R' : 'L'));
    STATIONS.push({
      i: i,
      name: kv[0],
      yomi: kv[1],
      cls: cls,
      s: sAcc,
      tunnel: (i >= 62 && i <= 68)
    });
    sAcc += (MAINS[i] ? 1100 : 780);
  }
  var TOTAL_L = sAcc;

  function mod(a, m) {
    return ((a % m) + m) % m;
  }

  function serves(st, mode) {
    if (mode === 'local') return true;
    if (mode === 'rapid') return st.cls === 'M' || st.cls === 'X' || st.cls === 'R';
    return st.cls === 'M' || st.cls === 'X';
  }

  var root = document.createElement('div');
  root.id = 'mode3dsRoot';
  root.style.cssText = 'display:none;background:#080c16;color:#eef2f8;padding:8px;font-family:sans-serif;max-width:420px;margin:0 auto;';
  document.body.insertBefore(root, document.body.firstChild);

  var homeEl = document.getElementById('home');
  var timerId = null;

  var st = {
    mode: 'local',
    dir: 1,
    s: 0,
    v: 0, // m/s
    notch: 0, // -9(EB), -8..-1(B), 0(N), 1..5(P)
    doorOpen: true,
    atStIdx: 0,
    nextStIdx: 1,
    distKm: 0,
    hornT: 0,
    aiS: 420,
    msg: '扉を閉めて発車してください',
    msgT: 0
  };

  function notchLabel(n) {
    if (n === -9) return 'EB';
    if (n < 0) return 'B' + (-n);
    if (n === 0) return 'N';
    return 'P' + n;
  }

  function modeLabel(m) {
    if (m === 'rapid') return '快速';
    if (m === 'exp') return '快特';
    return '各停';
  }

  function modeColor(m) {
    if (m === 'rapid') return '#e8731e';
    if (m === 'exp') return '#c8322b';
    return '#14935f';
  }

  function findNextStop(fromIdx, dir, mode) {
    var idx = fromIdx;
    for (var k = 0; k < STATIONS.length; k++) {
      idx = mod(idx + dir, STATIONS.length);
      if (serves(STATIONS[idx], mode)) return idx;
    }
    return 0;
  }

  function distToStation(stObj) {
    if (st.dir > 0) return mod(stObj.s - st.s, TOTAL_L);
    return mod(st.s - stObj.s, TOTAL_L);
  }

  function showMenu() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (homeEl) { homeEl.className = (homeEl.className || '') + ' hide'; }
    root.style.display = 'block';
    try { window.scrollTo(0, 0); } catch(e) {}
    root.innerHTML =
      '<div style="background:#0f172a;border:1px solid #38bdf8;border-radius:10px;padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
      '<strong style="font-size:16px;color:#38bdf8;">🚃 汐見環状線（軽量2.5Dモード）</strong>' +
      '<button id="m3BackHome" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 10px;font-size:12px;">戻る</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#cbd5e1;margin-bottom:10px;">3DSなどのブラウザ向けに超軽量Canvasエンジンで起動します。路線・種別を選んでね！</div>' +
      '<button data-m="local" data-d="1" style="display:block;width:100%;text-align:left;background:#14935f;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;font-weight:bold;">各駅停車 外回り（全85駅）</button>' +
      '<button data-m="local" data-d="-1" style="display:block;width:100%;text-align:left;background:#0f764b;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;font-weight:bold;">各駅停車 内回り（全85駅）</button>' +
      '<button data-m="rapid" data-d="1" style="display:block;width:100%;text-align:left;background:#e8731e;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;font-weight:bold;">快速 外回り（50駅停車）</button>' +
      '<button data-m="rapid" data-d="-1" style="display:block;width:100%;text-align:left;background:#c25912;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;font-weight:bold;">快速 内回り（50駅停車）</button>' +
      '<button data-m="exp" data-d="1" style="display:block;width:100%;text-align:left;background:#c8322b;color:#fff;border:none;border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:14px;font-weight:bold;">快速特急 外回り（16駅停車）</button>' +
      '<button data-m="exp" data-d="-1" style="display:block;width:100%;text-align:left;background:#991b1b;color:#fff;border:none;border-radius:8px;padding:10px 12px;font-size:14px;font-weight:bold;">快速特急 内回り（16駅停車）</button>' +
      '</div>';

    document.getElementById('m3BackHome').onclick = function() {
      root.style.display = 'none';
      if (homeEl) homeEl.className = (homeEl.className || '').replace(/\bhide\b/g, '');
    };
    var btns = root.querySelectorAll('button[data-m]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function() {
        var m = this.getAttribute('data-m');
        var d = parseInt(this.getAttribute('data-d'), 10);
        startDrive(m, d);
      };
    }
  }

  function startDrive(mode, dir) {
    st.mode = mode;
    st.dir = dir;
    st.s = 0;
    st.v = 0;
    st.notch = -3;
    st.doorOpen = true;
    st.atStIdx = 0;
    st.nextStIdx = findNextStop(0, dir, mode);
    st.hornT = 0;
    st.aiS = 350;
    st.msg = 'ドアを閉めて発車（汐見 停車中）';
    st.msgT = 3;

    root.innerHTML =
      '<div style="background:#0b1322;border:1px solid #334155;border-radius:8px;overflow:hidden;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:#0f172a;font-size:12px;">' +
      '<span><span style="background:' + modeColor(mode) + ';color:#fff;padding:1px 6px;border-radius:4px;font-weight:bold;">' + modeLabel(mode) + '</span> ' + (dir > 0 ? '外回り' : '内回り') + '</span>' +
      '<span id="m3Info" style="color:#fbbf24;font-weight:bold;">汐見 停車中</span>' +
      '<button id="m3Quit" style="background:#334155;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:11px;">終了</button>' +
      '</div>' +
      '<canvas id="m3Cv" width="320" height="180" style="display:block;width:100%;height:auto;background:#000;"></canvas>' +
      '<div style="padding:8px;background:#111827;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;background:#020617;padding:6px 8px;border-radius:6px;">' +
      '<div><div style="font-size:10px;color:#94a3b8;">速度</div><div id="m3Spd" style="font-size:20px;font-weight:bold;color:#38bdf8;">0 km/h</div></div>' +
      '<div><div style="font-size:10px;color:#94a3b8;">マスコン</div><div id="m3Nch" style="font-size:20px;font-weight:bold;color:#fbbf24;">B3</div></div>' +
      '<div><div style="font-size:10px;color:#94a3b8;">次駅まで</div><div id="m3Dst" style="font-size:16px;font-weight:bold;color:#34d399;">0 m</div></div>' +
      '<div><div style="font-size:10px;color:#94a3b8;">戸閉</div><div id="m3Dor" style="font-size:14px;font-weight:bold;color:#f87171;">開</div></div>' +
      '</div>' +
      '<div id="m3Msg" style="font-size:11px;color:#fef08a;text-align:center;min-height:16px;margin-bottom:6px;"></div>' +
      '<table style="width:100%;border-collapse:separate;border-spacing:4px;">' +
      '<tr>' +
      '<td style="width:25%;"><button id="bUp" style="width:100%;height:42px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:bold;">▲ 力行</button></td>' +
      '<td style="width:25%;"><button id="bNeu" style="width:100%;height:42px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:bold;">N 惰行</button></td>' +
      '<td style="width:25%;"><button id="bDn" style="width:100%;height:42px;background:#b45309;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:bold;">▼ 制動</button></td>' +
      '<td style="width:25%;"><button id="bEb" style="width:100%;height:42px;background:#b91c1c;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:bold;">EB 非常</button></td>' +
      '</tr>' +
      '<tr>' +
      '<td colspan="2"><button id="bDoor" style="width:100%;height:38px;background:#0f766e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">🚪 ドア開閉</button></td>' +
      '<td colspan="2"><button id="bHorn" style="width:100%;height:38px;background:#6d28d9;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">📣 警笛</button></td>' +
      '</tr>' +
      '</table>' +
      '</div></div>';

    var cv = document.getElementById('m3Cv');
    var ctx = cv.getContext('2d');

    document.getElementById('m3Quit').onclick = showMenu;
    document.getElementById('bUp').onclick = function() {
      if (st.doorOpen && st.notch >= 0) return;
      if (st.notch < 5) st.notch++;
      if (st.doorOpen && st.notch > 0) st.notch = 0;
    };
    document.getElementById('bNeu').onclick = function() { st.notch = 0; };
    document.getElementById('bDn').onclick = function() { if (st.notch > -8) st.notch--; };
    document.getElementById('bEb').onclick = function() { st.notch = -9; };
    document.getElementById('bHorn').onclick = function() {
      st.hornT = 1.0;
      st.msg = '📣 プァーン！！';
      st.msgT = 1.5;
    };
    document.getElementById('bDoor').onclick = function() {
      if (st.v > 0.2) {
        st.msg = '走行中はドアを開けられません';
        st.msgT = 1.5;
        return;
      }
      var nxSt = STATIONS[st.nextStIdx];
      var dNext = distToStation(nxSt);
      var atSt = STATIONS[st.atStIdx];
      var dCur = atSt ? Math.min(mod(st.s - atSt.s, TOTAL_L), mod(atSt.s - st.s, TOTAL_L)) : 999;
      if (!st.doorOpen) {
        if (dNext <= 15 || dCur <= 15) {
          st.doorOpen = true;
          if (dNext <= 15) {
            st.atStIdx = st.nextStIdx;
            st.nextStIdx = findNextStop(st.atStIdx, st.dir, st.mode);
            st.msg = nxSt.name + ' に停車！ドア開';
          } else {
            st.msg = 'ドアを開けました';
          }
          st.msgT = 2.5;
        } else {
          st.msg = '停止位置（駅±15m）まで進んでください';
          st.msgT = 2;
        }
      } else {
        st.doorOpen = false;
        st.msg = '戸閉完了！発車できます（▲で力行）';
        st.msgT = 2.5;
      }
    };

    window.onkeydown = function(e) {
      if (root.style.display !== 'block') return;
      var k = e.keyCode;
      if (k === 38) { // Up
        if (st.notch < 5) st.notch++;
        if (st.doorOpen && st.notch > 0) st.notch = 0;
        if (e.preventDefault) e.preventDefault();
      } else if (k === 40) { // Down
        if (st.notch > -9) st.notch--;
        if (e.preventDefault) e.preventDefault();
      } else if (k === 13 || k === 32) {
        var b = document.getElementById('bDoor');
        if (b) b.click();
      }
    };

    var lastT = new Date().getTime();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(function() {
      var now = new Date().getTime();
      var dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;

      // Physics
      var acc = 0;
      if (st.doorOpen && st.notch > 0) st.notch = 0;
      if (st.notch > 0) acc = st.notch * 0.24;
      else if (st.notch === 0) acc = -0.025;
      else if (st.notch === -9) acc = -1.75;
      else acc = st.notch * 0.17;

      st.v += acc * dt;
      var maxV = (st.mode === 'exp' ? 150 : st.mode === 'rapid' ? 120 : 100) / 3.6;
      if (st.v < 0) st.v = 0;
      if (st.v > maxV) st.v = maxV;

      var ds = st.v * dt;
      st.s = mod(st.s + st.dir * ds, TOTAL_L);
      st.distKm += ds / 1000;
      st.aiS = mod(st.aiS - st.dir * 22 * dt, TOTAL_L);
      if (st.hornT > 0) st.hornT -= dt;
      if (st.msgT > 0) st.msgT -= dt;

      var nxSt = STATIONS[st.nextStIdx];
      var dNext = distToStation(nxSt);
      if (dNext > TOTAL_L - 40) dNext = dNext - TOTAL_L;

      // Render pseudo-3D Canvas
      var W = cv.width, H = cv.height, HY = 78;
      var curNear = STATIONS[st.atStIdx];
      var inTunnel = (curNear && curNear.tunnel) || nxSt.tunnel;

      // Sky
      ctx.fillStyle = inTunnel ? '#06080f' : '#3876b8';
      ctx.fillRect(0, 0, W, HY);
      // Ground
      ctx.fillStyle = inTunnel ? '#11131a' : '#2d4a2f';
      ctx.fillRect(0, HY, W, H - HY);

      // Perspective Rails (Main + Opposite + Side)
      var vx = W * 0.5;
      function projX(worldX, z) { return vx + (worldX * 140) / z; }
      function projY(z) { return HY + 140 / z; }

      // Ballast bed
      ctx.fillStyle = '#3b3d42';
      ctx.beginPath();
      ctx.moveTo(vx - 16, HY);
      ctx.lineTo(vx + 16, HY);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Ties & Poles
      var phase = mod(st.s, 4) / 4;
      for (var k = 0; k < 14; k++) {
        var z1 = 1.4 + (k + (1 - phase)) * 2.2;
        var y1 = projY(z1);
        if (y1 >= H) continue;
        var wTie = 100 / z1;
        ctx.fillStyle = '#5c4b3b';
        ctx.fillRect(vx - wTie, y1, wTie * 2, Math.max(1, 3 / z1));

        if (k % 4 === 0) {
          var pxL = projX(-2.2, z1);
          var pxR = projX(2.2, z1);
          var topY = HY - 90 / z1;
          ctx.fillStyle = '#64748b';
          ctx.fillRect(pxL - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxR - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxL, topY, pxR - pxL, 2);
        }
      }

      // 2 Rails
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx - 3, HY); ctx.lineTo(vx - 52, H);
      ctx.moveTo(vx + 3, HY); ctx.lineTo(vx + 52, H);
      ctx.stroke();

      // Opposite track
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vx + 9, HY); ctx.lineTo(vx + 135, H);
      ctx.moveTo(vx + 14, HY); ctx.lineTo(vx + 175, H);
      ctx.stroke();

      // Approaching Station Platform
      if (dNext < 220 && dNext > -20) {
        var zSt = Math.max(1.6, dNext * 0.14);
        var ySt = projY(zSt);
        var pw = 110 / zSt;
        var ph = 42 / zSt;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(projX(-1.3, zSt) - pw, ySt - ph, pw, ph);
        // Yellow tactile line
        ctx.fillStyle = '#facc15';
        ctx.fillRect(projX(-1.3, zSt) - 4, ySt - ph, 4, ph);
        // Station Signboard
        if (dNext < 120) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(vx - 46, 12, 92, 22);
          ctx.strokeStyle = modeColor(st.mode);
          ctx.strokeRect(vx - 46, 12, 92, 22);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(nxSt.name, vx, 27);
        }
      }

      // Opposite AI Train
      var dAi = mod(st.aiS - st.s, TOTAL_L);
      if (dAi > TOTAL_L / 2) dAi -= TOTAL_L;
      if (dAi > 2 && dAi < 180) {
        var zAi = Math.max(1.8, dAi * 0.14);
        var xAi = projX(3.2, zAi);
        var yAi = projY(zAi);
        var tw = 95 / zAi, th = 120 / zAi;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(xAi - tw / 2, yAi - th, tw, th);
        ctx.fillStyle = '#14935f';
        ctx.fillRect(xAi - tw / 2, yAi - th * 0.45, tw, th * 0.15);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(xAi - tw * 0.3, yAi - th * 0.2, tw * 0.15, th * 0.08);
        ctx.fillRect(xAi + tw * 0.15, yAi - th * 0.2, tw * 0.15, th * 0.08);
      }

      // Cab frame overlay
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 12, H);
      ctx.fillRect(W - 12, 0, 12, H);
      ctx.fillRect(0, 0, W, 6);
      if (st.hornT > 0) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('プァーン！', vx, 56);
      }

      // Update HUD
      var elSpd = document.getElementById('m3Spd');
      var elNch = document.getElementById('m3Nch');
      var elDst = document.getElementById('m3Dst');
      var elDor = document.getElementById('m3Dor');
      var elInf = document.getElementById('m3Info');
      var elMsg = document.getElementById('m3Msg');
      if (elSpd) elSpd.textContent = Math.round(st.v * 3.6) + ' km/h';
      if (elNch) elNch.textContent = notchLabel(st.notch);
      if (elDst) elDst.textContent = Math.round(dNext) + ' m';
      if (elDor) {
        elDor.textContent = st.doorOpen ? '開' : '閉';
        elDor.style.color = st.doorOpen ? '#f87171' : '#34d399';
      }
      if (elInf) elInf.textContent = '次: ' + nxSt.name;
      if (elMsg) elMsg.textContent = st.msgT > 0 ? st.msg : (dNext < 15 && st.v < 0.2 ? '停車位置OK！ドアを開けられます' : '');
    }, 50);
  }

  window.__SHIOMI_3DS_SHOW_MENU = showMenu;
  showMenu();
})();
