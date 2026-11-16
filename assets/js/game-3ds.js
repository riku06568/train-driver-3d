(function(){
  if (window.__SHIOMI_3DS_LOADED) {
    if (window.__SHIOMI_3DS_SHOW_MENU) window.__SHIOMI_3DS_SHOW_MENU();
    return;
  }
  window.__SHIOMI_3DS_LOADED = true;

  var TOTAL_L = 106000;
  var RAW_ST = [["汐見", "X", 3000.0], ["朝霧橋", "L", 4204.6], ["若葉野", "L", 5478.1], ["御影坂", "R", 6754.2], ["朱雀台", "M", 7997.1], ["白鷺町", "R", 9582.7], ["千鳥橋", "L", 10873.9], ["月見ヶ丘", "R", 11946.0], ["花園口", "L", 13078.9], ["紅葉通", "L", 14385.9], ["小春町", "R", 15738.9], ["瑞穂町", "R", 16828.8], ["桜並木", "R", 17828.9], ["蒼海中央", "M", 19131.1], ["石畳", "L", 20671.4], ["風早台", "L", 22041.1], ["鈴蘭坂", "R", 23330.0], ["港見", "L", 24568.3], ["青嵐", "X", 25678.1], ["灯籠坂", "R", 26732.3], ["霞ヶ原", "L", 27821.6], ["翠湖", "M", 29172.3], ["柳川原", "R", 30658.1], ["星ヶ浦", "L", 31721.4], ["萩野", "R", 32819.7], ["琴音町", "L", 34004.2], ["水晶台", "R", 35110.8], ["雪見坂", "R", 36238.9], ["野分", "L", 37387.4], ["茜町", "L", 38397.8], ["陽ノ宮", "M", 39703.7], ["雲雀野", "R", 41089.5], ["松風", "L", 42168.2], ["羽衣橋", "X", 43289.7], ["楓原", "R", 44933.8], ["鶺鴒町", "L", 46282.2], ["朧月", "R", 47551.9], ["宵待橋", "L", 48537.3], ["白峰", "M", 49784.4], ["潮騒", "R", 51063.6], ["宝来", "L", 52425.7], ["波止場口", "L", 53536.4], ["岬台", "R", 54807.2], ["貝塚通", "R", 55894.9], ["真砂町", "L", 56885.3], ["夕凪", "R", 58007.7], ["砂丘口", "L", 59364.1], ["金波中央", "M", 60621.6], ["銀杏並木", "X", 61927.5], ["曙橋", "L", 62932.6], ["若竹", "R", 63904.6], ["藤棚", "R", 64930.1], ["蛍川", "L", 66126.6], ["菖蒲台", "X", 67099.8], ["竹林", "L", 68389.9], ["黎明中央", "M", 69747.6], ["朝凪", "L", 71050.8], ["七星", "R", 72126.9], ["虹ヶ丘", "R", 73138.0], ["流星町", "L", 74321.9], ["天神坂", "R", 75311.6], ["銀河通", "L", 76627.9], ["彩雲", "R", 77808.9], ["花水木", "L", 79063.3], ["紫雲新都", "M", 80359.6], ["鳴砂橋", "R", 81936.2], ["霧笛台", "R", 83149.5], ["若草", "L", 84465.4], ["杉木立", "R", 85438.1], ["桔梗町", "L", 86653.5], ["紅梅", "L", 87697.9], ["瑠璃坂", "R", 89037.4], ["碧浜", "M", 90541.5], ["白砂", "R", 91942.0], ["帆立浜", "R", 92908.5], ["浮雲町", "L", 93914.0], ["月影", "L", 94950.7], ["暁台", "R", 96129.3], ["神楽橋", "L", 97362.3], ["花筏", "R", 98456.9], ["陽炎", "X", 99622.2], ["天宮", "M", 101213.8], ["早瀬", "L", 102825.6], ["春霞", "R", 103893.2], ["夕映", "L", 105414.7]];
  var STATIONS = [];
  for (var i = 0; i < RAW_ST.length; i++) {
    var r = RAW_ST[i];
    var inUnder = (i>=7&&i<=9)||(i>=17&&i<=19)||(i>=27&&i<=29)||(i>=37&&i<=39)||(i>=47&&i<=49)||(i>=57&&i<=59)||(i>=67&&i<=69)||(i>=77&&i<=79);
    STATIONS.push({ i: i, name: r[0], cls: r[1], s: r[2], tunnel: inUnder });
  }

  function mod(a, m) { return ((a % m) + m) % m; }
  function sdiff(a, b) { return mod(b - a + TOTAL_L / 2, TOTAL_L) - TOTAL_L / 2; }

  function serves(st, mode) {
    if (mode === 'local') return true;
    if (mode === 'rapid') return st.cls === 'M' || st.cls === 'X' || st.cls === 'R';
    return st.cls === 'M' || st.cls === 'X';
  }

  /* ===== 超軽量 ES5 MQTT 3.1.1 over WebSocket クライアント ===== */
  var MY_ID = '3ds_' + Math.random().toString(36).slice(2, 8);
  var MY_NAME = '3DS運転士';
  try {
    var savedN = localStorage.getItem('td_player_name');
    if (savedN) MY_NAME = savedN;
  } catch(e) {}

  var BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://public:public@public.cloud.shiftr.io:443/mqtt'
  ];
  var brokerIdx = 0;
  var ws = null;
  var mqttConnected = false;
  var pingTimer = null;
  var ONLINE_PLAYERS = {};
  var AI_TRAINS = [];
  var lastChatMsg = '';

  function toUtf8Bytes(str) {
    var utf8 = unescape(encodeURIComponent(str));
    var arr = [];
    for (var i = 0; i < utf8.length; i++) arr.push(utf8.charCodeAt(i));
    return arr;
  }
  function fromUtf8Bytes(u8, start, end) {
    var s = '';
    for (var i = start; i < end; i++) s += String.fromCharCode(u8[i]);
    try { return decodeURIComponent(escape(s)); } catch(e) { return s; }
  }
  function encLen(n) {
    var out = [];
    do {
      var d = n % 128;
      n = Math.floor(n / 128);
      if (n > 0) d = d | 128;
      out.push(d);
    } while (n > 0);
    return out;
  }
  function encStr(str) {
    var b = toUtf8Bytes(str);
    return [(b.length >> 8) & 255, b.length & 255].concat(b);
  }
  function sendBytes(arr) {
    if (!ws || ws.readyState !== 1) return;
    try { ws.send(new Uint8Array(arr).buffer); } catch(e) {}
  }
  function mqttConnectPkt(cid) {
    var vh = [0,4, 77,81,84,84, 4, 2, 0,30]; // MQTT, v4, cleanSession, keepalive=30
    var pl = encStr(cid);
    var body = vh.concat(pl);
    return [0x10].concat(encLen(body.length), body);
  }
  function mqttSubPkt(topics) {
    var body = [0, 1]; // packetId = 1
    for (var i = 0; i < topics.length; i++) {
      body = body.concat(encStr(topics[i]), [0]);
    }
    return [0x82].concat(encLen(body.length), body);
  }
  function mqttPubPkt(topic, payloadStr) {
    var body = encStr(topic).concat(toUtf8Bytes(payloadStr));
    return [0x30].concat(encLen(body.length), body);
  }

  function handleMqttPacket(u8) {
    var pos = 0;
    while (pos < u8.length) {
      var hdr = u8[pos++];
      var type = hdr >> 4;
      var mult = 1, rlen = 0, b;
      do {
        if (pos >= u8.length) return;
        b = u8[pos++];
        rlen += (b & 127) * mult;
        mult *= 128;
      } while ((b & 128) !== 0);
      var end = pos + rlen;
      if (end > u8.length) return;
      if (type === 2) { // CONNACK
        mqttConnected = true;
        sendBytes(mqttSubPkt(['shiomi3d/v1/players/#', 'shiomi3d/v1/chat', 'shiomi3d/v1/ai/state']));
        publishState(true);
      } else if (type === 3) { // PUBLISH
        var p = pos;
        var tlen = (u8[p] << 8) | u8[p + 1]; p += 2;
        var topic = fromUtf8Bytes(u8, p, p + tlen); p += tlen;
        if ((hdr & 6) > 0) p += 2; // QoS > 0 packetId
        var msg = fromUtf8Bytes(u8, p, end);
        onMqttMessage(topic, msg);
      }
      pos = end;
    }
  }

  function onMqttMessage(topic, msg) {
    try {
      var data = JSON.parse(msg);
      if (topic.indexOf('shiomi3d/v1/players/') === 0) {
        if (!data || !data.id || data.id === MY_ID) return;
        if (data.offline) { delete ONLINE_PLAYERS[data.id]; return; }
        data._rx = new Date().getTime();
        ONLINE_PLAYERS[data.id] = data;
      } else if (topic === 'shiomi3d/v1/chat') {
        if (data && data.name && data.text) {
          lastChatMsg = data.name + ': ' + data.text;
        }
      } else if (topic === 'shiomi3d/v1/ai/state') {
        if (data && data.trains && data.trains.length) {
          AI_TRAINS = data.trains;
        }
      }
    } catch(e) {}
  }

  function initMqtt() {
    if (typeof WebSocket === 'undefined') return;
    if (ws) { try { ws.close(); } catch(e) {} ws = null; }
    mqttConnected = false;
    var url = BROKERS[brokerIdx % BROKERS.length];
    try {
      ws = new WebSocket(url, 'mqtt');
      ws.binaryType = 'arraybuffer';
      ws.onopen = function() {
        sendBytes(mqttConnectPkt(MY_ID));
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(function() {
          if (mqttConnected) sendBytes([0xC0, 0x00]); // PINGREQ
        }, 20000);
      };
      ws.onmessage = function(ev) {
        if (ev.data && typeof ev.data !== 'string') {
          handleMqttPacket(new Uint8Array(ev.data));
        }
      };
      ws.onclose = function() {
        mqttConnected = false;
        setTimeout(function() {
          brokerIdx++;
          if (root.style.display === 'block') initMqtt();
        }, 3000);
      };
      ws.onerror = function() { mqttConnected = false; };
    } catch(e) {
      mqttConnected = false;
    }
  }

  function countOnline() {
    var now = new Date().getTime();
    var c = 1;
    for (var id in ONLINE_PLAYERS) {
      if (now - ONLINE_PLAYERS[id]._rx > 15000) delete ONLINE_PLAYERS[id];
      else c++;
    }
    return c;
  }

  var root = document.createElement('div');
  root.id = 'mode3dsRoot';
  root.style.cssText = 'display:none;background:#080c16;color:#eef2f8;padding:4px;font-family:sans-serif;max-width:400px;margin:0 auto;';
  document.body.insertBefore(root, document.body.firstChild);

  var homeEl = document.getElementById('home');
  var timerId = null;
  var drivingActive = false;

  var st = {
    mode: 'local',
    svc: 'lo',
    key: 'A',
    dir: 1,
    s: 3000.0,
    v: 0,
    notch: -3,
    doorOpen: true,
    atStIdx: 0,
    nextStIdx: 1,
    distKm: 0,
    hornT: 0,
    msg: '扉を閉めて発車してください',
    msgT: 0
  };

  var lastPubT = 0;
  function publishState(force) {
    if (!mqttConnected) return;
    var now = new Date().getTime();
    if (!force && now - lastPubT < 450) return;
    lastPubT = now;
    var nx = STATIONS[st.nextStIdx];
    var payload = {
      id: MY_ID,
      name: MY_NAME,
      isDev: false,
      state: drivingActive ? 'driving' : 'title',
      isPax: false,
      line: 'loop',
      service: drivingActive ? st.svc : null,
      key: drivingActive ? st.key : null,
      dir: st.dir,
      s: drivingActive ? st.s : null,
      v: drivingActive ? st.v : 0,
      door: st.doorOpen ? 'open' : 'closed',
      doorSide: 1,
      doorFrac: st.doorOpen ? 1 : 0,
      hornT: st.hornT > 0 ? st.hornT : 0,
      hornKind: 'elec',
      nCar: st.mode === 'exp' ? 12 : (st.mode === 'rapid' ? 8 : 6),
      stName: nx ? nx.name : '汐見',
      dest: nx ? nx.name : '汐見',
      ts: now
    };
    sendBytes(mqttPubPkt('shiomi3d/v1/players/' + MY_ID, JSON.stringify(payload)));
  }

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
    drivingActive = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (homeEl) { homeEl.className = (homeEl.className || '') + ' hide'; }
    root.style.display = 'block';
    try { window.scrollTo(0, 0); } catch(e) {}
    if (!ws || (!mqttConnected && ws.readyState !== 0)) initMqtt();

    root.innerHTML =
      '<div style="background:#0f172a;border:1px solid #38bdf8;border-radius:8px;padding:10px;">' +
      '<table style="width:100%;margin-bottom:6px;"><tr>' +
      '<td><strong style="font-size:15px;color:#38bdf8;">汐見環状線（オンライン同期）</strong></td>' +
      '<td style="text-align:right;"><button id="m3BackHome" style="background:#1e293b;color:#fff;border:1px solid #475569;border-radius:6px;padding:4px 10px;font-size:12px;">戻る</button></td>' +
      '</tr></table>' +
      '<div id="m3MenuNet" style="font-size:11px;color:#93c5fd;margin-bottom:8px;">オンライン接続中...</div>' +
      '<button data-m="local" data-d="1" data-s="lo" data-k="A" style="display:block;width:100%;text-align:left;background:#14935f;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">各駅停車 外回り（全85駅）</button>' +
      '<button data-m="local" data-d="-1" data-s="li" data-k="B" style="display:block;width:100%;text-align:left;background:#0f764b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">各駅停車 内回り（全85駅）</button>' +
      '<button data-m="rapid" data-d="1" data-s="ro" data-k="C" style="display:block;width:100%;text-align:left;background:#e8731e;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速 外回り（50駅停車）</button>' +
      '<button data-m="rapid" data-d="-1" data-s="ri" data-k="D" style="display:block;width:100%;text-align:left;background:#c25912;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速 内回り（50駅停車）</button>' +
      '<button data-m="exp" data-d="1" data-s="eo" data-k="E" style="display:block;width:100%;text-align:left;background:#c8322b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:6px;font-size:13px;font-weight:bold;">快速特急 外回り（16駅停車）</button>' +
      '<button data-m="exp" data-d="-1" data-s="ei" data-k="F" style="display:block;width:100%;text-align:left;background:#991b1b;color:#fff;border:none;border-radius:6px;padding:9px 10px;margin-bottom:4px;font-size:13px;font-weight:bold;">快速特急 内回り（16駅停車）</button>' +
      '</div>';

    var netTimer = setInterval(function() {
      var el = document.getElementById('m3MenuNet');
      if (!el) { clearInterval(netTimer); return; }
      el.textContent = mqttConnected ? ('オンライン接続中（' + countOnline() + '名乗務中・他端末と同じワールド）') : '接続試行中（オフラインでも運転可）';
    }, 500);

    document.getElementById('m3BackHome').onclick = function() {
      clearInterval(netTimer);
      root.style.display = 'none';
      if (homeEl) homeEl.className = (homeEl.className || '').replace(/\bhide\b/g, '');
    };
    var btns = root.querySelectorAll('button[data-m]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function() {
        clearInterval(netTimer);
        startDrive(
          this.getAttribute('data-m'),
          parseInt(this.getAttribute('data-d'), 10),
          this.getAttribute('data-s'),
          this.getAttribute('data-k')
        );
      };
    }
  }

  function startDrive(mode, dir, svc, key) {
    drivingActive = true;
    st.mode = mode;
    st.dir = dir;
    st.svc = svc;
    st.key = key;
    st.s = STATIONS[0].s;
    st.v = 0;
    st.notch = -3;
    st.doorOpen = true;
    st.atStIdx = 0;
    st.nextStIdx = findNextStop(0, dir, mode);
    st.hornT = 0;
    st.msg = 'ドアを閉めて発車（汐見 停車中）';
    st.msgT = 3;
    publishState(true);

    root.innerHTML =
      '<div style="background:#0b1322;border:1px solid #334155;border-radius:6px;overflow:hidden;">' +
      '<table style="width:100%;background:#0f172a;font-size:11px;padding:3px 6px;"><tr>' +
      '<td><span style="background:' + modeColor(mode) + ';color:#fff;padding:1px 5px;border-radius:3px;font-weight:bold;">' + modeLabel(mode) + '</span> <span id="m3Net" style="color:#38bdf8;">接続中</span></td>' +
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
      '<div id="m3Msg" style="font-size:11px;color:#fef08a;text-align:center;min-height:15px;margin-bottom:4px;white-space:nowrap;overflow:hidden;"></div>' +
      '<table style="width:100%;border-collapse:separate;border-spacing:4px;">' +
      '<tr>' +
      '<td style="width:25%;"><button id="bUp" style="width:100%;height:40px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">力行 +</button></td>' +
      '<td style="width:25%;"><button id="bNeu" style="width:100%;height:40px;background:#475569;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">N 惰行</button></td>' +
      '<td style="width:25%;"><button id="bDn" style="width:100%;height:40px;background:#b45309;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">制動 -</button></td>' +
      '<td style="width:25%;"><button id="bEb" style="width:100%;height:40px;background:#b91c1c;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">非常 EB</button></td>' +
      '</tr>' +
      '<tr>' +
      '<td style="width:34%;"><button id="bDoor" style="width:100%;height:36px;background:#0f766e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">ドア開閉</button></td>' +
      '<td style="width:33%;"><button id="bHorn" style="width:100%;height:36px;background:#6d28d9;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">警笛</button></td>' +
      '<td style="width:33%;"><button id="bChat" style="width:100%;height:36px;background:#0369a1;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:bold;">挨拶送信</button></td>' +
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
      publishState(true);
    };
    document.getElementById('bChat').onclick = function() {
      if (!mqttConnected) { st.msg = '未接続のため送信できません'; st.msgT = 1.5; return; }
      sendBytes(mqttPubPkt('shiomi3d/v1/chat', JSON.stringify({
        id: MY_ID, name: MY_NAME, text: 'よろしくお願いします！(3DS)', ts: new Date().getTime()
      })));
      st.msg = 'チャット送信しました！';
      st.msgT = 1.5;
    };
    document.getElementById('bDoor').onclick = function() {
      if (st.v > 0.2) { st.msg = '走行中はドアを開けられません'; st.msgT = 1.5; return; }
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
        st.msg = '戸閉完了！発車できます';
        st.msgT = 2.0;
      }
      publishState(true);
    };

    window.onkeydown = function(e) {
      if (root.style.display !== 'block' || !drivingActive) return;
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
      if (st.hornT > 0) st.hornT -= dt;
      if (st.msgT > 0) st.msgT -= dt;

      publishState(false);

      var nxSt = STATIONS[st.nextStIdx];
      var dNext = distToStation(nxSt);
      if (dNext > TOTAL_L - 40) dNext = dNext - TOTAL_L;

      // Render pseudo-3D Canvas
      var W = cv.width, H = cv.height, HY = 74;
      var curNear = STATIONS[st.atStIdx];
      var inTunnel = (curNear && curNear.tunnel && distToStation(curNear) < 400) || (nxSt.tunnel && dNext < 400);

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
        ctx.fillStyle = '#53687e';
        var blds = [14,22,10,28,16,20,12,26,18,14,24,12,20];
        for (var bi = 0; bi < blds.length; bi++) ctx.fillRect(bi * 25, HY - blds[bi], 22, blds[bi]);
        ctx.fillStyle = '#2d4f32';
        ctx.fillRect(0, HY, W, H - HY);
      }

      var vx = W * 0.5;
      function projX(worldX, z) { return vx + (worldX * 135) / z; }
      function projY(z) { return HY + 135 / z; }

      ctx.fillStyle = '#383a40';
      ctx.beginPath();
      ctx.moveTo(vx - 26, HY); ctx.lineTo(vx + 26, HY); ctx.lineTo(W + 30, H); ctx.lineTo(-30, H);
      ctx.closePath(); ctx.fill();

      var segLen = 5;
      var phase = mod(st.s, segLen) / segLen;
      var baseIdx = Math.floor(st.s / segLen);
      for (var k = 11; k >= 0; k--) {
        var z1 = 1.4 + (k + (1 - phase)) * 2.1;
        var y1 = projY(z1);
        if (y1 >= H) continue;
        var idxObj = baseIdx + k;

        if (!inTunnel) {
          var sideL = projX(-6.5, z1);
          var sideR = projX(8.5, z1);
          var bh = ((idxObj * 17) % 3 + 2) * (28 / z1);
          var bw = 55 / z1;
          ctx.fillStyle = (idxObj % 2 === 0) ? '#475569' : '#64748b';
          ctx.fillRect(sideL - bw, y1 - bh, bw, bh);
          ctx.fillStyle = (idxObj % 3 === 0) ? '#334155' : '#4b5563';
          ctx.fillRect(sideR, y1 - bh * 0.85, bw, bh * 0.85);
        }

        var wTie = 88 / z1;
        ctx.fillStyle = '#524436';
        ctx.fillRect(vx - wTie * 0.55, y1, wTie, Math.max(1, 3 / z1));
        ctx.fillRect(projX(3.0, z1) - wTie * 0.45, y1, wTie * 0.9, Math.max(1, 3 / z1));

        if (mod(idxObj, 3) === 0) {
          var pxL = projX(-2.2, z1), pxR = projX(5.2, z1), topY = HY - 88 / z1;
          ctx.fillStyle = '#71717a';
          ctx.fillRect(pxL - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxR - 1, topY, 2, y1 - topY);
          ctx.fillRect(pxL, topY + 2, pxR - pxL, 2);
        }
      }

      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx - 3, HY); ctx.lineTo(vx - 46, H);
      ctx.moveTo(vx + 3, HY); ctx.lineTo(vx + 46, H);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(vx + 8, HY); ctx.lineTo(vx + 115, H);
      ctx.moveTo(vx + 13, HY); ctx.lineTo(vx + 155, H);
      ctx.moveTo(vx - 9, HY); ctx.lineTo(vx - 115, H);
      ctx.stroke();

      // Station
      if (dNext < 220 && dNext > -20) {
        var zSt = Math.max(1.5, dNext * 0.13);
        var ySt = projY(zSt);
        var pw = 135 / zSt, ph = 38 / zSt, edgeX = projX(-1.25, zSt);
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(edgeX - pw, ySt - ph, pw, ph);
        ctx.fillStyle = '#facc15'; ctx.fillRect(edgeX - 4, ySt - ph, 4, ph * 0.35);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(edgeX - pw, ySt - ph - 68 / zSt, pw + 10 / zSt, 8 / zSt);
        if (dNext < 140) {
          ctx.fillStyle = '#0f172a'; ctx.fillRect(vx - 54, 14, 108, 22);
          ctx.strokeStyle = modeColor(st.mode); ctx.lineWidth = 2; ctx.strokeRect(vx - 54, 14, 108, 22);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(nxSt.name + ' (' + Math.max(0, Math.round(dNext)) + 'm)', vx, 29);
        }
      }

      // Draw nearby online players & AI trains in the SAME world!
      var drawList = [];
      for (var pid in ONLINE_PLAYERS) {
        var op = ONLINE_PLAYERS[pid];
        if (!op || op.state !== 'driving' || op.line !== 'loop' || op.s == null) continue;
        var df = sdiff(st.s, op.s) * st.dir;
        if (df > 4 && df < 240) {
          var trackX = (op.dir === st.dir) ? (op.key === st.key ? 0 : -2.6) : 3.0;
          drawList.push({ d: df, x: trackX, key: op.key || 'A', label: op.name || '運転士', isPlayer: true });
        }
      }
      for (var ai = 0; ai < AI_TRAINS.length; ai++) {
        var tr = AI_TRAINS[ai];
        if (!tr || tr.s == null) continue;
        var df2 = sdiff(st.s, tr.s) * st.dir;
        if (df2 > 6 && df2 < 200) {
          var tx = (tr.dir === st.dir) ? (tr.key === st.key ? 0 : -2.6) : 3.0;
          drawList.push({ d: df2, x: tx, key: tr.key || 'A', label: null, isPlayer: false });
        }
      }
      drawList.sort(function(a, b) { return b.d - a.d; });
      for (var di = 0; di < drawList.length; di++) {
        var trn = drawList[di];
        var zT = Math.max(1.7, trn.d * 0.13);
        var xT = projX(trn.x, zT), yT = projY(zT);
        var tw = 88 / zT, th = 112 / zT;
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(xT - tw / 2, yT - th, tw, th);
        ctx.fillStyle = '#0f172a'; ctx.fillRect(xT - tw * 0.4, yT - th * 0.78, tw * 0.8, th * 0.25);
        ctx.fillStyle = (trn.key === 'E' || trn.key === 'F') ? '#c8322b' : (trn.key === 'C' || trn.key === 'D') ? '#e8731e' : '#14935f';
        ctx.fillRect(xT - tw / 2, yT - th * 0.45, tw, th * 0.14);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(xT - tw * 0.34, yT - th * 0.2, tw * 0.16, th * 0.08);
        ctx.fillRect(xT + tw * 0.18, yT - th * 0.2, tw * 0.16, th * 0.08);
        if (trn.isPlayer && trn.label) {
          ctx.fillStyle = 'rgba(15,23,42,0.85)';
          ctx.fillRect(xT - 40, yT - th - 16, 80, 14);
          ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(trn.label, xT, yT - th - 5);
        }
      }

      // Cab frame
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, 14, H); ctx.fillRect(W - 14, 0, 14, H); ctx.fillRect(0, 0, W, 10);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(vx + 48, 10, 8, H - 24);
      ctx.fillStyle = '#1e293b'; ctx.fillRect(0, H - 16, W, 16);

      if (st.hornT > 0) {
        ctx.fillStyle = '#fde047'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('プァーン！', vx, 56);
      }

      var elSpd = document.getElementById('m3Spd');
      var elNch = document.getElementById('m3Nch');
      var elDst = document.getElementById('m3Dst');
      var elDor = document.getElementById('m3Dor');
      var elInf = document.getElementById('m3Info');
      var elMsg = document.getElementById('m3Msg');
      var elNet = document.getElementById('m3Net');
      if (elSpd) elSpd.textContent = Math.round(st.v * 3.6) + ' km/h';
      if (elNch) elNch.textContent = notchLabel(st.notch);
      if (elDst) elDst.textContent = Math.round(dNext) + ' m';
      if (elDor) { elDor.textContent = st.doorOpen ? '開' : '閉'; elDor.style.color = st.doorOpen ? '#f87171' : '#34d399'; }
      if (elInf) elInf.textContent = '次: ' + nxSt.name;
      if (elNet) elNet.textContent = mqttConnected ? ('接続:' + countOnline() + '名') : 'オフライン';
      if (elMsg) elMsg.textContent = st.msgT > 0 ? st.msg : (lastChatMsg ? lastChatMsg : (dNext < 15 && st.v < 0.2 ? '停車位置OK！ドアを開けられます' : ''));
    }, 50);
  }

  window.__SHIOMI_3DS_SHOW_MENU = showMenu;
  showMenu();
})();
