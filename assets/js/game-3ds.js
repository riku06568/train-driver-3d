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
  root.style.cssText = 'display:none;background:#080c16;color:#eef2f8;padding:4px;font-family:sans-serif;max-width:400px;margin:0 auto;';
  document.body.insertBefore(root, document.body.firstChild);

  var homeEl = document.getElementById('home');
  var timerId = null;

  var st = {
    mode: 'local',
    dir: 1,
    s: 0,
    v: 0,
    notch: 0,
    doorOpen: true,
    atStIdx: 0,
    nextStIdx: 1,
    distKm: 0,
    hornT: 0,
    aiS: 380,
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
      '<div style="background:#0f172a;border:1px solid #38bdf8;border-radius:8px;padding:10px;">' +
      '<table style="width:100%;margin-bottom:8px;"><tr>' +
      '<td><strong style="font-size:15px;color:#38bdf8;">汐見環状線（軽量モード）</strong></td>' +
      '<td style="text-align:right;"><button id="m3BackHome" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 10px;font-size:12px;">戻る</button></td>' +
      '</tr></table>' +
      '<button data-m="local" data-d="1" style="display:block;width:100%;text-align:left;background:#14935f;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">各駅停車 外回り（全85駅）</button>' +
      '<button data-m="local" data-d="-1" style="display:block;width:100%;text-align:left;background:#0f764b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">各駅停車 内回り（全85駅）</button>' +
      '<button data-m="rapid" data-d="1" style="display:block;width:100%;text-align:left;background:#e8731e;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速 外回り（50駅停車）</button>' +
      '<button data-m="rapid" data-d="-1" style="display:block;width:100%;text-align:left;background:#c25912;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速 内回り（50駅停車）</button>' +
      '<button data-m="exp" data-d="1" style="display:block;width:100%;text-align:left;background:#c8322b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速特急 外回り（16駅停車）</button>' +
      '<button data-m="exp" data-d="-1" style="display:block;width:100%;text-align:left;background:#991b1b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:4px;font-size:13px;font-weight:bold;">快速特急 内回り（16駅停車）</button>' +
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
      '<div style="background:#0b1322;border:1px solid #334155;border-radius:6px;overflow:hidden;">' +
      '<table style="width:100%;background:#0f172a;font-size:11px;padding:3px 6px;"><tr>' +
      '<td><span style="background:' + modeColor(mode) + ';color:#fff;padding:1px 5px;border-radius:3px;font-weight:bold;">' + modeLabel(mode) + '</span> ' + (dir > 0 ? '外回り' : '内回り') + '</td>' +
      '<td id="m3Info" style="color:#fbbf24;font-weight:bold;text-align:center;">次: 朝霧橋</td>' +
      '<td style="text-align:right;"><button id="m3Quit" style="background:#334155;color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:11px;">終了</button></td>' +
      '</tr></table>' +
      '<canvas id="m3Cv" width="320" height="170" style="display:block;width:100%;height:auto;background:#000;"></canvas>' +
      '<div style="padding:6px;background:#111827;">' +
      '<table style="width:100%;background:#020617;border-radius:6px;margin-bottom:5px;text-align:center;"><tr>' +
      '<td style="width:26%;padding:4px 2px;"><div style="font-size:9px;color:#94a3b8;">速度</div><div id="m3Spd" style="font-size:17px;font-weight:bold;color:#38bdf8;">0 km/h</div></td>' +
      '<td style="width:22%;padding:4px 2px;"><div style="font-size:9px;color:#94a3b8;">マスコン</div><div id="m3Nch" style="font-size:17px;font-weight:bold;color:#fbbf24;">B3</div></td>' +
      '<td style="width:32%;padding:4px 2px;"><div style="font-size:9px;color:#94a3b8;">次駅まで</div><div id="m3Dst" style="font-size:15px;font-weight:bold;color:#34d399;">0 m</div></td>' +
      '<td style="width:20%;padding:4px 2px;"><div style="font-size:9px;color:#94a3b8;">戸閉</div><div id="m3Dor" style="font-size:15px;font-weight:bold;color:#f87171;">開</div></td>' +
      '</tr></table>' +
      '<div id="m3Msg" style="font-size:11px;color:#fef08a;text-align:center;min-height:15px;margin-bottom:4px;"></div>' +
      '<table style="width:100%;border-collapse:separate;border-spacing:4px;">' +
      '<tr>' +
      '<td style="width:25%;"><button id="bUp" style="width:100%;height:40px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">力行 +</button></td>' +
      '<td style="width:25%;"><button id="bNeu" style="width:100%;height:40px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">N 惰行</button></td>' +
      '<td style="width:25%;"><button id="bDn" style="width:100%;height:40px;background:#b45309;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">制動 -</button></td>' +
      '<td style="width:25%;"><button id="bEb" style="width:100%;height:40px;background:#b91c1c;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">非常 EB</button></td>' +
      '</tr>' +
      '<tr>' +
      '<td colspan="2"><button id="bDoor" style="width:100%;height:36px;background:#0f766e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">ドア開閉</button></td>' +
      '<td colspan="2"><button id="bHorn" style="width:100%;height:36px;background:#6d28d9;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">警笛</button></td>' +
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
      st.msg = 'プァーン！！';
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
        st.msg = '戸閉完了！発車できます（力行+で発車）';
        st.msgT = 2.5;
      }
    };

    window.onkeydown = function(e) {
      if (root.style.display !== 'block') return;
      var k = e.keyCode;
      if (k === 38) {
        if (st.notch < 5) st.notch++;
        if (st.doorOpen && st.notch > 0) st.notch = 0;
        if (e.preventDefault) e.preventDefault();
      } else if (k === 40) {
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
      var W = cv.width, H = cv.height, HY = 74;
      var curNear = STATIONS[st.atStIdx];
      var inTunnel = (curNear && curNear.tunnel) || nxSt.tunnel;

      // Sky gradient
      if (inTunnel) {
        ctx.fillStyle = '#05070e';
        ctx.fillRect(0, 0, W, HY);
        ctx.fillStyle = '#0d1018';
        ctx.fillRect(0, HY, W, H - HY);
      } else {
        var skyG = ctx.createLinearGradient(0, 0, 0, HY);
        skyG.addColorStop(0, '#1e5799');
        skyG.addColorStop(1, '#7db9e8');
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, W, HY);
        // Distant city skyline
        ctx.fillStyle = '#53687e';
        var blds = [14,22,10,28,16,20,12,26,18,14,24,12,20];
        for (var bi = 0; bi < blds.length; bi++) {
          ctx.fillRect(bi * 25, HY - blds[bi], 22, blds[bi]);
        }
        // Ground
        ctx.fillStyle = '#2d4f32';
        ctx.fillRect(0, HY, W, H - HY);
      }

      var vx = W * 0.5;
      function projX(worldX, z) { return vx + (worldX * 135) / z; }
      function projY(z) { return HY + 135 / z; }

      // Ballast bed (3 tracks wide)
      ctx.fillStyle = '#383a40';
      ctx.beginPath();
      ctx.moveTo(vx - 26, HY);
      ctx.lineTo(vx + 26, HY);
      ctx.lineTo(W + 30, H);
      ctx.lineTo(-30, H);
      ctx.closePath();
      ctx.fill();

      // Ties, Poles, Roadside Buildings & Trees
      var segLen = 5;
      var phase = mod(st.s, segLen) / segLen;
      var baseIdx = Math.floor(st.s / segLen);
      for (var k = 11; k >= 0; k--) {
        var z1 = 1.4 + (k + (1 - phase)) * 2.1;
        var y1 = projY(z1);
        if (y1 >= H) continue;
        var idxObj = baseIdx + k;

        // Roadside buildings / trees
        if (!inTunnel) {
          var sideL = projX(-6.5, z1);
          var sideR = projX(8.5, z1);
          var bh = ((idxObj * 17) % 3 + 2) * (28 / z1);
          var bw = 55 / z1;
          ctx.fillStyle = (idxObj % 2 === 0) ? '#475569' : '#64748b';
          ctx.fillRect(sideL - bw, y1 - bh, bw, bh);
          ctx.fillStyle = (idxObj % 3 === 0) ? '#334155' : '#4b5563';
          ctx.fillRect(sideR, y1 - bh * 0.85, bw, bh * 0.85);
          // Windows
          ctx.fillStyle = '#fde68a';
          if (z1 < 10) {
            ctx.fillRect(sideL - bw * 0.7, y1 - bh * 0.7, bw * 0.2, bh * 0.15);
            ctx.fillRect(sideR + bw * 0.3, y1 - bh * 0.6, bw * 0.2, bh * 0.15);
          }
        }

        // Ties (own track + opposite)
        var wTie = 88 / z1;
        ctx.fillStyle = '#524436';
        ctx.fillRect(vx - wTie * 0.55, y1, wTie, Math.max(1, 3 / z1));
        ctx.fillRect(projX(3.0, z1) - wTie * 0.45, y1, wTie * 0.9, Math.max(1, 3 / z1));

        // Overhead catenary poles every 3 segments
        if (mod(idxObj, 3) === 0) {
          var pxL = projX(-2.2, z1);
          var pxR = projX(5.2, z1);
          var topY = HY - 88 / z1;
          ctx.fillStyle = '#71717a';
          ctx.fillRect(pxL - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxR - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxL, topY + 2, pxR - pxL, 2);
          ctx.fillRect(pxL, topY + 12 / z1, pxR - pxL, 1.5);
        }

        // Signal post every 9 segments
        if (mod(idxObj, 9) === 2) {
          var sx = projX(-1.7, z1);
          var sy = y1 - 52 / z1;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(sx - 3 / z1, sy, 6 / z1, 14 / z1);
          ctx.fillStyle = (dNext < 90) ? '#facc15' : '#22c55e';
          ctx.fillRect(sx - 1.5 / z1, sy + 2 / z1, 3 / z1, 3 / z1);
        }
      }

      // 3 Tracks (Own, Opposite, Express)
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx - 3, HY); ctx.lineTo(vx - 46, H);
      ctx.moveTo(vx + 3, HY); ctx.lineTo(vx + 46, H);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(vx + 8, HY); ctx.lineTo(vx + 115, H);
      ctx.moveTo(vx + 13, HY); ctx.lineTo(vx + 155, H);
      ctx.moveTo(vx - 9, HY); ctx.lineTo(vx - 115, H);
      ctx.stroke();

      // Overhead contact wires
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vx, HY - 2); ctx.lineTo(vx, 0);
      ctx.moveTo(vx + 10, HY - 2); ctx.lineTo(vx + 95, 0);
      ctx.stroke();

      // Approaching Station Platform + Roof + Pillars + Stop Mark
      if (dNext < 220 && dNext > -20) {
        var zSt = Math.max(1.5, dNext * 0.13);
        var ySt = projY(zSt);
        var pw = 135 / zSt;
        var ph = 38 / zSt;
        var edgeX = projX(-1.25, zSt);
        // Platform body
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(edgeX - pw, ySt - ph, pw, ph);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(edgeX - pw, ySt - ph * 0.25, pw, ph * 0.25);
        // Yellow tactile paving
        ctx.fillStyle = '#facc15';
        ctx.fillRect(edgeX - 4, ySt - ph, 4, ph * 0.35);
        // Platform roof
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(edgeX - pw, ySt - ph - 68 / zSt, pw + 10 / zSt, 8 / zSt);
        ctx.fillStyle = '#475569';
        ctx.fillRect(edgeX - pw * 0.5, ySt - ph - 60 / zSt, 5 / zSt, 60 / zSt);
        // Stop Target (X)
        if (dNext < 80) {
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(edgeX - 2, ySt - ph - 32 / zSt, 10 / zSt, 10 / zSt);
          ctx.fillStyle = '#fff';
          ctx.fillRect(edgeX, ySt - ph - 30 / zSt, 6 / zSt, 6 / zSt);
        }
        // Station Signboard
        if (dNext < 140) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(vx - 54, 14, 108, 22);
          ctx.strokeStyle = modeColor(st.mode);
          ctx.lineWidth = 2;
          ctx.strokeRect(vx - 54, 14, 108, 22);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(nxSt.name + ' (' + Math.max(0, Math.round(dNext)) + 'm)', vx, 29);
        }
      }

      // Opposite AI Train
      var dAi = mod(st.aiS - st.s, TOTAL_L);
      if (dAi > TOTAL_L / 2) dAi -= TOTAL_L;
      if (dAi > 2 && dAi < 180) {
        var zAi = Math.max(1.7, dAi * 0.13);
        var xAi = projX(3.0, zAi);
        var yAi = projY(zAi);
        var tw = 90 / zAi, th = 115 / zAi;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(xAi - tw / 2, yAi - th, tw, th);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(xAi - tw * 0.4, yAi - th * 0.78, tw * 0.8, th * 0.25);
        ctx.fillStyle = '#14935f';
        ctx.fillRect(xAi - tw / 2, yAi - th * 0.45, tw, th * 0.14);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(xAi - tw * 0.34, yAi - th * 0.2, tw * 0.16, th * 0.08);
        ctx.fillRect(xAi + tw * 0.18, yAi - th * 0.2, tw * 0.16, th * 0.08);
      }

      // Cab frame & Desk silhouette (3D Train Driver style)
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 14, H);
      ctx.fillRect(W - 14, 0, 14, H);
      ctx.fillRect(0, 0, W, 10);
      // Center pillar
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(vx + 48, 10, 8, H - 24);
      // Cab desk bottom
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, H - 16, W, 16);
      ctx.fillStyle = '#334155';
      ctx.fillRect(14, H - 16, W - 28, 3);

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
