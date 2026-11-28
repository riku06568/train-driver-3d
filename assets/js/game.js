(function(){
'use strict';
function escapeHtml(str){return String(str==null?'':str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
/* ===== 毎日・季節連動の自動天気／毎月の自動ダイヤ（日付シード・全員同じ） =====
   プレイヤーは選ばない。日付（と季節）から決定論的に決まるので、同じ日は全員同じ天気・同じダイヤになる。
   端末の時計が同じ日付なら、サーバーなしで全員に同じ条件が出る。 */
function _hashStr(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function _rng01(seed){let t=(seed+0x6D2B79F5)>>>0;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
function _ymd(d){return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
function seasonOfDate(d){const m=d.getMonth()+1;return (m===12||m<=2)?'winter':m<=5?'spring':m<=8?'summer':'autumn';}
const SEASON_KANJI={winter:'冬',spring:'春',summer:'夏',autumn:'秋'};
/* 季節ごとの出現確率（合計1.0）。冬は雪、夏は霧・雨が増える */
const WX_SEASON={
  winter:{clear:0.38,cloudy:0.30,snow:0.22,fog:0.06,rain:0.04},
  spring:{clear:0.50,cloudy:0.26,rain:0.19,fog:0.05},
  summer:{clear:0.52,cloudy:0.24,rain:0.17,fog:0.07},
  autumn:{clear:0.48,cloudy:0.29,rain:0.16,fog:0.07}
};
const WX_ORDER=['clear','cloudy','rain','snow','fog'];
function _wxPick(d){
  const tbl=WX_SEASON[seasonOfDate(d)],r=_rng01(_hashStr('wx-'+_ymd(d)));let acc=0;
  for(const k of WX_ORDER){const p=tbl[k]||0;if(r<acc+p)return k;acc+=p;}return 'clear';
}
/* 日付だけから決まる天気。前日と同じ天気にはならず、毎日変わる */
function weatherForDate(d){
  const today=_wxPick(d);const prev=new Date(d.getTime()-86400000);const y=_wxPick(prev);
  if(today!==y)return today;
  const tbl=WX_SEASON[seasonOfDate(d)],avail=WX_ORDER.filter(k=>(tbl[k]||0)>0&&k!=='fog');
  const i=Math.max(0,avail.indexOf(today));return avail[(i+1)%avail.length]||today;
}
/* 月ごとの自動ダイヤ：臨時・団体ダイヤ2日、変更ダイヤ2日（日付は重ならない） */
const _diaMonthCache={};
function monthlyDiaPlan(d){
  const y=d.getFullYear(),m=d.getMonth(),key=y+'-'+m;
  if(_diaMonthCache[key])return _diaMonthCache[key];
  const dim=new Date(y,m+1,0).getDate(),seed=_hashStr('dia-'+key);
  const used=new Set(),pick=(salt)=>{for(let i=0;i<600;i++){const v=(_rng01((seed+salt*7919+i*2654435761)>>>0)*dim|0)+1;if(!used.has(v)){used.add(v);return v;}}return 1;};
  const extra=[pick(1),pick(2)],change=[pick(3),pick(4)];
  const plan={extra:extra.sort((a,b)=>a-b),change:change.sort((a,b)=>a-b),key};
  _diaMonthCache[key]=plan;return plan;
}
function diaForDate(d){
  const p=monthlyDiaPlan(d),day=d.getDate();
  if(p.extra.includes(day))return 'extra';
  if(p.change.includes(day))return 'change';
  return 'normal';
}
const DIA_NAME={normal:'通常ダイヤ',extra:'臨時・団体ダイヤ',change:'変更ダイヤ'};
const WX_NAME={clear:'晴れ',cloudy:'曇り',rain:'雨',snow:'雪',fog:'霧'};
const WX_ICON={clear:'☀️',cloudy:'☁️',rain:'🌧️',snow:'❄️',fog:'🌫️'};
function dailyCondition(){const now=new Date();const wid=weatherForDate(now),dia=diaForDate(now);
  return {wid,dia,date:now,wxName:(WX_NAME[wid]||'晴れ'),season:SEASON_KANJI[seasonOfDate(now)],diaName:DIA_NAME[dia]};}
/* タイトル・運転条件モーダル・HUDの「今日の天気／ダイヤ」表示を更新する */
function dailyCondText(){
  const c=(window.__DAILY_COND&&window.__DAILY_COND.wid)?window.__DAILY_COND:dailyCondition();
  const wk=['日','月','火','水','木','金','土'][c.date.getDay()];
  const man=(()=>{try{return localStorage.getItem('td_dia')||'auto';}catch(e){return 'auto';}})();
  const dispDia=(man==='normal'||man==='extra'||man==='change')?man:c.dia;
  return {short:WX_ICON[c.wid]+' '+c.wxName+'　'+DIA_NAME[dispDia]+(man!=='auto'?'（手動）':''),
    long:WX_ICON[c.wid]+' 今日の天気：'+c.wxName+'（'+c.season+'・'+ (c.date.getMonth()+1)+'月'+c.date.getDate()+'日 '+wk+'）\n🚄 今日のダイヤ：'+DIA_NAME[dispDia]+(man!=='auto'?'（手動で選択中）':'（毎月自動で変わります）')};
}
function refreshDailyCond(){
  let t=null;try{t=dailyCondText();}catch(e){return;}
  const a=document.getElementById('dailyCondText');if(a)a.textContent=t.short;
  const m=document.getElementById('dailyCondModal');if(m)m.textContent=t.long;
  const b=document.getElementById('condBadge');
  const man=(()=>{try{return localStorage.getItem('td_dia')||'auto';}catch(e){return 'auto';}})();
  const dc=window.__DAILY_COND||{};
  const dispDia=(man==='normal'||man==='extra'||man==='change')?man:(dc.dia||'normal');
  if(b){b.innerHTML=WX_ICON[dc.wid||'clear']+' '+(dc.wxName||'')+'<br>🚄 '+(DIA_NAME[dispDia]||dc.diaName||'')+'<span style="opacity:.65">（'+(dc.season||'')+'）</span>';}
}
window.__refreshDailyCond=refreshDailyCond;
/* 画質・動作の設定：extreme=最軽量 ultralight=超軽量（低スペック向け） light=軽い normal=普通 heavy=重い（最高画質） */
const AV_DEF={female:false,height:170,skin:0,hair:0,hairLong:false,tails:false,topStyle:'shirt',top:0x2f3b52,sleeve:'long',bottom:'long',bottomC:0x2b2d33,skirtType:1,skirtLen:0.36,sock:0,sockC:0xf4f2ec,shoeC:0x2a2a2a,bag:0,glasses:false};
let AVATAR=(()=>{try{return Object.assign({},AV_DEF,JSON.parse(localStorage.getItem('td_avatar')||'{}'));}catch(e){return Object.assign({},AV_DEF);}})(); /* 乗客モードの自分の見た目 */
let CREWSEL=(()=>{try{const v=localStorage.getItem('td_crew');return v==='twoD'||v==='twoC'?v:'one';}catch(e){return 'one';}})(); /* 快速特急の乗務：one=ワンマン twoD=ツーマン（運転士） twoC=ツーマン（車掌） */
let QMODE=(()=>{try{const v=localStorage.getItem('td_quality');return (v==='extreme'||v==='ultralight'||v==='normal'||v==='heavy')?v:'light';}catch(e){return 'light';}})();
/* 乱数：普段はMath.random。乗客（AI）の生成だけは、全端末で同じ人が同じ場所に出るよう
   決められた種（シード）の擬似乱数に切り替える（withCrowdSeed）。 */
let _RNG=Math.random;
const rand=(a,b)=>a+_RNG()*(b-a);
const irand=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[(_RNG()*a.length)|0];
function rng01(){return _RNG();}
function hash32(str){let h=2166136261;str=String(str);for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(a){a=a>>>0;return function(){a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
let _crowdSeedDepth=0,_crowdSeedPrev=null;
function withCrowdSeed(key,fn){const prev=_RNG;_RNG=mulberry32(hash32(key));_crowdSeedDepth++;try{return fn();}finally{_crowdSeedDepth--;_RNG=prev;}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const mod=(a,n)=>((a%n)+n)%n;
let seed=20260921;const srand=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const FONT='"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif';
const DOTF='"DotGothic16","MS Gothic",monospace';
let timeOffset=0;
try{const q=new URLSearchParams(location.search).get('t');
  if(q&&/^\d{1,2}:\d{2}$/.test(q)){const [hh,mm]=q.split(':').map(Number);const d=new Date();d.setHours(hh,mm,0,0);timeOffset=d.getTime()-Date.now();}}catch(e){}
const nowMs=()=>Date.now()+timeOffset;
const pad=n=>String(n).padStart(2,'0');
function hms(ms){const d=new Date(ms);return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());}
function hm(ms){const d=new Date(ms);return pad(d.getHours())+':'+pad(d.getMinutes());}

/* ================= line definitions ================= */
const LOOP_NAMES=`汐見,しおみ,Shiomi|朝霧橋,あさぎりばし,Asagiribashi|若葉野,わかばの,Wakabano|御影坂,みかげざか,Mikagezaka|朱雀台,すざくだい,Suzakudai|白鷺町,しらさぎちょう,Shirasagicho|千鳥橋,ちどりばし,Chidoribashi|月見ヶ丘,つきみがおか,Tsukimigaoka|花園口,はなぞのぐち,Hanazonoguchi|紅葉通,もみじどおり,Momijidori|小春町,こはるちょう,Koharucho|瑞穂町,みずほちょう,Mizuhocho|桜並木,さくらなみき,Sakuranamiki|蒼海中央,そうかいちゅうおう,Sokai-chuo|石畳,いしだたみ,Ishidatami|風早台,かざはやだい,Kazahayadai|鈴蘭坂,すずらんざか,Suzuranzaka|港見,みなとみ,Minatomi|青嵐,せいらん,Seiran|灯籠坂,とうろうざか,Torozaka|霞ヶ原,かすみがはら,Kasumigahara|翠湖,すいこ,Suiko|柳川原,やながわら,Yanagawara|星ヶ浦,ほしがうら,Hoshigaura|萩野,はぎの,Hagino|琴音町,ことねちょう,Kotonecho|水晶台,すいしょうだい,Suishodai|雪見坂,ゆきみざか,Yukimizaka|野分,のわき,Nowaki|茜町,あかねちょう,Akanecho|陽ノ宮,ひのみや,Hinomiya|雲雀野,ひばりの,Hibarino|松風,まつかぜ,Matsukaze|羽衣橋,はごろもばし,Hagoromobashi|楓原,かえではら,Kaedehara|鶺鴒町,せきれいちょう,Sekireicho|朧月,おぼろづき,Oborozuki|宵待橋,よいまちばし,Yoimachibashi|白峰,しらみね,Shiramine|潮騒,しおさい,Shiosai|宝来,ほうらい,Horai|波止場口,はとばぐち,Hatobaguchi|岬台,みさきだい,Misakidai|貝塚通,かいづかどおり,Kaizukadori|真砂町,まさごちょう,Masagocho|夕凪,ゆうなぎ,Yunagi|砂丘口,さきゅうぐち,Sakyuguchi|金波中央,きんぱちゅうおう,Kinpa-chuo|銀杏並木,いちょうなみき,Ichonamiki|曙橋,あけぼのばし,Akebonobashi|若竹,わかたけ,Wakatake|藤棚,ふじだな,Fujidana|蛍川,ほたるがわ,Hotarugawa|菖蒲台,あやめだい,Ayamedai|竹林,ちくりん,Chikurin|黎明中央,れいめいちゅうおう,Reimei-chuo|朝凪,あさなぎ,Asanagi|七星,ななほし,Nanahoshi|虹ヶ丘,にじがおか,Nijigaoka|流星町,りゅうせいちょう,Ryuseicho|天神坂,てんじんざか,Tenjinzaka|銀河通,ぎんがどおり,Gingadori|彩雲,さいうん,Saiun|花水木,はなみずき,Hanamizuki|紫雲新都,しうんしんと,Shiun-shinto|鳴砂橋,なりすなばし,Narisunabashi|霧笛台,むてきだい,Mutekidai|若草,わかくさ,Wakakusa|杉木立,すぎこだち,Sugikodachi|桔梗町,ききょうちょう,Kikyocho|紅梅,こうばい,Kobai|瑠璃坂,るりざか,Rurizaka|碧浜,あおはま,Aohama|白砂,しらすな,Shirasuna|帆立浜,ほたてはま,Hotatehama|浮雲町,うきぐもちょう,Ukigumocho|月影,つきかげ,Tsukikage|暁台,あかつきだい,Akatsukidai|神楽橋,かぐらばし,Kagurabashi|花筏,はないかだ,Hanaikada|陽炎,かげろう,Kagero|天宮,あまみや,Amamiya|早瀬,はやせ,Hayase|春霞,はるがすみ,Harugasumi|夕映,ゆうばえ,Yubae`.split('|').map(x=>x.split(','));
const B2_NAMES=`紫雲新都,しうんしんと,Shiun-shinto|銀杏坂,いちょうざか,Ichozaka|月読,つくよみ,Tsukuyomi|泉水町,せんすいちょう,Sensuicho|白妙,しろたえ,Shirotae|天満台,てんまだい,Tenmadai|常盤木,ときわぎ,Tokiwagi|水鏡,みかがみ,Mikagami|瑠璃野,るりの,Rurino|榊原,さかきばら,Sakakibara|霜月町,しもつきちょう,Shimotsukicho|薄氷,うすらい,Usurai|星屑,ほしくず,Hoshikuzu|紺碧,こんぺき,Konpeki|深雪,みゆき,Miyuki`.split('|').map(x=>x.split(','));
const B4_NAMES=`港見,みなとみ,Minatomi|軍港,ぐんこう,Gunko|港前,みなとまえ,Minatomae|奥港,おくみなと,Okuminato`,
B3_NAMES=`天宮,あまみや,Amamiya|陽向,ひなた,Hinata|雲海台,うんかいだい,Unkaidai|風見丘,かざみがおか,Kazamigaoka|茜雲,あかねぐも,Akanegumo|朝露,あさつゆ,Asatsuyu|光待台,ひかりまちだい,Hikarimachidai|空舞,そらまい,Soramai|星見野,ほしみの,Hoshimino|若草台,わかくさだい,Wakakusadai|天宮中央,あまみやちゅうおう,Amamiya-chuo|桜ヶ丘,さくらがおか,Sakuragaoka|月見坂,つきみざか,Tsukimizaka|白鷺,しらさぎ,Shirasagi|青葉通,あおばどおり,Aobadori|虹ヶ浜,にじがはま,Nijigahama|夕凪台,ゆうなぎだい,Yunagidai|水鏡,みずかがみ,Mizukagami|春日野,かすがの,Kasugano|鈴鳴,すずなり,Suzunari|雲雀ヶ原,ひばりがはら,Hibarigahara|千草,ちぐさ,Chigusa|高峰口,たかみねぐち,Takamineguchi|霧ヶ谷,きりがや,Kirigaya|翡翠台,ひすいだい,Hisuidai|風車,かざぐるま,Kazaguruma|花野,はなの,Hanano|天空橋,てんくうばし,Tenkubashi|銀河台,ぎんがだい,Gingadai|小春,こはる,Koharu|蒼穹,そうきゅう,Sokyu|瑠璃川,るりかわ,Rurikawa|陽炎,かげろう,Kagero|松風,まつかぜ,Matsukaze|星降,ほしふり,Hoshifuri|暁,あかつき,Akatsuki|雪見台,ゆきみだい,Yukimidai|紅葉谷,もみじだに,Momijidani|遠峰,とおみね,Tomine|峰月,ほうげつ,Hogetsu`.split('|').map(x=>x.split(','));
const BRANCH_NAMES=`白峰,しらみね,Shiramine|山吹,やまぶき,Yamabuki|渓谷口,けいこくぐち,Keikokuguchi|滝見,たきみ,Takimi|杜の里,もりのさと,Morinosato|奥峰,おくみね,Okumine`.split('|').map(x=>x.split(','));
/* 四嶺連絡線：白峰・紫雲地下・天宮高架・港見の4支線の終点どうしを結ぶ連絡線 */
const B5_NAMES=`奥峰,おくみね,Okumine|白嶺,はくれい,Hakurei|深雪,みゆき,Miyuki|紫嶺,しれい,Shirei|峰月,ほうげつ,Hogetsu|天嶺,てんれい,Tenrei|奥港,おくみなと,Okuminato`.split('|').map(x=>x.split(','));
const MAINS=[4,13,21,30,38,47,55,64,72,81];
const CITYLINES_ALL={
  4:[['朱雀線','すざくせん',0xc8322b],['高原線','こうげんせん',0x3f8f3f],['地下鉄みどり線','ちかてつみどりせん',0x2e8b57],['湾岸線','わんがんせん',0x2aa6d8]],
  13:[['蒼海線','そうかいせん',0x1f5fbf],['北嶺線','ほくれいせん',0xe3b31b],['みなと線','みなとせん',0x7a3fa0],['白浜線','しらはません',0x2aa6d8]],
  17:[['港見支線','みなとみしせん',0x2a5caa]],
  21:[['翠湖線','すいこせん',0x2ab0a0],['丘陽線','きゅうようせん',0xd4a017],['地下鉄こだま線','ちかてつこだません',0x7a3fa0],['湖畔線','こはんせん',0x1f5fbf]],
  30:[['東都線','とうとせん',0xc8322b],['丘陵線','きゅうりょうせん',0x8a5a2b],['地下鉄あおば線','ちかてつあおばせん',0x2e8b57],['臨海線','りんかいせん',0x2aa6d8]],
  38:[['白峰支線','しらみねしせん',0x5aa832],['峰越線','みねごえせん',0x8a5a2b],['地下鉄ひばり線','ちかてつひばりせん',0xe0502a],['北原線','きたはらせん',0x243a73]],
  47:[['金波線','きんぱせん',0xd4a017],['海峡線','かいきょうせん',0x1f4fa0],['東雲線','しののめせん',0xd9668f],['地下鉄ひかり線','ちかてつひかりせん',0xe0502a]],
  55:[['黎明線','れいめいせん',0xe8731e],['地下鉄あかつき線','ちかてつあかつきせん',0xd9668f],['東海岸線','ひがしかいがんせん',0x2aa6d8],['西谷線','にしたにせん',0x3f8f3f]],
  64:[['紫雲地下線','しうんちかせん',0x7a3fa0],['空港線','くうこうせん',0x243a73],['西岳線','せいがくせん',0x3f8f3f],['地下鉄つばさ線','ちかてつつばさせん',0xe3b31b]],
  72:[['碧浜線','あおはません',0x1f4fa0],['臨港線','りんこうせん',0x2aa6d8],['地下鉄しおかぜ線','ちかてつしおかぜせん',0x2e8b57],['浜手線','はまてせん',0xd4a017]],
  81:[['天宮高架線','あまみやこうかせん',0x2aa6d8],['南山線','なんざんせん',0x3f8f3f],['地下鉄すばる線','ちかてつすばるせん',0xe3b31b],['空港快速線','くうこうかいそくせん',0x243a73]]};
const LINE_EN={'快速線':'the Rapid Line','環状線':'the Loop Line','新幹線':'the Shinkansen','白峰支線':'the Shiramine Branch Line','汐見環状線':'the Shiomi Loop Line'};
for(const k in CITYLINES_ALL)for(const [n,y] of CITYLINES_ALL[k])if(!LINE_EN[n])LINE_EN[n]='the '+n.replace(/^地下鉄/,'Subway ').replace(/線$/,' Line');
function pickEven(pool,n){const r=[];for(let j=0;j<n;j++){r.push(pool[Math.min(pool.length-1,Math.round((j+0.5)*pool.length/n-0.5))]);}return [...new Set(r)];}
function lineConfig(id){
  if(id==='branch')return {id,branch:true,L:20000,s0:2200,R:2600,names:BRANCH_NAMES,seed:777,gapBase:1350,extra:{1:260},mains:[],junction:0,
    sections:[{k:'river',between:[1,2],h:5},{k:'tunnel',between:[3,4],h:-10}],cross:[[4,5]],limits:[],trackRange:true};
  /* 紫雲地下線：v2.4.0で駅間距離を1kmに統一して作り直し（全15駅・起点から終点まで1,000m間隔）
     深雪駅の先はトンネルが続くため、線路全長には余裕（約2.4km）を持たせている */
  if(id==='branch2')return {id,branch:true,L:19000,s0:2600,R:4400,names:B2_NAMES,seed:9181,gapList:Array(15).fill(1000),extra:{},mains:[],junction:0,
    sections:[{k:'under',a:0,b:14,h:-14}],cross:[],limits:[],trackRange:true};
  if(id==='branch4')return {id,branch:true,mini:{loop:2,coast:[1,2],port:1},ncar:3,L:16000,s0:1800,R:1500,names:B4_NAMES.split('|').map(x=>x.split(',')),seed:4421,gapBase:1750,extra:{1:350},mains:[],junction:0,isl:false,
    sections:[],cross:[[2,3]],limits:[],trackRange:true}; /* 港見支線：単線・3両・港前で行き違い */
  if(id==='branch5'){ /* 四嶺連絡線：末尾の4支線の終点を結ぶ連絡線。
      環状線の乗換駅（白峰38・紫雲64・天宮81・港見17）の位置から、各終点までの弦長を計算し、
      奥峰→白嶺→深雪→紫嶺→峰月→天嶺→奥港の駅間距離をその比率で配分した（全長 約71km）。
      以前は全長26km・駅間3.0kmで、環状線（駅間約1.2km）や各支線の位置関係に対して縮尺が合っていなかった。 */
    return {id,branch:true,L:71400,s0:2000,R:11100,names:B5_NAMES,seed:5511,gapBase:13450,
      gapList:[13450,13450,9650,9650,11500,11500],extra:{},mains:[],junction:0,isl:false,
      sections:[{k:'elev',a:1,b:2,h:8}],cross:[[4,5]],limits:[],trackRange:true};}
  if(id==='branch3')return {id,branch:true,b3:true,L:58000,s0:2400,R:3000,names:B3_NAMES,seed:3307,gapBase:1250,extra:{0:1000},mains:[],junction:0,
    q:[10,20,30],t:[15],isl:false,rapidStops:[0,5,10,11,16,20,23,27,30,34,35,36,37,38,39], /* 10・20・30駅＝2面4線、15駅＝通過線あり */
    sections:[{k:'elev',a:1,b:14,h:10},{k:'elev',a:22,b:31,h:10},{k:'elev',a:33,b:38,h:10}],cross:[],limits:[],trackRange:true};
  const n=LOOP_NAMES.length,nonMain=[...Array(n).keys()].filter(i=>!MAINS.includes(i));
  let X=pickEven(nonMain,29);if(!X.includes(0)){X.sort((a,b)=>a-b);X[0]=0;}
  const rest=nonMain.filter(i=>!X.includes(i)),R=pickEven(rest,11);
  for(const i of X.filter(i=>i>7&&i<13)){X.splice(X.indexOf(i),1);R.push(i);} // 快速特急は月見ヶ丘〜蒼海中央をノンストップ
  { // 快速特急は主要駅すべてと、元の停車駅から選んだ6駅だけに停まる
    const keep=[0],pool=X.filter(i=>i!==0);let rs=20260923;const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
    while(keep.length<6&&pool.length){const j=Math.floor(rnd()*pool.length);keep.push(pool.splice(j,1)[0]);}
    for(const i of pool)R.push(i);X=keep;}
  /* 夕映駅（84）は快速停車駅にする（快速特急は通過） */
  X=X.filter(i=>i!==84);if(!R.includes(84))R.push(84);
  const extra={84:2400};
  const sections=[];
  /* 高架と地下を交互に：各3駅ぶんの高架区間9か所・地下区間8か所（環状線の6割近い駅が高架かトンネルになる） */
  for(const [a,b] of [[2,4],[12,14],[22,24],[32,34],[42,44],[52,54],[62,64],[72,74],[82,84]])sections.push({k:'elev',a,b,h:9.5});
  for(const [a,b] of [[7,9],[17,19],[27,29],[37,39],[47,49],[57,59],[67,69],[77,79]])sections.push({k:'under',a,b,h:-13.5});
  for(const k of [33,83]){sections.push({k:'river',between:[k,k+1],h:5.5});extra[k]=(extra[k]||0)+360;}
  return {id,L:0,s0:3000,R:0,names:LOOP_NAMES,seed:20260921,gapBase:1180,extra,mains:MAINS,X,R2:R,junction:38,shin:55,
    sections,cross:[[7,8],[15,16],[27,28],[45,46],[70,71]],limits:[[5,6,60],[26,27,55],[48,49,65],[79,80,70]]};
}
// deterministic station layout (shared by the home screen and the game)
function layoutStations(cfg){
  seed=cfg.seed;const n=cfg.names.length,gaps=[];let sum=0;
  if(cfg.gapList){for(let k=0;k<n;k++){const g=cfg.gapList[k]||cfg.gapList[cfg.gapList.length-1];gaps.push(g);sum+=g;}}
  else for(let k=0;k<n;k++){let g=cfg.gapBase+(srand()-0.5)*420;if(cfg.mains.includes(k)||cfg.mains.includes((k+1)%n))g+=240;g+=cfg.extra[k]||0;gaps.push(g);sum+=g;}
  if(!cfg.L)cfg.L=Math.round(sum/1000)*1000;
  const scale=cfg.branch?1:cfg.L/sum;let s=cfg.s0;const st=[];
  for(let k=0;k<n;k++){const [name,yomi,kana]=cfg.names[k];
    const cls=cfg.mini?(k===cfg.mini.loop?'I':'L'):cfg.branch?(k===cfg.junction?'J':(cfg.q&&cfg.q.includes(k))?'Q':(cfg.t&&cfg.t.includes(k))?'T':(cfg.isl!==false&&k===Math.floor(n/2))?'I':'L'): /* I＝島式の途中駅 Q＝2面4線 T＝通過線あり */cfg.mains.includes(k)?'M':cfg.X.includes(k)?'X':cfg.R2.includes(k)?'R':'L';
    st.push({i:k,name,yomi,kana,s:mod(s,cfg.L),cls});s+=gaps[k]*scale;}
  return st;
}
function genPath(L,R0){const px=new Float64Array(L+1),pz=new Float64Array(L+1),th=new Float64Array(L+1);
  const N=Math.max(72000,L*2),xs=new Float64Array(N+1),zs=new Float64Array(N+1),cum=new Float64Array(N+1),R=R0||L/6.4;
  for(let k=0;k<=N;k++){const f=k/N*Math.PI*2;
    const r=R*(1+0.16*Math.cos(2*f+0.4)+0.06*Math.sin(3*f+1.1)+0.03*Math.cos(5*f+2.0)+0.012*Math.sin(9*f+0.7)+0.006*Math.sin(15*f+0.3));
    xs[k]=r*Math.cos(f);zs[k]=-r*Math.sin(f);if(k)cum[k]=cum[k-1]+Math.hypot(xs[k]-xs[k-1],zs[k]-zs[k-1]);}
  const sc=L/cum[N];let k=0;
  for(let i=0;i<L;i++){const tg=i/sc;while(k<N-1&&cum[k+1]<tg)k++;const f=(tg-cum[k])/((cum[k+1]-cum[k])||1);px[i]=(xs[k]+(xs[k+1]-xs[k])*f)*sc;pz[i]=(zs[k]+(zs[k+1]-zs[k])*f)*sc;}
  px[L]=px[0];pz[L]=pz[0];let prev=0;
  for(let i=0;i<L;i++){let t=Math.atan2(px[i+1]-px[i],-(pz[i+1]-pz[i]));if(i>0){while(t-prev>Math.PI)t-=2*Math.PI;while(t-prev<-Math.PI)t+=2*Math.PI;}th[i]=t;prev=t;}
  let t0=th[0];while(t0-th[L-1]>Math.PI)t0-=2*Math.PI;while(t0-th[L-1]<-Math.PI)t0+=2*Math.PI;th[L]=t0;return {px,pz,th};}
/* services */
const SERVICES={lo:{key:'A',name:'各駅停車　外回り',short:'各停 外回り',en:'Local, Outer Circle',col:'#14935f',kind:'local'},li:{key:'B',name:'各駅停車　内回り',short:'各停 内回り',en:'Local, Inner Circle',col:'#14935f',kind:'local'},
  ro:{key:'C',name:'快速　外回り',short:'快速 外回り',en:'Rapid, Outer Circle',col:'#e8731e',kind:'rapid'},ri:{key:'D',name:'快速　内回り',short:'快速 内回り',en:'Rapid, Inner Circle',col:'#e8731e',kind:'rapid'},
  eo:{key:'E',name:'快速特急　外回り',short:'快特 外回り',en:'Limited Rapid Express, Outer Circle',col:'#c8322b',kind:'ltd'},ei:{key:'F',name:'快速特急　内回り',short:'快特 内回り',en:'Limited Rapid Express, Inner Circle',col:'#c8322b',kind:'ltd'},
  test:{key:'A',name:'試運転　外回り',short:'試運転',en:'Test Run, Outer Circle',col:'#8a939f',kind:'test',dir:1},testi:{key:'B',name:'試運転　内回り',short:'試運転',en:'Test Run, Inner Circle',col:'#8a939f',kind:'test',dir:-1},
  exo:{key:'C',name:'臨時列車　外回り',short:'臨時 外回り',en:'Extra Event Train, Outer Circle',col:'#0ea5e9',kind:'extra',dir:1},exi:{key:'D',name:'臨時列車　内回り',short:'臨時 内回り',en:'Extra Event Train, Inner Circle',col:'#0ea5e9',kind:'extra',dir:-1},
  cho:{key:'A',name:'団体列車　外回り',short:'団体 外回り',en:'Charter Event Train, Outer Circle',col:'#a855f7',kind:'charter',dir:1},chi:{key:'B',name:'団体列車　内回り',short:'団体 内回り',en:'Charter Event Train, Inner Circle',col:'#a855f7',kind:'charter',dir:-1},
  pax:{key:'A',name:'乗客モード　環状線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax'},paxb:{key:'A',name:'乗客モード　白峰支線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax',branch:true,line:'branch'},
  pax2:{key:'A',name:'乗客モード　紫雲地下線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax',branch:true,line:'branch2'},pax3:{key:'A',name:'乗客モード　天宮高架線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax',branch:true,line:'branch3'},
  bu:{key:'A',name:'白峰支線　奥峰行き',short:'支線 奥峰行',en:'Shiramine Branch Line',col:'#5aa832',kind:'branch',branch:true,line:'branch',dir:1},bd:{key:'B',name:'白峰支線　白峰行き',short:'支線 白峰行',en:'Shiramine Branch Line',col:'#5aa832',kind:'branch',branch:true,line:'branch',dir:-1},
  b2u:{key:'A',name:'紫雲地下線　深雪行き',short:'地下線 深雪行',en:'Shiun Subway Branch Line',col:'#7a3fa0',kind:'branch',branch:true,line:'branch2',dir:1},
  b2d:{key:'B',name:'紫雲地下線　紫雲新都行き',short:'地下線 紫雲新都行',en:'Shiun Subway Branch Line',col:'#7a3fa0',kind:'branch',branch:true,line:'branch2',dir:-1},
  b3u:{key:'A',name:'天宮高架線　峰月行き',short:'高架線 峰月行',en:'Amamiya Elevated Branch Line',col:'#2aa6d8',kind:'branch',branch:true,line:'branch3',dir:1},
  b4u:{key:'A',name:'港見支線　奥港行き',short:'港見支線 奥港行',en:'Minatomi Branch Line',col:'#2a5caa',kind:'branch',branch:true,line:'branch4',dir:1},
  b4d:{key:'B',name:'港見支線　港見行き',short:'港見支線 港見行',en:'Minatomi Branch Line',col:'#2a5caa',kind:'branch',branch:true,line:'branch4',dir:-1},
  pax4:{key:'A',name:'乗客モード　港見支線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax',branch:true,line:'branch4'},
  pax5:{key:'A',name:'乗客モード　四嶺連絡高速線',short:'乗客モード',en:'',col:'#8fd6ff',kind:'pax',branch:true,line:'branch5'},
  c5u:{key:'A',name:'四嶺連絡高速線　奥港行き',short:'連絡高速線 奥港行',en:'Shirei High-Speed Connection Line',col:'#6b7f3a',kind:'branch',branch:true,line:'branch5',dir:1},
  c5d:{key:'B',name:'四嶺連絡高速線　奥峰行き',short:'連絡高速線 奥峰行',en:'Shirei High-Speed Connection Line',col:'#6b7f3a',kind:'branch',branch:true,line:'branch5',dir:-1},
  b3d:{key:'B',name:'天宮高架線　天宮行き',short:'高架線 天宮行',en:'Amamiya Elevated Branch Line',col:'#2aa6d8',kind:'branch',branch:true,line:'branch3',dir:-1}}; /* v2.4.0：天宮高架線の快速は廃止（各駅停車のみ） */
/* ===== 運転条件（天候・ダイヤ・車庫出庫）=====
   タイトル画面のモーダルで選んだ内容は window.__WEATHER / __DIASH / __DEPOT_START に入る。
   以前はJSの読み込み時に一度だけ読んで固定していたため、選んでもゲームに反映されなかった。
   いまは boot() のたびに applyConditionState() で読み直す。 */
let WX=null,DIASH='normal',DEPOT_START=false,WXF=1,WXPTS=null,WXPOS=null;
function stopsOf(stations,kind){const chg=(DIASH==='change');
  return stations.filter(st=>kind==='rapid'||kind==='extra'?(chg?(st.cls==='M'||st.cls==='X'||(st.cls==='R'&&st.i%2===0)):st.cls!=='L')
    :kind==='ltd'?(st.cls==='M'||st.cls==='X')
    :kind==='exp'?(chg?(st.i===0||st.cls==='M'||st.cls==='X'):(st.i===0||st.cls==='M')) /* 特急は汐見と主要駅だけ（快速特急より少ない） */
    :true);}
function lapTime(cfg,stations,kind){ // rough timetable estimate for one lap / one way
  const stops=stopsOf(stations,kind),vc={local:21,rapid:29,extra:29,ltd:40,exp:48,branch:18,test:21,charter:24}[kind]||21,dw={local:30,rapid:35,extra:35,ltd:40,exp:35,branch:30,test:30,charter:35}[kind]||30;let t=0;
  for(let i=0;i<stops.length;i++){const a=stops[i],b=stops[(i+1)%stops.length];if(kind==='branch'&&i===stops.length-1)break;const d=mod(b.s-a.s,cfg.L);t+=d/vc+28+(b.cls==='M'?dw+10:dw);}return t;}
function fmtDur(sec){const m=Math.round(sec/60);return m>=60?Math.floor(m/60)+'時間'+(m%60)+'分':m+'分';}

/* =====================================================================
   Online Multiplayer State & Logic (汐見環状線 オンライン)
   ===================================================================== */
let IS_ONLINE = false;

/* =====================================================================
   Driver Account & Authentication System (運転士アカウント・記録管理)
   ===================================================================== */
const GLOBAL_ACCOUNTS = {}; // name -> { name, passHash, totalDist, totalTime, runs, ts }
window.GLOBAL_ACCOUNTS = GLOBAL_ACCOUNTS;

function getStoredDriverAccount() {
  try {
    const raw = localStorage.getItem('shiomi_driver_account');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  const guestNum = Math.floor(1000 + Math.random() * 9000);
  const oldName = localStorage.getItem('shiomi_online_name');
  const initialName = oldName && oldName !== '運転士' ? oldName : ('運転士#' + guestNum);
  return {
    name: initialName,
    passHash: '',
    totalDist: 0.0,
    totalTime: 0,
    runs: 0,
    isGuest: true
  };
}

let CURRENT_DRIVER = getStoredDriverAccount();
let MY_PLAYER_NAME = CURRENT_DRIVER.name;
window.CURRENT_DRIVER = CURRENT_DRIVER;

function saveCurrentDriverLocally() {
  try {
    localStorage.setItem('shiomi_driver_account', JSON.stringify(CURRENT_DRIVER));
    localStorage.setItem('shiomi_online_name', CURRENT_DRIVER.name);
    let db = {};
    try { db = JSON.parse(localStorage.getItem('shiomi_driver_db') || '{}'); } catch(e) {}
    db[CURRENT_DRIVER.name] = {
      name: CURRENT_DRIVER.name,
      passHash: CURRENT_DRIVER.passHash,
      totalDist: CURRENT_DRIVER.totalDist,
      totalTime: CURRENT_DRIVER.totalTime,
      runs: CURRENT_DRIVER.runs,
      ts: Date.now()
    };
    localStorage.setItem('shiomi_driver_db', JSON.stringify(db));
  } catch(e) {}
}

function getDriverRank(distKm) {
  distKm = distKm || 0;
  if (distKm >= 1000) return '🌟 伝説の指導運転士';
  if (distKm >= 300) return '👑 環状線マスター';
  if (distKm >= 100) return '🏅 ベテラン運転士';
  if (distKm >= 50) return '⭐ 熟練運転士';
  if (distKm >= 10) return '🚃 一人前運転士';
  return '🔰 見習い運転士';
}

function formatDriverTime(sec) {
  sec = Math.floor(sec || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? (h + '時間' + m + '分') : (m + '分');
}

function formatDriverDist(km) {
  return (km || 0).toFixed(1) + ' km';
}

function isVeteranDriver() {
  return (typeof CURRENT_DRIVER !== 'undefined' && CURRENT_DRIVER && (CURRENT_DRIVER.totalDist || 0) >= 100);
}

function updateBranchLockUI() {
  const btn = document.getElementById('btnSelectBranch');
  if (!btn) return;
  const badge = btn.querySelector('.cat-badge');
  const meta = btn.querySelector('.meta');
  /* v1.9.7：支線の解放条件を撤廃（全員プレイ可能） */
  btn.classList.remove('locked-branch');
  if (badge) {
    badge.textContent = '🔓 全路線プレイ可能';
    badge.style.background = '#059669';
    badge.style.color = '#fff';
  }
  if (meta) {
    meta.innerHTML = `<span>5路線</span><span>条件なし</span><span>オンライン対応</span>`;
  }
}

/* 性的なもの・不適切な単語の判定フィルター */
function isSexualOrNSFW(rawName) {
  if (!rawName) return false;
  // 1. 全角を半角へ、小文字化
  let s = rawName.normalize('NFKC').toLowerCase();
  // 2. 記号・空白等を除去（文字間隔での回避対策）
  s = s.replace(/[\s\-_.\*・~〜/\\#@!?,:;+=「」『』（）()[\]{}|]+/g, '');
  // 3. カタカナをひらがなに変換
  s = s.replace(/[\u30a1-\u30f6]/g, function(ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0x60);
  });

  const patterns = [
    /ちん[こぽ]|おまんこ|まんこ|マンコ|陰茎|陰部|勃起|射精|精液|ザーメン|精子|膣|きんたま|金玉|睾丸/,
    /おなに[ー]?|手淫|せっくす|セックス|性交|乱交|潮吹[き]?|ぱいずり|パイズリ|ふぇら|フェラ|くんに|クンニ|あなる|アナル/,
    /きょにゅう|巨乳|ばくにゅう|爆乳|ひんにゅう|貧乳|どうてい|童貞|しょじょ|処女/,
    /れいぷ|レイプ|強姦|ちかん|痴漢|露出狂|いんらん|淫乱|へんたい|変態|えろ|エロ|えっち|エッチ/,
    /そーぷ|ソープ|へるす|ヘルス|でりへる|デリヘル|ばいしゅん|売春|ふうぞく|風俗/,
    /sex|porn|penis|vagina|cock|dick|pussy|boobs|tits|blowjob|anal|orgasm|semen|cum|rape|hentai|ecchi|xxx|nsfw|slut|whore/
  ];

  for (let i = 0; i < patterns.length; i++) {
    if (patterns[i].test(s)) return true;
  }
  return false;
}

async function hashPassword(pwd) {
  if (!pwd) return '';
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(pwd + '_shiomi_train_salt_2026'));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function syncDriverToMQTT() {
  if (!ONLINE_CLIENT || !ONLINE_CLIENT.connected || !CURRENT_DRIVER.passHash) return;
  const payload = {
    name: CURRENT_DRIVER.name,
    passHash: CURRENT_DRIVER.passHash,
    totalDist: CURRENT_DRIVER.totalDist,
    totalTime: CURRENT_DRIVER.totalTime,
    runs: CURRENT_DRIVER.runs,
    ts: Date.now()
  };
  try {
    ONLINE_CLIENT.publish('shiomi3d/v1/accounts/' + encodeURIComponent(CURRENT_DRIVER.name), JSON.stringify(payload), { qos: 0, retain: false });
  } catch(e) {}
}

let sessionDriveDistKm = 0;
let sessionDriveTimeSec = 0;
let lastProgressSaveTime = 0;

function recordDrivingProgress(stepDistKm, dtSec) {
  sessionDriveDistKm += stepDistKm;
  sessionDriveTimeSec += dtSec;
  CURRENT_DRIVER.totalDist = (CURRENT_DRIVER.totalDist || 0) + stepDistKm;
  CURRENT_DRIVER.totalTime = (CURRENT_DRIVER.totalTime || 0) + dtSec;
  
  const now = Date.now();
  if (now - lastProgressSaveTime > 25000) {
    lastProgressSaveTime = now;
    saveCurrentDriverLocally();
  }
}
window.addEventListener('beforeunload', () => {
  try {
    saveCurrentDriverLocally();
    syncDriverToMQTT();
  } catch(e) {}
});

function updateDriverCardUI() {
  const nameEl = document.getElementById('cardDriverName');
  const distEl = document.getElementById('cardDriverDist');
  const timeEl = document.getElementById('cardDriverTime');
  const rankEl = document.getElementById('driverRankBadge');
  const statusEl = document.getElementById('driverStatusBadge');
  
  const mName = document.getElementById('modalCurrentName');
  const mDist = document.getElementById('modalCurrentDist');
  const mTime = document.getElementById('modalCurrentTime');
  const mBadge = document.getElementById('modalCurrentBadge');

  if (nameEl) nameEl.textContent = CURRENT_DRIVER.name || '運転士';
  if (distEl) distEl.textContent = formatDriverDist(CURRENT_DRIVER.totalDist);
  if (timeEl) timeEl.textContent = formatDriverTime(CURRENT_DRIVER.totalTime);
  if (rankEl) rankEl.textContent = getDriverRank(CURRENT_DRIVER.totalDist);
  if (statusEl) {
    statusEl.textContent = CURRENT_DRIVER.passHash ? '🔒 記録保護中' : '🌐 常時オンライン';
    statusEl.style.background = CURRENT_DRIVER.passHash ? '#059669' : '#0284c7';
  }

  if (mName) mName.textContent = CURRENT_DRIVER.name || '運転士';
  if (mDist) mDist.textContent = formatDriverDist(CURRENT_DRIVER.totalDist);
  if (mTime) mTime.textContent = formatDriverTime(CURRENT_DRIVER.totalTime);
  if (mBadge) {
    mBadge.textContent = CURRENT_DRIVER.passHash ? '🔒 パスワード保護済み' : '🌐 常時オンライン運転士';
    mBadge.style.color = CURRENT_DRIVER.passHash ? '#34d399' : '#38bdf8';
  }
  if (typeof updateBranchLockUI === 'function') updateBranchLockUI();
}

let ONLINE_CLIENT = null;
const ONLINE_CLIENT_ID = 'sh_' + Math.random().toString(16).slice(2, 10);
const ONLINE_PLAYERS = {}; // pid -> player state
window.ONLINE_PLAYERS = ONLINE_PLAYERS;
let onlinePubInterval = null;

window.IS_DEV = (function(){ try{ return sessionStorage.getItem('shiomi_dispatch_unlocked') === '1'; }catch(e){ return false; } })();
function makeNameplateSprite(name, svcName, isDev) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 148;
  const ctx = c.getContext('2d');
  ctx.fillStyle = isDev ? 'rgba(30, 20, 6, 0.94)' : 'rgba(11, 19, 34, 0.9)';
  ctx.strokeStyle = isDev ? '#fbbf24' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(8, 8, 496, 132, 28);
  } else {
    ctx.rect(8, 8, 496, 132);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = isDev ? '#fde68a' : '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((isDev ? '🛠️ [開発者] ' : '👤 ') + name, 256, 52);
  ctx.fillStyle = isDev ? '#fbbf24' : '#38bdf8';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(svcName || '汐見環状線', 256, 102);
  
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.4, 1.75, 1);
  return sprite;
}

const ONLINE_BROKERS = [
  { url: 'wss://broker.emqx.io:8084/mqtt', user: '', pass: '', label: 'emqx' },
  { url: 'wss://broker.hivemq.com:8884/mqtt', user: '', pass: '', label: 'hivemq' },
  { url: 'wss://public.cloud.shiftr.io:443/mqtt', user: 'public', pass: 'public', label: 'shiftr' }
];
let onlineBrokerIdx = 0;
let onlineConnectTimer = null;
let isConnectingOnline = false;

function initOnlineClient() {
  if (ONLINE_CLIENT && ONLINE_CLIENT.connected) return;
  if (isConnectingOnline) return;
  if (typeof mqtt === 'undefined') {
    const s = document.createElement('script');
    s.src = 'assets/js/mqtt.min.js';
    s.onload = () => initOnlineClient();
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/mqtt@5.3.5/dist/mqtt.min.js';
      s2.onload = () => initOnlineClient();
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
    return;
  }
  isConnectingOnline = true;
  const curBroker = ONLINE_BROKERS[onlineBrokerIdx % ONLINE_BROKERS.length];
  const opts = {
    clientId: ONLINE_CLIENT_ID,
    clean: true,
    connectTimeout: 12000,
    keepalive: 25,
    reconnectPeriod: 2000,
    will: {
      topic: 'shiomi3d/v1/players/' + ONLINE_CLIENT_ID,
      payload: JSON.stringify({ id: ONLINE_CLIENT_ID, offline: true }),
      qos: 0,
      retain: false
    }
  };
  if (curBroker.user) {
    opts.username = curBroker.user;
    opts.password = curBroker.pass;
  }
  try {
    if (ONLINE_CLIENT) {
      try { ONLINE_CLIENT.end(true); } catch(e) {}
    }
    ONLINE_CLIENT = mqtt.connect(curBroker.url, opts);
    window.ONLINE_CLIENT = ONLINE_CLIENT;

    if (onlineConnectTimer) clearTimeout(onlineConnectTimer);
    onlineConnectTimer = setTimeout(() => {
      if (ONLINE_CLIENT && !ONLINE_CLIENT.connected) {
        console.warn('MQTT broker ' + curBroker.url + ' timeout, failover to next broker...');
        isConnectingOnline = false;
        onlineBrokerIdx++;
        try { ONLINE_CLIENT.end(true); } catch(e) {}
        ONLINE_CLIENT = null;
        initOnlineClient();
      }
    }, 6500);
    
    ONLINE_CLIENT.on('connect', () => {
      isConnectingOnline = false;
      if (onlineConnectTimer) { clearTimeout(onlineConnectTimer); onlineConnectTimer = null; }
      ONLINE_CLIENT.subscribe('shiomi3d/v1/players/#', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/accounts/#', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/events', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/chat', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/mic', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/dispatch/#', { qos: 0 });
      ONLINE_CLIENT.subscribe('shiomi3d/v1/ai/#', { qos: 0 });
      startOnlinePublishLoop();
      publishPresence(true);
      syncDriverToMQTT();
      updateOnlineHud();
      updateDriverCardUI();
      if (typeof drawHomeMap === 'function') drawHomeMap();
    });

    ONLINE_CLIENT.on('error', (err) => {
      console.warn('MQTT error on ' + curBroker.url, err);
      isConnectingOnline = false;
    });

    ONLINE_CLIENT.on('close', () => {
      isConnectingOnline = false;
    });
    
    ONLINE_CLIENT.on('message', (topic, message) => {
      try {
        if (topic === 'shiomi3d/v1/chat') {
          const chat = JSON.parse(message.toString());
          if (chat && chat.id && chat.id !== ONLINE_CLIENT_ID && chat.text) {
            handleIncomingChat(chat);
          }
          return;
        }
        if (topic === 'shiomi3d/v1/mic') {
          const mic = JSON.parse(message.toString());
          if (mic && mic.id && mic.id !== ONLINE_CLIENT_ID && mic.pcm) {
            handleIncomingMic(mic);
          }
          return;
        }
        if (topic === 'shiomi3d/v1/events') {
          const ev = JSON.parse(message.toString());
          if (ev && ev.id && ev.id !== ONLINE_CLIENT_ID) {
            handleIncomingEvent(ev);
          }
          return;
        }
        if (topic.startsWith('shiomi3d/v1/ai/')) {
          const ap = JSON.parse(message.toString());
          if (topic === 'shiomi3d/v1/ai/state' && ap && Array.isArray(ap.trains)) {
            window.__ONLINE_AI_SNAPSHOT = { ts: Date.now(), trains: ap.trains };
            if (typeof updateStationSelectButtons === 'function') updateStationSelectButtons();
          }
          if (typeof window.handleAiPacket === 'function') window.handleAiPacket(topic, ap);
          return;
        }
        if (topic.startsWith('shiomi3d/v1/dispatch/')) {
          const dp = JSON.parse(message.toString());
          if (dp && typeof handleDispatchPacket === 'function') {
            handleDispatchPacket(topic, dp);
          }
          return;
        }
        if (topic.startsWith('shiomi3d/v1/accounts/')) {
          const acc = JSON.parse(message.toString());
          if (acc && acc.name) {
            GLOBAL_ACCOUNTS[acc.name] = acc;
            if (CURRENT_DRIVER && CURRENT_DRIVER.name === acc.name && CURRENT_DRIVER.passHash === acc.passHash) {
              if ((acc.totalDist || 0) > (CURRENT_DRIVER.totalDist || 0)) {
                CURRENT_DRIVER.totalDist = acc.totalDist;
              }
              if ((acc.totalTime || 0) > (CURRENT_DRIVER.totalTime || 0)) {
                CURRENT_DRIVER.totalTime = acc.totalTime;
              }
              saveCurrentDriverLocally();
              updateDriverCardUI();
            }
          }
          return;
        }
        const data = JSON.parse(message.toString());
        if (!data || data.id === ONLINE_CLIENT_ID) return;
        if (data.offline) {
          removeRemotePlayer(data.id);
          return;
        }
        handleRemotePlayerUpdate(data);
      } catch (e) {}
    });
  } catch (e) {
    console.error('MQTT error:', e);
  }
}

function handleRemotePlayerUpdate(data) {
  const now = Date.now();
  let p = ONLINE_PLAYERS[data.id];
  const isNew = !p;
  if (isNew) {
    p = {
      id: data.id,
      name: data.name || 'ゲスト運転士',
      line: data.line || 'loop',
      service: data.service,
      key: data.key,
      dir: data.dir || 1,
      s: data.s,
      v: data.v || 0,
      door: data.door || 'closed',
      doorSide: data.doorSide || 1,
      doorFrac: data.doorFrac || 0,
      load: data.load || 180,
      stName: data.stName || '',
      smoothS: data.s,
      state: data.state || 'driving',
      isPax: !!data.isPax,
      lastSeen: now,
      lastDoor: data.door || 'closed',
      lastHornT: data.hornT || 0,
      lastMhornT: data.mhornT || 0,
      lastPromoT: data.promoT || 0,
      whooshPlayed: false,
      ai: null,
      snd: null,
      tr: null,
      avatar: data.avatar || null,
      paxS: data.paxS != null ? data.paxS : null,
      paxO: data.paxO != null ? data.paxO : 0,
      paxYaw: data.paxYaw != null ? data.paxYaw : 0,
      paxWalk: !!data.paxWalk,
      paxArea: data.paxArea || 'plat',
      paxRide: data.paxRide || null,
      paxG: null,
      nCar: data.nCar || null,
      troubleMode: !!data.troubleMode,
      greenCars: data.greenCars || null,
      liv: data.liv != null ? data.liv : null,
      twoMan: !!data.twoMan,
      crew: data.crew || 'one',
      sq: data.sq | 0
    };
    ONLINE_PLAYERS[data.id] = p;
    try {
      if (!p.isPax && p.state !== 'passenger') {
        toast('👤 ' + p.name + ' さんが乗務を開始しました', 'ok');
      } else {
        toast('🚶 ' + p.name + ' さんが見学を開始しました', 'info');
      }
    } catch(e) {}
  } else {
    // 他プレイヤーの乗降促進メロディは events の promo（鳴らすたびに届く）だけで再生する。
    // 位置情報からの推測再生は二重に鳴るため行わない（v2.2.1）
    // 他プレイヤーのドア開閉音・チャイム再生
    if (data.door && data.door !== p.lastDoor) {
      if (data.door === 'opening') {
        playRemoteTrainSound(p, 'doorOpen');
      } else if (data.door === 'closing') {
        playRemoteTrainSound(p, 'doorClose');
      }
      p.lastDoor = data.door;
    }
    // 他プレイヤーの警笛再生（5種類対応）
    if (data.hornT && (!p.lastHornT || data.hornT > p.lastHornT)) {
      p.lastHornT = data.hornT;
      playRemoteTrainSound(p, 'horn', { hornKind: data.hornKind || 'elec' });
    }
    // 他プレイヤーのミュージックホーン再生（①②対応）
    if (data.mhornT && (!p.lastMhornT || data.mhornT > p.lastMhornT)) {
      p.lastMhornT = data.mhornT;
      playRemoteTrainSound(p, 'mhorn', { mhornKind: data.mhornKind || 1 });
    }

    p.name = data.name || p.name;
    p.isDev = !!data.isDev;
    p.line = data.line || p.line || 'loop';
    p.service = data.service || p.service;
    p.key = data.key || p.key;
    p.dir = data.dir != null ? data.dir : p.dir;
    p.s = data.s;
    p.v = data.v != null ? data.v : p.v;
    p.door = data.door;
    p.doorSide = data.doorSide;
    p.doorFrac = data.doorFrac;
    p.load = data.load != null ? data.load : p.load;
    p.stName = data.stName;
    p.dest = data.dest || p.dest || '';
    p.old = data.old !== undefined ? data.old : p.old;
    p.avatar = data.avatar || p.avatar || null;
    if (data.paxS != null) p.paxS = data.paxS;
    if (data.paxO != null) p.paxO = data.paxO;
    if (data.paxYaw != null) p.paxYaw = data.paxYaw;
    if (data.paxWalk !== undefined) p.paxWalk = !!data.paxWalk;
    if (data.paxArea) p.paxArea = data.paxArea;
    p.crewWalk = !!data.crewWalk;
    p.crewArea = data.crewArea || null;
    p.crewCar = data.crewCar != null ? data.crewCar : null;
    p.crewLx = data.crewLx || 0;
    p.crewLz = data.crewLz || 0;
    p.crewFl = data.crewFl || 'deck';
    if (data.sq != null) p.sq = data.sq | 0;
    p.crew = data.crew || p.crew || 'one';
    p.twoMan = !!data.twoMan;
    p.paxRide = data.paxRide !== undefined ? data.paxRide : p.paxRide;
    p.nCar = data.nCar || p.nCar;
    if (data.troubleMode !== undefined) p.troubleMode = !!data.troubleMode;
    p.greenCars = data.greenCars || p.greenCars;
    p.liv = data.liv != null ? data.liv : p.liv;
    p.twoMan = data.twoMan !== undefined ? !!data.twoMan : p.twoMan;
    p.crew = data.crew || p.crew;
    p.state = data.state || p.state;
    p.isPax = data.isPax !== undefined ? !!data.isPax : p.isPax;
    p.lastSeen = now;

    if (p.isPax || p.state === 'passenger' || p.s == null) {
      if (p.tr && p.tr.grp) p.tr.grp.visible = false;
    }
  }
  updateOnlineHud(false);
}

function removeRemotePlayer(id) {
  const p = ONLINE_PLAYERS[id];
  if (!p) return;
  const pName = p.name;
  /* v1.9.7：この列車に乗っている乗客は降ろさず、列車をその場に停める（降車は乗客の意思で） */
  try { if (window.__RIDEHOOK && typeof window.__RIDEHOOK.ghost === 'function') window.__RIDEHOOK.ghost(p); } catch(e) {}
  if (typeof stopRemotePlayerSound === 'function') stopRemotePlayerSound(p);
  if (p.ai && p.ai.inside) {
    p.ai.inside.length = 0;
  }
  if (p.tr) {
    if (typeof disposeTrain === 'function') {
      disposeTrain(p.tr);
    } else {
      if (p.tr.nameplate && p.tr.nameplate.material) {
        try {
          if (p.tr.nameplate.material.map) p.tr.nameplate.material.map.dispose();
          p.tr.nameplate.material.dispose();
        } catch(e) {}
      }
      if (p.tr.grp && p.tr.grp.parent) {
        try { p.tr.grp.parent.remove(p.tr.grp); } catch(e) {}
      }
    }
    p.tr = null;
  }
  if (p.paxG) {
    try {
      if (p.paxG.parent) p.paxG.parent.remove(p.paxG);
      if (p.paxG.userData && p.paxG.userData.plate && p.paxG.userData.plate.material) {
        if (p.paxG.userData.plate.material.map) p.paxG.userData.plate.material.map.dispose();
        p.paxG.userData.plate.material.dispose();
      }
    } catch(e) {}
    p.paxG = null;
  }
  delete ONLINE_PLAYERS[id];
  try {
    toast('👤 ' + pName + ' さんが乗務を終了しました', 'info');
  } catch(e) {}
  updateOnlineHud(true);
}

function playRemoteTrainSound(p, type, opt) {
  const A = window.__AUD;
  if (!A || !A.AC || !A.master || !p) return;
  const _AC = A.AC, _master = A.master, _camera = A.camera;
  if (_AC.state === 'suspended') { try { _AC.resume(); } catch(e) {} }
  try {
    /* v1.9.8：位置は「線路上の実座標」を優先する。3Dモデルの位置は遠方で
       プール・間引きされることがあり、遠くの列車が近くにいるように誤判定されて
       警笛が聞こえてしまっていた。 */
    let pos = null;
    if (p.s != null && isFinite(p.s) && typeof A.offsG === 'function' && A.TK && p.key && A.TK[p.key]) {
      const o = (typeof A.TK[p.key].off === 'function') ? A.TK[p.key].off(p.s) : 0;
      pos = A.offsG(p.s, o, 1.5);
    } else if (p.tr && p.tr.cars && p.tr.cars[0]) {
      pos = p.tr.cars[0].position;
    }
    if (!pos || !_camera) return;
    const cw = _camera.getWorldPosition(new THREE.Vector3());
    let d = pos.distanceTo(cw);
    if (!isFinite(d)) return;

    const isHorn = (type === 'horn' || type === 'mhorn');
    /* 警笛は車内にいても300m、ホームでも360mまで。それ以上は絶対に鳴らさない */
    const sealed = (typeof A.listenerSealed === 'function') ? A.listenerSealed() : false;
    const maxD = isHorn ? (sealed ? 300 : 380) : (type === 'promo' ? 240 : 200);
    if (d > maxD) return;
    if (p.isPax || p.state === 'passenger' || p.state === 'title' || p.state === 'dispatch') return;

    // 運転室内・客室内にいる場合の音響減衰（窓ガラス越しにリアルに響かせる）
    const inCab = (typeof A.listenerSealed === 'function') ? A.listenerSealed() : false;
    const cabFilter = inCab ? 3400 : 18000;
    const cabVolMult = inCab ? (isHorn ? 0.65 : 0.48) : 1.0;

    const refD = isHorn ? 70 : 45;
    const distGain = Math.min(3.8, 4.6 / (1 + Math.pow(d / refD, 1.6))) * clamp(1 - Math.pow(d / maxD, 2), 0, 1);
    const totalGain = distGain * cabVolMult;

    const g = _AC.createGain();
    g.gain.value = totalGain;

    const lp = _AC.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cabFilter;
    g.connect(lp);

    let out = g;
    try {
      const panner = _AC.createStereoPanner();
      const cr = new THREE.Vector3(1, 0, 0).applyQuaternion(_camera.getWorldQuaternion(new THREE.Quaternion()));
      panner.pan.value = A.clamp(new THREE.Vector3().subVectors(pos, cw).dot(cr) / (d + 1), -0.9, 0.9);
      lp.connect(panner);
      panner.connect(_master);
      out = g;
    } catch(e) {
      lp.connect(_master);
      out = g;
    }

    if (type === 'horn') {
      const hk = (opt && opt.hornKind) || 'elec';
      if (hk === 'elec' || hk === 'both') {
        A.tone(349, 0, 0.9, 'square', 0.24, out);
        A.tone(440, 0, 0.9, 'square', 0.24, out);
        A.tone(349, 0.04, 0.85, 'sawtooth', 0.14, out);
        A.tone(440, 0.04, 0.85, 'sawtooth', 0.14, out);
      }
      if (hk === 'air' || hk === 'both') {
        const sc = hk === 'both' ? 0.75 : 1.0;
        A.tone(233.08, 0, 0.95, 'sawtooth', 0.24 * sc, out);
        A.tone(293.66, 0, 0.95, 'sawtooth', 0.24 * sc, out);
        A.tone(349.23, 0, 0.95, 'sawtooth', 0.17 * sc, out);
        A.tone(116.54, 0, 0.95, 'triangle', 0.15 * sc, out);
      }
    } else if (type === 'mhorn') {
      const t0 = _AC.currentTime + 0.02;
      const mk = (opt && opt.mhornKind) || 1;
      const seq = mk === 2
        ? [[74,0.20],[78,0.20],[81,0.26],[86,0.56],[83,0.24],[81,0.28],[86,0.95]]
        : [[72,0.22],[76,0.22],[79,0.3],[84,0.72],[81,0.24],[79,0.24],[84,1.05]];
      let curT = t0;
      for (const [m, dur] of seq) {
        if (typeof A.mnote === 'function') {
          A.mnote(m, curT, dur, 'triangle', 0.4, out, true);
          A.mnote(m + 12, curT, dur, 'sine', 0.18, out, true);
        }
        curT += dur * 0.55;
      }
    } else if (type === 'promo') {
      /* 発信側とまったく同じ関数・同じ曲・同じ音色（送られてきた種別・方向・駅で鳴らす） */
      const pn = opt && opt.promoN != null ? opt.promoN : 0;
      const ctx = {
        key: (opt && opt.key) || (p && p.key) || 'A',
        dir: (opt && opt.dir != null) ? opt.dir : ((p && p.dir) || 1),
        branch: !!(opt && opt.branch),
        stIdx: (opt && opt.stIdx != null) ? opt.stIdx : -1
      };
      if (typeof A.promoRun === 'function') A.promoRun(pn, ctx, out, 1.0);
      else if (pn === 4 && typeof A.ponSnd === 'function') A.ponSnd(out);
      else if (typeof A.melody === 'function') A.melody(out, 1.0, undefined, ctx.dir);
    } else if (type === 'promoVoice' || type === 'snd') {
      /* 同じ事前録音MP3を、その列車の位置から聞こえる音量で鳴らす（声をチャイムで代用しない） */
      const file = (opt && opt.file) || 'assets/audio/ann/guide_tab_doors.mp3';
      const gn = ((opt && opt.gain) != null ? opt.gain : 0.95) * Math.min(1.15, Math.max(0.18, distGain));
      try {
        if (typeof A.loadAnnBuffer === 'function') A.loadAnnBuffer(file).then(buf => {
          if (!buf) return;
          const src = _AC.createBufferSource(), g2 = _AC.createGain();
          g2.gain.value = Math.min(1.4, Math.max(0.05, gn));
          src.buffer = buf; src.connect(g2); g2.connect(out); src.start();
        }).catch(() => {});
      } catch (e) {}
    } else if (type === 'doorOpen' && typeof A.doorOpenSnd === 'function') {
      A.doorOpenSnd(out);
    } else if (type === 'doorClose' && typeof A.doorCloseSnd === 'function') {
      A.doorCloseSnd(out);
    }
  } catch(e) {
    console.warn('playRemoteTrainSound err', e);
  }
}

function broadcastSound(file, gainVal) {
  if (typeof __remoteSndPlaying !== 'undefined' && __remoteSndPlaying) return;
  if (!IS_ONLINE || !ONLINE_CLIENT || !ONLINE_CLIENT.connected) return;
  if (!file || !/^assets\/audio\/ann\//.test(file)) return;
  try {
    const curG = (typeof G !== 'undefined' ? G : null);
    ONLINE_CLIENT.publish('shiomi3d/v1/events', JSON.stringify({
      id: ONLINE_CLIENT_ID, type: 'snd', file: file, gain: (gainVal != null ? gainVal : 0.9),
      s: (curG && curG.s != null) ? curG.s : null, key: (curG && curG.key) ? curG.key : 'A', t: Date.now()
    }), { qos: 0 });
  } catch (e) {}
}
function broadcastEvent(type, extra) {
  if (typeof IS_ONLINE !== 'undefined' && IS_ONLINE && typeof ONLINE_CLIENT !== 'undefined' && ONLINE_CLIENT && ONLINE_CLIENT.connected) {
    try {
      const curG = (typeof G !== 'undefined' ? G : (window.G || null));
      const payload = Object.assign({
        id: ONLINE_CLIENT_ID,
        type: type,
        s: (curG && curG.s != null) ? curG.s : null,
        key: (curG && curG.key) ? curG.key : 'A',
        t: Date.now()
      }, extra || {});
      ONLINE_CLIENT.publish('shiomi3d/v1/events', JSON.stringify(payload), { qos: 0 });
    } catch(e) {}
  }
}

function makeSpeechBubbleSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 140;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(12, 22, 40, 0.94)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 96, 24);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(8, 8, 496, 96);
    ctx.strokeRect(8, 8, 496, 96);
  }
  ctx.fillStyle = 'rgba(12, 22, 40, 0.94)';
  ctx.beginPath();
  ctx.moveTo(236, 104);
  ctx.lineTo(256, 130);
  ctx.lineTo(276, 104);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💬 ' + text, 256, 56);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(6.6, 1.8, 1);
  return sprite;
}

let _lastChatAt = 0;
function appendChatLog(name, text, isMe, isDev) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const empty = log.querySelector('.chat-log-empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = 'chat-log-item' + (isMe ? ' me' : '');
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const tSpan = document.createElement('span');
  tSpan.className = 'ct';
  tSpan.textContent = hh + ':' + mm;
  const nSpan = document.createElement('span');
  nSpan.className = 'cn';
  if (isDev) {
    const devBadge = document.createElement('span');
    devBadge.textContent = '🛠️開発者';
    devBadge.style.cssText = 'background:#d97706;color:#fff;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;margin-right:4px;';
    nSpan.appendChild(devBadge);
  }
  nSpan.appendChild(document.createTextNode((isMe ? 'あなた' : name) + ':'));
  const mSpan = document.createElement('span');
  mSpan.textContent = text;
  item.appendChild(tSpan);
  item.appendChild(nSpan);
  item.appendChild(mSpan);
  log.appendChild(item);
  while (log.children.length > 30) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
function sendQuickChat(text) {
  const clean = String(text || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 60);
  if (!clean) return;
  const now = Date.now();
  if (now - _lastChatAt < 700) return;
  _lastChatAt = now;
  const curG = (typeof G !== 'undefined' ? G : (window.G || null));
  const stFn = typeof stOf === 'function' ? stOf : null;
  const stObj = (curG && stFn) ? (curG.atStation !== null ? stFn(curG.atStation) : (curG.nv != null ? stFn(curG.nv) : null)) : null;
  const isDev = !!window.IS_DEV;
  const payload = {
    id: ONLINE_CLIENT_ID,
    name: MY_PLAYER_NAME,
    isDev: isDev,
    text: clean,
    s: curG ? curG.s : null,
    stName: stObj ? stObj.name : '',
    ts: now
  };
  if (typeof ONLINE_CLIENT !== 'undefined' && ONLINE_CLIENT && ONLINE_CLIENT.connected) {
    try {
      ONLINE_CLIENT.publish('shiomi3d/v1/chat', JSON.stringify(payload), { qos: 0 });
    } catch(e) {}
  }
  appendChatLog(MY_PLAYER_NAME, clean, true, isDev);
  displayChatBubble(ONLINE_CLIENT_ID, MY_PLAYER_NAME, clean, true);
  showChatHudMsg(MY_PLAYER_NAME, clean, true, isDev);
  toast('💬 ' + clean, 'info');
}

function handleIncomingChat(chat) {
  const name = chat.name || '運転士';
  const isDev = !!chat.isDev;
  const text = String(chat.text || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 60);
  if (!text) return;
  chatChime();
  appendChatLog(name, text, false, isDev);
  showChatHudMsg(name, text, false, isDev);
  displayChatBubble(chat.id, name, text, false);
}

/* ===== 車掌モード：リアルタイムマイク放送（車内／車外） ===== */
const _MU_DEC = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  let u = ~i & 0xff;
  let t = ((u & 0x0f) << 3) + 0x84;
  t <<= (u & 0x70) >> 4;
  _MU_DEC[i] = ((u & 0x80) ? (0x84 - t) : (t - 0x84)) / 32768;
}
function _encodeMuLawSample(sample) {
  let s = Math.max(-1, Math.min(1, sample)) * 32767 | 0;
  let sign = (s >> 8) & 0x80;
  if (sign) s = -s;
  if (s > 32635) s = 32635;
  s += 0x84;
  let exp = 7;
  for (let expMask = 0x4000; (s & expMask) === 0 && exp > 0; exp--, expMask >>= 1) {}
  const mant = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mant) & 0xff;
}
function _u8ToB64(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
function _b64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

window.__CREW_MIC = { on: false, mode: 'in', stream: null, src: null, nodes: [], proc: null, zeroGain: null, seq: 0, acc: [] };
function _updCrewMicUI() {
  const stEl = document.getElementById('crewMicStatus');
  const inB = document.getElementById('micInBtn');
  const outB = document.getElementById('micOutBtn');
  const offB = document.getElementById('micOffBtn');
  const m = window.__CREW_MIC;
  if (stEl) {
    stEl.textContent = !m.on
      ? 'マイクOFF：放送先を選んでオンにしてください'
      : (m.mode === 'out'
        ? '📣 車外放送中：開いているドアからホームに聞こえます'
        : '📢 車内放送中：この電車の乗客にリアルタイムで聞こえます');
    stEl.style.color = m.on ? '#fef08a' : '#cbd5e1';
  }
  if (inB) inB.style.outline = (m.on && m.mode === 'in') ? '2px solid #fff' : 'none';
  if (outB) outB.style.outline = (m.on && m.mode === 'out') ? '2px solid #fff' : 'none';
  if (offB) offB.style.opacity = m.on ? '1' : '0.5';
  const fab = document.getElementById('btnCrewMicFab');
  if (fab) {
    if (m.on) {
      fab.textContent = m.mode === 'out' ? '📣 車外放送中' : '📢 車内放送中';
      fab.style.background = 'rgba(220,38,38,0.92)';
      fab.style.borderColor = '#fca5a5';
      fab.style.color = '#fff';
    } else {
      fab.textContent = '🎤 マイク';
      fab.style.background = 'rgba(12,24,44,0.92)';
      fab.style.borderColor = 'rgba(34,211,238,0.45)';
      fab.style.color = '#22d3ee';
    }
  }
  if (typeof updCondUI === 'function') { try { updCondUI(); } catch (e) {} }
}
async function startCrewMic(mode) {
  const m = window.__CREW_MIC;
  m.mode = mode === 'out' ? 'out' : 'in';
  if (m.on) {
    _updCrewMicUI();
    if (typeof toast === 'function') toast(m.mode === 'out' ? '📣 車外放送に切り替えました' : '📢 車内放送に切り替えました', 'info');
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (typeof toast === 'function') toast('このブラウザはマイク入力に対応していません', 'warn');
    return;
  }
  try {
    if (!window.__AC && typeof initAudio === 'function') { try { initAudio(); } catch (e) {} }
    const ac = window.__AC;
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
    if (navigator.audioSession) { try { navigator.audioSession.type = 'play-and-record'; } catch (e) {} }
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (_e1) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    if (!ac) { stream.getTracks().forEach(t => t.stop()); return; }
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {} }
    const src = ac.createMediaStreamSource(stream);
    const hpIn = ac.createBiquadFilter();
    hpIn.type = 'highpass';
    hpIn.frequency.value = 120;
    const lpIn = ac.createBiquadFilter();
    lpIn.type = 'lowpass';
    lpIn.frequency.value = 4800;
    const compIn = ac.createDynamicsCompressor();
    compIn.threshold.value = -14;
    compIn.knee.value = 12;
    compIn.ratio.value = 6;
    compIn.attack.value = 0.003;
    compIn.release.value = 0.15;
    const inGain = ac.createGain();
    inGain.gain.value = 0.7;
    const proc = ac.createScriptProcessor(2048, 1, 1);
    const zeroGain = ac.createGain();
    zeroGain.gain.value = 0;
    const TARGET_SR = 12000;
    const ratio = ac.sampleRate / TARGET_SR;
    proc.onaudioprocess = (ev) => {
      if (!m.on) return;
      if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
      const inp = ev.inputBuffer.getChannelData(0);
      let peak = 0;
      for (let i = 0; i < inp.length; i++) {
        const a = Math.abs(inp[i]);
        if (a > peak) peak = a;
      }
      const meter = document.getElementById('crewMicMeter');
      if (meter) meter.style.width = Math.min(100, Math.round(peak * 220)) + '%';
      if (!ONLINE_CLIENT || !ONLINE_CLIENT.connected) return;
      for (let p = 0; p < inp.length; p += ratio) {
        const idx = Math.floor(p);
        const nxt = Math.min(inp.length - 1, idx + 1);
        const fr = p - idx;
        m.acc.push(inp[idx] * (1 - fr) + inp[nxt] * fr);
      }
      if (m.acc.length >= 1024) {
        const chunk = m.acc.splice(0, 1024);
        let cPeak = 0;
        for (let i = 0; i < chunk.length; i++) { const a = Math.abs(chunk[i]); if (a > cPeak) cPeak = a; }
        if (cPeak < 0.004) return;
        const u8 = new Uint8Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) u8[i] = _encodeMuLawSample(Math.tanh(chunk[i]));
        const curG = (typeof G !== 'undefined' ? G : (window.__T ? window.__T.G : null));
        const curCfg = (typeof CFG !== 'undefined' ? CFG : (window.__T ? window.__T.CFG : null));
        const nCar = (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.cars) ? ownTrain.cars.length : 8;
        try {
          ONLINE_CLIENT.publish('shiomi3d/v1/mic', JSON.stringify({
            id: ONLINE_CLIENT_ID,
            name: MY_PLAYER_NAME,
            mode: m.mode,
            line: curCfg ? curCfg.id : 'loop',
            s: curG ? curG.s : 0,
            key: curG ? curG.key : 'A',
            dir: curG ? curG.dir : 1,
            nCar: nCar,
            door: (curG && curG.door) ? curG.door.state : 'closed',
            doorSide: (curG && curG.door) ? curG.door.side : 1,
            sr: TARGET_SR,
            seq: m.seq++,
            pcm: _u8ToB64(u8)
          }), { qos: 0 });
        } catch (e) {}
      }
    };
    src.connect(hpIn);
    hpIn.connect(lpIn);
    lpIn.connect(compIn);
    compIn.connect(inGain);
    inGain.connect(proc);
    proc.connect(zeroGain);
    zeroGain.connect(ac.destination);
    m.on = true; m.stream = stream; m.src = src; m.nodes = [hpIn, lpIn, compIn, inGain]; m.proc = proc; m.zeroGain = zeroGain; m.acc = [];
    _updCrewMicUI();
    if (typeof toast === 'function') toast(m.mode === 'out' ? '📣 マイクON（車外放送）' : '📢 マイクON（車内放送）', 'ok');
  } catch (e) {
    if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (_e) {} }
    const msg = (e && e.name === 'NotAllowedError') ? 'マイクの使用が許可されませんでした' : ('マイクを開始できませんでした' + (e && e.name ? ' (' + e.name + ')' : ''));
    if (typeof toast === 'function') toast(msg, 'warn');
  }
}
function stopCrewMic() {
  const m = window.__CREW_MIC;
  m.on = false;
  m.acc = [];
  try { if (m.proc) m.proc.disconnect(); } catch (e) {}
  try { if (m.nodes) m.nodes.forEach(n => { try { n.disconnect(); } catch (e) {} }); } catch (e) {}
  try { if (m.src) m.src.disconnect(); } catch (e) {}
  try { if (m.zeroGain) m.zeroGain.disconnect(); } catch (e) {}
  try { if (m.stream) m.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  m.proc = null; m.src = null; m.nodes = []; m.zeroGain = null; m.stream = null;
  if (navigator.audioSession) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
  if (window.__AC && window.__AC.state === 'suspended') { try { window.__AC.resume(); } catch (e) {} }
  const meter = document.getElementById('crewMicMeter');
  if (meter) meter.style.width = '0%';
  _updCrewMicUI();
}
const _micPlaySched = {};
let _micOutBus = null;
let _micOutBusAc = null;
function _getMicOutBus(ac) {
  if (_micOutBus && _micOutBusAc === ac) return _micOutBus;
  try {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    const outG = ac.createGain();
    outG.gain.value = 0.65;
    comp.connect(outG);
    outG.connect(ac.destination);
    _micOutBus = comp;
    _micOutBusAc = ac;
    return _micOutBus;
  } catch (e) {
    return ac.destination;
  }
}
function handleIncomingMic(d) {
  if (typeof G !== 'undefined' && G && G.sound === false) return;
  if (!window.__AC && typeof initAudio === 'function') { try { initAudio(); } catch (e) {} }
  const ac = window.__AC;
  if (!ac) return;
  if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} }
  const T = window.__T;
  if (!T) return;
  const curCfg = (typeof CFG !== 'undefined' ? CFG : T.CFG);
  if (curCfg && d.line && d.line !== curCfg.id) return;
  const isPax = !!(typeof PAX !== 'undefined' ? PAX : window.__PAX);
  const r = typeof T.getRide === 'function' ? T.getRide() : null;
  const ridingPid = (r && r.a) ? (r.a.p ? r.a.p.id : (r.a.pid || null)) : null;
  const ridingThis = !!(isPax && ridingPid && ridingPid === d.id);

  let vol = 0;
  let pan = 0;
  let isOut = d.mode === 'out';
  if (!isOut) {
    if (!ridingThis) return;
    vol = 0.45;
  } else {
    const doorOpen = d.door === 'open' || d.door === 'opening';
    const doorMul = doorOpen ? 1.0 : 0.25;
    const pObj = window.ONLINE_PLAYERS ? window.ONLINE_PLAYERS[d.id] : null;
    const trS = (pObj && pObj.smoothS != null) ? pObj.smoothS : (d.s || 0);
    const dir = d.dir || 1;
    const len = (d.nCar || 8) * 20;
    const L = (curCfg && curCfg.L) ? curCfg.L : 72000;
    const sdiffFn = (a, b) => { let x = ((b - a) % L + L) % L; if (x > L / 2) x -= L; return x; };

    let myS = 0, myO = 0, myYaw = 0;
    if (isPax) {
      if (r && r.a) {
        myS = r.a.s || 0;
        myO = (T.TK && T.TK[r.a.key]) ? T.TK[r.a.key].off(myS) : 0;
      } else if (T.W) {
        myS = T.W.s || 0;
        myO = T.W.o || 0;
      }
      myYaw = T.W ? (T.W.yaw || 0) : 0;
    } else if (T.G) {
      myS = T.G.s || 0;
      myO = (T.TK && T.TK[T.G.key]) ? T.TK[T.G.key].off(myS) : 0;
      myYaw = T.G.lookY || 0;
    }

    const rel = dir * sdiffFn(trS, myS);
    const clampedRel = Math.max(-len, Math.min(0, rel));
    const distS = Math.abs(rel - clampedRel);
    const trO = (typeof ownTrackOff === 'function' && d.key) ? ownTrackOff(d.key, trS) : ((T.TK && d.key && T.TK[d.key]) ? T.TK[d.key].off(trS) : 0);
    const doorO = trO + (d.doorSide || 1) * 1.45;
    const distO = Math.abs(myO - doorO);
    const dist = Math.hypot(distS, distO);
    if (dist > 65) return;
    vol = Math.pow(Math.max(0, 1 - dist / 65), 1.35) * doorMul * (ridingThis ? 0.35 : 0.65);
    if (vol < 0.005) return;
    const diffO = doorO - myO;
    pan = Math.max(-0.85, Math.min(0.85, (diffO * Math.cos(myYaw)) / 8));
  }

  let u8;
  try { u8 = _b64ToU8(d.pcm); } catch (e) { return; }
  if (!u8 || !u8.length) return;
  const sr = d.sr || 12000;
  const buf = ac.createBuffer(1, u8.length, sr);
  const ch = buf.getChannelData(0);
  const fadeN = Math.min(32, Math.floor(u8.length / 4));
  for (let i = 0; i < u8.length; i++) {
    let s = _MU_DEC[u8[i]];
    if (i < fadeN) s *= (i / fadeN);
    else if (i >= u8.length - fadeN) s *= ((u8.length - 1 - i) / fadeN);
    ch[i] = s;
  }

  const src = ac.createBufferSource();
  src.buffer = buf;

  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = isOut ? 420 : 260;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = isOut ? 2900 : 3600;
  const g = ac.createGain();
  g.gain.value = vol;

  src.connect(hp);
  hp.connect(lp);
  if (typeof ac.createStereoPanner === 'function') {
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    lp.connect(panner);
    panner.connect(g);
  } else {
    lp.connect(g);
  }
  g.connect(_getMicOutBus(ac));

  const now = ac.currentTime;
  let t = _micPlaySched[d.id] || 0;
  if (t < now + 0.02 || t > now + 0.6) t = now + 0.06;
  src.start(t);
  _micPlaySched[d.id] = t + buf.duration;
}

function handleIncomingEvent(ev) {
  const p = ONLINE_PLAYERS[ev.id] || { s: ev.s, key: ev.key };
  if (ev.type === 'horn') {
    const et = ev.t || Date.now();
    if (p.lastHornT && et <= p.lastHornT) return;
    p.lastHornT = et;
    playRemoteTrainSound(p, 'horn', { hornKind: ev.hornKind || 'elec' });
  } else if (ev.type === 'mhorn') {
    const et = ev.t || Date.now();
    if (p.lastMhornT && et <= p.lastMhornT) return;
    p.lastMhornT = et;
    playRemoteTrainSound(p, 'mhorn', { mhornKind: ev.mhornKind || 1 });
  } else if (ev.type === 'promo') {
    if (p) p.lastPromoT = ev.t || Date.now();
    playRemoteTrainSound(p, 'promo', { promoN: ev.promoN, stName: ev.stName, key: ev.promoKey, dir: ev.promoDir, branch: ev.promoBranch, stIdx: ev.promoSt });
  } else if (ev.type === 'promoVoice') {
    playRemoteTrainSound(p, 'promoVoice', { file: ev.file, gain: 0.95 });
  } else if (ev.type === 'snd') {
    playRemoteTrainSound(p, 'snd', { file: ev.file, gain: ev.gain });
  }
}

let chatHudTimer = null;
function showChatHudMsg(name, text, isMe, isDev) {
  const el = document.getElementById('chatHudBanner');
  const txtEl = document.getElementById('chatHudText');
  if (!el || !txtEl) return;
  const devTag = isDev ? '🛠️[開発者] ' : '';
  txtEl.textContent = devTag + (isMe ? 'あなた: ' : (name + ': ')) + text;
  el.classList.remove('hide');
  if (chatHudTimer) clearTimeout(chatHudTimer);
  chatHudTimer = setTimeout(() => {
    el.classList.add('hide');
  }, 5000);
}

function displayChatBubble(playerId, name, text, isMe) {
  try {
    let targetCar = null;
    if (isMe) {
      if (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.cars && ownTrain.cars[0]) {
        targetCar = ownTrain.cars[0];
      }
    } else if (typeof ONLINE_PLAYERS !== 'undefined' && ONLINE_PLAYERS[playerId]) {
      const p = ONLINE_PLAYERS[playerId];
      if (p.tr && p.tr.cars && p.tr.cars[0]) {
        targetCar = p.tr.cars[0];
      }
    }
    if (!targetCar) return;

    if (targetCar.chatBubble) {
      try {
        targetCar.remove(targetCar.chatBubble);
        if (targetCar.chatBubble.material) {
          if (targetCar.chatBubble.material.map) targetCar.chatBubble.material.map.dispose();
          targetCar.chatBubble.material.dispose();
        }
      } catch(e) {}
      targetCar.chatBubble = null;
    }

    const bubble = makeSpeechBubbleSprite(text);
    bubble.position.set(0, 6.8, -CARHALF + 2.5);
    targetCar.add(bubble);
    targetCar.chatBubble = bubble;

    setTimeout(() => {
      if (targetCar && targetCar.chatBubble === bubble) {
        try {
          targetCar.remove(bubble);
          if (bubble.material) {
            if (bubble.material.map) bubble.material.map.dispose();
            bubble.material.dispose();
          }
        } catch(e) {}
        targetCar.chatBubble = null;
      }
    }, 6000);
  } catch(e) {}
}

function chatChime() {
  if (typeof AC === 'undefined' || !AC) return;
  try {
    tone(880, 0, 0.12, 'sine', 0.14, master);
    tone(1320, 0.08, 0.18, 'sine', 0.14, master);
  } catch(e) {}
}

let lastHudUpdateTime = 0;
function updateOnlineHud(force) {
  const now = Date.now();
  if (!force && now - lastHudUpdateTime < 1200) return;
  lastHudUpdateTime = now;

  const badge = document.getElementById('onlineCountBadge');
  const titleCount = document.getElementById('titleOnlineCount');
  const hudBtn = document.getElementById('btnOnlineHud');
  const count = 1 + Object.keys(ONLINE_PLAYERS).length;
  if (badge && badge.textContent !== String(count)) badge.textContent = count;
  if (titleCount && titleCount.textContent !== String(count)) titleCount.textContent = count;
  if (hudBtn) hudBtn.classList.toggle('hide', !IS_ONLINE);

  const vl = document.getElementById('viewLoop');
  if (vl && !vl.classList.contains('hide') && typeof drawHomeMap === 'function') {
    drawHomeMap();
  }

  const onlinePanel = document.getElementById('onlinePanel');
  if (onlinePanel && !onlinePanel.classList.contains('hide')) {
    const opList = document.getElementById('opList');
    if (opList) {
      let html = '';
      if (IS_ONLINE && typeof G !== 'undefined' && G && G.phase === 'play') {
        const stObj = G.atStation !== null ? stOf(G.atStation) : (G.nv != null ? stOf(G.nv) : null);
        const myLoc = G.atStation !== null ? (stObj ? stObj.name + ' 停車中' : '停車中') : (stObj ? stObj.name + 'へ走行中' : '走行中');
        const mySpd = Math.round(G.v * 3.6);
        const myLine = typeof CFG !== 'undefined' && CFG ? CFG.id : 'loop';
        const myLineName = myLine === 'branch' ? '白峰支線' : myLine === 'branch2' ? '紫雲地下線' : myLine === 'branch3' ? '天宮高架線' : '汐見環状線';
        const svcName = SERVICES[G.route] ? SERVICES[G.route].name : myLineName;
        html += `
          <div class="op-item is-me">
            <div class="op-item-top">
              <span class="op-item-name">👤 ${MY_PLAYER_NAME} <span style="font-size:11px;color:#38bdf8;font-weight:700;">(あなた)</span>${window.IS_DEV ? ' <span style="background:#d97706;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:4px;">🛠️ 開発者</span>' : ''}</span>
              <span class="op-item-svc" style="color:#38bdf8;">${svcName}</span>
            </div>
            <div class="op-item-info">
              <span>📍 ${myLoc}</span>
              <span>⚡ ${mySpd} km/h</span>
            </div>
          </div>
        `;
      }
      for (const pid in ONLINE_PLAYERS) {
        const p = ONLINE_PLAYERS[pid];
        const spd = Math.round((p.v || 0) * 3.6);
        const loc = p.stName ? (p.v > 0.5 ? p.stName + '付近 走行中' : p.stName + ' 停車中') : '走行中';
        const pLine = p.line || 'loop';
        const pLineName = pLine === 'branch' ? '白峰支線' : pLine === 'branch2' ? '紫雲地下線' : pLine === 'branch3' ? '天宮高架線' : pLine === 'branch4' ? '港見支線' : pLine === 'branch5' ? '四嶺連絡高速線' : '汐見環状線';
        const curLine = typeof CFG !== 'undefined' && CFG ? CFG.id : 'loop';
        const svcLook = p.service && SERVICES[p.service] ? SERVICES[p.service].short : pLineName;
        let distText = '';
        if (typeof G !== 'undefined' && G && G.s != null && p.s != null && pLine === curLine) {
          const curL = typeof CFG !== 'undefined' && CFG ? CFG.L : 72000;
          const d = Math.round(Math.abs(mod(p.s - G.s + curL / 2, curL) - curL / 2));
          distText = ` (距離: ${d < 1000 ? d + 'm' : (d / 1000).toFixed(1) + 'km'})`;
        } else if (pLine !== curLine) {
          distText = ` (${pLineName})`;
        }
        html += `
          <div class="op-item">
            <div class="op-item-top">
              <span class="op-item-name">👤 ${p.name}${p.isDev ? ' <span style="background:#d97706;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;margin-left:4px;">🛠️ 開発者</span>' : ''}</span>
              <span class="op-item-svc">${svcLook}</span>
            </div>
            <div class="op-item-info">
              <span>📍 ${loc}${distText}</span>
              <span>⚡ ${spd} km/h</span>
            </div>
          </div>
        `;
      }
      if (!html) {
        html = '<div style="text-align:center;color:#64748b;padding:24px;">現在接続中の他の乗務員はいません</div>';
      }
      opList.innerHTML = html;
    }
  }

  if (typeof updateStationSelectButtons === 'function') updateStationSelectButtons();
}

function branchAiSeeds(lineId,sts,trk0,trk1){
  /* 支線のAI列車の初期位置（起動時も駅選択時も同じ計算を使う） */
  const rushNow=(()=>{const h=new Date().getHours()+new Date().getMinutes()/60;return (h>=6&&h<9)||(h>=17&&h<21);})();
  const span=Math.max(500,trk1-trk0);
  const per=lineId==='branch'?(rushNow?2:1):lineId==='branch2'?3:lineId==='branch3'?2:4;
  const total=lineId==='branch'?per:per*2;
  const out=[];
  for(let i=0;i<total;i++){
    const key=lineId==='branch'?(total===1?'A':(i%2===0?'A':'B')):(i%2===0?'A':'B');
    out.push({key,s:Math.round(trk0+((i+0.5)/total)*span)});
  }
  return out;
}
function checkOnlineStationBlocked(st, serviceKey, lineId) {
  const targetLine = lineId || 'loop';
  if (targetLine === 'branch4') return null;
  const cfg = lineConfig(targetLine);
  const L = (cfg && cfg.L) ? cfg.L : 72000;
  const trackSo = (typeof TK !== 'undefined' && TK[serviceKey]) ? (TK[serviceKey].so || 0) : 0;
  const stPos = st.s + trackSo;
  for (const pid in ONLINE_PLAYERS) {
    const p = ONLINE_PLAYERS[pid];
    if (!p || p.isPax || p.state !== 'driving') continue;
    const pLine = p.line || 'loop';
    if (pLine === targetLine && p.key === serviceKey && p.s != null) {
      const d = Math.abs(mod(p.s - stPos + L / 2, L) - L / 2);
      if (d < 1000) {
        return { name: p.name, dist: Math.round(d) };
      }
    }
  }
  const T = window.__T;
  if (T && T.OT && T.CFG && (T.CFG.id || 'loop') === targetLine && targetLine !== 'loop') {
    for (const a of T.OT) {
      if (!a || a.state === 'off' || a.key !== serviceKey) continue;
      const d = Math.abs(mod(a.s - stPos + L / 2, L) - L / 2);
      if (d < 1000) {
        return { name: 'AI列車(' + (a.name || serviceKey) + ')', dist: Math.round(d) };
      }
    }
  } else if (T && T.OT && (!T.CFG || (T.CFG.id || 'loop') === targetLine)) {
    for (const a of T.OT) {
      if (!a || a.state === 'off' || a.key !== serviceKey) continue;
      const d = Math.abs(mod(a.s - stPos + L / 2, L) - L / 2);
      if (d < 1000) {
        return { name: 'AI列車(' + (a.name || serviceKey) + ')', dist: Math.round(d) };
      }
    }
  } else if (targetLine === 'loop' && window.__ONLINE_AI_SNAPSHOT && (Date.now() - window.__ONLINE_AI_SNAPSHOT.ts) < 30000) {    for (const a of window.__ONLINE_AI_SNAPSHOT.trains) {
      if (!a || a.k !== serviceKey || a.s == null) continue;
      const d = Math.abs(mod(a.s - stPos + L / 2, L) - L / 2);
      if (d < 1000) {
        return { name: 'AI列車(' + (a.n || serviceKey) + ')', dist: Math.round(d) };
      }
    }
  } else if (targetLine === 'loop') {
    const cntMap = { A:8, B:8, C:6, D:6, E:4, F:4 };
    const allK = ['A','B','C','D','E','F'];
    const cnt = cntMap[serviceKey] || 0;
    const kIdx = allK.indexOf(serviceKey);
    const dir = (serviceKey === 'A' || serviceKey === 'C' || serviceKey === 'E') ? 1 : -1;
    const s0 = (cfg && cfg.s0 != null) ? cfg.s0 : 2000;
    for (let i = 0; i < cnt; i++) {
      const pos = mod(s0 + dir * ((i * (L / cnt)) + (kIdx * 420)), L);
      const d = Math.abs(mod(pos - stPos + L / 2, L) - L / 2);
      if (d < 1000) {
        return { name: 'AI列車(P' + serviceKey + i + ')', dist: Math.round(d) };
      }
    }
  } else if (targetLine !== 'branch4') {
    /* 支線：起動時と同じ初期配置のAI列車を1kmブロックに反映 */
    const sts2 = layoutStations(cfg);
    const trk0 = sts2[0].s - 151, trk1 = sts2[sts2.length - 1].s + 26;
    const cars = cfg.ncar || 6;
    const so = serviceKey === 'B' ? -(cars * 20.2 + 2) : 0;
    const pSt = st.s + so;
    for (const sd of branchAiSeeds(targetLine, sts2, trk0, trk1)) {
      if (sd.key !== serviceKey) continue;
      const d = Math.abs(sd.s - pSt);
      if (d < 1000) return { name: 'AI列車(' + sd.key + ')', dist: Math.round(d) };
    }
  }
  return null;
}

let curOnlineStList = null, curOnlineService = null;
function updateStationSelectButtons() {
  const stSel = document.getElementById('stSel');
  if (!stSel || stSel.classList.contains('hide')) return;
  if (!curOnlineStList || !curOnlineService) return;
  const isMinatomi = (curOnlineService.line === 'branch4');
  const isOnlineSvc = !isMinatomi && curOnlineService.kind !== 'pax' && curOnlineService.kind !== 'staff';
  const g = document.getElementById('stGrid');
  if (!g) return;
  const btns = g.querySelectorAll('button');
  curOnlineStList.forEach((st, idx) => {
    const bt = btns[idx];
    if (!bt) return;
    const blocked = isOnlineSvc ? checkOnlineStationBlocked(st, curOnlineService.key, curOnlineService.line || 'loop') : null;
    if (blocked) {
      const sig = blocked.name + ':' + blocked.dist;
      if (!bt.disabled || bt.dataset.blk !== sig) {
        bt.disabled = true;
        bt.dataset.blk = sig;
        bt.style.opacity = '0.45';
        bt.style.cursor = 'not-allowed';
        bt.style.borderColor = '#ef4444';
        bt.innerHTML = st.name + '<small style="color:#ef4444;font-weight:700;">⛔ ' + blocked.name + '接近中 (' + blocked.dist + 'm)</small>';
      }
    } else {
      if (bt.disabled || bt.dataset.blk) {
        bt.disabled = false;
        delete bt.dataset.blk;
        bt.style.opacity = '1';
        bt.style.cursor = 'pointer';
        bt.style.borderColor = '';
        bt.innerHTML = st.name + '<small>' + ({M:'主要駅',X:'快特停車',R:'快速停車',L:'',J:'乗換駅',Q:'2面4線',T:'通過線',I:'島式'}[st.cls] || '') + '</small>';
      }
    }
  });
}

let _lastPresPub = 0;
function publishPresence(force) {
  if (!ONLINE_CLIENT || !ONLINE_CLIENT.connected) return;
  const curG = (typeof G !== 'undefined' ? G : (window.G || (window.__T ? window.__T.G : null)));
  const isPax = !!(typeof PAX !== 'undefined' ? PAX : window.__PAX);
  const isDisp = !!(typeof document !== 'undefined' && document.getElementById('viewDispatch') && !document.getElementById('viewDispatch').classList.contains('hide')) || window.__DISP_MONITOR === true;
  const isDriving = curG && curG.phase === 'play' && !isPax && !isDisp;
  const now = Date.now();
  const minGap = (isDriving || isPax) ? 380 : 2800;
  if (!force && now - _lastPresPub < minGap) return;
  _lastPresPub = now;
  const curCfg = typeof CFG !== 'undefined' ? CFG : (window.CFG || (window.__T ? window.__T.CFG : null));
  const curLine = curCfg && curCfg.id ? curCfg.id : 'loop';
  if (isDriving && curLine === 'branch4') return; // 港見支線は短距離のためオンライン配信を行わない
  const stFn = typeof stOf === 'function' ? stOf : (window.stOf || (window.__T ? window.__T.stOf : null));
  const stObj = (isDriving && stFn) ? (curG.atStation !== null ? stFn(curG.atStation) : (curG.nv != null ? stFn(curG.nv) : null)) : null;
  const destText = (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.dk && ownTrain.dk.txt) ? ownTrain.dk.txt : '';
  const payload = {
    id: ONLINE_CLIENT_ID,
    name: MY_PLAYER_NAME,
    isDev: !!window.IS_DEV,
    state: isDisp ? 'dispatch' : (isDriving ? 'driving' : (isPax ? 'passenger' : 'title')),
    isPax: isPax,
    line: curLine,
    service: isDriving ? curG.route : null,
    key: isDriving ? curG.key : null,
    dir: isDriving ? curG.dir : 1,
    s: isDriving ? curG.s : null,
    v: isDriving ? curG.v : 0,
    door: (isDriving && curG.door) ? curG.door.state : 'closed',
    doorSide: (isDriving && curG.door) ? curG.door.side : 1,
    doorFrac: (isDriving && curG.door) ? curG.door.frac : 0,
    hornT: (isDriving && curG.hornT) ? curG.hornT : 0,
    hornKind: (isDriving && curG.hornKind) ? curG.hornKind : 'elec',
    mhornT: (isDriving && curG.mhornT) ? curG.mhornT : 0,
    mhornKind: (isDriving && curG.mhornKind) ? curG.mhornKind : 1,
    sq: (isDriving && curG.sq) ? (curG.sq|0) : 0,
    promoT: (isDriving && curG.promoLoop) ? curG.promoLoop.t0 : 0,
    promoOn: (isDriving && curG.promoOn) ? true : false,
    promoN: (isDriving && curG.promoLoop) ? curG.promoLoop.n : 0,
    load: (isDriving && curG.load) ? curG.load : 180,
    stName: stObj ? stObj.name : '',
    dest: destText,
    old: (typeof ownTrain !== 'undefined' && ownTrain) ? !!ownTrain.old : false,
    nCar: (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.cars) ? ownTrain.cars.length : 6,
    greenCars: (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.green) ? ownTrain.green : [],
    liv: (typeof ownTrain !== 'undefined' && ownTrain && ownTrain.mats && ownTrain.mats.liv1) ? ownTrain.mats.liv1.color.getHex() : null,
    twoMan: (typeof curG !== 'undefined' && curG) ? !!curG.twoMan : false,
    troubleMode: !!window.__TROUBLE_MODE,
    crew: (typeof CREWSEL !== 'undefined' ? CREWSEL : 'one'),
    avatar: (typeof AVATAR !== 'undefined' ? AVATAR : (window.__T && window.__T.AVATAR ? window.__T.AVATAR : null)),
    crewWalk: (isDriving && curG.walkOn) ? true : false,
    crewArea: (isDriving && curG.walkOn) ? (curG.walkArea || 'plat') : null,
    crewCar: (isDriving && curG.walkOn && curG.walkArea === 'train') ? (curG.walkCar || 0) : null,
    crewLx: (isDriving && curG.walkOn && curG.walkArea === 'train') ? (curG.walkLx || 0) : 0,
    crewLz: (isDriving && curG.walkOn && curG.walkArea === 'train') ? (curG.walkLz || 0) : 0,
    crewFl: (isDriving && curG.walkOn && curG.walkArea === 'train') ? (curG.walkFl || 'deck') : 'deck',
    paxS: (isPax && window.__T && window.__T.W) ? window.__T.W.s : ((isDriving && curG.walkOn && window.__T && window.__T.W) ? window.__T.W.s : null),
    paxO: (isPax && window.__T && window.__T.W) ? window.__T.W.o : ((isDriving && curG.walkOn && window.__T && window.__T.W) ? window.__T.W.o : 0),
    paxYaw: (isPax && window.__T && window.__T.W) ? window.__T.W.yaw : ((isDriving && curG.walkOn && window.__T && window.__T.W) ? window.__T.W.yaw : 0),
    paxArea: (isPax && window.__T && window.__T.W) ? window.__T.W.area : ((isDriving && curG.walkOn) ? (curG.walkArea || 'plat') : 'plat'),
    paxWalk: (isPax && window.__T && window.__T.W) ? !!(Math.hypot(window.__T.W.mv.x, window.__T.W.mv.y) > 0.1 || window.__T.W.keys.KeyW || window.__T.W.keys.KeyS || window.__T.W.keys.KeyA || window.__T.W.keys.KeyD || window.__T.W.keys.ArrowUp || window.__T.W.keys.ArrowDown || window.__T.W.keys.ArrowLeft || window.__T.W.keys.ArrowRight) : ((isDriving && curG.walkOn && window.__T && window.__T.W) ? !!(Math.hypot(window.__T.W.mv.x, window.__T.W.mv.y) > 0.1 || window.__T.W.keys.KeyW || window.__T.W.keys.KeyS || window.__T.W.keys.KeyA || window.__T.W.keys.KeyD || window.__T.W.keys.ArrowUp || window.__T.W.keys.ArrowDown || window.__T.W.keys.ArrowLeft || window.__T.W.keys.ArrowRight) : false),
    paxRide: (isPax && window.__T && typeof window.__T.getRide === 'function' && window.__T.getRide()) ? (() => {
      const r = window.__T.getRide();
      return { pid: (r.a && r.a.p) ? r.a.p.id : null, isAi: !(r.a && r.a.p), k: r.k, lx: r.lx, lz: r.lz, fl: r.fl, seat: r.seat, s: r.a ? r.a.s : null };
    })() : null,
    ts: Date.now()
  };
  try {
    ONLINE_CLIENT.publish('shiomi3d/v1/players/' + ONLINE_CLIENT_ID, JSON.stringify(payload), { qos: 0 });
  } catch(e) {}
}

function startOnlinePublishLoop() {
  if (onlinePubInterval) clearInterval(onlinePubInterval);
  onlinePubInterval = setInterval(() => publishPresence(false), 400);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (!ONLINE_CLIENT || !ONLINE_CLIENT.connected) {
      if (ONLINE_CLIENT) {
        try { ONLINE_CLIENT.end(true); } catch(e) {}
        ONLINE_CLIENT = null;
      }
      onlineBrokerIdx = 0;
      isConnectingOnline = false;
      initOnlineClient();
    } else {
      publishPresence(true);
      updateOnlineHud(true);
    }
  }
});
window.addEventListener('online', () => {
  if (!ONLINE_CLIENT || !ONLINE_CLIENT.connected) {
    onlineBrokerIdx = 0;
    isConnectingOnline = false;
    initOnlineClient();
  }
});

function stopOnlinePublishLoop() {
  if (onlinePubInterval) {
    clearInterval(onlinePubInterval);
    onlinePubInterval = null;
  }
  if (ONLINE_CLIENT && ONLINE_CLIENT.connected) {
    ONLINE_CLIENT.publish('shiomi3d/v1/players/' + ONLINE_CLIENT_ID, JSON.stringify({ id: ONLINE_CLIENT_ID, offline: true }));
  }
}

/* =====================================================================
   Play Notification: 誰かが乗務開始したらGmailへ通知 (FormSubmit経由)
   ===================================================================== */
function sendPlayNotification(lineId, svcKey, startI, stName) {
  return;
  try {
    const now = Date.now();
    const last = parseInt(sessionStorage.getItem('td_last_play_notify') || '0', 10);
    if (now - last < 60000) return; // 1分以内の連打・リロードによる重複を防止
    sessionStorage.setItem('td_last_play_notify', now.toString());

    const svcObj = (typeof SERVICES !== 'undefined' && SERVICES[svcKey]) ? SERVICES[svcKey] : {};
    const svcName = svcObj.name || svcKey || '乗務';
    const lineNames = {
      loop: '汐見環状線',
      branch: '白峰支線',
      branch2: '紫雲地下線',
      branch3: '天宮高架線',
      branch4: '港見支線',
      branch5: '四嶺連絡高速線'
    };
    const lineTitle = lineNames[lineId] || lineId || '汐見環状線';
    const playerName = (typeof MY_PLAYER_NAME !== 'undefined' && MY_PLAYER_NAME) ? MY_PLAYER_NAME : (localStorage.getItem('shiomi_online_name') || '運転士');
    const stationStr = stName || ((typeof STATIONS !== 'undefined' && STATIONS[startI]) ? STATIONS[startI].name : (startI + '番駅'));

    const ua = navigator.userAgent || '';
    let dev = 'パソコン (PC)';
    if (/iPhone/i.test(ua)) dev = 'iPhone';
    else if (/iPad/i.test(ua)) dev = 'iPad';
    else if (/Android/i.test(ua)) dev = 'Androidスマートフォン';
    else if (/Macintosh/i.test(ua)) dev = 'Mac';
    else if (/Windows/i.test(ua)) dev = 'Windows PC';
    else if (/Mobile/i.test(ua)) dev = 'スマートフォン';

    const timeStr = new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const isOnlineMode = (typeof IS_ONLINE !== 'undefined' && IS_ONLINE);
    const actStr = (svcObj.kind === 'pax') ? '見学を開始しました' : (svcObj.kind === 'staff') ? '勤務を開始しました' : '乗務を開始しました';

    const payload = {
      _subject: '【汐見環状線3D】' + playerName + 'さんが' + actStr + ' (' + svcName + ' / ' + stationStr + '駅)',
      _captcha: 'false',
      _template: 'table',
      'プレイヤー名': playerName,
      '運転士ランク': getDriverRank(CURRENT_DRIVER.totalDist),
      '累計走行距離': formatDriverDist(CURRENT_DRIVER.totalDist),
      '累計乗務時間': formatDriverTime(CURRENT_DRIVER.totalTime),
      'アカウント保護': CURRENT_DRIVER.passHash ? '🔒 パスワード設定済み' : '📴 ゲスト',
      '路線名': lineTitle,
      '運行種別': svcName,
      '開始駅': stationStr + '駅',
      '運行モード': isOnlineMode ? '🌐 オンライン乗務' : '📴 オフライン運転',
      '操作端末': dev,
      '開始時刻': timeStr
    };

    fetch('https://formsubmit.co/ajax/77c0266b3c001f710fb0460bf4ef7d9e', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function() {});
  } catch (e) {
    console.warn('Play notify error:', e);
  }
}

/* =====================================================================
   boot: builds the chosen line (loop or branch) and starts the game
   ===================================================================== */
window.__PAX = false;
function boot(LINE_ID,SVC,START_I){
window.__CUR_LINE_ID = LINE_ID;
{ const _m1 = document.getElementById('dtMHorn1'), _m2 = document.getElementById('dtMHorn2');
  if (_m1) _m1.style.display = (LINE_ID === 'branch2') ? 'none' : '';
  if (_m2) _m2.style.display = (LINE_ID === 'branch2') ? 'none' : ''; }
/* 指令モニター等で既に3Dの世界を作っているときは、古い描画ループ・イベントリスナ・前のキャンバスを片付けてから作り直す */
const TOKEN=(window.__FRAME_TOKEN||0)+1; window.__FRAME_TOKEN=TOKEN;
if(window.__TEST_INT){try{clearInterval(window.__TEST_INT);window.__TEST_INT=null;}catch(e){}}
if(window.__WORLD_ABORT){try{window.__WORLD_ABORT.abort();}catch(e){}}
if(typeof window.__AUDIO_CLEANUP==='function'){try{window.__AUDIO_CLEANUP();}catch(e){}}
const __WORLD_ABORT=typeof AbortController!=='undefined'?new AbortController():null;
window.__WORLD_ABORT=__WORLD_ABORT;
const __SIG=__WORLD_ABORT?__WORLD_ABORT.signal:undefined;
const _on=(t,ev,fn,opt)=>{if(!t)return;const o=typeof opt==='boolean'?{capture:opt}:Object.assign({},opt);if(__SIG)o.signal=__SIG;t.addEventListener(ev,fn,o);};
if(window.__WORLD_RENDERER){try{window.__WORLD_RENDERER.dispose();if(window.__WORLD_RENDERER.forceContextLoss)window.__WORLD_RENDERER.forceContextLoss();}catch(e){}}  /* v1.9.7：WebGLコンテキストを確実に解放（指令所→乗務の切替で失敗しないように） */
if(window.ONLINE_PLAYERS){for(const pid in ONLINE_PLAYERS){const p=ONLINE_PLAYERS[pid];if(p){if(p.tr){try{disposeTrain(p.tr);}catch(e){}}p.tr=null;p.ai=null;p.paxG=null;}}}
if(window.__WORLD_BUILT){ try{const og=document.getElementById('gl'); if(og&&og.parentNode) og.parentNode.removeChild(og);}catch(e){} }
window.__WORLD_BUILT=true; window.__DISP_MONITOR=false;
try{refreshDailyCond();const cb=document.getElementById('condBadge');if(cb)cb.classList.remove('hide');}catch(e){}
/* v1.9.7：支線の解放条件（累計100km）を撤廃。誰でも最初から全路線を選べる */
IS_ONLINE = (LINE_ID !== 'branch4'); // 港見支線以外は全種別・全駅必ずオンライン！
window.IS_ONLINE = IS_ONLINE;
setTimeout(() => initOnlineClient(), 300);
const CFG=lineConfig(LINE_ID);
window.CFG = CFG;
const ST0=layoutStations(CFG);const L=CFG.L,BRANCH=!!CFG.branch,MINI=!!CFG.mini;
const {px,pz,th}=genPath(L,CFG.R||0);
function P(s){s=mod(s,L);const i=Math.floor(s),f=s-i;return [px[i]+(px[i+1]-px[i])*f,pz[i]+(pz[i+1]-pz[i])*f,th[i]+(th[i+1]-th[i])*f];}
function sdiff(a,b){return mod(b-a+L/2,L)-L/2;}
const ov=(o,s)=>typeof o==='function'?o(s):o;
const NCAR=CFG.ncar||6,CARL=20.2,CARHALF=9.75,PB=135,PF=10,PH=1.1,DOORZ=[-6.3,0,6.3];
const NCARS={A:6,B:6,C:8,D:8,E:12,F:12,G:8,H:8};            // 各停6両・快速8両・特急8両・快速特急12両
const carsFor=k=>BRANCH?NCAR:(NCARS[k]||NCAR);
const PB12=12*CARL+22,PB8=8*CARL+18;                 // ホームは停まる最長の列車に合わせる
const PBof=st=>MINI?72:BRANCH?PB:(st.cls==='M'||st.cls==='X')?PB12:st.cls==='R'?PB8:PB;
const platCars=st=>BRANCH?NCAR:(st.cls==='M'||st.cls==='X')?12:st.cls==='R'?8:6;
const STATIONS=ST0.map(st=>Object.assign(st,{type:st.cls==='L'||st.cls==='T'?'side':st.cls==='J'?'junction':'island',big:st.cls==='M',
  lines:BRANCH?(st.i===0?[['汐見環状線','しおみかんじょうせん',0x14935f],['汐見環状線 快速','しおみかんじょうせんかいそく',0xe8731e],['汐見環状線 快速特急','しおみかんじょうせんかいそくとっきゅう',0xc8322b]]:null):(CITYLINES_ALL[st.i]||null),
  sp:{},wait:{A:[],B:[],C:[],D:[],E:[],F:[]}}));
const NST=STATIONS.length;
const startStObj = STATIONS[START_I] || ST0[START_I] || null;
const startStName = startStObj ? startStObj.name : '';
CURRENT_DRIVER.runs = (CURRENT_DRIVER.runs || 0) + 1;
saveCurrentDriverLocally();
syncDriverToMQTT();
sendPlayNotification(LINE_ID, SVC, START_I, startStName);
const BIG=STATIONS.filter(st=>st.lines).map(st=>st.i);
const RAPID=['快速線','かいそくせん',0xe8731e];
const RSTOPS=STATIONS.filter(st=>st.cls!=='L'&&st.cls!=='J'&&st.cls!=='I').map(st=>st.i);
const LSTOPS=STATIONS.filter(st=>st.cls==='M'||st.cls==='X').map(st=>st.i);
const isMajorStation=st=>!!(st&&(st.cls==='M'||st.cls==='X'||st.cls==='J'||st.cls==='Q'||st.big||(st.lines&&st.lines.length)));
const BASE_LIMIT=LINE_ID==='branch5'?200:BRANCH?80:90; /* 四嶺連絡高速線は最高200km/h */
const LIMITS=CFG.limits.map(([a,b,v])=>{const m=STATIONS[a].s+sdiff(STATIONS[a].s,STATIONS[b].s)/2;return {a:mod(m-220,L),b:mod(m+220,L),v};});
function limitAt(s){s=mod(s,L);for(const z of LIMITS){if(s>=z.a&&s<=z.b)return z.v;}return BASE_LIMIT;}
function stationNear(s){let best=null,bd=1e9;for(const st of STATIONS){const d=Math.abs(sdiff(st.s,s));if(d<bd){bd=d;best=st;}}return best;}
const TRK0=BRANCH?STATIONS[0].s-PBof(STATIONS[0])-16:0,TRK1=BRANCH?STATIONS[NST-1].s+PF+16:L; // branch: 線路は起点・終点のホームの端で終わる（車止め）
const hasTrack=s=>!BRANCH||(mod(s,L)>=TRK0&&mod(s,L)<=TRK1);

/* ================= vertical profile ================= */
const SEC={};let secN=0;
for(const z of CFG.sections){let a,b,r;
  if(z.between){const s1=STATIONS[z.between[0]],s2=STATIONS[z.between[1]],m=s1.s+sdiff(s1.s,s2.s)/2;a=m-110;b=m+110;r=z.k==='tunnel'?360:320;SEC[z.k+(secN++)]={a,b,h:z.h,r,m,k:z.k};}
  else{a=STATIONS[z.a].s-PB-200;b=STATIONS[z.b].s+PF+200;r=z.h<0?620:380;SEC[z.k+(secN++)]={a,b,h:z.h,r,k:z.k};}}
const YA=new Float32Array(L+1);
for(let i=0;i<=L;i++){let y=0;for(const k in SEC){const z=SEC[k];y+=z.h*smooth(z.a-z.r,z.a,i)*(1-smooth(z.b,z.b+z.r,i));}YA[i]=y;}
const Yat=s=>{s=mod(s,L);const i=Math.floor(s);return YA[i]+(YA[i+1]-YA[i])*(s-i);};
const slopeAt=s=>(Yat(s+2)-Yat(s-2))/4;
const inTunnel=s=>Yat(s)<-6.8;
const RIVERS=Object.values(SEC).filter(z=>z.k==='river');
function offs(s,o,y){const p=P(s);return new THREE.Vector3(p[0]+Math.cos(p[2])*o,y+Yat(s),p[1]+Math.sin(p[2])*o);}
function offsG(s,o,y){const p=P(s);return new THREE.Vector3(p[0]+Math.cos(p[2])*o,y,p[1]+Math.sin(p[2])*o);}
/* ホームドア：地下駅はすべて、主要駅・2面4線以上の駅、それに環状線の既存の並び（大幅に増設）
   v2.4.0：支線ごとの指定に対応
   ・白峰支線＝乗換駅（白峰）の1駅だけ
   ・紫雲地下線＝乗換駅（紫雲新都）以外の全ての駅
   ・天宮高架線・港見支線・連絡高速線は従来どおり */
const HOMEDOOR=new Set((MINI||LINE_ID==='branch')?[]:(LINE_ID==='branch2'?STATIONS.filter(st=>st.i!==0):STATIONS.filter(st=>{const y=Yat(st.s);return st.i%5===1||st.i%5===3||y<-5||y>5||MAINS.includes(st.i)||st.cls==='M'||st.cls==='X'||st.cls==='Q';})).map(st=>st.i));
if(LINE_ID==='branch')HOMEDOOR.add(0);
const CROSS=CFG.cross.map(([a,b])=>({s:mod(STATIONS[a].s+sdiff(STATIONS[a].s,STATIONS[b].s)*0.4,L),act:false,arm:0,t:0}));
const DEPOT=BRANCH?{a:-1e9,b:-1e9,base:14,n:0,gap:5}:{a:STATIONS[0].s-62-2570,b:STATIONS[0].s-62-920,base:16,n:28,gap:5.2};
function freqF(h){if(h<0.5)return 0.35;if(h<4.5)return 0.08;if(h<6)return 0.3;if(h<7)return 0.7;if(h<9)return 1;if(h<16)return 0.55;if(h<17)return 0.75;if(h<19.5)return 1;if(h<22)return 0.65;return 0.35;}
function peopleF(h){
  /* 朝ラッシュ 6–9時・夕ラッシュ 17–21時をピーク。階段付近が過密になりすぎない適正倍率に調整 */
  let m=0,e=0;
  if(h>=5&&h<6)m=2.5*(h-5);
  else if(h>=6&&h<9)m=2.5;
  else if(h>=9&&h<10.5)m=2.5*(10.5-h)/1.5;
  if(h>=16&&h<17)e=2.4*(h-16);
  else if(h>=17&&h<21)e=2.4;
  else if(h>=21&&h<22.5)e=2.4*(22.5-h)/1.5;
  const base=h<5?0.12:h<6?0.35:h>=22.5?0.4:h>=21?0.85:1.35;
  return Math.max(base,m,e);}
const hourNow=()=>{const d=new Date(nowMs());return d.getHours()+d.getMinutes()/60;};

/* ================= directional triple track: A C E | F D B ================= */
// gaps between A-C, C-E, E-F, F-D, D-B; widened for island platforms
const GAP=[0,1,2,3,4].map(()=>new Float32Array(L+1));
// the widened part of the alignment has to cover the whole platform, which is longer where long trains stop
const platMid=st=>st.s+(PF-PBof(st))/2,platHalf=st=>(PBof(st)+PF)/2;
const bump=(st,i)=>{const a=Math.abs(sdiff(platMid(st),i)),h=platHalf(st);return 1-smooth(h+6,h+135,a);};
const bumpWide=(st,i)=>{const a=Math.abs(sdiff(platMid(st),i)),h=platHalf(st);return 1-smooth(h+12,h+460,a);};
for(let i=0;i<=L;i++){let wR=0,wX=0,wJ=0,wM=0;
  for(const st of STATIONS){if(st.cls==='L')continue;const w=bump(st,i);if(w<=0)continue;
    if(st.cls==='R')wR=Math.max(wR,w);else if(st.cls==='J'||st.cls==='I')wJ=Math.max(wJ,w);else if(st.cls==='M')wM=Math.max(wM,w);else wX=Math.max(wX,w);}
  const isl=Math.max(wR,wX);
  if(BRANCH){GAP[0][i]=0;GAP[1][i]=0;GAP[2][i]=0;GAP[3][i]=0;GAP[4][i]=MINI?11*wJ:4.2+6.8*wJ;continue;} /* 港見支線は単線（行き違いの駅だけ2線） */
  const w0b=bumpWide(STATIONS[0],i); /* 汐見駅は6面12線化（450mかけて緩やかに分岐） */
  GAP[0][i]=Math.max(4.2+6.8*isl,4.2+15.8*w0b);GAP[1][i]=Math.max(4.2+6.8*wM,4.2+15.8*w0b);GAP[2][i]=Math.max(4.6+6.4*wX,4.6+15.4*w0b);GAP[3][i]=Math.max(4.2+6.8*wM,4.2+15.8*w0b);GAP[4][i]=Math.max(4.2+6.8*isl,4.2+15.8*w0b);}
const shiomiBump=s=>BRANCH?0:bumpWide(STATIONS[0],s);
/* 汐見駅7面14線：13・14番線（臨時・特急・出庫用の島式ホーム）を外側に増設。線路は汐見駅の前後で本線へ合流する */
const SH7=STATIONS[0].s-62;
const p7=s=>BRANCH?0:1-smooth(430,780,Math.abs(sdiff(SH7,s)));
const ownTrackOff=(k,s)=>{const T=TK[k];if(!T)return 0;if(BRANCH||k==='G'||k==='H')return T.off(s);return T.off(s)-T.dir*8.6*shiomiBump(s);};
const look=(arr,s)=>{s=mod(s,L);const i=Math.floor(s);return arr[i]+(arr[i+1]-arr[i])*(s-i);};
const offCv=s=>look(GAP[0],s),offE=s=>offCv(s)+look(GAP[1],s),offF=s=>offE(s)+look(GAP[2],s),offD=s=>offF(s)+look(GAP[3],s);
const sepB=s=>BRANCH?look(GAP[4],s):offD(s)+look(GAP[4],s);
/* 天宮支線：2面4線(Q)・通過線(T)の駅では各駅停車が外側の副本線に入る（本線から離れる量） */
const B3=!!CFG.b3,SIDEV=new Float32Array(L+1);
if(B3)for(let i=0;i<=L;i++){let d=0;for(const st of STATIONS){if(st.cls!=='Q'&&st.cls!=='T')continue;const w=bump(st,i);if(w>0)d=Math.max(d,(st.cls==='Q'?9.44:4.0)*w);}SIDEV[i]=d;}
const sidDev=s=>B3?look(SIDEV,s):0;
const RSTOPS_B3=new Set(CFG.rapidStops||[]);
const isPassSt=st=>B3&&(st.cls==='Q'||st.cls==='T');
/* 起点・終点のポイント：0＝本来の線路、1＝渡った先（終点は上り線のホーム、起点は下り線のホーム） */
const XA=s=>{if(!BRANCH||MINI)return 0;const sN=STATIONS[NST-1],a=sN.s-PBof(sN)-95;return smooth(a,a+65,mod(s,L));};
const XB=s=>{if(!BRANCH||MINI)return 0;const s0=STATIONS[0],a=s0.s+PF+30;return 1-smooth(a,a+65,mod(s,L));};
/* 同じホーム（同じ乗り場）を使う番線の代表：終点はすべて上り線側、起点はすべて下り線側、快速が各停と同じ線路の駅は各停 */
const platKey=(st,k)=>{if(!BRANCH)return k;if(MINI)return st.cls==='L'?'A':k;if(st.i===NST-1)return (k==='C'||k==='D')&&st.cls==='Q'?'D':'B';if(st.i===0)return (k==='C'||k==='D')&&st.cls==='Q'?'C':'A';
  if(B3&&st.cls!=='Q')return k==='C'?'A':k==='D'?'B':k;return k;};
const physDup=(st,k)=>platKey(st,k)!==k; /* 同じ乗り場を別の番線記号でも使う */
if(BRANCH)for(const st of STATIONS)for(const k of ['A','B','C','D']){const pk=platKey(st,k);if(pk!==k)st.wait[k]=st.wait[pk];} /* 列は同じ（先に来た電車に乗る） */
const OWNK0=(SERVICES[SVC]&&SERVICES[SVC].key)||'A',OWNOLD=BRANCH&&!(B3&&(OWNK0==='C'||OWNK0==='D'))&&LINE_ID!=='branch2'&&LINE_ID!=='branch5'; /* 自分の電車が古い形式か（紫雲・連絡高速は環状線と同じ新しい電車） */
const LCDSLIM=(LINE_ID==='branch2'); /* 紫雲地下線：環状線の車両から液晶を減らした仕様 */
const offC=offCv;
function yardOff(j){return s=>{const lead=1-smooth(DEPOT.b,DEPOT.b+160,s),fan=1-smooth(DEPOT.b-80,DEPOT.b+40,s);return -(DEPOT.base*lead+j*DEPOT.gap*fan);};}
const rbase=s=>sepB(s)+9,lbase=()=>-9;
function cityOff(ci,side,j,which){return s=>{const st=STATIONS[ci],u=sdiff(st.s-62,s),w=1-smooth(85,200,Math.abs(u)),dv=Math.max(0,Math.abs(u)-280);
  const t1=(side<0?lbase(s):rbase(s))+side*(6.5+j*17.5+dv*dv/500);return which===0?t1:t1+side*(4.2+6.8*w);};}
const CITYPAIRS=[];
for(const ci of BIG){const st=STATIONS[ci];let n=0;const sides=BRANCH?[1]:[-1,1];const jn=BRANCH?(MINI?[0,1]:[0,1,2]):[0,1];for(const side of sides)for(const j of jn){const ln=st.lines[n++];if(!ln)continue;CITYPAIRS.push({ci,side,j,line:ln,t1:cityOff(ci,side,j,0),t2:cityOff(ci,side,j,1)});}}
const KEYS=BRANCH?['A','B']:['A','B','C','D','E','F'];
const EXK=[];                                     // 特急は廃止
const ALLK=(B3?['A','B']:KEYS);                                 // AI列車プール（天宮高架線は各駅停車のA/Bのみ：快速廃止）
const TRACKS=[];
for(const k of (MINI?['A']:BRANCH?['A','B']:KEYS))TRACKS.push({k,off:{A:()=>0,B:sepB,C:offC,D:offD,E:offE,F:offF}[k],a:BRANCH?TRK0:null,b:TRK1});
if(!BRANCH){const s0=STATIONS[0],sa=s0.s-PBof(s0)-460,sb=s0.s+PF+460;for(const k of KEYS)TRACKS.push({k:'S'+k,off:s=>TK[k].off(s)-TK[k].dir*8.6*shiomiBump(s),a:sa,b:sb});} /* 汐見駅：各線路にプレイヤー退避線（左側）を追加し12線化 */
if(!BRANCH)for(const k of ['I','J'])TRACKS.push({k,off:s2=>TK[k].off(s2),a:STATIONS[0].s-PBof(STATIONS[0])-430,b:STATIONS[0].s+PF+430}); /* 汐見駅 13・14番線 */
if(MINI){const st=STATIONS[CFG.mini.loop];TRACKS.push({k:'B',off:sepB,a:st.s-PBof(st)-170,b:st.s+PF+170});} /* 行き違い用の線路 */
if(B3)for(const st of STATIONS){if(st.cls!=='Q'&&st.cls!=='T')continue;const a=platMid(st)-platHalf(st)-150,b=platMid(st)+platHalf(st)+150; /* 副本線（分岐して戻る） */
  TRACKS.push({k:'SA',off:s=>-sidDev(s),a,b});TRACKS.push({k:'SB',off:s=>sepB(s)+sidDev(s),a,b});}
for(const cp of CITYPAIRS){const st=STATIONS[cp.ci];TRACKS.push({k:'E2',off:cp.t1,a:st.s-662,b:st.s+538});TRACKS.push({k:'E2',off:cp.t2,a:st.s-662,b:st.s+538});}
if(BRANCH&&!MINI){const mk=(a,b,rev)=>({k:'X',off:s=>sepB(s)*clamp(rev?(b-s)/(b-a):(s-a)/(b-a),0,1),a,b});const s0=STATIONS[0],sN=STATIONS[NST-1];
  TRACKS.push(mk(s0.s+PF+30,s0.s+PF+95,false));TRACKS.push(mk(s0.s+PF+30,s0.s+PF+95,true)); /* 両渡り（シーサスクロッシング） */
  TRACKS.push(mk(sN.s-PB-95,sN.s-PB-30,true));TRACKS.push(mk(sN.s-PB-95,sN.s-PB-30,false));}
for(let j=0;j<DEPOT.n;j++)TRACKS.push({k:'Y',off:yardOff(j),a:DEPOT.a,b:j===0?DEPOT.b+165:DEPOT.b+40,yard:true});
const soFor=k=>-(carsFor(k)*CARL); // 逆方向の列車も正方向と同じ範囲に停め、始点・終点のホームドアとドア位置を一致させる
const isIsl=st=>st.cls!=='L'&&st.cls!=='M';
/* 支線：ホームが線路のどちら側か（+1＝オフセットの大きい側） A/B＝各駅停車（Q・Tでは副本線） C/D＝快速（本線） */
const brSide=(k,st)=>{if(MINI)return st.cls==='I'?(k==='A'?1:-1):-1;if(st.i===NST-1&&(k==='A'||k==='C'))k=k==='A'?'B':'D';if(st.i===0&&(k==='B'||k==='D'))k=k==='B'?'A':'C';const c=st.cls,isl=c==='J'||c==='I';if(k==='A')return isl||c==='Q'?1:-1;if(k==='B')return isl||c==='Q'?-1:1;if(k==='C')return isl?1:-1;return isl?-1:1;};
const isM=st=>st.cls==='M';
/* ===== 特急（G/H）：環状線の地下を全線走る専用線 =====
   地下の深さと線路の位置。ホームは線路の外側（±7.4m のさらに外側）に置く。 */
const LTD_DEPTH=-21, LTD_OFF=7.4, LTD_HALF=15.6;
function ltdY(s){return LTD_DEPTH;}
const TK={
  A:{off:s=>{const b=-sidDev(s),r=XA(s);return b+(sepB(s)-b)*r;},dir:1,so:0,side:st=>BRANCH?brSide('A',st):(!BRANCH&&st.i===0)?-1:isIsl(st)?1:-1,main:'A'},
  B:{off:s=>(sepB(s)+sidDev(s))*(1-XB(s)),dir:-1,so:soFor('B'),side:st=>BRANCH?brSide('B',st):(!BRANCH&&st.i===0)?1:isIsl(st)?-1:1,main:'B'},
  C:{off:s=>BRANCH?sepB(s)*XA(s):offC(s),dir:1,so:0,side:st=>BRANCH?brSide('C',st):(!BRANCH&&st.i===0)?-1:isM(st)?1:-1,main:'C'},D:{off:s=>BRANCH?sepB(s)*(1-XB(s)):offD(s),dir:-1,so:soFor('D'),side:st=>BRANCH?brSide('D',st):(!BRANCH&&st.i===0)?1:isM(st)?-1:1,main:'D'},
  E:{off:s=>offE(s),dir:1,so:0,side:st=>(!BRANCH&&st.i===0)?-1:isM(st)?-1:1,main:'E'},F:{off:s=>offF(s),dir:-1,so:soFor('F'),side:st=>(!BRANCH&&st.i===0)?1:isM(st)?1:-1,main:'F'},
  /* 特急：環状線の地下（LTD_DEPTH=-21m）を全線走る専用複線。G=外回り(-7.4m、左ホーム-1)、H=内回り(+7.4m、右ホーム+1) */
  G:{off:s=>-LTD_OFF,dir:1,so:0,side:()=>-1,main:'G'},H:{off:s=>LTD_OFF,dir:-1,so:soFor('H'),side:()=>1,main:'H'},
  /* 汐見駅 13・14番線（島式ホーム）。駅の前後で本線へ合流 */
  I:{off:s=>-17.2*p7(s),dir:1,so:0,side:()=>-1,main:'A'},J:{off:s=>-25.8*p7(s),dir:1,so:0,side:()=>1,main:'A'}};
for(const k in TK){TK[k].y=(k==='G'||k==='H')?ltdY:Yat;const m=TK[k].main;TK[k].mainAt=()=>m;}
const serves=(st,k)=>{if(DIASH==='change'&&!BRANCH){
  /* 変更ダイヤ：快速が特急並みの停車駅になる。特急は常に汐見駅と主要駅のみ */
  if(k==='C'||k==='D')return st.cls==='M'||st.cls==='X'||(st.cls==='R'&&st.i%2===0);
  if(k==='G'||k==='H')return st.i===0||st.cls==='M';}
  return k==='A'||k==='B'?true:(k==='C'||k==='D')?(BRANCH?false:st.cls!=='L'):(k==='E'||k==='F')?(st.cls==='M'||st.cls==='X'):(k==='G'||k==='H')?(!BRANCH&&(st.i===0||st.cls==='M')):(k==='I'||k==='J')?(!BRANCH&&st.i===0):false;};
const KIND={A:'local',B:'local',C:'rapid',D:'rapid',E:'ltd',F:'ltd',G:'exp',H:'exp',I:'local',J:'local'};
const PARTNER={A:'C',C:'A',B:'D',D:'B'};
const partnerAt=(st,k)=>isM(st)?({C:'E',E:'C',D:'F',F:'D'})[k]:PARTNER[k]; // who arrives across the island
const PLATNO={A:1,C:2,E:3,F:4,D:5,B:6,I:13,J:14};
const mainAt=(k)=>TK[k].main,physKey=(k,s)=>{if(BRANCH)return (s!=null)?platKey(stationNear(s),k):k;return k;},inConn=()=>false;
const onRapid=k=>!BRANCH&&(k==='C'||k==='D'||k==='E'||k==='F'||k==='G'||k==='H');
const RAPID_LIMIT=120;
const limitFor=(k,s)=>{const base=BRANCH?limitAt(s):k==='E'||k==='F'?150:(k==='G'||k==='H')?210:(k==='C'||k==='D')?120:limitAt(s);return Math.round(base*(WXF||1));};
const inQuad=()=>!BRANCH,inC=()=>true,inD=()=>true,QA=0,QB=L,TWINS=[];
// platform extents / exits per track at a station (lateral offsets at the platform centre)
function platRange(st,k){const s=st.s-62;const ord=(a,b)=>[Math.min(a,b),Math.max(a,b)];
  if(!BRANCH&&(k==='G'||k==='H')){const o=LTD_OFF;return k==='G'?ord(-o-6.4,-o-1.72):ord(o+1.72,o+6.4);} /* 特急の地下ホーム */
  if(!BRANCH&&st.i===0&&(k==='I'||k==='J')){const o0=TK[k].off(s);return k==='I'?ord(o0-6.88,o0-1.72):ord(o0+1.72,o0+6.88);}
  if(!BRANCH&&st.i===0){const sd=-TK[k].dir,o0=TK[k].off(s);return ord(o0+(sd<0?-8.6:0)+1.72,o0+(sd<0?0:8.6)-1.72);}
  if(MINI&&st.cls==='L')return ord(-1.72,-1.72-4.6);
  if(BRANCH&&st.i===NST-1&&(k==='A'||k==='C'))k=k==='A'?'B':'D';if(BRANCH&&st.i===0&&(k==='B'||k==='D'))k=k==='B'?'A':'C';
  if(BRANCH&&st.cls==='Q'){const dv=sidDev(s);return (k==='A'||k==='C')?ord(-dv+1.72,-1.72):ord(sepB(s)+1.72,sepB(s)+dv-1.72);}
  if(BRANCH&&st.cls==='T'){const dv=sidDev(s);return (k==='A'||k==='C')?ord(-dv-7.2,-dv-1.72):ord(sepB(s)+dv+1.72,sepB(s)+dv+7.2);}
  if(st.cls==='L'||(BRANCH&&st.cls!=='J'&&st.cls!=='I'))return k==='A'?ord(-7.2,-1.72):ord(sepB(s)+1.72,sepB(s)+7.2);
  if(BRANCH)return ord(1.72,sepB(s)-1.72);
  if(isM(st)){if(k==='A')return ord(-7.2,-1.72);if(k==='B')return ord(sepB(s)+1.72,sepB(s)+7.2);if(k==='C'||k==='E')return ord(offC(s)+1.72,offE(s)-1.72);return ord(offF(s)+1.72,offD(s)-1.72);}
  if(k==='A'||k==='C')return ord(1.72,offC(s)-1.72);if(k==='E'||k==='F')return ord(offE(s)+1.72,offF(s)-1.72);return ord(offD(s)+1.72,sepB(s)-1.72);}
for(const st of STATIONS){st.exitO={};for(const k of KEYS){if(!serves(st,k))continue;const r=platRange(st,k);const m=(r[0]+r[1])/2;st.exitO[k]=m;}
  if(!BRANCH&&st.i===0)for(const k of ['I','J']){const r=platRange(st,k);st.exitO[k]=(r[0]+r[1])/2;}}
function occAt(s){s=mod(s,L);const r=[];if(!hasTrack(s)&&!BRANCH)return r;const st=stationNear(s),u=sdiff(st.s-62,s),sb=sepB(s),near=Math.abs(u)<95;
  if(hasTrack(s)){const lp=near&&(st.cls==='L'||st.cls==='M'||(BRANCH&&st.cls!=='J'&&st.cls!=='I'&&st.cls!=='Q'))?7.2:0,dv=sidDev(s),w0=shiomiBump(s)*8.6,w7=p7(s)*17.2;r.push([-3.2-lp-dv-w0-w7,sb+3.2+lp+dv+w0]);}
  if(s>DEPOT.a-40&&s<DEPOT.b+330)r.push([-(DEPOT.base+DEPOT.n*DEPOT.gap+14),-2]);
  for(const cp of CITYPAIRS){const cs=STATIONS[cp.ci];const uu=sdiff(cs.s-62,s);if(uu<-600||uu>600)continue;const a=cp.t1(s),b=cp.t2(s);r.push([Math.min(a,b)-3.2,Math.max(a,b)+3.2]);}
  return r;}
/* ================= renderer / scene ================= */
const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobileDevice,
  logarithmicDepthBuffer: false,
  powerPreference: isMobileDevice ? 'default' : 'high-performance'
});
let CTXLOST=false;
window.__WORLD_RENDERER=renderer;
_on(renderer.domElement,'webglcontextlost',e=>{e.preventDefault();CTXLOST=true;},false);
_on(renderer.domElement,'webglcontextrestored',()=>{CTXLOST=false; /* 画像を全部読み直す */
  try{scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of ms){for(const k of ['map','emissiveMap','alphaMap'])if(m[k])m[k].needsUpdate=true;m.needsUpdate=true;}});}catch(_){}},false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, isMobileDevice ? 1.0 : 1.1));
renderer.setSize(innerWidth,innerHeight);renderer.domElement.id='gl';document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xc4d6e6,200,1400);scene.background=new THREE.Color(0xc4d6e6);

/* ===== 天候設定（自動。プレイヤーは選ばない）===== */
const WXDEF={
  clear:{n:'晴れ',sky:0xc4d6e6,fog:[0xc4d6e6,260,1700],sun:1.0,amb:0.9,trac:1.0,vis:1.0},
  cloudy:{n:'曇り',sky:0xa9b6c4,fog:[0xa9b6c4,180,1250],sun:0.55,amb:0.95,trac:0.98,vis:1.0},
  rain:{n:'雨',sky:0x6f7d8c,fog:[0x76828f,120,760],sun:0.3,amb:0.85,trac:0.90,vis:0.85},
  snow:{n:'雪',sky:0xd3dae2,fog:[0xd7dee7,90,600],sun:0.35,amb:1.0,trac:0.75,vis:0.8},
  fog:{n:'霧',sky:0xc3c9cf,fog:[0xc3c9cf,40,300],sun:0.4,amb:0.9,trac:0.92,vis:0.55}
};
WX=Object.assign({id:'clear'},WXDEF.clear);
const LINENAME=BRANCH?(LINE_ID==='branch2'?'紫雲地下線':LINE_ID==='branch3'?'天宮高架線':LINE_ID==='branch4'?'港見支線':LINE_ID==='branch5'?'四嶺連絡高速線':'白峰支線'):'汐見環状線';
const LINEEN=BRANCH?(LINE_ID==='branch2'?'Shiun Subway Line':LINE_ID==='branch3'?'Amamiya Elevated Line':LINE_ID==='branch4'?'Minatomi Branch Line':LINE_ID==='branch5'?'Shirei High-Speed Connection Line':'Shiramine Branch Line'):'Shiomi Loop Line';
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.12,3200);camera.rotation.order='YXZ';camera.layers.enable(2);
const hemi=new THREE.HemisphereLight(0xb9c8e8,0x4a3a30,0.8);scene.add(hemi);
const dirL=new THREE.DirectionalLight(0xffffff,0.8);scene.add(dirL);
/* 選んだ天候・ダイヤ・出庫を実際の世界に反映する（bootのたびに呼ぶ） */
function applyConditionState(){
  /* 毎日の自動天気・毎月の自動ダイヤ。?wx=/?dia= は動作確認用の強制指定（画面からは選べない） */
  let daily=null;try{daily=dailyCondition();}catch(e){daily=null;}
  const q=(()=>{try{return new URLSearchParams(location.search);}catch(e){return null;}})();
  const qwx=q&&q.get('wx'),qdia=q&&q.get('dia');
  const wid=(qwx&&WXDEF[qwx])?qwx:(daily?daily.wid:'clear');
  window.__WEATHER=wid;
  window.__DAILY_COND=daily;
  window.__DEPOT_START=false; /* 車庫からの出庫は廃止 */
  const man=(()=>{try{const v=localStorage.getItem('td_dia');return (v==='normal'||v==='extra'||v==='change')?v:'auto';}catch(e){return 'auto';}})();
  const dia=(qdia==='extra'||qdia==='change'||qdia==='normal')?qdia:(daily?daily.dia:'normal');
  window.__DIA_MAN=man;
  window.__DIASH=dia;
  Object.assign(WX,WXDEF[wid],{id:wid});WXF=WX.trac;
  scene.fog.color.setHex(WX.fog[0]);scene.fog.near=WX.fog[1];scene.fog.far=WX.fog[2];scene.background.setHex(WX.sky);
  hemi.intensity=0.8*WX.amb;dirL.intensity=0.8*WX.sun;
  DIASH=(window.__DIASH==='extra'||window.__DIASH==='change')?window.__DIASH:'normal';
  DEPOT_START=false; /* 車庫からの出庫は廃止（関連UI・開始ルートも撤去） */
  /* ダイヤ変更で停車駅が変わると、駅の出口位置の表も作り直す */
  try{for(const st of STATIONS){st.exitO={};for(const k of KEYS){if(!serves(st,k))continue;const r=platRange(st,k);st.exitO[k]=(r[0]+r[1])/2;}
    if(!BRANCH&&st.i===0)for(const k of ['I','J']){const r=platRange(st,k);st.exitO[k]=(r[0]+r[1])/2;}}}catch(e){}
  if(WXPTS){try{scene.remove(WXPTS);WXPTS.geometry.dispose();WXPTS.material.dispose();}catch(e){}WXPTS=null;WXPOS=null;}
  if(WX.id==='rain'||WX.id==='snow'||WX.id==='fog')initWeatherFx();
}
/* 車庫から本線に合流したときの放送などの、運転条件の実行時処理 */
function updConditionFx(dt){
  if(typeof G==='undefined'||!G||G.phase!=='play'||PAX)return;
  if(DEPOT_START&&G.depotJoinPending){const T=TK[G.key];if(T&&T.dir>0&&Math.abs(sdiff(DEPOT.b+120,G.s))>250){
    G.depotJoinPending=false;try{playGuide('depot_join');toast('本線に合流しました','ok');}catch(e){}}}
}
applyConditionState();
const DS=THREE.DoubleSide;
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const UNIT_PLANE=new THREE.PlaneGeometry(1,1);
const geoCache={};
const SHARED=new WeakSet(); // geometries/textures reused across chunks: never disposed
function boxGeo(w,h,d){const k=w+'_'+h+'_'+d;if(!geoCache[k]){geoCache[k]=new THREE.BoxGeometry(w,h,d);SHARED.add(geoCache[k]);}return geoCache[k];}
function faceRot(nx,nz){return Math.atan2(nx,nz);}
function mkCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');const tex=new THREE.CanvasTexture(c);tex.anisotropy=4;return {c,x,tex,w,h};}
function canvasTex(w,h,draw){const k=mkCanvas(w,h);draw(k.x,w,h);k.tex.needsUpdate=true;return k.tex;}
const dummy=new THREE.Object3D();

/* sky (follows the train) */
const skyGroup=new THREE.Group();scene.add(skyGroup);
const skyGeo=new THREE.SphereGeometry(3000,32,20);
const skyH=[];{const p=skyGeo.attributes.position;for(let i=0;i<p.count;i++)skyH.push(p.getY(i)/3000);}
const skyCol=new Float32Array(skyH.length*3);skyGeo.setAttribute('color',new THREE.BufferAttribute(skyCol,3));
const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-3;skyGroup.add(sky);
const sunMesh=new THREE.Mesh(new THREE.CircleGeometry(60,32),new THREE.MeshBasicMaterial({color:0xfff2d0,fog:false,depthWrite:false}));sunMesh.renderOrder=-2;skyGroup.add(sunMesh);
const moonMesh=new THREE.Mesh(new THREE.CircleGeometry(28,32),new THREE.MeshBasicMaterial({color:0xe8ecf5,fog:false,depthWrite:false}));moonMesh.renderOrder=-2;skyGroup.add(moonMesh);
const starMat=new THREE.PointsMaterial({color:0xffffff,size:1.7,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
{const sp=[];for(let i=0;i<800;i++){const a=rand(0,Math.PI*2),e=Math.asin(rand(0.06,1));sp.push(Math.cos(a)*Math.cos(e)*2800,Math.sin(e)*2800,Math.sin(a)*Math.cos(e)*2800);}
  const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));const pts=new THREE.Points(sg,starMat);pts.renderOrder=-2;skyGroup.add(pts);}
const mountMats=[0,1,2].map(()=>new THREE.MeshBasicMaterial({color:0x7d8fa6,fog:false}));/*mountains*/
for(let i=0;i<22;i++){const h=140+Math.random()*300,r=h*(1.0+Math.random()*0.6);
  const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5+(i%3)),mountMats[i%3]);
  const a=i/22*Math.PI*2+Math.random()*0.2,R=1850+Math.random()*450;m.position.set(Math.cos(a)*R,h/2-25,Math.sin(a)*R);m.rotation.y=Math.random()*3;m.renderOrder=-1;skyGroup.add(m);}
const groundPlane=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000),new THREE.MeshLambertMaterial({color:0x56603f,depthWrite:false}));groundPlane.rotation.x=-Math.PI/2;groundPlane.position.y=-0.3;groundPlane.renderOrder=-2;scene.add(groundPlane);
/* ================= materials ================= */
const winTexA=canvasTex(256,512,(x,w,h)=>{x.fillStyle='#c4c8cf';x.fillRect(0,0,w,h);
  /* 1階：店舗・エントランス */
  x.fillStyle='#2a3442';x.fillRect(0,h-48,w,48);
  for(let c=0;c<4;c++){x.fillStyle='#5b7c9c';x.fillRect(c*64+6,h-42,52,36);}
  /* 2階〜：ベランダと窓 */
  for(let r=0;r<12;r++){const y=r*38+8;x.fillStyle='rgba(0,0,0,0.12)';x.fillRect(0,y+28,w,4);
    for(let c=0;c<4;c++){const px=c*64+8;
      x.fillStyle='#1f2937';x.fillRect(px,y,48,22);
      x.fillStyle=(r*7+c*13)%5===0?'#ffe29a':'#486581';x.fillRect(px+3,y+2,42,18);
      x.fillStyle='#94a3b8';x.fillRect(px-2,y+20,52,8);}}});
const winTexB=canvasTex(256,512,(x,w,h)=>{x.fillStyle='#3d4b5c';x.fillRect(0,0,w,h);
  for(let r=0;r<16;r++){const y=r*32;
    x.fillStyle='#526173';x.fillRect(0,y,w,6);
    for(let c=0;c<6;c++){const px=c*42+4;
      const lit=(r*11+c*7)%7===0;
      const g=x.createLinearGradient(px,y+6,px,y+30);
      g.addColorStop(0,lit?'#ffdf94':'#6384a8');g.addColorStop(1,lit?'#eab354':'#2f4763');
      x.fillStyle=g;x.fillRect(px,y+6,36,24);
      x.fillStyle='rgba(255,255,255,0.15)';x.fillRect(px+2,y+7,12,4);}}});
const houseTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#f3f0e8';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(0,0,0,0.08)';x.lineWidth=2;for(let y=12;y<h;y+=16){x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke();}
  for(const y of [38,142]){for(const px of [30,104,178]){
    x.fillStyle='#2a3038';x.fillRect(px,y,48,44);
    x.fillStyle='#587796';x.fillRect(px+4,y+4,40,36);
    x.fillStyle='#cbd5e1';x.fillRect(px+22,y+4,3,36);x.fillRect(px-2,y+44,52,4);}}
  x.fillStyle='#5c3d2e';x.fillRect(108,186,40,70);x.fillStyle='#d4a373';x.fillRect(114,194,28,24);});
const fieldTex=canvasTex(256,256,(x,w,h)=>{x.fillStyle='#d8d4c8';x.fillRect(0,0,w,h);
  for(let i=0;i<16;i++){x.fillStyle=i%2?'rgba(0,0,0,0.10)':'rgba(255,255,255,0.08)';x.fillRect(0,i*16,w,8);}
  x.strokeStyle='rgba(120,110,90,0.35)';x.lineWidth=8;x.strokeRect(4,4,w-8,h-8);});
const facadeTex=canvasTex(256,64,(x,w,h)=>{x.fillStyle='#d8d6cf';x.fillRect(0,0,w,h);x.fillStyle='#2a3440';x.fillRect(0,16,w,30);
  for(let i=0;i<16;i++){x.fillStyle='#5b7390';x.fillRect(i*16+2,18,12,26);}});
facadeTex.wrapS=THREE.RepeatWrapping;
const trussTex=canvasTex(256,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='#5d6a78';x.lineWidth=10;x.beginPath();
  x.moveTo(0,6);x.lineTo(w,6);x.moveTo(0,h-6);x.lineTo(w,h-6);x.moveTo(0,h-6);x.lineTo(w/2,6);x.lineTo(w,h-6);x.moveTo(w/2,6);x.lineTo(w/2,h-6);x.stroke();});
trussTex.wrapS=THREE.RepeatWrapping;
const armTex=canvasTex(128,16,(x,w,h)=>{for(let i=0;i<8;i++){x.fillStyle=i%2?'#111':'#f2c12e';x.fillRect(i*16,0,16,h);}});
const MATS={
  ballast:new THREE.MeshLambertMaterial({color:0x6d655e,side:DS}),
  rail:new THREE.MeshPhongMaterial({color:0x9aa0a8,specular:0xffffff,shininess:80,side:DS}),
  plat:new THREE.MeshLambertMaterial({color:0xa19c91,side:DS}),
  platWall:new THREE.MeshLambertMaterial({color:0x767166,side:DS}),
  tactile:new THREE.MeshLambertMaterial({color:0xe8c23a,side:DS}),
  white:new THREE.MeshLambertMaterial({color:0xf2efe6,side:DS}),
  roof:new THREE.MeshLambertMaterial({color:0x5c616a,side:DS}),
  lamp:new THREE.MeshLambertMaterial({color:0xcfcfcf,emissive:0xfff4d8,emissiveIntensity:0,side:DS}),
  lampU:new THREE.MeshLambertMaterial({color:0xdddddd,emissive:0xfff4d8,emissiveIntensity:1.1,side:DS}),
  ground:new THREE.MeshLambertMaterial({color:0x56603f}),
  conc:new THREE.MeshLambertMaterial({color:0x9b9a94,side:DS}),
  concD:new THREE.MeshLambertMaterial({color:0x6e6d69,side:DS}),
  tunnel:new THREE.MeshLambertMaterial({color:0x383a40,emissive:0x0a0b0e,side:DS}),
  water:new THREE.MeshPhongMaterial({color:0x2f5f7a,specular:0x99bbcc,shininess:60,side:DS}),
  sand:new THREE.MeshLambertMaterial({color:0x9c8f6e,side:DS}),
  sea:new THREE.MeshPhongMaterial({color:0x2a6a9a,specular:0x88aacc,shininess:60,side:DS}),sand:new THREE.MeshLambertMaterial({color:0xd8c9a0,side:DS}),
  road:new THREE.MeshLambertMaterial({color:0x3c3d40,side:DS}),
  truss:new THREE.MeshLambertMaterial({map:trussTex,transparent:true,alphaTest:0.5,side:DS}),
  yardGround:new THREE.MeshLambertMaterial({color:0x7a746a,side:DS})
};
const fenceTex=canvasTex(128,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.fillStyle='#c9ced4';x.fillRect(0,0,w,12);x.fillRect(0,h-10,w,10);x.fillRect(0,0,8,h);x.fillRect(w-8,0,8,h);
  for(let i=16;i<w-8;i+=14)x.fillRect(i,10,4,h-18);x.fillRect(0,h*0.52,w,5);});
const IMATS={sleeper:lam(0x4a3b30),pole:lam(0x7a7f86),pillar:lam(0xe2ded2),stair:lam(0xc3c8bf),tree:lam(0x3f5a34),conc:lam(0x9b9a94),
  tlamp:new THREE.MeshBasicMaterial({color:0xe8f6ff}),hdp:lam(0x252c36),hdpost:lam(0x161b22),hdcap:lam(0x94a3b8),
  fence:new THREE.MeshLambertMaterial({map:fenceTex,alphaTest:0.4,side:DS}),fpost:lam(0xb9bec4),melo:lam(0xe0a21a),bumper:lam(0xc8322b),
  bldA:new THREE.MeshLambertMaterial({map:winTexA,emissive:0xffaa55,emissiveMap:winTexA,emissiveIntensity:0.1}),
  bldB:new THREE.MeshLambertMaterial({map:winTexB,emissive:0xffcc77,emissiveMap:winTexB,emissiveIntensity:0.1})};
const IGEO={sleeper:boxGeo(2.0,0.1,0.22),post:boxGeo(0.3,7.2,0.3),beam:boxGeo(1,0.35,0.35),pillar:new THREE.CylinderGeometry(0.15,0.15,1,8),
  stair:boxGeo(1,1,1),bldA:boxGeo(1,1,1),bldB:boxGeo(1,1,1),tree:new THREE.ConeGeometry(1.8,6,7),pier:boxGeo(1,1,1),pcap:boxGeo(1,1,1),tlamp:boxGeo(0.12,0.12,1.2),
  hdp:boxGeo(1,1,1),hdpost:boxGeo(1,1,1),hdcap:boxGeo(1,1,1),lightTower:boxGeo(1,1,1),fence:boxGeo(1,1,1),fpost:boxGeo(1,1,1),melo:boxGeo(1,1,1),bumper:boxGeo(1,1,1)};
const IMATKEY={sleeper:'sleeper',post:'pole',beam:'pole',pillar:'pillar',stair:'stair',bldA:'bldA',bldB:'bldB',tree:'tree',pier:'conc',pcap:'conc',tlamp:'tlamp',hdp:'hdp',hdpost:'hdpost',hdcap:'hdcap',lightTower:'pole',fence:'fence',fpost:'fpost',melo:'melo',bumper:'bumper'};
const roofGeo=(()=>{const sh=new THREE.Shape();sh.moveTo(-0.5,0);sh.lineTo(0.5,0);sh.lineTo(0,1);sh.lineTo(-0.5,0);const g=new THREE.ExtrudeGeometry(sh,{depth:1,bevelEnabled:false});g.translate(0,0,-0.5);return g;})();
Object.assign(IGEO,{house:boxGeo(1,1,1),roof:roofGeo,field:boxGeo(1,1,1),trunk:new THREE.CylinderGeometry(0.18,0.25,1,6),leaf:new THREE.SphereGeometry(1,8,6)});
Object.assign(IMATS,{house:new THREE.MeshLambertMaterial({map:houseTex}),roof:lam(0xffffff),field:new THREE.MeshLambertMaterial({map:fieldTex}),trunk:lam(0x5a4030),leaf:lam(0x4d7a3a)});
Object.assign(IMATKEY,{house:'house',roof:'roof',field:'field',trunk:'trunk',leaf:'leaf'});
const GROUNDK=new Set(['bldA','bldB','tree','pier','lightTower','house','roof','field','trunk','leaf']);


for(const t of [winTexA,winTexB,houseTex,fieldTex,facadeTex,trussTex,armTex,fenceTex])SHARED.add(t);for(const g of Object.values(IGEO))SHARED.add(g);
const WIREMAT=new THREE.LineBasicMaterial({color:0x2a2622});
/* ================= chunks (built lazily around the train) ================= */
const CH=500,NCH=Math.round(L/CH);
const CHUNKS=[];for(let c=0;c<NCH;c++)CHUNKS.push({g:null,b:null,inst:null,mats:[],built:false});
const chunkOf=s=>Math.floor(mod(s,L)/CH)%NCH;
for(const g of Object.values(geoCache))SHARED.add(g);SHARED.add(UNIT_PLANE);
function strip(c,s0,s1,step,prof,mat,allAbs,dy){
  const ch=CHUNKS[c];if(!ch.b)return;const b=ch.b[mat]||(ch.b[mat]={pos:[],idx:[]}),n=prof.length,base=b.pos.length/3;let row=0;
  for(let s=s0;;s+=step){if(s>s1)s=s1;const p=P(s),cx=Math.cos(p[2]),sz=Math.sin(p[2]),ty=Yat(s)+(dy||0);
    for(const it of prof){const oo=ov(it[0],s),yy=ov(it[1],s)+((allAbs||it[2])?0:ty);b.pos.push(p[0]+cx*oo,yy,p[1]+sz*oo);}
    if(row>0)for(let k=0;k<n-1;k++){const a=base+(row-1)*n+k,bb=a+n;b.idx.push(a,a+1,bb,a+1,bb+1,bb);}
    row++;if(s>=s1)break;}
}
function inst(c,key,s,o,y,sx,sy,sz,col,rot){const ch=CHUNKS[c];if(!ch.inst)return;(ch.inst[key]||(ch.inst[key]=[])).push([s,ov(o,s),y,sx||1,sy||1,sz||1,col,rot||0]);}
function cmat(c,m){CHUNKS[c].mats.push(m);return m;}
function addTo(c,o){CHUNKS[c].g.add(o);return o;}
const _ibv=new THREE.Vector3();
function finalizeChunk(c){const ch=CHUNKS[c];
  for(const k in ch.b){const d=ch.b[k];if(!d.idx.length)continue;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(d.pos,3));g.setIndex(d.idx);g.computeVertexNormals();ch.g.add(new THREE.Mesh(g,MATS[k]));}
  for(const k in ch.inst){const arr=ch.inst[k];const im=new THREE.InstancedMesh(IGEO[k],IMATS[IMATKEY[k]],arr.length);im.frustumCulled=false;const gk=GROUNDK.has(k);
    const ib=ch.ibox||(ch.ibox=new THREE.Box3());
    arr.forEach((a,i)=>{dummy.position.copy(gk?offsG(a[0],a[1],a[2]):offs(a[0],a[1],a[2]));{const m=Math.max(a[3],a[4],a[5])+1;ib.expandByPoint(_ibv.copy(dummy.position).addScalar(m));ib.expandByPoint(_ibv.copy(dummy.position).addScalar(-m));}dummy.rotation.set(0,-P(a[0])[2]+a[7],0);dummy.scale.set(a[3],a[4],a[5]);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);if(a[6])im.setColorAt(i,a[6]);});
    im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;ch.g.add(im);}
  ch.b=null;ch.inst=null;}
let GLOBALM=null;
function globalMats(){if(GLOBALM)return GLOBALM;GLOBALM=new Set();const add=o=>{if(!o)return;for(const k in o){const m=o[k];if(m&&m.isMaterial)GLOBALM.add(m);}};
  add(MATS);add(IMATS);add(TM);add(CM);add(OLDI);for(const m of [clockMat,upperMat,SLED_OFF,OLDBODY,hdGlassMat,hdFrameMat,hdWarnMat,...Object.values(HD_LCD_MATS),...Object.values(HD_LAMP_MATS)])if(m)GLOBALM.add(m);return GLOBALM;}
function disposeChunk(c){const ch=CHUNKS[c];if(!ch.built)return;scene.remove(ch.g);ch.ibox=null;ch.sph=undefined;
  const GM=globalMats(),seenM=new Set();
  ch.g.traverse(o=>{if(o.geometry&&!SHARED.has(o.geometry))o.geometry.dispose();if(o.isInstancedMesh&&o.dispose)o.dispose();
    const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    for(const m of ms){if(!m||GM.has(m)||seenM.has(m)||ch.mats.includes(m))continue;seenM.add(m);for(const k of ['map','emissiveMap','alphaMap'])if(m[k]&&!SHARED.has(m[k])&&!LEDTEX_SHARED(m[k]))m[k].dispose();m.dispose();}});
  for(const m of ch.mats){const i=STFAC.indexOf(m);if(i>=0)STFAC.splice(i,1);if(m.map&&!SHARED.has(m.map)&&!LEDTEX_SHARED(m.map))m.map.dispose();m.dispose();}ch.mats=[];
  for(let i=LEDS.length-1;i>=0;i--)if(LEDS[i].c===c){if(LEDS[i].live)LEDS[i].live=null;LEDS.splice(i,1);}
  for(const st of STATIONS)if(chunkOf(st.s)===c)st.hd=null;
  for(const sg of SIGNALS)if(sg.c===c)sg.lamps=null;
  for(const cr of CROSS)if(chunkOf(cr.s)===c){cr.arms=null;cr.lamps=null;cr.cars=null;}
  ch.g=null;ch.built=false;}
function ourSpan(s){
  if(!hasTrack(s))return [-3,3];
  const st=stationNear(s),u=sdiff(st.s-62,s),sb=sepB(s),near=Math.abs(u)<95;
  const lp=near&&(st.cls==='L'||st.cls==='M'||(BRANCH&&st.cls!=='J'&&st.cls!=='I'&&st.cls!=='Q'))?7.2:0;
  const dv=sidDev(s),w0=shiomiBump(s)*8.6,w7=p7(s)*17.2;
  return [-3.2-lp-dv-w0-w7,sb+3.2+lp+dv+w0];
}
const spanLo=s=>ourSpan(s)[0],spanHi=s=>ourSpan(s)[1];
const trenchAt=s=>{const y=Yat(s);return y<-0.25&&y>=-6.8;};
function trussStrip(c,s0,s1,o,y0,y1){const pos=[],uv=[],idx=[];let row=0;
  for(let s=s0;;s+=4){if(s>s1)s=s1;const a=offs(s,ov(o,s),y0),b=offs(s,ov(o,s),y1);pos.push(a.x,a.y,a.z,b.x,b.y,b.z);const u=(s-s0)/9;uv.push(u,0,u,1);
    if(row>0){const i=(row-1)*2;idx.push(i,i+1,i+2,i+1,i+3,i+2);}row++;if(s>=s1)break;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  addTo(c,new THREE.Mesh(g,MATS.truss));}
const PORTALS=[];{let prev=inTunnel(0);for(let s=2;s<L;s+=2){const t=inTunnel(s);if(t!==prev)PORTALS.push(s);prev=t;}}
/* ================= textures and signs ================= */
function signTex(st,prev,next,sub){
  return canvasTex(512,170,(x,w,h)=>{
    x.fillStyle='#f6f4ee';x.fillRect(0,0,w,h);x.fillStyle='#1d1d1d';x.textAlign='center';x.textBaseline='middle';
    x.font='700 64px '+FONT;x.fillText(st.name,w/2,56);x.font='500 22px '+FONT;x.fillStyle='#555';x.fillText(sub||st.kana,w/2,104);
    x.fillStyle=sub?'#444':'#14935f';x.fillRect(0,130,w,40);x.fillStyle='#fff';x.font='500 22px '+FONT;
    x.textAlign='left';if(prev)x.fillText('← '+prev,14,151);x.textAlign='right';if(next)x.fillText(next+' →',w-14,151);});
}
const _ttCache=new Map();
function timetableTex(st,dir,sub){
  const key=LINE_ID+'|'+st.i+'|'+dir+'|'+(sub||'');
  if(_ttCache.has(key))return _ttCache.get(key);
  const tex=canvasTex(256,320,(x,w,h)=>{
    x.fillStyle='#f8fafc';x.fillRect(0,0,w,h);
    x.strokeStyle='#334155';x.lineWidth=4;x.strokeRect(2,2,w-4,h-4);
    const hdrCol=sub?'#334155':(LINE_ID==='branch2'?'#7a3fa0':LINE_ID==='branch3'?'#0284c7':LINE_ID==='branch'?'#15803d':'#14935f');
    x.fillStyle=hdrCol;x.fillRect(4,4,w-8,46);
    x.fillStyle='#fff';x.textAlign='left';x.textBaseline='middle';
    x.font='700 20px '+FONT;x.fillText('時刻表',12,20);
    x.font='600 13px '+FONT;x.fillStyle='#e2e8f0';
    const dirTxt=sub?(sub+'方面'):BRANCH?(dir>0?(STATIONS[NST-1].name+'方面'):(STATIONS[0].name+'方面')):(dir>0?'外回り':'内回り');
    x.fillText(st.name+'駅（'+dirTxt+'）',12,39);
    const hasRapid=!BRANCH&&(st.cls==='M'||st.cls==='X'||st.cls==='R');
    const hasLtd=!BRANCH&&(st.cls==='M'||st.cls==='X');
    const baseSeed=(st.i*7+dir*3+31)&31;
    const hrs=[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23];
    let y=54;
    for(let idx=0;idx<hrs.length;idx++){
      const hr=hrs[idx];
      if(idx%2===1){x.fillStyle='#eef2f6';x.fillRect(6,y,w-12,13);}
      x.fillStyle='#1e293b';x.fillRect(6,y,24,13);
      x.fillStyle='#fff';x.font='700 10px '+FONT;x.textAlign='center';x.fillText(String(hr).padStart(2,'0'),18,y+7);
      const isRush=(hr>=7&&hr<=9)||(hr>=17&&hr<=20);
      const step=isRush?6:(hr>=22?12:9);
      const mins=[];
      for(let m=(baseSeed+hr*3)%step;m<60;m+=step){
        let kind='l';
        if(hasLtd&&m%24<6)kind='e';
        else if(hasRapid&&m%15<5)kind='r';
        mins.push([m,kind]);
      }
      x.textAlign='left';x.font='700 10px '+FONT;
      let xx=34;
      for(const [m,kind] of mins){
        if(xx>w-20)break;
        x.fillStyle=kind==='e'?'#c8322b':kind==='r'?'#d97706':'#0f172a';
        x.fillText(String(m).padStart(2,'0'),xx,y+7);
        xx+=18;
      }
      y+=13.5;
    }
    x.fillStyle='#f1f5f9';x.fillRect(6,h-22,w-12,16);
    x.font='600 9.5px '+FONT;x.textAlign='left';
    x.fillStyle='#0f172a';x.fillText('黒:普通',10,h-13);
    if(hasRapid){x.fillStyle='#d97706';x.fillText('橙:快速',56,h-13);}
    if(hasLtd){x.fillStyle='#c8322b';x.fillText('赤:快特',102,h-13);}
  });
  _ttCache.set(key,tex);
  return tex;
}
const stopTexN={};
function stopTexFor(n){return stopTexN[n]||(stopTexN[n]=canvasTex(128,160,(x,w,h)=>{x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#d8261d';x.lineWidth=10;x.strokeRect(5,5,w-10,h-10);
  x.fillStyle='#111';x.textAlign='center';x.textBaseline='middle';x.font='700 86px '+FONT;x.fillText(String(n),w/2,70);x.font='700 20px '+FONT;x.fillText('停止位置',w/2,132);}));}
const stopTex=stopTexFor(NCAR);
/* v1.9.8：ホームドア一体型＆床面用 乗車位置案内（号車番号・グリーン車乗車口） */
function boardMarkTex(n,green){return canvasTex(256,112,(x,w,h)=>{
  const bg=green?'#0b5e38':'#0f294a', accent=green?'#22c55e':'#38bdf8', fg='#f8fafc';
  x.fillStyle=bg;x.fillRect(0,0,w,h);
  x.fillStyle=accent;x.fillRect(0,0,w,8);
  x.strokeStyle='rgba(255,255,255,0.22)';x.lineWidth=3;x.strokeRect(2,2,w-4,h-4);
  x.fillStyle=fg;x.textAlign='left';x.textBaseline='middle';
  x.font='800 54px '+FONT;x.fillText(String(n),18,58);
  x.font='700 22px '+FONT;x.fillText('号車',n>=10?84:56,64);
  x.fillStyle=green?'#86efac':'#bae6fd';x.font='700 18px '+FONT;
  x.fillText(green?'グリーン車乗車口':'乗車位置',18,95);
  x.fillStyle='rgba(255,255,255,0.75)';x.font='600 13px '+FONT;x.textAlign='right';
  x.fillText(green?'GREEN CAR':'BOARDING',w-14,95);});}
const BOARDMAT={};
for(let i2=1;i2<=12;i2++)for(const g2 of [0,1]){
  const key2='bm'+(g2?'g':'n')+i2;
  IGEO[key2]=UNIT_PLANE;
  IMATS[key2]=BOARDMAT[key2]=new THREE.MeshBasicMaterial({map:boardMarkTex(i2,!!g2),side:THREE.FrontSide});
  IMATKEY[key2]=key2;
}
function limitTex(v){return canvasTex(128,128,(x,w,h)=>{
  x.fillStyle=v?'#f2cf3a':'#f6f4ee';x.fillRect(0,0,w,h);x.strokeStyle='#111';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6);
  x.fillStyle='#111';x.textAlign='center';x.textBaseline='middle';
  if(v){x.font='700 70px '+FONT;x.fillText(String(v),w/2,h/2+4);}else{x.font='700 40px '+FONT;x.fillText('解除',w/2,h/2);}});}
function numTex(n){return canvasTex(128,128,(x,w,h)=>{x.fillStyle='#1d3f7a';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='700 76px '+FONT;x.fillText(String(n),w/2,58);x.font='700 22px '+FONT;x.fillText('番線',w/2,106);});}
const CLK=mkCanvas(128,128);
function drawClock(){const x=CLK.x,d=new Date(nowMs());x.clearRect(0,0,128,128);
  x.fillStyle='#fbfaf6';x.beginPath();x.arc(64,64,60,0,Math.PI*2);x.fill();x.lineWidth=5;x.strokeStyle='#222';x.stroke();
  x.fillStyle='#222';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;x.fillRect(64+Math.sin(a)*48-2,64-Math.cos(a)*48-2,4,4);}
  const h=d.getHours()%12+d.getMinutes()/60,m=d.getMinutes()+d.getSeconds()/60,s=d.getSeconds();
  const hand=(a,l,w,c)=>{x.strokeStyle=c;x.lineWidth=w;x.lineCap='round';x.beginPath();x.moveTo(64,64);x.lineTo(64+Math.sin(a)*l,64-Math.cos(a)*l);x.stroke();};
  hand(h/12*Math.PI*2,28,6,'#111');hand(m/60*Math.PI*2,42,4,'#111');hand(s/60*Math.PI*2,46,1.5,'#d8261d');CLK.tex.needsUpdate=true;}
drawClock();
const clockMat=new THREE.MeshBasicMaterial({map:CLK.tex,transparent:true,side:DS});SHARED.add(CLK.tex);
function plane(c,mat,w,h,s,o,y,rot){const m=new THREE.Mesh(UNIT_PLANE,mat);m.scale.set(w,h,1);m.position.copy(offs(s,ov(o,s),y));m.rotation.y=rot;CHUNKS[c].g.add(m);return m;}
function faceSide(s,dir){const t=P(s)[2];return faceRot(dir*Math.cos(t),dir*Math.sin(t));}

/* 柵：線路方向に沿う柵と、ホームを横切る柵（約2mごとのパネル＋支柱） */
function fenceRun(c,sA,sB,o){const len=sB-sA;if(len<0.4)return;const n=Math.max(1,Math.round(len/2)),pl=len/n;
  for(let i=0;i<n;i++)inst(c,'fence',sA+(i+0.5)*pl,o,PH+0.56,0.03,1.08,pl);
  for(let i=0;i<=n;i++)inst(c,'fpost',sA+i*pl,o,PH+0.6,0.06,1.2,0.06);}
function fenceAcross(c,s,oA,oB){const a=ov(oA,s),b=ov(oB,s),lo=Math.min(a,b),w=Math.abs(b-a);if(w<0.4)return;const n=Math.max(1,Math.round(w/2)),pl=w/n;
  for(let i=0;i<n;i++)inst(c,'fence',s,lo+(i+0.5)*pl,PH+0.56,0.03,1.08,pl,null,Math.PI/2);
  for(let i=0;i<=n;i++)inst(c,'fpost',s,lo+i*pl,PH+0.6,0.06,1.2,0.06);}
/* 線路側で電車のドアが来ない区間（ホームドアのある駅はホームドアの切れ目） */
function edgeFence(st,k,isSiding){const fk=isSiding?('S'+k):k;st.fz=st.fz||{};if(st.fz[fk])return st.fz[fk];const T=TK[k],sd=isSiding?-T.side(st):T.side(st),base=isSiding?ownTrackOff(k,st.s):T.off(st.s),a=st.s-PBof(st),b=st.s+PF;let zones,line;
  if(HOMEDOOR.has(st.i)){line=base+sd*(1.72+0.22);zones=[[a+0.3,a+2],[b-2,b-0.3]];}
  else{const fr=st.s+T.so,len=carsFor(k)*CARL,ta=T.dir<0?fr:fr-len,tb=T.dir<0?fr+len:fr;line=base+sd*(1.72+0.3);
    zones=[[a+0.3,ta-1.0],[tb+1.0,b-0.3]].filter(z=>z[1]-z[0]>0.5);}
  return st.fz[fk]={line,sd,zones};}
function applyFencePlayer(W){if(!W.st)return;let keys=[];
  if(PAX&&PX.plats&&PX.plats[PX.pi]&&PX.plats[PX.pi].keys.length)keys=PX.plats[PX.pi].keys.slice();else keys=[physKey(G.key,W.st.s)];
  for(const k of keys){if(!TK[k]||!serves(W.st,k))continue;
    const checks=(!BRANCH&&W.st.i===0)?[[k,false],[k,true]]:[[k,false]];
    for(const [ck,isSid] of checks){const F=edgeFence(W.st,ck,isSid);if(Math.abs(W.o-F.line)>3)continue;
      for(const [za,zb] of F.zones)if(W.s>za-0.3&&W.s<zb+0.3){const safe=F.line+F.sd*0.35;if(F.sd>0){if(W.o<safe)W.o=safe;}else{if(W.o>safe)W.o=safe;}}}}}
let CUR_ROOFS_TARGET=null;
function addRoofBox(target,s0,s1,o0,o1,y0,y1){
  if(!target)return;
  const sc=mod((s0+s1)/2,L),hs=Math.abs(s1-s0)/2;
  target.push({sc,hs,o0:Math.min(o0,o1),o1:Math.max(o0,o1),y0,y1});
}
function platform(c,s0,s1,edge,dir,wd,opts){
  const e=d=>s=>ov(edge,s)+dir*d;
  strip(c,s0,s1,3,[[e(0),PH],[e(wd),PH]],'plat');strip(c,s0,s1,3,[[e(0),0.25],[e(0),PH]],'platWall');strip(c,s0,s1,3,[[e(wd),0.02],[e(wd),PH]],'platWall');
  strip(c,s0,s1,3,[[e(0.08),PH+0.005],[e(0.32),PH+0.005]],'white');strip(c,s0,s1,3,[[e(0.42),PH+0.006],[e(0.72),PH+0.006]],'tactile');
  if(opts.roof){strip(c,s0+12,s1-2,3,[[e(0.6),4.95],[e(wd+0.4),5.3]],'roof');strip(c,s0+12,s1-2,3,[[e(2.0),4.93],[e(2.3),4.93]],'lamp');
    for(let s=s0+16;s<s1-3;s+=10)inst(c,'pillar',s,e(3.9),PH+(4.95-PH)/2+0.1,1,4.0,1);
    const sm=(s0+s1)/2,ym=Yat(sm);addRoofBox(CUR_ROOFS_TARGET,s0+12,s1-2,ov(edge,sm)+dir*0.6,ov(edge,sm)+dir*(wd+0.4),ym-0.5,ym+5.4);}
  else strip(c,s0+4,s1-2,3,[[e(2.0),6.9],[e(2.3),6.9]],'lampU');
  fenceRun(c,s0+0.3,s1-0.3,e(wd-0.12));                                  // 向かいにホームがない側（ホームの裏）
  fenceAcross(c,s0+0.25,e(0.15),e(wd-0.12));fenceAcross(c,s1-0.25,e(0.15),e(wd-0.12)); // ホームの端
  return e;
}
function islandPlat(c,s0,s1,eA,eB,roof){
  const ea=s=>ov(eA,s),eb=s=>ov(eB,s),mid=d=>s=>(ea(s)+eb(s))/2+d;
  strip(c,s0,s1,3,[[ea,PH],[eb,PH]],'plat');strip(c,s0,s1,3,[[ea,0.25],[ea,PH]],'platWall');strip(c,s0,s1,3,[[eb,0.25],[eb,PH]],'platWall');
  strip(c,s0,s1,3,[[s=>ea(s)+0.08,PH+0.005],[s=>ea(s)+0.32,PH+0.005]],'white');strip(c,s0,s1,3,[[s=>ea(s)+0.42,PH+0.006],[s=>ea(s)+0.72,PH+0.006]],'tactile');
  strip(c,s0,s1,3,[[s=>eb(s)-0.32,PH+0.005],[s=>eb(s)-0.08,PH+0.005]],'white');strip(c,s0,s1,3,[[s=>eb(s)-0.72,PH+0.006],[s=>eb(s)-0.42,PH+0.006]],'tactile');
  if(roof){strip(c,s0+12,s1-2,3,[[s=>ea(s)+0.6,5.1],[mid(0),5.35],[s=>eb(s)-0.6,5.1]],'roof');
    for(let s=s0+16;s<s1-3;s+=10)inst(c,'pillar',s,mid(0),PH+(5.3-PH)/2,1,4.2,1);
    const sm=(s0+s1)/2,ym=Yat(sm);addRoofBox(CUR_ROOFS_TARGET,s0+12,s1-2,ea(sm)+0.6,eb(sm)-0.6,ym-0.5,ym+5.45);}
  const ly=roof?5.02:6.9,lm=roof?'lamp':'lampU';strip(c,s0+12,s1-2,3,[[mid(-1.9),ly],[mid(-1.6),ly]],lm);strip(c,s0+12,s1-2,3,[[mid(1.6),ly],[mid(1.9),ly]],lm);
  fenceAcross(c,s0+0.25,s=>ea(s)+0.15,s=>eb(s)-0.15);fenceAcross(c,s1-0.25,s=>ea(s)+0.15,s=>eb(s)-0.15); // ホームの端
  return mid;
}
function boards(c,st,s0,s1,o,dir,prev,next,sub){const mat=cmat(c,new THREE.MeshBasicMaterial({map:signTex(st,prev,next,sub),side:THREE.FrontSide,color:0xe8e8e8}));
  const ttMat=cmat(c,new THREE.MeshBasicMaterial({map:timetableTex(st,dir,sub),side:THREE.FrontSide,color:0xe8e8e8}));
  for(let s=s0+16;s<s1-6;s+=30){plane(c,mat,2.9,0.96,s,o,2.25,faceSide(s,dir));plane(c,ttMat,1.02,1.28,s+2.15,o,2.14,faceSide(s+2.15,dir));}}
const STFAC=[];
function stationBuilding(c,sb,lo,hi,h0,h1,big,ground){
  const w=hi-lo,d=big?24:16,t=P(sb)[2];const tex=facadeTex.clone();tex.needsUpdate=true;tex.repeat.set(Math.max(1,Math.round(w/16)),1);
  const fm=cmat(c,new THREE.MeshLambertMaterial({map:tex,emissive:0xffe2b0,emissiveMap:tex,emissiveIntensity:0}));STFAC.push(fm);const mats=[lam(0xd8d6cf),lam(0xd8d6cf),lam(0x6d7075),lam(0x6d7075),fm,fm];
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h1-h0,d),mats);m.position.copy((ground?offsG:offs)(sb,(lo+hi)/2,(h0+h1)/2));m.rotation.y=-t;CHUNKS[c].g.add(m);
  if(!ground){const r=new THREE.Mesh(boxGeo(1,1,1),lam(0x55595f));r.scale.set(w+1.5,0.5,d+1.5);r.position.copy(offs(sb,(lo+hi)/2,h1+0.25));r.rotation.y=-t;CHUNKS[c].g.add(r);}
}
// platform doors (みなとみらい線風：ガラス戸＋横長フルカラー液晶＋状態LED＋一体型乗車位置表示)
const hdGlassGeo=boxGeo(0.025,1.02,1.34),hdGlassMat=new THREE.MeshLambertMaterial({color:0xd8ecfc,transparent:true,opacity:0.30,depthWrite:false});
const hdFrameMat=lam(0x94a3b8),hdWarnMat=new THREE.MeshBasicMaterial({color:0xf59e0b});
const hdTopGeo=boxGeo(0.075,0.09,1.46),hdBotGeo=boxGeo(0.075,0.16,1.46),hdEdgeGeo=boxGeo(0.075,1.04,0.06),hdStileGeo=boxGeo(0.075,1.04,0.06);
const hdLcdGeo=UNIT_PLANE,hdLampGeo=boxGeo(0.12,0.045,0.26);
SHARED.add(hdGlassGeo);SHARED.add(hdTopGeo);SHARED.add(hdBotGeo);SHARED.add(hdEdgeGeo);SHARED.add(hdStileGeo);SHARED.add(hdLampGeo);
function mkHdLcdTex(title,sub,bg,accent,alert){return canvasTex(384,112,(x,w,h)=>{
  x.fillStyle=bg;x.fillRect(0,0,w,h);
  x.fillStyle=accent;x.fillRect(0,0,w,10);
  if(alert){x.fillStyle='rgba(255,255,255,0.12)';for(let i=-h;i<w+h;i+=28){x.beginPath();x.moveTo(i,h);x.lineTo(i+12,h);x.lineTo(i+h+12,0);x.lineTo(i+h,0);x.closePath();x.fill();}}
  x.fillStyle='#ffffff';x.textAlign='center';x.textBaseline='middle';
  x.font='800 38px '+FONT;x.fillText(title,w/2,48);
  x.fillStyle='rgba(255,255,255,0.88)';x.font='600 20px '+FONT;x.fillText(sub,w/2,88);
});}
const HD_LCD_MATS={
  wait:new THREE.MeshBasicMaterial({map:mkHdLcdTex('列車をお待ちください','Please stand behind the yellow line','#0b1628','#38bdf8',false)}),
  open:new THREE.MeshBasicMaterial({map:mkHdLcdTex('ドアが開きます','Doors opening · 足元にご注意','#092b1e','#22c55e',false)}),
  closing:new THREE.MeshBasicMaterial({map:mkHdLcdTex('ドアが閉まります','Doors closing · ご注意ください','#8f1111','#ef4444',true)})
};
const HD_LIVE_POOL=Array.from({length:16},()=>{
  const m=mkCanvas(512,128);
  const mat=new THREE.MeshBasicMaterial({map:m.tex});
  return {c:m.c,x:m.x,tex:m.tex,mat,hd:null,sig:'',lastDraw:0};
});
function drawHdLcdLive(slot,mode,title,sub,bg,accent,alert,blinkOn){
  const sig=mode+'|'+title+'|'+sub+'|'+(blinkOn?1:0);
  if(slot.sig===sig)return;
  slot.sig=sig;
  const x=slot.x,w=512,h=128;
  x.fillStyle=bg;x.fillRect(0,0,w,h);
  x.fillStyle=accent;x.fillRect(0,0,w,10);
  if(alert){
    x.fillStyle=blinkOn?'rgba(255,255,255,0.20)':'rgba(255,255,255,0.06)';
    for(let i=-h;i<w+h;i+=28){x.beginPath();x.moveTo(i,h);x.lineTo(i+12,h);x.lineTo(i+h+12,0);x.lineTo(i+h,0);x.closePath();x.fill();}
  }
  const fnt='"Noto Sans JP","Hiragino Sans","Apple SD Gothic Neo","PingFang SC","Microsoft YaHei",sans-serif';
  x.fillStyle='#ffffff';x.textAlign='center';x.textBaseline='middle';
  x.font='800 34px '+fnt;
  fitText(x,title,w/2,48,w-28,34,'800','center');
  x.fillStyle='rgba(255,255,255,0.90)';
  x.font='600 20px '+fnt;
  fitText(x,sub,w/2,90,w-28,20,'600','center');
  slot.tex.needsUpdate=true;
}
const HD_LAMP_MATS={
  wait:new THREE.MeshBasicMaterial({color:0x38bdf8}),
  open:new THREE.MeshBasicMaterial({color:0x22c55e}),
  closing:new THREE.MeshBasicMaterial({color:0xef4444})
};
function mkHdLeafMesh(q){
  const g=new THREE.Group();
  const gl=new THREE.Mesh(hdGlassGeo,hdGlassMat);gl.position.set(0,0.03,0);g.add(gl);
  const top=new THREE.Mesh(hdTopGeo,hdFrameMat);top.position.set(0,0.58,0);g.add(top);
  const bot=new THREE.Mesh(hdBotGeo,hdFrameMat);bot.position.set(0,-0.54,0);g.add(bot);
  const edge=new THREE.Mesh(hdEdgeGeo,hdWarnMat);edge.position.set(0,0.03,-q*0.70);g.add(edge);
  const stile=new THREE.Mesh(hdStileGeo,hdFrameMat);stile.position.set(0,0.03,q*0.70);g.add(stile);
  return g;
}
function buildHomeDoors(c,st,k,isSiding){
  const T=TK[k],sd=isSiding?-T.side(st):T.side(st);
  const offAt=s=>isSiding?ownTrackOff(k,s):T.off(s);
  const lineAt=s=>offAt(s)+sd*(1.72+0.22);
  const line=lineAt(st.s);
  const flip=T.dir<0,fr=st.s+T.so,doors=[];const NC=carsFor(k),GCs=greenCarsFor(k);
  const doorMeta=[];
  for(let q=0;q<NC;q++){
    const green=GCs.indexOf(q)>=0,cc=flip?fr+CARHALF+q*CARL:fr-CARHALF-q*CARL;
    for(const dz of (green?GDOORZ:DOORZ)){const ds=flip?cc+dz:cc-dz;doors.push(ds);doorMeta.push({ds,q,green});}
  }
  doors.sort((a,b)=>a-b);const leaves=[];const edges=[st.s-PBof(st)+2,...doors.flatMap(d=>[d-1.45,d+1.45]),st.s+PF-2];
  const lcdMeshes=[],lampMeshes=[];
  const rotPlat=sd>0?Math.PI/2:-Math.PI/2,rotTrk=-rotPlat;
  for(let q=0;q<edges.length;q+=2){
    const a=edges[q],b=edges[q+1],w=b-a;
    if(w>0.2){
      const mid=(a+b)/2,lm=lineAt(mid);
      inst(c,'hdp',mid,lm,PH+0.63,0.11,1.26,w);
      inst(c,'hdcap',mid,lm,PH+1.27,0.13,0.05,w+0.04);
      inst(c,'hdpost',a,lineAt(a),PH+0.65,0.15,1.30,0.14);
      inst(c,'hdpost',b,lineAt(b),PH+0.65,0.15,1.30,0.14);
      /* 戸袋にみなとみらい線風の横長フルカラーLCDと開閉状態LEDランプを内蔵 */
      if(w>=1.7){
        const lcd=new THREE.Mesh(hdLcdGeo,HD_LCD_MATS.wait);
        lcd.scale.set(1.12,0.32,1);
        lcd.position.copy(offs(mid,lm+sd*0.068,PH+1.02));
        lcd.rotation.y=faceSide(mid,sd);
        CHUNKS[c].g.add(lcd);lcdMeshes.push(lcd);
        const lamp=new THREE.Mesh(hdLampGeo,HD_LAMP_MATS.wait);
        lamp.position.copy(offs(mid,lm,PH+1.31));
        lamp.rotation.y=-P(mid)[2];
        CHUNKS[c].g.add(lamp);lampMeshes.push(lamp);
      }
    }
  }
  /* ホームドア一体型の号車・乗車位置案内（ドア脇の戸袋上部に表裏平行で配置） */
  for(const dm of doorMeta){
    const key='bm'+(dm.green?'g':'n')+(dm.q+1);
    if(!IGEO[key])continue;
    const ms=dm.ds+1.88,lm=lineAt(ms);
    inst(c,key,ms,lm+sd*0.072,PH+1.02,0.72,0.32,1,0,rotPlat);
    inst(c,key,ms,lm-sd*0.072,PH+1.02,0.72,0.32,1,0,rotTrk);
  }
  for(const d of doors)for(const q of [-1,1]){const m=mkHdLeafMesh(q);CHUNKS[c].g.add(m);leaves.push({m,d,q});}
  const hdk=isSiding?('S'+k):k;
  const hd={leaves,lcdMeshes,lampMeshes,lcdState:'wait',line,lineAt,sd,frac:-1,tgt:0,st,k:hdk};(st.hd||(st.hd={}))[hdk]=hd;setHD(hd,0);
}
function setHD(hd,f){if(Math.abs(hd.frac-f)<0.002)return;hd.frac=f;for(const l of hd.leaves){const s=l.d+l.q*(0.73+f*1.35); /* 閉：中央でぴったり、端は戸袋に重なる */const ln=hd.lineAt?hd.lineAt(s):hd.line;l.m.position.copy(offs(s,ln,PH+0.65));l.m.rotation.y=-P(s)[2];}}
/* ホームドア当たり：開いていない区間は線路側へ出られない */
function hdDoorCenters(hd){if(hd._doors)return hd._doors;const s=new Set();for(const l of hd.leaves)s.add(l.d);return hd._doors=[...s];}
function hdGapAt(hd,s){if(hd.frac<0.22)return false;const half=Math.max(0.65,hd.frac*1.25);for(const d of hdDoorCenters(hd))if(Math.abs(sdiff(s,d))<half)return true;return false;}
function applyHDCollision(p){if(p.trackO===-99||!p.g.visible)return;const st=STATIONS[p.st];if(!st||!st.hd)return;
  const k=p.flow,pk=platKey(st,k);const hdKeys=(!BRANCH&&st.i===0)?[pk,'S'+pk]:(pk!==k?[pk,k]:[k]);
  for(const hk of hdKeys){const hd=st.hd[hk];if(!hd)continue;
    const sd=hd.sd!=null?hd.sd:(TK[k]?TK[k].side(st):1),line=hd.lineAt?hd.lineAt(p.s):hd.line,safe=line+sd*0.35;
    if(Math.abs(p.o-line)>3.2)continue;
    if(hd.frac>=0.22&&(hdGapAt(hd,p.s)||((p.kind==='board'||p.kind==='runner')&&p.doorS!=null&&Math.abs(sdiff(p.s,p.doorS))<1.35&&p.train&&boardOpen(p))))continue; /* 開いているドアの開口部・乗降中は通過できる */
    if(sd>0){if(p.o<safe)p.o=safe;}else{if(p.o>safe)p.o=safe;}}}
function applyHDPlayer(W){if(!W.st||!W.st.hd)return;
  /* 今いるホームの番線だけ判定（G.key固定だと他ホームへ移れない） */
  let keys=[];
  if(PAX&&PX.plats&&PX.plats[PX.pi]&&PX.plats[PX.pi].keys.length)keys=PX.plats[PX.pi].keys.slice();
  else keys=[physKey(G.key,W.st.s)];
  if(!BRANCH&&W.st.i===0)keys=keys.flatMap(k=>[k,'S'+k]);
  for(const k of keys){const hd=W.st.hd[k];if(!hd)continue;
    const sd=hd.sd!=null?hd.sd:(TK[k]?TK[k].side(W.st):1),line=hd.line,safe=line+sd*0.55;
    if(Math.abs(W.o-line)>3.2)continue; /* 遠いホームドアは無視 */
    if(hd.frac>0.25&&hdGapAt(hd,W.s))continue;
    if(sd>0){if(W.o<safe)W.o=safe;}else{if(W.o>safe)W.o=safe;}}}
/* ================= signals (logical blocks built once; visuals per chunk) ================= */
const SIGLAMP={G:[lam(0x0f2a1a),new THREE.MeshBasicMaterial({color:0x3dff8a})],Y:[lam(0x2e2408),new THREE.MeshBasicMaterial({color:0xffc233})],R:[lam(0x2e0c0c),new THREE.MeshBasicMaterial({color:0xff3b30})]};
const lampGeo=new THREE.CircleGeometry(0.1,14),sigHeadGeo=boxGeo(0.46,1.3,0.22),sigPoleGeo=new THREE.CylinderGeometry(0.07,0.07,4.4,8),sigHeadMat=lam(0x1a1c1f);
SHARED.add(lampGeo);SHARED.add(sigPoleGeo);
const BLK=420,BND={},SIGNALS=[],SIGBY={};
const sigLat=(k,x)=>{if(!BRANCH&&(k==='G'||k==='H'))return k==='G'?-LTD_OFF-2.3:LTD_OFF+2.3;if(!BRANCH&&k){const o=ownTrackOff(k,x);return o+(TK[k].dir>0?-2.7:2.7);}return ({A:-2.7-sidDev(x),B:sepB(x)+2.7+sidDev(x),C:offC(x)-2.1,D:offD(x)+2.1,E:offE(x)-2.1,F:offF(x)+2.1})[k];};
/* 支線は下り線（A・C）と上り線（B・D）で信号を共有する */
const sigKey=k=>BRANCH?({A:'A',C:'A',B:'B',D:'B'})[k]||k:(physKey(k)||k),trCls=k=>KIND[k]==='rapid'?'r':'l';
for(const k of (BRANCH?['A','B']:ALLK)){const T=TK[k];const pos=[];SIGBY[k]=[];
  for(let s=0;s<L;s+=BLK){if(!hasTrack(s)||!hasTrack(s+200))continue;let x=s;
    for(const st of STATIONS){if(!serves(st,k))continue;if(x>st.s-PBof(st)-8&&x<st.s+PF+8){x=T.dir>0?st.s+PF+14:st.s-PBof(st)-14;}}
    for(const cr of CROSS){if(Math.abs(sdiff(cr.s,x))<12)x+=T.dir*20;}pos.push(mod(x,L));}
  pos.sort((a,b)=>a-b);const uniq=pos.filter((v,i)=>i===0||v-pos[i-1]>40);BND[k]=uniq;
  uniq.forEach((x,bi)=>{const sg={k,x,bi,dir:T.dir,lamps:null,asp:'',c:chunkOf(x)};SIGNALS.push(sg);SIGBY[k][bi]=sg;});}
function buildSignal(sg){const x=sg.x,c=sg.c,t=P(x)[2],isLtd=!BRANCH&&(sg.k==='G'||sg.k==='H');const g=new THREE.Group();g.position.copy(isLtd?offsG(x,sigLat(sg.k,x),LTD_DEPTH):offs(x,sigLat(sg.k,x),0));g.rotation.y=-t+(sg.dir<0?Math.PI:0);addTo(c,g);
  const pole=new THREE.Mesh(sigPoleGeo,IMATS.pole);pole.position.y=2.2;g.add(pole);const head=new THREE.Mesh(sigHeadGeo,sigHeadMat);head.position.y=4.9;g.add(head);
  const lamps={};[['Yt',5.38,'Y'],['G',5.06,'G'],['R',4.74,'R'],['Yb',4.42,'Y']].forEach(([n,y,col])=>{const m=new THREE.Mesh(lampGeo,SIGLAMP[col][0]);m.position.set(0,y,0.115);g.add(m);lamps[n]={m,col};});
  sg.lamps=lamps;const a=sg.asp;sg.asp='';if(a)setAspect(sg,a);}
function setAspect(sg,a){if(sg.asp===a)return;sg.asp=a;if(!sg.lamps)return;const on={G:a==='G'||a==='YG',Yt:a==='YG',R:a==='R',Yb:a==='Y'};
  for(const n in sg.lamps){const L2=sg.lamps[n];L2.m.material=SIGLAMP[L2.col][on[n]?1:0];}}

/* ================= stations ================= */
const stLights=[new THREE.PointLight(0xfff0d8,0,110,1.6),new THREE.PointLight(0xfff0d8,0,110,1.6)];stLights.forEach(l=>scene.add(l));
const LEDS=[];
const ledIdle=canvasTex(1024,288,(x,w,h)=>{const bg=x.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0e1b30');bg.addColorStop(1,'#09111f');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=BRANCH?'#2e8b57':'#1a6fd4';x.fillRect(0,0,w,8);x.fillStyle='#eef5ff';x.font='700 44px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(BRANCH?(LINE_ID==='branch2'?'紫雲地下線':LINE_ID==='branch3'?'天宮高架線':LINE_ID==='branch4'?'港見支線':LINE_ID==='branch5'?'四嶺連絡高速線':'白峰支線'):'汐見環状線',w/2,h/2-10);x.fillStyle='#8fb4e8';x.font='500 22px '+FONT;x.fillText('LCD 発車案内システム',w/2,h/2+38);});SHARED.add(ledIdle);
/* ホームドアがない駅のみ足元に水平な乗車位置ステッカーを貼る（ホームドアがある駅はホームドアに一体化済み） */
function boardingMarks(c,st,k,isSiding){if(!serves(st,k)||HOMEDOOR.has(st.i))return;const T=TK[k];if(!T)return;
  const sd=isSiding?-T.side(st):T.side(st),base=isSiding?ownTrackOff(k,st.s):T.off(st.s),flip=T.dir<0,fr=st.s+T.so;
  const NC=carsFor(k),GC=greenCarsFor(k),off=base+sd*2.32;
  for(let q=0;q<NC;q++){
    const green=GC.indexOf(q)>=0,key='bm'+(green?'g':'n')+(q+1);
    if(!BOARDMAT[key])continue;
    for(const dz of (green?GDOORZ:DOORZ)){
      const ds=flip?fr+CARHALF+q*CARL+dz:fr-CARHALF-q*CARL-dz;
      const m=new THREE.Mesh(UNIT_PLANE,BOARDMAT[key]);
      m.scale.set(0.95,0.42,1);
      m.position.copy(offs(ds,off,PH+0.015));
      m.rotation.order='YXZ';
      m.rotation.y=faceSide(ds,sd);
      m.rotation.x=-Math.PI/2;
      CHUNKS[c].g.add(m);
    }
  }
}
const gateTex=canvasTex(128,64,(x,w,h)=>{x.fillStyle='#0d1626';x.fillRect(0,0,w,h);x.fillStyle='#14c07a';x.font='700 26px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('IC',w/2,h/2);});
const cSign=(txt,bg,fg)=>canvasTex(256,64,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font='700 34px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(txt,w/2,h/2);});
const TEX_MIRROR=cSign('　','#cfe0ea','#cfe0ea');
const TEX_TOILET=cSign('トイレ Toilets','#1d3f7a','#fff'),TEX_KIDS=cSign('こどもトイレ','#2e7d4f','#fff'),
  TEX_GATE=cSign('改札口 Gates','#14935f','#fff'),TEX_SHOP=cSign('売店 SHOP','#b3202a','#fff'),TEX_EXIT=cSign('出口 Exit','#f0c419','#222');
const CONC_Y=7.2;
/* ===== v2.5.1：改札まわりの案内板（のりば・方面・駅構内案内）=====
   改札の手前に立つ案内板。駅名・のりば（番線／方面／種別）・出口やトイレなどの構内案内を
   1枚のキャンバスに描き、既存の駅名サインと同じ書式で3D看板にする。 */
const KNJ={local:'各停',rapid:'快速',ltd:'快特',exp:'特急'};
function guideBoardRows(st){
  const byNo=new Map();
  for(const k of KEYS){if(!serves(st,k))continue;
    const no=BRANCH?(MINI?1:(st.cls==='Q'?({A:1,C:2,D:3,B:4}[k]||1):(TK[k].dir<0?2:({A:1,C:1,B:2,D:2}[k]||1)))):(PLATNO[k]||1);
    if(!byNo.has(no)){const d=TK[k].dir;byNo.set(no,{no,dir:BRANCH?((d>0?STATIONS[NST-1]:STATIONS[0]).name+'方面'):(d>0?'外回り':'内回り'),dest:BRANCH?'':destLoop(st,d),kinds:[]});}
    else{const r0=byNo.get(no),dd=BRANCH?((TK[k].dir>0?STATIONS[NST-1]:STATIONS[0]).name+'方面'):(TK[k].dir>0?'外回り':'内回り');if(!r0.dir.split('／').includes(dd))r0.dir+='／'+dd;} /* 単線・共用ホームは両方向を1行に */
    const r=byNo.get(no),kj=KNJ[KIND[k]]||'各停';if(!r.kinds.includes(kj))r.kinds.push(kj);}
  return [...byNo.values()].sort((a,b)=>a.no-b.no);
}
function guideBoardTex(st){const rows=guideBoardRows(st).slice(0,6),step=30,top=104;
  return canvasTex(512,288,(x,w,h)=>{x.textBaseline='middle';
    x.fillStyle='#f7f6f1';x.fillRect(0,0,w,h);
    x.fillStyle='#12365e';x.fillRect(0,0,w,56);x.fillStyle='#14935f';x.fillRect(0,52,w,4);
    x.textAlign='left';x.fillStyle='#ffffff';x.font='700 30px '+FONT;x.fillText(st.name+'駅',18,29);
    x.textAlign='right';x.fillStyle='#cfe2ff';x.font='700 15px '+FONT;x.fillText('構内案内 / Station Guide',496,19);
    x.fillStyle='#9fc0e8';x.font='500 13px '+FONT;x.fillText(LINENAME,496,40);
    x.textAlign='left';x.fillStyle='#14935f';x.fillRect(16,68,5,18);
    x.fillStyle='#12365e';x.font='700 17px '+FONT;x.fillText('のりば　Platforms',30,78);
    rows.forEach((r,i)=>{const y=top+i*step;
      rrect(x,18,y-12,36,24,5);x.fillStyle='#12365e';x.fill();
      x.fillStyle='#ffffff';x.font='700 16px '+FONT;x.textAlign='center';x.fillText(String(r.no),36,y);
      x.textAlign='left';x.fillStyle='#17202b';x.font='700 16px '+FONT;x.fillText(r.dir,64,y-8);
      x.fillStyle='#5d6b78';x.font='500 13px '+FONT;x.fillText((r.dest?r.dest+'　':'')+r.kinds.join('・'),64,y+9);});
    rrect(x,336,64,158,208,10);x.fillStyle='#e9eef5';x.fill();x.strokeStyle='#c7d4e4';x.lineWidth=2;x.stroke();
    x.fillStyle='#12365e';x.font='700 16px '+FONT;x.fillText('駅構内',350,83);
    x.strokeStyle='#c7d4e4';x.lineWidth=1;x.beginPath();x.moveTo(348,96);x.lineTo(482,96);x.stroke();
    const FAC=[['出口 Exit','→'],['トイレ Toilets','←']];if(st.big)FAC.push(['売店 Shop','↑']);FAC.push(['のりば Platforms','←']);
    FAC.forEach(([t,a],i)=>{const y=120+i*38;
      x.fillStyle='#12365e';x.font='700 14px '+FONT;x.textAlign='left';x.fillText(t,350,y);
      x.fillStyle='#14935f';x.font='700 20px '+FONT;x.textAlign='right';x.fillText(a,484,y);});
    x.textAlign='left';x.fillStyle='#8b97a5';x.font='500 11px '+FONT;x.fillText('お忘れ物のないようお気をつけください',18,280);});}
function guideBoard(c,st,C,B){const mw=2.85,mh=1.6,cy=B+1.4,s=C.sc-12.2,o=C.o0-7.0;
  const g=new THREE.Group();g.position.copy(offsG(s,o,cy));g.rotation.y=faceSide(s,1);addTo(c,g);
  const fr=new THREE.Mesh(boxGeo(mw+0.10,mh+0.10,0.06),cmat(c,lam(0x8e959d)));fr.position.z=-0.035;g.add(fr);
  const face=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({map:guideBoardTex(st)})));face.scale.set(mw,mh,1);face.position.z=0.004;g.add(face);
  for(const px of [-mw/2+0.22,mw/2-0.22]){const post=new THREE.Mesh(boxGeo(0.08,0.68,0.08),cmat(c,lam(0x9aa1a9)));post.position.set(px,-1.14,-0.05);g.add(post);}}
function concourseGeom(st){const o0=-12,len=46;return {sc:st.s-75,o0,o1:o0-26,len};}
function buildConcourse(c,st){const C=concourseGeom(st),B=(st.concY!=null?st.concY:CONC_Y),H=3.4,om=(C.o0+C.o1)/2;
  const mWall=cmat(c,lam(0xe6e2d8)),mFloor=cmat(c,lam(0xbdb7a8)),mDark=cmat(c,lam(0x2b3038)),mTile=cmat(c,lam(0xdfe6e8)),
    mGate=cmat(c,new THREE.MeshBasicMaterial({map:gateTex})),mSt=cmat(c,lam(0xc9ccc9)),
    mCeil=cmat(c,new THREE.MeshBasicMaterial({color:0xe8ecf1})); /* 天井は下向きでも暗く見えないように */
  // put: w=横方向(レール直角)の幅, d=線路方向の長さ
  const put=(w,h,d,mat,s,o,y)=>{const m=new THREE.Mesh(boxGeo(w,h,d),mat);m.position.copy(offsG(s,o,y));m.rotation.y=-P(s)[2];addTo(c,m);return m;};
  const sign=(tex,s,o,y,w,h,face)=>{const m=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({map:tex})));m.scale.set(w,h,1);
    m.position.copy(offsG(s,o,y));m.rotation.y=-P(s)[2]+(face||0);addTo(c,m);return m;};
  put(26,0.3,C.len,mFloor,C.sc,om,B-0.15);put(26,0.12,C.len,mCeil,C.sc,om,B+H);              // 床と天井
  for(const ds of [-C.len/2,C.len/2])put(26,H,0.25,mWall,C.sc+ds,om,B+H/2);                   // 線路方向の端の壁
  put(0.25,H,C.len,mWall,C.sc,C.o1,B+H/2);                                                    // 奥の壁
  put(0.18,1.1,C.len,mWall,C.sc,C.o0,B+0.55);                                                 // ホーム側の手すり壁
  /* ホーム側はガラス板で仕切り、下のホームを見渡せるようにする */
  {const gm=cmat(c,new THREE.MeshLambertMaterial({color:0xbcd6e8,transparent:true,opacity:0.22,side:DS}));
    put(0.08,1.35,C.len,gm,C.sc,C.o0,B+1.78);
    for(const ds of [-14,0,14])put(0.16,1.35,0.16,lam(0x7b8794),C.sc+ds,C.o0,B+1.78);}
  for(let i2=0;i2<4;i2++){const ss=C.sc-7.5+i2*2.1;                                            // 自動改札（4通路）
    put(2.6,0.95,0.62,mSt,ss,C.o0-9,B+0.48);                                                  // 改札機の本体（金属）
    put(2.66,0.10,0.68,lam(0x2b3038),ss,C.o0-9,B+0.98);                                       // 天板
    const p1=sign(gateTex,ss,C.o0-9,B+1.04,1.6,0.42);p1.rotation.x=-Math.PI/2;                // 上面のICリーダー
  }
  put(2.6,0.95,0.62,mSt,C.sc+2.0,C.o0-9,B+0.48);put(2.66,0.10,0.68,lam(0x2b3038),C.sc+2.0,C.o0-9,B+0.98);
  {const p1=sign(gateTex,C.sc+2.0,C.o0-9,B+1.04,1.6,0.42);p1.rotation.x=-Math.PI/2;}
  sign(TEX_GATE,C.sc-3,C.o0-8.4,B+2.9,3.4,0.85);
  guideBoard(c,st,C,B); /* v2.5.1：改札の手前の案内板（のりば・方面・構内案内） */
  { // トイレ（入口・洗面・個室）
    const s0=C.sc+8,s1=C.sc+18,oF=C.o0-6,oB=C.o0-16,sm=(s0+s1)/2;
    put(0.25,2.7,C.len*0+ (s1-s0),mWall,sm,oB,B+1.35);                                         // 奥の壁
    for(const ss of [s0,s1])put(10,2.7,0.25,mWall,ss,(oF+oB)/2,B+1.35);                        // 両側の壁
    put(10,2.7,0.25,mWall,s0+2.2,oF,B+1.35);put(10,2.7,0.25,mWall,s1-2.2,oF,B+1.35);           // 前の壁（真ん中が入口）
    sign(TEX_TOILET,sm,oF+0.16,B+2.25,3.0,0.75);
    for(let q=0;q<4;q++){const ss=s0+1.2+q*2.2;                                                // 個室
      put(0.12,2.0,2.0,mTile,ss,oB+2.2,B+1.0);put(2.0,2.0,0.12,mTile,ss+1.0,oB+1.25,B+1.0);
      put(0.9,0.5,0.6,mTile,ss+0.55,oB+1.0,B+0.25);}
    for(let q=0;q<3;q++)put(0.7,0.2,0.5,mTile,s1-1.4-q*1.3,oF-1.2,B+0.85);                     // 洗面台
    sign(TEX_MIRROR,s1-2.0,oF-1.5,B+1.5,2.6,0.9,Math.PI);}
  if(st.cls==='M'||st.cls==='X'){                                                              // こどもトイレ（壁の低い個室）
    const s0=C.sc+19.5;
    for(let q=0;q<2;q++){const ss=s0+q*1.6;put(0.1,1.15,1.5,cmat(c,lam(0xf3d9a0)),ss,C.o0-11,B+0.58);}
    put(3.2,1.15,0.1,cmat(c,lam(0xf3d9a0)),s0+0.8,C.o0-11.8,B+0.58);
    for(let q=0;q<2;q++)put(0.6,0.35,0.42,mTile,s0+0.8+q*1.6,C.o0-11.4,B+0.18);
    put(0.5,0.15,0.36,mTile,s0+0.8,C.o0-9.9,B+0.55);
    sign(TEX_KIDS,s0+0.8,C.o0-10.1,B+1.55,2.2,0.55);}
  if(st.big)for(let i2=0;i2<3;i2++){const ss=C.sc-16+i2*8;                                     // 売店
    put(6.0,2.6,0.3,mWall,ss,C.o1+0.5,B+1.3);
    put(5.4,1.0,1.2,cmat(c,lam(0xd8c9a8)),ss,C.o1+1.6,B+0.5);
    for(let q=0;q<3;q++)put(5.0,0.12,0.5,mSt,ss,C.o1+0.9,B+1.35+q*0.45);
    sign(TEX_SHOP,ss,C.o1+0.68,B+2.3,2.4,0.6,Math.PI);}
  sign(TEX_EXIT,C.sc-C.len/2+1.2,C.o0-13,B+2.6,2.6,0.65);
  for(const ds of [-14,0,14])for(const oo of [C.o0-4,C.o0-16]){const lp=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({color:0xfdfcf4})));
    lp.scale.set(2.6,2.6,1);lp.position.copy(offsG(C.sc+ds,oo,B+H-0.07));lp.rotation.set(Math.PI/2,0,-P(C.sc+ds)[2]);addTo(c,lp);}
  /* ホームの階段の上から改札口（コンコース）へ渡る連絡通路 */
  {const bo=(C.o0+C.o0+8)/2;
    put(9.0,0.3,3.6,mFloor,C.sc+0.6,bo,B-0.15);
    for(const sg of [-1,1])put(9.0,1.05,0.12,mWall,C.sc+0.6+sg*1.8,bo,B+0.5);}
}
function addLEDs(c,st,o,dir,keys,kind){if(BRANCH&&(st.i===0||st.i===NST-1))keys=[...new Set(keys.map(k=>platKey(st,k)))];const T=TK[keys[0]],NC=Math.max(...keys.map(carsFor)),len=NC*CARL,fr=st.s+T.so,a=T.dir<0?fr:fr-len,n=NC>=12?4:NC>=8?3:2,sb=st.s-75;
  for(let i=0;i<n;i++){let s2=a+(i+0.5)*len/n;if(Math.abs(s2-sb)<8)s2=sb+(s2>=sb?8:-8); /* 階段とぶつからないように少しずらす */
    s2=clamp(s2,st.s-PBof(st)+4,st.s+PF-4);addLED(c,st,s2,o,dir,keys,kind);}}
function addLED(c,st,s,o,dir,keys,kind){const t=P(s)[2],g=new THREE.Group();g.position.copy(offs(s,ov(o,s),3.55));g.rotation.y=-t+(dir<0?Math.PI:0);addTo(c,g);
  const cs=new THREE.Mesh(boxGeo(2.05,0.62,0.16),lam(0x1b1d20));g.add(cs);
  const mat=cmat(c,new THREE.MeshBasicMaterial({map:ledIdle}));for(const r of [0,Math.PI]){const p=new THREE.Mesh(UNIT_PLANE,mat);p.scale.set(1.94,0.535,1);p.rotation.y=r;p.position.z=r?-0.085:0.085;g.add(p);}
  /* 下段：流れる案内（テロップ） */
  const tmat=cmat(c,new THREE.MeshBasicMaterial({color:0x0b1526}));const TH=0.535*48/288;
  for(const r of [0,Math.PI]){const p=new THREE.Mesh(UNIT_PLANE,tmat);p.scale.set(1.94,TH,1);p.rotation.y=r;p.position.set(0,-0.535/2+TH/2,r?-0.0875:0.0875);g.add(p);}
  for(const x of [-0.72,0.72]){const w=new THREE.Mesh(boxGeo(0.035,1.05,0.035),IMATS.pole);w.position.set(x,0.82,0);g.add(w);}
  LEDS.push({st,dir,keys,kind,mat,tmat,live:null,c});}
// logical city-line platforms
for(const st of STATIONS){st.extra=[];if(!st.lines)continue;
  for(const cp of CITYPAIRS.filter(p=>p.ci===st.i))st.extra.push(cp.side<0?{lo:s=>cp.t2(s)+1.72,hi:s=>cp.t1(s)-1.72,line:cp.line}:{lo:s=>cp.t1(s)+1.72,hi:s=>cp.t2(s)-1.72,line:cp.line});
  for(const ex of st.extra)ex.mid=d=>s=>(ex.lo(s)+ex.hi(s))/2+d;}
const KINDNAME={A:'普通',B:'普通',C:'快速',D:'快速',E:'快特',F:'快特',G:'特急',H:'特急'};
function buildStation(st,c){
  st.roofs=[];CUR_ROOFS_TARGET=st.roofs;
  const i=st.i,s0=st.s-PBof(st),s1=st.s+PF,prevN=STATIONS[(i+NST-1)%NST].name,nextN=STATIONS[(i+1)%NST].name,sb=st.s-75;
  const pv=BRANCH&&i===0?'':prevN,nx=BRANCH&&i===NST-1?'':nextN;
  const ys=Yat(st.s),elev=ys>5,under=ys<-5,roof=!under;st.elev=elev;st.under=under;const stairH=elev?3.0:under?5.6:6.3;
  const island=(eA,eB,keyL,keyR)=>{const mid=islandPlat(c,s0,s1,eA,eB,roof);
    boards(c,st,s0+5,s1,mid(-0.06),-1,TK[keyL].dir>0?pv:nx,TK[keyL].dir>0?nx:pv);boards(c,st,s0+5,s1,mid(0.06),1,TK[keyR].dir>0?pv:nx,TK[keyR].dir>0?nx:pv);
    inst(c,'stair',sb,mid(0),PH+stairH/2,2.6,stairH,9);
    plane(c,clockMat,0.8,0.8,st.s-45,mid(-0.1),3.9,faceSide(st.s-45,-1));
    addLEDs(c,st,mid(-1.0),TK[keyL].dir,[keyL],KIND[keyL]);addLEDs(c,st,mid(1.0),TK[keyR].dir,[keyR],KIND[keyR]);return mid;};
  if(!BRANCH&&i===0){ /* 汐見駅：6面12線（各線路の右側=AI列車、左側=プレイヤー退避線） */
    const pl=(k,sd)=>island(s=>TK[k].off(s)+(sd<0?-8.6:0)+1.72,s=>TK[k].off(s)+(sd<0?0:8.6)-1.72,k,k);
    for(const k of KEYS)pl(k,-TK[k].dir);
    island(s=>TK.J.off(s)+1.72,s=>TK.I.off(s)-1.72,'J','I');} /* 13・14番線（7面14線） */
  else if(BRANCH&&st.cls==='Q'){ /* 2面4線：副本線｜島｜本線｜本線｜島｜副本線 */
    island(s=>-sidDev(s)+1.72,-1.72,'A','C');island(s=>sepB(s)+1.72,s=>sepB(s)+sidDev(s)-1.72,'D','B');}
  else if(BRANCH&&st.cls==='T'){ /* 通過線：外側の副本線に相対式ホーム、真ん中を快速が通過 */
    const eA=platform(c,s0,s1,s=>-sidDev(s)-1.72,-1,5.5,{roof});const eB=platform(c,s0,s1,s=>sepB(s)+sidDev(s)+1.72,1,5.5,{roof});
    boards(c,st,s0,s1,eA(5.3),1,pv,nx);boards(c,st,s0,s1,eB(5.3),-1,nx,pv);
    inst(c,'stair',sb,eA(3.4),PH+stairH/2,2.6,stairH,9);inst(c,'stair',sb,eB(3.4),PH+stairH/2,2.6,stairH,9);
    plane(c,clockMat,0.8,0.8,st.s-40,eA(1.8),3.7,faceSide(st.s-40,1));plane(c,clockMat,0.8,0.8,st.s-90,eB(1.8),3.7,faceSide(st.s-90,-1));
    addLEDs(c,st,s=>-sidDev(s)-4.2,1,['A'],'local');addLEDs(c,st,s=>sepB(s)+sidDev(s)+4.2,-1,['B'],'local');}
  else if(MINI&&st.cls==='L'){ /* 単線の駅：片側に短いホームが1つ（屋根は一部だけ） */
    const eA=platform(c,s0,s1,-1.72,-1,4.6,{roof:false});boards(c,st,s0,s1,eA(4.4),1,pv,nx);
    plane(c,clockMat,0.8,0.8,st.s-30,eA(1.8),3.4,faceSide(st.s-30,1));addLEDs(c,st,-3.6,1,['A','B'],'local');}
  else if(st.cls==='L'||(BRANCH&&st.cls!=='J'&&st.cls!=='I')){
    const eA=platform(c,s0,s1,-1.72,-1,5.5,{roof});const eB=platform(c,s0,s1,s=>sepB(s)+1.72,1,5.5,{roof});
    boards(c,st,s0,s1,eA(5.3),1,pv,nx);boards(c,st,s0,s1,eB(5.3),-1,nx,pv);
    inst(c,'stair',sb,eA(3.4),PH+stairH/2,2.6,stairH,9);inst(c,'stair',sb,eB(3.4),PH+stairH/2,2.6,stairH,9);
    plane(c,clockMat,0.8,0.8,st.s-40,eA(1.8),3.7,faceSide(st.s-40,1));plane(c,clockMat,0.8,0.8,st.s-90,eB(1.8),3.7,faceSide(st.s-90,-1));
    addLEDs(c,st,-4.2,1,['A'],'local');addLEDs(c,st,s=>sepB(s)+4.2,-1,['B'],'local');
  }else if(BRANCH){island(1.72,s=>sepB(s)-1.72,'A','B');}
  else if(st.cls==='M'){ // main station: locals on side platforms, rapid and limited express across the same islands
    const eA=platform(c,s0,s1,-1.72,-1,5.5,{roof});const eB=platform(c,s0,s1,s=>sepB(s)+1.72,1,5.5,{roof});
    boards(c,st,s0,s1,eA(5.3),1,pv,nx);boards(c,st,s0,s1,eB(5.3),-1,nx,pv);
    inst(c,'stair',sb,eA(3.4),PH+stairH/2,2.6,stairH,9);inst(c,'stair',sb,eB(3.4),PH+stairH/2,2.6,stairH,9);
    addLEDs(c,st,-4.2,1,['A'],'local');addLEDs(c,st,s=>sepB(s)+4.2,-1,['B'],'local');
    island(s=>offC(s)+1.72,s=>offE(s)-1.72,'C','E');island(s=>offF(s)+1.72,s=>offD(s)-1.72,'F','D');}
  else{island(1.72,s=>offC(s)-1.72,'A','C');island(s=>offD(s)+1.72,s=>sepB(s)-1.72,'D','B');
    if(st.cls!=='R'){island(s=>offE(s)+1.72,s=>offF(s)-1.72,'E','F');}}
  for(const ex of st.extra){const mid=islandPlat(c,s0,s1,ex.lo,ex.hi,true);
    boards(c,st,s0+5,s1,mid(-0.06),-1,'','',ex.line[0]);boards(c,st,s0+5,s1,mid(0.06),1,'','',ex.line[0]);inst(c,'stair',sb,mid(0),PH+3.15,2.6,6.3,9);}
  /* v1.9.8：全ホームに乗車位置案内（号車・グリーン車）を設置 */
  for(const k of KEYS)if(serves(st,k)&&!physDup(st,k)){boardingMarks(c,st,k,false);if(!BRANCH&&i===0)boardingMarks(c,st,k,true);}
  if(HOMEDOOR.has(i))for(const k of KEYS)if(serves(st,k)&&!physDup(st,k)){buildHomeDoors(c,st,k,false);if(!BRANCH&&i===0)buildHomeDoors(c,st,k,true);}
  if(!BRANCH&&i===0)for(const k of ['I','J']){boardingMarks(c,st,k,false);if(HOMEDOOR.has(i))buildHomeDoors(c,st,k,false);}
  for(const k of KEYS)if(serves(st,k)&&!physDup(st,k)){const F=edgeFence(st,k,false);for(const [za,zb] of F.zones)fenceRun(c,za,zb,F.line);if(!BRANCH&&i===0){const Fs=edgeFence(st,k,true);for(const [za,zb] of Fs.zones)fenceRun(c,za,zb,Fs.line);}} /* ドアの来ない線路側 */
  if(BRANCH&&(i===0||i===NST-1)){const sb2=i===0?TRK0+3:TRK1-3;const os=[0,sepB(sb2)];for(const o of os){inst(c,'bumper',sb2,o,0.75,2.4,0.9,0.7);inst(c,'bumper',sb2+(i===0?-0.6:0.6),o,0.45,2.6,0.25,0.5);}
    if(LINE_ID==='branch2'&&i===NST-1){const ew=new THREE.Mesh(boxGeo(12,7.5,1.2),cmat(c,MATS.tunnel));ew.position.copy(offsG(TRK1+4,sepB(TRK1+4)*0.5,Yat(TRK1+4)+3.75));ew.rotation.y=-P(TRK1+4)[2];addTo(c,ew);}} /* 車止め・深雪終点壁 */
  if(!BRANCH)for(const k of ['E','F','A','B'])if(serves(st,k)){const T=TK[k],sd=T.side(st),sm=st.s+T.so-T.dir*(carsFor(k)*CARL-6),om=T.off(st.s)+sd*(1.72+1.3); /* 車掌用：最後尾の横（発車メロディ箱＋ホームITVモニタ） */
    if(k==='E'||k==='F'){inst(c,'fpost',sm,om,PH+0.6,0.07,1.2,0.07);inst(c,'melo',sm,om,PH+1.28,0.2,0.26,0.12);}
    inst(c,'fpost',sm-T.dir*1.4,om,PH+1.8,0.06,3.6,0.06);
    const itvBox=new THREE.Mesh(boxGeo(0.28,0.44,0.68),cmat(c,lam(0x182232)));itvBox.position.copy(offsG(sm-T.dir*1.4,om,PH+3.1));itvBox.rotation.y=-P(sm-T.dir*1.4)[2];addTo(c,itvBox);
    const itvScr=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({color:0x38bdf8,side:DS})));itvScr.scale.set(0.58,0.34,1);itvScr.position.copy(offsG(sm-T.dir*1.4,om-sd*0.145,PH+3.1));itvScr.rotation.y=-P(sm-T.dir*1.4)[2]+(sd>0?Math.PI/2:-Math.PI/2);addTo(c,itvScr);}
  if(BRANCH)for(const k of KEYS)if(serves(st,k)&&!physDup(st,k)){const T=TK[k],sd=T.side(st),sm=st.s+T.so-T.dir*2,om=T.off(st.s)+sd*(1.72+1.3); /* 発車メロディのボタン箱（運転台のすぐ横） */
    inst(c,'fpost',sm,om,PH+0.6,0.07,1.2,0.07);inst(c,'melo',sm,om,PH+1.28,0.2,0.26,0.12);}
  const [lo,hi]=ourSpan(sb);
  if(elev){stationBuilding(c,sb,lo+1,hi-1,0,Math.max(4,ys-1.6),false,true);addRoofBox(st.roofs,sb-8,sb+8,lo+1,hi-1,0,Math.max(4,ys-1.6)+0.3);}
  else if(under){ /* 地下駅：ホームの柱・天井照明・壁面の駅名サイン（トンネルの中の駅） */
    const cols=[];for(const k of KEYS)if(serves(st,k)&&!physDup(st,k)){const r=platRange(st,k);cols.push((r[0]+r[1])/2);}
    if(!cols.length)cols.push((lo+hi)/2);
    for(const o of cols){for(let s2=s0+6;s2<s1-2;s2+=13)inst(c,'pillar',s2,o,PH+(6.8-PH)/2,0.5,6.8-PH,0.5);
      for(let s2=s0+9;s2<s1-3;s2+=16)inst(c,'tlamp',s2,o,6.6);}
    const sgn=cmat(c,new THREE.MeshBasicMaterial({map:signTex(st,pv,nx,st.kana),side:THREE.FrontSide}));
    const tt1=cmat(c,new THREE.MeshBasicMaterial({map:timetableTex(st,1),side:THREE.FrontSide}));
    const tt2=cmat(c,new THREE.MeshBasicMaterial({map:timetableTex(st,-1),side:THREE.FrontSide}));
    plane(c,sgn,2.4,0.8,st.s-26,lo-0.8,4.4,faceSide(st.s-26,1));
    plane(c,tt1,0.96,1.2,st.s-23.9,lo-0.8,4.3,faceSide(st.s-23.9,1));
    plane(c,sgn,2.4,0.8,st.s-26,hi+0.8,4.4,faceSide(st.s-26,-1));
    plane(c,tt2,0.96,1.2,st.s-23.9,hi+0.8,4.3,faceSide(st.s-23.9,-1));}
  else if(BRANCH&&st.cls!=='J'&&st.cls!=='I'&&st.cls!=='Q'){const t=P(st.s-45)[2],hs=new THREE.Mesh(boxGeo(1,1,1),cmat(c,lam(0xe8e0cf)));hs.scale.set(9,4.2,7);const hx=-12.5-sidDev(st.s-45);hs.position.copy(offsG(st.s-45,hx,2.1));hs.rotation.y=-t;addTo(c,hs);
    const rf=new THREE.Mesh(roofGeo,cmat(c,lam(0x6b3a2a)));rf.scale.set(10,2.4,8);rf.position.copy(offsG(st.s-45,hx,4.2));rf.rotation.y=-t+Math.PI/2;addTo(c,rf);
    addRoofBox(st.roofs,st.s-49,st.s-41,hx-5,hx+5,0,6.7);}
  else{stationBuilding(c,sb,lo-2,hi+2,7.4,st.big?16:12,st.big,false);const bd=st.big?12:8;addRoofBox(st.roofs,sb-bd-0.8,sb+bd+0.8,lo-2.8,hi+2.8,7.4,(st.big?16:12)+0.5);}
  /* 改札口・コンコース（階段の上） */
  st.concY=Yat(st.s)+PH+stairH;
  {const C=concourseGeom(st);addRoofBox(st.roofs,C.sc-C.len/2,C.sc+C.len/2,C.o1,C.o0,st.concY-0.3,st.concY+3.65);}
  CUR_ROOFS_TARGET=null;
  try{buildConcourse(c,st);}catch(e){console.warn(e);}
  if(!BRANCH&&CFG.shin===i)buildShinkansen(st,c);
}
/* ================= shinkansen (elevated, crossing above one main station) ================= */
const SHIN=[];
function shinFrame(st){const sm=st.s-62,t=P(sm)[2],cen=offsG(sm,sepB(sm)/2,0);return {cen,dir:new THREE.Vector3(Math.cos(t),0,Math.sin(t)),yaw:-t+Math.PI/2};}
function buildShinkansen(st,c){const F=shinFrame(st),H=16,len=5200;const g=new THREE.Group();g.position.copy(F.cen);g.rotation.y=F.yaw;addTo(c,g);
  const mc=cmat(c,lam(0xc9ccc9)),md=cmat(c,lam(0x8d908e));
  const deck=new THREE.Mesh(boxGeo(12,1.6,len),mc);deck.position.y=H-0.8;g.add(deck);
  for(const x of [-6,6]){const w=new THREE.Mesh(boxGeo(0.3,1.4,len),mc);w.position.set(x,H+0.7,0);g.add(w);}
  for(let z=-len/2+20;z<len/2;z+=45){if(Math.abs(z)<75)continue;const p=new THREE.Mesh(boxGeo(4,H-1.6,3),md);p.position.set(0,(H-1.6)/2,z);g.add(p);}
  for(const x of [-2.6,2.6])for(const r of [-0.72,0.72]){const rl=new THREE.Mesh(boxGeo(0.08,0.12,len),MATS.rail);rl.position.set(x+r,H+0.36,0);g.add(rl);}
  const gird=new THREE.Mesh(boxGeo(12.4,3.2,150),md);gird.position.y=H-2.4;g.add(gird);
  for(const x of [-9.5,9.5]){const pl=new THREE.Mesh(boxGeo(6,1.1,420),mc);pl.position.set(x,H+0.55,0);g.add(pl);
    const rf=new THREE.Mesh(boxGeo(7,0.3,380),cmat(c,lam(0x6b7078)));rf.position.set(x,H+5.6,0);g.add(rf);
    const sign=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({map:canvasTex(512,128,(x2,w,h)=>{x2.fillStyle='#f6f4ee';x2.fillRect(0,0,w,h);x2.fillStyle='#1d3f7a';x2.fillRect(0,96,w,32);x2.fillStyle='#111';x2.textAlign='center';x2.textBaseline='middle';x2.font='700 54px '+FONT;x2.fillText(st.name,w/2,50);x2.fillStyle='#fff';x2.font='500 20px '+FONT;x2.fillText('新幹線',w/2,112);}),side:DS})));
    sign.scale.set(3.2,0.8,1);sign.position.set(x,H+3.2,-40);sign.rotation.y=Math.PI/2;g.add(sign);}
  const hall=new THREE.Mesh(boxGeo(46,6.2,56),cmat(c,lam(0xd8d6cf)));hall.position.set(0,9.4,0);g.add(hall); // 在来線の上をまたぐ橋上駅舎
  if(!SHIN.some(x=>x.st===st))SHIN.push({st,F,H,len});}

/* ================= level crossings ================= */
const bellMat=[new THREE.MeshBasicMaterial({color:0x3a0c0c}),new THREE.MeshBasicMaterial({color:0xff2a1a})];
const crossTex=canvasTex(128,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.save();x.translate(64,64);for(const r of [Math.PI/4,-Math.PI/4]){x.save();x.rotate(r);x.fillStyle='#f2c12e';x.fillRect(-60,-11,120,22);
  for(let i=-60;i<60;i+=20){x.fillStyle='#111';x.fillRect(i,-11,10,22);}x.restore();}x.restore();});SHARED.add(crossTex);
const carMats=[0xd9d9d9,0x2a4f8a,0x9a2222,0x2b2b2b,0xe0c060].map(c=>new THREE.MeshPhongMaterial({color:c,shininess:60}));
function buildCrossing(cr){const s=cr.s,c=chunkOf(s),[lo,hi]=ourSpan(s),t=P(s)[2];
  strip(c,s-3.5,s+3.5,7,[[lo-70,0.03],[lo-3.2,0.03]],'road',true);strip(c,s-3.5,s+3.5,7,[[hi+3.2,0.03],[hi+70,0.03]],'road',true);
  strip(c,s-3.5,s+3.5,7,[[lo-3.2,0.03,1],[lo-1.2,0.52],[hi+1.2,0.52],[hi+3.2,0.03,1]],'road');
  cr.arms=[];cr.lamps=[];cr.cars=[];
  for(const [o,sg] of [[lo-3.6,-1],[hi+3.6,1]]){
    const piv=new THREE.Group();piv.position.copy(offsG(s-sg*3.9,o,1.0));piv.rotation.order='YXZ';piv.rotation.y=-t+(sg<0?Math.PI:0);piv.rotation.x=Math.PI/2;addTo(c,piv);
    const arm=new THREE.Mesh(boxGeo(0.1,0.1,7.2),cmat(c,new THREE.MeshLambertMaterial({map:armTex})));arm.position.z=-3.6;piv.add(arm);cr.arms.push(piv);
    const base=new THREE.Mesh(boxGeo(0.35,1.2,0.35),lam(0x2a2a2a));base.position.copy(offsG(s-sg*3.9,o,0.6));base.rotation.y=-t;addTo(c,base);
    const post=new THREE.Mesh(boxGeo(0.14,3.6,0.14),lam(0xf2f2f2));post.position.copy(offsG(s+sg*4.2,o,1.8));addTo(c,post);
    const face=faceSide(s,sg);const xb=new THREE.Mesh(UNIT_PLANE,cmat(c,new THREE.MeshBasicMaterial({map:crossTex,transparent:true,side:DS})));xb.scale.set(1.3,1.3,1);xb.position.copy(offsG(s+sg*4.2,o+sg*0.1,3.2));xb.rotation.y=face;addTo(c,xb);
    for(const dx of [-0.32,0.32]){const lp=new THREE.Mesh(new THREE.CircleGeometry(0.16,16),bellMat[0]);lp.position.copy(offsG(s+sg*4.2+dx,o+sg*0.12,2.3));lp.rotation.y=face;addTo(c,lp);cr.lamps.push(lp);}
    const car=new THREE.Group();const b1=new THREE.Mesh(boxGeo(1.75,0.75,4.3),pick(carMats));b1.position.y=0.65;car.add(b1);const b2=new THREE.Mesh(boxGeo(1.6,0.6,2.2),new THREE.MeshPhongMaterial({color:0x1b2430,shininess:90}));b2.position.set(0,1.3,0.2);car.add(b2);
    car.position.copy(offsG(s+sg*1.8,o+sg*4.5,0));car.rotation.y=-t+Math.PI/2*(sg>0?1:-1);car.visible=false;addTo(c,car);cr.cars.push(car);}
}
/* ================= buildings ================= */
function nearBig(s){let best=1e9;for(const i of BIG){best=Math.min(best,Math.abs(sdiff(STATIONS[i].s-62,s)));}return best;}
function clearAt(s,o,r){if(isSea(s,o-r))return false;for(const z of RIVERS)if(Math.abs(sdiff(z.m,s))<62+r)return false;for(const cr of CROSS)if(Math.abs(sdiff(cr.s,s))<r+6)return false;
  for(const sh of SHIN){const p=offsG(s,o,0);const d=new THREE.Vector3().subVectors(p,sh.F.cen);const along=d.dot(sh.F.dir);if(Math.abs(along)<sh.len/2){const perp=d.clone().addScaledVector(sh.F.dir,-along).length();if(perp<r+14)return false;}}
  for(const ss of [s-r,s,s+r]){for(const v of occAt(ss)){if(o+r+4>v[0]&&o-r-4<v[1])return false;}}return true;}
const bcols=['#8a8f9a','#a39a8d','#6f7683','#b3a89a','#7d6f66','#94a0a8','#c4c0b6'].map(c=>new THREE.Color(c));

/* ================= 特急の地下線（トンネル・地下駅） ================= */
const LTD_MATS={};
function ltdStrip(c,a,b,step,prof,mat){const D=LTD_DEPTH;strip(c,a,b,step,prof.map(p=>[p[0],D+p[1]]),mat,true);}
function ltdBox(c,w,h,d,mat,s,o,y,ry){const m=new THREE.Mesh(boxGeo(w,h,d),mat);m.position.copy(offsG(s,o,y+DEPT_OFF));m.rotation.y=ry!=null?ry:-P(s)[2];addTo(c,m);return m;}
const DEPT_OFF=0;
/* 地下トンネル（全線）＋地下駅の箱。特急G/Hだけがここを通る */
function buildLtdChunk(c,c0,c1){
  if(BRANCH)return;
  const D=LTD_DEPTH;
  /* 道床・レール（G=-7.4m / H=+7.4m） */
  for(const off of [-LTD_OFF,LTD_OFF]){
    const O=d=>s2=>off+d;
    ltdStrip(c,c0,c1,4,[[O(-2.5),0.02],[O(-1.5),0.3],[O(1.5),0.3],[O(2.5),0.02]],'ballast');
    for(const r of [-0.533,0.533])ltdStrip(c,c0,c1,4,[[O(r-0.035),0.37],[O(r-0.035),0.5],[O(r+0.035),0.5],[O(r+0.035),0.37]],'rail');
  }
  /* トンネル：床・側壁・天井 */
  ltdStrip(c,c0,c1,8,[[-LTD_HALF,0],[LTD_HALF,0]],'concD');
  ltdStrip(c,c0,c1,8,[[-LTD_HALF,0],[-LTD_HALF,7.2]],'tunnel');
  ltdStrip(c,c0,c1,8,[[LTD_HALF,0],[LTD_HALF,7.2]],'tunnel');
  ltdStrip(c,c0,c1,8,[[-LTD_HALF,7.2],[LTD_HALF,7.2]],'tunnel');
  /* 壁のケーブルラック・照明 */
  for(let s2=Math.ceil(c0/12)*12;s2<c1;s2+=12){
    for(const sx of [-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.28),new THREE.MeshBasicMaterial({color:0xffe6b0}));
      m.position.copy(offsG(s2,sx*(LTD_HALF-0.12),D+6.4));m.rotation.y=-P(s2)[2]+sx*Math.PI/2;addTo(c,m);}
    const l=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.5),new THREE.MeshBasicMaterial({color:0xbfe3ff}));
    l.position.copy(offsG(s2,0,D+7.1));l.rotation.set(Math.PI/2,0,-P(s2)[2]);addTo(c,l);
  }
  /* 地下駅（汐見と主要駅） */
  for(const st of STATIONS)if(chunkOf(st.s)===c&&(st.i===0||st.cls==='M'))buildLtdStation(st,c);
}
function buildLtdStation(st,c){
  const D=LTD_DEPTH,y=D+PH,s0=st.s-PBof(st)-16,s1=st.s+PF+16,t=P(st.s)[2];
  const conc=MATS.conc,concD=MATS.concD,tile=lam(0xe8eef2),wallM=lam(0xd7dde4);
  const pv=STATIONS[(st.i+NST-1)%NST].name,nx=STATIONS[(st.i+1)%NST].name;
  /* 駅の内装：明るいタイルの壁とブルーのライン帯（トンネル内でも駅と分かるように） */
  for(const sg of [-1,1]){
    ltdStrip(c,s0,s1,6,[[sg*(LTD_HALF-0.06),PH+D],[sg*(LTD_HALF-0.06),D+4.9]],'conc');
    ltdStrip(c,s0,s1,6,[[sg*(LTD_HALF-0.10),D+3.15],[sg*(LTD_HALF-0.10),D+3.65]],'tactile');
  }
  /* ホーム（線路の外側に相対式2面：側面壁＋上面＋黄色点字ブロック帯付きの立体構造） */
  for(const [o0,o1] of [[-LTD_OFF-6.4,-LTD_OFF-1.72],[LTD_OFF+1.72,LTD_OFF+6.4]]){
    const edgeIn=o1<0?o1:o0; /* 線路側の縁 */
    const edgeOut=o1<0?o0:o1; /* 壁側の縁 */
    ltdStrip(c,s0,s1,6,[[edgeOut,D],[edgeOut,y],[edgeIn,y],[edgeIn,D]],'plat');
    ltdStrip(c,s0,s1,6,[[edgeIn+(edgeIn<0?-0.45:0.15),y+0.02],[edgeIn+(edgeIn<0?-0.15:0.45),y+0.02]],'tactile'); /* 黄色い点字ブロック */
    const om=(o0+o1)/2;
    for(let s2=s0+14;s2<s1-14;s2+=26){const b=new THREE.Mesh(boxGeo(0.9,0.45,3.2),tile);b.position.copy(offsG(s2,om+(o1>0?1.3:-1.3),y+0.22));b.rotation.y=-t;addTo(c,b);} /* ベンチ */
    /* 壁面の駅名サイン（等間隔に配置してホームのどこからでも見えるように） */
    const sgnMat=new THREE.MeshBasicMaterial({map:signTex(st,pv,nx,st.kana),side:DS});
    const ttMat=new THREE.MeshBasicMaterial({map:timetableTex(st,o1>0?1:-1,'特急'),side:DS});
    for(let s2=s0+30;s2<s1-20;s2+=65){
      const sgn=new THREE.Mesh(new THREE.PlaneGeometry(4.2,1.4),sgnMat);
      sgn.position.copy(offsG(s2,o1>0?LTD_HALF-0.16:-LTD_HALF+0.16,D+4.0));sgn.rotation.y=-t+(o1>0?-Math.PI/2:Math.PI/2);addTo(c,sgn);
      const tt=new THREE.Mesh(new THREE.PlaneGeometry(1.15,1.45),ttMat);
      tt.position.copy(offsG(s2+3.0,o1>0?LTD_HALF-0.16:-LTD_HALF+0.16,D+3.95));tt.rotation.y=-t+(o1>0?-Math.PI/2:Math.PI/2);addTo(c,tt);
    }
    /* コンコース連絡階段（トンネル天井 D+7.2 の内側に収めて絶対に地上へ突き抜けないように） */
    const stS=st.s-45,oo=o1>0?LTD_OFF+4.8:-LTD_OFF-4.8;
    for(let q=0;q<5;q++){const yy=D+PH+q*0.65,h=new THREE.Mesh(boxGeo(2.4,0.28,3.2),concD);h.position.copy(offsG(stS-q*2.6,oo,yy+0.35));h.rotation.y=-t;addTo(c,h);}
    const land=new THREE.Mesh(boxGeo(2.6,0.3,4.0),concD);land.position.copy(offsG(stS-14.5,oo,D+PH+3.4));land.rotation.y=-t;addTo(c,land);
    const gateWall=new THREE.Mesh(boxGeo(2.8,2.4,0.4),wallM);gateWall.position.copy(offsG(stS-16.5,oo,D+PH+4.6));gateWall.rotation.y=-t;addTo(c,gateWall);
    const ex=new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.75),new THREE.MeshBasicMaterial({map:canvasTex(256,80,(x,w,h2)=>{x.fillStyle='#0b3d2c';x.fillRect(0,0,w,h2);x.fillStyle='#c8f5d8';x.font='700 34px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('出口・乗換 ↑',w/2,h2/2);}),side:DS}));
    ex.position.copy(offsG(stS-16.2,oo,D+PH+4.7));ex.rotation.y=-t;addTo(c,ex);
  }
  /* 進入してくる列車に見える駅名サイン（ホーム手前の上部に吊るす） */
  for(const k of ['G','H']){
    const T=TK[k],off=T.off(st.s),sSign=T.dir>0?s0+10:s1-10;
    const sg=new THREE.Mesh(new THREE.PlaneGeometry(4.8,1.3),new THREE.MeshBasicMaterial({map:signTex(st,pv,nx,st.kana),side:DS}));
    sg.position.copy(offsG(sSign,off,D+4.9));sg.rotation.y=-t+(T.dir>0?Math.PI:0);addTo(c,sg);
  }
  /* 上下線間のセンター柱・壁際の柱と天井照明（ホーム中央は塞がない） */
  for(let s2=s0+10;s2<s1-4;s2+=16){
    const p=new THREE.Mesh(boxGeo(0.55,6.8,0.55),conc);p.position.copy(offsG(s2,0,D+3.4));p.rotation.y=-t;addTo(c,p);
    for(const o of [-14.8,14.8]){const pw=new THREE.Mesh(boxGeo(0.4,6.8,0.4),conc);pw.position.copy(offsG(s2,o,D+3.4));pw.rotation.y=-t;addTo(c,pw);}
    for(const lx of [-11.2,0,11.2]){const l=new THREE.Mesh(new THREE.PlaneGeometry(2.2,0.55),new THREE.MeshBasicMaterial({color:0xe8f6ff}));l.position.copy(offsG(s2,lx,D+7.1));l.rotation.set(Math.PI/2,0,-t);addTo(c,l);}
  }
}
/* ================= build one chunk ================= */
function buildChunk(c){const ch=CHUNKS[c];if(ch.built)return;ch.g=new THREE.Group();scene.add(ch.g);ch.b={};ch.inst={};ch.mats=[];ch.built=true;
  let cs=(c*7919+13)%2147483647;const rnd=()=>{cs=(cs*16807)%2147483647;return (cs-1)/2147483646;};
  const c0=c*CH,c1=c0+CH;
  // ground ribbon (gap over open cuts)
  let s=c0;while(s<c1){const tr=trenchAt(s+0.5);let e=s;while(e<c1&&trenchAt(e+0.5)===tr)e+=5;e=Math.min(e,c1);
    if(tr){strip(c,s,e,5,[[s2=>isCoastS(s2)?-20:-1000,-0.01],[s2=>spanLo(s2)-0.9,-0.01]],'ground',true); /* 海岸の区間は地面を砂浜の手前まで */strip(c,s,e,5,[[s2=>spanHi(s2)+0.9,-0.01],[1000,-0.01]],'ground',true);}
    else strip(c,s,e,Math.min(25,Math.max(1,e-s)),[[-1000,-0.01],[1000,-0.01]],'ground',true);s=e;}
  for(const T of TRACKS){let a=c0,b=c1;if(T.a!==null){const ta=mod(T.a,L),tb=T.b;if(tb-T.a<L){const lo=T.a,hi=T.b;
        const cands=[[lo,hi],[lo-L,hi-L],[lo+L,hi+L]];let ok=false;for(const [x,y] of cands){const aa=Math.max(c0,x),bb=Math.min(c1,y);if(bb-aa>=1){a=aa;b=bb;ok=true;break;}}if(!ok)continue;}}
    const O=d=>s2=>T.off(s2)+d;
    strip(c,a,b,4,[[O(-2.5),0.02],[O(-1.5),0.3],[O(1.5),0.3],[O(2.5),0.02]],'ballast');
    for(const r of [-0.533,0.533])strip(c,a,b,4,[[O(r-0.035),0.37],[O(r-0.035),0.5],[O(r+0.035),0.5],[O(r+0.035),0.37]],'rail');
    for(let s2=Math.ceil(a/0.7)*0.7;s2<b;s2+=0.7)inst(c,'sleeper',s2,T.off(s2),0.34);
    if(T.yard)continue;const pts=[];for(let s2=a;s2<=b;s2+=10)pts.push(offs(s2,T.off(s2),6.3));
    if(pts.length>1)addTo(c,new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),WIREMAT));}
  /* 特急（G/H）は廃止したため地下トンネル・地下駅は生成しない */
  for(let s2=c0+20;s2<c1;s2+=50){if(Yat(s2)<-6||!hasTrack(s2))continue;let [lo,hi]=ourSpan(s2);
    if(s2>DEPOT.a-20&&s2<DEPOT.b+180&&!shiomiBump(s2)){lo=-3.2;}
    inst(c,'post',s2,lo-0.6,3.6);inst(c,'post',s2,hi+0.6,3.6);inst(c,'beam',s2,(lo+hi)/2,7.0,hi-lo+1.5,1,1);}
  // viaduct / bridges
  const ranges=[];{let st=null;for(let s2=c0;s2<=c1;s2+=4){const up=Yat(s2)>0.6;if(up&&st===null)st=s2;if((!up||s2>=c1)&&st!==null){ranges.push([st,Math.min(s2,c1)]);st=null;}}}
  for(const [a,b] of ranges){const lo=s2=>spanLo(s2)-0.3,hi=s2=>spanHi(s2)+0.3;
    strip(c,a,b,4,[[lo,-0.02],[hi,-0.02]],'conc');strip(c,a,b,4,[[lo,-0.9],[hi,-0.9]],'concD');
    const rv=RIVERS.find(z=>Math.abs(sdiff(z.m,(a+b)/2))<400);
    strip(c,a,b,4,[[lo,-0.9],[lo,rv?0.3:1.1]],'conc');strip(c,a,b,4,[[hi,-0.9],[hi,rv?0.3:1.1]],'conc');
    for(let s2=Math.ceil(a/30)*30;s2<b;s2+=30){const y=Yat(s2);if(y<1.4)continue;const l=lo(s2),h=hi(s2);
      inst(c,'pier',s2,(l+h)/2,(y-1.6)/2,2.4,y-1.6,2.4);inst(c,'pcap',s2,(l+h)/2,-1.35,h-l-0.6,0.9,2.0);}
    if(rv){const ra=Math.max(a,rv.m-130),rb=Math.min(b,rv.m+130);if(rb-ra>2){trussStrip(c,ra,rb,lo,0.3,6.8);trussStrip(c,ra,rb,hi,0.3,6.8);
      for(let s2=ra;s2<rb;s2+=9){const l=lo(s2),h=hi(s2);inst(c,'beam',s2,(l+h)/2,6.8,h-l,1,1);}}}}
  // open cut & tunnel
  const tr=[];{let st=null;for(let s2=c0;s2<=c1;s2+=4){const dn=Yat(s2)<-0.25;if(dn&&st===null)st=s2;if((!dn||s2>=c1)&&st!==null){tr.push([st,Math.min(s2,c1)]);st=null;}}}
  for(const [a,b] of tr){const lo=s2=>spanLo(s2)-0.9,hi=s2=>spanHi(s2)+0.9;const wallTop=s2=>inTunnel(s2)?7.2:Math.max(0.9-Yat(s2),0.5);
    strip(c,a,b,4,[[lo,0.01],[hi,0.01]],'concD');strip(c,a,b,4,[[lo,0],[lo,wallTop]],'tunnel');strip(c,a,b,4,[[hi,0],[hi,wallTop]],'tunnel');
    let ts=null;for(let s2=a;s2<=b;s2+=4){const tin=inTunnel(s2)&&s2<b;if(tin&&ts===null)ts=s2;if((!tin||s2>=b)&&ts!==null){strip(c,ts,Math.min(s2,b),4,[[lo,7.2],[hi,7.2]],'tunnel');ts=null;}}
    for(let s2=Math.ceil(a/14)*14;s2<b;s2+=14)if(inTunnel(s2)){
      inst(c,'tlamp',s2,lo(s2)+0.18,5.1,1.0,1.0,2.2);inst(c,'tlamp',s2,hi(s2)-0.18,5.1,1.0,1.0,2.2);
      inst(c,'tlamp',s2,(lo(s2)+hi(s2))/2,7.05,0.45,0.6,2.8);
      inst(c,'pillar',s2,lo(s2)+0.25,3.5,0.35,7.0,0.45);inst(c,'pillar',s2,hi(s2)-0.25,3.5,0.35,7.0,0.45);
    }}
  for(const ps of PORTALS){if(chunkOf(ps)!==c)continue;const lo=spanLo(ps)-0.9,hi=spanHi(ps)+0.9;strip(c,ps-0.3,ps+0.3,0.6,[[lo-3,7.2],[hi+3,7.2]],'conc');
    const p=offs(ps,(lo+hi)/2,0),y0=Yat(ps)+7.2,hgt=1.2-y0;const m=new THREE.Mesh(boxGeo(1,1,1),MATS.conc);m.scale.set(hi-lo+6,Math.max(0.3,hgt),0.8);m.position.set(p.x,y0+hgt/2,p.z);m.rotation.y=-P(ps)[2];addTo(c,m);}
  for(const z of RIVERS){if(chunkOf(z.m)!==c)continue;const m=z.m;strip(c,m-48,m+48,96,[[-2600,0.06],[2600,0.06]],'water',true);
    strip(c,m-56,m-48,8,[[-2600,0.04],[2600,0.04]],'sand',true);strip(c,m+48,m+56,8,[[-2600,0.04],[2600,0.04]],'sand',true);}
  for(const st of STATIONS)if(chunkOf(st.s)===c)buildStation(st,c);
  for(const z of LIMITS)for(const [s2,v] of [[z.a,z.v],[z.b,0]]){if(chunkOf(s2)!==c)continue;
    const limO=spanLo(s2)+0.4;
    plane(c,cmat(c,new THREE.MeshLambertMaterial({map:limitTex(v),side:DS})),0.9,0.9,s2,limO,3.0,-P(s2)[2]);
    const p=new THREE.Mesh(boxGeo(0.1,2.6,0.1),IMATS.pole);p.position.copy(offs(s2,limO,1.3));addTo(c,p);}
  for(const sg of SIGNALS)if(sg.c===c)buildSignal(sg);
  for(const cr of CROSS)if(chunkOf(cr.s)===c)buildCrossing(cr);
  // depot
  if(DEPOT.n&&c1>DEPOT.a-20&&c0<DEPOT.b+330){const y0=-(DEPOT.base+(DEPOT.n-1)*DEPOT.gap+4),y1=-(DEPOT.base-4);
    const a=Math.max(c0,DEPOT.a-10),b=Math.min(c1,DEPOT.b+30);if(b>a)strip(c,a,b,10,[[y0,0.02,1],[y1,0.02,1]],'yardGround');
    for(const [sa,sb2,j0,j1] of [[DEPOT.a+40,DEPOT.a+260,0,7],[DEPOT.a+40,DEPOT.a+230,9,15],[DEPOT.a+300,DEPOT.a+470,18,25]]){const smd=(sa+sb2)/2;if(chunkOf(smd)!==c)continue;
      const w=(j1-j0)*DEPOT.gap+6,t=P(smd)[2];const shed=new THREE.Mesh(new THREE.BoxGeometry(w,10,sb2-sa),[lam(0xb8bcc0),lam(0xb8bcc0),lam(0x7c8187),lam(0x7c8187),lam(0x3a3d42),lam(0x3a3d42)]);
      shed.position.copy(offsG(smd,-(DEPOT.base+(j0+j1)/2*DEPOT.gap),5));shed.rotation.y=-t;addTo(c,shed);}
    const om=(DEPOT.a+DEPOT.b)/2;if(chunkOf(om)===c){const off=new THREE.Mesh(boxGeo(1,1,1),lam(0xd9d4c7));off.scale.set(16,10,40);off.position.copy(offsG(om,y0-16,5));off.rotation.y=-P(om)[2];addTo(c,off);}
    for(let s2=Math.ceil(Math.max(c0,DEPOT.a+60)/120)*120;s2<Math.min(c1,DEPOT.b);s2+=120){inst(c,'lightTower',s2,y0-2,10,0.5,20,0.5);inst(c,'lightTower',s2,(y0+y1)/2,10,0.5,20,0.5);}}
  // buildings & trees (deterministic per chunk)
  const city=nearBig(c0+CH/2),cityF=1-smooth(300,1100,city);
  if(BRANCH&&cityF<0.3){ruralChunk(c,c0,rnd);finalizeChunk(c);return;}
  planCity(c,c0,cityF); /* 線路に沿った道路と街区（計画的な街） */
  finalizeChunk(c);
}
/* ===== 計画的な街：線路に沿った側道と、それに平行な道路（約66m間隔）、直角の道路（約120m間隔）で街区を作り、
   街区には道路に面して建物を並べる（駅の近く・大きな駅のまわりほど高い建物、外側ほど住宅）。公園・駐車場・駅前広場もある ===== */
const CITY={BL:120,BAND:66,RW:9,NB:3,PH0:37};
function cityRng(seed){let r=(seed*2654435761)>>>0||1;return ()=>{r=(Math.imul(r,1664525)+1013904223)>>>0;return r/4294967296;};}
function railEdge(s,side){const w0=shiomiBump(s)*8.6;let e=side<0?(-3.2-w0):(sepB(s)+3.2+w0);for(const ss of [s-45,s,s+45]){for(const v of occAt(ss)){if(side<0&&v[0]>-230)e=Math.min(e,v[0]);if(side>0&&v[1]<230)e=Math.max(e,v[1]);}}return e;}
function nearRiver(s,m){for(const z of RIVERS)if(Math.abs(sdiff(z.m,s))<m)return true;return false;}
function nearCross(s,m){for(const cr of CROSS)if(Math.abs(sdiff(cr.s,s))<m)return true;return false;}
function planCity(c,c0,cityF){const B=CITY,c1=c0+CH,samp={};
  const base=(s,side)=>{const k=Math.round(s/10)+'|'+side;if(samp[k]===undefined)samp[k]=railEdge(Math.round(s/10)*10,side)+side*13;return samp[k];}; /* 一番内側の側道の中心 */
  const roadO=(s,side,j)=>base(s,side)+side*j*B.BAND;
  for(const side of [-1,1]){
    /* 平行な道路（川の近くでは途切れる） */
    for(let j=0;j<B.NB;j++){let a=null;const flush=(sA,sB)=>{if(sB-sA<12)return;const of=s=>roadO(s,side,j);
        strip(c,sA,sB,10,[[s=>of(s)-B.RW/2,0.03],[s=>of(s)+B.RW/2,0.03]],'road',true);
        for(const e of [-1,1])strip(c,sA,sB,10,[[s=>of(s)+e*(B.RW/2),0.13],[s=>of(s)+e*(B.RW/2+2.4),0.13]],'concD',true);   /* 歩道 */
        for(let s2=sA+2;s2<sB-4;s2+=9)strip(c,s2,s2+3,3,[[s=>of(s)-0.09,0.045],[s=>of(s)+0.09,0.045]],'white',true);   /* 中央線 */
        for(let s2=sA+8;s2<sB-2;s2+=32){const o=of(s2)+side*(B.RW/2+1.4);inst(c,'lightTower',s2,o,3.2,0.16,6.4,0.16);inst(c,'lightTower',s2,o-side*0.9,6.35,1.8,0.14,0.22);}}; /* 街灯 */
      for(let s2=c0;s2<=c1;s2+=10){const bad=nearRiver(s2,72)||!hasTrackish(s2);if(!bad&&a===null)a=s2;if((bad||s2>=c1)&&a!==null){flush(a,Math.min(s2,c1));a=null;}}}
    /* 直角の道路 */
    for(let k=Math.ceil((c0-B.PH0)/B.BL);k*B.BL+B.PH0<c1;k++){const sk=k*B.BL+B.PH0;if(nearRiver(sk,80)||nearCross(sk,30)||!hasTrackish(sk))continue;
      const oA=roadO(sk,side,0),oB=roadO(sk,side,B.NB-1);strip(c,sk-B.RW/2+1,sk+B.RW/2-1,B.RW-2,[[Math.min(oA,oB),0.035],[Math.max(oA,oB),0.035]],'road',true);
      for(let q=-3;q<=3;q++){const o=oA+side*(B.RW/2+1.6);strip(c,sk+q*1.1-0.35,sk+q*1.1+0.35,0.7,[[o-1.4,0.046],[o+1.4,0.046]],'white',true);}} /* 横断歩道 */
    /* 街区 */
    for(let k=Math.ceil((c0-B.PH0)/B.BL);k*B.BL+B.PH0<c1;k++){const sk=k*B.BL+B.PH0,sa=sk+B.RW/2+2.5,sb=sk+B.BL-B.RW/2-2.5,sm=(sa+sb)/2;
      if(sm<c0||sm>=c1||nearRiver(sm,85)||!hasTrackish(sm))continue;
      for(let j=0;j<B.NB;j++){const R=cityRng(k*131+(j+1)*17+(side>0?7:3)+c*0),o0=roadO(sm,side,j)+side*(B.RW/2+3),o1=j<B.NB-1?roadO(sm,side,j+1)-side*(B.RW/2+3):o0+side*52;
        cityBlock(c,sa,sb,o0,o1,side,j,cityF,R);}}
    /* 線路と側道のあいだの植え込み */
    for(let s2=c0+6;s2<c1;s2+=14){if(nearRiver(s2,70)||nearCross(s2,10))continue;const o=base(s2,side)-side*(B.RW/2+3.2);if(clearAt(s2,o,1.2))inst(c,'tree',s2,o,2.4,0.7,0.8,0.7);}}}
/* ===== 街の車と歩行者：線路沿いの道路を左側通行で走る車、歩道を歩く人（近くだけ、まとめて描く） ===== */
const RBC=new Map();
function roadBase(s,side){const k=Math.round(s/10),key=k*2+(side>0?1:0);let v=RBC.get(key);if(v===undefined){v=railEdge(k*10,side)+side*13;RBC.set(key,v);if(RBC.size>40000)RBC.clear();}return v;}
function roadOff(s,side,j){return roadBase(s,side)+side*j*CITY.BAND;}
function cityHere(s){if(nearRiver(s,76)||!hasTrackish(s))return false;if(BRANCH&&1-smooth(300,1100,nearBig(s))<0.3)return false;return true;}
const TRAF={cars:[],peds:[],ready:false,t:0,TD:new THREE.Object3D()};TRAF.TD.rotation.order='YXZ';
const CARC=[0xf2f2f2,0x1d1f23,0x8a9097,0xc8322b,0x2c4a7a,0xe8e2d0,0x3f5a45,0x6b6f78,0xd9b24a,0x7a2b3a].map(c=>new THREE.Color(c));
const PEDTOP=[0x2f3b52,0x6b3a3a,0x3f5a45,0xc9c2b0,0x23262b,0xf2efe6,0x3a5f8a,0x8a3f5f,0xd9702b,0xe08cb0].map(c=>new THREE.Color(c)),PEDLEG=[0x2b2d33,0x1b2740,0x5a4a3a,0x3b5b8c,0x6b6f78].map(c=>new THREE.Color(c)),PEDSKIN=[0xe8c49a,0xe0b894,0xd6a87c,0xc59468].map(c=>new THREE.Color(c));
function trafInit(){if(TRAF.ready)return;TRAF.ready=true;const MC=QMODE==='light'?60:QMODE==='heavy'?130:90,MP=QMODE==='light'?80:QMODE==='heavy'?200:130;TRAF.MC=MC;TRAF.MP=MP;
  const mk=(geo,mat,n)=>{const im=new THREE.InstancedMesh(geo,mat,n);im.frustumCulled=false;im.count=0;im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(im);return im;};
  const white=new THREE.MeshLambertMaterial({color:0xffffff});
  TRAF.body=mk(new THREE.BoxGeometry(1.72,0.72,4.2),white,MC);TRAF.cab=mk(new THREE.BoxGeometry(1.52,0.58,2.1),new THREE.MeshPhongMaterial({color:0x1a222c,shininess:80,specular:0x667788}),MC);
  TRAF.whl=mk(new THREE.BoxGeometry(1.8,0.5,3.0),new THREE.MeshLambertMaterial({color:0x151515}),MC);
  TRAF.hl=mk(new THREE.BoxGeometry(1.4,0.14,0.05),new THREE.MeshBasicMaterial({color:0xfff4d8}),MC);TRAF.tl=mk(new THREE.BoxGeometry(1.45,0.12,0.05),new THREE.MeshBasicMaterial({color:0xd8261a}),MC);
  TRAF.pb=mk(new THREE.BoxGeometry(0.42,0.6,0.26),white,MP);TRAF.ph=mk(new THREE.SphereGeometry(0.12,8,6),white,MP);
  const lg=new THREE.BoxGeometry(0.15,0.8,0.17);lg.translate(0,-0.4,0);TRAF.pl=mk(lg,white,MP*2);
  for(let i=0;i<MC;i++){TRAF.body.setColorAt(i,CARC[i%CARC.length]);}for(let i=0;i<MP;i++){TRAF.pb.setColorAt(i,PEDTOP[i%PEDTOP.length]);TRAF.ph.setColorAt(i,PEDSKIN[i%PEDSKIN.length]);TRAF.pl.setColorAt(i*2,PEDLEG[i%PEDLEG.length]);TRAF.pl.setColorAt(i*2+1,PEDLEG[i%PEDLEG.length]);}
  for(const im of [TRAF.body,TRAF.pb,TRAF.ph,TRAF.pl])if(im.instanceColor)im.instanceColor.needsUpdate=true;}
/* 道路の上の位置（s:線路方向、o:横）→ 世界座標と向き */
function roadPose(s,o,dirS){const p=P(s),q=P(s+1),fx=(q[0]-p[0])*dirS,fz=(q[1]-p[1])*dirS,l=Math.hypot(fx,fz)||1;return {x:p[0]+Math.cos(p[2])*o,z:p[1]+Math.sin(p[2])*o,yaw:Math.atan2(fx/l,fz/l),
  left:Math.sign((fz/l)*Math.cos(p[2])+(-fx/l)*Math.sin(p[2]))||1};}
function trafDensity(){const h=hourNow();return (h>=1&&h<5)?0.25:(h>=22||h<6)?0.45:isRushHour()?1.15:1.0;}
function updTraffic(dt){if(G.phase!=='play')return;trafInit();TRAF.t+=dt;const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s,den=trafDensity(),T=TRAF;
  /* 増やす・減らす（0.4秒ごと） */
  if(TRAF.t>0.4){TRAF.t=0;
    T.cars=T.cars.filter(c=>Math.abs(sdiff(camS,c.s))<820&&(c.cross?true:cityHere(c.s)));T.peds=T.peds.filter(q=>Math.abs(sdiff(camS,q.s))<460&&cityHere(q.s));
    const wantC=Math.round(T.MC*den),wantP=Math.round(T.MP*den);
    for(let n=0;n<6&&T.cars.length<wantC;n++){const s2=camS+rand(-780,780);if(!cityHere(s2))continue;
      if(Math.random()<0.18){ /* 交差する道路（線路と直角）を走る車 */const k=Math.round((s2-CITY.PH0)/CITY.BL),sk=k*CITY.BL+CITY.PH0;if(nearRiver(sk,80)||nearCross(sk,30))continue;const side=Math.random()<0.5?-1:1,out=Math.random()<0.5;
        T.cars.push({cross:true,s:sk,side,u:out?0:1,du:out?1:-1,v:rand(6,10),ci:T.cars.length%CARC.length});continue;}
      const side=Math.random()<0.5?-1:1,j=Math.floor(Math.random()*CITY.NB),dirS=Math.random()<0.5?1:-1;
      if(T.cars.some(c=>!c.cross&&c.side===side&&c.j===j&&c.dirS===dirS&&Math.abs(sdiff(c.s,s2))<18))continue;
      T.cars.push({s:s2,side,j,dirS,v:rand(9,15),vt:0,ci:Math.floor(Math.random()*CARC.length)});}
    for(let n=0;n<8&&T.peds.length<wantP;n++){const s2=camS+rand(-440,440);if(!cityHere(s2))continue;const side=Math.random()<0.5?-1:1,j=Math.floor(Math.random()*CITY.NB),e=Math.random()<0.5?-1:1;
      T.peds.push({s:s2,side,j,e,dirS:Math.random()<0.5?1:-1,v:rand(1.0,1.5),ph:Math.random()*6,dx:rand(-0.5,0.5)});}}
  /* 動かす */
  const td=T.TD,set=(im,i,x,y,z,yaw,lx,ly,lz,rx)=>{const c=Math.cos(yaw),sn=Math.sin(yaw);td.position.set(x+sn*lz+c*lx,y+ly,z+c*lz-sn*lx);td.rotation.set(rx||0,yaw,0);td.updateMatrix();im.setMatrixAt(i,td.matrix);};
  let ci=0;
  for(const c of T.cars){let x,z,yaw;
    if(c.cross){c.u+=c.du*c.v*dt/(CITY.BAND*(CITY.NB-1));if(c.u<0||c.u>1){c.dead=true;continue;}
      const o0=roadOff(c.s,c.side,0),o1=roadOff(c.s,c.side,CITY.NB-1),o=o0+(o1-o0)*c.u,p=P(c.s),q=P(c.s+1),tx=q[0]-p[0],tz=q[1]-p[1],tl=Math.hypot(tx,tz)||1;
      const lx=Math.cos(p[2]),lz=Math.sin(p[2]),mv=c.du*c.side;yaw=Math.atan2(lx*mv,lz*mv);const lsg=Math.sign((mv*lz)*(tx/tl)+(-mv*lx)*(tz/tl))||1,off=1.9*lsg; /* 進む向きの左側を走る */
      x=p[0]+lx*o+(tx/tl)*off;z=p[1]+lz*o+(tz/tl)*off;}
    else{ /* 前の車に近づいたら減速 */let gap=1e9;for(const d of T.cars){if(d===c||d.cross||d.side!==c.side||d.j!==c.j||d.dirS!==c.dirS)continue;const g=c.dirS*sdiff(c.s,d.s);if(g>0&&g<gap)gap=g;}
      const v=gap<12?0:gap<30?c.v*(gap-12)/18:c.v;c.vt+=(v-c.vt)*Math.min(1,dt*2);c.s+=c.dirS*c.vt*dt;
      const r0=roadPose(c.s,0,c.dirS),o=roadOff(c.s,c.side,c.j)+2.1*r0.left,rp=roadPose(c.s,o,c.dirS);x=rp.x;z=rp.z;yaw=rp.yaw;}
    if(ci>=T.MC)break;
    set(T.body,ci,x,0,z,yaw,0,0.62,0);set(T.cab,ci,x,0,z,yaw,0,1.22,-0.25);set(T.whl,ci,x,0,z,yaw,0,0.3,0);set(T.hl,ci,x,0,z,yaw,0,0.66,2.11);set(T.tl,ci,x,0,z,yaw,0,0.7,-2.11);
    if(T.body.instanceColor&&c.ci!=null){T.body.setColorAt(ci,CARC[c.ci]);}ci++;}
  T.cars=T.cars.filter(c=>!c.dead);
  for(const im of [T.body,T.cab,T.whl,T.hl,T.tl]){im.count=ci;im.instanceMatrix.needsUpdate=true;}if(T.body.instanceColor)T.body.instanceColor.needsUpdate=true;
  let pi=0;const tt=performance.now()/1000;
  for(const q of T.peds){if(pi>=T.MP)break;q.s+=q.dirS*q.v*dt;const o=roadOff(q.s,q.side,q.j)+q.e*(CITY.RW/2+1.2)+q.dx*0.4,rp=roadPose(q.s,o,q.dirS),sw=Math.sin(tt*q.v*5.5+q.ph)*0.5,bob=Math.abs(Math.sin(tt*q.v*5.5+q.ph))*0.03;
    set(T.pb,pi,rp.x,0.13,rp.z,rp.yaw,0,1.12+bob,0);set(T.ph,pi,rp.x,0.13,rp.z,rp.yaw,0,1.58+bob,0);
    set(T.pl,pi*2,rp.x,0.13,rp.z,rp.yaw,-0.1,0.82+bob,0,sw);set(T.pl,pi*2+1,rp.x,0.13,rp.z,rp.yaw,0.1,0.82+bob,0,-sw);pi++;}
  T.pb.count=pi;T.ph.count=pi;T.pl.count=pi*2;for(const im of [T.pb,T.ph,T.pl])im.instanceMatrix.needsUpdate=true;}
function hasTrackish(s){return !BRANCH||hasTrack(s)||hasTrack(s-200)||hasTrack(s+200);}
const LOTC={park:new THREE.Color(0x5f8a3a),park2:new THREE.Color(0x6f9a42),lot:new THREE.Color(0x77756f),plaza:new THREE.Color(0xb6af9f),pave:new THREE.Color(0x8e8b84),yard:new THREE.Color(0x6a8a4a)};
function cityBlock(c,sa,sb,o0,o1,side,j,cityF,R){const len=sb-sa,dep=Math.abs(o1-o0),om=(o0+o1)/2,sm=(sa+sb)/2;
  const st=stationNear(sm),sd=Math.abs(sdiff(st.s,sm)),com=1-smooth(150,650,sd),big=cityF;
  if(!clearAt(sm,om,Math.min(len,dep)*0.3))return;
  const r=R();
  if(j===0&&sd<110){inst(c,'field',sm,om,0.03,dep,0.06,len,LOTC.plaza,0);for(let q=0;q<4;q++){const ts=sa+len*(0.2+q*0.2),to=om+side*dep*0.35;inst(c,'trunk',ts,to,1.4,0.8,2.8,0.8);inst(c,'leaf',ts,to,3.6,2.2,2.0,2.2,LEAFC[q%LEAFC.length]);}return;} /* 駅前広場 */
  if(r<0.07){inst(c,'field',sm,om,0.03,dep,0.06,len,R()<0.5?LOTC.park:LOTC.park2,0);
    if(len>16&&dep>14)inst(c,'field',sm,om,0.07,dep*0.38,0.04,len*0.38,new THREE.Color(0x2a7ab8),0); /* 公園の池 */
    for(let q=0;q<10;q++){const ts=sa+R()*len,to=o0+side*R()*dep,sc=0.8+R()*0.6;if(q%2===0){inst(c,'trunk',ts,to,1.2*sc,sc,2.4*sc,sc);inst(c,'leaf',ts,to,3.2*sc,2.1*sc,1.9*sc,2.1*sc,LEAFC[q%LEAFC.length]);}else inst(c,'tree',ts,to,3*sc,sc,1.1*sc,sc);}return;} /* 公園 */
  if(r<0.12){inst(c,'field',sm,om,0.03,dep,0.06,len,LOTC.lot,0);
    for(let q=0;q<3;q++){const cx=sa+len*(0.25+q*0.25),co=om+side*(R()-0.5)*dep*0.35;if(clearAt(cx,co,2.5))inst(c,'house',cx,co,0.65,2.0,1.3,4.2,bcols[(q+2)%bcols.length],0);}return;} /* 駐車場と駐車車両 */
  inst(c,'field',sm,om,0.025,dep,0.05,len,j>=2&&big<0.5?LOTC.yard:LOTC.pave,0);
  /* 道路に面した表と裏の2列に、敷地を並べる */
  const rows=[[o0,o0+side*dep*0.5],[o1,o1-side*dep*0.5]];
  for(let ri=0;ri<2;ri++){const [fo,bo]=rows[ri];let cur=sa+1;
    while(cur<sb-6){const res=j>=2||(com<0.25&&big<0.55);const lw=res?(9+R()*6):(big>0.6&&j<=1?18+R()*26:11+R()*16);const w=Math.min(lw,sb-1-cur);if(w<6)break;
      const set=1.6+R()*2.2,dd=Math.max(6,Math.abs(bo-fo)-set-1.2),oc=fo+side*(ri===0?1:-1)*(set+dd/2),scx=cur+w/2,corner=cur<sa+8||cur+w>sb-8;
      let h,key;
      if(!res&&big>0.6&&j<=1){h=24+Math.pow(R(),1.4)*140*big+(corner?10:0);key='bldB';}            /* 大きな駅のまわり：高いビル */
      else if(!res){h=7+R()*20*(0.4+com+big*0.6)+(corner?4:0);key=h>30?'bldB':'bldA';}             /* 駅前・商店街：店舗・事務所 */
      else if(R()<0.62){h=5.6+R()*1.4;key='house';}                                                  /* 住宅 */
      else{h=9+R()*18;key='bldA';}                                                                   /* マンション */
      const ww=w-1.6-R()*1.2,ddd=Math.min(dd,key==='house'?9+R()*3:dd);
      if(clearAt(scx,oc,Math.hypot(ww,ddd)/2*0.7)){
        if(key==='house'){const col=HOUSEC[(R()*HOUSEC.length)|0];inst(c,'house',scx,oc,h/2,ddd,h,ww,col,0);inst(c,'roof',scx,oc,h,ddd*1.08,2.2,ww*1.06,ROOFC[(R()*ROOFC.length)|0],0);}
        else{const bc=bcols[(R()*bcols.length)|0];inst(c,key,scx,oc,h/2,ddd,h,ww,bc,0);
          if(h>35)inst(c,key,scx,oc,h+2.2,ddd*0.58,4.4,ww*0.58,bc,0);}} /* 高層ビルの屋上塔屋 */
      cur+=w+0.6;}}
  if(j>=1&&big<0.6)for(let q=0;q<3;q++){const ts=sa+R()*len,to=om+side*(R()-0.5)*dep*0.2;if(q%2===0){inst(c,'trunk',ts,to,1.2,0.8,2.4,0.8);inst(c,'leaf',ts,to,3.1,2.0,1.8,2.0,LEAFC[q%LEAFC.length]);}else inst(c,'tree',ts,to,2.6,0.8,0.9,0.8);}}
const HOUSEC=[0xf1ede4,0xe6dccb,0xd9d4c7,0xcfd8dc,0xf3e6d0,0xe0d2bb].map(c=>new THREE.Color(c)),ROOFC=[0x7a2e2a,0x2f3e58,0x4a4a4a,0x6b4a2e,0x355e3b].map(c=>new THREE.Color(c)),
  FIELDC=[0x6f9a3c,0x86a84a,0xb9a95a,0x5e8a3a,0x9bb15a].map(c=>new THREE.Color(c)),LEAFC=[0x3f6b35,0x4d7a3a,0x5b8a40,0x365e2f].map(c=>new THREE.Color(c));
/* 港見支線：軍港〜港前は海岸線に沿う（線路の左側が海）。軍港には軍艦が停泊 */
function coastRange(){if(!MINI)return null;const a=STATIONS[CFG.mini.coast[0]],b=STATIONS[CFG.mini.coast[1]];return [a.s-700,b.s+300];}
function isSea(s,o){const r=coastRange();return !!r&&o<-20&&s>r[0]&&s<r[1];}
function isCoastS(s){const r=coastRange();return !!r&&s>r[0]&&s<r[1];}
function seaChunk(c,c0){const r=coastRange();if(!r)return;const a=Math.max(c0,r[0]),b=Math.min(c0+CH,r[1]);if(b<=a)return;
  strip(c,a,b,20,[[-20,0.05],[-34,-0.3]],'sand',true);                                                                            /* 砂浜（海へ下がっていく） */
  strip(c,a,b,20,[[-12,0.4],[-19.5,0.4]],'concD',true);                                                                             /* 護岸 */
  const P0=STATIONS[CFG.mini.port];
  if(Math.abs(P0.s-(a+b)/2)<900){ /* 軍港：岸壁と、停泊している軍艦 */
    const qa=Math.max(a,P0.s-650),qb=Math.min(b,P0.s+250);if(qb>qa){strip(c,qa,qb,20,[[-20,0.9],[-48,0.9],[-48,-1.5]],'concD',true);for(let s2=qa+10;s2<qb;s2+=28)inst(c,'field',s2,-46.5,1.1,0.6,0.5,0.6,new THREE.Color(0x222222));}
    for(const [ds,L2,col] of [[-480,130,0x6f777e],[-300,150,0x737b82],[-110,118,0x6b737a],[60,96,0x777f86]]){const sc=P0.s+ds;if(sc<c0||sc>=c0+CH)continue;
      const o=-60,G2=new THREE.Color(col),D2=new THREE.Color(0x4f5559),R2=new THREE.Color(0x7a2a2a);
      inst(c,'field',sc,o,-0.6,15,2.2,L2,R2);inst(c,'field',sc,o,3.2,15,6.4,L2*0.96,G2);inst(c,'field',sc,o,6.5,14.4,0.3,L2*0.94,D2);         /* 船体・甲板 */
      inst(c,'field',sc+L2*0.06,o,9.5,10,6,L2*0.26,G2);inst(c,'field',sc+L2*0.1,o,14.5,8,4.5,L2*0.12,G2);inst(c,'field',sc+L2*0.12,o,17.5,6.5,1.8,4,D2); /* 艦橋 */
      inst(c,'lightTower',sc+L2*0.1,o,24,0.5,14,0.5);inst(c,'lightTower',sc+L2*0.1,o,27,6,0.3,0.3);inst(c,'field',sc-L2*0.06,o,11,4.5,8,6,D2);       /* マスト・煙突 */
      for(const tz of [0.34,-0.36]){inst(c,'field',sc+L2*tz,o,8,6.5,2.6,7,G2);inst(c,'field',sc+L2*tz+Math.sign(tz)*6.5,o,8.4,0.6,0.6,8,D2);}         /* 主砲 */
      inst(c,'field',sc-L2*0.25,o,9,8,4,14,G2);inst(c,'field',sc-L2*0.42,o,7,12,1.2,12,new THREE.Color(0x9aa0a4));}                                  /* 後部・ヘリ甲板 */
  }}
/* 海：海岸線（線路の左）から沖へ3km広がる海面。波の模様がゆっくり動き、波打ち際には白い波が寄せる */
let SEA=null;
function buildSea(){if(!MINI||SEA)return;const r=coastRange(),pts=[];for(let s2=r[0];s2<=r[1];s2+=20){const p=P(s2);pts.push(p);}
  const mk=(o0,o1,y,uvs)=>{const pos=[],uv=[],idx=[];pts.forEach((p,i)=>{const cx=Math.cos(p[2]),cz=Math.sin(p[2]);for(const o of [o0,o1]){const x=p[0]+cx*o,z=p[1]+cz*o;pos.push(x,y,z);uv.push(uvs?x/uvs:i*0.25,uvs?z/uvs:(o===o0?0:1));}
      if(i>0){const a=(i-1)*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}});const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;};
  const tex=canvasTex(256,256,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#1e7fd6');g.addColorStop(0.5,'#2b95e8');g.addColorStop(1,'#1a74c8');x.fillStyle=g;x.fillRect(0,0,w,h);
    for(let k=0;k<70;k++){const yy=(k*37)%h,xx=(k*91)%w,l=18+(k*13)%40;x.strokeStyle='rgba(200,230,255,'+(0.12+((k*7)%10)/60).toFixed(2)+')';x.lineWidth=2;x.beginPath();x.moveTo(xx,yy);x.quadraticCurveTo(xx+l/2,yy-4,xx+l,yy);x.stroke();}});
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  const sea=new THREE.Mesh(mk(-26,-3200,-0.08,24),new THREE.MeshPhongMaterial({map:tex,color:0xffffff,emissive:0x0d4f99,emissiveIntensity:0.55,specular:0xcfe6ff,shininess:90,side:DS,fog:true})); /* 真っ青な海（影でも青い） */sea.renderOrder=-1;scene.add(sea);
  const ftex=canvasTex(64,256,(x,w,h)=>{x.clearRect(0,0,w,h);for(let k=0;k<4;k++){const yy=20+k*60;const g=x.createLinearGradient(0,yy-10,0,yy+14);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(0.5,'rgba(255,255,255,0.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,yy-10,w,24);}});
  ftex.wrapS=ftex.wrapT=THREE.RepeatWrapping;const foam=new THREE.Mesh(mk(-22,-40,-0.05,0),new THREE.MeshBasicMaterial({map:ftex,transparent:true,opacity:0.7,depthWrite:false,side:DS}));scene.add(foam);
  SEA={sea,foam,tex,ftex};}
function updSea(dt){if(MINI&&!SEA)buildSea();if(!SEA)return;const t=performance.now()/1000;SEA.tex.offset.x=(SEA.tex.offset.x+dt*0.012)%1;SEA.tex.offset.y=(SEA.tex.offset.y+dt*0.007)%1;
  SEA.ftex.offset.y=(t*0.08)%1;SEA.foam.material.opacity=0.45+0.25*Math.sin(t*1.3);}
function ruralChunk(c,c0,rnd){ // countryside along the branch: fields, woods and detached houses
  if(MINI){seaChunk(c,c0);const P0=STATIONS[CFG.mini.port];if(Math.abs(P0.s-(c0+CH/2))<700)for(let q=0;q<6;q++){const s2=P0.s-560+q*120,o=24+(q%2)*26;if(s2>=c0&&s2<c0+CH&&clearAt(s2,o,14))inst(c,'bldA',s2,o,4.5,18,9,26,new THREE.Color(0x8a9196));} /* 基地の建物 */
  }
  const lonely=MINI&&Math.abs(STATIONS[NST-1].s-(c0+CH/2))<700; /* 奥港は閑散（家はわずか） */
  let n=0,tries=0;while(n<(lonely?2:14)&&tries<90){tries++;const s2=c0+rnd()*CH,side=rnd()<0.5?-1:1,o=(side<0?-12:sepB(s2)+12)+side*(8+Math.pow(rnd(),1.4)*140),w=7+rnd()*3.5,d=8+rnd()*3.5,h=5+rnd()*1.6,r=Math.hypot(w,d)/2+2;
    if(!clearAt(s2,o,r))continue;const rot=rnd()<0.5?0:Math.PI/2;inst(c,'house',s2,o,h/2,w,h,d,HOUSEC[(rnd()*HOUSEC.length)|0],rot);inst(c,'roof',s2,o,h,w*1.1,2.3,d*1.06,ROOFC[(rnd()*ROOFC.length)|0],rot);n++;}
  n=0;tries=0;while(n<6&&tries<40){tries++;const s2=c0+rnd()*CH,side=rnd()<0.5?-1:1,w=25+rnd()*40,d=25+rnd()*50,o=(side<0?-10:sepB(s2)+10)+side*(w/2+8+rnd()*120);
    if(!clearAt(s2,o,Math.max(w,d)/2))continue;inst(c,'field',s2,o,0.03,w,0.06,d,FIELDC[(rnd()*FIELDC.length)|0]);
    if(rnd()<0.35&&clearAt(s2,o,6)){inst(c,'house',s2,o,1.1,4.5,2.2,12,new THREE.Color(0xeef6ff),0);} /* ビニールハウス */
    n++;}
  if(rnd()<0.65){const ps=c0+CH*0.5,po=(rnd()<0.5?-1:1)*(75+rnd()*90);if(clearAt(ps,po,5)){inst(c,'lightTower',ps,po,14,1.2,28,1.2);inst(c,'lightTower',ps,po,23,6.5,0.45,0.45);inst(c,'lightTower',ps,po,18,8.5,0.45,0.45);}} /* 送電線鉄塔 */
  n=0;tries=0;while(n<90&&tries<300){tries++;const s2=c0+rnd()*CH,side=rnd()<0.5?-1:1,o=(side<0?-9:sepB(s2)+9)+side*Math.pow(rnd(),0.8)*220,sc=0.8+rnd()*1.1;
    if(!clearAt(s2,o,1.5))continue;if(rnd()<0.45){inst(c,'tree',s2,o,3*sc,sc,sc*1.2,sc);}else{inst(c,'trunk',s2,o,1.3*sc,sc,2.6*sc,sc);inst(c,'leaf',s2,o,3.6*sc,2.2*sc,2.0*sc,2.2*sc,LEAFC[(rnd()*LEAFC.length)|0]);}n++;}
}
let chunkQueue=[];
function updChunks(s,force){
  if(force){for(let c=0;c<NCH;c++){if(!CHUNKS[c].built)buildChunk(c);}return;}
  const pc=chunkOf(s);const want=[];for(let d=0;d<=6;d++){for(const q of d?[pc+d,pc-d]:[pc])want.push(mod(q,NCH));}
  for(const c of want){if(!CHUNKS[c].built){buildChunk(c);break;}}
}
/* ================= trains ================= */
const doorTex=canvasTex(64,128,(x,w,h)=>{x.fillStyle='#b9bec4';x.fillRect(0,0,w,h);x.clearRect(12,10,40,50);x.strokeStyle='#8d9298';x.lineWidth=3;x.strokeRect(1,1,w-2,h-2);});
const TM={
  body:new THREE.MeshPhongMaterial({color:0xc9cdd3,specular:0x777777,shininess:35}),
  glass:new THREE.MeshPhongMaterial({color:0x2f4457,emissive:0x000000,specular:0xdde8f2,shininess:90,transparent:true,opacity:0.11,depthWrite:false,side:DS}),
  glassF:new THREE.MeshBasicMaterial({color:0xe2eef8,transparent:true,opacity:0.028,depthWrite:false,side:DS,fog:false}),
  glassC:new THREE.MeshBasicMaterial({color:0xeef7fd,transparent:true,opacity:0.04,depthWrite:false,side:DS,fog:false}),
  doorway:new THREE.MeshLambertMaterial({color:0x6b645a,emissive:0xfff1d6,emissiveIntensity:0.25,side:DS}),
  dark:lam(0x26282b),mid:lam(0x4a4e54),
  face:new THREE.MeshPhongMaterial({color:0xe6e8ea,shininess:40,side:DS}),
  black:new THREE.MeshPhongMaterial({color:0x0e1013,specular:0x555555,shininess:60,side:DS}),
  /* 新形車両（v1.9.0）の外装：黒いフェイスパネル・窓まわりのダークバンド・LEDライト */
  mask:new THREE.MeshPhongMaterial({color:0x15191f,specular:0x9aa4b0,shininess:85,side:DS}),
  band:new THREE.MeshPhongMaterial({color:0x1c222a,specular:0x6b7783,shininess:55,side:DS}),
  ledW:new THREE.MeshBasicMaterial({color:0xf4f8ff,side:DS}),
  ledR:new THREE.MeshBasicMaterial({color:0xff2a1a,side:DS}),
  ledGlow:new THREE.MeshBasicMaterial({color:0xbfe4ff,transparent:true,opacity:0.45,side:DS,depthWrite:false}),
  accent:new THREE.MeshBasicMaterial({color:0x35d2ff,side:DS}),
  headOn:new THREE.MeshBasicMaterial({color:0xfff7df,side:DS}),tailOn:new THREE.MeshBasicMaterial({color:0xff2a1a,side:DS}),
  lampOff:new THREE.MeshLambertMaterial({color:0x44403c,side:DS}),
  door:new THREE.MeshPhongMaterial({map:doorTex,shininess:30,side:DS,alphaTest:0.5,transparent:false}),
  iwall:new THREE.MeshLambertMaterial({color:0xf4f6f8,emissive:0xf4f6f8,emissiveIntensity:0.38,side:DS}),
  iseat:new THREE.MeshLambertMaterial({color:0x2a3f66,emissive:0x2a3f66,emissiveIntensity:0.32}),
  ifloor:new THREE.MeshLambertMaterial({color:0x8b9097,emissive:0x8b9097,emissiveIntensity:0.3,side:DS}),
  ilight:new THREE.MeshBasicMaterial({color:0xfdfcf4,side:DS}),
  iled:new THREE.MeshBasicMaterial({map:null,side:THREE.FrontSide}),
  iledR:new THREE.MeshBasicMaterial({map:null,side:THREE.FrontSide}),
  iad:new THREE.MeshBasicMaterial({map:null,side:THREE.FrontSide}),
  iledF:new THREE.MeshBasicMaterial({map:null}),
  gseat:new THREE.MeshLambertMaterial({color:0x2e6b45,emissive:0x2e6b45,emissiveIntensity:0.22}),
  gfloor:new THREE.MeshLambertMaterial({color:0x3f4a3c,emissive:0x3f4a3c,emissiveIntensity:0.25}),
  grack:new THREE.MeshLambertMaterial({color:0xb9bec4,emissive:0x777777,emissiveIntensity:0.2}),
  pole:new THREE.MeshPhongMaterial({color:0x8a9097,shininess:60})
};
const DLED=mkCanvas(512,274),DLED_R=mkCanvas(512,274),ADS=mkCanvas(512,274);TM.iled.map=DLED.tex;TM.iledF.map=DLED.tex;TM.iledR.map=DLED_R.tex;TM.iad.map=ADS.tex;
/* 新形のドア上ワイド画面（トレインビジョン）640×240 */
const DLED2=mkCanvas(640,240);TM.iledW=new THREE.MeshBasicMaterial({map:DLED2.tex,side:DS});
/* 支線の古い電車：ドア上の電光掲示板（流れる文字）とドア開閉予告灯（ランプ） */
const OLED=mkCanvas(768,80);TM.ioled=new THREE.MeshBasicMaterial({map:OLED.tex,side:THREE.FrontSide});
TM.ilampL=new THREE.MeshBasicMaterial({color:0x3a0e0a,side:DS});TM.ilampR=new THREE.MeshBasicMaterial({color:0x3a0e0a,side:DS});
const OLDI={iwall:TM.iwall.clone(),iseat:TM.iseat.clone(),ifloor:TM.ifloor.clone()}; /* 古い電車の車内：化粧板クリーム・座席えんじ・床茶色 */
OLDI.iwall.color.setHex(0xe2d8bd);OLDI.iwall.emissive.setHex(0xe2d8bd);OLDI.iseat.color.setHex(0x8a3e36);OLDI.iseat.emissive.setHex(0x8a3e36);
OLDI.ifloor.color.setHex(0x7a6e5c);OLDI.ifloor.emissive.setHex(0x7a6e5c);
const OLDBODY=new THREE.MeshPhongMaterial({color:MINI?0x2c4f86:0xe9e1c9,specular:0x333333,shininess:18}); // 塗装車体（支線はクリーム、港見支線は紺）
/* 紙の広告（中吊り・窓上） */
const PAPERAD=[['港見の地魚','港見漁協 直売所','朝7時から'],['軍港見学ツアー','毎週日曜','港見観光協会'],['奥港の民宿','海の見える部屋','一泊二食付き'],['港前 喫茶 しおさい','昔ながらのナポリタン','港前駅前'],['汐見信用金庫','定期預金キャンペーン','港見支店'],['港見高校 文化祭','10月の週末','どなたでもどうぞ']].map((a,i)=>{
  const t=canvasTex(256,180,(x,w,h)=>{const bg=['#fff8e6','#e8f0ff','#f0fff0','#fff0f5','#f5f5f5','#fffbe0'][i];x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle='#999';x.lineWidth=4;x.strokeRect(2,2,w-4,h-4);
    x.fillStyle=['#c8322b','#1d3f7a','#2e7d4f','#8a3f5f','#333','#d07a1a'][i];x.fillRect(10,10,w-20,46);x.fillStyle='#fff';x.font='700 28px sans-serif';x.textAlign='center';x.fillText(a[0],w/2,44);
    x.fillStyle='#222';x.font='700 22px sans-serif';x.fillText(a[1],w/2,100);x.font='18px sans-serif';x.fillStyle='#555';x.fillText(a[2],w/2,140);});return new THREE.MeshLambertMaterial({map:t});}); /* 片面（裏から見ても鏡文字にならない） */
PAPERAD.forEach((m,i)=>{TM['pad'+i]=m;});
const carShape=new THREE.Shape();
carShape.moveTo(-1.4,3.42);carShape.lineTo(1.4,3.42);
carShape.quadraticCurveTo(1.38,3.64,1.0,3.7);carShape.lineTo(-1.0,3.7);carShape.quadraticCurveTo(-1.38,3.64,-1.4,3.42);
const carGeo=new THREE.ExtrudeGeometry(carShape,{depth:19.5,bevelEnabled:false,curveSegments:5});carGeo.translate(0,0,-9.75);
const carShapeG=new THREE.Shape();
carShapeG.moveTo(-1.4,4.50);carShapeG.lineTo(1.4,4.50);
carShapeG.quadraticCurveTo(1.38,4.72,1.0,4.78);carShapeG.lineTo(-1.0,4.78);carShapeG.quadraticCurveTo(-1.38,4.72,-1.4,4.50);
const carGeoG=new THREE.ExtrudeGeometry(carShapeG,{depth:19.5,bevelEnabled:false,curveSegments:5});carGeoG.translate(0,0,-9.75);
/* 車体のふた（前後の端の面）を除いた形：車内のある電車は端をふさがない（前面ガラスから外が見える＝前面展望。運転台の外側は前面の部品でふさぐ） */
function noCaps(g){const grp=(g.groups||[]).find(x=>x.materialIndex===1);if(!grp||g.index)return g;const n=new THREE.BufferGeometry();
  for(const k of ['position','normal','uv']){const a=g.attributes[k];if(!a)continue;n.setAttribute(k,new THREE.BufferAttribute(a.array.slice(grp.start*a.itemSize,(grp.start+grp.count)*a.itemSize),a.itemSize));}
  n.computeBoundingSphere();return n;}
const carGeoNC=noCaps(carGeo),carGeoGNC=noCaps(carGeoG);
/* 運転台側の端のふた：車体と同じ輪郭で、前面窓の部分だけ穴をあけたもの */
const capHole=(()=>{const sh=new THREE.Shape(carShape.getPoints(8));const h=new THREE.Path();h.moveTo(-1.33,2.37);h.lineTo(-1.33,3.47);h.lineTo(1.33,3.47);h.lineTo(1.33,2.37);h.lineTo(-1.33,2.37);sh.holes.push(h);return new THREE.ShapeGeometry(sh,8);})();
const wheelGeo=new THREE.CylinderGeometry(0.43,0.43,0.12,12);
const leafGeo=boxGeo(0.035,1.85,0.70);
function mergeGeos(list){let total=0;const parts=[];
  for(const [g,m] of list){const ng=g.index?g.toNonIndexed():g.clone();ng.applyMatrix4(m);parts.push(ng);total+=ng.attributes.position.count;}
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3),uv=new Float32Array(total*2);let o=0;
  for(const g of parts){pos.set(g.attributes.position.array,o*3);if(g.attributes.normal)nor.set(g.attributes.normal.array,o*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);o+=g.attributes.position.count;}
  const r=new THREE.BufferGeometry();r.setAttribute('position',new THREE.BufferAttribute(pos,3));r.setAttribute('normal',new THREE.BufferAttribute(nor,3));r.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  r.computeBoundingSphere();return r;}
const WINZ=[[-9.1,-7.3],[-5.3,-1.0],[1.0,5.3],[7.3,9.1]];
// parts of a wall segment [a,b] that are not window openings (the pillars between windows)
function pierSpansG(a,b,W){const out=[];let cur=a;for(const [w0,w1] of W){if(w1<=a||w0>=b)continue;if(w0>cur)out.push([cur,w0]);cur=Math.max(cur,w1);}if(cur<b)out.push([cur,b]);return out.filter(([x,y])=>y-x>0.02);}
function pierSpans(a,b){const out=[];let cur=a;for(const [w0,w1] of WINZ){if(w1<=a||w0>=b)continue;if(w0>cur)out.push([cur,w0]);cur=Math.max(cur,w1);}if(cur<b)out.push([cur,b]);return out.filter(([x,y])=>y-x>0.02);}
const GDOORZ=[-7.6,7.6]; /* グリーン車のドアはデッキの中央（階段・仕切りにかからない） */
const GROWZ=(()=>{const o=[];for(let z=-4.9;z<=4.95;z+=1.05)o.push(+z.toFixed(2));return o;})();
const WINZ_G=GROWZ.map(z=>[z-0.40,z+0.40]);
const GFLOOR={down:0.55,deck:1.16,up:2.62};
const GBANDS=[[1.34,2.02],[3.16,3.86]];      // 下段・上段の窓
const GSEATS2=[];for(const z of GROWZ)for(const x of [-1.00,-0.52,0.52,1.00]){GSEATS2.push({x,z,fl:'down'});GSEATS2.push({x,z,fl:'up'});}

/* 客室レイアウト（車両ローカル座標、前方が -z）。ホームから見た車両と運転台ビューの客室は両方ここから作る */
const CABLEN=2.6; // 運転台の奥行き（前面〜仕切り）
function salZRange(front,rear){return [front?-CARHALF+CABLEN:-CARHALF,rear?CARHALF-CABLEN:CARHALF];}
function salLayout(front,rear){const [z0,z1]=salZRange(front,rear),inR=(a,b)=>a>=z0-0.01&&b<=z1+0.01;
  const seats=WINZ.filter(([a,b])=>inR(a,b));                       // ロングシート＝側窓の下
  const lcdSeat=seats.map(([a,b])=>(a+b)/2);                        // 座席上の3画面は座席の中央
  const doors=DOORZ.filter(z=>z>z0&&z<z1);                          // ドア上の3画面
  const poles=[];for(const dz of doors)for(const k of [-1,1]){const z=dz+k*0.75;if(z>z0+0.05&&z<z1-0.05)poles.push(z);}
  const straps=[];for(const [a,b] of seats)for(let z=a+0.4;z<b-0.2;z+=0.55)straps.push(z);
  return {z0,z1,seats,lcdSeat,doors,poles,straps};}
/* 側面ドア上の電光掲示板（外向きの片面ポリゴン） */
const SLED_Y=3.26,SLED_W=1.06,SLED_H=0.26;
const SLED_OFF=new THREE.MeshBasicMaterial({color:0x101113,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const SLED_GEO={};
function sledGeo(green,old){const k=old?'o':green?'g':'n';if(SLED_GEO[k])return SLED_GEO[k];const list=[];
  for(const sg of [-1,1])for(const dz of (old?[0]:green?GDOORZ:DOORZ)){dummy.position.set(sg*1.425,SLED_Y,dz);dummy.rotation.set(0,sg*Math.PI/2,0);dummy.scale.set(SLED_W,SLED_H,1);dummy.updateMatrix();list.push([UNIT_PLANE,dummy.matrix.clone()]);}
  return SLED_GEO[k]=mergeGeos(list);}
const TPL={};
function carTemplate(front,rear,panto,staticDoors,green,old,flat){
  const key=''+(+front)+(+rear)+(+panto)+(+staticDoors)+(+!!green)+(+!!old)+(+!!flat);if(TPL[key])return TPL[key];
  const parts={};const put=(k,g,x,y,z,rx,ry,rz,sx,sy,sz)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx||0,ry||0,rz||0);dummy.scale.set(sx||1,sy||1,sz||1);dummy.updateMatrix();(parts[k]||(parts[k]=[])).push([g,dummy.matrix.clone()]);};
  const box=(k,w,h,d,x,y,z)=>put(k,boxGeo(w,h,d),x,y,z);
  const pl=(k,w,h,x,y,z,ry)=>put(k,UNIT_PLANE,x,y,z,0,ry,0,w,h,1);
  put('body',green?(staticDoors?carGeoG:carGeoGNC):(staticDoors?carGeo:carGeoNC),0,0,0);
  const WZ=green?WINZ_G:WINZ;const BANDS=green?GBANDS:[[2.27,3.05]];
  const TOPY=green?4.50:3.42,ITOP=green?4.46:3.41,FLO=green?0.50:1.0;
  const WY0=BANDS[0][0],WY1=BANDS[BANDS.length-1][1],WH=WY1-WY0,WC=(WY0+WY1)/2;
  const SEG=green?[[-9.75,-8.25],[-6.95,6.95],[8.25,9.75]]:[[-9.75,-6.95],[-5.65,-0.65],[0.65,5.65],[6.95,9.75]];
  box('dark',2.8,0.04,19.5,0,1.0,0);for(const z of [-9.73,9.73])box('body',2.8,2.42,0.03,0,2.21,z);
  for(const sg of [-1,1]){const X=sg*1.4,ry=sg*Math.PI/2;
    for(const [a,b] of SEG){const mid2=(a+b)/2,edges=[FLO];for(const bd of BANDS){edges.push(bd[0],bd[1]);}edges.push(TOPY);
      for(let q=0;q<edges.length;q+=2){const y0=edges[q],y1=edges[q+1];if(y1-y0>0.02)pl('body',b-a,y1-y0,X,(y0+y1)/2,mid2,ry);}
      for(const bd of BANDS)for(const [p0,p1] of pierSpansG(a,b,WZ)){pl('body',p1-p0,bd[1]-bd[0],X,(bd[0]+bd[1])/2,(p0+p1)/2,ry);if(!green)pl('band',p1-p0,bd[1]-bd[0],X+sg*0.002,(bd[0]+bd[1])/2,(p0+p1)/2,ry);}
      if(!green){pl('band',b-a,0.16,X+sg*0.002,3.13,mid2,ry);} /* 窓上のダークバンド（窓ガラス部分は抜いて透明にする） */
      pl('liv1',b-a,0.16,X+sg*0.003,green?2.35:2.1,mid2,ry);}
    pl('liv2',19.4,0.06,X+sg*0.003,green?4.05:3.18,0,ry);
    for(const [a,b] of WZ)for(const bd of BANDS){const h2=bd[1]-bd[0],c2=(bd[0]+bd[1])/2,mid=(a+b)/2,fx=sg*1.38;
      pl('glass',b-a,h2,X+sg*0.004,c2,mid,ry);
      box('dark',0.05,0.05,b-a+0.09,fx,bd[1]+0.025,mid);box('dark',0.05,0.05,b-a+0.09,fx,bd[0]-0.025,mid);
      for(const zz of [a-0.025,b+0.025])box('dark',0.05,h2+0.1,0.05,fx,c2,zz);}
    for(const dz of (green?GDOORZ:DOORZ)){pl('body',1.3,0.2,X,1.1,dz,ry);pl('body',1.3,TOPY-3.05,X,(3.05+TOPY)/2,dz,ry);
      if(!staticDoors&&(!old||dz===0))box('dark',0.02,0.33,1.18,sg*1.405,SLED_Y,dz); /* 側面表示器の枠（古い形式は車両の真ん中に1つ） */
      if(!staticDoors&&!green)pl('dest',1.06,0.26,X+sg*0.016,SLED_Y,dz,ry); /* v2.5.0：側面の方向幕（前面と同じ行先・種別を掲出） */
      if(!staticDoors){ /* ドア枠（内壁と外板のあいだをふさぐ：車内から見た戸の縁・上・下の隙間をなくす） */
        for(const k2 of [-1,1])box('grack',0.05,1.9,0.03,sg*1.382,2.125,dz+k2*0.665);
        box('grack',0.05,0.03,1.36,sg*1.382,3.065,dz);box('grack',0.07,0.06,1.36,sg*1.375,1.17,dz);}
      if(staticDoors)for(const k of [-1,1])put('door',leafGeo,X+sg*0.02,2.125,dz+k*0.35);}
    if(!staticDoors){ // passenger saloon seen through open doors
      const IX=sg*1.36,iry=-sg*Math.PI/2;
      {const iedges=[(green&&!flat)?0.72:1.15];for(const bd of BANDS){iedges.push(bd[0],bd[1]);}iedges.push(ITOP);
       for(const [a,b] of SEG){for(let q=0;q<iedges.length;q+=2){const y0=iedges[q],y1=iedges[q+1];if(y1-y0>0.02)pl('iwall',b-a,y1-y0,IX,(y0+y1)/2,(a+b)/2,iry);}
         for(const bd of BANDS)for(const [p0,p1] of pierSpansG(a,b,WZ))pl('iwall',p1-p0,bd[1]-bd[0],IX,(bd[0]+bd[1])/2,(p0+p1)/2,iry);}}
      (green?GDOORZ:DOORZ).forEach((dz,j)=>{pl('iwall',1.3,ITOP-3.05,IX,(3.05+ITOP)/2,dz,iry);});
      if(!green){const LY=salLayout(front,rear);
        if(old){ /* 古い形式：ドア上に液晶1つ、向かいのドア上は電光掲示板（千鳥配置）＋その下にドア開閉予告灯。港見支線は電光掲示板だけの千鳥配置 */
          LY.doors.forEach((z,j)=>{const lcdSide=j%2===0?1:-1;
            if(MINI&&sg!==lcdSide)return;if(MINI){pl('ioled',0.86,0.14,IX-sg*0.008,3.30,z,iry);pl(sg>0?'ilampR':'ilampL',0.44,0.05,IX-sg*0.008,3.14,z,iry);return;}
            if(sg===lcdSide)pl('iled',0.58,0.33,IX-sg*0.008,3.23,z,iry);
            else{pl('ioled',0.86,0.14,IX-sg*0.008,3.30,z,iry);pl(sg>0?'ilampR':'ilampL',0.44,0.05,IX-sg*0.008,3.14,z,iry);}});}
        else{ /* 新形：ドア上・戸袋上・窓上・天井中吊り・妻面に案内用・広告用液晶を多数配置 */
          for(const z of LY.doors){
            /* 先頭車の最前部でも、乗務員室の仕切りを越えて運転席側へ飛び出さないよう客室範囲に収める */
            const putLcd=(mat,w,h,zz)=>{if(zz<LY.z0+0.30||zz>LY.z1-0.30)return;pl(mat,w,h,IX-sg*0.008,3.24,zz,iry);};
            putLcd('iad',0.46,0.24,z-0.34);
            putLcd('iledW',0.68,0.26,z+0.26);
            putLcd('iled',0.42,0.24,z-0.92);
            putLcd('iad',0.42,0.24,z+0.92);}
          for(const [a,b] of LY.seats){let si=0;for(let z=a+0.7;z<=b-0.65;z+=1.15,si++){
            if(si%2===0)pl('iad',0.60,0.31,IX-sg*0.008,3.226,z,iry);
            else pl('iledW',0.64,0.25,IX-sg*0.008,3.226,z,iry);}}
          for(const z of [-6.0,-3.2,0,3.2,6.0]){ /* 中吊りデジタルサイネージ（両面・中央は案内用、他は広告用） */
            box('dark',0.68,0.38,0.045,0,3.15,z);
            const mat=z===0?'iledW':'iad';
            for(const face of [0,Math.PI])pl(mat,0.62,z===0?0.24:0.32,0,3.15,z+(face?-0.026:0.026),face);
            for(const k of [-1,1])box('grack',0.02,0.09,0.02,k*0.26,3.38,z);}}
        for(const [a,b] of LY.seats){box('iseat',0.46,0.42,b-a-0.3,sg*1.1,1.37,(a+b)/2);box('iseat',0.08,0.45,b-a-0.3,sg*1.31,1.8,(a+b)/2);
          if(MINI&&old){let q=0;for(let z2=a+0.6;z2<b-0.5;z2+=1.3,q++)pl('pad'+((q+(sg>0?3:0))%6),0.9,0.24,IX-sg*0.01,3.18,z2,iry); /* 窓上の紙の広告 */
            if(sg>0)for(let z2=a+0.9;z2<b-0.6;z2+=2.2,q++){put('pad'+(q%6),UNIT_PLANE,0,3.12,z2+0.003,0,0,0,0.6,0.42,1);put('pad'+((q+2)%6),UNIT_PLANE,0,3.12,z2-0.003,0,Math.PI,0,0.6,0.42,1);}}} /* 中吊り広告（表と裏に別々の広告） */
        for(const z of LY.poles)put('pole',new THREE.CylinderGeometry(0.02,0.02,2.26,8),sg*0.9,2.28,z);
        put('pole',new THREE.CylinderGeometry(0.015,0.015,LY.z1-LY.z0-0.1,6),sg*0.75,3.1,(LY.z0+LY.z1)/2,Math.PI/2,0,0);
        for(const z of LY.straps){box('iwall',0.012,0.2,0.012,sg*0.75,3.0,z);box('iwall',0.02,0.1,0.1,sg*0.75,2.86,z);}}
      else for(const dz of DOORZ)for(const k of [-1,1])put('ifloor',new THREE.CylinderGeometry(0.02,0.02,2.26,6),sg*0.9,2.28,dz+k*0.75);}}
  if(!staticDoors&&green&&flat){
    /* 特急の全車グリーン車：2階建てではなく全席1階（平屋）のグリーン席。
       ゆったりした4列シート・荷棚・読書灯・木目調の床で、普通車と同じ高さの1階に並べる。 */
    const FL=1.16,TOP=ITOP-0.03;
    put('ifloor',UNIT_PLANE,0,FL-0.01,0,-Math.PI/2,0,0,2.72,19.4,1);
    put('iwall',UNIT_PLANE,0,TOP,0,Math.PI/2,0,0,2.72,19.4,1);
    for(const x of [-0.55,0.55])put('ilight',UNIT_PLANE,x,TOP-0.05,0,Math.PI/2,0,0,0.14,18.0,1);
    for(let z=-5.9;z<=5.95;z+=1.05){
      for(const x of [-1.00,-0.52,0.52,1.00]){
        box('gseat',0.42,0.40,0.50,x,FL+0.22,z);
        put('gseat',boxGeo(0.40,0.66,0.11),x,FL+0.84,z+0.27,-0.12,0,0);
        box('gseat',0.38,0.16,0.13,x,FL+1.22,z+0.32);
        box('gseat',0.06,0.06,0.40,x+(x>0?0.24:-0.24),FL+0.56,z-0.02);
      }
      for(const sg of [-1,1])box('dark',0.03,0.26,0.05,sg*1.32,FL+1.42,z+0.3); /* 読書灯 */
    }
    for(const sg of [-1,1])box('grack',0.30,0.07,12.4,sg*1.22,2.62,0); /* 荷棚 */
    for(const z of [-6.9,6.9])for(const face of [0,Math.PI]){pl('iledF',0.42,0.26,0,FL+2.0,z+(face?-0.02:0.02),face);}
  }
  if(!staticDoors&&green&&!flat){ // 2階建て：下段・デッキ・上段
    const FD=GFLOOR.down,FU=GFLOOR.up,DK=GFLOOR.deck;
    box('gfloor',2.72,0.06,11.0,0,FD-0.03,0);box('gfloor',2.72,0.12,11.0,0,FU-0.06,0);
    for(const zz of [-7.8,7.8])box('gfloor',2.72,0.06,4.0,0,DK-0.03,zz);
    put('iwall',UNIT_PLANE,0,FU-0.13,0,Math.PI/2,0,0,2.64,10.8,1);                      // 下段の天井
    put('iwall',UNIT_PLANE,0,ITOP-0.03,0,Math.PI/2,0,0,2.64,10.8,1);                     // 上段の天井
    for(const zz of [-7.8,7.8])put('iwall',UNIT_PLANE,0,3.30,zz,Math.PI/2,0,0,2.64,3.8,1); // デッキの天井
    for(const x of [-0.42,0.42]){put('ilight',UNIT_PLANE,x,FU-0.15,0,Math.PI/2,0,0,0.1,10.2,1);put('ilight',UNIT_PLANE,x,ITOP-0.05,0,Math.PI/2,0,0,0.1,10.2,1);
      for(const zz of [-7.8,7.8])put('ilight',UNIT_PLANE,x,3.28,zz,Math.PI/2,0,0,0.1,3.4,1);}
    for(const s2 of GSEATS2){const y=GFLOOR[s2.fl];box('gseat',0.42,0.40,0.48,s2.x,y+0.22,s2.z);
      put('gseat',boxGeo(0.40,0.66,0.11),s2.x,y+0.80,s2.z+0.26,-0.12,0,0);box('gseat',0.38,0.16,0.13,s2.x,y+1.18,s2.z+0.31);
      box('gseat',0.06,0.06,0.4,s2.x+(s2.x>0?0.24:-0.24),y+0.55,s2.z-0.02);}
    for(const sgz of [-1,1]){                                                            // 階段（左が上り、右が下り）
      for(let i2=0;i2<9;i2++){const z=sgz*(5.35+i2*0.19),y=DK+(FU-DK)*(i2+1)/9;box('gfloor',1.12,0.06,0.21,-0.62,y,z);}
      for(let i2=0;i2<6;i2++){const z=sgz*(5.35+i2*0.19),y=DK-(DK-FD)*(i2+1)/6;box('gfloor',1.12,0.06,0.21,0.62,y,z);}
      box('iwall',0.06,1.9,1.9,0,(DK+FU)/2,sgz*6.1);
      for(const xx of [-1.2,1.2])box('iwall',0.06,1.0,1.6,xx,DK+0.5,sgz*5.95);}
    for(const z of [-6.85,6.85]){ /* デッキ：情報画面のみ（広告を削除） */
      for(const face of [0,Math.PI]){pl('iledF',0.42,0.26,0,DK+1.95,z+(face?-0.02:0.02),face);}}
    for(const z of [-3.0,3.0])for(const y of [FU+1.5,FD+1.62]){
      for(const face of [0,Math.PI]){pl('iledF',0.40,0.24,0,y,z+(face?-0.02:0.02),face);}}}
  if(!green){put('ifloor',UNIT_PLANE,0,1.16,0,-Math.PI/2,0,0,2.72,19.4,1);if(!staticDoors)put('iwall',UNIT_PLANE,0,3.41,0,Math.PI/2,0,0,2.72,19.4,1);
  const LY=salLayout(front,rear);
    if(!staticDoors){for(const x of [-0.5,0.5])put('ilight',UNIT_PLANE,x,3.40,(LY.z0+LY.z1)/2,Math.PI/2,0,0,0.12,LY.z1-LY.z0-0.9,1);}
    for(const z of [-9.68,9.68]){const cabSide=(z<0&&front)||(z>0&&rear);
      if(cabSide)put('iwall',UNIT_PLANE,0,(1.15+2.37)/2,z,0,z<0?0:Math.PI,0,2.72,1.22,1); /* 運転台の前は窓の下だけ壁（前面ガラスから外が見える＝前面展望） */
      else{put('iwall',UNIT_PLANE,0,2.28,z,0,z<0?0:Math.PI,0,2.72,2.26,1);
        if(!old&&!staticDoors){const wz=z+(z<0?0.04:-0.04),wry=z<0?0:Math.PI;
          pl('iledW',0.76,0.28,0,3.20,wz,wry);
          for(const sx of [-1,1])pl('iad',0.56,0.30,sx*0.86,2.60,wz,wry);}}}
    for(const [dir,cabE] of [[-1,front],[1,rear]]){const ZP=dir*(CARHALF-CABLEN);
      if(cabE){ /* 運転台：仕切り＋乗務員扉、机と運転席（客室の座席は置かない） */
        const rz=dir<0?0:Math.PI; /* 仕切り：腰から下と上は壁、目の高さは窓（客室から乗務員室と前面が見える） */
        put('iwall',UNIT_PLANE,0,1.48,ZP,0,rz,0,2.72,0.64,1);put('iwall',UNIT_PLANE,0,3.16,ZP,0,rz,0,2.72,0.5,1); /* 窓を大きく（1.8〜2.9m） */
        for(const sx of [-1,1]){put('iwall',UNIT_PLANE,sx*1.33,2.35,ZP,0,rz,0,0.06,1.1,1);put('glassC',UNIT_PLANE,sx*0.86,2.35,ZP-dir*0.01,0,rz,0,0.9,1.1,1);}
        box('door',0.8,1.85,0.05,0,2.125,ZP-dir*0.03);
        }
      else box('door',0.9,1.9,0.07,0,2.1,dir*9.67);}} /* 貫通扉 */
  if(!staticDoors&&green)for(const z of [-9.68,9.68])put('iwall',UNIT_PLANE,0,2.6,z,0,z<0?0:Math.PI,0,2.72,4.0,1);
  if(!green)box('dark',2.2,0.55,11,0,0.72,0);else box('dark',2.1,0.18,11,0,0.40,0);
  for(const bz of [-6.9,6.9]){box('dark',2.3,0.32,2.7,0,0.62,bz);for(const wx of [-0.73,0.73])for(const wz of [-1.05,1.05])put('dark',wheelGeo,wx,0.43,bz+wz,0,0,Math.PI/2);}
  box('body',1.7,0.28,3.4,0,(green?4.92:3.82),panto?4:0);
  if(panto){box('dark',1.2,0.15,1.6,0,(green?4.88:3.78),-5);
    const rod=(a,b,t)=>{const d=new THREE.Vector3().subVectors(b,a);const o=new THREE.Object3D();o.position.copy(a).addScaledVector(d,0.5);o.lookAt(b);o.updateMatrix();
      (parts.dark||(parts.dark=[])).push([boxGeo(t,t,d.length()),o.matrix.clone()]);};
    rod(new THREE.Vector3(0,3.86,-4.5),new THREE.Vector3(0,5.0,-5.8),0.07);rod(new THREE.Vector3(0,5.0,-5.8),new THREE.Vector3(0,6.2,-4.9),0.05);box('dark',1.7,0.06,0.25,0,6.24,-4.9);}
  const cabEnd=(dir,lit)=>{const z=dir*9.75,ry=dir<0?Math.PI:0;
    const gx=dir<0?0.66:-0.66;
    if(staticDoors&&old){box('face',2.82,2.75,0.16,0,2.36,z+dir*0.06);pl('black',2.66,1.1,0,2.92,z+dir*0.145,ry);pl('face',0.74,2.05,gx,2.3,z+dir*0.15,ry);pl('black',0.5,0.8,gx,2.88,z+dir*0.155,ry);}
    else{ /* 前面：新形は外から見ても前面ガラス・窓が透明で運転席・車内と完全一致 */
      put('body',capHole,0,0,z+dir*0.003,0,dir<0?Math.PI:0,0);
      if(staticDoors){box('iwall',2.72,1.22,0.06,0,1.76,z-dir*0.04);box('dark',2.2,0.48,0.45,0,2.08,z-dir*0.35);box('accent',0.55,0.22,0.04,-0.55,2.36,z-dir*0.38);}
      box('mask',2.78,0.84,0.15,0,1.95,z+dir*0.07);                    /* 窓の下（ライトバンド） */
      box('mask',2.78,0.36,0.15,0,3.50,z+dir*0.07);                    /* 窓の上（行先表示部） */
      box('mask',0.12,1.1,0.15,-1.34,2.86,z+dir*0.07);box('mask',0.12,1.1,0.15,1.34,2.86,z+dir*0.07);
      pl('glassF',2.66,0.98,0,2.85,z+dir*0.145,ry);                     /* 前面ガラス（大型ワンピース） */
      for(const sx of [-1,1])box('mask',0.09,0.95,0.03,sx*1.29,2.85,z+dir*0.135);
      pl('dest',1.42,0.24,0,3.50,z+dir*0.152,ry);                        /* フルカラーLCD行先表示 */
      /* ヘッドライト（横一文字LED）とテールライト */
      for(const sx of [-1,1]){pl(lit?'ledW':'lampOff',0.74,0.085,sx*0.98,2.16,z+dir*0.147,ry);
        if(lit)pl('ledGlow',0.92,0.2,sx*0.98,2.16,z+dir*0.144,ry);}
      for(const sx of [-1,1])pl(lit?'lampOff':'ledR',0.26,0.085,sx*0.98,1.70,z+dir*0.147,ry);
      pl('liv1',2.56,0.09,0,1.52,z+dir*0.146,ry);                       /* 前面の帯 */
      pl('accent',2.3,0.035,0,2.32,z+dir*0.146,ry);                     /* アクセントライン */
      box('mask',2.34,0.5,0.26,0,0.70,z+dir*0.15);                      /* スカート */
      box('dark',0.44,0.34,0.5,0,0.99,z+dir*0.33);                      /* 連結器カバー */
    }
    pl('liv1',2.8,0.12,0,2.1,z+dir*0.146,ry);};
  if(front)cabEnd(-1,true);else box('dark',1.1,2.2,0.5,0,2.2,-9.95);
  if(rear)cabEnd(1,false);else box('dark',1.1,2.2,0.5,0,2.2,9.95);
  const out={};for(const k in parts)out[k]=mergeGeos(parts[k]);TPL[key]=out;return out;
}
/* 古い形式の前面：幕式の行先表示（白地に黒文字） */
function drawDestRoll(k,txt){k.txt=txt;const x=k.x;x.fillStyle='#f3f1ea';x.fillRect(0,0,256,48);x.fillStyle='#16181c';x.font='700 26px '+FONT;x.textAlign='center';x.textBaseline='middle';fitText(x,txt||'',128,25,236,26,'700','center');x.strokeStyle='#8c887e';x.lineWidth=2;x.strokeRect(1,1,254,46);k.tex.needsUpdate=true;}
function drawOwnDest(){const nm=G.list?STATIONS[G.list[G.list.length-1]].name:'',kk=KIND[G.key]||'local',rp=kk==='rapid';
  /* v2.5.0：手動の方向幕（幕回し）が選ばれていればそれを優先。試運転・臨時・団体は専用幕 */
  if(G.rsManual){if(ownTrain.old)drawDestRoll(ownTrain.dk,G.rsManual);else drawDest(ownTrain.dk,G.rsManual);return;}
  if(G.isTest){const t=(BRANCH?'試運転　'+nm+'行':'試運転');if(ownTrain.old)drawDestRoll(ownTrain.dk,t);else drawDest(ownTrain.dk,t);return;}
  if(G.isCharter){const t='団体';if(ownTrain.old)drawDestRoll(ownTrain.dk,t);else drawDest(ownTrain.dk,t);return;}
  if(G.isExtra){const t='臨時 '+(TK[G.key]&&TK[G.key].dir>0?'外回り':'内回り');if(ownTrain.old)drawDestRoll(ownTrain.dk,t);else drawDest(ownTrain.dk,t);return;}
  if(!BRANCH){const lab=(SVCLOOK[G.key]?SVCLOOK[G.key][1]:'普通')+' '+(TK[G.key]&&TK[G.key].dir>0?'外回り':'内回り');
    if(ownTrain.old)drawDestRoll(ownTrain.dk,lab);else drawDest(ownTrain.dk,lab);return;}
  if(ownTrain.old)drawDestRoll(ownTrain.dk,'普通　'+nm);
  else{const pre=BRANCH?(rp?'快速 ':'普通 '):(kk==='ltd'?'快特 ':kk==='exp'?'特急 ':rp?'快速 ':'普通 ');
    drawDest(ownTrain.dk,pre+nm+(BRANCH?'行':''));}}
function drawDest(k,txt){k.txt=txt;const x=k.x;x.fillStyle='#050403';x.fillRect(0,0,256,48);
  /* v2.5.0：方向幕をはっきり読めるように（自動縮小の太字） */
  x.fillStyle='#ff9d2e';x.font='700 30px '+DOTF;x.textAlign='center';x.textBaseline='middle';
  try{fitText(x,String(txt||''),128,25,240,30,'700','center');}catch(e){x.fillText(txt,128,25);}
  k.tex.needsUpdate=true;}
const glowTex=canvasTex(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.25,'rgba(255,255,255,0.6)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
const poolTex=canvasTex(64,128,(x,w,h)=>{const g=x.createRadialGradient(32,110,4,32,80,70);g.addColorStop(0,'rgba(255,248,225,0.9)');g.addColorStop(1,'rgba(255,248,225,0)');x.fillStyle=g;x.fillRect(0,0,w,h);});
const GLOW={head:new THREE.SpriteMaterial({map:glowTex,color:0xfff4dc,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.6}),
  tail:new THREE.SpriteMaterial({map:glowTex,color:0xff2a1a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.6}),
  pool:new THREE.MeshBasicMaterial({map:poolTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0,side:DS})};
function addLights(tr){const lg=[];const f=tr.cars[0],r=tr.cars[tr.cars.length-1];
  for(const sx of [-1,1]){const h=new THREE.Sprite(GLOW.head);h.scale.set(1.5,1.5,1);h.position.set(sx*1.0,1.72,-9.98);f.add(h);lg.push(h);
    const t=new THREE.Sprite(GLOW.tail);t.scale.set(0.8,0.8,1);t.position.set(sx*0.7,1.72,9.98);r.add(t);lg.push(t);}
  const pool=new THREE.Mesh(UNIT_PLANE,GLOW.pool);pool.scale.set(3.4,26,1);pool.rotation.x=-Math.PI/2;pool.position.set(0,0.56,-23);f.add(pool);lg.push(pool);tr.lights=lg;}
function buildTrain(dest,flip,liv,withDoors,greenCars,nCar,oldOv,flatGreen){const GC=greenCars||[],NC=nCar||NCAR,old=oldOv!==undefined?(oldOv&&withDoors):(BRANCH&&withDoors); /* 支線の電車は古い形式（天宮支線は一部が本線と同じ電車） */
  const c1=new THREE.Color(liv),c2=c1.clone().lerp(new THREE.Color(0xffffff),0.45);
  const mats={liv1:new THREE.MeshLambertMaterial({color:c1,side:DS}),liv2:new THREE.MeshLambertMaterial({color:c2,side:DS}),dest:null};const dk=mkCanvas(256,48);drawDest(dk,dest);mats.dest=new THREE.MeshBasicMaterial({map:dk.tex,side:DS});if(old){mats.body=OLDBODY;mats.iwall=OLDI.iwall;mats.iseat=OLDI.iseat;mats.ifloor=OLDI.ifloor;drawDestRoll(dk,dest);}
  const grp=new THREE.Group(),cars=[],leds=[];
  const gm={};
  for(let k=0;k<NC;k++){const gr=GC.indexOf(k)>=0,tpl=carTemplate(k===0,k===NC-1,k%3===1,!withDoors,gr,old,flatGreen&&gr);const g=new THREE.Group();g.rotation.order='YXZ';g.userData.green=gr;g.userData.gflat=!!(flatGreen&&gr);g.userData.cabF=k===0;g.userData.cabR=k===NC-1;
    const mm=gr?Object.assign({},mats,gm):mats;for(const key in tpl)g.add(new THREE.Mesh(tpl[key],mm[key]||TM[key]));
    g.userData.doors={'-1':[],'1':[]};
    if(withDoors)for(const sg of [-1,1])for(const dz of (gr?GDOORZ:DOORZ))for(const k of [-1,1]){const m=new THREE.Mesh(leafGeo,TM.door);m.position.set(sg*1.42,2.125,dz+k*0.35);g.add(m);g.userData.doors[sg].push({g:m,base:dz,k});}
    if(withDoors){const lm=new THREE.Mesh(sledGeo(gr,old),SLED_OFF);g.add(lm);leds.push(lm);}
    cars.push(g);grp.add(g);}
  scene.add(grp);const tr={grp,cars,flip,mats,dk,green:GC.slice(),lastFrac:-1,lastSide:0,leds,sled:null,old};addLights(tr);return tr;
}
function disposeTrain(tr){
  if(!tr)return;
  try{if(tr.sled){if(tr.leds)for(const m of tr.leds)m.material=SLED_OFF;tr.sled.tr=null;tr.sled=null;}}catch(e){}
  try{if(typeof CABATT!=='undefined'&&CABATT.has(tr)){const gs=CABATT.get(tr);for(const g of gs){if(g.parent)g.parent.remove(g);CABPOOL.push(g);}CABATT.delete(tr);}}catch(e){}
  try{if(tr.grp&&tr.grp.parent)tr.grp.parent.remove(tr.grp);}catch(e){}
  try{if(tr.nameplate&&tr.nameplate.material){if(tr.nameplate.material.map)tr.nameplate.material.map.dispose();tr.nameplate.material.dispose();}}catch(e){}
  try{if(tr.dk&&tr.dk.tex&&!SHARED.has(tr.dk.tex))tr.dk.tex.dispose();}catch(e){}
  try{
    if(tr.mats){for(const k in tr.mats){const m=tr.mats[k];if(m&&m.dispose&&m!==OLDBODY&&m!==OLDI.iwall&&m!==OLDI.iseat&&m!==OLDI.ifloor){if(m.map&&!SHARED.has(m.map))m.map.dispose();m.dispose();}}}
  }catch(e){}
}
function trackPt(s,offFn){const p=P(s),o=offFn(s);return [p[0]+Math.cos(p[2])*o,p[1]+Math.sin(p[2])*o];}
// each car spans a 20.2 m chord of its own track, so couplings stay closed on curves and diverging tracks
function trSgn(tr){return (tr.flip?-1:1)*(tr.rev?-1:1);} /* 車両の左右の向き（折り返しで編成の向きが逆になる） */
function placeTrain(tr,frontS,offFn,yFn){
  yFn=yFn||Yat;const dir=tr.flip?1:-1;let sf=frontS-dir*(CARL/2-CARHALF),pf=trackPt(sf,offFn),yf=yFn(sf);
  for(let k=0;k<tr.cars.length;k++){let ds=CARL,sr=sf+dir*ds,pr=trackPt(sr,offFn);
    for(let it=0;it<4;it++){const d=Math.hypot(pr[0]-pf[0],pr[1]-pf[1]);if(d<1e-6||Math.abs(d-CARL)<0.003)break;ds*=CARL/d;sr=sf+dir*ds;pr=trackPt(sr,offFn);}
    const yr=yFn(sr),car=tr.cars[k];car.position.set((pf[0]+pr[0])/2,(yf+yr)/2,(pf[1]+pr[1])/2);
    car.rotation.set(Math.atan2(yf-yr,CARL)*(tr.rev?-1:1),-Math.atan2(pf[0]-pr[0],-(pf[1]-pr[1]))+(tr.rev?Math.PI:0),0); /* 折り返し後は車両を逆向きに（最後尾だった車両が先頭） */
    sf=sr;pf=pr;yf=yr;}
}
function setDoors(tr,worldSide,frac){
  if(tr.lastFrac===frac&&tr.lastSide===worldSide)return;tr.lastFrac=frac;tr.lastSide=worldSide;const ls=worldSide*trSgn(tr);
  for(const car of tr.cars)for(const sg of [-1,1]){const f=sg===ls?frac:0;for(const d of car.userData.doors[sg])d.g.position.z=d.base+d.k*(0.35+f*0.62);}
}
const SVCLOOK={A:[0x14935f,'普通'],B:[0x14935f,'普通'],C:[0xe8731e,'快速'],D:[0xe8731e,'快速'],E:[0xc8322b,'快速特急'],F:[0xc8322b,'快速特急'],G:[0x1f5fbf,'特急'],H:[0x1f5fbf,'特急'],I:[0x14935f,'臨時'],J:[0x14935f,'臨時']};
const OWNK=(SERVICES[SVC]&&SERVICES[SVC].key)||'A',OWNCARS=BRANCH?NCAR:(NCARS[OWNK]||NCAR);
const GREENCARS=(SERVICES[SVC]&&SERVICES[SVC].kind==='ltd')?[3,4]:(SERVICES[SVC]&&SERVICES[SVC].kind==='exp')?Array.from({length:OWNCARS},(_,i)=>i):[];
const GREENFLAT=!!(SERVICES[SVC]&&SERVICES[SVC].kind==='exp');
let ownTrain=buildTrain('普通',false,0x14935f,true,GREENCARS,OWNCARS,BRANCH?OWNOLD:undefined,GREENFLAT);ownTrain.grp.traverse(o=>o.layers.set(1));
const cityTrains=[0,1,2,3].map(j=>buildTrain('',j%2===1,0x1f5fbf,false));
const followT=buildTrain('普通',false,0x14935f,true,undefined,undefined,B3?false:undefined);
const depotTrains=[];for(let j=1;j<DEPOT.n;j+=2){const tr=buildTrain('回送',false,[0x14935f,0xe8731e,0xc8322b][j%3],false);placeTrain(tr,DEPOT.b-40-(j%4)*30,yardOff(j));tr.lights.forEach(l=>l.visible=false);depotTrains.push(tr);}
/* shinkansen train (8 cars, streamlined nose) */
function buildShinTrain(){const grp=new THREE.Group(),cars=[];const wm=new THREE.MeshPhongMaterial({color:0xf4f6f8,shininess:70}),bl=new THREE.MeshLambertMaterial({color:0x1f4fa0,side:DS}),gl=new THREE.MeshPhongMaterial({color:0x121820,shininess:90,side:DS});
  for(let k=0;k<8;k++){const g=new THREE.Group();g.rotation.order='YXZ';const len=k===0||k===7?27:25;
    const body=new THREE.Mesh(boxGeo(3.38,3.4,len),wm);body.position.y=2.4;g.add(body);
    for(const sx of [-1,1]){const st=new THREE.Mesh(UNIT_PLANE,bl);st.scale.set(len,0.25,1);st.position.set(sx*1.7,1.65,0);st.rotation.y=sx*Math.PI/2;g.add(st);
      const wb=new THREE.Mesh(UNIT_PLANE,gl);wb.scale.set(len-2,0.55,1);wb.position.set(sx*1.695,2.75,0);wb.rotation.y=sx*Math.PI/2;g.add(wb);}
    if(k===0||k===7){const dz=k===0?-1:1;const nose=new THREE.Mesh(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI/2),wm);nose.scale.set(1.69,1.65,9);nose.rotation.x=dz<0?-Math.PI/2:Math.PI/2;nose.position.set(0,2.1,dz*len/2);g.add(nose);
      const h=new THREE.Sprite(GLOW.head);h.scale.set(1.2,1.2,1);h.position.set(0,1.5,dz*(len/2+7.5));g.add(h);}
    cars.push({g,len});grp.add(g);}
  grp.visible=false;scene.add(grp);return {grp,cars};}
const shinTrains=[buildShinTrain(),buildShinTrain()];
/* ================= people ================= */
const PCOL=[0x2f3b52,0x6b3a3a,0x3f5a45,0xc9c2b0,0x23262b,0x7a6a4f,0x50607a,0x8a3f5f,0xd8d3c4,0x3a5f8a,0x9a8f7a];
const SKIN=[0xe8c49a,0xe0b894,0xd6a87c,0xc59468,0xf0d3b4];
const HAIRC=[0x1d1a18,0x2b211c,0x3a2b20,0x5a4a3a,0x8a7a68];
const LEGC=[0x23262b,0x2f3b52,0x4a4a4a,0x5a4b3a,0x1d2230];
const SKIRTC=[0xc4456b,0x3f63b0,0x7a3fa0,0x2f7f5f,0xd9702b,0x3d4450,0xb03040];
const legGeo=boxGeo(0.13,0.82,0.15);legGeo.translate(0,-0.41,0);
const legMats=LEGC.map(c=>lam(c));
function colored(parts){const g=mergeGeos(parts.map(p=>[p[0],p[1]]));const n=g.attributes.position.count,ca=new Float32Array(n*3);let o=0;
  for(const p of parts){const cnt=(p[0].index?p[0].index.count:p[0].attributes.position.count);const cc=new THREE.Color(p[2]);
    for(let i=0;i<cnt;i++){ca[(o+i)*3]=cc.r;ca[(o+i)*3+1]=cc.g;ca[(o+i)*3+2]=cc.b;}o+=cnt;}
  g.setAttribute('color',new THREE.BufferAttribute(ca,3));return g;}
// every variant is a different person: build, clothes, hair and face come from the variant number
const LIPC=[0xc2566b,0xb8455c,0xd06a78,0xa8455a];
const BOYSKIRT=[0x27384f,0x2f3b2f,0x3a3a42,0x4a3326,0x1f2c3d];      // 男の子：濃い色の短いスカート
const GIRLSKIRT=[0xc4456b,0x7a3fa0,0xd9702b,0x2f7f5f,0x3f63b0,0xb03040,0xe08cb0,0xf0c8d8,0x9ec7e8,0xe8d27a,0x2b3a5c,0x6a2b3a,0xf2efe6];
const KIDTYPE_G=[1,2,3,4,6,7,8,9,10,12,13,0,11,3,8,4,6,2],KIDTYPE_B=[5,11,1,4,7,10,0,13,5,11,1,4,10,7,5,11,13,0]; /* 女の子・男の子でよくある形 */
const DENIMC=[0x3b5b8c,0x2c4468,0x5a7aa8],PASTEL=[0xf6d1de,0xd9c6f0,0xc9e6f2,0xf7ecc4,0xffffff];
const SOCKC=[0xf4f2ec,0xf4f2ec,0x1b2740,0x2a2a2a,0x8a8f99],SHOEC=[0x2a2a2a,0xc8322b,0x3f63b0,0xf2f2f2,0xe08cb0,0x6b4a2e,0x2f7f5f];
/* スカートの形：ウエストから裾へ広がり、折り目（プリーツ）や波打つ裾も作れる */
function skirtGeo(r0,r1,h,yTop,o){o=o||{};const seg=o.seg||32,g=new THREE.CylinderGeometry(1,1,h,seg,o.hs||5,true),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),yy=p.getY(i),z=p.getZ(i),f=Math.min(1,Math.max(0,(h/2-yy)/h)),th=Math.atan2(x,z);
    let r=r0+(r1-r0)*Math.pow(f,o.curve||1);
    if(o.pleat)r*=1+o.pleat*(0.3+0.7*f)*(Math.abs(Math.sin(th*o.folds))-0.5);   // 折り目（裾ほど深い）
    if(o.wave)r*=1+o.wave*f*f*Math.sin(th*o.waves+(o.ph||0));                 // 波打つ裾
    p.setXYZ(i,Math.sin(th)*r,yTop-h/2+yy,Math.cos(th)*r);}
  g.computeVertexNormals();return g;}
/* スカートの柄：横の帯・縦の線（チェック・ボーダーなど） */
function ringAt(add,r,y,hh,col){add(new THREE.CylinderGeometry(r,r,hh,32,1,true),0,y,0,col);}
function stripesOn(add,n,r0,r1,yTop,h,w,col,off){for(let i=0;i<n;i++){const an=(i+(off||0))/n*Math.PI*2,rm=(r0+r1)/2*1.04,tilt=Math.atan2(r1-r0,h);
  add(boxGeo(w,h*0.96,0.006),Math.sin(an)*rm,yTop-h/2,Math.cos(an)*rm,col,-tilt*Math.cos(an),tilt*Math.sin(an),an);}}
const SKIRT_NAMES=['タイト','プリーツ','ティアード','フレア','チェックのプリーツ','キルト','ジャンパースカート','デニム','チュール','ラップ','サスペンダー付き','キュロット','裾フリル','ボーダー'];
/* 座ったときのスカート：腰まわり＋太ももの上にかぶさる部分＋ひざ先と両脇に少し垂れる部分。形ごとの柄や広がりも */
function skirtSit(D,add){const t=D.skirtType,c=D.skirtC,c2=D.skirtPleatC,h=D.skirtH,wy=D.child?0.985:0.93,r0=D.child?0.168:0.185,r1=D.skirtBot;
  const flare=t===3||t===8||t===2||t===12?1:t===0?0:0.5,W=0.36+flare*0.12+(r1-0.26)*0.4,L=clamp(h*1.25,0.2,0.47),TY=0.905,hd=clamp(h-L*0.75,0.04,0.2);
  add(skirtGeo(r0,r0*1.1,Math.max(0.04,wy-TY),wy,{}),0,0,0,c);ringAt(add,r0*1.04,wy-0.02,0.05,c2);                                   /* 腰まわり */
  if(t===11){for(const sx of [-1,1])add(boxGeo(0.17,0.17,L),sx*0.095,0.82,L/2,c);return;}                                            /* キュロット：太ももを包む */
  add(boxGeo(W,0.045,L),0,TY,L/2-0.02,c);                                                                                             /* 太ももの上 */
  add(boxGeo(W,hd,0.035),0,TY-hd/2,L-0.02,c);                                                                                         /* ひざ先に垂れる */
  for(const sx of [-1,1])add(boxGeo(0.035,0.12+flare*0.06,L),sx*W/2,TY-0.06-flare*0.03,L/2-0.02,c);                                  /* 両脇に垂れる */
  if(flare===1){const n=7;for(let k=0;k<n;k++){const x=-W/2+W*(k+0.5)/n,dz=(k%2?0.02:-0.01);add(boxGeo(W/n*0.9,0.03,0.05),x,TY-hd+0.01,L-0.02+dz,t===12?c2:c);}} /* 波打つ裾・フリル */
  if(t===1||t===4||t===5||t===10){for(let k=1;k<6;k++)add(boxGeo(0.006,0.003,L*0.96),-W/2+W*k/6,TY+0.024,L/2-0.02,t===4||t===5?c2:0x000000);} /* プリーツ・チェックの線 */
  if(t===4||t===5||t===13){for(const f of [0.3,0.65])add(boxGeo(W*0.98,0.003,0.02),0,TY+0.025,L*f,t===13?0xf4f2ec:c2);}             /* チェック・ボーダーの横線 */
  if(t===8)add(boxGeo(W+0.08,0.03,L*0.92),0,TY+0.03,L/2-0.03,c2);                                                                     /* チュールの重ね */
  if(t===7){add(boxGeo(0.006,0.003,L),0,TY+0.024,L/2-0.02,0xc9a24a);}                                                               /* デニムの縫い目 */
  if(t===6){add(boxGeo(0.2,0.2,0.012),0,wy+0.13,0.112,c);for(const sx of [-1,1]){add(boxGeo(0.045,0.36,0.012),sx*0.08,wy+0.32,0.108,c);add(boxGeo(0.045,0.42,0.012),sx*0.07,wy+0.24,-0.112,c);
      add(boxGeo(0.045,0.05,0.24),sx*0.085,wy+0.5,0,c);add(boxGeo(0.022,0.022,0.01),sx*0.08,wy+0.2,0.122,0xf2efe6);}}                 /* ジャンパースカートの胸当て */
  if(t===10){for(const sx of [-1,1]){add(boxGeo(0.032,0.5,0.01),sx*0.08,wy+0.26,0.11,c2);add(boxGeo(0.032,0.52,0.01),sx*0.04,wy+0.24,-0.11,c2,0,sx*0.32);add(boxGeo(0.032,0.032,0.22),sx*0.08,wy+0.5,0,c2);}}
  if(t===5)add(boxGeo(0.012,0.05,0.016),W*0.3,TY+0.02,L*0.6,0xd6d2c8);}                                                               /* キルトのピン */
function skirtParts(D,add){const t=D.skirtType,c=D.skirtC,c2=D.skirtPleatC,h=D.skirtH,wy=D.child?0.985:0.93,r0=D.child?0.168:0.185,r1=D.skirtBot,belt=()=>ringAt(add,r0*1.04,wy-0.02,0.05,c2);
  if(t===0){add(skirtGeo(r0,r0*1.18,h,wy,{curve:1.2}),0,0,0,c);add(boxGeo(0.004,h*0.35,0.01),0,wy-h*0.8,-r0*1.15,0x101010);belt();}                       // タイト（後ろにスリット）
  else if(t===1){add(skirtGeo(r0,r1,h,wy,{pleat:0.14,folds:12}),0,0,0,c);belt();}                                                                          // プリーツ
  else if(t===2){add(skirtGeo(r0,r1*0.82,h*0.38,wy,{wave:0.04,waves:9}),0,0,0,c);add(skirtGeo(r1*0.78,r1*0.98,h*0.36,wy-h*0.32,{wave:0.05,waves:10,ph:1}),0,0,0,c);
    add(skirtGeo(r1*0.94,r1*1.16,h*0.36,wy-h*0.62,{wave:0.07,waves:11,ph:2}),0,0,0,c);belt();}                                                             // ティアード（3段）
  else if(t===3){add(skirtGeo(r0,r1*1.28,h,wy,{curve:0.65,wave:0.10,waves:7}),0,0,0,c);belt();}                                                            // フレア（波打つ裾）
  else if(t===4){add(skirtGeo(r0,r1,h,wy,{pleat:0.13,folds:14}),0,0,0,c);                                                                                  // チェックのプリーツ（制服風）
    for(const fy of [0.3,0.62,0.9])ringAt(add,r0+(r1-r0)*fy*1.02,wy-h*fy,0.022,c2);stripesOn(add,10,r0,r1,wy,h,0.018,c2);stripesOn(add,10,r0,r1,wy,h,0.006,0xf2efe6,0.5);belt();}
  else if(t===5){add(skirtGeo(r0,r1*1.04,h,wy,{pleat:0.07,folds:18}),0,0,0,c);                                                                            // キルト（タータン＋前のエプロン＋留めピン）
    for(const fy of [0.25,0.55,0.85])ringAt(add,r0+(r1-r0)*fy*1.03,wy-h*fy,0.026,c2);stripesOn(add,12,r0,r1,wy,h,0.022,c2);stripesOn(add,12,r0,r1,wy,h,0.006,0xd8c25a,0.5);
    add(boxGeo(r1*1.05,h*0.94,0.012),0.03,wy-h*0.49,r1*0.98,c,-0.12);add(boxGeo(0.012,0.05,0.016),r1*0.42,wy-h*0.7,r1*1.02,0xd6d2c8,-0.12);
    add(boxGeo(0.03,0.05,0.03),-r0*1.02,wy-0.04,0,0x3a2a1a);ringAt(add,r0*1.05,wy-0.02,0.045,0x3a2a1a);}
  else if(t===6){add(skirtGeo(r0,r1*1.05,h,wy,{curve:0.9,pleat:0.05,folds:8}),0,0,0,c);                                                                    // ジャンパースカート（胸当て＋肩ひも＋ボタン）
    add(boxGeo(0.2,0.2,0.012),0,wy+0.13,0.112,c);for(const sx of [-1,1]){add(boxGeo(0.045,0.36,0.012),sx*0.08,wy+0.32,0.108,c);add(boxGeo(0.045,0.42,0.012),sx*0.07,wy+0.24,-0.112,c);
      add(boxGeo(0.045,0.05,0.24),sx*0.085,wy+0.5,0,c);add(boxGeo(0.022,0.022,0.01),sx*0.08,wy+0.2,0.122,0xf2efe6);}}
  else if(t===7){add(skirtGeo(r0,r1*1.03,h,wy,{curve:1.1}),0,0,0,c);add(boxGeo(0.006,h*0.95,0.008),0,wy-h*0.48,r0+(r1-r0)*0.5+0.005,0xc9a24a);             // デニム（前の縫い目・ポケット・裾のステッチ）
    for(const sx of [-1,1])add(boxGeo(0.07,0.07,0.008),sx*0.085,wy-0.1,r0*1.02,0x2f4a74);ringAt(add,r1*1.005,wy-h+0.03,0.008,0xc9a24a);belt();}
  else if(t===8){add(skirtGeo(r0,r1*1.06,h,wy),0,0,0,c);add(skirtGeo(r0*1.02,r1*1.32,h*0.94,wy,{curve:0.6,wave:0.12,waves:13}),0,0,0,c2);                  // チュール（ふんわり重ね）
    add(skirtGeo(r0*1.03,r1*1.45,h*0.8,wy,{curve:0.55,wave:0.14,waves:9,ph:1.3}),0,0,0,c2);belt();}
  else if(t===9){add(skirtGeo(r0,r1*1.08,h,wy,{curve:0.9}),0,0,0,c);add(boxGeo(r1*0.9,h*0.95,0.01),r1*0.18,wy-h*0.48,r1*0.92,c,-0.1,0.28);                  // ラップ（斜めに重ねてボタン留め）
    add(boxGeo(0.024,0.024,0.01),r1*0.5,wy-0.06,r0*1.12,c2);add(boxGeo(0.024,0.024,0.01),r1*0.42,wy-0.16,r0*1.2,c2);belt();}
  else if(t===10){add(skirtGeo(r0,r1,h,wy,{pleat:0.1,folds:10}),0,0,0,c);                                                                                  // サスペンダー付き（背中でクロス）
    for(const sx of [-1,1]){add(boxGeo(0.032,0.5,0.01),sx*0.08,wy+0.26,0.11,c2);add(boxGeo(0.032,0.52,0.01),sx*0.04,wy+0.24,-0.11,c2,0,sx*0.32);add(boxGeo(0.032,0.032,0.22),sx*0.08,wy+0.5,0,c2);
      add(boxGeo(0.02,0.02,0.01),sx*0.08,wy+0.02,0.12,0xd6d2c8);}belt();}
  else if(t===11){for(const sx of [-1,1])add(skirtGeo(r0*0.56,r1*0.62,h,wy-0.02,{curve:0.9,pleat:0.06,folds:6}),sx*0.075,0,0,c);                              // キュロット（すそが広いズボン型）
    add(skirtGeo(r0,r0*1.06,0.1,wy),0,0,0,c);belt();}
  else if(t===12){add(skirtGeo(r0,r1,h*0.78,wy,{curve:0.9}),0,0,0,c);add(skirtGeo(r1*0.97,r1*1.22,h*0.3,wy-h*0.72,{wave:0.12,waves:16}),0,0,0,c2);belt();}    // 裾フリル
  else{add(skirtGeo(r0,r1*1.06,h,wy,{curve:0.9}),0,0,0,c);for(let k2=1;k2<5;k2++){const fy=k2/5;ringAt(add,(r0+(r1*1.06-r0)*fy)*1.01,wy-h*fy,0.03,c2);}belt();}   // ボーダー
}
function vdef(vi,child){let rs=(vi*7919+(child?104729:15485863))>>>0;const rnd=()=>{rs=(rs*1103515245+12345)>>>0;return (rs>>>8)/16777216;};
  const female=vi%2===1,col=PCOL[Math.floor(rnd()*PCOL.length)],skin=SKIN[Math.floor(rnd()*SKIN.length)],hair=HAIRC[Math.floor(rnd()*HAIRC.length)],
    leg=LEGC[Math.floor(rnd()*LEGC.length)],sk=SKIRTC[Math.floor(rnd()*SKIRTC.length)];
  const r1=rnd();const style=child?'skirt':(r1<(female?0.18:0.3)?'shorts':'long');
  const skirtType=Math.floor(rnd()*7),girlish=child?female:female;
  const skirtC=child?(female?GIRLSKIRT[Math.floor(rnd()*GIRLSKIRT.length)]:BOYSKIRT[Math.floor(rnd()*BOYSKIRT.length)])
    :(rnd()<0.5?col:SKIRTC[Math.floor(rnd()*SKIRTC.length)]);
  const skirtH=child?(female?0.30:0.22):(0.30+rnd()*0.22),skirtBot=child?(female?0.33:0.23):(skirtType===0?0.21:0.24+rnd()*0.1);
  /* 子ども：形ごとにそれらしい色・長さ */
  const kt=child?(female?KIDTYPE_G:KIDTYPE_B)[(vi>>1)%18]:skirtType;let kc=skirtC,kc2=child&&!female?0x1a2230:(female?0xf2eee6:0x2a2a2a),kh=skirtH,kb=skirtBot;
  if(child){const pick=a=>a[Math.floor(rnd()*a.length)];
    if(kt===7){kc=pick(DENIMC);kc2=0x2f4a74;}else if(kt===8){kc=pick(PASTEL);kc2=pick(PASTEL);}else if(kt===4||kt===5){kc=female?pick([0x3a4a6a,0x7a2b3a,0x2f5a3f,0x8a6a3a]):pick([0x2b3a5c,0x2f5a3f,0x5a2b2b,0x3a3a42]);kc2=pick([0x15181f,0x1f3a2a,0x3a1f1f,0xd8c25a]);}
    else if(kt===13){kc2=0xf4f2ec;}else if(kt===12){kc2=0xf4f2ec;}else if(kt===10||kt===9){kc2=female?pick([0xf4f2ec,0x2b3a5c,0x8a3f5f]):pick([0x3a2a1a,0x15181f]);}
    kh=(female?0.25:0.22)+rnd()*0.13+(kt===6||kt===8?0.04:0)+(kt===11?-0.02:0);kb=(kt===0?0.2:kt===3||kt===8?0.3:kt===11?0.26:0.26)+rnd()*0.06;}
  const sock=child?Math.floor(rnd()*5):0,sockC=SOCKC[Math.floor(rnd()*SOCKC.length)],shoeC=child?SHOEC[Math.floor(rnd()*SHOEC.length)]:0x2a2a2a;
  return {female,child,col,skin,hair,leg,sk,style,skirtType:kt,skirtC:kc,skirtH:kh,skirtBot:kb,sock,sockC,shoeC,
    skirtPleatC:kc2,
    shoulder:child?0.32:(female?0.36:0.43),torso:child?0.31:(female?0.33:0.38),
    hairLong:child?female:(female?rnd()<0.8:rnd()<0.12),tails:child&&female,
    eyeGap:0.040+rnd()*0.016,eyeW:0.028+rnd()*0.014,eyeH:(child?0.026:0.018)+rnd()*0.012,
    browY:0.035+rnd()*0.014,browTilt:(rnd()-0.5)*0.5,browW:(female?0.034:0.044)+rnd()*0.012,browH:female?0.008:0.013,
    mouthW:0.045+rnd()*0.03,lips:female&&rnd()<0.7,lipC:LIPC[Math.floor(rnd()*LIPC.length)],
    glasses:!child&&rnd()<0.22,beard:!female&&!child&&rnd()<0.18,bare:rnd()<0.3,
    bag:child?(rnd()<0.55?2:0):[0,0,1,2,3][Math.floor(rnd()*5)],bagC:[0x3a3f4a,0x6b4a2e,0x8a2f3f,0x2f4f6b,0x4a4a4a,0xb0a58c][Math.floor(rnd()*6)],
    fringe:child||female||rnd()<0.5,headScale:child?1.16:(female?0.98:1.02),
    dev:(()=>{const r=rnd();return child?(r<0.15?2:r<0.27?1:0):(r<0.32?1:r<0.40?2:0);})()};} /* 1=スマホ 2=タブレット */
const VD=[],VDC=[];
function styleOf(vi,child){return (child?VDC:VD)[vi].style;}
function faceParts(D,add){const S=D.headScale,hy=1.63,fz=0.104*S;
  const dark=0x15130f,white=0xf7f3ee;
  for(const sgn of [-1,1]){
    add(boxGeo(D.eyeW*S+0.012,D.eyeH*S+0.008,0.02),sgn*D.eyeGap*S,hy+0.018,fz-0.012,white);
    add(boxGeo(D.eyeW*S*0.55,D.eyeH*S,0.02),sgn*D.eyeGap*S,hy+0.018,fz-0.004,dark);
    add(boxGeo(D.browW*S,D.browH*S,0.018),sgn*D.eyeGap*S,hy+D.browY*S,fz-0.008,D.hair,0,sgn*D.browTilt);
    if(D.female)add(boxGeo(D.eyeW*S+0.014,0.006,0.018),sgn*D.eyeGap*S,hy+0.018+D.eyeH*S*0.6,fz-0.004,dark);}
  add(boxGeo(0.022*S,0.032*S,0.03),0,hy-0.012,fz,D.skin);
  add(boxGeo(D.mouthW*S,D.lips?0.016:0.010,0.018),0,hy-0.062*S,fz-0.006,D.lips?D.lipC:0x8a4a44);
  if(D.child)for(const sgn of [-1,1])add(boxGeo(0.034,0.02,0.015),sgn*0.072*S,hy-0.03,fz-0.02,0xe9917f);
  if(D.beard)add(boxGeo(0.085*S,0.03,0.018),0,hy-0.092*S,fz-0.012,D.hair);
  if(D.glasses){for(const sgn of [-1,1]){add(boxGeo(D.eyeW*S+0.026,0.004,0.016),sgn*D.eyeGap*S,hy+0.018+D.eyeH*S*0.9,fz,0x2b2b2b);
      add(boxGeo(D.eyeW*S+0.026,0.004,0.016),sgn*D.eyeGap*S,hy+0.018-D.eyeH*S*0.9,fz,0x2b2b2b);
      add(boxGeo(0.004,D.eyeH*S*1.8,0.016),sgn*(D.eyeGap*S+D.eyeW*S*0.5+0.013),hy+0.018,fz,0x2b2b2b);}
    add(boxGeo(0.02,0.004,0.014),0,hy+0.018,fz,0x2b2b2b);}}
function partsOf(vi,child,pose,staff){const D=(child?VDC:VD)[vi],style=staff?'long':D.style,col=staff?0x1b2740:D.col,skin=D.skin,hair=D.hair,leg=staff?0x1b2740:D.leg,sk=D.sk;
  const P=[],add=(g,x,y,z,c,rx,rz,ry)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx||0,ry||0,rz||0);dummy.scale.set(1,1,1);dummy.updateMatrix();P.push([g,dummy.matrix.clone(),c]);};
  add(boxGeo(D.torso*0.92,0.26,0.20),0,0.97,0,style==='skirt'?col:leg);      // hips
  add(boxGeo(D.torso,0.52,0.21),0,1.16,0,col);                               // torso
  add(boxGeo(D.shoulder,0.12,0.23),0,1.40,0,col);                            // shoulders
  const bare=D.bare,ax=D.shoulder/2+0.045;
  const dv=(D.dev&&pose!=='strap')?D.dev:0; /* スマホ・タブレットを両手で持って見ている */
  if(dv){ /* 肩→ひじ→手を、つながった腕で作る（ひじを曲げて胸の前で持つ） */
    const seg=(a,b,t,c)=>{const len=a.distanceTo(b),g=new THREE.BoxGeometry(t,t,len+t*0.6),m=new THREE.Matrix4().lookAt(a,b,new THREE.Vector3(0,1,0));m.setPosition((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);g.applyMatrix4(m);add(g,0,0,0,c);};
    const hx=dv===1?0.045:0.125,hy=dv===1?1.13:1.11,hz=dv===1?0.25:0.23;
    for(const sx of [-1,1]){const S=new THREE.Vector3(sx*ax,1.38,0.0),E=new THREE.Vector3(sx*(ax-0.02),1.12,0.06),H=new THREE.Vector3(sx*hx,hy,hz);
      if(bare){const M=S.clone().lerp(E,0.5);seg(S,M,0.088,col);seg(M,E,0.078,skin);seg(E,H,0.072,skin);}
      else{seg(S,E,0.088,col);const W2=E.clone().lerp(H,0.82);seg(E,W2,0.08,col);seg(W2,H,0.066,skin);}
      add(boxGeo(0.055,0.075,0.09),sx*(hx+0.006),hy+0.01,hz+0.025,skin,0.5);}                       /* 手（端末の横をにぎる） */
    if(dv===1){add(boxGeo(0.075,0.15,0.012),0,1.17,0.285,0x1a1c20,0.75);add(boxGeo(0.064,0.13,0.004),0,1.1734,0.2813,0x9fd4ff,0.75);}   /* スマホ：画面を顔の方へ向けて少し傾ける */
    else{add(boxGeo(0.25,0.18,0.012),0,1.16,0.27,0x1a1c20,0.7);add(boxGeo(0.23,0.16,0.004),0,1.1632,0.2662,0xb8e0ff,0.7);}}           /* タブレット */
  else add(boxGeo(0.085,bare?0.26:0.5,0.11),-ax,bare?1.29:1.16,0.01,col,0.12);
  const up=pose==='strap'; // つり革：右腕を上げる
  if(up){if(bare){add(boxGeo(0.085,0.22,0.11),ax,1.51,0.035,col,0.32);add(boxGeo(0.08,0.24,0.1),ax,1.71,0.10,skin,0.32);}   /* つり革の手だけ上げる */
    else add(boxGeo(0.085,0.44,0.11),ax,1.61,0.07,col,0.32);
    add(boxGeo(0.075,0.12,0.09),ax,1.86,0.15,skin,0.32);}
  else if(!dv)add(boxGeo(0.085,bare?0.26:0.5,0.11),ax,bare?1.29:1.16,0.01,col,-0.12); /* （スマホを持つ人に、つり革用の上げた腕が余分に付いていたのを修正） */
  if(bare&&!dv){add(boxGeo(0.08,0.26,0.1),-ax,1.03,0.03,skin);if(!up)add(boxGeo(0.08,0.26,0.1),ax,1.03,0.03,skin);}
  if(D.bag===1&&dv){add(boxGeo(0.26,0.20,0.10),ax-0.02,1.02,-0.12,D.bagC);}
  else if(D.bag===1){const bx=up?-ax-0.03:ax+0.03;add(boxGeo(0.10,0.24,0.20),bx,0.80,0.02,D.bagC);add(boxGeo(0.02,0.16,0.02),bx,0.99,0.02,D.bagC);}   // 手さげ
  if(D.bag===2){add(boxGeo(0.28,0.30,0.14),0,1.18,-0.17,D.bagC);add(boxGeo(0.05,0.34,0.05),-0.13,1.28,-0.08,D.bagC);add(boxGeo(0.05,0.34,0.05),0.13,1.28,-0.08,D.bagC);} // リュック
  if(D.bag===3){add(boxGeo(0.26,0.20,0.10),ax-0.02,1.02,-0.12,D.bagC);add(boxGeo(0.04,0.30,0.03),ax-0.06,1.22,-0.05,D.bagC,0.25);}  // 肩かけ
  if(!dv){add(boxGeo(0.075,0.16,0.09),-ax,0.90,0.04,skin);if(!up)add(boxGeo(0.075,0.16,0.09),ax,0.90,0.04,skin);}
  add(boxGeo(0.10,0.07,0.10),0,1.50,0,skin);                                 // neck
  const S=D.headScale,hd=new THREE.SphereGeometry(0.115*S,10,8);hd.scale(1,1.12,0.95);add(hd,0,1.63,0,skin);
  const hc=new THREE.SphereGeometry(0.122*S,10,6,0,Math.PI*2,0,Math.PI/2);hc.scale(1,1.1,1);add(hc,0,1.63,0,hair);
  if(D.fringe)add(boxGeo(0.20*S,0.034,0.05),0,1.63+0.072*S,0.082*S,hair);
  if(D.hairLong){const bh=new THREE.SphereGeometry(0.112*S,8,6);bh.scale(1,1.05,0.8);add(bh,0,1.575,-0.045,hair);}
  if(D.tails)for(const sgn of [-1,1]){const t=new THREE.SphereGeometry(0.055,7,6);add(t,sgn*0.125*S,1.60,-0.02,hair);}
  faceParts(D,add);
  if(staff){const S2=D.headScale;add(new THREE.CylinderGeometry(0.13*S2,0.13*S2,0.07,10),0,1.735,0,0x101a2c);add(boxGeo(0.24*S2,0.03,0.13),0,1.70,0.10*S2,0x101a2c);
    add(boxGeo(0.06,0.10,0.02),0.11,1.30,0.108,0xffd23f);}
  if(D.av){
    if(D.topStyle==='hoodie'){
      add(boxGeo(0.24,0.18,0.16),0,1.46,-0.09,col);
      add(boxGeo(0.26,0.18,0.04),0,1.08,0.11,col);
    } else if(D.topStyle==='jacket'){
      add(boxGeo(0.08,0.22,0.02),-0.08,1.34,0.11,col,0,0,0.25);
      add(boxGeo(0.08,0.22,0.02),0.08,1.34,0.11,col,0,0,-0.25);
      add(boxGeo(0.12,0.18,0.015),0,1.36,0.105,0xffffff);
      add(boxGeo(0.04,0.20,0.02),0,1.30,0.112,0x991b1b);
    } else if(D.topStyle==='coat'){
      add(boxGeo(D.torso*1.08,0.48,0.24),0,0.80,0,col);
    } else if(D.topStyle==='shirt'){
      add(boxGeo(0.09,0.05,0.03),-0.07,1.44,0.11,col,0,0,-0.2);
      add(boxGeo(0.09,0.05,0.03),0.07,1.44,0.11,col,0,0,0.2);
      add(boxGeo(0.025,0.45,0.01),0,1.18,0.108,0xffffff);
    } else if(D.topStyle==='cardigan'){
      add(boxGeo(0.14,0.26,0.01),0,1.30,0.105,0xf5f5f5);
    } else if(D.topStyle==='sweater'){
      add(boxGeo(D.torso*1.04,0.06,0.22),0,0.92,0,col);
    }
  }
  if(style==='skirt'){if(pose==='sit')skirtSit(D,add);else skirtParts(D,add);} /* 座ったときは太ももの上にかかる形 */
  const kidLike=D.child||D.av,tights=kidLike&&D.sock===4,skinUp=tights?D.sockC:skin,skinLo=tights?D.sockC:skin,shoe=D.shoeC||0x2a2a2a;
  if(pose==='stand'||up)for(const x of [-0.085,0.085]){
    if(style==='long'||style==='jeans'||style==='wide'||style==='cargo'){
      const w=style==='wide'?0.16:0.125;
      add(boxGeo(w,0.82,0.145),x,0.43,0,leg);
      if(style==='cargo')add(boxGeo(0.03,0.14,0.12),x>0?x+0.06:x-0.06,0.46,0,leg);
    }
    else{add(boxGeo(0.125,style==='shorts'?0.30:0.16,0.145),x,style==='shorts'?0.69:0.76,0,style==='shorts'?leg:skinUp);
         add(boxGeo(0.115,style==='shorts'?0.52:0.66,0.135),x,style==='shorts'?0.28:0.35,0,skinLo);}
    if(kidLike&&style!=='long'&&style!=='jeans'&&style!=='wide'&&style!=='cargo'&&!tights){if(D.sock===2||D.sock===3)add(boxGeo(0.122,0.36,0.142),x,0.22,0,D.sockC);else if(D.sock===1)add(boxGeo(0.122,0.1,0.142),x,0.09,0,D.sockC);} /* ハイソックス／くるぶし丈 */
    add(boxGeo(0.13,0.06,0.23),x,0.03,0.03,shoe);if(kidLike)add(boxGeo(0.132,0.02,0.235),x,0.005,0.03,0xf2f2f2);}
  if(pose==='sit')for(const x of [-0.095,0.095]){
    const isPants=style==='long'||style==='jeans'||style==='wide'||style==='cargo';
    add(boxGeo(0.14,0.15,0.46),x,0.80,0.21,isPants?leg:(style==='shorts'?leg:skinUp));
    add(boxGeo(0.13,0.42,0.14),x,0.53,0.40,isPants?leg:skinLo);
    if(kidLike&&!isPants&&!tights&&(D.sock===2||D.sock===3))add(boxGeo(0.135,0.24,0.145),x,0.44,0.40,D.sockC);
    add(boxGeo(0.13,0.06,0.23),x,0.31,0.45,shoe);}
  return P;}
function legPartsOf(vi,child){const D=(child?VDC:VD)[vi],tights=(D.child||D.av)&&D.sock===4,skin=tights?D.sockC:D.skin,leg=D.leg,style=D.style;
  const P=[],add=(g,y,c)=>{dummy.position.set(0,y,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();P.push([g,dummy.matrix.clone(),c]);};
  if(style==='long'||style==='jeans'||style==='wide'||style==='cargo'){
    const w=style==='wide'?0.16:0.125;
    add(boxGeo(w,0.82,0.145),-0.41,leg);
    if(style==='cargo')add(boxGeo(0.03,0.14,0.12),0.07,-0.38,leg);
  }
  else{add(boxGeo(0.125,style==='shorts'?0.30:0.16,0.145),style==='shorts'?-0.15:-0.08,style==='shorts'?leg:skin);
       add(boxGeo(0.115,style==='shorts'?0.52:0.66,0.135),style==='shorts'?-0.56:-0.49,skin);}
  if((D.child||D.av)&&style!=='long'&&style!=='jeans'&&style!=='wide'&&style!=='cargo'&&!tights){if(D.sock===2||D.sock===3)add(boxGeo(0.122,0.36,0.142),-0.62,D.sockC);else if(D.sock===1)add(boxGeo(0.122,0.1,0.142),-0.75,D.sockC);}
  add(boxGeo(0.13,0.06,0.23),-0.81,D.shoeC||0x2a2a2a);
  return P;}
const NVAR=26,NVARC=36; /* 子どもは36通り（スカート14種類×色・長さ・靴下・靴） */
for(let vi=0;vi<Math.max(NVAR,NVARC);vi++){VD.push(vdef(vi,false));VDC.push(vdef(vi,true));}
const STRAPG=[],UPPERG=[],STANDG=[],SITG=[],CUPPERG=[],CSTANDG=[],CSITG=[],LEGG=[],CLEGG=[],SUPPERG=[],SSTANDG=[],SSITG=[],SLEGG=[];
for(let vi=0;vi<NVAR;vi++){STRAPG.push(colored(partsOf(vi,false,'strap')));UPPERG.push(colored(partsOf(vi,false,'upper')));STANDG.push(colored(partsOf(vi,false,'stand')));SITG.push(colored(partsOf(vi,false,'sit')));LEGG.push(colored(legPartsOf(vi,false)));
  SUPPERG.push(colored(partsOf(vi,false,'upper',true)));SSTANDG.push(colored(partsOf(vi,false,'stand',true)));SSITG.push(colored(partsOf(vi,false,'sit',true)));SLEGG.push(colored(legPartsOf(vi,false)));}
for(let vi=0;vi<NVARC;vi++){CUPPERG.push(colored(partsOf(vi,true,'upper')));CSTANDG.push(colored(partsOf(vi,true,'stand')));CSITG.push(colored(partsOf(vi,true,'sit')));CLEGG.push(colored(legPartsOf(vi,true)));}
const upperMat=new THREE.MeshLambertMaterial({vertexColors:true});
/* ===== 乗客モードの自分（アバター） ===== */
let AVG=null,AVH=1.7,AV3P=false,AVPREV=null;
function avatarDesc(A){const child=A.height<145,f=!!A.female,kt=A.skirtType|0;
  return {av:true,female:f,child,col:A.top,topStyle:A.topStyle||'tshirt',skin:SKIN[A.skin]||SKIN[0],hair:HAIRC[A.hair]||HAIRC[0],leg:A.bottomC,sk:A.bottomC,style:A.bottom,skirtType:kt,skirtC:A.bottomC,
    skirtH:A.skirtLen*(child?0.85:1),skirtBot:(kt===0?0.2:kt===3||kt===8?0.3:kt===11?0.26:0.27)+(child?0:0.03),sock:A.sock|0,sockC:A.sockC,shoeC:A.shoeC,
    skirtPleatC:kt===7?0x2f4a74:kt===4||kt===5?0x15181f:0xf2efe6,shoulder:child?0.32:(f?0.36:0.43),torso:child?0.31:(f?0.33:0.38),hairLong:!!A.hairLong||!!A.tails,tails:!!A.tails,
    eyeGap:0.048,eyeW:0.034,eyeH:child?0.032:0.024,browY:0.042,browTilt:0,browW:f?0.04:0.05,browH:f?0.008:0.013,mouthW:0.056,lips:f,lipC:LIPC[0],
    glasses:!!A.glasses,beard:false,bare:A.sleeve==='short'||A.sleeve==='none',sleeveNone:A.sleeve==='none',bag:A.bag|0,bagC:0x3a3f4a,fringe:true,headScale:child?1.16:(f?0.98:1.02)};}
function buildAvatar(){if(AVG||(!PAX&&G.crew!=='twoC')||STAFF)return;const A=AVATAR,D=avatarDesc(A);let vi;
  if(D.child){VDC.push(D);vi=VDC.length-1;CUPPERG[vi]=colored(partsOf(vi,true,'upper'));CSTANDG[vi]=colored(partsOf(vi,true,'stand'));CSITG[vi]=colored(partsOf(vi,true,'sit'));CLEGG[vi]=colored(legPartsOf(vi,true));}
  else{VD.push(D);vi=VD.length-1;STRAPG[vi]=colored(partsOf(vi,false,'strap'));UPPERG[vi]=colored(partsOf(vi,false,'upper'));STANDG[vi]=colored(partsOf(vi,false,'stand'));SITG[vi]=colored(partsOf(vi,false,'sit'));LEGG[vi]=colored(legPartsOf(vi,false));}
  const g=new THREE.Group();g.rotation.order='YXZ';const geo=D.child?CSTANDG[vi]:STANDG[vi],mesh=new THREE.Mesh(geo,upperMat);g.add(mesh);g.userData={legs:[],mesh,vi,child:D.child,staff:false,mode:'stand'};
  geo.computeBoundingBox();const mh=Math.max(0.5,geo.boundingBox.max.y);AVH=A.height/100;const sc=AVH/mh;g.scale.set(sc,sc,sc);g.visible=false;scene.add(g);AVG=g;
  g.traverse(o=>o.layers.enableAll());}
function paxEye(){return AVG?AVH*0.92:1.55;}
function toggle3P(){AV3P=!AV3P;if(!AVG){try{buildAvatar();}catch(e){console.error(e);}}const b=document.getElementById('paxView');if(b)b.textContent=AV3P?'視点：三人称（V）':'視点：一人称（V）';toast(AV3P?'三人称視点':'一人称視点','info');}
function updAvatar(dt){if(!AVG||(!PAX&&G.crew!=='twoC'))return;const g=AVG,u=g.userData,t=performance.now()/1000;
  const mvM=Math.hypot(W.mv.x,W.mv.y)+((W.keys.KeyW||W.keys.KeyS||W.keys.KeyA||W.keys.KeyD||W.keys.ArrowUp||W.keys.ArrowDown||W.keys.ArrowLeft||W.keys.ArrowRight)?1:0);
  if(!PAX&&G.crew==='twoC'){
    if(G.walkOn&&G.walkArea==='train'&&ownTrain&&ownTrain.cars&&ownTrain.cars[G.walkCar]){
      const car=ownTrain.cars[G.walkCar];if(g.parent!==car)car.add(g);
      const fy=(car.userData.green&&!car.userData.gflat)?GFLOOR[G.walkFl||'deck']:1.16;
      g.position.set(G.walkLx||0,fy,G.walkLz||0);g.rotation.set(0,W.yaw+Math.PI,0);personPose(g,mvM>0.1?'walk':'stand');
      if(u.mode==='walk')u.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*8.5+i*Math.PI)*0.5);
      g.visible=AV3P;
      if(AV3P){const back=1.7,up=0.35,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw);camera.position.x-=fx*back;camera.position.z-=fz*back;camera.position.y+=up;camera.rotation.set(W.pitch-0.18,W.yaw,0);}
    }else if(G.walkOn){
      if(g.parent!==scene)scene.add(g);
      const isUgWalk=!BRANCH&&(G.key==='G'||G.key==='H');
      g.position.copy(isUgWalk?offsG(W.s,W.o,LTD_DEPTH+PH):offs(W.s,W.o,PH));g.rotation.set(0,W.yaw+Math.PI,0);personPose(g,mvM>0.1?'walk':'stand');
      if(u.mode==='walk')u.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*8.5+i*Math.PI)*0.5);
      g.visible=AV3P;
      if(AV3P){const back=2.8,up=0.55,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw);camera.position.x-=fx*back;camera.position.z-=fz*back;camera.position.y+=up;camera.rotation.set(W.pitch-0.18,W.yaw,0);}
    }else{
      if(g.parent!==cab)cab.add(g);
      g.position.set(XE+0.05,1.16,ZE+0.12);g.rotation.set(0,G.lookY+Math.PI,0);personPose(g,'stand');
      g.visible=AV3P&&!G.lean;
      if(AV3P&&!G.lean){camera.position.set(XE+0.05-Math.sin(G.lookY)*1.1,YE+0.42,ZE+0.12-Math.cos(G.lookY)*1.1);camera.rotation.set(-0.22,G.lookY,0);}
    }
    return;
  }
  if(RIDE&&RIDE.a&&RIDE.a.tr&&RIDE.a.tr.cars&&RIDE.a.tr.cars[RIDE.k]){const car=RIDE.a.tr.cars[RIDE.k];if(g.parent!==car)car.add(g);
    if(RIDE.seat!=null){const st=seatsOf(RIDE.a,RIDE.k)[RIDE.seat];sitPose({g},st);}
    else{const fy=greenCar()?GFLOOR[RIDE.fl]:1.16;g.position.set(RIDE.lx,fy,RIDE.lz);g.rotation.set(0,W.yaw+Math.PI,0);personPose(g,mvM>0.1?'walk':'stand');}}
  else{if(g.parent!==scene)scene.add(g);const isUgPlat=!BRANCH&&PX.plats&&PX.plats[PX.pi]&&PX.plats[PX.pi].keys&&(PX.plats[PX.pi].keys.includes('G')||PX.plats[PX.pi].keys.includes('H'));g.position.copy(isUgPlat?offsG(W.s,W.o,LTD_DEPTH+PH):offs(W.s,W.o,PH));g.rotation.set(0,W.yaw+Math.PI,0);personPose(g,mvM>0.1?'walk':'stand');}
  if(u.mode==='walk')u.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*8.5+i*Math.PI)*0.5);
  g.visible=AV3P;
  if(AV3P){ /* 三人称：自分の後ろ斜め上から */
    const back=RIDE?1.7:2.8,up=RIDE?0.35:0.55,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw);camera.position.x-=fx*back;camera.position.z-=fz*back;camera.position.y+=up;camera.rotation.set(W.pitch-0.18,W.yaw,0);}}
function buildRemotePassengerAvatar(p){
  if(!p||p.paxG)return p&&p.paxG;
  const A=Object.assign({},AV_DEF,p.avatar||{});const D=avatarDesc(A);let vi;
  if(D.child){VDC.push(D);vi=VDC.length-1;CUPPERG[vi]=colored(partsOf(vi,true,'upper'));CSTANDG[vi]=colored(partsOf(vi,true,'stand'));CSITG[vi]=colored(partsOf(vi,true,'sit'));CLEGG[vi]=colored(legPartsOf(vi,true));}
  else{VD.push(D);vi=VD.length-1;STRAPG[vi]=colored(partsOf(vi,false,'strap'));UPPERG[vi]=colored(partsOf(vi,false,'upper'));STANDG[vi]=colored(partsOf(vi,false,'stand'));SITG[vi]=colored(partsOf(vi,false,'sit'));LEGG[vi]=colored(legPartsOf(vi,false));}
  const g=new THREE.Group();g.rotation.order='YXZ';
  const geo=D.child?CSTANDG[vi]:STANDG[vi];
  const mesh=new THREE.Mesh(geo,upperMat);g.add(mesh);
  g.userData={legs:[],mesh,vi,child:D.child,staff:false,mode:'stand'};
  geo.computeBoundingBox();const mh=Math.max(0.5,geo.boundingBox.max.y);const h=(A.height||170)/100;const sc=h/mh;g.scale.set(sc,sc,sc);
  if(typeof makeNameplateSprite==='function'){
    const plate=makeNameplateSprite(p.name||'乗客','#34d399',!!p.isDev);
    plate.position.set(0,mh+0.42,0);plate.scale.set(2.4,0.68,1);g.add(plate);g.userData.plate=plate;
  }
  g.traverse(o=>o.layers.enableAll());
  scene.add(g);p.paxG=g;return g;
}
function updRemotePassengers(dt){
  if(!IS_ONLINE||!window.ONLINE_PLAYERS)return;
  const t=performance.now()/1000;
  for(const pid in ONLINE_PLAYERS){
    const p=ONLINE_PLAYERS[pid];if(!p)continue;
    const isPaxP=!!(p.isPax||p.state==='passenger');
    const isCrewWalk=!!(!isPaxP&&p.state==='driving'&&p.crewWalk);
    if((!isPaxP&&!isCrewWalk)||(isPaxP&&p.paxS==null)){if(p.paxG)p.paxG.visible=false;if(p.tr&&p.tr.crew&&p.tr.crew[1])p.tr.crew[1].visible=true;continue;}
    if(!p.paxG){try{buildRemotePassengerAvatar(p);}catch(e){continue;}}
    const g=p.paxG;if(!g)continue;
    g.visible=true;
    if(isCrewWalk&&p.tr&&p.tr.crew&&p.tr.crew[1])p.tr.crew[1].visible=false;
    if(isCrewWalk&&p.crewArea==='train'&&p.tr&&p.tr.cars){
      const cIdx=clamp(p.crewCar||0,0,p.tr.cars.length-1),car=p.tr.cars[cIdx];
      if(car){
        if(g.parent!==car)car.add(g);
        const fy=(car.userData.green&&!car.userData.gflat)?GFLOOR[p.crewFl||'deck']:1.16;
        g.position.set(p.crewLx||0,fy,p.crewLz||0);
        g.rotation.set(0,(p.paxYaw||0)+Math.PI,0);
        personPose(g,p.paxWalk?'walk':'stand');
        if(g.userData&&g.userData.mode==='walk'){g.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*8.5+i*Math.PI)*0.5);}
        continue;
      }
    }
    const r=p.paxRide;
    if(r&&r.pid!==undefined){
      let targetCar=null;
      if(r.pid&&ONLINE_PLAYERS[r.pid]&&ONLINE_PLAYERS[r.pid].tr&&ONLINE_PLAYERS[r.pid].tr.cars){
        targetCar=ONLINE_PLAYERS[r.pid].tr.cars[r.k||0]||ONLINE_PLAYERS[r.pid].tr.cars[0];
      }else if(r.pid===ONLINE_CLIENT_ID&&!PAX&&typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars){
        targetCar=ownTrain.cars[r.k||0]||ownTrain.cars[0];
      }else if(r.pid===null&&r.isAi===false&&!PAX&&typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars){
        targetCar=ownTrain.cars[r.k||0]||ownTrain.cars[0];
      }
      if(targetCar){
        if(g.parent!==targetCar)targetCar.add(g);
        const fy=(targetCar.userData&&targetCar.userData.green&&!targetCar.userData.gflat)?GFLOOR[r.fl||'deck']:1.16;
        g.position.set(r.lx||0,fy,r.lz||0);
        g.rotation.set(0,(p.paxYaw||0)+Math.PI,0);
        personPose(g,r.seat!=null?'sit':(p.paxWalk?'walk':'stand'));
      }else if(r.pid&&r.pid!==ONLINE_CLIENT_ID&&ONLINE_PLAYERS[r.pid]){
        g.visible=false;
      }else{
        if(g.parent!==scene)scene.add(g);
        g.position.copy(offs(p.paxS,p.paxO||0,PH));
        g.rotation.set(0,(p.paxYaw||0)+Math.PI,0);
        personPose(g,p.paxWalk?'walk':'stand');
      }
    }else{
      if(g.parent!==scene)scene.add(g);
      const tgt=offs(p.paxS,p.paxO||0,PH);
      if(g.position.distanceTo(tgt)>12||g.position.lengthSq()<0.01)g.position.copy(tgt);
      else g.position.lerp(tgt,Math.min(1,dt*12));
      g.rotation.set(0,(p.paxYaw||0)+Math.PI,0);
      personPose(g,p.paxWalk?'walk':'stand');
    }
    if(g.userData&&g.userData.mode==='walk'){
      g.userData.legs.forEach((l,i)=>l.rotation.x=Math.sin(t*8.5+i*Math.PI)*0.5);
    }
  }
}
function copyPersonLook(dst,src){
  if(!dst||!src||!dst.userData||!src.userData)return;
  const su=src.userData,du=dst.userData;if(su.staff)return;
  du.child=!!su.child;du.vi=su.vi;du.mode='';dst.scale.copy(src.scale);personPose(dst,'walk');
}
function makePerson(kind){const child=kind==='child',staff=kind==='staff';const g=new THREE.Group();const vi=irand(0,(child?NVARC:NVAR)-1);
  const mesh=new THREE.Mesh(staff?SSTANDG[vi]:child?CSTANDG[vi]:STANDG[vi],upperMat);g.add(mesh);
  const sc=child?rand(0.60,0.80):rand(0.90,1.06);g.scale.set(sc,sc,sc);
  g.userData={legs:[],mesh,vi,child,staff,mode:'stand'};return g;}
// swap between the merged idle body (1 draw call) and the walking body with moving legs
function personPose(g,mode){const u=g.userData;if(!u||u.mode===mode)return;u.mode=mode;
  if(mode==='walk'){u.mesh.geometry=u.staff?SUPPERG[u.vi]:u.child?CUPPERG[u.vi]:UPPERG[u.vi];
    if(!u.legs.length)for(const x of [-0.09,0.09]){const m=new THREE.Mesh(u.staff?SLEGG[u.vi]:u.child?CLEGG[u.vi]:LEGG[u.vi],upperMat);m.position.set(x,0.84,0);m.layers.mask=u.mesh.layers.mask;g.add(m);u.legs.push(m);}
    for(const l of u.legs){l.visible=true;l.rotation.x=0;}}
  else{u.mesh.geometry=mode==='sit'?(u.staff?SSITG[u.vi]:u.child?CSITG[u.vi]:SITG[u.vi]):(mode==='strap'&&!u.staff&&!u.child)?STRAPG[u.vi]:(u.staff?SSTANDG[u.vi]:u.child?CSTANDG[u.vi]:STANDG[u.vi]);for(const l of u.legs)l.visible=false;}}
/* ================= cab ================= */
const rig=new THREE.Group();rig.rotation.order='YXZ';scene.add(rig);rig.add(camera);
const headSpot=new THREE.SpotLight(0xfff4dd,0,260,0.32,0.5,1.2);headSpot.position.set(0,1.7,-0.3);rig.add(headSpot);
const hsT=new THREE.Object3D();hsT.position.set(0,0,-90);rig.add(hsT);headSpot.target=hsT;
const cabLight=new THREE.PointLight(0xffffff,0.2,4.5,1.5);cabLight.position.set(-0.3,3.4,1.1);rig.add(cabLight);
const cab=new THREE.Group();rig.add(cab);
const INTER=[];
const CM={shell:lam(0xd6d9dc),desk:lam(0x22262c),top:lam(0x2c3138),frame:lam(0x0e1116),floor:lam(0x2e3237),
  metal:new THREE.MeshPhongMaterial({color:0x9aa2ab,shininess:70}),grip:new THREE.MeshPhongMaterial({color:0x141414,shininess:80}),
  chrome:new THREE.MeshPhongMaterial({color:0xd1d5db,specular:0xffffff,shininess:90}),
  gold:new THREE.MeshPhongMaterial({color:0xd4af37,specular:0xfff099,shininess:85}),
  matBlack:lam(0x111317),
  accent:new THREE.MeshBasicMaterial({color:0x2fd0ff}),
  accentDim:new THREE.MeshBasicMaterial({color:0x0d5c78}),
  glass:new THREE.MeshBasicMaterial({color:0xeaf4fb,transparent:true,opacity:0.026,depthWrite:false,fog:false,side:DS}),
  visor:new THREE.MeshBasicMaterial({color:0x1d2b38,transparent:true,opacity:0.6,depthWrite:false,fog:false,side:DS}),
  hit:new THREE.MeshBasicMaterial({visible:false})};
function cbox(w,h,d,mat,x,y,z,parent){const m=new THREE.Mesh(boxGeo(w,h,d),mat);m.position.set(x,y,z);(parent||cab).add(m);return m;}
function cplane(w,h,mat,x,y,z,parent){const m=new THREE.Mesh(UNIT_PLANE,mat);m.scale.set(w,h,1);m.position.set(x,y,z);(parent||cab).add(m);return m;}
const basic=(tex,tr)=>new THREE.MeshBasicMaterial({map:tex,transparent:!!tr});
cbox(2.74,1.15,0.1,CM.desk,0,1.725,0.16);cbox(2.74,0.3,0.12,CM.frame,0,3.5,0.16);
cbox(0.1,1.2,0.14,CM.frame,-1.32,2.9,0.16);cbox(0.1,1.2,0.14,CM.frame,0.24,2.9,0.16);cbox(0.08,1.2,0.14,CM.frame,1.07,2.9,0.16);cbox(0.24,1.2,0.12,CM.shell,1.23,2.9,0.16);
cbox(0.74,0.2,0.08,CM.shell,0.655,2.4,0.18);cbox(0.74,0.14,0.08,CM.shell,0.655,3.28,0.18);
cplane(1.46,1.05,CM.glass,-0.54,2.825,0.12);cplane(0.72,0.7,CM.glass,0.655,2.85,0.14);
cbox(2.74,0.05,2.5,CM.shell,0,3.64,1.35);cbox(2.74,0.05,2.5,CM.floor,0,1.15,1.35);
for(const sg of [-1,1]){const x=sg*1.37;cbox(0.06,1.05,2.56,CM.shell,x,1.675,1.38);cbox(0.06,0.46,2.56,CM.shell,x,3.44,1.38);
  cbox(0.06,1.02,0.4,CM.shell,x,2.71,0.3);cbox(0.06,1.02,0.54,CM.shell,x,2.71,2.37);const g=cplane(1.55,1.02,CM.glass,x,2.71,1.275);g.rotation.y=Math.PI/2;}
/* partition behind the driver: same window and door proportions as carTemplate */
{const Z=2.6,door=TM.door;
  cbox(2.74,0.66,0.08,CM.shell,0,1.47,Z+0.015);cbox(2.74,0.78,0.08,CM.shell,0,3.28,Z+0.015);
  for(const sx of [-1,1]){cbox(0.06,1.15,0.08,CM.shell,sx*1.33,2.35,Z+0.015);cbox(0.04,1.15,0.06,CM.shell,sx*0.41,2.35,Z+0.01);}
  const cabDoorL=cbox(0.8,1.85,0.05,door,0,2.125,Z-0.03);cbox(0.03,0.04,0.12,CM.metal,0.3,2.1,Z-0.03);
  for(const sx of [-1,1])cplane(0.9,1.1,TM.glassC,sx*0.86,2.35,Z-0.01);
  cbox(0.5,0.1,0.5,CM.desk,-0.3,1.72,1.55);cbox(0.5,0.55,0.08,CM.desk,-0.3,2.05,1.82);cbox(0.08,0.55,0.08,CM.metal,-0.3,1.45,1.55);}
const SALDOOR=[]; // the saloon doors slide with the real ones
function updSalDoors(){const D=G.door,f=(D.state==='open'||D.state==='opening'||D.state==='closing')?D.frac:0;
  for(const d of SALDOOR){const open=(D.local*SIDEINV)===d.sg?f:0;d.m.position.z=d.base+d.k*(0.35+open*0.62);}}
const OWNCREW=(SERVICES[SVC]&&(SERVICES[SVC].kind==='ltd'||SERVICES[SVC].kind==='local'||SERVICES[SVC].line==='branch3'))?CREWSEL:'one',CONDV=OWNCREW==='twoC',SIDEINV=CONDV?-1:1; /* 車掌：後ろ向きなので左右が逆 */
/* passenger saloon behind the cab: identical structure to carTemplate */
const SM=OWNOLD?OLDI:TM;
{const OFF=CARHALF,isRearCab=CONDV,LY=salLayout(!isRearCab,isRearCab); /* 運転台ローカル z = 車両ローカル z + 9.75 */
  const CEIL=3.41,Z0=2.63,Z1=19.4,LEN=Z1-Z0,ZC=(Z0+Z1)/2;
  const isFlatGr=GREENFLAT&&GREENCARS.indexOf(isRearCab?OWNCARS-1:0)>=0;
  cbox(2.74,0.04,LEN,SM.ifloor,0,1.15,ZC);cbox(2.74,0.04,LEN,SM.iwall,0,CEIL,ZC);
  for(const x of (isFlatGr?[-0.55,0.55]:[-0.5,0.5])){const lt=cplane(0.12,LY.z1-LY.z0-0.9,TM.ilight,x,CEIL-0.02,(LY.z0+LY.z1)/2+OFF);lt.rotation.x=Math.PI/2;}
  const SEGC=[[-9.75,-6.95],[-5.65,-0.65],[0.65,5.65],[6.95,9.75]];
  const DOORC=LY.doors.map(z=>z+OFF);
  for(const sg of [-1,1]){const x=sg*1.36,iry=-sg*Math.PI/2;
    for(const [a0,b0] of SEGC){
      const a=Math.max(Z0,a0+OFF),b=Math.min(Z1,b0+OFF);if(b-a<=0.02)continue;
      const len=b-a,cz=(a+b)/2;
      /* 腰板・幕板・柱（carTemplate の WINZ・pierSpansG と完全一致） */
      cbox(0.05,1.12,len,SM.iwall,x,1.71,cz);
      cbox(0.05,0.36,len,SM.iwall,x,3.23,cz);
      for(const [p0,p1] of pierSpansG(a-OFF,b-OFF,WINZ)){
        cbox(0.05,0.78,p1-p0,SM.iwall,x,2.66,(p0+p1)/2+OFF);
      }
      /* 窓ガラス＋窓サッシ（黒枠） */
      for(const [wa,wb] of WINZ){
        const ca=Math.max(a-OFF,wa),cb=Math.min(b-OFF,wb);if(cb-ca<=0.05)continue;
        const wm=(ca+cb)/2+OFF,wl=cb-ca;
        const g=cplane(wl,0.78,TM.glass,x+sg*0.02,2.66,wm);g.rotation.y=iry;
        cbox(0.05,0.05,wl+0.09,CM.frame,x+sg*0.015,3.075,wm);
        cbox(0.05,0.05,wl+0.09,CM.frame,x+sg*0.015,2.245,wm);
        for(const zz of [ca+OFF-0.025,cb+OFF+0.025])cbox(0.05,0.88,0.05,CM.frame,x+sg*0.015,2.66,zz);
      }
    }
    /* ドア＋ドア枠（grack） */
    for(const dz of DOORC){
      for(const kk of [-1,1]){const dm=cbox(0.05,1.85,0.70,TM.door,x+sg*0.01,2.125,dz+kk*0.35);SALDOOR.push({m:dm,base:dz,k:kk,sg});}
      cbox(0.05,0.36,1.3,SM.iwall,x,3.23,dz);cbox(0.06,0.14,1.4,SM.iwall,x,1.13,dz);
      for(const k2 of [-1,1])cbox(0.05,1.9,0.03,TM.grack,x+sg*0.022,2.125,dz+k2*0.665);
      cbox(0.05,0.03,1.36,TM.grack,x+sg*0.022,3.065,dz);
    }
    if(isFlatGr){
      cbox(0.30,0.07,12.4,TM.grack,sg*1.22,2.62,OFF);
    }else{
      for(const [a,b] of LY.seats){const ca=Math.max(Z0,a+OFF),cb=Math.min(Z1,b+OFF),slen=cb-ca;if(slen<0.4)continue;const sz=(ca+cb)/2;
        cbox(0.46,0.42,slen-0.3,SM.iseat,sg*1.1,1.37,sz);cbox(0.08,0.45,slen-0.3,SM.iseat,sg*1.31,1.8,sz);}
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,LEN,6),TM.pole);bar.rotation.x=Math.PI/2;bar.position.set(sg*0.75,3.1,ZC);cab.add(bar);
      for(const z of LY.poles){const pz=z+OFF;if(pz<Z0+0.2||pz>Z1-0.2)continue;const p=new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,2.26,8),TM.pole);p.position.set(sg*0.9,2.28,pz);cab.add(p);}
      for(const z of LY.straps){const sz=z+OFF;if(sz<Z0+0.2||sz>Z1-0.2)continue;cbox(0.012,0.2,0.012,SM.iwall,sg*0.75,3.0,sz);cbox(0.02,0.1,0.1,SM.iwall,sg*0.75,2.86,sz);}
      if(OWNOLD)DOORC.forEach((dz,j)=>{const lcdSide=j%2===0?1:-1;
        if(MINI&&sg!==lcdSide)return;if(MINI){const a=cplane(0.86,0.14,TM.ioled,x-sg*0.045,3.30,dz);a.rotation.y=iry;const l=cplane(0.44,0.05,sg>0?TM.ilampR:TM.ilampL,x-sg*0.045,3.14,dz);l.rotation.y=iry;return;}
        if(sg===lcdSide){const a=cplane(0.58,0.33,TM.iled,x-sg*0.045,3.23,dz);a.rotation.y=iry;}
        else{const a=cplane(0.86,0.14,TM.ioled,x-sg*0.045,3.30,dz);a.rotation.y=iry;const l=cplane(0.44,0.05,sg>0?TM.ilampR:TM.ilampL,x-sg*0.045,3.14,dz);l.rotation.y=iry;}});
      else{for(const dz of DOORC){
        const putLcd=(mat,w,h,zz)=>{if(zz<Z0+0.30||zz>Z1-0.30)return;const q=cplane(w,h,mat,x-sg*0.045,3.24,zz);q.rotation.y=iry;};
        putLcd(TM.iad,0.46,0.24,dz-0.34);putLcd(TM.iledW,0.68,0.26,dz+0.26);putLcd(TM.iled,0.42,0.24,dz-0.92);putLcd(TM.iad,0.42,0.24,dz+0.92);}
        for(const [a,b] of LY.seats){let si=0;for(let z2=a+0.7;z2<=b-0.65;z2+=1.15,si++){
          const z=z2+OFF;if(z<Z0+0.4||z>Z1-0.4)continue;
          const m=si%2===0?TM.iad:TM.iledW,h=si%2===0?0.31:0.25,w=si%2===0?0.60:0.64;
          const aS=cplane(w,h,m,x-sg*0.045,3.226,z);aS.rotation.y=iry;}}
        for(const z of [-6.0,-3.2,0,3.2,6.0]){const hz=z+OFF;if(hz<Z0+0.6||hz>Z1-0.6)continue;
          cbox(0.68,0.38,0.045,CM.desk,0,3.15,hz);
          const m=z===0?TM.iledW:TM.iad,h=z===0?0.24:0.32;
          for(const face of [0,Math.PI]){const pp=cplane(0.62,h,m,0,3.15,hz+(face?-0.026:0.026));pp.rotation.y=face;}
          cbox(0.02,0.09,0.02,CM.metal,0.26,3.38,hz);cbox(0.02,0.09,0.02,CM.metal,-0.26,3.38,hz);}}}
  }
  if(isFlatGr){for(let z=-5.9;z<=5.95;z+=1.05){const gz=z+OFF;if(gz<Z0+0.5||gz>Z1-0.5)continue;
    for(const sx of [-1.00,-0.52,0.52,1.00]){cbox(0.42,0.40,0.50,TM.gseat,sx,1.38,gz);cbox(0.40,0.66,0.11,TM.gseat,sx,2.00,gz+0.27);cbox(0.38,0.16,0.13,TM.gseat,sx,2.38,gz+0.32);}}}
  if(!OWNOLD){
    const eG=cplane(0.76,0.28,TM.iledW,0,3.20,Z1-0.04);eG.rotation.y=Math.PI;
    for(const sx of [-1,1]){const eA=cplane(0.56,0.30,TM.iad,sx*0.86,2.60,Z1-0.04);eA.rotation.y=Math.PI;}
  }
  cbox(2.74,2.26,0.06,SM.iwall,0,2.28,Z1);cbox(0.9,1.9,0.07,TM.door,0,2.1,Z1-0.01);
}
{const v=cplane(0.7,0.26,CM.visor,-0.75,3.3,0.3);v.rotation.x=-0.6;}
cbox(2.3,0.06,0.62,CM.top,-0.2,2.12,0.62);cbox(2.3,0.95,0.06,CM.desk,-0.2,1.64,0.93);
cbox(2.26,0.008,0.018,CM.accent,-0.2,2.154,0.315);cbox(2.26,0.006,0.018,CM.accentDim,-0.2,2.154,0.925); /* 運転台のアクセントLED */
const XE=-0.3,YE=2.72,ZE=1.2;
{ /* 椅子：運転士は座る位置、車掌室では壁ぎわにたたんで寄せてある */
  const ch=new THREE.Group();cab.add(ch);
  if(!CONDV){ch.position.set(XE,0,ZE+0.32);}else{ch.position.set(0.62,0,1.95);ch.rotation.y=-0.5;}
  cbox(0.5,0.1,0.48,CM.desk,0,CONDV?1.62:1.78,0,ch);cbox(0.5,0.6,0.08,CM.desk,0,CONDV?1.98:2.12,0.24,ch);cbox(0.08,CONDV?0.45:0.6,0.08,CM.frame,0,CONDV?1.38:1.46,0.02,ch);
  cbox(0.42,0.04,0.42,CM.frame,0,1.17,0.02,ch);}
// five monitors on an arc facing the driver
const MR=0.82,MY=YE-0.22,MW=0.207,MH=0.155;
const OLDMON=false; // 支線の古い電車は、乗降モニターが他と同じ大きさで上下2画面（前の仕様）
const MONDEF=[['L',OLDMON?-32:-40],['S',-16],['I',0],['M',16],['R',OLDMON?32:40]];
const MONBIG=OLDMON?1:2; // 左右のホームカメラモニターは2倍
const MON={};
const CANV={S:mkCanvas(1024,768),I:mkCanvas(1024,768),M:mkCanvas(1024,768),L:mkCanvas(1024,768),R:mkCanvas(1024,768),NS:mkCanvas(256,96)};
const RT={};for(const k of ['L','R'])for(let q=0;q<(OLDMON?2:4);q++)RT[k+q]=OLDMON?new THREE.WebGLRenderTarget(384,144):new THREE.WebGLRenderTarget(isMobileDevice?256:320,isMobileDevice?192:240); // 4分割（2×2）／支線は上下2画面
{const x=CANV.NS.x;x.fillStyle='#0b1f45';x.fillRect(0,0,256,96);x.fillStyle='#8fa6cc';x.font='700 26px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText('映像なし',128,50);CANV.NS.tex.needsUpdate=true;}
/* 支線の古い電車：速度計・圧力計（針のアナログ計器）と紙の行路表。乗降モニターはない（窓から顔を出すか、ホームに出て確認） */
const GAUGE={};
function gaugeFace(kind){return canvasTex(256,256,(x,w,h)=>{const c=w/2,R=118;x.fillStyle='#0f1012';x.beginPath();x.arc(c,c,R+6,0,7);x.fill();x.fillStyle='#f3efe2';x.beginPath();x.arc(c,c,R,0,7);x.fill();
  const mx=kind==='S'?120:1000,step=kind==='S'?5:50,lab=kind==='S'?20:200;x.strokeStyle='#15161a';x.fillStyle='#15161a';x.textAlign='center';x.textBaseline='middle';
  for(let v=0;v<=mx;v+=step){const a=(-90-135+270*v/mx)*Math.PI/180,big=v%lab===0,r1=R-4,r0=R-(big?22:12);x.lineWidth=big?4:2;x.beginPath();x.moveTo(c+Math.cos(a)*r0,c+Math.sin(a)*r0);x.lineTo(c+Math.cos(a)*r1,c+Math.sin(a)*r1);x.stroke();
    if(big){x.font='700 '+(kind==='S'?22:17)+'px '+FONT;x.fillText(kind==='S'?v:v/100,c+Math.cos(a)*(R-40),c+Math.sin(a)*(R-40));}}
  if(kind==='S'){x.strokeStyle='#c8322b';x.lineWidth=5;x.beginPath();x.arc(c,c,R-8,(-90-135+270*85/120)*Math.PI/180,(-90-135+270)*Math.PI/180);x.stroke();x.font='700 18px '+FONT;x.fillText('km/h',c,c+48);}
  else{x.font='700 14px '+FONT;x.fillText('×100kPa',c,c+42);x.fillStyle='#c8322b';x.fillText('赤：ブレーキ',c,c+62);x.fillStyle='#15161a';x.fillText('黒：元空気ダメ',c,c+80);}});}
function mkGauge(k,g){const Rg=0.092,ring=new THREE.Mesh(new THREE.CylinderGeometry(Rg+0.012,Rg+0.012,0.035,40),CM.frame);ring.rotation.x=Math.PI/2;ring.position.z=-0.012;g.add(ring);
  const face=new THREE.Mesh(new THREE.CircleGeometry(Rg,48),new THREE.MeshBasicMaterial({map:gaugeFace(k)}));face.position.z=0.006;g.add(face);
  const needles=[];for(const col of (k==='S'?[0xe8731e]:[0x15161a,0xc8322b])){const pv=new THREE.Group();pv.position.z=0.009+needles.length*0.002;g.add(pv);
    const nd=new THREE.Mesh(boxGeo(0.005,Rg*0.86,0.002),new THREE.MeshBasicMaterial({color:col}));nd.position.y=Rg*0.36;pv.add(nd);needles.push(pv);}
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.009,0.009,0.01,16),CM.frame);cap.rotation.x=Math.PI/2;cap.position.z=0.014;g.add(cap);
  const hp=cplane(Rg*2.2,Rg*2.2,CM.hit,0,0,0.02,g);hp.userData.act='mon'+k;INTER.push(hp);GAUGE[k]={needles,cur:[0,0]};}
const PAPER=mkCanvas(512,384);
function updGauges(dt){if(!OWNOLD||!GAUGE.S)return;const t=performance.now()/1000,f=(v,mx)=>(-135+270*clamp(v/mx,0,1.02))*Math.PI/180,k=1-Math.exp(-dt*7);
  const tg=[[GAUGE.S,0,f(G.v*3.6,120)],[GAUGE.I,0,f(830+Math.sin(t*0.07)*38,1000)],[GAUGE.I,1,f(G.bc,1000)]];
  for(const [gg,i,a] of tg){gg.cur[i]+=(a-gg.cur[i])*k;gg.needles[i].rotation.z=-gg.cur[i]+Math.sin(t*23+i)*0.004*Math.min(1,G.v);}}
function drawPaper(){if(!OWNOLD)return;const x=PAPER.x,W=512,H=384;x.fillStyle='#f2ecdc';x.fillRect(0,0,W,H);x.fillStyle='#e6ddc4';x.fillRect(0,0,W,40);
  x.fillStyle='#2a2a2a';x.font='700 22px '+FONT;x.textAlign='left';x.textBaseline='middle';const rn=(typeof ROUTES!=='undefined'&&ROUTES[G.route])?ROUTES[G.route].name:'支線';const dn=G.list?STATIONS[G.list[G.list.length-1]].name:'';x.fillText('行路表　'+rn+'　普通　'+dn+'行',14,21);
  x.font='500 15px '+FONT;x.fillStyle='#555';x.fillText('駅名',30,56);x.fillText('着',300,56);x.fillText('発',400,56);x.strokeStyle='#8a806a';x.lineWidth=1;
  const v0=G.atStation!==null?G.atStation:G.nv;for(let k=0;k<10;k++){const v=v0+k;if(G.list&&v>lastStop())break;const st=stOf(v),y=86+k*29;
    x.beginPath();x.moveTo(10,y+14);x.lineTo(W-10,y+14);x.stroke();x.fillStyle='#1b1b1b';x.font='700 20px '+FONT;x.fillText(st.name,30,y);
    const pl=G.plan[v];x.font='500 19px '+FONT;x.fillText(pl?hms2(pl.arr):'―',300,y);x.fillText(pl&&pl.dep?hms2(pl.dep):(pl?hms2(pl.arr+30000):'―'),400,y);
    if(k===0){x.fillStyle='#c8322b';x.fillText('▶',8,y);}}
  PAPER.tex.needsUpdate=true;}
for(const [k,deg] of MONDEF){if(OWNOLD&&(k==='L'||k==='R'))continue; /* 支線：乗降モニターなし */
  if(OWNOLD){const a=deg*Math.PI/180,g=new THREE.Group();g.position.set(XE+MR*Math.sin(a),MY,ZE-MR*Math.cos(a));g.rotation.set(-0.27,-a,0,'YXZ');cab.add(g);
    if(k==='M'){cbox(MW+0.03,MH+0.03,0.012,CM.desk,0,0,-0.008,g);const p=cplane(MW,MH,basic(PAPER.tex),0,0,0.001,g);p.userData.act='monM';INTER.push(p);cbox(0.06,0.02,0.01,CM.frame,0,MH/2+0.004,0.004,g);}
    else mkGauge(k,g);MON[k]={g,screens:[],w:MW,h:MH};continue;}
  const big=k==='L'||k==='R',mw=big?MW*MONBIG:MW,mh=big?MH*MONBIG:MH,a=deg*Math.PI/180,g=new THREE.Group();
  g.position.set(XE+MR*Math.sin(a),big&&!OLDMON?MY+0.05:MY,ZE-MR*Math.cos(a));g.rotation.set(-0.27,-a,0,'YXZ');cab.add(g);
  cbox(mw+0.018,mh+0.018,0.02,CM.frame,0,0,-0.012,g);cbox(mw+0.02,0.24,0.16,CM.desk,0,-0.06,-0.1,g);
  const m={g,screens:[],w:mw,h:mh};
  if(big&&OLDMON){for(let q=0;q<2;q++){const mat=new THREE.MeshBasicMaterial({map:CANV.NS.tex});const p=cplane(mw,mh/2-0.002,mat,0,q===0?mh/4:-mh/4,0.001,g);p.userData.act='mon'+k;INTER.push(p);m.screens.push({p,mat});}
    const olay=cplane(mw,mh,basic(CANV[k].tex,true),0,0,0.003,g);olay.renderOrder=2;olay.userData.act='mon'+k;INTER.push(olay);}
  else if(big){for(let q=0;q<4;q++){const mat=new THREE.MeshBasicMaterial({map:CANV.NS.tex});const p=cplane(mw/2-0.002,mh/2-0.002,mat,(q%2?1:-1)*mw/4,(q<2?1:-1)*mh/4,0.001,g);p.userData.act='mon'+k;INTER.push(p);m.screens.push({p,mat});}
    const olay=cplane(mw,mh,basic(CANV[k].tex,true),0,0,0.003,g);olay.renderOrder=2;olay.userData.act='mon'+k;INTER.push(olay);}
  else{const p=cplane(MW,MH,basic(CANV[k].tex),0,0,0.001,g);p.userData.act='mon'+k;INTER.push(p);m.screens.push({p});}
  MON[k]=m;}
// big buttons row (promotion / broadcast / horn moved to the touch panel)
const BR=0.74,BY=YE-0.42;
const BTNDEF=[['lo','左 戸開','#f2efe6','#111',-36],['lc','左 戸閉','#c22f28','#fff',-26],['ato','ATO','#1f7a4a','#fff',-17.5],
  ['auto','完全オート','#6a3fa0','#fff',17.5],['ro','右 戸開','#f2efe6','#111',26],['rc','右 戸閉','#c22f28','#fff',36]];
const BTN={};
BTNDEF.filter(b=>MINI?false:OWNOLD?b[0]==='ato':!(BRANCH&&b[0]==='auto')).forEach(([act,txt,bg,fg,deg])=>{const a=deg*Math.PI/180,g=new THREE.Group();g.position.set(XE+BR*Math.sin(a),BY,ZE-BR*Math.cos(a));g.rotation.set(-0.62,-a,0,'YXZ');cab.add(g);
  cbox(0.13,0.1,0.05,CM.desk,0,0,-0.035,g);cbox(0.13,0.2,0.08,CM.desk,0,-0.1,-0.06,g);
  const cap=new THREE.Group();g.add(cap);
  cbox(0.126,0.088,0.012,CM.metal,0,0,-0.006,g); // メタリック保護枠リング
  cbox(0.118,0.08,0.018,CM.frame,0,0,0,cap);
  const tex=canvasTex(256,170,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=8;x.strokeRect(4,4,w-8,h-8);
    x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.font='700 '+(txt.length>4?42:txt.length>3?50:62)+'px '+FONT;x.fillText(txt,w/2,h/2+4);});
  const mat=new THREE.MeshBasicMaterial({map:tex,color:0xbbbbbb});cplane(0.112,0.074,mat,0,0,0.0095,cap);
  const hit=cplane(0.135,0.105,CM.hit,0,0,0.026,g);hit.userData.act=act;INTER.push(hit);BTN[act]={cap,mat};});
// touch panel under the center monitor: 乗降促進 / 放送 / 警笛
const TP={w:0.27,h:0.15};
{const g=new THREE.Group();g.position.set(XE,BY+0.005,ZE-BR);g.rotation.set(-0.62,0,0,'YXZ');cab.add(g);
  cbox(TP.w+0.02,TP.h+0.02,0.03,CM.frame,0,0,-0.016,g);cbox(TP.w+0.02,0.2,0.08,CM.desk,0,-0.1,-0.06,g);
  CANV.T=mkCanvas(512,284);
  if(!OWNOLD){const p=cplane(TP.w,TP.h,basic(CANV.T.tex),0,0,0.001,g);p.userData.act='panel';INTER.push(p);MON.T={g,screens:[{p}]};}
  else{cbox(TP.w,TP.h,0.004,CM.top,0,0,0.001,g); /* 押しボタンの並び */
    const PB=[['hornA','空気笛','#d9d4c4','#111'],['hornE','電気笛','#d9d4c4','#111'],['ann0','案内','#2c5aa0','#fff'],['ann1','お詫び','#2c5aa0','#fff'],['ann2','停車','#2c5aa0','#fff'],['ann3','発車','#2c5aa0','#fff']];
    PB.forEach(([act,txt,bg,fg],i)=>{const cx=-TP.w/2+0.024+(i%3)*0.111,cy=i<3?0.035:-0.035,bg2=new THREE.Group();bg2.position.set(cx+0.02,cy,0.004);g.add(bg2);
      const cap=new THREE.Group();bg2.add(cap);cbox(0.085,0.05,0.016,CM.frame,0,0,0,cap);
      const tex=canvasTex(256,150,(x,w,h)=>{x.fillStyle=bg;x.fillRect(0,0,w,h);x.strokeStyle='rgba(0,0,0,.5)';x.lineWidth=8;x.strokeRect(4,4,w-8,h-8);x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.font='700 '+(txt.length>2?52:62)+'px '+FONT;x.fillText(txt,w/2,h/2+4);});
      const mat=new THREE.MeshBasicMaterial({map:tex});cplane(0.08,0.046,mat,0,0,0.0085,cap);const hit=cplane(0.09,0.06,CM.hit,0,0,0.02,bg2);hit.userData.act=act;INTER.push(hit);BTN[act]={cap,mat};});
    MON.T={g,screens:[]};}}
const EXITB={};
for(const [k,x,ry] of [['L',-1.335,Math.PI/2],['R',1.335,-Math.PI/2]]){const kc=mkCanvas(256,160);const mat=new THREE.MeshBasicMaterial({map:kc.tex});
  const g=new THREE.Group();g.position.set(x,2.45,1.95);g.rotation.y=ry;cab.add(g);cbox(0.3,0.2,0.02,CM.frame,0,0,-0.012,g);
  const p=cplane(0.28,0.175,mat,0,0,0.001,g);p.userData.act='exit'+k;INTER.push(p);EXITB[k]={kc,mat,last:-1};}
/* ===== 新形車両（v1.9.0）：側面のデジタル表示パネル（左＝駅・時刻案内／右＝車両情報TIMS） ===== */
const CANV2={WL:mkCanvas(640,384),WR:mkCanvas(640,384)};
if(!OWNOLD)for(const [k,sx] of [['WL',-1],['WR',1]]){const g=new THREE.Group();g.position.set(sx*1.30,2.47,0.55);g.rotation.y=(sx>0?-1:1)*(Math.PI/2-0.30);cab.add(g);
  cbox(0.42,0.26,0.026,CM.frame,0,0,-0.016,g);cbox(0.42,0.02,0.09,CM.metal,0,-0.14,-0.05,g);cbox(0.06,0.06,0.10,CM.frame,sx*0.19,0,-0.06,g);
  cbox(0.40,0.016,0.03,CM.accentDim,0,-0.145,-0.004,g);
  const p=cplane(0.38,0.222,basic(CANV2[k].tex),0,0,0.001,g);p.userData.act='mon'+k;INTER.push(p);MON[k]={g,w:0.38,h:0.222,screens:[{p}]};}
const LEANB={};
if(OWNOLD||CONDV)for(const [k,x,ry] of [['L',-1.335,Math.PI/2],['R',1.335,-Math.PI/2]]){const g=new THREE.Group();g.position.set(x,2.45,1.5);g.rotation.y=ry;cab.add(g);cbox(0.3,0.2,0.02,CM.frame,0,0,-0.012,g);
  const tex=canvasTex(256,160,(c,w,h)=>{c.fillStyle='#7a4a12';c.fillRect(0,0,w,h);c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font='700 32px '+FONT;c.fillText('窓から顔を出す',w/2,58);c.font='500 19px '+FONT;c.fillStyle='#ffe2b0';c.fillText('乗降確認・戸閉・発車メロディ',w/2,104);});
  const p=cplane(0.28,0.175,new THREE.MeshBasicMaterial({map:tex}),0,0,0.001,g);p.userData.act='lean'+k;INTER.push(p);LEANB[k]=g;}
function drawExitBtn(k,f,ok){const E=EXITB[k];const key=Math.round(f*40)+(ok?100:0);if(E.last===key)return;E.last=key;const x=E.kc.x;
  x.fillStyle=ok?'#1d3f7a':'#2a2d33';x.fillRect(0,0,256,160);x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='700 30px '+FONT;x.fillText('ホームへ出る',128,48);
  x.font='500 20px '+FONT;x.fillStyle=ok?'#cfe0ff':'#8a93a3';x.fillText(ok?'長押し':'停車中のみ',128,86);
  x.fillStyle='#0b1220';x.fillRect(24,112,208,24);x.fillStyle='#ffd23f';x.fillRect(24,112,208*f,24);E.kc.tex.needsUpdate=true;}

/* ===== リアル運転台の本格装備（ワンハンドルマスコン・逆転器・スタフ差し・表示灯・遮光フード・ワイパー・バイザー・マイク） ===== */
// 1. ワンハンドルマスコン（Master Controller）
const masconRig = new THREE.Group();
masconRig.position.set(-0.62, 2.12, 0.78);
cab.add(masconRig);

// 台座コンソール（黒マット樹脂＋金属ボルト）
cbox(0.20, 0.08, 0.30, CM.desk, 0, 0.04, 0, masconRig);
cbox(0.19, 0.006, 0.28, CM.metal, 0, 0.082, 0, masconRig);
// 目盛りガイドプレート（P5〜P1・N・B1〜B8・EB）
const MC_PLATE_TEX = canvasTex(256, 384, (x, w, h) => {
  x.fillStyle = '#1e2229'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#475569'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
  x.fillStyle = '#0f172a'; x.fillRect(w/2 - 16, 20, 32, h - 40);
  x.textAlign = 'right'; x.font = '700 22px ' + FONT;
  // 奥側：力行（P1〜P5）
  const pList = ['P5', 'P4', 'P3', 'P2', 'P1'];
  pList.forEach((p, i) => {
    const y = 50 + i * 28;
    x.fillStyle = '#22c55e'; x.fillText(p, w/2 - 24, y);
    x.fillRect(w/2 - 12, y - 4, 24, 6);
  });
  // 中央：中立（N）
  x.fillStyle = '#f8fafc'; x.textAlign = 'center';
  x.fillText('N', w/2 - 30, 200);
  x.fillStyle = '#e2e8f0'; x.fillRect(w/2 - 16, 196, 32, 8);
  // 手前側：制動（B1〜B8、EB）
  const bList = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'EB'];
  bList.forEach((b, i) => {
    const y = 232 + i * 15;
    x.fillStyle = (b === 'EB') ? '#ef4444' : '#f97316';
    x.textAlign = 'right'; x.fillText(b, w/2 - 24, y);
    x.fillRect(w/2 - 12, y - 3, 24, 5);
  });
});
const mcScalePlane = cplane(0.18, 0.26, basic(MC_PLATE_TEX), 0, 0.086, 0, masconRig);
mcScalePlane.rotation.x = -Math.PI / 2;

// 可動レバー機構（ピボット）
const masconPivot = new THREE.Group();
masconPivot.position.set(0, 0.075, 0.03);
masconRig.add(masconPivot);

// レバー主軸（クロムメッキスチール・高精細円筒）
const mcShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.20, 32), CM.metal);
mcShaft.position.set(0, 0.10, 0);
masconPivot.add(mcShaft);

// グリップ接続ブロック
cbox(0.045, 0.035, 0.045, CM.frame, 0, 0.19, 0, masconPivot);

// 横型エルゴノミクスT字グリップ（マットブラック仕上げ・高精細円筒）
const mcGripBar = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.18, 36), CM.grip);
mcGripBar.rotation.z = Math.PI / 2;
mcGripBar.position.set(0, 0.205, 0);
masconPivot.add(mcGripBar);

// デッドマントリガー／ノッチ解除ボタン（グリップ左端のシルバー部）
const mcDeadman = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.02, 32), CM.metal);
mcDeadman.rotation.z = Math.PI / 2;
mcDeadman.position.set(-0.095, 0.205, 0);
masconPivot.add(mcDeadman);

// グリップ右端キャップ
const mcGripCapR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 32), CM.frame);
mcGripCapR.rotation.z = Math.PI / 2;
mcGripCapR.position.set(0.092, 0.205, 0);
masconPivot.add(mcGripCapR);

// マスコンクリック判定（ズーム用）
const mcHit = cplane(0.22, 0.30, CM.hit, 0, 0.14, 0, masconRig);
mcHit.userData.act = 'monMC';
INTER.push(mcHit);

let masconAngle = 0;
let masconVel = 0;
function updMascon3D(dt) {
  if (typeof masconPivot === 'undefined' || !masconPivot || typeof G === 'undefined' || !G) return;
  const n = G.manual ? (G.mnotch || 0) : (G.notch || 0);
  const targetAngle = n > 0 ? (-n / 5 * 0.38) : (-n / 8 * 0.44);
  
  // 臨界減衰（スプリングダンパー）による滑らかで物理的なマスコン追従
  // 急な切り替わりでもレバーの質量と慣性によって、カクつかず滑らかに追従する
  const omega = 14.0;
  const f = 1.0 + 2.0 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1.0 / (f + hhoo);
  const diff = targetAngle - masconAngle;
  masconAngle = (f * masconAngle + dt * masconVel + hhoo * targetAngle) * detInv;
  masconVel = (masconVel + hoo * diff) * detInv;
  masconPivot.rotation.x = masconAngle;
}

// 2. 逆転器（レバーサーハンドル）
const revRig = new THREE.Group();
revRig.position.set(-0.48, 2.12, 0.68);
cab.add(revRig);
cbox(0.07, 0.04, 0.09, CM.desk, 0, 0.02, 0, revRig);
// 逆転器銘板（前・切・後）
const REV_PLATE_TEX = canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#1e293b'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#f8fafc'; x.font = '700 24px ' + FONT; x.textAlign = 'center';
  x.fillText('前', w/2, 28); x.fillText('切', w/2, 68); x.fillText('後', w/2, 108);
});
const revPlate = cplane(0.06, 0.08, basic(REV_PLATE_TEX), 0, 0.041, 0, revRig);
revPlate.rotation.x = -Math.PI / 2;

// 逆転ハンドル（真鍮/クロム仕上げ）
const revHandle = new THREE.Group();
revHandle.position.set(0, 0.04, 0);
revHandle.rotation.x = -0.28; // 「前進」位置にセット
revRig.add(revHandle);
const revShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), CM.metal);
revShaft.position.set(0, 0.03, 0);
revHandle.add(revShaft);
const revBall = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), CM.metal);
revBall.position.set(0, 0.06, 0);
revHandle.add(revBall);

// 3. 行路表（スタフ差し）＆フレキシブルLEDスタフ灯
const stafGroup = new THREE.Group();
stafGroup.position.set(-0.80, 2.22, 0.58);
stafGroup.rotation.set(-0.35, 0.38, 0, 'YXZ');
cab.add(stafGroup);
// アルミ台座ボード＆上部バインダークリップ
cbox(0.13, 0.17, 0.006, CM.metal, 0, 0, 0, stafGroup);
cbox(0.07, 0.016, 0.014, CM.frame, 0, 0.08, 0.008, stafGroup);
// スタフ用紙（運行スケジュール表）
const STAF_CANV = mkCanvas(256, 340);
function drawStaf() {
  if (typeof G === 'undefined' || !G) return;
  const x = STAF_CANV.x, W = 256, H = 340;
  x.fillStyle = '#faf8f0'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#b91c1c'; x.lineWidth = 4; x.strokeRect(3, 3, W - 6, H - 6);
  x.fillStyle = '#b91c1c'; x.fillRect(3, 3, W - 6, 32);
  x.fillStyle = '#fff'; x.font = '700 17px ' + FONT; x.textAlign = 'center';
  x.fillText('乗務行路表 (スタフ)', W / 2, 25);
  x.fillStyle = '#0f172a'; x.font = '700 13px ' + FONT; x.textAlign = 'left';
  const rName = (typeof ROUTES !== 'undefined' && ROUTES[G.route]) ? ROUTES[G.route].short : '環状線';
  const dName = (G.list && G.list.length && typeof stOf === 'function') ? stOf(G.list[G.list.length - 1]).name : '汐見';
  const dirLabel = BRANCH ? '' : (G.dir < 0 ? '内回り' : '外回り');
  const maxSpd = (typeof KIND !== 'undefined' && KIND[G.key] === 'exp') ? 210 : (KIND[G.key] === 'ltd' ? 150 : (KIND[G.key] === 'rapid' ? 120 : (BRANCH ? 85 : 100)));
  x.fillText('種別: ' + rName + (dirLabel ? ' ' + dirLabel : ''), 12, 53);
  x.fillText('行先: ' + dName + ' 行き', 12, 70);
  x.fillText('最高速度: ' + maxSpd + ' km/h', 12, 87);
  x.strokeStyle = '#475569'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(8, 97); x.lineTo(W - 8, 97); x.stroke();
  x.fillStyle = '#334155'; x.font = '700 12px ' + FONT;
  x.fillText('駅名', 14, 114); x.fillText('着', 132, 114); x.fillText('発', 192, 114);
  const curV = (G.atStation !== null ? G.atStation : G.nv);
  for (let k = 0; k < 7; k++) {
    const v = curV + k;
    if (G.list && v >= G.list.length) break;
    const st = (typeof stOf === 'function') ? stOf(v) : null;
    if (!st) break;
    const pl = G.plan ? G.plan[v] : null;
    const y = 138 + k * 27;
    x.fillStyle = (k === 0) ? '#dbeafe' : (k % 2 ? '#f1f5f9' : '#faf8f0');
    x.fillRect(6, y - 18, W - 12, 25);
    x.fillStyle = (k === 0) ? '#1d4ed8' : '#0f172a';
    x.font = (st.big ? '700 ' : '500 ') + '13px ' + FONT;
    x.fillText(st.name, 12, y);
    x.font = '500 12px ' + FONT;
    x.fillText(pl ? hms2(pl.arr) : '―', 130, y);
    x.fillText(pl && pl.dep ? hms2(pl.dep) : (pl ? hms2(pl.arr + 30000) : '―'), 190, y);
  }
  STAF_CANV.tex.needsUpdate = true;
}
const stafMesh = cplane(0.118, 0.154, basic(STAF_CANV.tex), 0, -0.004, 0.005, stafGroup);
// スタフクリック判定（ズーム用）
const stafHit = cplane(0.14, 0.18, CM.hit, 0, 0, 0.01, stafGroup);
stafHit.userData.act = 'monSTAF';
INTER.push(stafHit);

// LEDスタフ灯（白色フレキシブルアーム）
const stafArm = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.07, 8), CM.metal);
stafArm.position.set(0, 0.095, 0.02);
stafArm.rotation.x = 0.45;
stafGroup.add(stafArm);
const stafLamp = cbox(0.05, 0.016, 0.022, CM.frame, 0, 0.125, 0.038, stafGroup);
cbox(0.042, 0.008, 0.012, new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.12, 0.04, stafGroup);

// 4. 表示灯ユニット（ステータスインジケーターランプ群）
const indRig = new THREE.Group();
indRig.position.set(XE, MY + MH / 2 + 0.035, ZE - MR + 0.01);
indRig.rotation.set(-0.27, 0, 0, 'YXZ');
cab.add(indRig);
cbox(0.44, 0.046, 0.022, CM.frame, 0, 0, -0.01, indRig);

const IND_CANV = mkCanvas(512, 64);
const IND_MAT = new THREE.MeshBasicMaterial({ map: IND_CANV.tex });
let _ebAnnSent = false;   /* v1.9.7：初回描画時にTDZ参照エラーにならないよう先に宣言 */
function drawIndicatorLamps() {
  if (typeof G === 'undefined' || !G) return;
  const x = IND_CANV.x, W = 512, H = 64;
  x.fillStyle = '#080c14'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#1e293b'; x.lineWidth = 3; x.strokeRect(1, 1, W - 2, H - 2);

  const closed = (G.door && G.door.state === 'closed');
  const isEB = (G.manual ? G.mnotch === -8 : G.notch === -8);
  if (G.phase === 'play' && !PAX && G.v > 2.0 && (isEB || G.dispHold || G.troubleActive)) playEmergencyStopAnn();
  else if (G.v < 0.2 || (!isEB && !G.dispHold && !G.troubleActive)) _ebAnnSent = false;
  const isATO = !!G.ato;
  const isAuto = !!G.auto;
  const lim = (typeof limitFor === 'function' ? limitFor(G.key, G.s) : 99) || 99;
  const isOver = (G.v * 3.6 > lim + 3);

  const lamps = [
    { label: '通電', on: true, onCol: '#e2e8f0', bgCol: '#1e293b' },
    { label: '戸閉', on: closed, onCol: '#f59e0b', bgCol: '#451a03' },
    { label: 'ATS-P', on: true, onCol: '#06b6d4', bgCol: '#083344' },
    { label: 'ATO', on: isATO, onCol: '#10b981', bgCol: '#064e3b' },
    { label: '自動', on: isAuto, onCol: '#a855f7', bgCol: '#3b0764' },
    { label: '過速', on: isOver, onCol: '#eab308', bgCol: '#422006' },
    { label: '非常B', on: isEB, onCol: '#ef4444', bgCol: '#450a0a' },
  ];

  const lw = (W - 16) / lamps.length;
  lamps.forEach((lamp, i) => {
    const lx = 8 + i * lw;
    x.fillStyle = lamp.on ? lamp.bgCol : '#0a0f1d';
    x.fillRect(lx + 2, 7, lw - 4, H - 14);
    x.strokeStyle = lamp.on ? lamp.onCol : '#334155';
    x.lineWidth = lamp.on ? 2 : 1;
    x.strokeRect(lx + 2, 7, lw - 4, H - 14);
    x.fillStyle = lamp.on ? lamp.onCol : '#475569';
    x.font = '700 17px ' + FONT;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(lamp.label, lx + lw / 2, H / 2 + 1);
  });
  IND_CANV.tex.needsUpdate = true;
}
cplane(0.428, 0.038, IND_MAT, 0, 0, 0.002, indRig);

// 5. モニター遮光フードキャノピー（グラスコックピット上部の日よけフード）
{
  const hoodMat = lam(0x181c22);
  const hoodGroup = new THREE.Group();
  hoodGroup.position.set(XE, MY + MH / 2 + 0.062, ZE - MR);
  hoodGroup.rotation.set(-0.27, 0, 0, 'YXZ');
  cab.add(hoodGroup);
  cbox(0.72, 0.016, 0.10, hoodMat, 0, 0, 0.04, hoodGroup);
  cbox(0.014, 0.22, 0.09, hoodMat, -0.36, -0.10, 0.035, hoodGroup);
  cbox(0.014, 0.22, 0.09, hoodMat, 0.36, -0.10, 0.035, hoodGroup);
}

// 6. 大型フロントガラスワイパー（ダブルリンク式）
{
  const wiperMat = lam(0x1e242c);
  const wiperBase = new THREE.Group();
  wiperBase.position.set(-0.76, 2.33, 0.15);
  cab.add(wiperBase);
  cbox(0.045, 0.03, 0.04, CM.frame, 0, 0, 0, wiperBase);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.42, 8), wiperMat);
  arm1.rotation.z = -1.15;
  arm1.position.set(0.18, 0.09, 0.006);
  wiperBase.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.40, 8), wiperMat);
  arm2.rotation.z = -1.15;
  arm2.position.set(0.18, 0.11, 0.006);
  wiperBase.add(arm2);
  const blade = cbox(0.58, 0.012, 0.012, CM.frame, 0.32, 0.18, 0.01, wiperBase);
  blade.rotation.z = -0.06;
}

// 7. アクリル製サンバイザー（スモーク日よけ）
{
  const visorMat = new THREE.MeshBasicMaterial({ color: 0x111c26, transparent: true, opacity: 0.65, side: DS });
  const visorRig = new THREE.Group();
  visorRig.position.set(-0.54, 3.32, 0.32);
  visorRig.rotation.x = -0.52;
  cab.add(visorRig);
  cbox(0.74, 0.26, 0.006, visorMat, 0, 0, 0, visorRig);
  cbox(0.70, 0.012, 0.014, CM.metal, 0, 0.13, 0.004, visorRig);
  cbox(0.016, 0.04, 0.02, CM.metal, -0.25, 0.14, 0.01, visorRig);
  cbox(0.016, 0.04, 0.02, CM.metal, 0.25, 0.14, 0.01, visorRig);
}

// 8. 車内後方確認用ルームミラー（曲面鏡）
{
  const mirrorRig = new THREE.Group();
  mirrorRig.position.set(0.20, 3.22, 0.26);
  mirrorRig.rotation.set(-0.25, -0.55, 0, 'YXZ');
  cab.add(mirrorRig);
  const mArm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.08, 8), CM.metal);
  mArm.rotation.z = Math.PI / 4;
  mArm.position.set(-0.02, 0.02, 0);
  mirrorRig.add(mArm);
  cbox(0.18, 0.09, 0.014, CM.metal, 0, 0, 0, mirrorRig);
  cbox(0.17, 0.082, 0.003, new THREE.MeshBasicMaterial({ color: 0x93c5fd }), 0, 0, 0.008, mirrorRig);
}

// 9. 乗務員連絡マイク（グースネック式）
{
  const micRig = new THREE.Group();
  micRig.position.set(0.08, 2.12, 0.72);
  cab.add(micRig);
  cbox(0.05, 0.025, 0.05, CM.frame, 0, 0.012, 0, micRig);
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8), CM.metal);
  t1.position.set(0, 0.07, 0);
  t1.rotation.set(0.3, -0.2, 0);
  micRig.add(t1);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.025, 12), CM.grip);
  head.position.set(-0.015, 0.13, 0.035);
  head.rotation.set(0.5, -0.2, 0);
  micRig.add(head);
}

cab.traverse(o=>o.layers.set(2));
/* 支線：窓のすぐ後ろの車体側面にある操作箱（戸開・戸閉・発車メロディ）。顔を出したときに押す物理ボタン */
const LEANP={};
if(OWNOLD)for(const side of [-1,1]){const g=new THREE.Group();g.position.set(side*1.46,2.52,1.9-CARHALF);g.rotation.y=Math.atan2(side*0.866,-0.5);ownTrain.cars[0].add(g); /* 電車（1号車）に取り付け：電車がいないときは出ない */
  cbox(0.37,0.16,0.05,CM.frame,0,0,-0.026,g);cbox(0.39,0.03,0.07,CM.desk,0,0.095,-0.02,g);
  [['lnOpen','戸開','#efece2','#111'],['lnClose','戸閉','#c22f28','#fff'],['lnMelo','メロディ','#e0a21a','#111']].forEach(([act,txt,bg,fg],i)=>{
    const bx=(i-1)*0.115,bg2=new THREE.Group();bg2.position.set(bx,-0.005,0);g.add(bg2);const cap=new THREE.Group();bg2.add(cap);
    const cyl=new THREE.Mesh(new THREE.CylinderGeometry(0.042,0.046,0.025,24),CM.frame);cyl.rotation.x=Math.PI/2;cap.add(cyl);
    const tex=canvasTex(256,256,(x,w,h)=>{x.fillStyle=bg;x.beginPath();x.arc(w/2,h/2,120,0,7);x.fill();x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=12;x.stroke();
      x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.font='800 '+(txt.length>2?54:78)+'px '+FONT;x.fillText(txt,w/2,h/2+4);});
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:0.3});const face=new THREE.Mesh(new THREE.CircleGeometry(0.04,28),mat);face.position.z=0.0135;cap.add(face);
    const hit=cplane(0.11,0.13,CM.hit,0,0,0.03,bg2);hit.userData.act=act;hit.userData.lean=true;hit.userData.side=side;INTER.push(hit);BTN[act+side]={cap,mat};});
  g.traverse(o=>o.layers.set(1));LEANP[side]=g;} /* 外から見える（ホームからも見える）。運転席からは見えない */
function relayoutLean(){for(const side of [-1,1]){const g=LEANP[side];if(!g)continue;const car=ownTrain.cars[0];car.add(g);
  if(ownTrain.rev){g.position.set(-side*1.46,2.52,CARHALF-1.9);g.rotation.y=Math.atan2(side*0.866,-0.5)+Math.PI;}else{g.position.set(side*1.46,2.52,1.9-CARHALF);g.rotation.y=Math.atan2(side*0.866,-0.5);}}}
const EYE_L={p:CONDV?new THREE.Vector3(XE+0.05,YE,ZE+0.12):new THREE.Vector3(XE,YE,ZE),pitch:CONDV?-0.14:-0.19},EYE_P={p:CONDV?new THREE.Vector3(XE+0.05,YE,ZE+0.75):new THREE.Vector3(XE,YE+0.12,ZE+0.75),pitch:-0.3};
camera.position.copy(EYE_L.p);camera.rotation.set(EYE_L.pitch,0,0);
rig.updateMatrixWorld(true);
const ZOOM={};
for(const k in MON){const c=new THREE.Vector3(),q=new THREE.Quaternion();MON[k].g.getWorldPosition(c);MON[k].g.getWorldQuaternion(q);ZOOM[k]={c,n:new THREE.Vector3(0,0,1).applyQuaternion(q),sc:(k==='L'||k==='R')?MONBIG:1};}
setTimeout(()=>{
  if(typeof masconRig!=='undefined'&&masconRig){const c=new THREE.Vector3();masconRig.getWorldPosition(c);c.y+=0.12;ZOOM.MC={c,n:new THREE.Vector3(0,0.6,0.8).normalize(),sc:1.6};}
  if(typeof stafGroup!=='undefined'&&stafGroup){const c=new THREE.Vector3();stafGroup.getWorldPosition(c);ZOOM.STAF={c,n:new THREE.Vector3(0.3,0.4,0.8).normalize(),sc:1.5};}
},500);

/* platform cameras (two per side: cars 1-3 and 4-6) */
const monCam=OLDMON?new THREE.PerspectiveCamera(26,384/144,0.1,500):new THREE.PerspectiveCamera(40,4/3,0.1,500);monCam.layers.enable(1);
function monQuads(){const NC=ownTrain.cars.length;if(OLDMON)return [{i0:0,n:Math.min(3,NC)},NC>3?{i0:3,n:NC-3}:null];const c=Math.max(2,Math.ceil(NC/4)),out=[];
  for(let q=0;q<4;q++)out.push(q*c<NC?{i0:q*c,n:Math.min(c,NC-q*c)}:null);return out;}
function aimCamQ(st,Q){const T=TK[G.key],isLtd=!BRANCH&&(G.key==='G'||G.key==='H'),isSh=!BRANCH&&!isLtd&&st.i===0,sd=isSh?-T.side(st):T.side(st),F=st.s+T.so,dr=G.dir,base=isSh?ownTrackOff(G.key,st.s):T.off(st.s);
  const camOff=(s,o,y)=>isLtd?offsG(s,o,LTD_DEPTH+y):offs(s,o,y);
  if(OLDMON){if(Q.i0===0){monCam.position.copy(camOff(F+dr*14,base+sd*3.0,4.3));monCam.lookAt(camOff(F-dr*62,base+sd*1.45,1.6));}
    else{monCam.position.copy(camOff(F-dr*57,base+sd*3.1,4.3));monCam.lookAt(camOff(F-dr*126,base+sd*1.45,1.6));}return;}
  const S0=F-dr*Q.i0*CARL,S1=F-dr*(Q.i0+Q.n)*CARL;
  monCam.position.copy(camOff(S0+dr*(Q.i0===0?14:4),base+sd*3.0,4.3));monCam.lookAt(camOff(S1-dr*3,base+sd*1.45,1.6));}

/* ================= state ================= */
const G={s:STATIONS[0].s,v:0,notch:-4,bc:300,mr:830,comp:false,phase:'title',nv:0,atStation:0,depCheck:null,
  door:{state:'closed',frac:0,side:-1,local:-1},flowPending:false,flowV:-1,runnerPlanned:false,runnerSpawned:false,runnerT:0,
  promoted:{},said:{},roll:0,lat:0,asked:false,promoOn:false,waiting:null,walkOn:false,hold:null,panel:'main',panelZoomed:false,auto:false,autoT:0,autoPh:'',mainKey:'A',arrKey:null,plan:{},hornT:0,clackDist:0,lastInterlock:0,lookY:0,lookP:0,zoom:null,msg:null,prevV:0,ato:false,depAt:0};
window.G = G;
const ROUTES=SERVICES;
let PAX=false; // passenger mode
let RIDE=null; // train the passenger is riding
let STAFF=false;let staffTask=null;let staffScore=0; /* 駅員モード削除 */
Object.assign(G,{key:'A',dir:1,list:null,start:0,route:'out',mainKey:'A'});
const stopIdx=v=>G.list?G.list[clamp(v,0,G.list.length-1)]:G.cyc[mod(G.cpos+v,G.cyc.length)];
G.cyc=STATIONS.map(s=>s.i);G.cpos=0;
const stOf=v=>STATIONS[stopIdx(v)];
window.stOf = stOf;
try { if (typeof drawIndicatorLamps === 'function') drawIndicatorLamps(); if (typeof drawStaf === 'function') drawStaf(); } catch(e) { console.error('init cab draws', e); }

/* ================= voice (完全事前録音音声化：OS合成音声は使用しない) ================= */
const SS=()=>null;
function pickVoice(){}
function mkU(text,kind,vol){return null;}
function unlockSpeech(){}
function say(text,kind,urgent,vol){}
function sayJE(ja,en,urgent){}
function sayManual(ja,en){}
function liveSay(ja){}
function toggleLive(){LIVE=!LIVE;try{localStorage.setItem('td_live',LIVE?'1':'0');}catch(e){}toast(LIVE?'肉声放送 ON：駅の案内を自分の声で行います':'肉声放送 OFF','info');
  if(LIVE&&liveAvail()){G.liveDep=G.v>4?G.nv:null;G.liveAppr=null;G.liveArr=G.atStation;}updLive();}
function updLive(){const b=document.getElementById('btnTitleReturn');if(b){b.classList.toggle('hide',G.walkOn);}}
function sayOnce(key,text,kind){}
function transferLines(st){const ls=st.lines?st.lines.filter(l=>!(BRANCH&&l[0].indexOf('汐見環状線')===0&&l!==st.lines[0])).map(l=>[BRANCH&&l[0].indexOf('汐見環状線')===0?'汐見環状線':l[0],BRANCH&&l[0].indexOf('汐見環状線')===0?'しおみかんじょうせん':l[1]]):[];if(!BRANCH&&CFG.shin===st.i)ls.unshift(['新幹線','しんかんせん']);return ls;}
function transferText(st){const ls=transferLines(st).map(l=>l[1]);return ls.length?ls.join('、')+'は、お乗り換えです。':'';}
function enList(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];}
function transferEn(st){const ls=transferLines(st).map(l=>LINE_EN[l[0]]||l[0]);return ls.length?' Please change here for '+enList(ls)+'.':'';}
const enName=st=>st.kana.replace(/-/g,' ');
/* 端末をまたいで同じ乗客を出すための「列車の停車ごとのID」。駅に着くたびに1つ増える。 */
function trainStopSeed(train){
  if(!train)return 'none';
  if(train==='OWN')return 'P-'+(typeof ONLINE_CLIENT_ID!=='undefined'?ONLINE_CLIENT_ID:'own')+'-'+(G.sq||0);
  if(train.p&&train.p.id)return 'P-'+train.p.id+'-'+(train.p.sq||0);
  return 'AI-'+(train.name||'T')+'-'+(train.sq||0);
}
const CROWD_TZ=1800000; /* 30分ごとのホームの人払い（全端末で同じ時計を使う） */
function waitCastSeed(st,k){return 'wait|'+LINE_ID+'|'+st.i+'|'+k+'|'+Math.floor(nowMs()/CROWD_TZ);}
/* ================= passengers ================= */
const pool=[],active=[];
function childRate(h){return h<6||h>=22.5?0.01:h<7?0.05:h<9?0.22:h<15?0.13:h<18.5?0.24:h<20.5?0.12:0.04;}
function pickKind(){return rng01()<childRate(hourNow())?'child':'adult';}
/* 決められた種のときは、体・顔・背丈も種から決めて作り直す（全端末で同じ見た目の人が出る） */
function setPersonLook(g,vi,child,sc){
  const u=g&&g.userData;if(!u||u.staff)return;
  vi=Math.max(0,Math.min((child?NVARC:NVAR)-1,vi|0));
  u.vi=vi;u.child=!!child;u.mode='';g.scale.set(sc,sc,sc);
  if(u.mesh)u.mesh.geometry=child?CSTANDG[vi]:STANDG[vi];
  if(u.legs&&u.legs.length)for(const l of u.legs)l.geometry=child?CLEGG[vi]:LEGG[vi];
  personPose(g,'stand');
}
function getPerson(body){let det=null;
  if(_crowdSeedDepth>0&&body!=='staff'){const child=body==='child'?true:(body==='adult'?false:(rng01()<childRate(hourNow())));const vi=Math.floor(rng01()*((child?NVARC:NVAR)));const sc=child?(0.60+rng01()*0.20):(0.90+rng01()*0.16);body=child?'child':'adult';det={vi,child,sc};}
  body=body||pickKind();let idx=-1;for(let i=pool.length-1;i>=0;i--)if(pool[i].body===body){idx=i;break;}
  let p=idx>=0?pool.splice(idx,1)[0]:null;if(!p){const g=makePerson(body==='child'?'child':body==='staff'?'staff':null);scene.add(g);p={g,body};}
  if(det)setPersonLook(p.g,det.vi,det.child,det.sc);
  p.g.visible=true;Object.assign(p,{path:[],delay:0,speed:1.3,end:null,kind:'wait',flow:'A',doorS:0,face:0,walk:0,st:-1,s:0,o:0,yaw:0,trackO:0,hidden:false,xk:null,train:null,forceIn:false,moving:false});active.push(p);return p;}
function freePerson(p){p.g.visible=false;p.g.rotation.x=0;personPose(p.g,'stand');p.hidden=false;p.delay=0;p.path=[];p.end=null;p.train=null;p.xk=null;p.trackO=0;const i=active.indexOf(p);if(i>=0)active.splice(i,1);pool.push(p);}
function greenCarsFor(kk){if(BRANCH)return [];
  if(KIND[kk]==='ltd')return [3,4];                                  /* 快速特急：2階建てグリーン車2両 */
  if(KIND[kk]==='exp'){const n=carsFor(kk);return Array.from({length:n},(_,i)=>i);} /* 特急：全車グリーン車（1階） */
  return [];}
function transferKey(st,k){ // 同じホームの反対側の線路
  if(BRANCH){if(st.cls==='Q'){const t=({A:'C',C:'A',B:'D',D:'B'})[k];return t&&serves(st,t)?t:null;} /* 2面4線：同じ島の各停⇔快速 */
    return (st.cls==='J'||st.cls==='I')?({A:'B',B:'A'})[k]||null:null;} /* 支線の島式ホームは向かい側の番線へ */
  const isl={A:'C',C:'A',B:'D',D:'B',E:'F',F:'E'},M={C:'E',E:'C',D:'F',F:'D'};
  const t=st.cls==='M'?M[k]:isl[k];return t&&serves(st,t)?t:null;}
function pickDoorIdx(doors,st){const sb=st.s-75;let tot=0;const w=doors.map(d=>{const v=1+1.4*Math.exp(-Math.abs(sdiff(d,sb))/95);tot+=v;return v;});
  let r=Math.random()*tot;for(let i=0;i<w.length;i++){r-=w[i];if(r<=0)return i;}return doors.length-1;}
function doorList(frontS,flip,gc,nc){const r=[];const G2=gc||[],NC=nc||NCAR;for(let k=0;k<NC;k++){const c=flip?frontS+CARHALF+k*CARL:frontS-CARHALF-k*CARL;
  for(const dz of (G2.indexOf(k)>=0?GDOORZ:DOORZ))r.push(flip?c+dz:c-dz);}return r;}
function doorCarOf(j,gc,nc){const G2=gc||[],NC=nc||NCAR;let n=0;for(let k=0;k<NC;k++){const c=(G2.indexOf(k)>=0?GDOORZ:DOORZ).length;if(j<n+c)return [k,(G2.indexOf(k)>=0?GDOORZ:DOORZ)[j-n]];n+=c;}return [NCAR-1,0];}
/* 電車が着いてからドアが閉まり始めるまで */
function trainArrivedAt(st,k){
  if(!PAX&&G.atStation!==null&&stOf(G.atStation)===st&&physKey(G.key,st.s)===k&&G.door.state!=='closed'&&G.door.state!=='closing')return true;
  for(const a of OT)if(a.key===k&&a.state==='dwell'&&a.stSt===st&&a.t>3.0)return true;
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      const p = ONLINE_PLAYERS[pid];
      if(!p || !p.key || physKey(p.key, st.s) !== k || p.s == null || (p.v || 0) > 0.8) continue;
      const d = Math.abs(sdiff(p.s, st.s + TK[k].so));
      if(d < 30 && p.door !== 'closed' && p.door !== 'closing') return true;
    }
  }
  return false;}
/* 階段に近いドアほど選ばれやすい（近い6か所に散らばる：全員同じドアにはならない） */
function pickDoorNearStairs(doors,st){const sb=st.s-75;const ord=doors.map((d,i)=>[Math.abs(sdiff(d,sb)),i]).sort((a,b)=>a[0]-b[0]).slice(0,Math.min(6,doors.length));
  let tot=0;const w=ord.map((o,i)=>{const v=Math.exp(-i*0.42);tot+=v;return v;});let r=Math.random()*tot;
  for(let i=0;i<ord.length;i++){r-=w[i];if(r<=0)return ord[i][1];}return ord[0][1];}
function stairPt(st,k){const sb=st.s-75+rand(-2.5,2.5);const o0=st.exitO[k]||st.exitO[TK[k].main]||0;return [sb,ov(o0,sb)+rand(-0.45,0.45)];}
function exitPt(st,k){return stairPt(st,k);}
function stationBoost(st){return st.cls==='M'?3.2:st.cls==='X'?2.6:st.cls==='R'?2.2:1;}
function crowd(base){return Math.max(1,Math.round(base*peopleF(hourNow())*(MINI?0.22:1)));}
function isRushHour(){const h=hourNow();return (h>=6&&h<9)||(h>=17&&h<21);}
function isQuietHour(){const pf=peopleF(hourNow());return pf<1.0;}
/* 1両あたりの目安人数：ラッシュは満員、日中・深夜は空く */
function perCarCap(){const pf=peopleF(hourNow());
  if(pf>=4)return irand(100,125); // 朝夕ラッシュ：すし詰め（座席+立ち）
  if(pf>=3)return irand(70,90);
  if(pf>=2)return irand(40,55);
  if(pf>=1.2)return irand(16,26); // 日中
  if(pf>=0.6)return irand(8,16);
  return irand(2,7);}             // 深夜
function trainLoadFor(key){return perCarCap()*carsFor(key);}
/* 1両に立てる人数の上限（ラッシュは詰めて立つ） */
function standCap(){const pf=peopleF(hourNow());return pf>=4?85:pf>=3?62:38;}
function saloonFromLoad(load,nCars){const per=load/Math.max(1,nCars);
  return Math.round(clamp(per*0.9,3,SALSEAT.length+standCap()-6));}
/* 立ち位置の候補（実際の肩幅に合わせて千鳥配置） */
function standXs(row){return row%2?[-0.34,0.34]:[-0.60,0,0.60];}
function standStepZ(){return standCap()>40?0.40:0.48;}
/* 1列の深さ。あふれたら左右に新しい列を追加 */
const QDEPTH=9;
function queueSlot(qi){
  const col=Math.floor(qi/QDEPTH),row=qi%QDEPTH;
  /* 列0が中央寄り、1,2,3... で左右交互に広がる */
  const side=col===0?0:((col%2===1?1:-1)*Math.ceil(col/2));
  return {col:side,row};
}
function spawnOneWait(st,k,doors,list,q,already,pReuse){ /* already=true: 最初から列にいる / false: 階段から歩く */
  const T=TK[k],sd=T.side(st),base=T.off(st.s),pr=platRange(st,k),oMin=Math.min(pr[0],pr[1])+0.4,oMax=Math.max(pr[0],pr[1])-0.4;
  const j=(!already&&trainArrivedAt(st,k))?pickDoorNearStairs(doors,st):pickDoorIdx(doors,st);q[j]=(q[j]||0)+1;const qi=list.filter(p=>p.j===j).length;const p=pReuse||getPerson();
  p.st=st.i;p.kind='wait';p.flow=k;p.j=j;p.q=qi;p.face=-sd;p.trackO=base;
  const {col,row}=queueSlot(qi);
  /* 前後（線路方向）に列、横に並びきれない分の列 */
  let tgtS=doors[j]+col*0.92+(row%2?0.20:-0.20);
  let wantO=base+sd*(2.45+row*0.62);
  /* ホームドアのある駅：閉じた戸の内側（安全な位置）より線路側には並ばせない。
     列は「線路から離れる向き」に広げる（同じ位置に固まらないように） */
  if(st.hd){const hd=st.hd[k]||st.hd['S'+k];if(hd&&hd.line!=null){const sd2=hd.sd!=null?hd.sd:sd,safe=hd.line+sd2*0.80;
    wantO=safe+sd*(0.58*row);}}
  /* ホームの端まで来て横に広げられない分は、線路方向にずらして間隔を保つ */
  let tgtO=clamp(wantO,oMin,oMax);tgtS+=clamp(wantO-tgtO,-3,3)*1.15;
  tgtS=clamp(tgtS,doors[j]-4.2,doors[j]+4.2);
  /* すでに並んでいる人と重ならない位置まで、線路から離れる向きにずらす */
  {let tries=0;while(tries<10&&list.some(q2=>q2!==p&&q2.kind==='wait'&&q2.flow===k&&Math.hypot(q2.s-tgtS,q2.o-tgtO)<0.62)){const b4=tgtO;tgtO=clamp(tgtO+sd*0.34,oMin,oMax);if(Math.abs(tgtO-b4)<0.02)tgtS=clamp(tgtS+0.46,doors[j]-4.6,doors[j]+4.6);tries++;}}
  if(already){p.s=tgtS;p.o=tgtO;p.path=[];p.delay=0;}
  else{const [ss,so]=stairPt(st,k);p.s=ss;p.o=so;p.path=[[tgtS,tgtO]];p.speed=rand(1.15,1.55);p.delay=rand(0,0.4);}
  p.end=null;list.push(p);return p;
}
function spawnWait(st,k){if(st.sp[k])return;return withCrowdSeed(waitCastSeed(st,k),()=>spawnWaitBody(st,k));}
function spawnWaitBody(st,k){if(st.sp[k])return;if(physDup(st,k)){st.sp[k]=true;return;} /* 列は各停と共有 */
  const T=TK[k],doors=doorList(st.s+T.so,T.dir<0,greenCarsFor(k),carsFor(k)),q={},list=st.wait[k]||(st.wait[k]=[]);
  const major=isMajorStation(st);
  /* 主要駅はホームにたくさん待機、それ以外の駅は少なめ */
  const seed=IS_ONLINE?(major?irand(5,10):irand(1,2)):major?(isRushHour()?irand(24,38):isQuietHour()?irand(4,9):irand(14,24)):(isRushHour()?irand(2,6):isQuietHour()?irand(0,2):irand(1,3));
  for(let i=0;i<seed;i++)spawnOneWait(st,k,doors,list,q,true);
  const walkN=IS_ONLINE?(major?irand(1,2):0):major?(isRushHour()?irand(5,9):isQuietHour()?irand(1,3):irand(3,6)):(isRushHour()?irand(1,2):irand(0,1));
  for(let i=0;i<walkN;i++)spawnOneWait(st,k,doors,list,q,false);
  st.sp[k]=true;st.arrT=st.arrT||{};st.arrT[k]=major?rand(0.3,1.2):rand(1.5,3.5);
  if(!st.staff)spawnStaff(st);
}
function spawnStaff(st){st.staff=[];return;const n=st.big?3:st.cls==='L'?1:2;st.staff=[];
  for(let i=0;i<n;i++){const k=Object.keys(st.sp)[i%Math.max(1,Object.keys(st.sp).length)]||'A';const T=TK[k],sd=T.side(st),base=T.off(st.s);
    const p=getPerson('staff');p.st=st.i;p.kind='idle';p.flow='staff';p.s=st.s-PBof(st)+18+i*40;p.o=base+sd*(2.2+i*0.3);p.trackO=-99;p.face=-sd;p.yaw=0;p.path=[];p.end=null;st.staff.push(p);}}
function spawnIdle(st){if(!_crowdSeedDepth)return withCrowdSeed(waitCastSeed(st,'idle'),()=>spawnIdleBody(st));return spawnIdleBody(st);}
function spawnIdleBody(st){for(const ex of st.extra){if(ex.line===RAPID)continue;const n=Math.min(12,crowd(5));for(let k=0;k<n;k++){const s=st.s-PBof(st)+10+rand(0,PBof(st)-5);const lo=ex.lo(s),hi=ex.hi(s);const p=getPerson();
  p.st=st.i;p.kind='idle';p.flow='idle';p.s=s;p.o=rand(lo+0.9,hi-0.9);p.trackO=-99;p.face=Math.random()<0.5?-1:1;}}st.sp.idle=true;}
const JOBS=[]; // delayed actions in game time
/* 乗り換え客が階段に着いたら、コンコースを通って（少し時間をおいて）目的のホームの階段から出てきて並ぶ。
   その番線に電車がいてドアが開いていれば、並ばずにそのまま乗る（pullWaiters） */
function xferArrive(p){const st=STATIONS[p.st],tk=p.xk;p.end=null;p.xk=null;
  if(!st||!tk||!serves(st,tk)){freePerson(p);return;}
  const T2=TK[tk],doors2=doorList(st.s+T2.so,T2.dir<0,greenCarsFor(tk),carsFor(tk)),list2=st.wait[tk]||(st.wait[tk]=[]);
  spawnOneWait(st,tk,doors2,list2,{},false,p);p.delay=rand(3,8);p.hidden=true;p.g.visible=false;}
function startFlows(st,k,frontS,train){
  if(k==='G'||k==='H')return {a:0,b:0};
  if(train==='OWN'&&(G.isTest||G.rsManual==='試運転'||G.rsManual==='回送'))return {a:0,b:0};
  if(train&&train!=='OWN'&&train.test)return {a:0,b:0};
  return withCrowdSeed('flow|'+LINE_ID+'|'+st.i+'|'+k+'|'+trainStopSeed(train),()=>startFlowsBody(st,k,frontS,train));
}
function startFlowsBody(st,k,frontS,train){
  if(k==='G'||k==='H')return {a:0,b:0}; /* 特急の地下ホームは乗降の列を作らない（地下駅の空間を優先） */
  const T=TK[k],isShTr=!BRANCH&&st.i===0&&(train==='OWN'||(train&&train.p)),sd=isShTr?-T.side(st):T.side(st),base=isShTr?ownTrackOff(k,st.s):T.off(st.s),gc=greenCarsFor(k),NC=carsFor(k),doors=doorList(frontS,T.dir<0,gc,NC),own=train==='OWN',ls=own?(G.door.local||sd*G.dir)*(ownTrain.rev?-1:1):train?sd*trSgn(train.tr):0;
  const last=G.list&&k===G.key&&stOf(G.list.length-1)===st,lastAI=BRANCH&&train&&train!=='OWN'&&((train.dir>0&&st.i===NST-1)||(train.dir<0&&st.i===0));
  const major=isMajorStation(st);
  const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s;
  if(train&&train!=='OWN'&&train.tr&&train.tr.cars&&Math.abs(sdiff(camS,st.s))<480){
    const unpop=[];for(let ci=0;ci<train.tr.cars.length;ci++)if(!isPop(train,ci))unpop.push(ci);
    if(unpop.length){if(train.load==null||train.load<carsFor(train.key||'A')*5)train.load=trainLoadFor(train.key||'A');populateCars(train,unpop);}
  }
  /* 主要駅では乗車が多く降車は控えめ、それ以外の駅では降車する人が多い */
  const rawA=major?crowd(irand(5,10)*(isRushHour()?1.35:1)):crowd(irand(6,13)*(isRushHour()?1.6:1.2));
  const aN=(last||lastAI)?Math.min(120,Math.max(1,Math.round(own?(G.load||0):(train.load||0)))):Math.min(isRushHour()?64:42,rawA),ac={};let nb=0;
  for(let i=0;i<aN;i++){const j=irand(0,doors.length-1);ac[j]=(ac[j]||0);const [ex,eo]=exitPt(st,k),[car,dz]=doorCarOf(j,gc,NC),ds0=doors[j];
    const mk=(vis,srcG)=>{const p=getPerson();p.st=st.i;p.kind='alight';p.flow=k;p.trackO=base;p.doorS=ds0;
      if(srcG)copyPersonLook(p.g,srcG);
      p.s=vis?ds0:ds0+rand(-0.25,0.25);p.o=vis?base+sd*1.25:base+sd*0.15;
      p.delay=vis?0:0.15+ac[j]*0.22+rand(0,0.15);p.g.visible=!!vis;
      const tk=transferKey(st,k),xr=Math.random(),bigSt=st.big||st.cls==='M'||st.cls==='X';
      const others=KEYS.filter(k2=>k2!==k&&k2!==tk&&serves(st,k2));
      if(others.length&&xr>=0.6&&xr<0.6+(bigSt?0.25:0.12)){ // 乗り換え：階段を通って別のホームへ（階段の奥まで歩く）
        p.xk=pick(others);p.path=[[ds0+rand(-0.3,0.3),base+sd*2.6],[ex,eo],[ex+(ex>=st.s-75?1.6:-1.6),eo]];p.speed=rand(1.3,1.8);p.end='xfer';return;}
      if(tk&&xr<(bigSt?0.45:0.35)){ // 乗り換え：同じホームの向かい側の番線へ（電車がいてドアが開いていればそのまま乗る）
        const T2=TK[tk],sd2=T2.side(st),base2=T2.off(st.s),doors2=doorList(st.s+T2.so,T2.dir<0,greenCarsFor(tk),carsFor(tk)),
          j2=pickDoorIdx(doors2,st),list2=st.wait[tk]||(st.wait[tk]=[]),q2=list2.filter(x=>x.j===j2).length;
        const pr2=platRange(st,tk),oMin2=Math.min(pr2[0],pr2[1])+0.45,oMax2=Math.max(pr2[0],pr2[1])-0.45;
        p.path=[[ds0+rand(-0.4,0.4),base+sd*2.4],[doors2[j2]+(q2%2?1:-1)*(0.8+0.12*Math.floor(q2/2)),clamp(base2+sd2*(2.7+0.55*Math.floor(q2/2)),oMin2,oMax2)]];
        p.speed=rand(1.2,1.6);p.end=null;p.kind='wait';p.flow=tk;p.j=j2;p.q=q2;p.face=-sd2;p.trackO=base2;list2.push(p);return;}
      p.path=[[ds0+rand(-0.3,0.3),base+sd*2.6],[ex,eo],[ex+(ex>=st.s-75?1.8:-1.8),eo]];p.speed=rand(1.3,1.8);p.end='free';};
    if(own&&car===(CONDV?carsFor(G.key)-1:0)&&SAL.on){const dl=0.3+ac[j]*0.5+rand(0,0.3);JOBS.push({t:dl,fn:()=>salAlight(dz*SIDEINV*(ownTrain.rev?-1:1),(G.door.local||sd*G.dir)*SIDEINV,sg=>mk(true,sg))});}
    else if(train&&(train!=='OWN'?isPop(train,car):(OWNAI&&isPop(OWNAI,car)))){const ia=train==='OWN'?OWNAI:train,dl=0.3+ac[j]*0.5+rand(0,0.3);JOBS.push({t:dl,fn:()=>{if(isPop(ia,car))alightInside(ia,car,dz,ls,sg=>mk(true,sg));else mk(false);}});}
    else mk(false);ac[j]++;}
  const pk=platKey(st,k);
  const list=(st.wait[k]&&st.wait[k].length)?st.wait[k]:(st.wait[pk]||[]);
  for(const p of list){if(p.kind!=='wait')continue;
    if(doors[p.j]===undefined)p.j=irand(0,doors.length-1);const ds=doors[p.j];
    p.kind='board';p.doorS=ds;p.face=-sd;p.trackO=base;
    /* 待たずにすぐ乗り込む */
    const bq=(ac[p.j]||0);p.delay=rand(0,0.1)+Math.min(0.9,bq*0.16);
    /* 同じドアに全員が1点で重ならないよう、人ごとに前後・左右へ少しずらして並ばせる */
    p.path=[[ds+(p.s>ds?0.25:-0.25)+((bq%3)-1)*0.42, base+sd*(1.9+0.34*(bq%2))],[ds+((bq%2)?0.22:-0.22)+rand(-0.08,0.08), base+sd*(1.12+0.16*(bq%2))]];
    p.speed=rand(1.55,2.1);p.end='board';nb++;
    p.train=train||null;{const cd=doorCarOf(p.j,gc,NC);p.car=cd[0];p.dz=cd[1];}p.ls=ls;ac[p.j]=(ac[p.j]||0)+1;}
  list.length=0;
  if(k===fkey()){G.doorS=doors;G.runnerPlanned=Math.random()<0.55;G.runnerSpawned=false;G.runnerT=rand(2,5);G.load=clamp((G.load||trainLoadFor(G.key))-aN+nb,0,maxLoadFor(G.key));}
  return {a:aN,b:nb};
}
function spawnRunner(){return withCrowdSeed('runner|'+LINE_ID+'|'+fkey()+'|'+(G.flowV|0)+'|'+(G.sq||0),()=>{const fk=fkey(),st=stOf(G.flowV),T=TK[fk],sd=T.side(st),base=T.off(st.s);const [ex,eo]=exitPt(st,fk);const ds=pick(G.doorS);
  const p=getPerson();p.st=st.i;p.kind='runner';p.flow=fk;p.trackO=base;p.doorS=ds;p.s=ex;p.o=eo;p.speed=3.3;
  p.path=[[ds+(ex>ds?0.6:-0.6),base+sd*2.2],[ds+rand(-0.35,0.35),base+sd*1.6],[ds+rand(-0.4,0.4),base+sd*0.4]];p.end='board';});}
const fkey=()=>physKey(G.key,G.flowV>=0?stOf(G.flowV).s:G.s);
const flowSt=()=>G.flowV>=0?stOf(G.flowV).i:-1;
function maxLoadFor(key){return carsFor(key||G.key)*(isRushHour()?150:72);} // ラッシュは定員を大きく超えて乗る
function isTrainFull(load,key){return (load||0)>=maxLoadFor(key)*0.88;}
function inZone(){const fi=flowSt(),fk=fkey();for(const p of active){if(p.flow!==fk||p.st!==fi||!p.g.visible)continue;
  if(p.kind==='jam'){if(Math.abs(p.o-p.trackO)<2.5&&Math.abs(p.s-(p.doorS||p.s))<1.5)return true;continue;}
  if(p.delay>0||!p.path||!p.path.length)continue;
  if(Math.abs(p.o-p.trackO)<2.2&&Math.abs(p.s-p.doorS)<1.1)return true;}return false;}
function doorBlocked(){return inZone()||(isTrainFull(G.load,G.key)&&jamCount()>0);}
function jamCount(){const fi=flowSt(),fk=fkey();let n=0;for(const p of active){if(p.flow===fk&&p.st===fi&&p.kind==='jam'&&p.g.visible)n++;}return n;}
function pending(){if(typeof G!=='undefined'&&G&&(G.key==='G'||G.key==='H'))return false; /* 特急の地下ホームは乗降の列を作らない */const fi=flowSt(),fk=fkey();return active.some(p=>p.flow===fk&&p.st===fi&&(p.kind==='board'||p.kind==='alight'||p.kind==='jam'||p.kind==='runner')&&(p.kind==='jam'||p.delay>0||(p.path&&p.path.length)));}
function abandonPending(){const fi=flowSt(),fk=fkey(),st=STATIONS[fi];if(fi<0||!st)return;
  for(const p of active.slice()){if(p.flow!==fk||p.st!==fi)continue;
    /* 線路側に近い人はホームに戻さず乗車扱い */
    if(p.trackO!==-99&&Math.abs(p.o-p.trackO)<2.2){if(p.kind==='jam'||p.kind==='board'||p.kind==='runner'||p.kind==='alight')absorbAsBoarded(p);continue;}
    if(p.kind==='alight'&&p.delay>0){absorbAsBoarded(p);continue;}
    if(p.kind==='jam'||((p.kind==='board'||p.kind==='runner')&&(p.delay>0||(p.path&&p.path.length)))){
      const T=TK[fk],sd=T.side(st),base=T.off(st.s),pr=platRange(st,fk),oMin=Math.min(pr[0],pr[1])+0.45,oMax=Math.max(pr[0],pr[1])-0.45;
      /* ホーム上で列に並んでいた人だけ待機に戻す */
      p.kind='wait';p.path=[];p.delay=0;p.g.visible=true;p.end=null;p.face=-sd;p.trackO=base;
      const list=st.wait[fk]||(st.wait[fk]=[]);p.j=(p.j!=null?p.j:0);
      const qi=list.filter(x=>x.j===p.j).length;const qs=queueSlot(qi);
      p.s=(p.doorS||p.s)+qs.col*0.92+(qs.row%2?0.14:-0.14);p.o=clamp(base+sd*(2.45+qs.row*0.62),oMin,oMax);
      if(!list.includes(p)){p.q=qi;list.push(p);}}}}
const CPG=new Map();
const _CP_CELL=0.7;
function cpKey(st,s,o){return ((st+1)*262144+Math.floor(s/_CP_CELL))*2048+(Math.floor(o/_CP_CELL)+1024);}
function cpBuild(){CPG.clear();for(const q of active){if(!q.g.visible)continue;const k=cpKey(q.st,q.s,q.o);let a=CPG.get(k);if(!a){a=[];CPG.set(k,a);}a.push(q);}}
/* 乗客の実際の3D体格（肩幅+腕、前後厚+バッグ/端末、スケール）にぴったり一致する半幅・半厚を返す */
function personHalfExtents(g){
  if(!g||!g.userData)return {hx:0.28,hz:0.14};
  const u=g.userData,sc=(g.scale&&g.scale.x)||1;
  const D=(u.child?VDC:VD)[u.vi];
  if(!D)return {hx:0.28*sc,hz:0.14*sc};
  const dv=(D.dev&&u.mode!=='strap')?D.dev:0;
  const hx=(D.shoulder*0.5+0.0875+(D.bag===1&&!dv?0.04:0))*sc;
  const hz=(0.118+(D.bag===2?0.065:0)+(dv?0.065:0))*sc;
  return {hx,hz};
}
/* ホーム(s,o)座標系でのOBB軸（right, fwd） */
function obbAxesSO(t,yaw){
  const a=t+yaw,sa=Math.sin(a),ca=Math.cos(a);
  return {rx:sa,rz:ca,fx:-ca,fz:sa};
}
/* 車両ローカル(x,z)座標系でのOBB軸（right, fwd） */
function obbAxesXZ(yaw){
  const sy=Math.sin(yaw),cy=Math.cos(yaw);
  return {rx:cy,rz:-sy,fx:sy,fz:cy};
}
/* 2D向き付き矩形(OBB)同士の最小押し出しベクトル(AをBから離す向き)を返す。重なっていなければnull */
function resolveOBB2D(ax,az,aAx,aEx,bx,bz,bAx,bEx){
  const dx=ax-bx,dz=az-bz;
  let minOv=1e9,nx=0,nz=0;
  const axes=[
    [aAx.rx,aAx.rz],[aAx.fx,aAx.fz],
    [bAx.rx,bAx.rz],[bAx.fx,bAx.fz]
  ];
  for(let i=0;i<4;i++){
    const ux=axes[i][0],uz=axes[i][1];
    const rA=aEx.hx*Math.abs(aAx.rx*ux+aAx.rz*uz)+aEx.hz*Math.abs(aAx.fx*ux+aAx.fz*uz);
    const rB=bEx.hx*Math.abs(bAx.rx*ux+bAx.rz*uz)+bEx.hz*Math.abs(bAx.fx*ux+bAx.fz*uz);
    const dist=dx*ux+dz*uz;
    const ov=rA+rB-Math.abs(dist);
    if(ov<=0)return null;
    if(ov<minOv){
      minOv=ov;
      const sg=dist>=0?1:-1;
      nx=ux*sg;nz=uz*sg;
    }
  }
  if(Math.abs(dx)<1e-4&&Math.abs(dz)<1e-4){
    const ang=Math.random()*6.283;nx=Math.cos(ang);nz=Math.sin(ang);
  }
  return [nx*minOv,nz*minOv,minOv];
}
function crowdPush(p,dt){ /* 乗客同士の当たり判定：実際の体格・向き(OBB)で重なりを押し戻す（ドア口乗降中は詰まらないよう横避け・道譲り） */
  const here=PAX?W.s:G.s;if(Math.abs(sdiff(p.s,here))>220)return;
  const si=Math.floor(p.s/_CP_CELL),oi=Math.floor(p.o/_CP_CELL);
  const tP=P(p.s)[2],pAx=obbAxesSO(tP,p.yaw||0),pEx=personHalfExtents(p.g);
  const st=STATIONS[p.st],pr=st&&p.flow?platRange(st,p.flow):null;
  const oMin=pr?Math.min(pr[0],pr[1])+0.35:-1e9,oMax=pr?Math.max(pr[0],pr[1])-0.35:1e9;
  const pMovingDoor=(p.kind==='board'||p.kind==='alight'||p.kind==='runner')&&p.trackO!==-99&&Math.abs(p.o-p.trackO)<3.0;
  const hasPlayer=((PAX&&!RIDE)||G.walkOn)&&W.st&&W.st.i===p.st&&Math.abs(p.s-W.s)<1.0&&Math.abs(p.o-W.o)<1.0;
  if(hasPlayer){
    const wAx=obbAxesSO(tP,W.yaw+Math.PI),wEx={hx:0.30,hz:0.16};
    const rW=resolveOBB2D(p.s,p.o,pAx,pEx,W.s,W.o,wAx,wEx);
    if(rW){
      p.s+=rW[0]*0.9;
      if(!pMovingDoor)p.o+=rW[1]*0.9;
      if(pr&&p.trackO!==-99&&!pMovingDoor)p.o=clamp(p.o,oMin,oMax);
    }
  }
  let pushS=0,pushO=0;
  for(let pass=0;pass<2;pass++){
    let moved=false;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){
      const cell=CPG.get(((p.st+1)*262144+si+a)*2048+(oi+b+1024));if(!cell)continue;
      for(const q of cell){
        if(q===p||!q.g.visible||q.st!==p.st)continue;
        if(Math.abs(p.s-q.s)>0.9||Math.abs(p.o-q.o)>0.9)continue;
        /* 待機中の人は乗降中の人に押されて道を開けるが、乗降中の人は待機中の人に押し返されない */
        if(pMovingDoor&&q.kind==='wait')continue;
        const qAx=obbAxesSO(tP,q.yaw||0),qEx=personHalfExtents(q.g);
        const res=resolveOBB2D(p.s+pushS,p.o+pushO,pAx,pEx,q.s,q.o,qAx,qEx);
        if(!res)continue;
        if(pMovingDoor){
          pushS+=res[0]*0.24;
        }else{
          const k=q.kind==='wait'?0.46:0.28;
          pushS+=res[0]*k;pushO+=res[1]*k;
          if(p.path&&p.path.length){
            const ts=p.path[0][0]-p.s,to=p.path[0][1]-p.o,dl=Math.hypot(ts,to);
            if(dl>0.2){const side=(p.s>q.s?1:-1);pushS+=(-to/dl)*0.015*side;pushO+=(ts/dl)*0.015*side;}
          }
        }
        moved=true;
      }
    }
    if(!moved)break;
  }
  const pLen=Math.hypot(pushS,pushO);
  if(pLen>0.045){pushS=pushS/pLen*0.045;pushO=pushO/pLen*0.045;}
  p.s+=pushS;p.o+=pushO;
  if(pr&&p.trackO!==-99&&!pMovingDoor&&Math.abs(p.o-p.trackO)>1.6)p.o=clamp(p.o,oMin,oMax);
}
function sweepStranded(){
  if(!PAX&&G.v<1.2&&G.atStation!==null)return;
  for(const p of active.slice()){if(p.trackO===-99||!p.g.visible)continue;
    if(p.kind!=='board'&&p.kind!=='jam'&&p.kind!=='runner'&&p.kind!=='alight')continue;
    if(Math.abs(p.o-p.trackO)>2.0)continue;
    const st=p.st>=0?STATIONS[p.st]:null,fk=st&&p.flow?physKey(p.flow,st.s):null;
    if(st&&fk&&trainOpenAt(st,fk))continue;
    if(PAX){if(p.kind==='alight')freePerson(p);else requeue(p);continue;}
    /* 発車後も線路側に残っていた人は電車と一緒（乗車） */
    absorbAsBoarded(p);}}
function boardIntoTrain(p){
  if(!p||!p.train)return;
  if(p.train==='OWN'){
    if(p.car===(CONDV?carsFor(G.key)-1:0)&&SAL.on)salBoard(p.dz*SIDEINV*(ownTrain.rev?-1:1),p.ls*SIDEINV*(ownTrain.rev?-1:1),p.g);
    const o=ownAI();
    if(o&&(G.walkOn||monStation())){
      if(!isPop(o,p.car))populateCars(o,[p.car]);
      if(isPop(o,p.car))boardInside(o,p.car,p.dz,p.ls,p.g);
    }
    if(p.forceIn)G.load=Math.min(maxLoadFor(G.key),(G.load||0)+1);
  }else if(p.train&&p.train.tr){
    const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s;
    if(!isPop(p.train,p.car)&&p.train.tr.cars&&p.train.tr.cars[p.car]&&Math.abs(sdiff(camS,p.train.s))<480){
      if(p.train.load==null||p.train.load<carsFor(p.train.key||'A')*5)p.train.load=trainLoadFor(p.train.key||'A');
      populateCars(p.train,[p.car]);
    }
    if(isPop(p.train,p.car))boardInside(p.train,p.car,p.dz,p.ls,p.g);
  }
}
function termAlightPending(p){
  if(!BRANCH||p.kind!=='board')return false;
  const st=STATIONS[p.st];if(!st)return false;
  const T=TK[p.flow];if(!T)return false;
  const isTerm=(T.dir>0&&st.i===NST-1)||(T.dir<0&&st.i===0);
  if(!isTerm)return false;
  for(const q of active){if(q!==p&&q.st===p.st&&q.flow===p.flow&&q.kind==='alight'&&(q.delay>0||(q.path&&q.path.length)))return true;}
  return false;
}
function updPeople(dt){sweepStranded();
  if(G.flowV>=0&&(G.door.state==='open'||G.door.state==='opening')){const st=stOf(G.flowV);if(st)pullWaiters(st,fkey());}
  for(const a of OT){if(a.state==='dwell'&&a.stSt&&a.frac>0.55&&a.t>4.2)pullWaiters(a.stSt,physKey(a.key,a.stSt.s));}
  for(let i=JOBS.length-1;i>=0;i--){JOBS[i].t-=dt;if(JOBS[i].t<=0){const f=JOBS[i].fn;JOBS.splice(i,1);f();}}
  cpBuild();
  for(const p of active.slice()){
    if(p.kind==='board'&&p.train&&p.end==='board'&&!(p.delay>0)&&!boardOpen(p)){requeue(p);continue;}
    /* 終点駅：降りる人が全員いなくなるまで、ホームで待つ人は乗らない */
    if(p.kind==='board'&&!p._gateOff&&termAlightPending(p)){p.delay=Math.max(p.delay,0.2);p.gateT=(p.gateT||0)+dt;if(p.gateT>28)p._gateOff=true;continue;}
    p.gateT=0;
    if(p.delay>0){p.delay-=dt;if(p.delay>0){if(p.kind==='alight'||p.hidden){p.g.visible=false;posePerson(p,false);continue;}else{p.g.visible=true;}}else{
      const nearPl=((PAX&&!RIDE)||G.walkOn)&&W.st&&W.st.i===p.st&&Math.hypot(p.s-W.s,p.o-W.o)<1.4;
      if(nearPl&&p.hidden){p.delay=0.25;p.g.visible=false;posePerson(p,false);continue;}
      p.g.visible=true;p.hidden=false;}}
    let moving=false;const _mvS=p.s,_mvO=p.o;
    if(p.path.length){const ts=p.path[0][0],to=p.path[0][1],ds=sdiff(p.s,ts),dO=to-p.o,dist=Math.hypot(ds,dO),step=p.speed*dt;
      const t=P(p.s)[2];const wx=Math.sin(t)*ds+Math.cos(t)*dO,wz=-Math.cos(t)*ds+Math.sin(t)*dO;if(dist>0.01)p.yaw=Math.atan2(wx,wz);
      if(dist<=step){p.s=mod(ts,L);p.o=to;p.path.shift();if(!p.path.length&&p.end==='xfer'){xferArrive(p);continue;}
        if(!p.path.length&&(p.end==='board'||p.end==='free')){
          if(p.end==='board'){
            if(!boardOpen(p)){requeue(p);continue;} /* 列車がいない・ドアが閉まっていたら消さずに待機列へ戻す */
            const squeeze=p.train==='OWN'&&(G.noBoard||(G.atStation!==null&&G.promoted[G.atStation]));
            const full=!p.forceIn&&!squeeze&&p.train==='OWN'&&isTrainFull(G.load,G.key); /* 他の電車は押し込んで乗る */
            if(full){ /* 満員：ドアギリギリに詰まる（戸が閉まらない） */
              p.kind='jam';p.end=null;p.path=[];p.delay=0;p.g.visible=true;
              const sd=Math.sign(p.o-p.trackO)||1;p.o=p.trackO+sd*0.42;p.face=-sd;p.s=p.doorS||p.s;
              if(p.train==='OWN')G.load=Math.min(maxLoadFor(G.key), (G.load||0)+1);
              p.train=null;posePerson(p,false);continue;}
            boardIntoTrain(p);
            p.train=null;p.forceIn=false;freePerson(p);continue;}
          if(p.end==='free'){freePerson(p);continue;}}
        }
      else{p.s=mod(p.s+ds/dist*step,L);p.o+=dO/dist*step;}moving=true;p.walk+=dt*p.speed*5.5;crowdPush(p,dt);}
    else{const t=P(p.s)[2];p.yaw=Math.atan2(Math.cos(t)*p.face,Math.sin(t)*p.face);crowdPush(p,dt);}
    if(moving&&Math.hypot(sdiff(_mvS,p.s),p.o-_mvO)<0.004){moving=false;p._stuckT=(p._stuckT||0)+dt;}else p._stuckT=0; /* 前の人に詰まって進めないときは足踏みしない */
    if(p._stuckT>1.6&&p.path&&p.path.length){ /* 詰まり時：ホームドアを越えてワープさせず、乗車待ちは列へ戻す */
      if(p.kind==='board'||p.kind==='runner'){requeue(p);continue;}
      else if(p.kind!=='jam'){p.path.length=0;p._stuckT=0;}}
    if(p.trackO!==-99&&p.st>=0){const stP=STATIONS[p.st],prP=stP&&p.flow?platRange(stP,p.flow):null;
      if(prP){const loP=Math.min(prP[0],prP[1])+0.35,hiP=Math.max(prP[0],prP[1])-0.35;
        const canCross=(p.kind==='board'||p.kind==='runner'||p.kind==='jam')?(p.train&&boardOpen(p)):(p.kind==='alight'&&Math.abs(p.o-p.trackO)<1.75&&stP&&trainOpenAt(stP,physKey(p.flow,stP.s)));
        if(!canCross)p.o=clamp(p.o,loP,hiP);}}
    applyHDCollision(p);posePerson(p,moving);}
}
function posePerson(p,moving){let onPlat=true;
  if(p.trackO!==-99&&p.st>=0){const stP=STATIONS[p.st],prP=stP&&p.flow?platRange(stP,p.flow):null;
    if(prP){const loP=Math.min(prP[0],prP[1]),hiP=Math.max(prP[0],prP[1]);onPlat=(p.o>=loP-0.05&&p.o<=hiP+0.05);}}
  const stNow=p.st>=0?STATIONS[p.st]:null;
  const hasTrain=stNow&&p.flow&&trainOpenAt(stNow,physKey(p.flow,stNow.s));
  const yPos=(!onPlat&&hasTrain&&(p.kind==='board'||p.kind==='alight'||p.kind==='runner'||p.kind==='jam')&&Math.abs(p.o-p.trackO)<1.65)?1.15:PH;
  p.g.position.copy(offs(p.s,p.o,yPos));p.g.rotation.y=p.yaw;
  const u=p.g.userData;personPose(p.g,moving?'walk':'stand');if(moving){const a=Math.sin(p.walk)*0.55;u.legs[0].rotation.x=a;u.legs[1].rotation.x=-a;}}
function trainOpenAt(st,k){
  if(st&&!PAX&&G.atStation!==null&&stOf(G.atStation)===st&&physKey(G.key,st.s)===k&&(G.door.state==='open'||G.door.state==='opening')&&G.door.frac>0.55)return 'OWN';
  for(const a of OT){if(!a.key||physKey(a.key,st.s)!==k||a.state!=='dwell'||a.stSt!==st)continue;if(a.frac>0.55&&a.t>4.2)return a;}
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      const p = ONLINE_PLAYERS[pid];
      if(!p || !p.key || physKey(p.key, st.s) !== k || !p.tr || p.s == null || (p.v || 0) > 0.8) continue;
      const d = Math.abs(sdiff(p.s, st.s + TK[k].so));
      if(d < 30 && (p.door === 'open' || p.door === 'opening') && (p.doorFrac || 0) > 0.35){
        return p.ai || p;
      }
    }
  }
  return null;}
/* ドア開中：待機列をすぐ乗車に切り替え */
function pullWaiters(st,k){const train=trainOpenAt(st,k);if(!train)return 0;
  return withCrowdSeed('pull|'+LINE_ID+'|'+st.i+'|'+k+'|'+trainStopSeed(train),()=>pullWaitersBody(st,k,train));}
function pullWaitersBody(st,k,train){
  if(train==='OWN'&&G.noBoard)return 0; /* 戸閉めを押した後だけ打ち切り（満員でもドアへ向かう） */
  const list=st.wait[k];if(!list||!list.length)return 0;
  const T=TK[k],sd=T.side(st),base=T.off(st.s),gc=greenCarsFor(k),NC=carsFor(k);
  const frontS=train==='OWN'?(st.s+sdiff(st.s,G.s)):(st.s+T.so);
  const doors=doorList(frontS,T.dir<0,gc,NC),ls=train==='OWN'?(G.door.local||sd*G.dir)*(ownTrain.rev?-1:1):((sd*(train.tr?trSgn(train.tr):1))||sd);
  let n=0;
  for(const p of list.slice()){if(p.kind!=='wait')continue;
    if(doors[p.j]===undefined)p.j=irand(0,doors.length-1);const ds=doors[p.j]||doors[0];
    p.kind='board';p.doorS=ds;p.face=-sd;p.trackO=base;
    const bq=n;p.delay=rand(0,0.08)+Math.min(0.9,bq*0.14);
    p.path=[[ds,base+sd*2.55],[ds+((bq%2)?0.12:-0.12),base+sd*(1.12+0.16*(bq%2))]];p.speed=rand(1.6,2.2);p.end='board';
    p.train=train;const cd=doorCarOf(p.j,gc,NC);p.car=cd[0];p.dz=cd[1];p.ls=ls;n++;}
  list.length=0;
  if(train==='OWN'&&n)G.load=clamp((G.load||0)+0,0,maxLoadFor(G.key)); /* load は乗車完了時に加算 */
  return n;}
function arrive1(st,k){return withCrowdSeed(waitCastSeed(st,k)+'|arr|'+((st.arrN=(st.arrN||0)+1)),()=>{const list=st.wait[k]||(st.wait[k]=[]);
  const doors=doorList(st.s+TK[k].so,TK[k].dir<0,greenCarsFor(k),carsFor(k)),q={};
  const major=isMajorStation(st),r=Math.random();
  const n=major?(isRushHour()?irand(4,7):isQuietHour()?irand(1,2):irand(2,4)):(isRushHour()?irand(1,2):1);
  for(let i=0;i<n;i++)spawnOneWait(st,k,doors,list,q,false);
  /* 電車がいるなら列に並ばずすぐ乗車 */
  if(trainOpenAt(st,k))pullWaiters(st,k);
});}
function updArrivals(dt){const here=PAX?W.s:G.s;
  for(const st of STATIONS){if(Math.abs(sdiff(here,st.s))>650||!Object.keys(st.sp).length)continue;st.arrT=st.arrT||{};
    for(const k of KEYS){if(!serves(st,k)||!st.sp[k])continue;
      /* ドア開中は待機を吸い上げてすぐ乗せる */
      if(trainOpenAt(st,k))pullWaiters(st,k);
      if(physDup(st,k))continue; /* 階段から来る人は各停の列に並ぶ（共有） */
      st.arrT[k]=(st.arrT[k]===undefined?rand(1.5,4):st.arrT[k])-dt;
      if(st.arrT[k]<=0){arrive1(st,k);
        const major=isMajorStation(st);
        st.arrT[k]=major?(isRushHour()?rand(1.2,2.4):isQuietHour()?rand(6,12):rand(2.6,5.2)):(isRushHour()?rand(4.5,8.0):isQuietHour()?rand(14,24):rand(9.0,16.0));
      }}}}
/* 遠くの駅に残った人・行き場のない人を片付ける（AIの電車が降ろした人など、これまで残り続けていた） */
let SWEEPT=0;
function sweepPeople(dt){SWEEPT+=dt;if(SWEEPT<1.5)return;SWEEPT=0;const here=PAX?W.s:G.s,lim=PAX?1500:3300;
  for(const p of active.slice()){if(p.st==null||p.st<0)continue;const st=STATIONS[p.st];if(!st){freePerson(p);continue;}if(Math.abs(sdiff(here,st.s))>lim)freePerson(p);}
  for(const st of STATIONS)if(Math.abs(sdiff(here,st.s))>lim+100){for(const k in st.wait)if(st.wait[k].length)st.wait[k].length=0;if(Object.keys(st.sp).length){st.sp={};st.staff=null;}}
  const CAP=QMODE==='heavy'?1200:(QMODE==='light'?650:480);if(active.length>CAP){const far=active.filter(p=>p.st>=0&&STATIONS[p.st]).sort((a,b)=>Math.abs(sdiff(here,STATIONS[b.st].s))-Math.abs(sdiff(here,STATIONS[a.st].s)));
    for(let i=0;i<active.length-CAP&&i<far.length;i++)freePerson(far[i]);}
  for(let i=JOBS.length-1;i>=0;i--)if(!(JOBS[i].t<600))JOBS.splice(i,1);                      /* 予定が溜まり続けないように */
  if(G.said&&Object.keys(G.said).length>4000)G.said={};}
function updSpawns(){
  for(const st of STATIONS){const dd=G.dir*sdiff(G.s,st.s);
    if(PAX?Math.abs(dd)<650:(dd>-120&&dd<1100)){for(const k of KEYS){if(!serves(st,k)||st.sp[k])continue;if(G.flowV>=0&&flowSt()===st.i&&k===fkey())continue;spawnWait(st,k);}
      if(!st.sp.idle&&st.extra.length)spawnIdle(st);}
    if((PAX?Math.abs(dd)>950:(dd<-280||dd>1500))&&Object.keys(st.sp).length){for(const p of active.slice())if(p.st===st.i)freePerson(p);st.sp={};st.staff=null;for(const k in st.wait)st.wait[k].length=0;}}
}

/* ================= blocks & signals ================= */
function blockOf(k,s){const b=BND[k];if(!b||!b.length)return -1;s=mod(s,L);let lo=0,hi=b.length-1;if(s<b[0])return b.length-1;
  while(lo<hi){const m=(lo+hi+1)>>1;if(b[m]<=s)lo=m;else hi=m-1;}return lo;}
/* 閉そく：どの閉そくにどの電車（種別・待避駅の中か）がいるか。
   待避駅（2面4線・通過線）の中だけは、各停＝副本線・快速＝本線でポイントにより線路が分かれるので、種別が違えば互いに妨げない */
const OCC={};for(const k of ALLK)OCC[k]=new Map();
function markTrain(k,front,dir){const sk=sigKey(k),b=BND[sk];if(!b||!b.length||!OCC[sk])return;const len=carsFor(k)*CARL,cls=trCls(k),seen=new Set();
  for(let d=0;;d+=20){const dd=Math.min(d,len),p=front-dir*dd,bi=blockOf(sk,p),z=B3&&sidDev(p)>0.3?1:0,key=bi*4+z*2+(cls==='r'?1:0);
    if(!seen.has(key)){seen.add(key);let a=OCC[sk].get(bi);if(!a){a=[];OCC[sk].set(bi,a);}a.push({cls,z});}if(dd>=len)break;}}
function blockedFor(sk,bi,cls){const a=OCC[sk].get(bi);if(!a)return false;for(const o of a){if(o.z&&o.cls!==cls)continue;return true;}return false;}
function aspectOf(sg,cls){cls=cls||'r';const b=BND[sg.k],n=b.length,pb=sg.dir>0?sg.bi:mod(sg.bi-1,n);
  if(blockedFor(sg.k,pb,cls))return 'R';if(blockedFor(sg.k,mod(pb+sg.dir,n),cls))return 'Y';if(blockedFor(sg.k,mod(pb+2*sg.dir,n),cls))return 'YG';return 'G';}
function nextSignal(k,s,dir){const sk=sigKey(k),b=BND[sk];if(!b||!b.length)return null;const n=b.length;const i=blockOf(sk,s);
  const bi=dir>0?(i+1)%n:i;const x=b[bi];const dist=dir*sdiff(s,x);if(dist<0||dist>3000)return null;
  const sg=SIGBY[sk][bi];let asp=sg?aspectOf(sg,trCls(k)):'G';
  if(asp!=='R'&&!PAX&&k===G.key){
    const myCls=trCls(k);
    for(const o of OT){
      if(!o||o.state==='off'||!o.key||sigKey(o.key)!==sk||o.dir!==dir)continue;
      if(B3&&sidDev(o.s)>0.3&&trCls(o.key)!==myCls)continue;
      const dd=dir*sdiff(s,o.s);
      if(dd>0&&dd<=dist+25){asp='R';break;}
    }
    if(asp!=='R'&&IS_ONLINE&&window.ONLINE_PLAYERS){
      const curLine=(typeof CFG!=='undefined'&&CFG)?CFG.id:'loop';
      for(const pid in ONLINE_PLAYERS){
        const op=ONLINE_PLAYERS[pid];
        if(!op||op.isPax||op.state!=='driving'||op.s==null||!op.key||(op.line||'loop')!==curLine)continue;
        if(sigKey(op.key)!==sk||(op.dir||1)!==dir)continue;
        const dd=dir*sdiff(s,op.s);
        if(dd>0&&dd<=dist+25){asp='R';break;}
      }
    }
  }
  return {x,dist,asp};}
function sigLimit(k,s,dir,v){const ns=nextSignal(k,s,dir);if(!ns)return 99;
  if(ns.asp==='R')return Math.sqrt(2*0.75*Math.max(ns.dist-22,0));
  if(ns.asp==='Y')return Math.sqrt(12.5*12.5+2*0.7*ns.dist);
  if(ns.asp==='YG')return Math.sqrt(18*18+2*0.7*ns.dist);return 99;}

/* ================= other trains ================= */
const OT=[];
function headwaySec(){return 150/Math.max(0.05,freqF(hourNow()));}
function mkAI(name,tr,opts){const a=Object.assign({name,tr,key:'A',dir:1,s:0,v:0,state:'off',t:0,timer:0,frac:0,side:1,vis:false,last:-1,doors:true,vmax:22,flowed:false,snd:null,sndF:{}},opts);OT.push(a);return a;}
const VMAX={A:22,B:22,C:31,D:31,E:34,F:34,G:58.33,H:58.33}; /* 特急は最高210km/h */
function setLook(tr,key){const [col,nm]=SVCLOOK[key];tr.mats.liv1.color.setHex(col);tr.mats.liv2.color.setHex(col).lerp(new THREE.Color(0xffffff),0.45);
  if(tr.old){const d=TK[key].dir>0?STATIONS[NST-1]:STATIONS[0];drawDestRoll(tr.dk,(MINI?'ワンマン　':'普通　')+d.name);if(MINI){tr.mats.liv1.color.setHex(0xf0e6c8);tr.mats.liv2.color.setHex(0xf0e6c8);}}else if(BRANCH){const d=TK[key].dir>0?STATIONS[NST-1]:STATIONS[0];drawDest(tr.dk,(KIND[key]==='rapid'?'快速 ':'普通 ')+d.name+'行');}else drawDest(tr.dk,nm+' '+(TK[key].dir>0?'外回り':'内回り'));}
function aiStop(a){let best=null,bd=1e9;const so=TK[a.key].so;
  for(const st of STATIONS){if(!servesChg(st,a.key))continue;if(st.i===a.last)continue;const stop=st.s+so,D=a.dir*sdiff(a.s,stop);if(D>-3.0&&D<bd){bd=D;best={st,D};}}return best;}
/* 変更ダイヤ：快速は特急並みに、特急は快速並みに停車駅を入れ替える（AI列車に適用） */
function servesChg(st,k){
  if(DIASH!=='change')return serves(st,k);
  if(k==='C'||k==='D')return st.cls==='M'||st.cls==='X'||(st.cls==='R'&&st.i%2===0);
  if(k==='G'||k==='H')return st.i===0||st.cls==='M';
  return serves(st,k);
}
function aiSpawn(a,s,v){if(!isFinite(a.t))a.t=0;if(!isFinite(a.frac))a.frac=0;const base=trainLoadFor(a.key);a.load=Math.round(base*(KIND[a.key]==='ltd'?1.08:KIND[a.key]==='rapid'?1.04:1)*rand(0.9,1.08));a.pa={};a.s=s;a.v=v===undefined?a.vmax*0.8:v;a.state='run';a.last=-1;a.frac=0;if(a.tr)a.tr.lastFrac=-1;a.flowed=false;a.sndF={};a.vis=true;}
function aiHide(a,wait){a.state='off';a.vis=false;if(a.tr)a.tr.grp.visible=false;a.timer=wait;}
/* 前の電車と同じ線路か：支線は同じ方向なら同じ線路。ただし待避駅の中では各停（副本線）と快速（本線）は別の線路 */
function sameTrack(a,k2,s2,d2){if(!BRANCH)return physKey(k2)===physKey(a.key);if(d2!==a.dir)return false;const la=KIND[a.key]!=='rapid',lb=KIND[k2]!=='rapid';return !(la!==lb&&sidDev(s2)>0.3);}
/* 各停：待避駅で後ろから快速が来ていれば、快速が通過（発車）するまで待つ */
function rapidComing(a){const st=a.stSt;if(!st)return false;const chk=(k,s,d)=>{if(KIND[k]!=='rapid'||d!==a.dir)return false;const D=d*sdiff(s,st.s+TK[k].so);return D>-5&&D<3200;};
  for(const o of OT)if(o!==a&&o.state!=='off'&&o.key&&chk(o.key,o.s,o.dir))return true;
  if(!PAX&&G.phase==='play'&&chk(G.key,G.s,G.dir))return true;return false;}
function aiTurn(a,st){const ok=a.key,nk={A:'B',B:'A',C:'D',D:'C',E:'F',F:'E',G:'H',H:'G'}[ok]||ok;a.key=nk;a.dir=TK[nk].dir;if(a.tr){a.tr.flip=a.dir<0;a.tr.lastFrac=-1;setLook(a.tr,nk);if(a.insideSet)releaseInterior(a);const nC=a.tr.cars.length;a.tr.cars.reverse();a.tr.rev=!a.tr.rev;placeCrew(a.tr);
    /* v1.9.7：折り返しで号車の並びが反転するので、乗っている人の号車と位置も反転させる */
    if(typeof RIDE!=='undefined'&&RIDE&&RIDE.a===a){RIDE.k=nC-1-RIDE.k;RIDE.lz=-RIDE.lz;RIDE.lx=-RIDE.lx;RIDE.fl='deck';if(RIDE.seat!=null)RIDE.seat=null;
      try{if(a.tr.cars[RIDE.k]){if(camera.parent)camera.parent.remove(camera);a.tr.cars[RIDE.k].add(camera);}}catch(e){}}}else if(a.insideSet){releaseInterior(a);}
  a.s=st.s+TK[nk].so;a.state='dwell';a.v=0;a.t=dwellSec(a,st);a.dwellTot=a.t;a.last=st.i;a.side=TK[nk].side(st);a.flowed=false;a.sndF={};a.hold=0;a.pa={};a.sq=(a.sq|0)+1;
  if(POOL[ok]&&POOL[nk]){const i=POOL[ok].indexOf(a);if(i>=0){POOL[ok].splice(i,1);POOL[nk].push(a);}}}
/* 天宮支線の快速：待避駅より手前で前の各停に追いつかないよう、待避駅に着くのが各停より少し後になる速さで走る */
function rapidPace(a){let P=null,dP=1e9;for(const st of STATIONS){if(!isPassSt(st))continue;const D=a.dir*sdiff(a.s,st.s);if(D>30&&D<dP){dP=D;P=st;}}
  let gL=1e9;const cons=(k,s2,d)=>{if(d!==a.dir||KIND[k]==='rapid'||sidDev(s2)>0.3)return;const g=a.dir*sdiff(a.s,s2);if(g>0&&g<gL)gL=g;}; /* 副本線で待避中の各停は別の線路 */
  for(const o of OT)if(o!==a&&o.state!=='off'&&o.key)cons(o.key,o.s,o.dir);if(!PAX&&G.phase==='play')cons(G.key,G.s,G.dir);
  if(gL===1e9)return 99;const keep=Math.sqrt(2*0.5*Math.max(gL-carsFor(a.key)*CARL-520,0)); /* 最低でも500m以上あける */
  if(!P||gL>=dP-20)return keep;
  let sL=0,sR=0;for(const st of STATIONS){const D=a.dir*sdiff(a.s,st.s);if(D>gL+5&&D<dP-5)sL++;if(D>5&&D<dP-5&&serves(st,a.key))sR++;}
  const need=(dP-gL)/11+sL*32+30-sR*32;if(need<=8)return keep;return Math.min(keep,Math.max(5,(dP-60)/need));}
/* 単線：反対方向の電車がまだ港前に着いていない（向かってきている）か */
function oppComing(st,dir,self){const chk=(k,s2,d)=>{if(d===dir)return false;const D=d*sdiff(s2,st.s+TK[k].so);return D>3;};
  for(const o of OT)if(o!==self&&o.state!=='off'&&o.key&&chk(o.key,o.s,o.dir))return true;if(!PAX&&G.phase==='play'&&self!=='OWN'&&chk(G.key,G.s,G.dir))return true;return false;}
function miniHold(){if(!MINI||PAX)return false;const v=G.atStation!==null?G.atStation:G.depCheck;if(v==null)return false;const st=stOf(v);return st.cls==='I'&&oppComing(st,G.dir,'OWN');}
/* 他の電車：まだ乗り降りしている人がいるか */
/* v1.9.8：AI列車の停車時間（ドア扱いあり14秒／なし10秒、主要駅+3秒） */
function dwellSec(a,st){const s=st||(a&&a.stSt);return ((a&&a.doors)?20:12)+((s&&isMajorStation(s))?5:0);} /* 戸開から戸閉まで十分に乗れる停車時間（主要駅25秒） */
function aiBusy(a){for(const p of active){if(p.train===a&&(p.kind==='board'||p.kind==='jam'))return true;if(p.kind==='alight'&&p.st===(a.stSt&&a.stSt.i)&&p.flow===a.key&&p.path&&p.path.length>1&&p.delay<=0)return true;}return false;}
/* 汐見駅の分単位ダイヤ（外回り/内回り 各停・快速・快特） */
const SHIOMI_TT={
  A:[0,6,12,18,24,30,36,42,48,54],
  C:[0,7,14,21,28,35,42,49,56],
  E:[0,15,30,45],
  G:[0,8,16,24,32,40,48,56],
  B:[3,9,15,21,27,33,39,45,51,57],
  D:[3,10,17,24,31,38,45,52,59],
  F:[5,20,35,50],
  H:[4,12,20,28,36,44,52]
};
function nextShiomiDepMs(k,fromMs){
  const mins=SHIOMI_TT[k];if(!mins||!mins.length)return fromMs+hdwSec(k)*1000;
  const d=new Date(fromMs),curM=d.getMinutes(),curS=d.getSeconds();
  let m=mins.find(x=>x>curM||(x===curM&&curS<10));
  const out=new Date(fromMs);out.setSeconds(0,0);
  if(m===undefined){out.setHours(out.getHours()+1);m=mins[0];}
  out.setMinutes(m);return out.getTime();
}
function aiRun(a,dt){
  const T=TK[a.key];
  if(a.dispHold||a.troubleActive){a.v=Math.max(0,a.v-4.5*dt);a.s+=a.dir*a.v*dt;if(a.tr){a.tr.grp.visible=a.vis;if(a.vis){placeTrain(a.tr,a.s,T.off,T.y);if(a.doors)setDoors(a.tr,a.side,a.frac);if((a.charter||a.test)&&!a._cd){a._cd=1;try{drawDest(a.tr.dk,a.test?'試運転':'臨時');}catch(e){}}}}return;}
  const _isFollower=!MINI&&IS_ONLINE&&!isAiSyncLeader()&&_aiLastRx&&(Date.now()-_aiLastRx)<3500;
  if(_isFollower){
    if(a.state==='run'){
      const samps=a._samples;
      if(samps&&samps.length){
        const PLAYOUT=240;
        const trT=Date.now()-PLAYOUT;
        let sA=samps[0],sB=null;
        for(let i=samps.length-1;i>=0;i--){if(samps[i].ts<=trT){sA=samps[i];sB=samps[i+1]||null;break;}}
        let targetS;
        if(sB&&sB.ts>sA.ts){
          const u=clamp((trT-sA.ts)/(sB.ts-sA.ts),0,1);
          targetS=mod(sA.s+sdiff(sA.s,sB.s)*u,L);
        }else{
          const exSec=clamp((trT-sA.ts)/1000,0,1.2);
          targetS=mod(sA.s+(sA.d||a.dir)*(sA.v||0)*exSec,L);
        }
        const ds=sdiff(a.s,targetS);
        const fwd=ds*a.dir;
        if(Math.abs(ds)>80){a.s=targetS;}
        else if(fwd<-0.05){
          /* 目標が後ろにある時は絶対にバックさせず、その場で待つか速度を緩めて合流する */
          if(fwd<-3)a.v=0;
          else if(fwd<-1)a.v=Math.max(0,a.v-4*dt);
        }else{
          const maxStep=(Math.max(a.v||0,4)+10)*dt;
          a.s=mod(a.s+a.dir*clamp(fwd,0,maxStep),L);
        }
      }else{
        a.s=mod(a.s+a.dir*(a.v||0)*dt,L);
      }
      a.frac=0;
    }else if(a.state==='dwell'){
      a.v=0;
      a.t=Math.max(0.2,a.t-dt);
      const tf=a._targetFrac!=null?a._targetFrac:a.frac;
      a.frac=clamp(a.frac+(tf-a.frac)*clamp(dt*14,0,1),0,1);
      if(!a.dwellTot||a.dwellTot<a.t)a.dwellTot=Math.max(dwellSec(a,a.stSt),a.t);
      const tot=a.dwellTot||dwellSec(a),el=Math.max(0,tot-a.t);
      if(a.doors&&!a.flowed&&a.frac>=0.85){
        a.flowed=true;
        const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s;
        if(a.stSt&&Math.abs(sdiff(camS,a.stSt.s))<1400){const r=startFlows(a.stSt,a.key,a.stSt.s+T.so,a);a.load=a.test?0:clamp(a.load-Math.min(r.a,a.load)+r.b,0,maxLoadFor(a.key));}
        else a.load=a.test?0:clamp(a.load+irand(-6,10),Math.round(trainLoadFor(a.key)*0.55),maxLoadFor(a.key));
      }
      if(a.stSt)aiSounds(a,el,tot);
    }
    if(a.tr){a.tr.grp.visible=a.vis;if(a.vis){placeTrain(a.tr,a.s,T.off,T.y);if(a.doors)setDoors(a.tr,a.side,a.frac);if((a.charter||a.test)&&!a._cd){a._cd=1;try{drawDest(a.tr.dk,a.test?'試運転':'臨時');}catch(e){}}}}
    if((a.key==='I'||a.key==='J')&&a.state==='run'&&Math.abs(sdiff(SH7,a.s))>950)convertCharterToMain(a);
    return;
  }
  a._syncErr=0;
  if(a.state==='run'){const nx=aiStop(a);let vt=a.slowMode==='next'?Math.min(a.vmax,25/3.6):a.slowMode==='prev'?Math.min(a.vmax,20/3.6):a.vmax;
    if(nx){a._appSt=nx.st.i;vt=Math.min(vt,nx.D<=0.25?0:Math.sqrt(2*0.7*Math.max(nx.D,0)));}
    if(B3&&KIND[a.key]==='rapid')vt=Math.min(vt,rapidPace(a));
    const behindUs=a.follower&&G.dir*sdiff(G.s,a.s)<0;vt=Math.min(vt,behindUs?99:sigLimit(a.key,a.s,a.dir,a.v),(limitFor(a.key,a.s))/3.6);
    { // 同じ線路の前の電車（AI・自列車・他プレイヤー）に追突しないよう先行列車の全長と閉塞で制御
      let clearGap=Infinity;
      for(const o of OT){
        if(o===a||o.state==='off'||!o.dir||!sameTrack(a,o.key,o.s,o.dir))continue;
        const dd=a.dir*sdiff(a.s,o.s);
        const prevLen=(o.tr&&o.tr.cars?o.tr.cars.length:carsFor(o.key))*CARL;
        if(dd>0){const cg=dd-prevLen;if(cg<clearGap)clearGap=cg;}
      }
      if(!PAX&&G.dir===a.dir&&sameTrack(a,G.key,G.s,G.dir)){
        const dd=a.dir*sdiff(a.s,G.s);
        const prevLen=(typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars?ownTrain.cars.length:carsFor(G.key))*CARL;
        if(dd>0){const cg=dd-prevLen;if(cg<clearGap)clearGap=cg;}
      }
      if(IS_ONLINE&&window.ONLINE_PLAYERS){
        const curLine=(typeof CFG!=='undefined'&&CFG)?CFG.id:'loop';
        for(const pid in ONLINE_PLAYERS){
          const op=ONLINE_PLAYERS[pid];
          if(!op||op.isPax||op.state!=='driving'||op.s==null||!op.key)continue;
          if((op.line||'loop')!==curLine)continue;
          const od=TK[op.key]?TK[op.key].dir:1;
          if(od!==a.dir||!sameTrack(a,op.key,op.s,od))continue;
          const dd=a.dir*sdiff(a.s,op.s);
          const prevLen=(op.nCar||carsFor(op.key))*CARL;
          if(dd>0){const cg=dd-prevLen;if(cg<clearGap)clearGap=cg;}
        }
      }
      if(clearGap<Infinity){
        vt=Math.min(vt,Math.sqrt(2*0.40*Math.max(clearGap-75,0)));
        if(clearGap<=45)vt=0;
      }
      a._emerGap=(clearGap<=45);
      a._hardStop=(clearGap<=22);
    }
    const _isFollower=!MINI&&IS_ONLINE&&!isAiSyncLeader()&&_aiLastRx&&(Date.now()-_aiLastRx)<3500;
    if(nx&&!_isFollower&&((nx.D<=0.35&&a.v<1.3)||(nx.D<0&&a._appSt===nx.st.i&&a.v<6.0))){
      a.s=mod(nx.st.s+T.so,L);a.state='dwell';a.v=0;a.t=dwellSec(a,nx.st);a.dwellTot=a.t;a.stSt=nx.st;a.last=nx.st.i;a.side=T.side(nx.st);a.flowed=false;a.sndF={};a.hold=0;a.boardHold=0;a.slowMode=null;a.sq=(a.sq|0)+1;
      if(!BRANCH&&nx.st.i===0&&SHIOMI_TT[a.key]){const depMs=nextShiomiDepMs(a.key,nowMs()+12000);a.shiomiDepMs=depMs;a.t=clamp((depMs-nowMs())/1000,20,180);a.dwellTot=a.t;}}
    else{const maxDec=a._emerGap?-4.5:-2.4;a.v+=clamp((vt-a.v)*2,maxDec,0.8)*dt;a.v=a._hardStop?0:Math.max(0,a.v);a.s+=a.dir*a.v*dt;}}
  else if(a.state==='dwell'){a.t-=dt;
    const _isFollower=!MINI&&IS_ONLINE&&!isAiSyncLeader()&&_aiLastRx&&(Date.now()-_aiLastRx)<3500;
    if(_isFollower&&a.t<0.2)a.t=0.2;
    if(!BRANCH&&a.stSt&&a.stSt.i===0&&a.shiomiDepMs&&!a.forceDep){const rem=(a.shiomiDepMs-nowMs())/1000;if(rem>0&&rem<300){a.t=Math.max(a.t,rem);if(!a.dwellTot||a.dwellTot<a.t)a.dwellTot=a.t;}}
    if(!BRANCH&&a.stSt&&a.stSt.i===0&&a.yieldToPlayer){if(!PAX&&G.phase==='play'&&G.key===a.key&&Math.abs(sdiff(G.s,STATIONS[0].s))<180)a.t=Math.max(a.t,6);else a.yieldToPlayer=false;}
    if(B3&&a.doors&&KIND[a.key]!=='rapid'&&isPassSt(a.stSt)&&a.t<10&&(a.hold||0)<240&&rapidComing(a)){a.t=10;a.hold=(a.hold||0)+dt;} /* 待避 */
    if(MINI&&a.stSt&&a.stSt.cls==='I'&&a.t<10&&(a.hold||0)<900&&oppComing(a.stSt,a.dir,a)){a.t=10;a.hold=(a.hold||0)+dt;} /* 単線：対向列車を待って行き違い */
    if(a.doors&&a.t<9.4&&a.t>9.1&&(a.boardHold||0)<30&&aiBusy(a)){a.t=9.4;a.boardHold=(a.boardHold||0)+dt;} /* 乗り降りが終わるまで待つ（戸閉前に余裕を取る） */
    if(!a.dwellTot||a.dwellTot<a.t)a.dwellTot=Math.max(dwellSec(a,a.stSt),a.t);
    const tot=a.dwellTot||dwellSec(a),el=Math.max(0,tot-a.t);
    if(a.doors){a.frac=clamp(Math.min(el/2.4,(a.t-1.4)/2.6),0,1);
      if(!a.flowed&&a.frac>=1){a.flowed=true;const term=BRANCH&&((a.dir>0&&a.stSt.i===NST-1)||(a.dir<0&&a.stSt.i===0));
        if(term&&RIDE&&RIDE.a===a){toast('終点です。全員お降りください','warn');setTimeout(()=>{if(RIDE&&RIDE.a===a)alightTrain();},2600);} /* 乗客モードでも終点では降りる */
        const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s;
        if(a.stSt&&Math.abs(sdiff(camS,a.stSt.s))<1400){const r=startFlows(a.stSt,a.key,a.stSt.s+T.so,a);a.load=a.test?0:(term?r.b:clamp(a.load-Math.min(r.a,a.load)+r.b,0,maxLoadFor(a.key)));}else if(term||a.test)a.load=0;else a.load=clamp(a.load+irand(-6,10),Math.round(trainLoadFor(a.key)*0.55),maxLoadFor(a.key));}}
    if(a.stSt)aiSounds(a,el,tot);if(!_isFollower&&a.t<=0&&BRANCH&&a.stSt&&((a.dir>0&&a.stSt.i===NST-1)||(a.dir<0&&a.stSt.i===0))&&a!==FT){aiTurn(a,a.stSt);}
    else if(!_isFollower&&a.t<=0){const leftSt=a.stSt;if(leftSt)a.last=leftSt.i;a.state='run';a.frac=0;a.forceDep=false;a.shiomiDepMs=0;}
      /* 乗っている電車の発車後放送は updRide の「次駅放送」に一本化（同じ放送を2系統から同時に鳴らさない） */}
  if(a.tr){a.tr.grp.visible=a.vis;if(a.vis){placeTrain(a.tr,a.s,T.off,T.y);if(a.doors)setDoors(a.tr,a.side,a.frac);if((a.charter||a.test)&&!a._cd){a._cd=1;try{drawDest(a.tr.dk,a.test?'試運転':'臨時');}catch(e){}}}}
  /* 汐見13・14番線の列車は、本線へ合流したら各停として運転を続ける */
  if((a.key==='I'||a.key==='J')&&a.state==='run'&&Math.abs(sdiff(SH7,a.s))>950)convertCharterToMain(a);
}
function aiSounds(a,el,tot){
  if(!a.vis||!a.doors||!a.stSt||!a.tr||!a.tr.cars||!a.tr.cars[2])return;
  const d=a.tr.cars[2].position.distanceTo(camera.getWorldPosition(camW));if(d>320)return;
  if(!a.sndF.v&&a.t<6.6){a.sndF.v=1;if(d<(PAX?90:(G.v<3?65:0))&&!(typeof listenerSealed==='function'&&listenerSealed()))playGuide('tab_doors',getExtBus()||master,clamp(1.2/(1+Math.pow(d/60,2)),0.35,1.2));}
  if(!AC)return;if(AC.state==='suspended'){try{AC.resume();}catch(e){}}
  if(!a.sndF.o&&el>0.1){a.sndF.o=1;playAt(a.tr.cars[1].position,doorOpenSnd);}
  /* v1.9.8：ドアが開いてすぐ乗降促進メロディを1回鳴らし、鳴り終わり→戸締め放送→戸閉 の順で進める */
  if(a.sndF.mStart==null)a.sndF.mStart=(a.dwellTot||dwellSec(a))-1.2;
  if(!a.sndF.m0&&a.t<=a.sndF.mStart&&a.t>6.6)a.sndF.m0=1;
  if(a.sndF.m0&&a.t>6.6){const now=AC.currentTime;
    if((!a.sndF.mEnd||now>a.sndF.mEnd)&&(a.sndF.mLastM==null||now-a.sndF.mLastM>11)){
      const kd=BRANCH?'branch':KIND[a.key];let dur=6;
      playAt(a.tr.cars[1].position,dest=>{dur=kd==='branch'?(LINE_ID==='branch2'?playB2Melody(a.dir,dest,0.85):playSong(branchSongFor(a.stSt),dest,0.85)):kd==='rapid'?playSong(SONG_A,dest,0.85):kd==='ltd'?playSong(ltdSong(a.stSt.i),dest,0.85):melody(dest,0.85,undefined,a.dir);return dur;});
      a.sndF.mLastM=now;a.sndF.mEnd=now+Math.max(2,dur||6)+0.25;}}
  if(!a.sndF.c&&a.t<4.1){a.sndF.c=1;playAt(a.tr.cars[1].position,doorCloseSnd);}}
/* station PA: simple approach announcement for the platform the player is on */
let paCool=0;
function paStation(){if(PAX)return RIDE?null:W.st;if(G.atStation!==null||G.depCheck!==null){const st=stOf(G.atStation!==null?G.atStation:G.depCheck);return Math.abs(stopDist(G.atStation!==null?G.atStation:G.depCheck))<30?st:null;}return null;}
function updStationPA(dt){paCool-=dt;} /* 駅の接近放送・チャイムは updHomeDoors -> playApproachAnn に一本化（重複・誤チャイム防止） */
/* block-limited service on every track (locals, rapids, limited expresses) */
const POOL={};
/* 乗務員：運転士は運転台の椅子に座って前を向く。ツーマンの電車は最後尾の乗務員室に車掌が立つ */
/* 乗務員の位置：先頭の運転台に運転士、ツーマンなら最後尾に車掌（折り返しで入れ替わる） */
function placeCrew(tr){if(!tr||!tr.crew||!tr.crew.length)return;const f=tr.cars[0],l=tr.cars[tr.cars.length-1],fr=f.userData.cabR&&!f.userData.cabF;
  const d=tr.crew[0];f.add(d);if(fr){d.position.set(-XE,1.83-0.84,CARHALF-ZE-0.3);d.rotation.y=0;}else{d.position.set(XE,1.83-0.84,ZE+0.3-CARHALF);d.rotation.y=Math.PI;}
  if(tr.crew[1]){const c2=tr.crew[1],lr=l.userData.cabR&&!l.userData.cabF;l.add(c2);if(lr){c2.position.set(0.35,1.16,CARHALF-1.35);c2.rotation.y=-0.6;}else{c2.position.set(-0.35,1.16,-(CARHALF-1.35));c2.rotation.y=Math.PI-0.6;}}}
/* 自列車の運転士・車掌も「他の人から見える」ように実体を置く。
   運転席から見える本物の運転台（レイヤー2）とは別に、車外・車内巡回から見える（レイヤー1）。 */
let OWNCREWSIG='',OWNCREWT=0;
function updOwnCrew(){if(typeof ownTrain==='undefined'||!ownTrain||!ownTrain.cars||!ownTrain.cars.length)return;
  const nowT=(typeof performance!=='undefined'?performance.now():Date.now());
  if(!ownTrain.crew||nowT-OWNCREWT>1500){
    OWNCREWT=nowT;
    const sig=(G.twoMan?1:0)+'|'+(CREWSEL||'one')+'|'+JSON.stringify(AVATAR||null);
    if(ownTrain.crew&&OWNCREWSIG!==sig){for(const m of ownTrain.crew){try{if(m.parent)m.parent.remove(m);}catch(e){}}ownTrain.crew=null;}
    if(!ownTrain.crew){try{addCustomCrew(ownTrain,!!G.twoMan,AVATAR,CREWSEL||'one');OWNCREWSIG=sig;placeCrew(ownTrain);}catch(e){}}
  }
  const c=ownTrain.crew||[];
  try{const f=ownTrain.cars[0],l=ownTrain.cars[ownTrain.cars.length-1];
    if(c[0]&&c[0].parent!==f)placeCrew(ownTrain);
    else if(c[1]&&c[1].parent!==l)placeCrew(ownTrain);
  }catch(e){}
  if(c[0])c[0].visible=!G.walkOn;
  if(c[1])c[1].visible=!!G.twoMan&&!(G.walkOn&&G.walkArea==='train');
}
function addCrew(tr,two){if(!tr||!tr.cars||tr.crew)return;tr.crew=[];const c0=tr.cars[0],cL=tr.cars[tr.cars.length-1];
  const drv=new THREE.Mesh(SSITG[0],upperMat);drv.position.set(XE,1.83-0.84,ZE+0.3-CARHALF);drv.rotation.y=Math.PI;c0.add(drv);tr.crew.push(drv);
  if(two){const cd=new THREE.Mesh(SSTANDG[1]||SSTANDG[0],upperMat);cd.position.set(0.35,1.16,CARHALF-1.35);cd.rotation.y=-0.6;cL.add(cd);tr.crew.push(cd);}
  for(const m of tr.crew)m.layers.mask=c0.layers.mask;}

function addCustomCrew(tr,two,avatar,crewMode){if(!tr||!tr.cars||tr.crew)return;tr.crew=[];const c0=tr.cars[0],cL=tr.cars[tr.cars.length-1];
  let drvGeo=SSITG[0],condGeo=SSTANDG[1]||SSTANDG[0],condScale=1;
  if(avatar&&typeof avatarDesc==='function'){
    try{
      const D=avatarDesc(avatar);
      if(D.child){
        VDC.push(D);const vi=VDC.length-1;
        if(crewMode==='twoC'){condGeo=colored(partsOf(vi,true,'stand'));condGeo.computeBoundingBox();condScale=(avatar.height||170)/100/Math.max(0.5,condGeo.boundingBox.max.y);}
        else drvGeo=colored(partsOf(vi,true,'sit'));
      }else{
        VD.push(D);const vi=VD.length-1;
        if(crewMode==='twoC'){condGeo=colored(partsOf(vi,false,'stand'));condGeo.computeBoundingBox();condScale=(avatar.height||170)/100/Math.max(0.5,condGeo.boundingBox.max.y);}
        else drvGeo=colored(partsOf(vi,false,'sit'));
      }
    }catch(e){}
  }
  const drv=new THREE.Mesh(drvGeo,upperMat);drv.position.set(XE,1.83-0.84,ZE+0.3-CARHALF);drv.rotation.y=Math.PI;c0.add(drv);tr.crew.push(drv);
  if(two){const cd=new THREE.Mesh(condGeo,upperMat);cd.position.set(0.35,1.16,CARHALF-1.35);cd.rotation.y=-0.6;if(condScale!==1)cd.scale.set(condScale,condScale,condScale);cL.add(cd);tr.crew.push(cd);}
  for(const m of tr.crew)m.layers.mask=c0.layers.mask;}
const POOL_CNT_MAP={A:8,B:8,C:6,D:6,E:4,F:4};
const POOL_CNT=BRANCH?(LINE_ID==='branch4'?1:LINE_ID==='branch'?2:LINE_ID==='branch2'?3:LINE_ID==='branch3'?2:4):16;
const TR_POOL={};
for(const k of ALLK){POOL[k]=[];TR_POOL[k]=[];const nP=BRANCH?POOL_CNT:(POOL_CNT_MAP[k]||4);
  for(let i=0;i<nP;i++){
    const TWO=KIND[k]==='ltd'&&i%2===1;
    const isOld=B3?(KIND[k]!=='rapid'&&i%2===0):(!!BRANCH&&LINE_ID!=='branch2'&&LINE_ID!=='branch5');
    let tr=null;
    if(BRANCH||MINI){
      tr=buildTrain('',TK[k].dir<0,SVCLOOK[k][0],true,greenCarsFor(k),carsFor(k),B3?(KIND[k]!=='rapid'&&i%2===0):undefined,KIND[k]==='exp');
      setLook(tr,k);addCrew(tr,TWO);
    }
    const ai=mkAI('P'+k+i,tr,{key:k,dir:TK[k].dir,vmax:BRANCH?(LINE_ID==='branch5'?55.6:(KIND[k]==='rapid'?22:18)):VMAX[k],old:isOld});
    ai.twoMan=TWO;POOL[k].push(ai);
  }
}
/* 臨時・団体列車ダイヤ：汐見の前後から臨時列車を増発し、13・14番線に団体列車を停車させる。
   開始直後はどの列車も走っている（空きがない）ため、空きが出るまで数秒おきに再試行する。 */
function charterCount(){let n=0;for(const a of OT)if(a.charter)n++;return n;}
/* 臨時列車に使う車両を確保：空き車両がなければ、プレイヤーから十分離れた列車を転用する（見えない位置なので見た目は変わらない） */
function takeFreeTrain(pool){
  if(!pool)return null;
  let a=pool.find(x=>x.state==='off'&&!x.charter);if(a)return a;
  let best=null,bd=0;for(const x of pool){if(x.charter)continue;const d=Math.abs(sdiff(G.s,x.s));if(d>3000&&d>bd){bd=d;best=x;}}
  if(best){try{releaseAiTr(best);}catch(e){}}
  return best;
}
function spawnCharter(){
  if(BRANCH||PAX||G.phase!=='play')return;
  const cap=6;let n=0,ij=0;
  if(charterCount()>=cap)return;
  for(const k of ['A','B','C','D']){
    if(charterCount()+n>=cap)break;
    const pool=POOL[k];if(!pool)continue;
    const a=takeFreeTrain(pool);if(!a)continue;
    const d=TK[k].dir;
    const p2=mod(STATIONS[0].s+TK[k].so-d*(k==='A'||k==='C'?1400:2200),L);
    if(!hasTrack(p2)||!hasTrack(p2+d*160))continue;
    {const minSep=carsFor(k)*CARL+140;
      if(OT.some(o=>o!==a&&o.state!=='off'&&o.key&&physKey(o.key,p2)===physKey(k,p2)&&Math.abs(sdiff(o.s,p2))<minSep))continue;
      if(!PAX&&G.phase==='play'&&physKey(G.key,p2)===physKey(k,p2)&&Math.abs(sdiff(G.s,p2))<minSep)continue;}
    a.key=k;a.charter=true;a._cd=0;a.dir=d;a.vmax=VMAX[k];a.twoMan=false;
    aiSpawn(a,p2,0);n++;
  }
  /* 汐見駅13・14番線：臨時・団体列車をホームに停車させる（13番線＝I、14番線＝J） */
  const st0=STATIONS[0];
  for(const k of ['I','J']){
    if(charterCount()+n>=cap)break;
    const has=OT.some(a=>a.key===k&&a.state!=='off');
    if(has)continue;
    const src=takeFreeTrain(POOL.A)||takeFreeTrain(POOL.C);
    if(!src)continue;
    src.key=k;src.dir=1;src.charter=true;src._cd=0;src.twoMan=false;src.vmax=VMAX.A;src.insideSet=false;
    src.last=-1;src.shiomiDepMs=0;
    aiSpawn(src,mod(st0.s+TK[k].so,L),0);
    src.state='dwell';src.stSt=st0;src.last=0;src.t=rand(70,110);src.dwellTot=src.t;
    src.side=TK[k].side(st0);src.frac=0;src.flowed=false;src.sndF={};src.hold=0;src.boardHold=0;src.doors=true;
    n++;ij++;
  }
  if(n)toast('臨時列車を'+n+'本増発しました'+(ij?'（汐見駅13・14番線に団体列車）':''),'ok');
  if(charterCount()<cap&&(G._charterTry||0)<14){G._charterTry=(G._charterTry||0)+1;setTimeout(()=>{try{spawnCharter();}catch(e){}},4500);}
}
/* 13・14番線を発車した臨時列車を、本線（各停）の列車として運転させる */
function convertCharterToMain(a){
  if(a.key!=='I'&&a.key!=='J')return;
  const nk='A';a.key=nk;a.dir=TK[nk].dir;a.vmax=VMAX[nk];a.last=-1;a._cd=0;a.shiomiDepMs=0;
  if(a.tr){a.tr.flip=a.dir<0;a.tr.lastFrac=-1;a.tr.lastSide=0;setLook(a.tr,nk);}
}
/* ===== v2.5.0：試運転列車のAI運行 =====
   各停と同じ線路・停車駅・信号・閉塞で、前面/側面の幕を「試運転」にして走る。
   ときどき1本だけ出庫し、一定間隔で入れ替える（同時に1本までの制限）。 */
function testCount(){let n=0;for(const a of OT)if(a&&a.test&&a.state!=='off')n++;return n;}
function spawnTestRun(){
  if(BRANCH||PAX||G.phase!=='play')return;
  if(testCount()>=1)return;
  for(const k of ['A','B']){
    const pool=POOL[k];if(!pool)continue;
    const a=takeFreeTrain(pool);if(!a)continue;
    const d=TK[k].dir;
    const p2=mod(STATIONS[0].s+TK[k].so-d*3200,L);
    if(!hasTrack(p2)||!hasTrack(p2+d*160))continue;
    const minSep=carsFor(k)*CARL+170;
    if(OT.some(o=>o!==a&&o.state!=='off'&&o.key&&physKey(o.key,p2)===physKey(k,p2)&&Math.abs(sdiff(o.s,p2))<minSep))continue;
    if(physKey(G.key,p2)===physKey(k,p2)&&Math.abs(sdiff(G.s,p2))<minSep)continue;
    a.key=k;a.test=true;a.charter=false;a._cd=0;a.dir=d;a.vmax=VMAX[k];a.twoMan=false;a.insideSet=false;a.last=-1;a.shiomiDepMs=0;a.load=0;
    aiSpawn(a,p2,0);
    try{if(a.tr){drawDest(a.tr.dk,'試運転');a._cd=1;}}catch(e){}
    break;
  }
}
/* ===== v2.5.0：撮り鉄（カメラを構えた人）=====
   普段は少人数。試運転・臨時・団体列車が走るとき（＝試運転/臨時ダイヤ時や
   試運転列車の在線時）は、ホーム端（エキセン）や線路沿いの撮影地に増える。 */
let CAMFANS=null;
function cameraFanMesh(){
  const p=makePerson('adult');
  const cam=new THREE.Mesh(boxGeo(0.22,0.15,0.28),lam(0x14161a));cam.position.set(0,1.52,0.3);p.add(cam);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.065,0.18,10),lam(0x2b2f36));lens.rotation.x=Math.PI/2;lens.position.set(0,1.52,0.47);p.add(lens);
  return p;
}
function buildCameraFans(heavy){
  try{if(CAMFANS){scene.remove(CAMFANS);CAMFANS=null;}}catch(e){}
  if(PAX||MINI)return;
  const tk=TK.A;if(!tk||!STATIONS.length)return;
  const grp=new THREE.Group();scene.add(grp);CAMFANS=grp;
  const add=(s,o,y,ry)=>{try{const p=cameraFanMesh();p.position.copy(offs(s,o,y));p.rotation.y=ry;p.layers.mask=1;grp.add(p);}catch(e){}};
  const sts=STATIONS.filter(st=>isMajorStation(st));
  const want=Math.min(sts.length,heavy?10:4);
  for(let i=0;i<want;i++){
    const st=sts[(i*3+1)%sts.length];if(!st)continue;
    const n=heavy?(st.cls==='M'?3:2):1;
    const key=physKey('A',st.s);
    let lo=0,hi=0;try{const r=platRange(st,key);lo=r[0];hi=r[1];}catch(e){continue;}
    for(let j=0;j<n;j++){
      const side=(j%2)?1:-1;
      const s=st.s+side*(Math.max(6,PBof(st)/2-5)-j*2.4);
      const o=side>0?hi-1.0:lo+1.0;
      const t=P(s)[2];
      add(s,o,PH,-t+(side>0?-Math.PI/2:Math.PI/2));
    }
  }
  if(heavy&&!BRANCH){ /* 線路沿いの撮影地（地上区間かつ最外線のさらに外側のみ） */
    for(let i=0;i<8;i++){
      const s=mod(STATIONS[0].s+L*(0.12+i*0.105),L);
      if(!hasTrack(s)||Math.abs(Yat(s))>0.25)continue;
      if(STATIONS.some(st=>Math.abs(sdiff(st.s,s))<PBof(st)+25))continue;
      const o=TK.A.o+9.5;
      const t=P(s)[2];
      add(s,o,0,-t-Math.PI/2);
    }
  }
}
function refreshCameraFans(){
  const heavy=!!(DIASH==='extra'||DIASH==='change'||testCount()>0||(typeof G!=='undefined'&&G&&(G.isTest||G.isExtra||G.isCharter)));
  if(CAMFANS&&CAMFANS.userData.heavy===heavy)return;
  buildCameraFans(heavy);
  if(CAMFANS)CAMFANS.userData.heavy=heavy;
}
function acquireAiTr(a){
  if(a.tr)return a.tr;
  const tp=TR_POOL[a.key]||(TR_POOL[a.key]=[]);
  let tr=tp.pop();
  if(!tr){
    tr=buildTrain('',TK[a.key].dir<0,SVCLOOK[a.key][0],true,greenCarsFor(a.key),carsFor(a.key),false);
    addCrew(tr,a.twoMan);
  }
  tr.flip=a.dir<0;tr.rev=false;tr.lastFrac=-1;tr.lastSide=0;
  setLook(tr,a.key);
  tr.grp.visible=false;
  a.tr=tr;
  return tr;
}
function releaseAiTr(a){
  if(!a.tr)return;
  if(a.insideSet)releaseInterior(a);
  a.tr.grp.visible=false;
  (TR_POOL[a.key]||(TR_POOL[a.key]=[])).push(a.tr);
  a.tr=null;
}
addCrew(followT,false);
/* 運転間隔（秒）：本線は汐見駅分単位ダイヤ（各停20分・快速5分・快特10分）に合わせてAI運行 */
function hdwSec(k){const h=hourNow(),kd=KIND[k]||'local',rush=isRushHour(),night=h>=22||h<5.5;if(h>=1&&h<4.5&&(BRANCH||kd==='ltd'))return 99999; /* 環状線の各停・快速は24時間運転 */
  if(!BRANCH)return ({local:360,rapid:420,ltd:900,exp:600}[kd]||360); /* 各停6分・快速7分・特急10分・快特15分 */
  if(LINE_ID==='branch5')return (rush?12:night?30:20)*60; /* 連絡高速線は長距離のため本数少なめ */
  return (rush?2.5:night?8:4)*60;} /* 支線も朝ラッシュは2.5分間隔 */
function spacingNow(k){const kd=KIND[k]||'local',v=BRANCH?(LINE_ID==='branch5'?54:(kd==='rapid'?14:11)):({local:13,rapid:17,ltd:22,exp:19})[kd]||13;
  return hdwSec(k)*v*(B3&&!PAX&&TK[k].dir!==G.dir?0.5:1);} /* 天宮支線：対向列車は2倍 */
function spacingNowOld(k){const h=hourNow(),kd=KIND[k]||'local';if(BRANCH)return h>=6&&h<22?1100:2600/Math.max(0.08,freqF(h));const day={local:420,rapid:900,ltd:2000,exp:1200}[kd]||420;return h>=7&&h<20?day:day*2/Math.max(0.08,freqF(h));}
const POOLT={};
/* 港見支線：電車は2本だけ。起点と終点から同時に出て、港前で行き違い、終点で折り返す */
const MINIS={spawned:false};
function miniSpawn(k,st){const a=POOL[k].find(x=>x.state==='off');if(!a)return;a.key=k;a.dir=TK[k].dir;aiSpawn(a,st.s+TK[k].so,0);a.state='dwell';a.v=0;a.t=34;a.stSt=st;a.last=st.i;a.side=TK[k].side(st);a.flowed=false;a.sndF={};a.hold=0;a.sq=(a.sq|0)+1;}
function isNearPlayerSpawn(a,pos){
  if(PAX||G.phase!=='play'||!a)return false;
  if(!MINI&&!sameTrack(a,G.key,pos,G.dir))return false;
  const ownLen=(typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars?ownTrain.cars.length:carsFor(G.key))*CARL;
  const aiLen=carsFor(a.key)*CARL;
  const dd=G.dir*sdiff(G.s,pos);
  return dd>-(ownLen+aiLen+750)&&dd<(ownLen+aiLen+1650);
}
function clearAiAroundPlayerSpawn(){
  if(PAX||G.phase!=='play')return;
  const ownLen=(typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars?ownTrain.cars.length:carsFor(G.key))*CARL;
  for(const a of OT){
    if(!a||a.state==='off'||a.follower)continue;
    if(!isNearPlayerSpawn(a,a.s))continue;
    const aiLen=carsFor(a.key)*CARL;
    if(BRANCH||MINI){aiHide(a,12);continue;}
    const dd=G.dir*sdiff(G.s,a.s);
    const shift=(dd>=0)?(ownLen+aiLen+1800):-(ownLen+aiLen+950);
    a.s=mod(G.s+G.dir*shift,L);a._syncErr=0;
    if(a.state==='dwell'){a.state='run';a.stSt=null;a.frac=0;a.v=a.vmax*0.7;}
    if(a.tr)a.tr.grp.visible=false;
  }
}
function initSyncedAiTrains(){
  if(MINI)return;
  if(BRANCH){
    if(_brAiInit)return;_brAiInit=true;
    const seeds=branchAiSeeds(LINE_ID,STATIONS,TRK0,TRK1);
    for(const sd of seeds){
      const pool=POOL[sd.key];if(!pool)continue;
      const a=pool.find(x=>x.state==='off');if(!a)continue;
      let pos=mod(sd.s,L);
      if(!hasTrack(pos))pos=clamp(pos,TRK0+40,TRK1-40);
      if(isNearPlayerSpawn(a,pos))pos=clamp(pos+(TRK1-TRK0)*0.5,TRK0+40,TRK1-40);
      a.key=sd.key;a.dir=TK[sd.key].dir;aiSpawn(a,pos);
    }
    return;
  }
  for(const k of ALLK){
    const pool=POOL[k];if(!pool||!pool.length)continue;
    const T=TK[k],s0=STATIONS[0].s+T.so,kIdx=ALLK.indexOf(k);
    const cnt=pool.length;
    for(let i=0;i<cnt;i++){
      const a=pool[i];
      if(a.state!=='off')continue;
      let pos=mod(s0+T.dir*((i*(L/cnt))+(kIdx*420)),L);
      a.key=k;
      if(isNearPlayerSpawn(a,pos))pos=mod(pos+L*0.45,L);
      if(isNearPlayerSpawn(a,pos))pos=mod(pos+L*0.25,L);
      aiSpawn(a,pos);
    }
  }
}
let _aiSyncT=0,_aiLastRx=0,_aiLeaderId=null,_brAiInit=false;
function isAiSyncLeader(){
  if(!window.ONLINE_PLAYERS||!window.ONLINE_CLIENT_ID)return true;
  const myLine=(typeof CFG!=='undefined'&&CFG)?(CFG.id||'loop'):'loop';
  const nowT=Date.now();
  const meHidden=(typeof document!=='undefined'&&document.visibilityState==='hidden');
  const vd=document.getElementById('viewDispatch');
  const meDisp=!!(vd&&!vd.classList.contains('hide'))||window.__DISP_MONITOR===true;
  const dispIds=meDisp?[ONLINE_CLIENT_ID]:[];
  const activeIds=[];
  if(!meHidden)activeIds.push(ONLINE_CLIENT_ID);
  for(const pid in ONLINE_PLAYERS){
    const p=ONLINE_PLAYERS[pid];
    if(!p||!p.id||p.state==='title')continue;
    if((p.line||'loop')!==myLine)continue;
    if(p.lastSeen&&(nowT-p.lastSeen)>5000)continue;
    activeIds.push(p.id);
    if(p.state==='dispatch')dispIds.push(p.id);
  }
  if(!activeIds.length&&!dispIds.length)return true;
  const pool=dispIds.length?dispIds:activeIds;
  pool.sort();
  return pool[0]===ONLINE_CLIENT_ID;
}
window.handleAiPacket=(topic,ap)=>{
  if(!ap)return;
  const MYLN=(typeof CFG!=='undefined'&&CFG)?(CFG.id||'loop'):'loop';
  if(topic==='shiomi3d/v1/ai/state'&&(ap.line||'loop')!==MYLN)return; /* 別の路線のAI列車の状態は適用しない */
  if(topic==='shiomi3d/v1/ai/cmd'&&ap.name){
    const a=OT.find(x=>x&&x.name===ap.name);if(!a)return;
    a._cmdTs=ap.ts||Date.now();
    if(ap.cmd==='stop'){a.dispHold=true;a.slowMode=null;a.v=Math.min(a.v||0,2);}
    else if(ap.cmd==='resume'){a.dispHold=false;a.troubleActive=false;a.slowMode=null;a.forceDep=true;}
    else if(ap.cmd==='prevStation'){a.dispHold=false;a.troubleActive=false;a.slowMode='prev';}
    else if(ap.cmd==='nextStation'){a.dispHold=false;a.troubleActive=false;a.slowMode='next';}
    else if(ap.cmd==='trouble'){a.troubleActive=true;a.dispHold=true;a.v=Math.min(a.v||0,2);}
    else if(ap.cmd==='yield'){a.forceDep=false;a.yieldToPlayer=true;}
    else if(ap.cmd==='forceDep'){a.yieldToPlayer=false;a.forceDep=true;if(a.state==='dwell'&&a.t>5)a.t=5;}
    return;
  }
  if(topic==='shiomi3d/v1/ai/state'&&ap.leader&&ap.leader!==ONLINE_CLIENT_ID&&Array.isArray(ap.trains)){
    const rxMs=Date.now();
    _aiLastRx=rxMs;_aiLeaderId=ap.leader;
    for(const t of ap.trains){
      const a=OT.find(x=>x&&x.name===t.n);if(!a)continue;
      const cmdLock=(a._cmdTs&&(rxMs-a._cmdTs)<5000);
      if(!PAX&&G.phase==='play'&&G.v<1.0&&(nowMs()-(G._spawnMs||0))<15000&&isNearPlayerSpawn(a,t.s)){
        const ownLen=(typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars?ownTrain.cars.length:carsFor(G.key))*CARL;
        const aiLen=carsFor(a.key)*CARL;
        a.s=mod(G.s-G.dir*(ownLen+aiLen+750),L);a._syncErr=0;a._samples=[];a.v=0;a.vis=false;if(a.tr)a.tr.grp.visible=false;continue;
      }
      if(a.state==='off'){a.key=t.k;aiSpawn(a,t.s,t.v);a._samples=[];}
      a._samples=a._samples||[];
      a._samples.push({ts:rxMs,s:t.s,v:t.v,d:t.d,st:t.st,f:t.f});
      if(a._samples.length>6)a._samples.shift();
      a._syncErr=0;
      const prevSt=a.state;
      if(t.st!==a.state){
        a.state=t.st;
        if(t.st==='dwell'){a.flowed=false;a.sndF={};a.hold=0;a.boardHold=0;a.s=t.s;a.v=0;a._samples=[{ts:rxMs,s:t.s,v:0,d:t.d,st:'dwell',f:t.f}];}
        if(t.st==='run'){a.frac=0;a._targetFrac=0;}
        if(Math.abs((t.v||0)-(a.v||0))>4)a.v=t.v;
      }else if(Math.abs(a.v-t.v)>0.5){a.v+=(t.v-a.v)*0.35;}
      if(t.st==='dwell'){
        const dSt=Math.abs(sdiff(a.s,t.s));
        if(dSt>0.5)a.s=t.s;
      }
      a.dir=t.d;a.side=t.sd;if(t.f!=null)a._targetFrac=t.f;
      if(!cmdLock){a.dispHold=!!t.dh;a.slowMode=t.sm||null;a.troubleActive=!!t.tb;}
      if(t.t!=null&&isFinite(t.t))a.t=t.t;
      if(t.q!=null)a.sq=t.q|0;
      if(t.d0!=null&&isFinite(t.d0))a.dwellTot=t.d0;
      if(t.st==='dwell'){a.stSt=stationNear(t.s);if(a.stSt)a.last=a.stSt.i;if(prevSt!=='dwell'&&!a.dwellTot)a.dwellTot=dwellSec(a,a.stSt);}else{a.stSt=null;}
    }
    if(BRANCH){
      const activeNames=new Set(ap.trains.map(t=>t.n));
      for(const a of OT){if(a&&a.state!=='off'&&!activeNames.has(a.name)&&!(RIDE&&RIDE.a===a))aiHide(a,0);}
    }
  }
};
let _aiInitCleared=false;
function updPools(dt){const on=G.phase==='play'||window.__DISP_MONITOR;
  if(!BRANCH&&!MINI&&on){
    initSyncedAiTrains();
    if(!_aiInitCleared&&G.phase==='play'&&!PAX){_aiInitCleared=true;clearAiAroundPlayerSpawn();}
    const camS=PAX?(RIDE?RIDE.a.s:W.s):(window.__DISP&&window.__DISP.on&&window.__DISP.focusS!=null?window.__DISP.focusS:G.s);
    const dispSel=(window.__DISP&&window.__DISP.on)?window.__DISP.sel:null;
    for(const k of KEYS)for(const a of POOL[k]){
      if(a.state==='off'){if(a.tr&&!(RIDE&&RIDE.a===a))releaseAiTr(a);continue;}   /* v1.9.7：乗っている列車は戻さない */
      const dist=Math.abs(sdiff(camS,a.s));
      const isRide=!!(RIDE&&RIDE.a===a);
      const isSel=dispSel===('ai:'+a.name);
      if(!a.tr)acquireAiTr(a);
      a.vis=!!a.tr&&(dist<2600||isRide||isSel);
      aiRun(a,dt);
    }
    _aiSyncT+=dt;
    if(_aiSyncT>=0.3){
      _aiSyncT=0;
      if(ONLINE_CLIENT&&ONLINE_CLIENT.connected&&isAiSyncLeader()){
        /* v1.9.7：数値が欠けた列車があっても同期発信が例外で止まらないように（更新が飛んでカクつく原因） */
        const N2=x=>{const v=Number(x);return isFinite(v)?v:0;};
        const trains=OT.filter(a=>a&&a.state!=='off').map(a=>({n:a.name,k:a.key,s:+N2(a.s).toFixed(1),v:+N2(a.v).toFixed(2),st:a.state,d:a.dir,sd:a.side,f:+N2(a.frac).toFixed(2),dh:!!a.dispHold,sm:a.slowMode||null,tb:!!a.troubleActive,t:+N2(a.t).toFixed(1),q:a.sq|0,d0:+N2(a.dwellTot||0).toFixed(1)}));
        try{ONLINE_CLIENT.publish('shiomi3d/v1/ai/state',JSON.stringify({leader:ONLINE_CLIENT_ID,line:(CFG.id||'loop'),ts:Date.now(),trains}),{qos:0});}catch(e){}
      }
    }
    return;
  }
  if(MINI){for(const k of KEYS)for(const a of POOL[k].slice())if(a.state!=='off')aiRun(a,dt);
    if(on&&!MINIS.spawned){MINIS.spawned=true;const s0=STATIONS[0],sN=STATIONS[NST-1];if(PAX){miniSpawn('A',s0);miniSpawn('B',sN);}else if(TK[G.key].dir>0)miniSpawn('B',sN);else miniSpawn('A',s0);}
    return;}
  if(on)initSyncedAiTrains();
  const _brFollower=BRANCH&&IS_ONLINE&&LINE_ID!=='branch4'&&!isAiSyncLeader()&&_aiLastRx&&(Date.now()-_aiLastRx)<3500;
  if(_brFollower){
    for(const k of ALLK)for(const a of POOL[k]){if(a.state==='off')continue;aiRun(a,dt);if(!a.tr)acquireAiTr(a);a.vis=!!a.tr;}
    return;
  }
  const bCap=(LINE_ID==='branch')?(isRushHour()?2:1):99;
  if(LINE_ID==='branch'&&on){
    const act=[];for(const k of ALLK)for(const a of POOL[k])if(a.state!=='off')act.push(a);
    if(act.length>bCap){act.sort((x,y)=>Math.abs(sdiff(G.s,y.s))-Math.abs(sdiff(G.s,x.s)));
      for(let i=0;i<act.length-bCap;i++){const a=act[i];if(!PAX&&a.key===G.key)continue;aiHide(a,0);}}
  }
  if(BRANCH&&on&&LINE_ID!=='branch4'&&ONLINE_CLIENT&&ONLINE_CLIENT.connected&&isAiSyncLeader()){
    _aiSyncT+=dt;
    if(_aiSyncT>=0.3){
      _aiSyncT=0;
      const N2=x=>{const v=Number(x);return isFinite(v)?v:0;};
      const trains=OT.filter(a=>a&&a.state!=='off').map(a=>({n:a.name,k:a.key,s:+N2(a.s).toFixed(1),v:+N2(a.v).toFixed(2),st:a.state,d:a.dir,sd:a.side,f:+N2(a.frac).toFixed(2),dh:!!a.dispHold,sm:a.slowMode||null,tb:!!a.troubleActive,t:+N2(a.t).toFixed(1),q:a.sq|0,d0:+N2(a.dwellTot||0).toFixed(1)}));
      try{ONLINE_CLIENT.publish('shiomi3d/v1/ai/state',JSON.stringify({leader:ONLINE_CLIENT_ID,line:(CFG.id||'loop'),ts:Date.now(),trains}),{qos:0});}catch(e){}
    }
  }
  for(const k of ALLK){const sp=spacingNow(k),pool=POOL[k],d=TK[k].dir,own=!PAX&&G.key===k;
    for(const a of pool){if(a.state==='off')continue;aiRun(a,dt);if(RIDE&&RIDE.a===a){if(!a.tr)acquireAiTr(a);continue;}const rel=d*sdiff(G.s,a.s);if(rel>4200||rel<-3200||(own&&rel<-150&&rel>-400)||!hasTrack(a.s)||(!BRANCH&&!hasTrack(a.s+a.dir*125)))aiHide(a,0);}
    POOLT[k]=(POOLT[k]||0)-dt;
    if(!on)continue;const free=pool.find(a=>a.state==='off');if(!free)continue;
    const act=pool.filter(a=>a.state!=='off');
    if(LINE_ID==='branch'&&bCap<99){let tot=0;for(const kk of ALLK)for(const aa of POOL[kk])if(aa.state!=='off')tot++;if(tot>=bCap)continue;}
    if(sp>50000||act.length>=Math.min(pool.length,Math.ceil(7400/sp)+1))continue;   // 見える範囲（約7.4km）に入る本数まで
    const minSep=carsFor(k)*CARL+220,clearAt2=p2=>act.every(a=>Math.abs(sdiff(a.s,p2))>minSep)&&(!(!PAX&&G.phase==='play'&&sameTrack({key:k,dir:d},G.key,p2,G.dir))||(G.dir*sdiff(G.s,p2)<-minSep||G.dir*sdiff(G.s,p2)>1750));
    const rels=act.map(a=>d*sdiff(G.s,a.s));
    if(own){const ahead=rels.filter(r=>r>0),near=ahead.length?Math.min(...ahead):Infinity;
      if(near>Math.min(4100,sp*1.2)&&(sp<4100||POOLT[k]<=0)){const r=Math.min(4050,Math.max(1850,sp*rand(0.95,1.08))); /* 前の電車：最低でも閉塞2つ分以上先 */
        const p2=G.s+d*r;if(clearAt2(p2)&&hasTrack(p2)&&hasTrack(p2+d*200)){free.key=k;aiSpawn(free,p2);if(sp>=4100)POOLT[k]=hdwSec(k)*rand(0.85,1.15);}}}
    else if(B3&&KIND[k]==='rapid'){ /* 天宮支線の快速：各駅停車の1.7〜2.5km後ろにだけ出す（必ず各停の後に快速） */
      const lk=d>0?'A':'B',locs=[];for(const o of OT)if(o.state!=='off'&&o.key===lk)locs.push(o.s);if(!PAX&&G.key===lk)locs.push(G.s);
      locs.sort((x,y)=>d*sdiff(y,x));
      for(const ls of locs){if(act.some(a=>{const g=d*sdiff(a.s,ls);return g>-60&&g<3000;}))continue; /* この各停にはもう快速が付いている */
        const p2=ls-d*rand(1700,2500),relp=d*sdiff(G.s,p2);if(relp<-3100||relp>4100||!hasTrack(p2)||!hasTrack(p2-d*150)||!clearAt2(p2))continue;
        free.key=k;aiSpawn(free,p2);break;}
      continue;}
    else{const up=rels.length?Math.min(...rels):Infinity;
      const same=!PAX&&d===G.dir;let pos=G.s-d*2600,quick=false;
      if(same&&B3&&KIND[k]!==KIND[G.key]){ /* 天宮支線：追い抜きは待避駅だけ */
        if(KIND[k]==='rapid'){}
        else{let P=null,dP=1e9;for(const st of STATIONS){if(!isPassSt(st))continue;const D=G.dir*sdiff(G.s,st.s);if(D>700&&D<3800&&D<dP){dP=D;P=st;}}
          if(P&&!act.some(a=>a.stSt===P&&a.state==='dwell')&&!act.some(a=>{const g=G.dir*sdiff(G.s,a.s);return g>0&&g<dP+50;})){free.key=k;aiSpawn(free,P.s+TK[k].so,0); /* 次の待避駅の副本線で待っている各停 */
            free.state='dwell';free.v=0;free.t=24;free.stSt=P;free.last=P.i;free.side=TK[k].side(P);free.flowed=false;free.sndF={};free.hold=0;POOLT[k]=hdwSec(k)*0.8;}
          continue;}}
      else if(same){ // 同じ方向の電車：速い種別は後ろから追い抜き、遅い種別は前に置いて追い抜く
        const ahead=rels.filter(r=>r>0),behind=rels.filter(r=>r<0).map(r=>-r);
        const na=ahead.length?Math.min(...ahead):Infinity,nb=behind.length?Math.min(...behind):Infinity;
        const rank=x=>x==='ltd'?2:x==='exp'?1.5:x==='rapid'?1:0,mine=rank(KIND[G.key]||'local'),other=rank(KIND[k]);
        if(other>mine){if(nb>750){pos=G.s-d*rand(480,900);quick=true;}else if(na>2000){pos=G.s+d*rand(1200,1700);quick=true;}}
        else if(other<mine){if(na>700){pos=G.s+d*rand(560,1100);quick=true;}else if(nb>1800){pos=G.s-d*rand(900,1400);quick=true;}}
        else{if(nb>1500&&na>1500){pos=G.s-d*rand(900,1400);quick=true;}else if(na>2200){pos=G.s+d*rand(1300,1800);quick=true;}}}
      const sparse=!quick&&sp>2600;if(sparse&&POOLT[k]>0)continue;
      const relNew=d*sdiff(G.s,pos);
      if((quick||up===Infinity||up>-2600+sp)&&Math.abs(relNew)<3000&&clearAt2(pos)&&hasTrack(pos)&&hasTrack(pos-d*150)){free.key=k;aiSpawn(free,pos);if(sparse)POOLT[k]=hdwSec(k)*rand(0.85,1.15);}}}
}
/* waiting (待ち合わせ): the partner service arrives on the other face of the island and leaves first */
const FT=mkAI('FT',followT,{follower:true});
function ftSpawn(){const w=G.waiting;if(!w)return;const st=w.st,k=w.other;FT.key=k;FT.dir=TK[k].dir;FT.vmax=BRANCH?22:VMAX[k];followT.flip=FT.dir<0;followT.lastFrac=-1;setLook(followT,k);
  aiSpawn(FT,st.s+TK[k].so-FT.dir*950,18);FT.last=-1;FT.passed=false;w.n++;}
function startWaiting(){if(B3){toast('天宮高架線は各駅停車のみの運転です（待避・待ち合わせはありません）','info');return;}const st=stOf(G.atStation!==null?G.atStation:G.depCheck);const other=partnerAt(st,G.key);if(!other||!serves(st,other)){toast('この駅では待ち合わせできません','warn');return;}
  G.waiting={st,n:0,mine:G.key,other};aiHide(FT,4);document.getElementById('waitEnd').classList.remove('hide');
  toast('待ち合わせ中：後続の'+SVCLOOK[other][1]+'が向かいのホームに来て先に発車します','info','待ち合わせを、行います。');}
function endWaiting(){if(!G.waiting)return;G.waiting=null;document.getElementById('waitEnd').classList.add('hide');toast('待ち合わせ終了　扉を閉めてATOで発車できます','ok','待ち合わせ、終了。');}
function autoWaitCheck(){return; /* v2.4.0：天宮高架線の快速を廃止したため、快速待避は行わない */
  if(!B3||PAX||G.phase!=='play')return;if(G.v>3)G.autoWaitSt=null;
  if(G.atStation===null||KIND[G.key]==='rapid'||G.waiting)return;const st=stOf(G.atStation);if(!isPassSt(st)||G.autoWaitSt===st.i)return;
  G.autoWaitSt=st.i;G.waiting={st,n:0,mine:G.key,other:G.key==='A'?'C':'D',auto:true};aiHide(FT,rand(3,7));document.getElementById('waitEnd').classList.remove('hide');
  toast('待避：後続の快速が'+(st.cls==='T'?'通過':'到着して先に発車')+'するまで待ちます','info');}
function updFT(dt){autoWaitCheck();try{updCrew(dt);}catch(e){console.error(e);}
  if(FT.state==='off'){if(!G.waiting)return;FT.timer-=dt;if(FT.timer<=0)ftSpawn();return;}
  if(G.waiting&&FT.key===G.key){aiHide(FT,2);return;}
  aiRun(FT,dt);const rel=G.dir*sdiff(G.s,FT.s);if(rel>0&&!FT.passed){FT.passed=true;if(G.waiting&&!G.waiting.auto)toast('後続の電車が先に発車しました（'+G.waiting.n+'本目）','info');}
  if(G.waiting&&G.waiting.auto&&FT.state==='run'&&rel>40){endWaiting();} /* 快速が行ったら待避終了 */
  if(rel>1000||rel<-2500)aiHide(FT,G.waiting?rand(12,30):0);
}
/* shinkansen above the main station */
const SH={t:0,trains:shinTrains.map((tr,i)=>({tr,dir:i?-1:1,u:0,v:0,state:'wait',t:rand(5,40)}))};
function updShin(dt){const sh=SHIN.find(x=>Math.abs(sdiff(G.s,x.st.s))<3200);for(const T of SH.trains){if(!sh){T.tr.grp.visible=false;continue;}
  const half=sh.len/2-60;
  if(T.state==='wait'){T.t-=dt;T.tr.grp.visible=false;if(T.t<=0){T.state='run';T.u=-T.dir*half;T.v=60;}continue;}
  if(T.state==='run'){const D=T.dir*(0-T.u);let vt=78;if(D>0)vt=Math.min(78,Math.sqrt(2*0.8*D)+0.3);if(!T.stopped&&D>0&&D<0.3&&T.v<0.8){T.state='dwell';T.t=40;T.v=0;T.stopped=true;}
    else{T.v+=clamp((vt-T.v)*1.5,-1.2,1.0)*dt;T.u+=T.dir*T.v*dt;}
    if(T.dir*T.u>half){T.state='wait';T.t=rand(60,200)/Math.max(0.2,freqF(hourNow()));T.stopped=false;}}
  else if(T.state==='dwell'){T.t-=dt;if(T.t<=0){T.state='run';}}
  const F=sh.F,lat=new THREE.Vector3(-F.dir.z,0,F.dir.x),x=T.dir>0?-2.6:2.6;let u=T.u;
  T.tr.grp.visible=true;for(let k=0;k<T.tr.cars.length;k++){const c=T.tr.cars[k];const cu=u-T.dir*(c.len/2);
    c.g.position.copy(F.cen).addScaledVector(F.dir,cu).addScaledVector(lat,x);c.g.position.y=sh.H+0.35;c.g.rotation.y=Math.atan2(-F.dir.x,-F.dir.z)+(T.dir>0?Math.PI:0);u-=T.dir*(c.len+0.8);}}}
function updSignals(){for(const k in OCC)OCC[k].clear();
  if(!PAX)markTrain(G.key,G.s,G.dir);for(const a of OT)if(a.key&&OCC[sigKey(a.key)]&&a.state!=='off')markTrain(a.key,a.s,a.dir);
  if(IS_ONLINE&&window.ONLINE_PLAYERS){
    const curLine=(typeof CFG!=='undefined'&&CFG)?CFG.id:'loop';
    for(const pid in ONLINE_PLAYERS){const op=ONLINE_PLAYERS[pid];if(!op||op.isPax||op.state!=='driving'||op.s==null||!op.key||(op.line||'loop')!==curLine)continue;if(OCC[sigKey(op.key)])markTrain(op.key,op.s,op.dir||1);}
  }
  const ps=G.s,dc=PAX?'l':trCls(G.key);for(const sg of SIGNALS){if(Math.abs(sdiff(ps,sg.x))<1700)setAspect(sg,aspectOf(sg,dc));}}
function updCrossings(dt){
  const trains=PAX?[]:[{s:G.s,dir:G.dir,len:carsFor(G.key)*CARL}];for(const a of OT)if(a.vis&&a.state!=='off'&&a.dir&&a.key)trains.push({s:a.s,dir:a.dir,len:(a.tr?a.tr.cars.length:carsFor(a.key))*CARL});
  for(const cr of CROSS){const near=Math.abs(sdiff(G.s,cr.s))<2000;if(!near&&!cr.act)continue;
    let on=false;for(const t of trains){const rel=t.dir*sdiff(t.s,cr.s);if(rel>-(t.len||NCAR*CARL)-8&&rel<380)on=true;}
    cr.act=on;cr.arm=clamp(cr.arm+(on?dt/4:-dt/5),0,1);cr.t+=dt;if(!cr.arms)continue;
    for(const a of cr.arms)a.rotation.x=Math.PI/2*(1-cr.arm);
    const ph=Math.floor(cr.t*2.4)%2;cr.lamps.forEach((l,i)=>{l.material=bellMat[on&&(i%2===ph)?1:0];});
    cr.cars.forEach(c=>c.visible=on||cr.arm>0.05);}
}
// city line trains near a big station
const CT=cityTrains.map((tr,j)=>({name:'CT'+j,tr,j,s:0,v:0,dir:j%2===0?1:-1,state:'off',t:0,vis:false,off:null,city:-1}));OT.push(...CT);
let activeCity=-1;
function updCity(dt){
  let ci=-1;for(const i of BIG){if(Math.abs(sdiff(G.s,STATIONS[i].s))<1700)ci=i;}
  if(ci!==activeCity){activeCity=ci;for(const c of CT){c.state='off';c.vis=false;c.city=ci;
    if(ci>=0){const cp=CITYPAIRS.filter(p=>p.ci===ci)[c.j];if(!cp){c.state='off';c.vis=false;c.tr.grp.visible=false;continue;}c.cp=cp;c.off=c.dir>0?cp.t1:cp.t2;c.tr.mats.liv1.color.setHex(cp.line[2]);c.tr.mats.liv2.color.setHex(cp.line[2]).lerp(new THREE.Color(0xffffff),0.45);drawDest(c.tr.dk,cp.line[0]);
      const wantCars=(cp.line[0]==='港見支線')?3:6;c.tr.cars.forEach((car,ii)=>{car.visible=ii<wantCars;}); /* 接続路線の両数を合わせる */
      c.state='wait';c.t=rand(0,25);}}}
  for(const c of CT){
    if(ci<0){c.vis=false;c.tr.grp.visible=false;continue;}
    const st=STATIONS[ci],a=st.s-62-590,b=st.s-62+530,start=c.dir>0?a:b,stop=c.dir>0?st.s:st.s-123.2;
    if(c.state==='wait'){c.t-=dt;c.vis=false;if(c.t<=0){c.state='run';c.s=start;c.v=15;c.stopped=false;}}
    else if(c.state==='run'){const D=c.dir>0?sdiff(c.s,stop):sdiff(stop,c.s);let vt=16;if(!c.stopped&&D>0)vt=Math.min(16,Math.sqrt(2*0.6*D)+0.05);
      if(!c.stopped&&D<0.2&&c.v<0.6){c.state='dwell';c.t=22;c.v=0;c.stopped=true;}
      else{c.v+=clamp((vt-c.v)*2,-1,0.7)*dt;c.v=Math.max(0,c.v);c.s+=c.dir*c.v*dt;}
      const pr=c.dir>0?sdiff(b-130,c.s):sdiff(c.s,a+130);if(pr>0){c.state='wait';c.t=rand(15,50)/Math.max(0.1,freqF(hourNow()));}c.vis=c.state!=='wait';}
    else if(c.state==='dwell'){c.t-=dt;if(c.t<=0)c.state='run';c.vis=true;}
    c.tr.grp.visible=c.vis;if(c.vis)placeTrain(c.tr,c.s,c.off);}
}
/* ================= audio ================= */
let rumbleBuf=null,AC=null,motor,motorFilt,motorGain,rumbleGain,master,clackBuf;
/* 路線案内音声 */
const GUIDE_URI = {
  lo: "assets/audio/ann/guide_lo.mp3",
  li: "assets/audio/ann/guide_li.mp3",
  ro: "assets/audio/ann/guide_ro.mp3",
  ri: "assets/audio/ann/guide_ri.mp3",
  eo: "assets/audio/ann/guide_eo.mp3",
  ei: "assets/audio/ann/guide_ei.mp3",
  bu: "assets/audio/ann/guide_bu.mp3",
  bd: "assets/audio/ann/guide_bd.mp3",
  b2u: "assets/audio/ann/guide_b2u.mp3",
  b2d: "assets/audio/ann/guide_b2d.mp3",
  b3u: "assets/audio/ann/guide_b3u.mp3",
  b3d: "assets/audio/ann/guide_b3d.mp3",
  b3ru: "assets/audio/ann/guide_b3ru.mp3",
  b3rd: "assets/audio/ann/guide_b3rd.mp3",
  b4u: "assets/audio/ann/guide_b4u.mp3",
  b4d: "assets/audio/ann/guide_b4d.mp3",
  c5u: "assets/audio/ann/guide_c5u.mp3",
  c5d: "assets/audio/ann/guide_c5d.mp3",
  xo: "assets/audio/ann/guide_xo.mp3",
  xi: "assets/audio/ann/guide_xi.mp3",
  wx_clear: "assets/audio/ann/wx_clear.mp3",
  wx_cloudy: "assets/audio/ann/wx_cloudy.mp3",
  wx_rain: "assets/audio/ann/wx_rain.mp3",
  wx_snow: "assets/audio/ann/wx_snow.mp3",
  wx_fog: "assets/audio/ann/wx_fog.mp3",
  depot_out: "assets/audio/ann/depot_out.mp3",
  depot_join: "assets/audio/ann/depot_join.mp3",
  dia_extra: "assets/audio/ann/dia_extra.mp3",
  dia_charter: "assets/audio/ann/dia_charter.mp3",
  dia_change: "assets/audio/ann/dia_change.mp3",
  manner_quiet: "assets/audio/ann/manner_quiet.mp3",
  manner_priority: "assets/audio/ann/manner_priority.mp3",
  manner_hold: "assets/audio/ann/manner_hold.mp3",
  info_transfer: "assets/audio/ann/info_transfer.mp3",
  tab_delay: "assets/audio/ann/guide_tab_delay.mp3",
  tab_wait: "assets/audio/ann/guide_tab_wait.mp3",
  tab_depart: "assets/audio/ann/guide_tab_depart.mp3",
  tab_doors: "assets/audio/ann/guide_tab_doors.mp3",
  tab_manners: "assets/audio/ann/guide_tab_manners.mp3"
};
let guideAudio=null,guideTimer=0;
/* v1.9.8：戸締め放送（「ドアが閉まります」）の再生終了時刻。放送が終わったらすぐ戸閉する／液晶を赤点滅させるのに使う */
let doorAnnUntil=0,doorWarnT=0;
function doorAnnBusy(){return nowMs()<doorAnnUntil;}
function doorWarnOn(){
  if(typeof G==='undefined'||!G||G.phase!=='play')return false;
  if(typeof RIDE!=='undefined'&&RIDE&&RIDE.a){const a=RIDE.a;
    if(a.state==='dwell'&&a.stSt)return (a.t>1.0&&a.t<7.4);          /* 他車：戸締め放送〜閉扉まで */
    return false;}
  if(G.door&&G.door.state==='closing')return true;
  return nowMs()<doorAnnUntil;
}
const guideEls={};let guideReady=false;
function preloadGuides(){if(guideReady)return;guideReady=true;
  for(const k of Object.keys(GUIDE_URI)){try{const a=new Audio();a.preload='auto';a.src=GUIDE_URI[k];a.volume=1;a.load();guideEls[k]=a;}catch(e){}}}
const guideBufCache={};
function playGuide(kind,dest,gainVal){const src=GUIDE_URI[kind];if(!src)return;
  /* v1.9.8：戸締め放送は「呼んだ時点」で終了予定時刻を確保する（音声の読み込みに時間がかかっても、その間に戸閉してしまわない） */
  if(kind==='tab_doors'){doorWarnT=nowMs();if(nowMs()>=doorAnnUntil)doorAnnUntil=nowMs()+3400;}
  try{initAudio();
    if(AC){
      if(AC.state==='suspended'){try{AC.resume();}catch(e){}}
      const playBuf=(buf)=>{
        const s=AC.createBufferSource(),g=AC.createGain();
        g.gain.value=(gainVal!=null?gainVal:0.95);
        s.buffer=buf;s.connect(g);
        if(dest){g.connect(dest);}else{g.connect(AC.destination);}
        s.start(0);
        if(kind==='tab_doors'){doorAnnUntil=Math.max(doorAnnUntil,nowMs()+(buf.duration||3)*1000+220);doorWarnT=nowMs();}
      };
      if(guideBufCache[kind]){playBuf(guideBufCache[kind]);return;}
      fetch(src).then(r=>r.arrayBuffer()).then(b=>AC.decodeAudioData(b)).then(buf=>{
        guideBufCache[kind]=buf;playBuf(buf);
      }).catch(()=>{
        try{const a=new Audio(src);a.volume=1;a.play().catch(()=>{});
          if(kind==='tab_doors'){doorAnnUntil=Math.max(doorAnnUntil,nowMs()+((a.duration&&isFinite(a.duration))?a.duration*1000:3200)+220);doorWarnT=nowMs();}
        }catch(e2){}
      });
      return;
    }
    preloadGuides();
    let a=guideEls[kind];if(!a){a=new Audio(src);a.volume=1;guideEls[kind]=a;}
    a.volume=1;a.muted=false;try{a.currentTime=0;}catch(e){}
    a.play().catch(()=>{});
    if(kind==='tab_doors'){doorAnnUntil=Math.max(doorAnnUntil,nowMs()+((a.duration&&isFinite(a.duration)&&a.duration>0)?a.duration*1000:3200)+220);doorWarnT=nowMs();}
  }catch(e){console.warn(e);}}
function scheduleGuide(kind,delayMs){if(!kind)return;preloadGuides();clearTimeout(guideTimer);
  guideTimer=setTimeout(function(){playGuide(kind);},Math.max(300,delayMs|0));}
/* 放送（speech）が終わってから再生 */
function scheduleGuideAfterSpeech(kind,ok){if(!kind)return;preloadGuides();
  clearTimeout(guideTimer);
  const ss=SS&&SS();let tries=0;
  const wait=()=>{
    tries++;
    const annPlaying=!!annWebSrc||!!(annAudio&&!annAudio.paused&&!annAudio.ended);
    if(((ss&&ss.speaking)||annPlaying)&&tries<80){guideTimer=setTimeout(wait,250);return;}
    /* 放送終了（またはタイムアウト）後に少し間を置いて再生 */
    guideTimer=setTimeout(function(){if(ok&&!ok())return;playGuide(kind);},600);
  };
  guideTimer=setTimeout(wait,1800);}
function guideKindFor(key, leftSt) {
  if (!leftSt) return null;
  if (BRANCH && typeof LINE_ID !== 'undefined') {
    const isStart = (leftSt.i === 0) || (typeof NST !== 'undefined' && leftSt.i === NST - 1) || leftSt.big;
    if (!isStart) return null;
    const dir = (typeof G !== 'undefined' && G.dir) ? G.dir : 1;
    if (LINE_ID === 'branch') return dir > 0 ? 'bu' : 'bd';
    if (LINE_ID === 'branch2') return dir > 0 ? 'b2u' : 'b2d';
    if (LINE_ID === 'branch3') {
      const isRapid = (key === 'C' || key === 'D' || (typeof G !== 'undefined' && G.rapid));
      if (isRapid) return dir > 0 ? 'b3ru' : 'b3rd';
      return dir > 0 ? 'b3u' : 'b3d';
    }
    if (LINE_ID === 'branch4') return dir > 0 ? 'b4u' : 'b4d';
    if (LINE_ID === 'branch5') return dir > 0 ? 'c5u' : 'c5d';
    return null;
  }
  if (!BRANCH) {
    if (!leftSt.big && leftSt.i !== 0) return null;
    if (key === 'A') return 'lo';
    if (key === 'B') return 'li';
    if (key === 'C') return 'ro';
    if (key === 'D') return 'ri';
    if (key === 'E') return 'eo';
    if (key === 'F') return 'ei';
    if (key === 'G') return 'xo';
    if (key === 'H') return 'xi';
    return 'lo';
  }
  return null;
}
window.__playGuide=playGuide;window.__preloadGuides=preloadGuides;

/* 放送（読み上げ）中も周りの音が小さくならないように：iOSは読み上げ中に他の音を自動で下げるため、その間だけ全体を持ち上げる */
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const SPEECH_BOOST=3.2;let spBoost=null,spOn=false;
function updSpeechBoost(){if(!spBoost)return;let on=false;try{const ss=SS();on=!!(ss&&ss.speaking&&!ss.paused);}catch(e){}
  if(on===spOn)return;spOn=on;spBoost.gain.setTargetAtTime(on?SPEECH_BOOST:1,AC.currentTime,on?0.08:0.3);}
function initAudio(){
  if(AC){if(AC.state==='suspended'||AC.state==='interrupted')try{AC.resume();}catch(e){}return;}
  try{AC=window.__AC||new (window.AudioContext||window.webkitAudioContext)();window.__AC=AC;if(AC.state==='suspended'||AC.state==='interrupted')try{AC.resume();}catch(e){}
    master=AC.createGain();master.gain.value=9.5;try{const cp=AC.createDynamicsCompressor();cp.threshold.value=-6;cp.knee.value=12;cp.ratio.value=2.2;cp.attack.value=0.003;cp.release.value=0.25;master.connect(cp);
      if(IS_IOS){ /* iPad/iPhone：読み上げ中にOSが他の音を下げる分を打ち消す段＋クリップ防止リミッター */
        spBoost=AC.createGain();spBoost.gain.value=1;const lim=AC.createDynamicsCompressor();lim.threshold.value=-1.5;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=0.001;lim.release.value=0.12;
        cp.connect(spBoost);spBoost.connect(lim);lim.connect(AC.destination);}
      else cp.connect(AC.destination);}catch(e){master.connect(AC.destination);}
    motor=AC.createOscillator();motor.type='sawtooth';motorFilt=AC.createBiquadFilter();motorFilt.type='bandpass';motorFilt.Q.value=5;
    motorGain=AC.createGain();motorGain.gain.value=0;motor.connect(motorFilt);motorFilt.connect(motorGain);motorGain.connect(master);motor.start();
    const nb=rumbleBuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    const rs=AC.createBufferSource();rs.buffer=nb;rs.loop=true;const rf=AC.createBiquadFilter();rf.type='lowpass';rf.frequency.value=260;
    rumbleGain=AC.createGain();rumbleGain.gain.value=0;rs.connect(rf);rf.connect(rumbleGain);rumbleGain.connect(master);rs.start();
    clackBuf=AC.createBuffer(1,AC.sampleRate*0.12|0,AC.sampleRate);const c=clackBuf.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=(Math.random()*2-1)*Math.pow(1-i/c.length,4);
    window.__AUDIO_CLEANUP=()=>{
      try{if(SR){['roll','roar','car','mot','sq','gw','gw2','hum'].forEach(k=>{if(SR[k]&&SR[k].stop)try{SR[k].stop();}catch(e){}});Object.values(SR).forEach(n=>{if(n&&n.disconnect)try{n.disconnect();}catch(e){}});}}catch(e){}
      try{if(motor){motor.stop();motor.disconnect();}}catch(e){}
      try{if(rs){rs.stop();rs.disconnect();}}catch(e){}
      try{if(master)master.disconnect();}catch(e){}
      try{if(typeof OT!=='undefined'&&OT)for(const o of OT)if(o)o.snd=null;}catch(e){}
      try{if(window.ONLINE_PLAYERS)for(const pid in window.ONLINE_PLAYERS){const op=window.ONLINE_PLAYERS[pid];if(op)op.snd=null;}}catch(e){}
      otBuf=null;rumbleBuf=null;clackBuf=null;
      SR=null;extBus=null;extLP=null;reverbIn=null;AC=null;
    };
  initOTAudio();}catch(e){AC=null;}
}
/* rail joint (classic two-click pattern) */
function clack(delay){if(!AC)return;const src=AC.createBufferSource();src.buffer=clackBuf;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=900;
  const g=AC.createGain();g.gain.value=Math.min(4.5,1.4+G.v*0.12);src.connect(f);f.connect(g);g.connect(master);src.start(AC.currentTime+delay);}
function jointPass(v){if(v>1.5){clack(0);clack(2.2/v);}}
/* layered running sound for our train */
let SR=null;
function soundRig(){if(SR||!AC)return SR;const mk=(type,f)=>{const n=AC.createBiquadFilter();n.type=type;n.frequency.value=f;return n;};
  const nb=AC.createBuffer(1,AC.sampleRate*4,AC.sampleRate),d=nb.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){l=(l+0.03*(Math.random()*2-1))/1.03;d[i]=l*3.2+(Math.random()*2-1)*0.08;}
  const loop=()=>{const s2=AC.createBufferSource();s2.buffer=nb;s2.loop=true;s2.start();return s2;};
  const roll=loop(),rl=mk('lowpass',300),rg=AC.createGain();rg.gain.value=0;roll.connect(rl);rl.connect(rg);rg.connect(master);
  const roar=loop(),rb=mk('bandpass',900),rbg=AC.createGain();rb.Q.value=0.7;rbg.gain.value=0;roar.connect(rb);rb.connect(rbg);rbg.connect(master);
  const hol=mk('peaking',140);hol.gain.value=0;hol.Q.value=1.4;rl.disconnect();rl.connect(hol);hol.connect(rg);
  const car=AC.createOscillator();car.type='square';const cf=mk('bandpass',1000);cf.Q.value=8;const cg=AC.createGain();cg.gain.value=0;car.connect(cf);cf.connect(cg);cg.connect(master);car.start();
  const mot=AC.createOscillator();mot.type='sawtooth';const mf=mk('lowpass',600);const mg=AC.createGain();mg.gain.value=0;mot.connect(mf);mf.connect(mg);mg.connect(master);mot.start();
  const sq=AC.createOscillator();sq.type='sine';const sg=AC.createGain();sg.gain.value=0;sq.connect(sg);sg.connect(master);sq.start();
  /* 古いモーター用：歯車のうなり（2つの倍音）と、低いうなり */
  const gw=AC.createOscillator();gw.type='triangle';const gwf=mk('bandpass',600);gwf.Q.value=3;const gwg=AC.createGain();gwg.gain.value=0;gw.connect(gwf);gwf.connect(gwg);gwg.connect(master);gw.start();
  const gw2=AC.createOscillator();gw2.type='sine';const gw2g=AC.createGain();gw2g.gain.value=0;gw2.connect(gw2g);gw2g.connect(master);gw2.start();
  const hum=AC.createOscillator();hum.type='square';const humf=mk('lowpass',220);const humg=AC.createGain();humg.gain.value=0;hum.connect(humf);humf.connect(humg);humg.connect(master);hum.start();
  SR={rg,rl,rbg,rb,hol,car,cf,cg,mot,mf,mg,sq,sg,gw,gwf,gwg,gw2,gw2g,hum,humf,humg};return SR;}
function airHiss(vol,dur){if(!AC)return;try{const src=AC.createBufferSource();if(rumbleBuf)src.buffer=rumbleBuf;const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=1800;const g=AC.createGain();const t=AC.currentTime;
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(Math.max(vol*9,0.8),t+0.05);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);src.connect(hp);hp.connect(g);g.connect(master);src.start(t);src.stop(t+dur+0.1);}catch(e){}}
function tone(freq,start,dur,type,vol,dest){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.value=freq;
  const t=AC.currentTime+start;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime((vol||0.15)*7.5,t+0.02);g.gain.linearRampToValueAtTime(0,t+dur);
  o.connect(g);g.connect(dest||master);o.start(t);o.stop(t+dur+0.05);}
let _activeHorn=null;
function startHoldHorn(kind){
  initAudio();
  kind=kind||'elec';
  if(_activeHorn){if(_activeHorn.kind===kind)return;stopHoldHorn(true);}
  G.hornT=nowMs();G.hornKind=kind;
  if(typeof broadcastEvent==='function')broadcastEvent('horn',{hornKind:kind});
  if(!AC){_activeHorn={kind,nodes:[],started:nowMs()};return;}
  const t0=AC.currentTime,bus=AC.createGain();
  bus.gain.setValueAtTime(0.001,t0);
  bus.gain.linearRampToValueAtTime(1.0,t0+0.035);
  bus.connect(master);
  const rv=AC.createGain();rv.gain.value=0.35;bus.connect(rv);rv.connect(getReverb());
  const oscs=[];
  const addTone=(freq,type,vol,det)=>{
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type;o.frequency.value=freq;if(det)o.detune.value=det;
    g.gain.value=vol*7.5;
    o.connect(g);g.connect(bus);o.start(t0);oscs.push(o);
  };
  if(kind==='elec'||kind==='both'){
    addTone(349,'square',0.20,0);
    addTone(440,'square',0.20,0);
    addTone(349,'sawtooth',0.11,4);
    addTone(440,'sawtooth',0.11,-4);
  }
  if(kind==='air'||kind==='both'){
    const sc=kind==='both'?0.75:1.0;
    addTone(233.08,'sawtooth',0.22*sc,0);
    addTone(293.66,'sawtooth',0.22*sc,3);
    addTone(349.23,'sawtooth',0.16*sc,-3);
    addTone(116.54,'triangle',0.14*sc,0);
  }
  const timer=setTimeout(()=>stopHoldHorn(),12000);
  _activeHorn={kind,bus,oscs,started:nowMs(),t0,timer};
}
function stopHoldHorn(immediate){
  if(!_activeHorn)return;
  const h=_activeHorn;_activeHorn=null;
  if(h.timer)clearTimeout(h.timer);
  if(!AC||!h.bus)return;
  const elapsed=(nowMs()-h.started)/1000;
  const minHold=immediate?0:Math.max(0,0.28-elapsed);
  const tEnd=Math.max(AC.currentTime+minHold, (h.t0||AC.currentTime)+0.04);
  try{
    if(typeof h.bus.gain.cancelScheduledValues==='function')h.bus.gain.cancelScheduledValues(tEnd);
    h.bus.gain.setValueAtTime(1.0,tEnd);
    h.bus.gain.exponentialRampToValueAtTime(0.0001,tEnd+0.14);
    setTimeout(()=>{for(const o of h.oscs){try{o.stop();o.disconnect();}catch(_){}}try{h.bus.disconnect();}catch(_){}},Math.max(200,(tEnd-AC.currentTime+0.25)*1000));
  }catch(_){}
}
function horn(kind){
  startHoldHorn(kind||'elec');
  setTimeout(()=>stopHoldHorn(),520);
}
function chimeLtdLong(dest){
  if(!AC)return 0;
  initAudio();
  const out=dest||AC.destination;
  if(master&&AC)try{master.gain.setTargetAtTime(4.5,AC.currentTime,0.08);}catch(_){}
  const seq=[
    [74,0.05,0.45],[78,0.45,0.45],[81,0.85,0.45],[86,1.25,0.95],
    [85,2.25,0.45],[81,2.65,0.45],[78,3.05,0.45],[74,3.45,0.95],
    [76,4.55,0.45],[79,4.95,0.45],[83,5.35,0.45],[88,5.75,0.95],
    [86,6.85,0.45],[83,7.25,0.45],[81,7.65,0.45],[86,8.05,1.75]
  ];
  seq.forEach(([m,t0,dur])=>{
    const t=AC.currentTime+t0;
    mbell(m,t,dur*0.9,out);
    mnote(m,t,dur,'triangle',0.22,out,true);
  });
  return 9800;
}
function chime(dest, type){
  if (!AC) return;
  initAudio();
  const out = dest || master;
  const isLtd = type === 'ltd' || (type !== 'branch2pt' && typeof G !== 'undefined' && G && G.key && KIND[G.key] === 'ltd');

  if (type === 'branch2pt') {
    // 支線用2点チャイム（澄んだピン・ポーン）
    [86, 81].forEach((m, i) => {
      const t = AC.currentTime + 0.02 + i * 0.22;
      mbell(m, t, 0.55, out);
      mnote(m, t, 0.75, 'sine', 0.30, out, true);
    });
  } else if (isLtd) {
    // 汐見線オリジナル特急4点チャイム（完全オリジナル）
    // D5 (587Hz) -> A5 (880Hz) -> D6 (1175Hz) -> F#6 (1480Hz)
    [74, 81, 86, 90].forEach((m, i) => {
      const t = AC.currentTime + 0.03 + i * 0.26;
      mbell(m, t, 0.5, out);
      mnote(m, t, 0.85, 'triangle', 0.26, out, true);
    });
  } else {
    // 汐見線オリジナル車内3点チャイム（完全オリジナル）
    // A5 (880Hz) -> D6 (1175Hz) -> F#6 (1480Hz)
    [81, 86, 90].forEach((m, i) => {
      const t = AC.currentTime + 0.02 + i * 0.18;
      mbell(m, t, 0.55, out);
      mnote(m, t, 0.7, 'sine', 0.3, out, true);
    });
  }
}
function b2BellNote(f,dt,dur,vol,dest,triMix){
  if(!AC)return;
  const out=dest||master,t=AC.currentTime+0.02+dt,V=vol||0.3;
  const parts=triMix?[[1.0,0.65,'triangle'],[1.0,0.35,'sine']]:[[1.0,0.70,'sine'],[2.0,0.22,'sine'],[3.0,0.08,'sine']];
  for(const [mul,w,tp] of parts){
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=tp;o.frequency.value=f*mul;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,V*w),t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(out);
    o.start(t);o.stop(t+dur+0.03);
  }
}
function doorOpenSnd(dest){
  if(!dest)airHiss(0.2,0.9);
  if(typeof LINE_ID!=='undefined'&&LINE_ID==='branch2'){
    [84,79,81,76].forEach((m,j)=>{
      const f=mF(m);
      b2BellNote(f,j*0.115,0.20,0.34,dest,false);
      b2BellNote(f,0.56+j*0.115,0.20,0.34,dest,false);
    });
    return;
  }
  tone(1175,0,0.25,'sine',0.32,dest);tone(880,0.25,0.45,'sine',0.32,dest);
}
function doorCloseSnd(dest){
  if(!dest)airHiss(0.2,1.1);
  if(typeof LINE_ID!=='undefined'&&LINE_ID==='branch2'){
    b2BellNote(mF(81),0,0.48,0.38,dest,false);
    b2BellNote(mF(76),0.33,0.75,0.36,dest,false);
    return;
  }
  tone(880,0,0.22,'sine',0.32,dest);tone(880,0.28,0.22,'sine',0.32,dest);tone(660,0.55,0.55,'triangle',0.22,dest);
}
function hdSnd(open,dest){
  if(typeof LINE_ID!=='undefined'&&LINE_ID==='branch2'){
    for(let i=0;i<8;i++){
      tone(2400,i*0.125,0.075,'sine',0.24,dest);
      tone(4800,i*0.125,0.075,'sine',0.08,dest);
    }
  }else{
    [1568,1319,1047].forEach((f,i)=>tone(open?f:[1047,1319,1568][i],i*0.16,0.22,'sine',0.22,dest));
  }
  if(!AC)return;const src=AC.createBufferSource();src.buffer=rumbleBuf;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;const g=AC.createGain();
  const t=AC.currentTime+0.5;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.22,t+0.2);g.gain.linearRampToValueAtTime(0,t+1.4);src.connect(f);f.connect(g);g.connect(dest||master);src.start(t);src.stop(t+1.5);}
function clickSnd(){tone(1800,0,0.04,'square',0.12);}
function bellSnd(dest){tone(760,0,0.22,'square',0.22,dest);tone(1520,0,0.15,'sine',0.16,dest);}
/* 外の音のバス：車内にいてドアが閉まっているときはほとんど聞こえない */
let extBus=null,extLP=null;
function getExtBus(){if(extBus||!AC)return extBus;extLP=AC.createBiquadFilter();extLP.type='lowpass';extLP.frequency.value=18000;extLP.Q.value=0.5;
  extBus=AC.createGain();extBus.gain.value=1;extBus.connect(extLP);extLP.connect(master);return extBus;}
function listenerSealed(){if(RIDE)return !(RIDE.a.state==='dwell'&&RIDE.a.frac>0.05);if(PAX)return false;if(G.walkOn&&G.walkArea!=='train')return false;return G.door.state==='closed';}
function updExtBus(){const b=getExtBus();if(!b)return;const t=AC.currentTime,sl=listenerSealed();
  b.gain.setTargetAtTime(sl?0:1,t,0.12);extLP.frequency.setTargetAtTime(sl?320:18000,t,0.12);}
/* positional one-shot bus */
function playAt(pos,fn){if(!AC||!pos)return;try{const cw=camera.getWorldPosition(new THREE.Vector3());const d=pos.distanceTo(cw);if(!isFinite(d)||d>400)return;
  const dest=getExtBus()||master; /* 車内でドアが閉まっていれば extBus で小さくなる */
  const g=AC.createGain();g.gain.value=Math.min(3.5,5.5/(1+Math.pow(d/70,2)));let out=g;try{const p=AC.createStereoPanner();const cr=new THREE.Vector3(1,0,0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  p.pan.value=clamp(new THREE.Vector3().subVectors(pos,cw).dot(cr)/(d+1),-0.9,0.9);g.connect(p);p.connect(dest);}catch(e){g.connect(dest);}if(typeof fn==='function')try{fn(out);}catch(e){}}catch(e){}}
function updAudio(){
  if(!AC){if(window.__AC)initAudio();else return;}
  if(AC.state==='suspended'||AC.state==='interrupted'){try{AC.resume();}catch(e){}}
  if(G.sound===false){if(motorGain)motorGain.gain.setTargetAtTime(0,AC.currentTime,0.08);if(rumbleGain)rumbleGain.gain.setTargetAtTime(0,AC.currentTime,0.08);if(SR){const t=AC.currentTime;[SR.rg,SR.rbg,SR.cg,SR.mg,SR.sg,SR.gwg,SR.gw2g,SR.humg].forEach(n=>n&&n.gain.setTargetAtTime(0,t,0.08));}return;}
  updExtBus();updSpeechBoost();const R=soundRig();if(!R)return;const t=AC.currentTime,v=PAX?0:G.v,closed=G.door.state==='closed',tun=(!BRANCH&&(G.key==='G'||G.key==='H'))||inTunnel(G.s),via=Yat(G.s)>1.5;motorGain.gain.setTargetAtTime(0,t,0.1);rumbleGain.gain.setTargetAtTime(0,t,0.2);
  const k=Math.min(1,v/25);
  R.rg.gain.setTargetAtTime((0.35+1.4*k)*(v>0.2?1:0)*(tun?1.7:1),t,0.25);R.rl.frequency.setTargetAtTime(160+v*14,t,0.3);R.hol.gain.setTargetAtTime(via?12:0,t,0.5);
  R.rbg.gain.setTargetAtTime(v>3?(OWNOLD?0.6*k:0.35*k*k)*(tun?2:1):0,t,0.3);R.rb.frequency.setTargetAtTime(600+v*30,t,0.3);
  // VVVF inverter: asynchronous carrier at low speed, rising sweep, then fades once synchronous
  const pow=G.phase==='play'&&closed&&G.notch>0,regen=G.notch<0&&v>2&&G.bc<330,drive=pow||regen;
  const cf=v<3?750+Math.sin(t*9)*40:v<16?750+(v-3)*95:1990;R.car.frequency.setTargetAtTime(cf,t,0.08);R.cf.frequency.setTargetAtTime(cf,t,0.08);
  R.cg.gain.setTargetAtTime(drive&&!OWNOLD?(v<16?0.22:Math.max(0,0.22-(v-16)*0.02)):0,t,0.15);
  if(OWNOLD){ /* 古い電車：インバーター音なし。モーターと歯車が大きな音でうなる（惰行中もうるさい） */
    const pw=G.phase==='play'&&closed&&G.notch>0;
    R.mot.frequency.setTargetAtTime(28+v*17,t,0.1);R.mf.frequency.setTargetAtTime(380+v*55,t,0.2);R.mg.gain.setTargetAtTime(v>0.3?(pw?0.55+0.45*k:0.18+0.3*k):(pw?0.25:0),t,0.18);
    R.gw.frequency.setTargetAtTime(20+v*62,t,0.1);R.gwf.frequency.setTargetAtTime(40+v*62,t,0.1);R.gwg.gain.setTargetAtTime(v>0.5?(pw?0.42:0.26)*Math.min(1,v/8):0,t,0.2);
    R.gw2.frequency.setTargetAtTime(40+v*124,t,0.1);R.gw2g.gain.setTargetAtTime(v>0.5?(pw?0.09:0.05)*Math.min(1,v/10):0,t,0.2);
    R.hum.frequency.setTargetAtTime(18+v*8.5,t,0.15);R.humg.gain.setTargetAtTime(v>0.3?(pw?0.5:0.25)*Math.min(1,v/6):0,t,0.2);}
  else{R.gwg.gain.setTargetAtTime(0,t,0.1);R.gw2g.gain.setTargetAtTime(0,t,0.1);R.humg.gain.setTargetAtTime(0,t,0.1);
  R.mot.frequency.setTargetAtTime(40+v*22,t,0.1);R.mf.frequency.setTargetAtTime(300+v*40,t,0.2);R.mg.gain.setTargetAtTime(drive?0.14+0.14*k:v>1?0.04:0,t,0.2);}
  // flange squeal on tight curves, brake squeal right before stopping
  const th2=P(G.s+10)[2]-P(G.s-10)[2],cur=Math.abs(th2)/20,sqF=cur>1/900&&v>3?Math.min(0.12,(cur-1/900)*200):0,brk=v>0.2&&v<3&&G.bc>150?0.08:0;
  R.sq.frequency.setTargetAtTime(brk?2400+Math.sin(t*3)*80:3300+Math.sin(t*7)*300,t,0.05);R.sg.gain.setTargetAtTime(Math.max(sqF,brk),t,0.08);
  if(G.prevV>0.05&&v===0)airHiss(0.25,1.3);
}
/* departure melody (orchestrated, with reverb) */
let reverbIn=null;
function getReverb(){
  if(reverbIn) return reverbIn;
  const len = Math.floor(AC.sampleRate * 2.2);
  const buf = AC.createBuffer(2, len, AC.sampleRate);
  for(let c = 0; c < 2; c++){
    const d = buf.getChannelData(c);
    let lp = 0;
    for(let i = 0; i < len; i++){
      const white = (Math.random() * 2 - 1);
      lp += (white - lp) * 0.22;
      const tSec = i / AC.sampleRate;
      let early = 0;
      if (Math.abs(tSec - 0.016) < 0.001) early += 0.35 * (c ? -1 : 1);
      if (Math.abs(tSec - 0.034) < 0.001) early += 0.25;
      if (Math.abs(tSec - 0.058) < 0.001) early += 0.18 * (c ? 1 : -1);
      if (Math.abs(tSec - 0.082) < 0.001) early += 0.12;
      const decay = Math.exp(-tSec * 2.6);
      d[i] = (lp * 0.7 + early) * decay;
    }
  }
  const cv = AC.createConvolver();
  cv.buffer = buf;
  const g = AC.createGain();
  g.gain.value = 0.85;
  cv.connect(g);
  g.connect(master);
  reverbIn = cv;
  return cv;
}
const mF=m=>440*Math.pow(2,(m-69)/12);
function mnote(m,t,dur,type,vol,dest,rev){
  if (!AC) return;
  const V = vol || 0.15;
  const f0 = mF(m);
  const out = dest || master;
  const flt = AC.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(type === 'sawtooth' ? 1800 : type === 'triangle' ? 2400 : 4200, t);
  flt.frequency.exponentialRampToValueAtTime(1100, t + Math.min(dur, 0.45));
  flt.Q.value = 1.0;
  flt.connect(out);
  if (rev && out === master) flt.connect(getReverb());

  [-3.5, 3.5].forEach(det => {
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type || 'sine';
    o.frequency.value = f0;
    o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(V * 0.55, t + 0.008);
    g.gain.exponentialRampToValueAtTime(V * 0.28, t + Math.min(0.2, dur * 0.5));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(flt);
    o.start(t);
    o.stop(t + dur + 0.06);
  });
}
function mbell(m,t,vol,dest){
  if (!AC) return;
  const V = vol || 0.2;
  const f0 = mF(m);
  const out = dest || master;
  const partials = [
    [1.0, 1.0, 1.0],
    [2.756, 0.42, 0.55],
    [5.404, 0.18, 0.32],
    [8.932, 0.07, 0.15]
  ];
  partials.forEach(([k, a, dec]) => {
    [-2.5, 2.5].forEach(det => {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.frequency.value = f0 * k;
      o.detune.value = det;
      const pDur = Math.max(0.18, 2.2 * dec);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(V * a * 0.5, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + pDur);
      o.connect(g);
      g.connect(out);
      if (out === master) g.connect(getReverb());
      o.start(t);
      o.stop(t + pDur + 0.05);
    });
  });
}
// returns duration; dest lets it be positional; maxDur trims the phrase
// 汐見線オリジナル乗降促進メロディ「汐鳴り（Shionari）」（完全オリジナル）
function melody(dest,vol,maxDur,dir){
  if (!AC) return 0;
  dest = dest || master;
  const V = vol || 1;
  const dVal = (dir != null) ? dir : (typeof G !== 'undefined' && G && G.dir != null ? G.dir : 1);
  const isInner = dVal < 0;
  const t0 = AC.currentTime + 0.08;
  const bpm = 136;
  const e = 60 / bpm / 2;
  const lim = t0 + (maxDur || 99);

  // 全駅共通オリジナル旋律「汐鳴り（Shionari）」（外回り＝清涼ベル＆フルート音色／内回り＝温もりマリンバ＆オルガン音色）
  const lead = [
    [74, 1], [78, 1], [81, 1], [86, 2], [85, 1], [83, 2],
    [79, 1], [83, 1], [86, 2], [83, 2], [81, 2],
    [78, 1], [81, 1], [86, 1], [88, 1], [90, 2], [88, 2],
    [86, 1], [83, 1], [81, 1], [78, 1], [74, 4]
  ];

  let t = t0;
  for (const [m, d] of lead) {
    if (t < lim) {
      if (isInner) {
        mnote(m - 12, t, d * e * 1.4, 'sine', 0.34 * V, dest, true);
        mnote(m, t, d * e * 0.9, 'triangle', 0.22 * V, dest, true);
        if (d >= 2) mbell(m, t, 0.16 * V, dest);
      } else {
        mnote(m, t, d * e * 1.5, 'triangle', 0.36 * V, dest, true);
        mnote(m + 12, t, d * e * 1.2, 'sine', 0.18 * V, dest, true);
        if (d >= 2) mbell(m + 12, t, 0.26 * V, dest);
      }
    }
    t += d * e;
  }
  const total = t - t0;

  const chords = [
    [50, 57, 62, 66], // D
    [43, 50, 55, 59], // G
    [40, 47, 52, 55], // Em
    [45, 52, 55, 61], // A7
    [50, 57, 62, 66]  // D
  ];
  const bar = 8 * e;
  const chordTimes = [0, bar, 2*bar, 2*bar + 4*e, 3*bar];
  chords.forEach((c, i) => {
    const ct = t0 + chordTimes[i];
    if (ct >= lim) return;
    const dur = (i === 2 || i === 3) ? 4 * e : bar;
    c.forEach(m => {
      if (isInner) {
        mnote(m, ct, dur * 1.05, 'sine', 0.14 * V, dest, true);
        mnote(m - 12, ct, dur * 0.95, 'triangle', 0.08 * V, dest, true);
      } else {
        mnote(m, ct, dur * 1.05, 'sawtooth', 0.07 * V, dest, true);
        mnote(m, ct, dur * 0.98, 'triangle', 0.13 * V, dest, true);
      }
    });
    mnote(c[0] - 12, ct, dur * 0.9, isInner ? 'sine' : 'triangle', 0.22 * V, dest, false);
  });

  if (t0 + total < lim + 0.5) {
    [50, 57, 62, 66].forEach(m => mnote(m, t0 + total, 2.5, isInner ? 'sine' : 'triangle', 0.18 * V, dest, true));
    mnote(38, t0 + total, 2.5, isInner ? 'sine' : 'triangle', 0.22 * V, dest, false);
  }
  return Math.min(total, maxDur || 99) + 1.2;
}
// looping melody for the promotion switch (plays until switched off)
let promoBus=null,promoTimer=0;
function promoStart(){if(!AC)return;promoStop(true);promoBus=AC.createGain();promoBus.gain.value=1;promoBus.connect(master);promoBus.connect(getReverb());const loop=()=>{if(!promoBus)return;const d=melody(promoBus,1);promoTimer=setTimeout(loop,(d-0.85)*1000);};loop();}
function promoStop(quiet){clearTimeout(promoTimer);if(promoBus){const b=promoBus;promoBus=null;try{b.gain.setTargetAtTime(0,AC.currentTime,0.08);setTimeout(()=>{try{b.disconnect();}catch(e){}},900);}catch(e){}}}
// data-driven songs: lead [midi, eighths], chords per bar
function playSong(S,dest,vol,maxDur){if(!AC)return 0;dest=dest||master;const V=vol||1,t0=AC.currentTime+0.08,e=60/S.bpm/2,lim=t0+(maxDur||99);let t=t0;
  for(const [m,d] of S.lead){if(t<lim){for(const [tp,dv,v,oct] of S.voices)mnote(m+oct,t,d*e*dv,tp,v*V,dest,true);if(S.bellEvery&&d>=2)mbell(m+24,t,0.035*V,dest);}t+=d*e;}
  const total=t-t0,bar=S.bar*e;
  S.chords.forEach((c,i)=>{const ct=t0+i*bar;if(ct>=Math.min(t0+total,lim))return;c.forEach(m=>mnote(m,ct,bar*1.02,S.pad,0.12*V,dest,true));
    mnote(c[0]-12,ct,bar*0.45,'triangle',0.16*V,dest,false);if(S.bar===6){mnote(c[1],ct+2*e,e*1.6,'sine',0.1*V,dest,true);mnote(c[2],ct+4*e,e*1.6,'sine',0.1*V,dest,true);}
    else mnote(c[0]-12,ct+bar/2,bar*0.45,'triangle',0.14*V,dest,false);});
  if(S.endPhrase||S.endChords||S.endBells){ /* 曲ごとの終わり方（同じ楽器・同じテンポで） */
    let te=t0+total,len=0;if(S.endPhrase)for(const [m,d,vv] of S.endPhrase){if(te<lim)for(const [tp,dv,v,oct] of S.voices)mnote(m+oct,te,d*e*dv,tp,v*V*(vv||1),dest,true);te+=d*e;}
    let tc=t0+total;if(S.endChords)for(const [notes,d] of S.endChords){if(tc<lim){notes.forEach(m=>mnote(m,tc,d*e*1.05,S.pad,0.13*V,dest,true));mnote(notes[0]-12,tc,d*e*0.9,'triangle',0.17*V,dest,false);}tc+=d*e;}
    if(S.endBells)S.endBells.forEach(([m,at],i)=>{if(t0+total+at*e<lim)mbell(m,t0+total+at*e,0.16*V,dest);});
    len=Math.max(te,tc)-(t0+total);return Math.min(total+len,maxDur||99)+0.8;}
  // 最後にチャラりん音（高音ベル上昇アルペジオ）を鳴らさず、そのままの和音の余韻を保って終わる
  if(t0+total<=lim && S.chords && S.chords.length){
    const lastChord = S.chords[S.chords.length - 1];
    lastChord.forEach(m => mnote(m, t0 + total, 2.5, S.pad || 'triangle', 0.16 * V, dest, true));
    mnote(lastChord[0] - 12, t0 + total, 2.5, 'triangle', 0.22 * V, dest, false);
  }
  return Math.min(total,maxDur||99)+1.2;}
// 汐見線オリジナル乗降促進メロディ「潮風（内回り）」（完全オリジナル）
// 外回りの「汐鳴り」と雰囲気を変え、落ち着き・温かみ・安らぎを感じさせるメロウで優しい旋律
const SONG_A = {
  name: '潮風（内回り）',
  bpm: 116,
  bar: 4,
  pad: 'triangle',
  bellEvery: false,
  voices: [['triangle', 1.4, 0.35, 0], ['sine', 1.2, 0.22, 12]],
  lead: [
    [74, 1], [79, 1], [78, 1], [76, 1], [74, 2], [71, 2],
    [72, 1], [74, 1], [76, 1], [79, 2], [78, 1], [76, 1], [74, 1],
    [71, 1], [74, 1], [76, 1], [79, 1], [81, 2], [83, 2],
    [81, 1], [79, 1], [76, 1], [74, 1], [71, 2], [67, 4]
  ],
  chords: [
    [55, 59, 62, 67],
    [52, 55, 59, 64],
    [48, 55, 60, 64],
    [50, 57, 60, 66],
    [55, 59, 62, 67]
  ]
};
// 汐見線 快速特急専用乗降促進メロディ「グラン汐見」（完全オリジナル・豪華フラッグシップ仕様）
// 最速150km/h・12両編成・グリーン車連結のフラッグシップ快特にふさわしい、壮麗な和声と金管風オーバートーンを纏った壮大な旋律
const SONG_B = {
  name: '快特専用「グラン汐見」',
  bpm: 122,
  bar: 4,
  pad: 'triangle',
  bellEvery: false,
  voices: [
    ['triangle', 1.4, 0.38, 0],
    ['sine', 1.2, 0.24, 12],
    ['sawtooth', 0.8, 0.12, -12],
    ['triangle', 1.1, 0.16, 7]
  ],
  lead: [
    [72, 1], [76, 1], [79, 1], [84, 2], [83, 1], [81, 1], [79, 1],
    [81, 1], [84, 1], [88, 2], [86, 1], [84, 1], [83, 2],
    [84, 1], [83, 1], [81, 1], [79, 1], [76, 1], [77, 1], [79, 1], [81, 1],
    [77, 1], [79, 1], [81, 1], [83, 1], [84, 4]
  ],
  chords: [
    [48, 55, 60, 64], // C
    [45, 52, 57, 60], // Am
    [41, 48, 53, 57], // F
    [43, 50, 55, 59], // G
    [48, 55, 60, 64]  // C (Grand resolution)
  ]
};
let promoOnce=null;
/* 支線の駅ごとの発車メロディ（駅ごとに調・音階・テンポ・拍子・音色・和音進行・旋律がすべて違う） */
/* 駅ごとの発車メロディの通し番号。路線ごとに別の番号帯にして、全支線・快速特急停車駅で重複しないようにする */
const SONG_UID_OFFSET={loop:6000,branch:1000,branch2:2000,branch3:3000,branch4:4000,branch5:5000};
function songUid(lineId,stIndex){return (SONG_UID_OFFSET[lineId]||6000)+stIndex;}
const BR_SONG={},BR_NAMES=['若葉','朝霧','せせらぎ','山鳩','白雲','木漏れ日','春風','月影','蛍火','雪解け','渓流','星空','花びら','夕凪','小川','峠道','青嵐','紅葉','稲穂','鈴虫','山桜','風鈴','朝日','水面'];
function branchSong(i){if(BR_SONG[i])return BR_SONG[i];let sd=((i+1)*2654435761)>>>0;const r=()=>{sd=(Math.imul(sd,1664525)+1013904223)>>>0;return sd/4294967296;};
  const SC=[[0,2,4,5,7,9,11],[0,2,4,7,9],[0,2,4,5,7,9,10],[0,2,4,6,7,9,11],[0,2,3,5,7,9,10],[0,2,4,5,7,8,11]];
  const sc=SC[i%SC.length],root=60+((i*7)%12),bpm=104+((i*17)%52),bar=(i%3===2)?6:4,e=60/bpm/2;
  const deg=d=>{const L=sc.length,o=Math.floor(d/L),k=((d%L)+L)%L;return root+12+o*12+sc[k];};
  let tot=Math.round(7.0/e/bar)*bar;if(tot<bar*4)tot=bar*4;
  const CELLS=[[1,1],[2],[1,1],[2,1,1],[3,1],[1,1,2],[2,2]],lead=[];let used=0,d=Math.floor(r()*3);
  while(used<tot-4){const c=CELLS[Math.floor(r()*CELLS.length)];for(const len of c){if(used+len>tot-4)break;
      d+=[-2,-1,-1,0,1,1,2,3,-3][Math.floor(r()*9)];d=Math.max(-2,Math.min(9,d));let dd=d;if(len>=2)dd=Math.round(d/2)*2; // 長い音は和音の音へ
      lead.push([deg(dd),len]);used+=len;}}
  if(used<tot-4)lead.push([deg(d),tot-4-used]);lead.push([deg(r()<0.5?0:7),4]);
  const PROG=[[0,3,4,0],[0,5,3,4],[0,4,5,3],[0,3,0,4],[5,3,0,4],[0,1,4,0],[3,4,0,0],[0,5,1,4]][i%8],nC=Math.ceil(tot/bar);
  const chords=[];for(let q=0;q<nC;q++){const c0=PROG[q%PROG.length];chords.push([deg(c0)-12,deg(c0+2)-12,deg(c0+4)-12]);}
  const VO=[[['triangle',1.3,0.3,0],['sine',1.0,0.14,12]],[['square',1.0,0.16,0],['triangle',1.3,0.26,0]],[['sine',1.5,0.32,0],['triangle',1.2,0.12,-12]],
    [['sawtooth',0.9,0.1,0],['triangle',1.4,0.24,0],['sine',1,0.1,12]],[['triangle',1.1,0.3,0],['square',0.8,0.08,12]],[['sine',1.2,0.3,0],['sine',0.9,0.12,7]]][i%6];
  /* 終わり方：旋律の流れに合わせて曲ごとに違う */
  const ln=lead[lead.length-1][0];let oc=Math.round((ln-deg(0))/12)*12;if(deg(0)+oc>81)oc-=12;if(deg(0)+oc<64)oc+=12;const Dg=q=>deg(q)+oc; /* 最後の音の高さに合わせる（高すぎ・低すぎない） */
  const last=lead.slice(-4,-1).map(x=>x[0]),T=deg(0)+oc,EK=(i*5+3)%6;let endPhrase=null,endChords=null,endBells=null;
  if(EK===0)endPhrase=[[Dg(2),1],[Dg(4),1],[Dg(7),3]];                                                        // 上がっていって主音で止まる
  else if(EK===1){endPhrase=[[Dg(1),2,0.9],[T,4]];endChords=[[[Dg(4)-12,Dg(6)-12,Dg(8)-12],2],[[Dg(0)-12,Dg(2)-12,Dg(4)-12],4]];} // 属和音→主和音
  else if(EK===2)endPhrase=last.map(m=>[m,1,0.45]).concat([[T,4,0.8]]);                                          // 最後の動きをこだまのように繰り返して終わる
  else if(EK===3){endPhrase=[];for(let q=7;q>0;q--)endPhrase.push([Dg(q),0.5,0.75]);endPhrase.push([T,3]);}     // 音階をかけ下りる
  else if(EK===4){endPhrase=[[T,2,0.7]];endBells=[[T+12,0],[Dg(4)+12,1.5],[T+24,3]];}                           // 鐘をゆっくり3つ
  else{endPhrase=[[Dg(1),0.5,0.7],[T,2],[T+12,3,0.6]];endChords=[[[Dg(0)-12,Dg(4)-12,Dg(7)-12],5]];}          // 装飾音から主音を長くのばす
  return BR_SONG[i]={name:BR_NAMES[i%BR_NAMES.length],bpm,bar,pad:['triangle','sawtooth','sine'][(i>>1)%3],bellEvery:i%2===0,voices:VO,lead,chords,
    end:[deg(0)+12,deg(2)+12,deg(4)+12,deg(7)+12],endPhrase,endChords,endBells};}
/* 環状線（快速特急ツーマン）：駅ごとに違う発車メロディ */
function ltdSong(i){const S=branchSong(6000+i);S.name=STATIONS[i]?STATIONS[i].name+'の調べ':S.name;return S;}
/* 支線の駅ごとのメロディ（路線ごとの番号帯＋駅番号で、全支線の全駅が別の曲になる） */
function branchSongFor(st){if(!st)return branchSong(1000);const S=branchSong(songUid(LINE_ID,st.i));S.name=st.name+'の調べ';return S;}
/* 天宮高架線：上下線で同じメロディ・音階（高さ）だけを変えて統一する */
function transposeSong(S,st){const sh=n=>n+st;
  return Object.assign({},S,{lead:S.lead.map(([m,d])=>[sh(m),d]),chords:S.chords.map(c=>c.map(sh)),
    endPhrase:S.endPhrase?S.endPhrase.map(([m,d,...r])=>[sh(m),d,...r]):null,
    endChords:S.endChords?S.endChords.map(([ns,d])=>[ns.map(sh),d]):null,
    endBells:S.endBells?S.endBells.map(([m,a])=>[sh(m),a]):null,
    end:S.end?S.end.map(sh):null});}
const B3_SONG_BASE=branchSong(3900);B3_SONG_BASE.name='天宮高架線 発車メロディ（下り）';
const B3_SONG_UP=transposeSong(B3_SONG_BASE,5);B3_SONG_UP.name='天宮高架線 発車メロディ（上り）';
function b3MelodyFor(dir){return (dir<0)?B3_SONG_UP:B3_SONG_BASE;}
function b2MelodyName(dir){return (dir<0)?'紫雲地下線 発車メロディ（紫雲新都行）':'紫雲地下線 発車メロディ（深雪行）';}
function playB2Melody(dir,dest,vol){
  if(!AC)return 0;
  const out=dest||master,V=(vol==null?1:vol);
  let t=0.02;
  if(dir<0){
    const pat=[[74,0.12],[78,0.12],[81,0.12],[78,0.12],[81,0.12],[86,0.24]];
    for(let rep=0;rep<3;rep++){
      for(const [m,d] of pat){
        b2BellNote(mF(m),t,d+0.18,0.30*V,out,false);
        b2BellNote(mF(m-12),t,d+0.18,0.12*V,out,true);
        t+=d;
      }
    }
    for(const [m,d] of [[78,0.12],[81,0.12],[86,0.12],[90,0.65]]){
      b2BellNote(mF(m),t,d+0.25,0.32*V,out,false);
      b2BellNote(mF(m-12),t,d+0.25,0.14*V,out,true);
      t+=d;
    }
    return t+0.25;
  }else{
    const phrases=[[[86,0.42],[81,0.21],[83,0.48]],[[86,0.42],[81,0.21],[78,0.48]],[[83,0.42],[78,0.21],[81,0.48]],[[86,0.85]]];
    for(const phr of phrases){
      for(const [m,d] of phr){
        b2BellNote(mF(m),t,d+0.22,0.28*V,out,true);
        b2BellNote(mF(m-12),t,d+0.22,0.15*V,out,true);
        t+=d;
      }
    }
    return t+0.25;
  }
}
function promoPlay(fn){if(!AC)return 0;promoCut();const b=AC.createGain();b.gain.value=1;b.connect(master);b.connect(getReverb());promoOnce=b;return fn(b);}
function promoCut(){if(promoOnce){const b=promoOnce;promoOnce=null;try{b.gain.setTargetAtTime(0,AC.currentTime,0.06);setTimeout(()=>{try{b.disconnect();}catch(e){}},800);}catch(e){}}}
// music horn: a short brass fanfare with harmony, like the real thing
function musicHorn(){initAudio();if(typeof G!=='undefined')G.mhornKind=1;if(typeof broadcastEvent==='function')broadcastEvent('mhorn',{mhornKind:1});if(!AC)return;const t0=AC.currentTime+0.03;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(900,t0);f.frequency.linearRampToValueAtTime(2600,t0+0.12);f.Q.value=0.7;
  const bus=AC.createGain();bus.gain.value=1.5;f.connect(bus);bus.connect(master);const rv=AC.createGain();rv.gain.value=0.7;bus.connect(rv);rv.connect(getReverb());
  const seq=[[72,0.22,[0,4,7]],[76,0.22,[0,3,7]],[79,0.3,[0,4,7]],[84,0.72,[0,4,7,12]],[81,0.24,[0,3,7]],[79,0.24,[0,4,7]],[84,1.05,[0,4,7,12]]];
  let t=t0;
  for(const [m,d,ch] of seq){
    for(const iv of ch){const base=mF(m+iv-12),amp=iv===0?0.28:iv===12?0.12:0.16;
      for(const det of [-4,4]){const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.value=base;o.detune.value=det;
        const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=5.2;lg.gain.value=base*0.004;lfo.connect(lg);lg.connect(o.frequency);lfo.start(t);lfo.stop(t+d+0.1);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+0.035);g.gain.setValueAtTime(amp,t+Math.max(0.05,d-0.08));
        g.gain.exponentialRampToValueAtTime(0.0001,t+d+(d>0.6?0.35:0.06));o.connect(g);g.connect(f);o.start(t);o.stop(t+d+0.45);}}
    t+=d;}}
function musicHorn2(){initAudio();if(typeof G!=='undefined')G.mhornKind=2;if(typeof broadcastEvent==='function')broadcastEvent('mhorn',{mhornKind:2});if(!AC)return;const t0=AC.currentTime+0.03;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(1100,t0);f.frequency.linearRampToValueAtTime(2800,t0+0.18);f.Q.value=0.7;
  const bus=AC.createGain();bus.gain.value=1.45;f.connect(bus);bus.connect(master);const rv=AC.createGain();rv.gain.value=0.75;bus.connect(rv);rv.connect(getReverb());
  const seq=[[76,0.28,[0,4,7]],[80,0.28,[0,3,7]],[83,0.34,[0,4,7]],[88,0.88,[0,4,7,12]],[83,0.26,[0,4,7]],[88,1.15,[0,4,7,12]]];
  let t=t0;
  for(const [m,d,ch] of seq){
    for(const iv of ch){const base=mF(m+iv-12),amp=iv===0?0.26:iv===12?0.12:0.15;
      for(const det of [-4,4]){const o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.value=base;o.detune.value=det;
        const lfo=AC.createOscillator(),lg=AC.createGain();lfo.frequency.value=4.8;lg.gain.value=base*0.004;lfo.connect(lg);lg.connect(o.frequency);lfo.start(t);lfo.stop(t+d+0.1);
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(amp,t+0.04);g.gain.setValueAtTime(amp,t+Math.max(0.05,d-0.08));
        g.gain.exponentialRampToValueAtTime(0.0001,t+d+(d>0.6?0.4:0.06));o.connect(g);g.connect(f);o.start(t);o.stop(t+d+0.48);}}
    t+=d;}}
function ponSnd(dest){
  if (!AC) return 1.4;
  initAudio();
  const out = dest || master;
  const t0 = AC.currentTime + 0.02;
  // リアル電子音乗降促進（2点チャイム＋注意喚起音）
  mbell(72, t0, 0.62, out);
  mnote(72, t0, 0.55, 'sine', 0.35, out, true);
  const t1 = t0 + 0.28;
  mbell(67, t1, 0.68, out);
  mnote(67, t1, 1.1, 'sine', 0.42, out, true);
  return 1.4;
}
// in-car announcement chime: a full arpeggio with bells, a soft pad and a long tail
function pipChime(vol){if(!AC)return 0;const t0=AC.currentTime+0.03,V=vol===undefined?1:vol;
  const seq=[[88,0],[84,0.17],[91,0.34],[86,0.51],[88,0.70],[83,0.87],[90,1.04],[85,1.21]];
  for(const [m,dt] of seq){const t=t0+dt;
    for(const [k,a] of [[1,1],[2,0.22],[3.01,0.08]]){const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=mF(m)*k;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.95*a*V,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+0.34);
      o.connect(g);g.connect(master);g.connect(getReverb());o.start(t);o.stop(t+0.4);}}
  return 1.55;}
function annChime(){if(!AC)return;const t0=AC.currentTime+0.04;
  const bus=AC.createGain();bus.gain.value=4.0;bus.connect(master);const rv=AC.createGain();rv.gain.value=1.8;rv.connect(getReverb());bus.connect(rv);
  const notes=[[76,0],[81,0.17],[85,0.34],[88,0.51],[93,0.7],[88,1.02],[85,1.2]];
  notes.forEach(([m,dt],i)=>{const last=i>=4,dur=last?2.4:1.5,t=t0+dt;
    for(const [k,a,ty] of [[1,1,'sine'],[2,0.3,'sine'],[3.01,0.14,'sine'],[4.02,0.06,'sine'],[5.4,0.03,'triangle']]){
      const o=AC.createOscillator(),g=AC.createGain();o.type=ty;o.frequency.value=mF(m)*k;
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.95*a*(last?1.15:1),t+0.014);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+0.05);}});
  for(const m of [64,71,76]){const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1400;
    o.type='triangle';o.frequency.value=mF(m);g.gain.setValueAtTime(0.0001,t0);g.gain.linearRampToValueAtTime(0.28,t0+0.5);g.gain.linearRampToValueAtTime(0.0001,t0+3.2);
    o.connect(f);f.connect(g);g.connect(bus);o.start(t0);o.stop(t0+3.3);}}
function annJE(ja,en,delay){setTimeout(()=>sayJE(ja,en),(delay||0)+100);} /* 車内チャイムなし */
function chime4(){[1319,1047,1319,1047].forEach((f,i)=>tone(f,i*0.32,0.35,'sine',0.35));}
/* positional sound for other trains: smooth rumble + soft hum, no clicks */
const tv=new THREE.Vector3(),camW=new THREE.Vector3(),camR=new THREE.Vector3(),camQ=new THREE.Quaternion();
let otBuf=null;
function initOTAudio(){if(!AC)return;
  if(!otBuf){const n=AC.sampleRate*4;otBuf=AC.createBuffer(1,n,AC.sampleRate);const d=otBuf.getChannelData(0);let last=0;
    for(let i=0;i<n;i++){last=(last+0.02*(Math.random()*2-1))/1.02;d[i]=last*3.5;}
    const fade=2000;for(let i=0;i<fade;i++){const k=i/fade;d[n-fade+i]=d[n-fade+i]*(1-k)+d[i]*k;}}
  for(const o of OT){if(o.snd)continue;
    const src=AC.createBufferSource();src.buffer=otBuf;src.loop=true;src.playbackRate.value=0.8+Math.random()*0.4;
    const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=500;f.Q.value=0.4;
    const g=AC.createGain();g.gain.value=0;let pan=null;try{pan=AC.createStereoPanner();}catch(e){}
    const ob=getExtBus()||master;src.connect(f);f.connect(g);if(pan){g.connect(pan);pan.connect(ob);}else g.connect(ob);src.start(AC.currentTime+Math.random()*0.5);
    const mo=AC.createOscillator();mo.type=(o.old||(o.tr&&o.tr.old))?'sawtooth':'sine';const mg=AC.createGain();mg.gain.value=0;mo.connect(mg);mg.connect(g);mo.start();
    const gIn=AC.createGain();gIn.gain.value=0;f.connect(gIn);mg.connect(gIn);gIn.connect(master); // 乗っている電車の音（車内なので外の音扱いにしない）
    o.snd={g,gIn,pan,mo,mg,f};}}
function initRemotePlayerSound(p) {
  if (!AC) return;
  if (!otBuf) {
    const n = AC.sampleRate * 4;
    otBuf = AC.createBuffer(1, n, AC.sampleRate);
    const d = otBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const fade = 2000;
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      d[n - fade + i] = d[n - fade + i] * (1 - k) + d[i] * k;
    }
  }
  try {
    const src = AC.createBufferSource();
    src.buffer = otBuf;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = AC.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    f.Q.value = 0.4;
    const g = AC.createGain();
    g.gain.value = 0;
    let pan = null;
    try { pan = AC.createStereoPanner(); } catch(e) {}
    const ob = getExtBus() || master;
    src.connect(f);
    f.connect(g);
    if (pan) { g.connect(pan); pan.connect(ob); } else { g.connect(ob); }
    src.start(AC.currentTime + Math.random() * 0.3);
    const mo = AC.createOscillator();
    mo.type = 'sawtooth';
    const mg = AC.createGain();
    mg.gain.value = 0;
    mo.connect(mg);
    mg.connect(g);
    mo.start();
    const gIn = AC.createGain();
    gIn.gain.value = 0;
    f.connect(gIn);
    mg.connect(gIn);
    gIn.connect(master);
    p.snd = { src, f, g, gIn, pan, mo, mg };
  } catch(e) {
    console.warn('initRemotePlayerSound error', e);
  }
}

function stopRemotePlayerSound(p) {
  if (p && p.snd) {
    try {
      if (p.snd.g && p.snd.g.gain) p.snd.g.gain.setValueAtTime(0, (AC && AC.currentTime) || 0);
      if (p.snd.src) { p.snd.src.stop(); p.snd.src.disconnect(); }
      if (p.snd.mo) { p.snd.mo.stop(); p.snd.mo.disconnect(); }
      if (p.snd.f) p.snd.f.disconnect();
      if (p.snd.pan) p.snd.pan.disconnect();
      if (p.snd.mg) p.snd.mg.disconnect();
      if (p.snd.gIn) p.snd.gIn.disconnect();
      if (p.snd.g) p.snd.g.disconnect();
    } catch(e) {}
    p.snd = null;
  }
}

/* 距離による音量：近づくにつれて大きく、離れるにつれて小さく。遠く（650m以上）の電車は聞こえない */
function otDistGain(d){if(d>=650)return 0;const near=1/(1+Math.pow(d/90,2));if(d<=380)return near;const u=(d-380)/270;return near*(1-u*u*(3-2*u));}
function updOTAudio(){if(!AC)return;if(G.sound===false){const t=AC.currentTime;for(const o of OT)if(o.snd){o.snd.g.gain.setTargetAtTime(0,t,0.08);o.snd.gIn.gain.setTargetAtTime(0,t,0.08);}if(IS_ONLINE&&window.ONLINE_PLAYERS){for(const pid in ONLINE_PLAYERS){const p=ONLINE_PLAYERS[pid];if(p&&p.snd){if(p.snd.g&&p.snd.g.gain)try{p.snd.g.gain.setTargetAtTime(0,t,0.08);}catch(e){}if(p.snd.gIn&&p.snd.gIn.gain)try{p.snd.gIn.gain.setTargetAtTime(0,t,0.08);}catch(e){}}}}return;}if(OT.some(o=>!o.snd))initOTAudio();camera.getWorldPosition(camW);camera.getWorldQuaternion(camQ);camR.set(1,0,0).applyQuaternion(camQ);const t=AC.currentTime;
  for(const o of OT){if(!o.snd)continue;const S=o.snd;
    const vis=o.vis&&o.state!=='off'&&o.tr&&o.tr.grp.visible;if(!vis){S.g.gain.setTargetAtTime(0,t,1.2);S.gIn.gain.setTargetAtTime(0,t,0.5);continue;}
    const riding=!!(RIDE&&RIDE.a===o),sp=Math.min(1.5,o.v/16)*(o.tr.old?1.6:1); /* 古い電車は爆音 */
    if(riding){S.g.gain.setTargetAtTime(0,t,0.3);S.gIn.gain.setTargetAtTime(o.v>0.2?Math.max(0.25,sp*1.25):0,t,0.25);}
    else S.gIn.gain.setTargetAtTime(0,t,0.3);
    let d=1e9;for(const c of o.tr.cars){const dd=c.position.distanceTo(camW);if(dd<d)d=dd;}tv.subVectors(o.tr.cars[Math.min(2,o.tr.cars.length-1)].position,camW); // いちばん近い車両までの距離
    if(!riding)S.g.gain.setTargetAtTime(sp*2.2*otDistGain(d),t,0.5);
    S.f.frequency.setTargetAtTime(300+o.v*18,t,0.4);
    S.mg.gain.setTargetAtTime(o.v>0.5?(o.tr.old?0.55:0.28):0,t,0.4);S.mo.frequency.setTargetAtTime(o.tr.old?30+o.v*17:90+o.v*14,t,0.4);
    if(S.pan)S.pan.pan.setTargetAtTime(clamp(tv.dot(camR)/(tv.length()+1),-0.9,0.9),t,0.3);
    if(!riding&&d<24&&Math.abs(o.v+(PAX?0:G.v))>8){if(!o.whooshPlayed){o.whooshPlayed=true;if(o.tr.cars[0]&&o.tr.cars[0].position)playAt(o.tr.cars[0].position,dest=>airHiss(0.32,1.0));}}else if(d>60){o.whooshPlayed=false;}}
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      try{
        const p = ONLINE_PLAYERS[pid];
        if(!p || !p.tr || !p.tr.cars || !p.tr.cars.length || !p.tr.grp || !p.tr.grp.visible){
          if(p && p.snd && p.snd.g && p.snd.g.gain){
            try{ p.snd.g.gain.setTargetAtTime(0, t, 0.8); }catch(e){}
          }
          continue;
        }
        if(!p.snd) initRemotePlayerSound(p);
        if(!p.snd) continue;
        const S = p.snd;
        const ridingP = !!(typeof RIDE !== 'undefined' && RIDE && RIDE.a && RIDE.a.p === p);
        const pv = (typeof p.v === 'number' && isFinite(p.v)) ? Math.max(0, p.v) : 0;
        const gv = (typeof G !== 'undefined' && G && typeof G.v === 'number' && isFinite(G.v)) ? Math.max(0, G.v) : 0;
        const sp = Math.min(1.8, pv / 16);
        let d = 1e9;
        if (p.tr.cars[0] && p.tr.cars[0].position) {
          d = p.tr.cars[0].position.distanceTo(camW);
        }
        if (!ridingP && (!isFinite(d) || d > 650)) {
          if (p.snd && p.snd.g && p.snd.g.gain) {
            try { p.snd.g.gain.setTargetAtTime(0, t, 0.8); } catch(e) {}
          }
          if (p.snd && p.snd.gIn && p.snd.gIn.gain) {
            try { p.snd.gIn.gain.setTargetAtTime(0, t, 0.4); } catch(e) {}
          }
          continue;
        }
        const midCar = p.tr.cars[Math.min(2, p.tr.cars.length - 1)];
        if(midCar && midCar.position) tv.subVectors(midCar.position, camW);
        const distG = otDistGain(d);
        if(S.gIn && S.gIn.gain){
          try{ S.gIn.gain.setTargetAtTime(ridingP ? clamp(sp * 0.9, 0, 1.8) : 0, t, 0.35); }catch(e){}
        }
        if(S.g && S.g.gain){
          try{ S.g.gain.setTargetAtTime(ridingP ? 0 : clamp(sp * 2.8 * distG, 0, 4.0), t, 0.35); }catch(e){}
        }
        if(S.f && S.f.frequency){
          try{ S.f.frequency.setTargetAtTime(clamp(320 + pv * 22, 100, 2000), t, 0.3); }catch(e){}
        }
        if(S.mg && S.mg.gain){
          try{ S.mg.gain.setTargetAtTime(pv > 0.4 ? 0.38 : 0, t, 0.3); }catch(e){}
        }
        if(S.mo && S.mo.frequency){
          try{ S.mo.frequency.setTargetAtTime(clamp(75 + pv * 18, 50, 800), t, 0.3); }catch(e){}
        }
        if(S.pan && S.pan.pan){
          const pVal = clamp(tv.dot(camR) / (tv.length() + 1), -0.9, 0.9);
          try{ S.pan.pan.setTargetAtTime(isFinite(pVal) ? pVal : 0, t, 0.2); }catch(e){}
        }
        if(!ridingP&&d<24&&Math.abs(pv+gv)>6){
          if(!p.whooshPlayed){
            p.whooshPlayed=true;
            if(p.tr.cars[0]&&p.tr.cars[0].position){
              try{playAt(p.tr.cars[0].position,dest=>airHiss(0.35,1.1));}catch(e){}
            }
          }
        }else if(d>60){p.whooshPlayed=false;} else if(d > 45){
          p.whooshPlayed = false;
        }
      }catch(e){}
    }
  }}
/* ================= messages ================= */
function toast(msg,cls,voice,kind,urgent){G.msg={text:msg,cls:cls||'info',t:nowMs()};if(voice)say(voice,kind||'sys',urgent);}
function notchName(n){return n>0?'力行':n===0?'惰行':'制動';}
/* ================= environment (real time) ================= */
const C=h=>new THREE.Color(h);
const PAL={topN:C(0x050918),topD:C(0x3b76c0),topT:C(0x2a2f5c),horN:C(0x151d3a),horD:C(0xbfd8ee),horT:C(0xf0a070),fogN:C(0x10152a),fogD:C(0xc4d6e6),fogT:C(0xcf8f7a)};
const tA=new THREE.Color(),tB=new THREE.Color(),tC=new THREE.Color(),tD=new THREE.Color(),tE=new THREE.Color(),wxTintC=new THREE.Color();
function sunState(ms){const d=new Date(ms);const h=d.getHours()+d.getMinutes()/60+d.getSeconds()/3600;
  const doy=(d-new Date(d.getFullYear(),0,0))/864e5;const dayLen=12+2.3*Math.sin((doy-80)/365*2*Math.PI);const rise=12-dayLen/2,set=12+dayLen/2;
  let e;if(h>=rise&&h<=set)e=Math.sin(Math.PI*(h-rise)/dayLen);else{const nl=24-dayLen,x=h>set?h-set:h+24-set;e=-Math.sin(Math.PI*x/nl);}return {e,h};}
function updEnv(){
  const {e,h}=sunState(nowMs());const dayF=smooth(-0.04,0.3,e),twF=clamp(1-Math.abs(e-0.02)/0.2,0,1),nightF=1-smooth(-0.25,0.02,e);
  const top=tA.copy(PAL.topN).lerp(PAL.topD,dayF).lerp(PAL.topT,twF*0.6),hor=tB.copy(PAL.horN).lerp(PAL.horD,dayF).lerp(PAL.horT,twF);
  const fog=tC.copy(PAL.fogN).lerp(PAL.fogD,dayF).lerp(PAL.fogT,twF*0.8),mid=tD.copy(hor).lerp(top,0.55);
  const isLtdTrain=!BRANCH&&((PAX&&RIDE&&RIDE.a&&(RIDE.a.key==='G'||RIDE.a.key==='H'))||(!PAX&&(G.key==='G'||G.key==='H')));
  const inTun=isLtdTrain||inTunnel(G.s);
  /* 選んだ天候を空・霧・光に反映（晴れ以外は空を白っぽく・暗く、霧を手前に） */
  if(WX.id!=='clear'){const wk=WX.id==='cloudy'?0.40:WX.id==='fog'?0.85:0.62;wxTintC.setHex(WX.fog[0]);
    top.lerp(wxTintC,wk*0.55);hor.lerp(wxTintC,wk*0.8);fog.lerp(wxTintC,wk);mid.copy(hor).lerp(top,0.55);}
  if(inTun){fog.setHex(0x05060a);}
  for(let i=0;i<skyH.length;i++){const y=skyH[i];
    if(y<=0)tE.copy(fog);else if(y<0.07)tE.copy(fog).lerp(hor,y/0.07);else if(y<0.3)tE.copy(hor).lerp(mid,(y-0.07)/0.23);else tE.copy(mid).lerp(top,Math.min(1,(y-0.3)/0.4));
    skyCol[i*3]=tE.r;skyCol[i*3+1]=tE.g;skyCol[i*3+2]=tE.b;}
  skyGeo.attributes.color.needsUpdate=true;
  scene.fog.color.copy(fog);scene.background.copy(fog);scene.fog.near=inTun?18:lerp(60,200,dayF);scene.fog.far=inTun?240:lerp(700,1400,dayF);
  if(WX.id!=='clear'&&!inTun){scene.fog.near=Math.min(scene.fog.near,WX.fog[1]+40);scene.fog.far=Math.min(scene.fog.far,WX.fog[2]+220);}
  hemi.intensity=inTun?0.08:(0.2+0.72*dayF+0.1*twF);hemi.color.copy(C(0x3c4a80)).lerp(C(0xb9c8e8),dayF);
  if(WX.amb!==1)hemi.intensity*=WX.amb;
  const az=(h-12)/12*Math.PI*0.95,el=Math.max(-0.3,e)*1.1;
  const sd=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).normalize();
  sunMesh.position.copy(sd).multiplyScalar(2600);sunMesh.lookAt(0,0,0);sunMesh.visible=e>-0.06;sunMesh.material.color.copy(C(0xff9a50)).lerp(C(0xfff6e0),smooth(0,0.4,e));
  const md=new THREE.Vector3(-sd.x,Math.max(0.3,-sd.y*0.8+0.2),-sd.z).normalize();moonMesh.position.copy(md).multiplyScalar(2600);moonMesh.lookAt(0,0,0);moonMesh.visible=nightF>0.3;
  const useSun=e>-0.05;dirL.position.copy(useSun?sd:md).multiplyScalar(100);
  dirL.intensity=useSun?0.1+0.85*dayF+0.25*twF:0.12;if(WX.sun!==1&&WX.sun!=null)dirL.intensity*=WX.sun;dirL.color.copy(useSun?C(0xffa060).lerp(C(0xfff4e6),dayF):C(0x8fa3d9));
  starMat.opacity=nightF*0.9*(WX.id==='clear'?1:WX.id==='cloudy'?0.25:0.05);
  const base=C(0x191b2c).lerp(C(0x8193ab),dayF).lerp(C(0x5a4466),twF*0.7);mountMats.forEach((m,k)=>m.color.copy(base).multiplyScalar(1-k*0.08));
  // lights come on the moment it gets dark (and in tunnels), instead of fading in slowly
  const lit=1-smooth(0.015,0.075,e),dark=Math.max(lit,inTun?1:0);
  const lateF=(h>=0.5&&h<5)?0.35:(h>=22||h<0.5)?0.7:1;
  IMATS.bldA.emissiveIntensity=0.06+0.95*lit*lateF;IMATS.bldB.emissiveIntensity=0.06+1.0*lit*lateF;
  TM.iwall.emissiveIntensity=0.3+0.35*dark;TM.ifloor.emissiveIntensity=0.25+0.3*dark;TM.doorway.emissiveIntensity=0.15+0.5*dark;
  MATS.lamp.emissiveIntensity=1.1*lit;MATS.lamp.color.setHex(lit>0.5?0xffffff:0xcfcfcf);G.stLit=lit;STFAC.forEach(m=>m.emissiveIntensity=0.9*lit*lateF);
  headSpot.intensity=dark*2.6;GLOW.head.opacity=0.45+0.5*dark;GLOW.tail.opacity=0.35+0.55*dark;GLOW.pool.opacity=0.6*dark;cabLight.intensity=0.15+dark*0.45;
}

/* ================= doors ================= */
const stopS=v=>stOf(v).s+TK[G.key].so;
function stopDist(v){return G.dir*sdiff(G.s,stopS(v));}
const localSide=st=>(!BRANCH&&st&&st.i===0&&G.key!=='G'&&G.key!=='H')?1:TK[G.key].side(st)*G.dir;
const lastStop=()=>G.list?G.list.length-1:Infinity;
function openDoor(local,sys){if(sigStopped()){toast('停止信号で止まっているときは扉を開けられません','warn');return;}if(G.crew==='twoD'&&!sys){toast('ツーマン運転：ドアは車掌が扱います','warn');return;}if(OWNOLD&&!G.lean){toast('戸開は乗務員室のドア近く：窓から顔を出して操作します','warn');return;}
  if(G.phase!=='play')return;const D=G.door;
  if(D.state!=='closed'){if(D.local===local){if(D.state==='closing'){D.state='opening';G.noBoard=false;G.closeWait=null;doorOpenSnd();}}else toast('反対側の扉が開いています','warn');return;}
  if(G.v>0.05){toast('走行中は扉を開けられません','warn');return;}
  if(G.depCheck!==null){const v=G.depCheck;if(local===localSide(stOf(v))&&Math.abs(stopDist(v))<20){G.atStation=v;G.nv=v;G.depCheck=null;D.local=local;D.side=local*G.dir;D.state='opening';G.sq=(G.sq|0)+1;doorOpenSnd();if(typeof broadcastEvent==='function')broadcastEvent('doorOpen');return;}}
  const v=G.nv,st=stOf(v),d=stopDist(v);
  if(d>17.9||d<-6.5){toast('ホームがありません','warn');return;}
  if(local!==localSide(st)){toast('ホームは'+(localSide(st)<0?'左':'右')+'側です','warn');return;}
  G.atStation=v;D.local=local;D.side=local*G.dir;D.state='opening';G.flowPending=true;G.sq=(G.sq|0)+1;doorOpenSnd();toast(st.name+' に到着','ok');
  if(typeof broadcastEvent==='function')broadcastEvent('doorOpen');
  const end=v>=lastStop();if(!G.said['arr_'+v]){G.said['arr_'+v]=true;setTimeout(()=>sayJE(arriveAnn(st,end),arriveAnnEn(st,end)),400);}
  if(!G.list&&(st.cls==='M'||st.i===0)&&G.nv>0)askStation(st,false);
}
function closeDoor(local,sys){if(G.crew==='twoD'&&!sys){toast('ツーマン運転：ドアは車掌が扱います','warn');return;}if(OWNOLD&&G.crew!=='twoC'&&!G.lean){toast('戸閉は乗務員室のドア近く：窓から顔を出して操作します','warn');return;}
  if(G.phase!=='play')return;const D=G.door;
  if(D.state==='closed'||D.state==='closing')return;
  if(D.local!==local){toast('そちら側の扉は開いていません','warn');return;}
  if(G.promoLoop)stopPromoLoop(true);
  if(doorBlocked()){G.noBoard=true;const jam=jamCount()>0;if(jam)pushInAllJams();
    if(!G.closeWait){G.closeWait={t:0};toast(jam?'満員：お客さまを押し込み中…乗り終わり次第閉めます':'乗車が終わり次第閉めます','warn');say('扉に人がいます。','drv');}
    return;}
  startClosing();
}
/* 発車メロディ・乗降促進の「曲・音色」を1か所で決める。
   自分の画面でも、他の人の画面でも、同じ関数・同じ曲・同じ音色で鳴らす。 */
function promoRun(n,ctx,dest,vol){
  if(!AC)return 0;
  ctx=ctx||{};const d=dest||master,V=(vol==null?1:vol);
  const key=ctx.key||'A',branch=ctx.branch!=null?!!ctx.branch:!!BRANCH;
  const dir=ctx.dir!=null?ctx.dir:1;
  const stIdx=(ctx.stIdx!=null&&isFinite(ctx.stIdx)&&ctx.stIdx>=0)?(ctx.stIdx|0):null;
  const ltd=!branch&&(key==='E'||key==='F'||key==='G'||key==='H');
  if(n===4)return ponSnd(d);
  if(n===1)return 0;                                  /* 音声のみ */
  if(branch&&LINE_ID==='branch'){ /* 白峰支線：乗降促進はベルだけ */
    const ping=(at)=>{const t0=AC.currentTime+at;[[760,0,0.22,'square',0.2],[1520,0,0.16,'sine',0.14]].forEach(([f,dt,dur,tp,v])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=tp;o.frequency.value=f;g.gain.setValueAtTime(0.0001,t0+dt);g.gain.exponentialRampToValueAtTime(v,t0+dt+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+dur);o.connect(g);g.connect(d);o.start(t0+dt);o.stop(t0+dt+dur+0.03);});};
    ping(0);ping(1.05);return 1.9;
  }
  if(branch&&LINE_ID==='branch2')return playB2Melody(dir,d,V); /* 紫雲地下線：御堂筋線風の上下別メロディ */
  if(branch&&LINE_ID==='branch3')return playSong(b3MelodyFor(dir),d,V); /* 天宮高架線：上下線共通メロディ・音階違い */
  if(branch&&stIdx!=null&&STATIONS[stIdx])return playSong(branchSongFor(STATIONS[stIdx]),d,V);
  if(ltd&&n==='st'&&stIdx!=null&&STATIONS[stIdx])return playSong(ltdSong(stIdx),d,V);
  if(n===2)return playSong(SONG_A,d,V);
  if(n===3)return playSong(SONG_B,d,V);
  return melody(d,V,undefined,dir);
}
const PROMO_NAMES=['外回り「汐鳴り」','乗降促進（音声のみ）','内回り「潮風」','快特専用「グラン汐見」','乗降促進（オリジナルチャイム）'];
const PROMO_DEF={local:0,rapid:2,ltd:3,exp:2,branch:0}; // 支線は駅ごとのメロディ
function defaultPromo(){
  const S=SERVICES[G.route];
  if(BRANCH) return 0; // 支線
  if(!S) return 0;
  if(S.kind === 'ltd') return 'st'; // 快速特急は停車駅ごとに違う専用メロディ
  if(S.kind === 'local') return 0; // 各駅停車は全駅共通「汐鳴り」（外回り・内回りで音色が違う）
  const isInner = (S.short && S.short.includes('内回り')) || (S.name && S.name.includes('内回り')) || S.key === 'B' || S.key === 'D' || S.key === 'F';
  return isInner ? 2 : 0; // 快速：外回りは0（汐鳴り）、内回りは2（潮風）
}
let promoVoiceT=0;
function promote(n,sys){ // n: 0 classic melody+voice, 1 voice only, 2/3 new melodies (+voice), 'st' 駅ごとのメロディ
  if(G.phase!=='play')return;n=n||0;
  if(G.autoMelOn&&!G.autoMelFired){G.autoMelFired=true;clearAutoMelTimers();} /* 手動で鳴らしたら自動再生は行わない */
  if(G.crew==='twoD'&&!sys){toast('ツーマン運転：乗降促進は車掌が扱います','warn');return;}
  if(OWNOLD&&G.crew!=='twoC'&&!G.lean&&!nearMeloBox()){toast('発車メロディのボタンはホームにあります（外に出るか、窓から顔を出して押す）','warn');return;}
  if(!(G.door.state==='open'||G.door.state==='opening')){toast('乗降促進は扉が開いているときに使います','warn');return;}
  if(G.promoLoop){stopPromoLoop(true);return;} /* もう一度押すと止まる */
  if(G.promoOn){toast('放送中です','info');return;}
  G.promoOn=true;if(G.atStation!==null)G.promoted[G.atStation]=true;const fi=flowSt(),fk=fkey();
  for(const p of active){if(p.flow!==fk||p.st!==fi)continue;
    if(p.kind==='board'||p.kind==='alight'||p.kind==='runner'){p.speed*=1.5;p.delay*=0.5;}
    if(p.kind==='jam')pushInJam(p);}
  if(G.runnerPlanned&&!G.runnerSpawned)G.runnerT=Math.min(G.runnerT,1.2);
  const voice=()=>{G.promoOn=false;doorWarnT=nowMs();playGuide('tab_doors');if(typeof broadcastEvent==='function')broadcastEvent('promoVoice',{file:'assets/audio/ann/guide_tab_doors.mp3'});if(LIVE&&liveAvail())liveSay('ドアが閉まります。ご注意ください。');};
  const bSt=BRANCH&&G.atStation!==null?stOf(G.atStation):null;
  const isLtdTrain=!BRANCH&&(G.key==='E'||G.key==='F'||G.key==='G'||G.key==='H');
  const cSt=n==='st'&&isLtdTrain&&G.atStation!==null?stOf(G.atStation):null;
  if(n===1){toast(PROMO_NAMES[1],'info');if(typeof broadcastEvent==='function')broadcastEvent('promo',{promoN:1,promoKey:G.key,promoDir:G.dir,promoBranch:!!BRANCH,promoSt:(G.atStation!=null?G.atStation:-1)});voice();return;}
  toast((cSt?'発車メロディ「'+ltdSong(cSt.i).name+'」':bSt&&LINE_ID==='branch'?'乗降促進（ベル）':bSt&&(n===0||n==='st')?'発車メロディ「'+(LINE_ID==='branch3'?b3MelodyFor(G.dir).name:LINE_ID==='branch2'?b2MelodyName(G.dir):branchSongFor(bSt).name)+'」':(n===0||n==='st')?(G.dir<0?'発車メロディ「汐鳴り（内回り音色）」':'発車メロディ「汐鳴り（外回り音色）」'):PROMO_NAMES[n])+'（もう一度押すと止まります）','info');
  const pctx={key:G.key,dir:G.dir,branch:!!BRANCH,stIdx:(G.atStation!=null?G.atStation:-1),stName:(G.atStation!=null&&stOf(G.atStation)?stOf(G.atStation).name:'')};
  const play=()=>{if(!G.promoLoop)return;const dur=promoPlay(b=>promoRun(n,pctx,b,1))||1;
    G.promoLoop.onePhraseDur=dur;
    /* 鳴らすたびに同じ内容を配信：他の人の画面でも同じ曲が同じタイミングで鳴る */
    if(typeof broadcastEvent==='function')broadcastEvent('promo',{promoN:n,promoPlay:1,promoKey:pctx.key,promoDir:pctx.dir,promoBranch:pctx.branch,promoSt:pctx.stIdx,stName:pctx.stName});
    G.promoLoop.timer=setTimeout(play,dur*1000+250);};                                       /* 終わったらまた最初から */
  clearTimeout(promoVoiceT);G.promoLoop={n,timer:null,voice,t0:nowMs(),onePhraseDur:8};play();
}
function stopPromoLoop(withVoice){const L=G.promoLoop;if(!L)return;clearTimeout(L.timer);G.promoLoop=null;promoCut();
  if(withVoice){toast('メロディを止めました','info');setTimeout(()=>{L.voice();},350);}else G.promoOn=false;}
function pushInJam(p){ /* 奥へ押し込み、強制乗車（再詰まりしない） */
  p.kind='board';p.end='board';p.train='OWN';p.forceIn=true;p.delay=rand(0.2,1.2);p.speed=rand(1.4,2.0);
  const sd=Math.sign(p.o-p.trackO)||1;p.path=[[p.doorS||p.s,p.trackO+sd*0.35],[p.doorS||p.s,p.trackO+sd*0.12]];}
function pushInAllJams(){const fi=flowSt(),fk=fkey();for(const p of active)if(p.flow===fk&&p.st===fi&&p.kind==='jam')pushInJam(p);}
function startClosing(){const D=G.door;G.closeWait=null;promoAbort();abandonPending();D.state='closing';doorCloseSnd();if(typeof broadcastEvent==='function')broadcastEvent('doorClose');}
function promoAbort(){if(!G.promoOn)return;clearTimeout(promoVoiceT);promoCut();G.promoOn=false;}
/* ===== 紫雲地下線・天宮高架線：信号連動の発車メロディ自動再生 =====
   ・ドアが開いたときに信号が赤 → 黄（または青）に変わった瞬間に再生
   ・黄・青だった → ドアが開いて10秒後に再生
   メロディのあとに戸締め放送を流し、そのあと自動でドアを閉める。 */
function clearAutoMelTimers(){if(G.autoMelTimers){for(const t of G.autoMelTimers)clearTimeout(t);}G.autoMelTimers=[];}
function startAutoDepartMelody(st){
  if(!AC||!st)return;
  G.autoMelBusy=true;
  promoCut();
  try{
    const bus=AC.createGain();bus.gain.value=1;bus.connect(master);bus.connect(getReverb());promoOnce=bus;
    let songName='',dur=6;
    if(LINE_ID==='branch2'){
      songName=b2MelodyName(G.dir);
      dur=playB2Melody(G.dir,bus,1)||4.5;
    }else{
      const song=(LINE_ID==='branch3')?b3MelodyFor(G.dir):branchSongFor(st);
      songName=song.name;
      dur=playSong(song,bus,1)||6;
    }
    toast('発車メロディ「'+songName+'」を自動再生','info');
    if(typeof broadcastEvent==='function')broadcastEvent('promo',{promoN:0,promoPlay:1,promoKey:G.key,promoDir:G.dir,promoBranch:true,promoSt:st.i,stName:st.name});
    const tm=setTimeout(()=>{
      if(G.phase!=='play'||PAX)return;
      if(!(G.door.state==='open'||G.door.state==='opening')||G.atStation===null)return;
      playGuide('tab_doors');
      const tm2=setTimeout(()=>{
        if(G.phase!=='play'||PAX)return;
        if(G.auto&&G.door.state==='open'&&G.atStation!==null&&!(OWNOLD&&!G.lean))closeDoor(G.door.local,true);
        G.autoMelBusy=false;
      },3600);
      G.autoMelTimers.push(tm2);
    },Math.max(1200,dur*1000));
    G.autoMelTimers.push(tm);
  }catch(e){console.warn('auto melody',e);G.autoMelBusy=false;}
}
function updBranchAutoMelody(dt){
  if(!BRANCH||PAX||G.phase!=='play'||G.walkOn||G.twoMan){goto_reset_auto_melody();return;}
  if(LINE_ID!=='branch2'&&LINE_ID!=='branch3')return;
  const D=G.door,atSt=(D.state==='open'||D.state==='opening')&&G.atStation!==null;
  /* 終点での折り返し（ホームに出て反対の運転室へ）を妨げないよう、終点停車中は自動再生・自動戸閉をしない */
  const atTerminus=!!(G.list&&G.atStation!==null&&G.atStation>=lastStop());
  if(!atSt){if(G.autoMelOn){G.autoMelOn=false;clearAutoMelTimers();G.autoMelBusy=false;}G.autoMelFired=false;G.autoMelT=0;G.autoMelRed=null;return;}
  if(!G.autoMelOn){G.autoMelOn=true;G.autoMelT=0;G.autoMelFired=false;G.autoMelRed=null;}
  if(G.autoMelFired)return;
  if(atTerminus){if(G.autoMelOn){G.autoMelOn=false;clearAutoMelTimers();G.autoMelBusy=false;}return;}
  const sg=nextSignal(mainAt(G.key,G.s),G.s,G.dir);
  const asp=sg?sg.asp:'G';
  if(asp==='R')G.autoMelRed=true;                 /* ドアが開いている間に赤を見たら「赤だった」 */
  if(D.state!=='open')return;                     /* 開き切ってから計測開始 */
  G.autoMelT+=dt;
  if(asp==='R')return;                            /* 赤の間は待つ（青・黄になったら再生） */
  const wait=G.autoMelRed?0:10;
  if(G.autoMelT>=wait&&!G.autoMelBusy&&!(G.promoLoop||G.promoOn)){G.autoMelFired=true;startAutoDepartMelody(stOf(G.atStation));}
}
function goto_reset_auto_melody(){if(G.autoMelOn){G.autoMelOn=false;clearAutoMelTimers();G.autoMelBusy=false;}G.autoMelFired=false;G.autoMelT=0;}
/* 乗りに向かっている電車のドアがもう閉まった／発車した → ドアのすぐ前なら乗る、そうでなければ列に戻って次を待つ */
function boardOpen(p){
  if(p.train==='OWN')return !PAX&&G.atStation!==null&&(G.door.state==='open'||G.door.state==='opening');
  const a=p.train;if(!a)return false;
  if(a.stSt!==undefined)return a.state==='dwell'&&a.frac>0.25;
  if(a.s!=null&&a.key&&STATIONS[p.st]){
    const st=STATIONS[p.st];
    const d=Math.abs(sdiff(a.smoothS!=null?a.smoothS:a.s,st.s+(TK[a.key]?TK[a.key].so:0)));
    return !a.isPax&&a.state==='driving'&&d<25&&(a.v||0)<0.5&&(a.door==='open'||a.door==='opening')&&(a.doorFrac||0)>0.25;
  }
  return false;
}
function requeue(p){const st=STATIONS[p.st],k=p.flow;if(!st||!TK[k]||!serves(st,k)){freePerson(p);return;}
  const T=TK[k],doors=doorList(st.s+T.so,T.dir<0,greenCarsFor(k),carsFor(k)),list=st.wait[k]||(st.wait[k]=[]),s0=p.s,o0=p.o;
  const sd=T.side(st),base=T.off(st.s),pr=platRange(st,k),oMin=Math.min(pr[0],pr[1])+0.45,oMax=Math.max(pr[0],pr[1])-0.45;
  spawnOneWait(st,k,doors,list,{},false,p);p.s=s0;p.o=Math.abs(o0-base)<2.2?clamp(base+sd*2.4,oMin,oMax):clamp(o0,oMin,oMax);p.delay=0;p.hidden=false;p.g.visible=true;p.train=null;p.forceIn=false;}
function absorbAsBoarded(p){ /* ドア付近まですでに乗り込んでいた人は車内へ引き継いでから消す */
  if(p.train&&(p.kind==='board'||p.kind==='runner'||p.kind==='jam')&&p.trackO!==-99&&Math.abs(p.o-p.trackO)<1.65){
    boardIntoTrain(p);
  }
  if((p.train==='OWN'||p.train==null)&&p.kind!=='jam'&&!p.forceIn&&!PAX)G.load=Math.min(maxLoadFor(G.key),(G.load||0)+1);
  freePerson(p);
}
function clearDoorPeople(){ /* 戸閉時：実際に停車中の自列車ドア付近の人だけ乗車扱い */
  if(PAX||G.atStation===null)return;
  const fi=flowSt(),fk=fkey();if(fi<0)return;const st=STATIONS[fi];if(!st)return;
  for(const p of active.slice()){if(p.st!==fi)continue;
    const nearDoor=p.trackO!==-99&&Math.abs(p.o-p.trackO)<2.4;
    if(p.kind==='jam'||p.kind==='board'||p.kind==='runner'){if(p.train==='OWN')absorbAsBoarded(p);else requeue(p);continue;}
    if(nearDoor&&(p.kind==='alight'||(p.path&&p.path.length))){ /* 線路側にいた人も乗車扱い */
      absorbAsBoarded(p);continue;}
  }
}
function onClosed(){G.autoMel=null;say('戸閉め、よし。','drv');G.noBoard=false;G.closeWait=null;clearDoorPeople();try{if(!PAX&&typeof syncSalFromCar==='function')syncSalFromCar();}catch(_){}
  /* 列に並んだまま乗らなかった人だけホームに残す（線路側は既に回収済み） */
  abandonPending();
  /* 以前はここで車内の人を全員片付けて並べ直していたため、ドアを閉めた瞬間に人が消えて戻っていた。乗り降りは個別に反映済みなので何もしない */
  if(G.atStation!==null){const v=G.atStation;G.lastDepSt=v;G.depCheck=v;G.nv=v+1;G.atStation=null;planFrom(nowMs()+15000);}
  G.flowV=-1;}
function updDoor(dt){const D=G.door;
  if(G.closeWait){if(D.state==='closed'||D.state==='closing'||G.phase!=='play')G.closeWait=null;
    else if(D.state==='open'){G.closeWait.t+=dt;if(jamCount()>0)pushInAllJams();if(!doorBlocked()||G.closeWait.t>5)startClosing();}}
  if(D.state==='opening'){D.frac=Math.min(1,D.frac+dt/2.2);if(D.frac>=1){D.state='open';if(G.flowPending){G.flowPending=false;G.flowV=G.atStation;const st=stOf(G.atStation);if(G.isTest||G.rsManual==='試運転'||G.rsManual==='回送'){G.load=0;}else{if(G.load==null||G.load<8)G.load=trainLoadFor(G.key);startFlows(st,fkey(),st.s+sdiff(st.s,G.s),'OWN');}}}}
  else if(D.state==='closing'){D.frac=Math.max(0,D.frac-dt/2.6);
    if(D.frac<0.7&&D.frac>0.05&&doorBlocked()){const jam=jamCount()>0;G.noBoard=true;if(jam)pushInAllJams();
      toast(jam?'満員のため扉が閉まりません（押し込み後に再度閉めます）':'扉に乗客が挟まりました','bad');D.state='opening';doorOpenSnd();G.closeWait={t:0};}
    else if(D.frac<=0){D.state='closed';onClosed();}}
  setDoors(ownTrain,D.side,D.frac);}
/* platform doors follow whichever train is standing there */
const hdPrev=new Map();
function playRecordedAnn(file,gainVal,destNode){
  if(window.__DISP_MONITOR||(typeof G!=='undefined'&&G.sound===false))return;
  if(!window.__remoteSndPlaying&&typeof broadcastSound==='function'){try{broadcastSound(file,gainVal);}catch(e){}}
  const playFallback=()=>{if(destNode&&destNode===extBus&&typeof listenerSealed==='function'&&listenerSealed())return;try{const au=new Audio(file);au.volume=Math.min(1,(gainVal||1)*0.8);au.play().catch(()=>{});}catch(_){}};
  if(typeof loadAnnBuffer==='function'&&AC){
    loadAnnBuffer(file).then(buf=>{
      if(!buf){playFallback();return;}
      const src=AC.createBufferSource(),g=AC.createGain();
      src.buffer=buf;g.gain.value=gainVal||1.0;
      src.connect(g);g.connect(destNode||master||AC.destination);
      src.start();
    }).catch(playFallback);
  }else{playFallback();}
}
function playEmergencyStopAnn(){
  if(window.__DISP_MONITOR||(typeof G!=='undefined'&&G.sound===false))return;
  if(_ebAnnSent)return;_ebAnnSent=true;
  try{
    if(AC){
      const t0=AC.currentTime;
      [[1046.5,0,0.14],[880,0.16,0.14],[1046.5,0.32,0.24]].forEach(([f,dt0,dur])=>{
        const o=AC.createOscillator(),g=AC.createGain();
        o.type='triangle';o.frequency.value=f;
        g.gain.setValueAtTime(0.001,t0+dt0);
        g.gain.exponentialRampToValueAtTime(0.11,t0+dt0+0.02);
        g.gain.exponentialRampToValueAtTime(0.001,t0+dt0+dur);
        o.connect(g);g.connect(master||AC.destination);
        o.start(t0+dt0);o.stop(t0+dt0+dur+0.02);
      });
    }
    setTimeout(()=>playRecordedAnn('assets/audio/ann/emergency_stop.mp3',1.1),520);
  }catch(e){}
}
const _apCool=new Map();
function playApproachAnn(st,k){
  if(window.__DISP_MONITOR||(typeof G!=='undefined'&&G.sound===false))return;
  const onPlatform=(typeof PAX!=='undefined'&&PAX)?!(typeof RIDE!=='undefined'&&RIDE):(typeof G!=='undefined'&&G&&G.walkOn&&G.walkArea!=='train');
  if(!onPlatform)return;
  if(typeof listenerSealed==='function'&&listenerSealed())return;
  initAudio();
  const key=st.i+':'+k,now=Date.now();
  if((_apCool.get(key)||0)>now-35000)return;
  _apCool.set(key,now);
  try{
    const ext=getExtBus()||master;
    if(AC){
      const t0=AC.currentTime;
      [[880,0,0.18],[659.25,0.19,0.28]].forEach(([f,dt0,dur])=>{
        const o=AC.createOscillator(),g=AC.createGain();
        o.type='sine';o.frequency.value=f;
        g.gain.setValueAtTime(0.001,t0+dt0);
        g.gain.exponentialRampToValueAtTime(0.07,t0+dt0+0.03);
        g.gain.exponentialRampToValueAtTime(0.001,t0+dt0+dur);
        o.connect(g);g.connect(ext||AC.destination);
        o.start(t0+dt0);o.stop(t0+dt0+dur+0.02);
      });
    }
    const isOuter=!(TK[k]&&TK[k].dir<0);
    /* 支線は基準駅を汐見駅として、汐見方面＝上り／反対＝下り */
    const file=BRANCH?((TK[k]&&TK[k].dir<0)?'assets/audio/ann/approach_up.mp3':'assets/audio/ann/approach_down.mp3'):(isOuter?'assets/audio/ann/approach_outer.mp3':'assets/audio/ann/approach_inner.mp3');
    setTimeout(()=>{
      if(typeof listenerSealed==='function'&&listenerSealed())return;
      playRecordedAnn(file,0.75,getExtBus()||master);
    },450);
  }catch(e){}
}
function updHomeDoors(dt){
  const obsS = (typeof PAX !== 'undefined' && PAX) ? ((typeof RIDE !== 'undefined' && RIDE && RIDE.a) ? RIDE.a.s : (typeof W !== 'undefined' ? W.s : 0)) : ((typeof G !== 'undefined' && G && G.s != null) ? G.s : 0);
  for(const st of STATIONS){
    if(Math.abs(sdiff(obsS,st.s))<280){
      if(!PAX&&G.phase==='play'&&G.v>2&&serves(st,G.key)){const ds=TK[G.key].dir*sdiff(G.s,st.s+TK[G.key].so);if(ds>45&&ds<260)playApproachAnn(st,G.key);}
      for(const a of OT){if(a.state==='run'&&a.v>2&&a.key&&serves(st,a.key)){const ds=a.dir*sdiff(a.s,st.s+TK[a.key].so);if(ds>45&&ds<260)playApproachAnn(st,a.key);}}
      if(IS_ONLINE&&window.ONLINE_PLAYERS){
        for(const pid in ONLINE_PLAYERS){const p=ONLINE_PLAYERS[pid];if(!p||p.isPax||p.state!=='driving'||!p.key||(p.v||0)<=2||!serves(st,p.key))continue;
          const ps=p.smoothS!=null?p.smoothS:p.s;if(ps==null)continue;const ds=TK[p.key].dir*sdiff(ps,st.s+TK[p.key].so);if(ds>45&&ds<260)playApproachAnn(st,p.key);}
      }
    }
    if(!st.hd)continue;if(Math.abs(sdiff(obsS,st.s))>850)continue;
    for(const k in st.hd){const hd=st.hd[k];let f=0;
      const isSiding=k.length===2&&k[0]==='S',baseK=isSiding?k[1]:k,isShiomi=!BRANCH&&st.i===0;
      if(!isShiomi || !isSiding){
        for(const a of OT)if(a.key&&a.state==='dwell'&&(physKey(a.key,st.s)===baseK||platKey(st,a.key)===baseK)&&(a.stSt===st||Math.abs(sdiff(a.s,st.s+TK[a.key].so))<35)&&a.v<0.3&&Math.abs(sdiff(a.s,st.s+TK[a.key].so))<35)f=Math.max(f,a.frac);
      }
      if(!isShiomi || isSiding){
        if(!PAX && (physKey(G.key,st.s)===baseK||platKey(st,G.key)===baseK)&&(G.atStation!==null&&stOf(G.atStation)===st)&&G.v<0.3&&Math.abs(sdiff(G.s,st.s+TK[G.key].so))<35)f=Math.max(f,G.door.frac);
        if(IS_ONLINE && window.ONLINE_PLAYERS){
          const curLine = (typeof CFG !== 'undefined' && CFG) ? CFG.id : 'loop';
          const nowReal = Date.now();
          for(const pid in ONLINE_PLAYERS){
            const p = ONLINE_PLAYERS[pid];
            if(!p || p.isPax || p.state !== 'driving' || p.s == null || (p.v || 0) > 0.3) continue;
            if(p.lastSeen && (nowReal - p.lastSeen > 12000)) continue;
            if((p.line || 'loop') !== curLine) continue;
            if(!p.key || (physKey(p.key, st.s) !== baseK && platKey(st, p.key) !== baseK)) continue;
            const pPos = p.smoothS != null ? p.smoothS : p.s;
            const d = Math.abs(sdiff(pPos, st.s + (TK[p.key] ? TK[p.key].so : TK[baseK].so)));
            const isAtThisSt = (d < 35 && (p.v || 0) < 0.3);
            if(isAtThisSt && (p.door === 'open' || p.door === 'opening' || (p.doorFrac || 0) > 0.05)){
              const pf = p.doorFrac != null ? p.doorFrac : (p.door === 'open' ? 1.0 : 0.6);
              f = Math.max(f, pf);
            }
          }
        }
      }
      const tgt=Math.min(1,f*1.15);const cur=hd.frac<0?0:hd.frac,nf=cur+clamp(tgt-cur,-dt/2.2,dt/2.0);
      const was=hdPrev.get(hd)||0,dir=Math.sign(nf-cur);if(dir!==0&&was!==dir){playAt(offs(st.s-60,hd.line,1.5),d=>hdSnd(dir>0,d));}hdPrev.set(hd,dir||was&&0);
      const ns=(dir<0&&nf>0.03)?'closing':(nf>0.25||dir>0)?'open':'wait';
      const nearObs=Math.abs(sdiff(obsS,st.s))<460;
      if(nearObs && hd.lcdMeshes && hd.lcdMeshes.length){
        let slot=HD_LIVE_POOL.find(s=>s.hd===hd);
        if(!slot){
          slot=HD_LIVE_POOL.find(s=>!s.hd || Math.abs(sdiff(obsS,s.hd.st.s))>=460);
          if(slot){
            if(slot.hd && slot.hd!==hd){
              const prevHd=slot.hd;
              if(prevHd.lcdMeshes)for(const m of prevHd.lcdMeshes)m.material=HD_LCD_MATS[prevHd.lcdState||'wait'];
            }
            slot.hd=hd;slot.sig='';
          }
        }
        if(slot){
          for(const m of hd.lcdMeshes)if(m.material!==slot.mat)m.material=slot.mat;
          const nowT=nowMs(), nowR=Date.now();
          if(nowR-slot.lastDraw>180){
            slot.lastDraw=nowR;
            const hdKeys=KEYS.filter(kk=>serves(st,kk)&&(physKey(kk,st.s)===baseK||platKey(st,kk)===baseK));
            let isClosing=(ns==='closing');
            let dwellTrain=null, nextBest=null;
            const spdOf=kk=>BRANCH?(KIND[kk]==='rapid'?15:13):({local:15,rapid:19,ltd:24,exp:22})[KIND[kk]]||15;
            const countStopsBetween=(tS, kTrain)=>{
              const ddir=TK[kTrain].dir;
              let cnt=0;
              for(const s2 of STATIONS){
                if(s2===st || !serves(s2,kTrain))continue;
                const dFromTrain=ddir*sdiff(tS,s2.s+TK[kTrain].so);
                const dTrainToSt=ddir*sdiff(tS,st.s+TK[kTrain].so);
                if(dFromTrain>15 && dFromTrain<dTrainToSt-15)cnt++;
              }
              return Math.max(1,cnt+1);
            };
            const checkTrain=(tS,tV,tKey,isDwell,isClosingTrain,isOwn)=>{
              if(!isShiomi||!isSiding){if(isSiding && !isOwn)return;}
              if(isDwell){
                dwellTrain={key:tKey,closing:isClosingTrain};
                if(isClosingTrain)isClosing=true;
                return;
              }
              const D=TK[tKey].dir*sdiff(tS,st.s+TK[tKey].so);
              if(D>-30 && D<25000){
                const sec=D/spdOf(tKey)+(D>0?6:0);
                if(!nextBest || D<nextBest.D)nextBest={D,sec,key:tKey,s:tS,stops:countStopsBetween(tS,tKey)};
              }
            };
            if(!isShiomi || !isSiding){
              for(const a of OT){
                if(!a.key||a.state==='off'||!hdKeys.includes(a.key))continue;
                const atSt=(a.state==='dwell'&&(a.stSt===st||Math.abs(sdiff(a.s,st.s+TK[a.key].so))<35)&&a.v<0.35);
                const cl=atSt && ((a.t<9.5&&a.t>0)||(a.frac>0.05&&a.doors===0));
                checkTrain(a.s,a.v,a.key,atSt,cl,false);
              }
            }
            if(!isShiomi || isSiding){
              if(!PAX && G.phase==='play' && hdKeys.includes(G.key)){
                const atSt=(G.atStation!==null&&stOf(G.atStation)===st&&G.v<0.35);
                const cl=atSt && (!!G.promoOn || (typeof doorWarnOn==='function'&&doorWarnOn()) || G.door.state==='closing');
                checkTrain(G.s,G.v,G.key,atSt,cl,true);
              }
              if(IS_ONLINE && window.ONLINE_PLAYERS){
                const curLine=(typeof CFG!=='undefined'&&CFG)?CFG.id:'loop';
                for(const pid in ONLINE_PLAYERS){
                  const p=ONLINE_PLAYERS[pid];
                  if(!p||p.isPax||p.state!=='driving'||!p.key||!hdKeys.includes(p.key))continue;
                  if(p.lastSeen&&(nowR-p.lastSeen>12000))continue;
                  if((p.line||'loop')!==curLine)continue;
                  const pS=p.smoothS!=null?p.smoothS:p.s;if(pS==null)continue;
                  const atSt=(Math.abs(sdiff(pS,st.s+TK[p.key].so))<35&&(p.v||0)<0.35);
                  const cl=atSt && (p.door==='closing');
                  checkTrain(pS,p.v||0,p.key,atSt,cl,true);
                }
              }
            }
            const blinkOn=Math.floor(nowR/400)%2===0;
            if(isClosing){
              drawHdLcdLive(slot,'closing','ドアが閉まります','Doors Closing · ご注意ください',blinkOn?'#b91c1c':'#7f1d1d','#ef4444',true,blinkOn);
            }else if(dwellTrain || (nextBest && nextBest.D<95)){
              const tk=dwellTrain?dwellTrain.key:nextBest.key;
              const kd=KIND[tk]||'local';
              const ddir=TK[tk].dir;
              let nxtSt=null;
              if(BRANCH){
                const ni=st.i+ddir;
                if(ni>=0&&ni<NST)nxtSt=STATIONS[ni];
              }else{
                nxtSt=getAfterStopStation(st,ddir,kd);
              }
              const kLbl=(LK[kd]?LK[kd][0]:'普通');
              const tTitle=nxtSt?('次は '+nxtSt.name):'終点です';
              const tSub=nxtSt?(kLbl+' · Next Stop: '+enName(nxtSt)):(kLbl+' · Terminal');
              drawHdLcdLive(slot,'next',tTitle,tSub,'#092b1e','#22c55e',false,false);
            }else if(nextBest && nextBest.sec<=60){
              const lang=Math.floor(nowR/1200)%4;
              const msgs=[
                ['まもなく到着','Arriving Soon · まもなく列車がまいります'],
                ['Arriving Soon','まもなく到着 · Please stand back'],
                ['곧 도착합니다','まもなく到着 · Arriving Soon'],
                ['即将到站','まもなく到着 · Arriving Soon']
              ];
              drawHdLcdLive(slot,'soon',msgs[lang][0],msgs[lang][1],'#451a03','#f59e0b',true,lang%2===0);
            }else{
              let arrT=nowT+180000, stAway=3, kd='local';
              if(nextBest){
                arrT=nowT+nextBest.sec*1000;
                stAway=nextBest.stops;
                kd=KIND[nextBest.key]||'local';
              }else{
                let bestT=null,bestK=hdKeys[0]||'A';
                for(const kk of hdKeys){
                  if(!serves(st,kk))continue;
                  const h=hdwSec(kk);if(h>7200)continue;
                  const tt=(!BRANCH&&st.i===0&&SHIOMI_TT[kk])?nextShiomiDepMs(kk,nowT):(nowT+h*1000);
                  if(!bestT||tt<bestT){bestT=tt;bestK=kk;}
                }
                if(bestT){arrT=bestT;kd=KIND[bestK]||'local';stAway=Math.max(1,Math.round((bestT-nowT)/50000));}
              }
              const ph=Math.floor(nowR/2000)%2;
              const kLbl=(LK[kd]?LK[kd][0]:'普通');
              if(ph===0){
                drawHdLcdLive(slot,'wait_time','次列車 '+hms2(arrT)+' 到着',kLbl+' · Next Train Arrival','#0b1628','#38bdf8',false,false);
              }else{
                drawHdLcdLive(slot,'wait_dist','現在 '+stAway+'駅前にいます',kLbl+' · '+stAway+' station'+(stAway>1?'s':'')+' away ('+hms2(arrT)+')','#0b1628','#38bdf8',false,false);
              }
            }
          }
        }
      }else if(hd.lcdState!==ns){
        hd.lcdState=ns;
        if(hd.lcdMeshes)for(const m of hd.lcdMeshes)m.material=HD_LCD_MATS[ns];
      }
      if(hd.lcdState!==ns){
        hd.lcdState=ns;
        if(hd.lampMeshes)for(const m of hd.lampMeshes)m.material=HD_LAMP_MATS[ns];
      }
      setHD(hd,nf);}}
}
/* ===== 天候の演出（雨・雪・霧のパーティクル） ===== */
function initWeatherFx(){
  if(WXPTS||!(WX.id==='rain'||WX.id==='snow'||WX.id==='fog'))return;
  const n=WX.id==='rain'?1600:WX.id==='snow'?1300:480;
  const pos=new Float32Array(n*3);
  for(let i=0;i<n;i++){pos[i*3]=(Math.random()-0.5)*120;pos[i*3+1]=Math.random()*60;pos[i*3+2]=(Math.random()-0.5)*120;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({color:WX.id==='rain'?0xbcd6ef:0xffffff,size:WX.id==='rain'?0.16:WX.id==='snow'?0.3:0.9,transparent:true,opacity:WX.id==='fog'?0.16:0.72,depthWrite:false,sizeAttenuation:true});
  WXPTS=new THREE.Points(g,m);WXPTS.frustumCulled=false;WXPTS.renderOrder=5;scene.add(WXPTS);WXPOS=pos;
}
function updWeather(dt){
  initWeatherFx();if(!WXPTS)return;
  const p=WXPOS,n=p.length/3;camera.getWorldPosition(camW);
  const camS=mod((PAX?(PX.on&&PX.train?PX.train.s:W.s):(G.walkOn?W.s:G.s))||0,L);
  const inUg=camW.y<-2.2||inTunnel(camS)||(!PAX&&!G.walkOn&&!BRANCH&&(G.key==='G'||G.key==='H'))||(PAX&&PX.plats&&PX.plats[PX.pi]&&PX.plats[PX.pi].keys&&(PX.plats[PX.pi].keys.includes('G')||PX.plats[PX.pi].keys.includes('H')))||(W.on&&W.st&&W.st.under);
  if(inUg){WXPTS.visible=false;return;}
  WXPTS.visible=true;
  const p0=P(camS),p1=P(camS+1),nx=Math.cos(p0[2]),nz=Math.sin(p0[2]),tx0=p1[0]-p0[0],tz0=p1[1]-p0[1],tl=Math.hypot(tx0,tz0)||1,tx=tx0/tl,tz=tz0/tl;
  const activeRoofs=[];
  for(const st of STATIONS)if(st.roofs&&Math.abs(sdiff(camS,st.s))<260)for(const r of st.roofs)activeRoofs.push(r);
  if(DEPOT.n&&camS>DEPOT.a-80&&camS<DEPOT.b+120){
    for(const [sa,sb2,j0,j1] of [[DEPOT.a+40,DEPOT.a+260,0,7],[DEPOT.a+40,DEPOT.a+230,9,15],[DEPOT.a+300,DEPOT.a+470,18,25]]){
      activeRoofs.push({sc:(sa+sb2)/2,hs:(sb2-sa)/2,o0:-(DEPOT.base+j1*DEPOT.gap+3),o1:-(DEPOT.base+j0*DEPOT.gap-3),y0:0,y1:10.3});
    }
  }
  const activeCars=[];
  const collectCars=tr=>{if(!tr||!tr.cars)return;for(const car of tr.cars){const cx=car.position.x,cz=car.position.z;if(Math.abs(cx-camW.x)<75&&Math.abs(cz-camW.z)<75)activeCars.push({x:cx,y:car.position.y,z:cz,c:Math.cos(car.rotation.y),s:Math.sin(car.rotation.y)});}};
  if(typeof ownTrain!=='undefined')collectCars(ownTrain);
  if(typeof OT!=='undefined')for(const o of OT)if(o&&o.state!=='off'&&o.tr)collectCars(o.tr);
  if(window.ONLINE_PLAYERS)for(const pid in ONLINE_PLAYERS){const op=ONLINE_PLAYERS[pid];if(op&&op.tr)collectCars(op.tr);}
  const isCovered=(x,y,z)=>{
    const ddx=x-p0[0],ddz=z-p0[1],ps=mod(camS+ddx*tx+ddz*tz,L),pp=P(ps),po=(x-pp[0])*Math.cos(pp[2])+(z-pp[1])*Math.sin(pp[2]);
    if(inTunnel(ps)&&y<=Yat(ps)+7.4)return true;
    for(let r=0;r<activeRoofs.length;r++){const R=activeRoofs[r];if(Math.abs(sdiff(R.sc,ps))<=R.hs&&po>=R.o0&&po<=R.o1&&y>=R.y0&&y<=R.y1)return true;}
    for(let k=0;k<activeCars.length;k++){const C=activeCars[k],dyc=y-C.y;if(dyc<0||dyc>4.2)continue;const vx=x-C.x,vz=z-C.z;if(vx*vx+vz*vz>106)continue;const lx=vx*C.c-vz*C.s,lz=vx*C.s+vz*C.c;if(Math.abs(lx)<=1.65&&Math.abs(lz)<=10.1)return true;}
    return false;
  };
  const fall=(WX.id==='rain'?40:WX.id==='snow'?3.4:0.7)*dt,wob=WX.id==='snow'?Math.sin(performance.now()/700)*0.6*dt:0;
  for(let i=0;i<n;i++){p[i*3+1]-=fall;p[i*3]+=wob;
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2],dx=x-camW.x,dy=y-camW.y,dz=z-camW.z;
    if(y<camW.y-6||Math.abs(dx)>95||Math.abs(dz)>95||dx*dx+dy*dy+dz*dz<12||isCovered(x,y,z)){
      let rx=camW.x+(Math.random()-0.5)*115,ry=camW.y+rand(10,50),rz=camW.z+(Math.random()-0.5)*115;
      if(isCovered(rx,ry,rz))ry=camW.y+rand(22,55);
      p[i*3]=rx;p[i*3+1]=ry;p[i*3+2]=rz;}}
  WXPTS.geometry.attributes.position.needsUpdate=true;
  if(WX.id==='fog')WXPTS.material.opacity=0.13+0.05*Math.sin(performance.now()/2400);
}
function lineJa(){return ROUTES[G.route].name.replace('　','');}function boundFor(){
  if(G.list){const st=STATIONS[G.list[G.list.length-1]];return {ja:st.yomi+'行き',en:'bound for '+enName(st),jn:st.name+'行'};}
  const bigs=[],b0=G.atStation!==null?G.atStation+1:G.nv;for(let k=0;k<NST&&bigs.length<2;k++){const st=stOf(b0+k);if(st.big&&!bigs.includes(st))bigs.push(st);}
  return {ja:bigs.map(b=>b.yomi).join('、')+'方面',en:'for '+enList(bigs.map(enName)),jn:bigs.map(b=>b.name).join('・')+'方面'};}
function nextAnn(prefix){const st=stOf(G.nv),sd=localSide(st)<0?'左':'右',end=G.nv>=lastStop();
  const p=prefix||'次は、';
  return p+(end?'終点、':'')+st.yomi+'、'+st.yomi+'でございます。お出口は、'+sd+'側です。'+transferText(st);}
function nextAnnEn(prefix){const st=stOf(G.nv),end=G.nv>=lastStop(),sd=localSide(st)<0?'left':'right';
  if(prefix==='まもなく、')return 'We will soon make a brief stop at '+enName(st)+(end?', the last stop':'')+'. The doors on the '+sd+' side will open.'+transferEn(st);
  return 'The next station is '+enName(st)+(end?', the last stop':'')+'. The doors on the '+sd+' side will open.'+transferEn(st);}
function arriveAnn(st,end){st=st||stOf(G.nv);if(end===undefined)end=(G.nv>=lastStop());const sd=localSide(st)<0?'左':'右';
  if(end)return 'ご乗車ありがとうございました。終点、'+st.yomi+'、'+st.yomi+'でございます。お忘れ物のないよう、ご注意ください。'+transferText(st);
  return st.yomi+'、'+st.yomi+'でございます。ご乗車ありがとうございました。お忘れ物のないよう、ご注意ください。お出口は、'+sd+'側です。'+transferText(st);}
function arriveAnnEn(st,end){st=st||stOf(G.nv);if(end===undefined)end=(G.nv>=lastStop());const sd=localSide(st)<0?'left':'right';
  if(end)return 'Thank you for riding with us. This is '+enName(st)+', terminal. Please make sure you have all your belongings.'+transferEn(st);
  return 'This is '+enName(st)+', '+enName(st)+'. Thank you for riding with us. Please make sure you have all your belongings. The doors on the '+sd+' side will open.'+transferEn(st);}
/* four kinds of broadcast from the touch panel */
function broadcast(n,sys){if(G.phase!=='play')return;if(G.crew==='twoD'&&!sys){toast('ツーマン運転：放送は車掌が行います','warn');return;}initAudio();unlockSpeech();if(AC&&AC.state==='suspended'){try{AC.resume();}catch(e){}}chime();let tag='',soundKey=null;
  if(n===0){const stopped=G.atStation!==null||(G.depCheck!==null&&G.v===0);
    if(stopped){const leftSt=G.atStation!==null?stOf(G.atStation):stOf(G.nv);soundKey=guideKindFor(G.key,leftSt)||'lo';tag='案内放送';}
    else{soundKey='tab_manners';tag='車内マナー案内';}}
  else if(n===1){soundKey='tab_delay';tag='遅れのお詫び';}
  else if(n===2){soundKey='tab_wait';tag='しばらく停車';}
  else{soundKey='tab_depart';tag='まもなく発車';}
  toast('放送：'+tag,'info');setTimeout(()=>playGuide(soundKey),900);} /* チャイムの後に声 */
function turnaround(){
  const oldDir=G.dir,st0=STATIONS[G.list[G.list.length-1]];
  const nk={A:'B',B:'A',C:'D',D:'C',E:'F',F:'E',G:'H',H:'G'}[G.key]||'A';G.key=nk;G.mainKey=nk;G.dir=TK[nk].dir;G.list=G.list.slice().reverse();G.said={};G.asked=false;
  const st=STATIONS[G.list[0]]||st0;
  /* 電車をワープさせず、今の最後尾の先頭位置を新しい先頭位置にする */
  G.s=mod(G.s-oldDir*(carsFor(G.key)*CARL),L);
  G.v=0;G.atStation=0;G.nv=1;G.depCheck=null;G.lastDepSt=null;G.flowV=(G.flowV>=0?0:-1);G.depAt=G.s;
  G.route=Object.keys(SERVICES).find(id=>SERVICES[id].line===CFG.id&&SERVICES[id].key===nk&&SERVICES[id].kind==='branch')||(nk==='A'?'bu':'bd');
  ownTrain.flip=G.dir<0;ownTrain.lastFrac=-1;drawOwnDest();planFrom(nowMs()+20000);
  if(OWNAI&&OWNAI.insideSet)releaseInterior(OWNAI);ownTrain.cars.reverse();ownTrain.rev=!ownTrain.rev;relayoutLean(); /* 最後尾だった車両が先頭に */
  if(G.promoLoop)stopPromoLoop(false);G.promoOn=false;clearAutoMelTimers();G.autoMelOn=false;G.autoMelFired=false;G.autoMelBusy=false;
  /* ドアが開いていたら閉めずに維持し、運転士から見た左右(local)だけ新しい向きへ合わせる */
  const lsNew=localSide(st);
  if(G.door&&(G.door.state==='open'||G.door.state==='opening')){
    G.door.local=lsNew;G.door.side=lsNew*G.dir;setDoors(ownTrain,G.door.side,G.door.frac);
  }else{
    G.door={state:'closed',frac:0,side:-1,local:-1};G.flowPending=false;setDoors(ownTrain,G.door.side,0);
  }
  const b=boundFor();toast('折り返し → '+b.jn+'（発車メロディを鳴らして発車できます）','ok');setTimeout(()=>sayJE('折り返し、'+b.ja+'です。','This train is now '+b.en+'.'),300);
}
/* 手動運転（港見支線・手動切替）：マスコン・ブレーキ。停止信号の直前で止まらないとATSの非常ブレーキ */
function manualSafety(){const sg=G.sig;if(sg&&sg.asp==='R'&&sg.dist<6&&G.v>0.3&&G.mnotch>-8){G.mnotch=-8;toast('ATS 動作：非常ブレーキ（停止信号）','warn');beepATS();updMascon();return;}
  if(!PAX&&G.phase==='play'&&G.v>0.3&&G.mnotch>-8){
    for(const o of OT){
      if(!o||o.state==='off'||!o.key||!sameTrack(o,G.key,G.s,G.dir))continue;
      const dd=G.dir*sdiff(G.s,o.s)-(o.tr&&o.tr.cars?o.tr.cars.length:carsFor(o.key))*CARL;
      if(dd>0&&dd<110){G.mnotch=-8;toast('ATS 動作：先行列車接近のため非常ブレーキ','warn');beepATS();updMascon();return;}
    }
  }
  if(G.atStation!==null){G._tascToast=false;}
  else if(G.phase==='play'&&!PAX&&G.v>0){
    const d=stopDist(G.nv),v=G.v;
    if(d>30)G._tascToast=false;
    if(d>-2&&d<450){
      const reqD=(v*v)/(2*0.65);
      if((d<=reqD+3.0||(d<=0.5&&v>0.1))&&!(G.mnotch>0&&d<0)){
        if(d<=0.25&&v<0.35&&G.mnotch<=0){G.v=0;G.mnotch=-4;G.notch=-4;updMascon();if(!G._tascToast){G._tascToast=true;toast(stOf(G.nv).name+' 停止位置（自動ブレーキ停車）','ok');}return;}
        const areq=v*v/(2*Math.max(d-0.05,0.05))+9.8*trkSlope()*G.dir;
        const bn=-clamp(Math.round(areq/(1.15/8)+0.4),2,8);
        if(G.mnotch>bn){G.mnotch=bn;G.notch=bn;if(!G._tascToast){G._tascToast=true;toast('オーバーラン防止：自動ブレーキ作動中','warn');}}
      }else{G._tascToast=false;}
    }else{G._tascToast=false;}
  }
  const lim=(limitFor(G.key,G.s)||99);if(G.v*3.6>lim+5){if(!G.ovT||nowMs()-G.ovT>4000){G.ovT=nowMs();toast('速度超過（制限 '+lim+'km/h）','warn');}}updMascon();}
function beepATS(){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=880;g.gain.setValueAtTime(0.15,t);g.gain.setValueAtTime(0,t+0.6);o.connect(g);g.connect(master);o.start(t);o.stop(t+0.65);}
function setMNotch(n){if(!G.manual&&!G.manualOverride)return;if(n>0&&G.list&&G.nv>lastStop()){toast('終点です。ホームに出て、反対の先頭車両の運転室へ移動してください','warn');return;}G.mnotch=clamp(n,-8,5);if(G.door&&G.door.state!=='closed'&&G.mnotch>0){G.mnotch=0;toast('扉を閉めてから発車してください','warn');}updMascon();}
function updMascon(){const e=document.getElementById('mascon');if(!e)return;e.classList.toggle('hide',(!G.manual&&!G.manualOverride)||G.walkOn||G.lean||G.phase!=='play');const n=G.mnotch;
  const lb=document.getElementById('mcVal');if(lb){lb.textContent=n>0?'P'+n:n===0?'N':n===-8?'EB':'B'+(-n);lb.style.color=n>0?'#7fe3a0':n===0?'#fff':'#ff8a80';}
  const sp=document.getElementById('mcSpd');if(sp)sp.textContent=Math.round(G.v*3.6)+' km/h';}
function toggleATO(){
  if(G.phase!=='play')return;
  if(G.manual){toast('港見支線は手動運転です（マスコンで加速、ブレーキで減速）','info');return;}
  if(G.twoMan&&!G.condOK&&G.v<1&&(G.atStation!==null||G.depCheck!==null)&&!G.ato){toast('車掌からの合図がありません（ブザーを待ってください）','warn');return;}
  if(miniHold()&&!G.ato){toast('単線のため、対向列車の到着を待ってください（港前で行き違い）','warn');return;}
  if(G.lean&&G.crew!=='twoC'){toast('運転席に戻ってから発車してください','warn');return;}
  if(G.ato){G.ato=false;G.manualOverride=true;G.mnotch=clamp(G.notch||0,-8,5);updMascon();toast('ATO解除 → 手動運転（↑↓キー / マスコンで操作）','info');return;}
  if(G.door.state!=='closed'){toast('扉を閉めてからATOを押してください','warn');return;}
  if(G.walkOn){toast('ホームに出ている間は発車できません','warn');return;}
  if(G.waiting){toast('待ち合わせ中です（下の「待ち合わせを終わる」で終了）','warn');return;}
  if(G.list&&G.nv>lastStop()){toast('終点です。ホームに出て、反対の先頭車両の運転室へ移動してください','warn');return;}
  G.manualOverride=false;updMascon();
  G.ato=true;G.atoErr=BRANCH?(Math.random()<0.5?-1:1)*rand(0.3,1.3):0; /* 支線のATOは少しだけ精度が悪い */
  toast('ATO 出発 → '+stOf(G.nv).name,'ok');
}
/* 窓から顔を出す（支線）：停車中だけ。ここで乗降の確認・戸開／戸閉（ドア近くのスイッチ）・発車メロディ */
function toggleLean(side){if(!OWNOLD&&G.crew!=='twoC')return;if(G.lean){leanBack();return;}
  if(G.phase!=='play'||(G.v>0.05&&G.crew!=='twoC')||G.walkOn){toast(G.crew==='twoC'?'乗務員室で顔を出せます':'停車中に顔を出せます','warn');return;}
  G.lean=side;G.zoom=null;G.lookY=0;G.lookP=0;camera.layers.enable(1);camera.layers.disable(2);
  const lui=document.getElementById('leanUI');
  if(lui){
    const lt=lui.querySelector('.lt'),lb=document.getElementById('leanBackB');
    if(G.crew==='twoC'){if(lt)lt.textContent='窓から顔を出しています：ドラッグで見回し／上のボタンで操作';if(lb)lb.textContent='乗務員室に戻る';}
    else{if(lt)lt.textContent='窓から顔を出しています：すぐ横の操作箱のボタン（戸開・戸閉・メロディ）を押します／ドラッグで見回し';if(lb)lb.textContent='運転席に戻る';}
    lui.classList.remove('hide');
  }
  updLeanUI();if(G.crew==='twoC')updCondUI();toast((side<0?'左':'右')+'の窓から顔を出しました','info');}
function leanBack(){if(!G.lean)return;G.lean=0;G.lookY=0;G.lookP=0;camera.layers.disable(1);camera.layers.enable(2);document.getElementById('leanUI').classList.add('hide');if(G.crew==='twoC')updCondUI();}
function updLeanUI(){const D=G.door,open=(D.state==='open'||D.state==='opening')&&D.local===G.lean,blink=Math.floor(nowMs()/400)%2===0;
  const set=(act,lvl)=>{for(const sd of [-1,1]){const B=BTN[act+sd];if(B)B.mat.color.setHex(sd!==G.lean?0x9a9a9a:lvl===2?(blink?0xffffff:0xb0b0b0):lvl===1?0xffffff:0x777777);}};
  set('lnOpen',D.state==='closed'?1:0);set('lnClose',open&&!G.promoOn?1:open?1:0);set('lnMelo',G.promoOn?2:open?1:0);}
function nearMeloBox(){return OWNOLD&&G.walkOn&&!PAX&&W.st&&Math.abs(sdiff(W.s,G.s-G.dir*2))<9;}
/* ツーマン運転：車掌の仕事（運転士でプレイするときは自動の車掌） */
function buzzer(){if(!AC)return;const t=AC.currentTime;for(const [a,d] of [[0,0.55],[0.75,0.3]]){const o=AC.createOscillator();o.type='square';o.frequency.value=440;const g=AC.createGain();g.gain.setValueAtTime(0,t+a);g.gain.linearRampToValueAtTime(0.18,t+a+0.01);g.gain.setValueAtTime(0.18,t+a+d);g.gain.linearRampToValueAtTime(0,t+a+d+0.02);const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=1600;o.connect(f);f.connect(g);g.connect(master);o.start(t+a);o.stop(t+a+d+0.05);}}
function giveSignal(){if(G.condOK)return;G.condOK=true;buzzer();toast(G.crew==='twoC'?'運転士へ発車合図を送りました（ブー）':'車掌から発車合図（ブー）','ok');}
function updCrew(dt){if(G.phase!=='play'||!G.twoMan)return;const D=G.door;if(G.v>3)G.condOK=false;
  if(G.crew==='twoC'){updCondUI();return;}
  G.cT=(G.cT||0)+dt; /* 自動の車掌 */
  if(D.state==='closed'&&G.atStation===null&&G.depCheck===null&&G.v===0&&!G.ato){const d=stopDist(G.nv);if(d>-6.5&&d<17.9&&!sigStopped()){if(G.cPh!=='open'){G.cPh='open';G.cT=0;}if(G.cT>1.5){openDoor(localSide(stOf(G.nv)),true);G.cPh='';}}return;}
  if(D.state==='open'&&G.atStation!==null){
    const curSt=stOf(G.atStation);
    const isMajor=isMajorStation(curSt);
    G.cDw=(G.cDw||0)+dt;
    if(G.cMel==null) G.cMel=isMajor?rand(2.0,3.5):rand(0.5,1.2);
    if(!G.promoted[G.atStation]){if(G.cDw>=G.cMel){promote(defaultPromo(),true);G.cT=0;}return;}
    const busy=pending()||jamCount()>0,melT=G.promoLoop?(nowMs()-G.promoLoop.t0)/1000:0;
    const pDur=(G.promoLoop&&G.promoLoop.onePhraseDur)?G.promoLoop.onePhraseDur:8.0;
    /* v2.5.0：快特のツーマン乗務でドアを閉めるまでの待ちが長すぎるというご意見に対応。
       メロディ1回ぶん＋少しで戸閉し、乗降の滞留がなければ待たずに閉める */
    if(G.promoLoop){
      const targetMelT=isMajor?(pDur*1.15):(pDur*0.80);
      if((!busy&&melT>=targetMelT)||melT>(isMajor?26:11)||G.cDw>(isMajor?40:18)){promote(defaultPromo(),true);G.cT=0;}
      return;
    }
    if(G.promoOn){G.cT=0;return;}if(busy&&G.cDw<40){G.cT=0;return;}
    const closeDelay=isMajor?1.4:0.9;
    if(G.cT>closeDelay&&!G.closeWait){closeDoor(D.local,true);G.cT=0;}return;}
  if(D.state!=='open')G.cMel=null;
  if(D.state!=='open')G.cDw=0;
  if(D.state==='closed'&&G.depCheck!==null&&!G.condOK&&G.v===0){if(G.cPh!=='sig'){G.cPh='sig';G.cT=0;}if(G.cT>1.4){giveSignal();G.cPh='';}}}
/* 車掌でプレイ：最後尾の乗務員室に立つ。ボタン */
function condBoxS(){return G.s-G.dir*(carsFor(G.key)*CARL-6);}
function nearCondBox(){return G.crew==='twoC'&&G.walkOn&&W.st&&Math.abs(sdiff(W.s,condBoxS()))<9;}
function updCondUI(){const ui=document.getElementById('condUI');if(!ui)return;ui.classList.toggle('hide',G.crew!=='twoC'||G.phase!=='play');if(G.crew!=='twoC')return;
  const D=G.door,b=id=>document.getElementById(id),open=D.state==='open'||D.state==='opening',stn=G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv,d=stopDist(G.nv);
  const atStop=G.v===0&&!sigStopped()&&(G.atStation!==null||G.depCheck!==null||(d>-6.5&&d<17.9));
  const vis=(id,on)=>{const e=b(id);if(e)e.style.display=on?'':'none';};
  vis('cExit',(!G.walkOn||G.walkArea==='train')&&canExit()&&!G.lean);vis('cSal',(!G.walkOn||(G.walkOn&&G.walkArea!=='train'))&&!G.lean);vis('cLean',!G.walkOn&&(G.crew==='twoC'||G.v<=0.05));vis('cMic',true);vis('cAnn',true);vis('cItv',true);vis('cStaf',true);vis('cView',true);
  vis('cOpen',atStop&&D.state==='closed'&&!(G.depCheck!==null&&G.condOK));vis('cClose',open);vis('cMelo',open&&(nearCondBox()||G.walkArea==='train'||!G.walkOn));vis('cPromo',open);
  vis('cSig',!G.walkOn&&D.state==='closed'&&G.depCheck!==null&&!G.condOK&&G.v===0);
  const cm=b('cMic');if(cm){if(window.__CREW_MIC&&window.__CREW_MIC.on){cm.textContent=window.__CREW_MIC.mode==='out'?'📣 車外放送中':'📢 車内放送中';cm.style.background='#dc2626';}else{cm.textContent='🎤 マイク';cm.style.background='#0e7490';}}
  const cl=b('cLean');if(cl)cl.textContent=G.lean?'🪟 室内に戻る':'🪟 窓から顔を出す';
  const sp=b('crewStafPanel');if(sp&&!sp.classList.contains('hide'))drawCrewStaf();
  const cs=b('cSal');if(cs)cs.textContent=(G.walkOn&&G.walkArea==='train')?'🚪 乗務員室へ':'🚶 車内を歩く';
  const cv=b('cView');if(cv)cv.textContent=AV3P?'👁️ 三人称':'👁️ 一人称';
  const m=b('cMelo');if(m)m.textContent=G.promoOn?'再生中…':'発車メロディ';const h=b('cHint');
  if(h)h.textContent=G.lean?'窓から顔を出して確認中（ドラッグで見回し）':G.walkOn?(G.walkArea==='train'?('車内巡回中（'+(G.walkCar+1)+'号車）'):(open?(nearCondBox()?'メロディのボタンの前です':'ホーム確認中（ITVモニタも使えます）'):'ドアを開けてください')):(G.v>0.5?'乗務中（「車内を歩く」ボタンで車内を歩けます）':open?'ホームや車内・ITVモニタで確認して戸閉→合図':G.depCheck!==null&&!G.condOK?'ドアを閉めたら運転士へ合図を送ります':'停車したらホームに出るかITVモニタを確認して戸開');}
let _lastCrewStafKey='';
function drawCrewStaf(force){
  const panel=document.getElementById('crewStafPanel'),meta=document.getElementById('crewStafMeta'),body=document.getElementById('crewStafBody');
  if(!panel||!meta||!body||G.crew!=='twoC'||G.phase!=='play')return;
  const curV=(G.atStation!==null?G.atStation:G.nv);
  const stopFlag=G.atStation!==null?'S':(G.depCheck!==null?'D':'R');
  const dName=(G.list&&G.list.length)?stOf(G.list[G.list.length-1]).name:(G.cyc&&G.cyc.length?STATIONS[G.cyc[G.cyc.length-1]].name:'');
  const key=G.route+'|'+G.key+'|'+G.dir+'|'+curV+'|'+stopFlag+'|'+dName;
  if(!force&&key===_lastCrewStafKey)return;
  _lastCrewStafKey=key;
  const rName=(typeof ROUTES!=='undefined'&&ROUTES[G.route])?ROUTES[G.route].name:'汐見環状線';
  const dirLabel=BRANCH?'':(G.dir<0?'（内回り）':'（外回り）');
  const maxSpd=(typeof KIND!=='undefined'&&KIND[G.key]==='exp')?210:(KIND[G.key]==='ltd'?150:(KIND[G.key]==='rapid'?120:(BRANCH?85:100)));
  const curSt=stOf(curV);
  meta.innerHTML='<div>路線・種別：'+escapeHtml(rName+dirLabel)+'　／　行先：'+escapeHtml(dName||'―')+'行</div>'
    +'<div>最高速度：'+maxSpd+' km/h　／　'+(G.atStation!==null?'停車中：':'次駅：')+'<span style="color:#b91c1c;">'+escapeHtml(curSt?curSt.name:'―')+'</span></div>';
  const startV=Math.max(0,curV-1);
  const endV=G.list?Math.min(G.list.length-1,curV+25):(curV+20);
  let html='';
  for(let v=startV;v<=endV;v++){
    if(G.list&&v>lastStop())break;
    const st=stOf(v);if(!st)break;
    const pl=G.plan?G.plan[v]:null;
    const arr=pl?hms2(pl.arr):'―';
    const dep=(pl&&pl.dep)?hms2(pl.dep):(pl&&v!==lastStop()?hms2(pl.arr+30000):'―');
    const isCur=(v===curV),isPast=(v<curV);
    const bg=isCur?'#dbeafe':(v%2?'#f1f5f9':'#faf8f0');
    const col=isPast?'#64748b':(isCur?'#1d4ed8':'#0f172a');
    const mark=isCur?(G.atStation!==null?'▶ ':'→ '):'';
    html+='<div style="display:grid;grid-template-columns:1fr 68px 68px;padding:6px 12px;border-bottom:1px solid #e2e8f0;background:'+bg+';color:'+col+';font-weight:'+(isCur?'800':(st.big?'700':'500'))+';">'
      +'<div>'+mark+escapeHtml(st.name)+(st.big?' ★':'')+'</div>'
      +'<div style="text-align:right;font-variant-numeric:tabular-nums;">'+arr+'</div>'
      +'<div style="text-align:right;font-variant-numeric:tabular-nums;">'+dep+'</div></div>';
  }
  if(!html)html='<div style="padding:12px;color:#64748b;text-align:center;">行路データがありません</div>';
  body.innerHTML=html;
}
/* 停止信号で止まっている（駅の停止位置より手前）か */
function sigStopped(){if(G.atStation!==null||G.depCheck!==null||G.v>0.3)return false;const d=stopDist(G.nv);return !!(G.sig&&G.sig.asp==='R'&&G.sig.dist<90&&d>2.5);}
function shouldAutoNextAnn(){
  if(typeof G === 'undefined' || !G) return false;
  // 完全オート時はデフォルトで自動次駅放送をオン（設定画面で手動OFFにされていない限り有効）
  if(G.auto){
    return (G.autoAnn !== false);
  }
  return !!G.autoAnn;
}
function toggleAuto(){
  if(G.crew==='twoC'){toast('車掌乗務中は運転士が運転します','info');return;}
  if(BRANCH){toast('支線の電車に完全オートはありません','warn');return;}
  G.auto=!G.auto;G.autoPh='';G.autoT=0;
  toast(G.auto?'完全オート ON':'完全オート OFF',G.auto?'ok':'warn',G.auto?'完全オート、開始。':'完全オート、解除。');
  if(G.auto && G.tabNextAnn && G.phase==='play' && shouldAutoNextAnn()){
    setTimeout(()=>{
      if(G.auto && G.tabNextAnn && G.phase==='play'){
        triggerNextStationAnnounce(G.tabAnnMode || 'next');
        G.tabNextAnn = false;
        if(typeof drawPanel==='function') drawPanel();
      }
    }, 600);
  }
}
let annAudio = null;
let annWebSrc = null;
let annSeqToken = 0;
let annSeqTimer = null;
const annBufCache = new Map();
const annLoadPromises = new Map();
const annTrimCache = new Map();
/* v1.9.7：放送は「最後まで流してから次へ」。待ちは最新の1本だけ保持（途中で切らない） */
let annQ = [];
let annPlaying = false;
const annMergeCache = new Map();
const ANN_MERGE_MAX = 24;
const ANN_TARGET_RMS = 0.055;   /* パーツ間の音量をそろえる目標値 */
const CITYLINE_PART_IDX={'朱雀線':0,'高原線':1,'地下鉄みどり線':2,'湾岸線':3,'蒼海線':4,'北嶺線':5,'みなと線':6,'白浜線':7,'港見支線':8,'翠湖線':9,'丘陽線':10,'地下鉄こだま線':11,'湖畔線':12,'東都線':13,'丘陵線':14,'地下鉄あおば線':15,'臨海線':16,'白峰支線':17,'峰越線':18,'地下鉄ひばり線':19,'北原線':20,'金波線':21,'海峡線':22,'東雲線':23,'地下鉄ひかり線':24,'黎明線':25,'地下鉄あかつき線':26,'東海岸線':27,'西谷線':28,'紫雲地下線':29,'空港線':30,'西岳線':31,'地下鉄つばさ線':32,'碧浜線':33,'臨港線':34,'地下鉄しおかぜ線':35,'浜手線':36,'天宮高架線':37,'南山線':38,'地下鉄すばる線':39,'空港快速線':40};
function stopStationAnnounce(){
  annSeqToken++;
  annQ.length = 0; annPlaying = false;
  if(annSeqTimer){ clearTimeout(annSeqTimer); annSeqTimer = null; }
  if(annWebSrc){
    try { annWebSrc.onended = null; annWebSrc.stop(); } catch(e){}
    annWebSrc = null;
  }
  if(annAudio){
    try { annAudio.onended = null; annAudio.pause(); annAudio.currentTime = 0; } catch(e){}
    annAudio = null;
  }
  if(master && AC && !_adWebSrc && !_adAudio){
    try { master.gain.setTargetAtTime(9.5, AC.currentTime, 0.15); } catch(_){}
  }
}
function getAnnTrimBounds(url, buf){
  if(annTrimCache.has(url)) return annTrimCache.get(url);
  const sr=buf.sampleRate||44100, len=buf.length|0, nc=buf.numberOfChannels||1;
  const chs=[];
  for(let c=0;c<nc;c++) chs.push(buf.getChannelData(c));
  /* v1.9.7：無音のしきい値を「この音声自身のピーク」に対する相対値にした。
     固定値（0.006）だと、小さめに録れた語頭の子音・母音の入りが切れて「途切れた」ように聞こえていた */
  let peak=0;
  for(let c=0;c<nc;c++){ const d=chs[c]; for(let i=0;i<len;i+=2){ const v=d[i]<0?-d[i]:d[i]; if(v>peak) peak=v; } }
  const thr=Math.max(0.0015, peak*0.018);
  let first=-1, last=-1;
  for(let i=0;i<len;i++){
    let mx=0;
    for(let c=0;c<nc;c++){ const v=Math.abs(chs[c][i]); if(v>mx) mx=v; }
    if(mx>=thr){ first=i; break; }
  }
  for(let i=len-1;i>=0;i--){
    let mx=0;
    for(let c=0;c<nc;c++){ const v=Math.abs(chs[c][i]); if(v>mx) mx=v; }
    if(mx>=thr){ last=i; break; }
  }
  const padPre=Math.round(sr*0.012), padPost=Math.round(sr*0.018);
  let res;
  if(first<0||last<=first){
    res={start:0, end:len, peak, rms:0};
  }else{
    const s=Math.max(0, first-padPre), e=Math.min(len, last+padPost);
    res=(e>s)?{start:s, end:e}:{start:0, end:len};
    res.peak=peak;
  }
  /* 区間内のRMS（パーツごとの音量合わせ用） */
  { let sum=0,n=0; const a=res.start, b=res.end;
    for(let i=a;i<b;i+=2){ let mx=0; for(let c=0;c<nc;c++){ const v=chs[c][i]; if(v>mx) mx=v; } sum+=mx*mx; n++; }
    res.rms=Math.sqrt(sum/Math.max(1,n)); }
  annTrimCache.set(url, res);
  return res;
}
function loadAnnBuffer(url){
  if(annBufCache.has(url)) return Promise.resolve(annBufCache.get(url));
  if(annLoadPromises.has(url)) return annLoadPromises.get(url);
  const p=fetch(url).then(r=>{
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.arrayBuffer();
  }).then(b=>AC.decodeAudioData(b)).then(buf=>{
    annBufCache.set(url, buf);
    getAnnTrimBounds(url, buf);
    annLoadPromises.delete(url);
    return buf;
  }).catch(err=>{
    annLoadPromises.delete(url);
    throw err;
  });
  annLoadPromises.set(url, p);
  return p;
}
function preloadAnnUrls(urls){
  if(!AC||!urls||!urls.length) return;
  const seen=new Set();
  for(let i=0;i<urls.length;i++){
    const u=urls[i];
    if(u&&!seen.has(u)){ seen.add(u); loadAnnBuffer(u).catch(()=>{}); }
  }
}
function annLangOf(fname){
  if(!fname) return 'ja';
  if(fname.startsWith('ainu_')) return 'ainu';
  if(fname.startsWith('oki_')) return 'oki';
  if(fname.startsWith('en_')||fname.startsWith('st_en_')||fname.includes('_en_')) return 'en';
  if(fname.startsWith('ko_')||fname.startsWith('st_ko_')) return 'ko';
  if(fname.startsWith('zh_')||fname.startsWith('st_zh_')) return 'zh';
  if(fname.startsWith('de_')||fname.startsWith('st_de_')) return 'de';
  if(fname.startsWith('fr_')||fname.startsWith('st_fr_')) return 'fr';
  if(fname.startsWith('pt_')||fname.startsWith('st_pt_')) return 'pt';
  return 'ja';
}
const ANN_SENTENCE_END=new Set([
  'ja_desu.mp3','ja_homen_desu.mp3','ja_deguchi_l.mp3','ja_deguchi_r.mp3',
  'ja_ni_teisha.mp3','ja_ni_teisha_itashimasu.mp3','ja_ltd_degozaimasu.mp3',
  'ja_ltd_arr_prep.mp3','ja_norikae_intro.mp3','ja_thanks.mp3','ja_loop_welcome.mp3',
  'ja_ltd_dep_intro.mp3','ja_ltd_arr_intro.mp3','ainu_dep_end.mp3','ainu_arr_end.mp3','oki_dep_end.mp3','oki_arr_end.mp3',
  'ko_desu.mp3','ko_arr_end.mp3','ko_exit_l.mp3','ko_exit_r.mp3',
  'zh_exit_l.mp3','zh_exit_r.mp3','en_exit_l.mp3','en_exit_r.mp3',
  'en_outer_rapid.mp3','en_outer_local.mp3','en_inner_rapid.mp3','en_inner_local.mp3'
]);
const ANN_COMMA_PAUSE=new Set([
  'ja_tsugiwa.mp3','ja_mamonaku.mp3','ja_konodensha.mp3',
  'en_next.mp3','en_arr.mp3','en_after.mp3'
]);
function getAnnGapSec(prevUrl, nextUrl){
  const p=(prevUrl||'').split('/').pop();
  const n=(nextUrl||'').split('/').pop();
  if(!p||!n) return 0;
  if(p===n) return 0.12;
  if(p==='ainu_dep_intro.mp3'||p==='ainu_arr_intro.mp3'||p==='oki_dep_intro.mp3'||p==='oki_arr_intro.mp3') return 0.0;
  if(n==='ainu_dep_end.mp3'||n==='ainu_arr_end.mp3'||n==='oki_dep_end.mp3'||n==='oki_arr_end.mp3') return -0.015;
  const lp=annLangOf(p), ln=annLangOf(n);
  if(lp!==ln){
    if(lp==='ja') return 0.75;
    return 0.45;
  }
  if(ANN_SENTENCE_END.has(p)||p.startsWith('ja_m_')) return 0.17;
  if(ANN_COMMA_PAUSE.has(p)) return 0.025;
  return -0.024;
}
function buildMergedAnnBuffer(items){
  if(!AC||!items.length) return null;
  const sr=AC.sampleRate||44100;
  let maxCh=1;
  const segs=[];
  for(let i=0;i<items.length;i++){
    const {url, buf}=items[i];
    if(!buf||!buf.length) continue;
    const tb=getAnnTrimBounds(url, buf);
    const len=tb.end-tb.start;
    if(len<=0) continue;
    if(buf.numberOfChannels>maxCh) maxCh=buf.numberOfChannels;
    const bSr=buf.sampleRate||sr;
    const outLen=Math.max(1, Math.round(len*(sr/bSr)));
    /* v1.9.7：パーツごとの録音レベルをそろえる（声の大きさが急に変わらない） */
    let gain=1;
    if(tb.rms>1e-4) gain=clamp(ANN_TARGET_RMS/tb.rms,0.7,1.7);
    segs.push({url, buf, tb, outLen, ratio:bSr/sr, gain});
  }
  if(!segs.length) return null;
  let cursor=0;
  const placements=[];
  for(let i=0;i<segs.length;i++){
    if(i>0){
      const gapSec=getAnnGapSec(segs[i-1].url, segs[i].url);
      cursor=Math.max(0, cursor+Math.round(gapSec*sr));
    }
    placements.push({seg:segs[i], offset:cursor});
    cursor+=segs[i].outLen;
  }
  /* 継ぎ目の重なり量（前のパーツと重なるサンプル数）を求める */
  for(let i=1;i<placements.length;i++){
    const prev=placements[i-1], cur=placements[i];
    const ov=Math.max(0, Math.min(prev.offset+prev.seg.outLen-cur.offset, Math.min(cur.seg.outLen, Math.round(sr*0.04))));
    cur.ovIn=ov; prev.ovOut=Math.max(prev.ovOut||0, ov);
  }
  const totalLen=Math.max(1, cursor+Math.round(sr*0.03));
  const outBuf=AC.createBuffer(maxCh, totalLen, sr);
  for(let c=0;c<maxCh;c++){
    const dst=outBuf.getChannelData(c);
    for(let pIdx=0;pIdx<placements.length;pIdx++){
      const {seg, offset}=placements[pIdx];
      const srcCh=seg.buf.getChannelData(Math.min(c, seg.buf.numberOfChannels-1));
      const n=seg.outLen, st=seg.tb.start, r=seg.ratio, g=seg.gain;
      const ovIn=placements[pIdx].ovIn||0, ovOut=placements[pIdx].ovOut||0;
      const fIn=Math.min(Math.max(1,Math.round(sr*0.004)), Math.floor(n/6));
      const fOut=Math.min(Math.max(1,Math.round(sr*0.006)), Math.floor(n/6));
      for(let j=0;j<n;j++){
        const pos=st+j*r;
        const idx0=pos|0;
        const frac=pos-idx0;
        const s0=srcCh[idx0]||0;
        const s1=srcCh[Math.min(idx0+1, seg.buf.length-1)]||s0;
        let v=(s0+(s1-s0)*frac)*g;
        /* 継ぎ目：重なっている区間は等パワーでクロスフェード（音量が落ちない・プツッと切れない） */
        if(ovIn>0&&j<ovIn) v*=Math.sin(((j+0.5)/ovIn)*Math.PI/2);
        else if(j<fIn) v*=(j+0.5)/fIn;
        if(ovOut>0&&j>=n-ovOut) v*=Math.cos(((j-(n-ovOut)+0.5)/ovOut)*Math.PI/2);
        else if(j>=n-fOut) v*=Math.max(0,(n-1-j)/fOut);
        const di=offset+j;
        if(di>=0&&di<totalLen) dst[di]+=v;
      }
    }
    /* ソフトリミッタ（硬クリップの「バチッ」を出さない） */
    for(let k=0;k<totalLen;k++){
      const v=dst[k];
      if(v>0.95||v<-0.95){const a=(v<0?-v:v)-0.95;const sg=v<0?-1:1;dst[k]=sg*(0.95+(1-Math.exp(-a*5))*0.05);}
    }
  }
  return outBuf;
}
function playDispatchAnn(file){
  try{
    if(!file||!AC) return;
    loadAnnBuffer(file).then(buf=>{
      if(!window.__DISPANN) window.__DISPANN={src:null};
      const s=AC.createBufferSource(), g=AC.createGain();
      g.gain.value=0.9; s.buffer=buf; s.connect(g); g.connect(AC.destination);
      if(window.__DISPANN.src){ try{window.__DISPANN.src.stop();}catch(e){} }
      window.__DISPANN.src=s; s.onended=()=>{ if(window.__DISPANN.src===s) window.__DISPANN.src=null; }; s.start(0);
    }).catch(()=>{});
  }catch(e){}
}
function annCacheKey(urls){ return urls.join('|'); }
function annCacheGet(k){ const v=annMergeCache.get(k); if(v){ annMergeCache.delete(k); annMergeCache.set(k,v); } return v; }
function annCacheSet(k,v){ annMergeCache.set(k,v); while(annMergeCache.size>ANN_MERGE_MAX){ const f=annMergeCache.keys().next().value; annMergeCache.delete(f); } }
/* v1.9.7：放送を「事前に結合しておく」。駅に近づいた時点で作っておくので、鳴らす瞬間に継ぎ目を組み立てない＝途切れない */
function prepareAnnBuffer(urls){
  if(!AC||!urls||!urls.length) return Promise.resolve(null);
  const key=annCacheKey(urls); const hit=annCacheGet(key); if(hit) return Promise.resolve(hit);
  return Promise.all(urls.map(u=>loadAnnBuffer(u).then(buf=>({url:u,buf})).catch(()=>null))).then(res=>{
    const items=res.filter(Boolean);
    if(items.length<urls.length) console.warn('ann parts missing', urls.length-items.length);
    const merged=buildMergedAnnBuffer(items);
    if(merged) annCacheSet(key,merged);
    return merged;
  }).catch(()=>null);
}
function playAnnQueue(urls){
  if(!urls||!urls.length||(typeof G!=='undefined'&&G.sound===false))return;
  try{ initAudio(); }catch(e){}
  /* v1.9.7：鳴っている放送は最後まで流し、次の要求は待ちに入れる（途中で切って繋ぐのをやめた） */
  annQ=[urls.slice()];
  if(annPlaying) return;
  annPump();
}
function annPump(){
  if(annPlaying) return;
  const urls=annQ.shift();
  if(!urls){
    if(master&&AC&&!_adWebSrc&&!_adAudio)try{master.gain.setTargetAtTime(9.5,AC.currentTime,0.2);}catch(_){}
    return;
  }
  annPlaying=true;
  const tok=++annSeqToken;
  const done=()=>{ if(tok===annSeqToken){annPlaying=false; if(annQ.length) annPump(); else if(master&&AC&&!_adWebSrc&&!_adAudio)try{master.gain.setTargetAtTime(9.5,AC.currentTime,0.25);}catch(_){} } };
  try{
    if(!AC){ annPlaying=false; return; }
    if(AC.state==='suspended'){try{AC.resume();}catch(_){}}
    if(master){try{master.gain.setTargetAtTime(4.5,AC.currentTime,0.08);}catch(_){}}
    const key=annCacheKey(urls);
    const merged0=annCacheGet(key);
    const ready=merged0?Promise.resolve(merged0):prepareAnnBuffer(urls);
    ready.then(merged=>{
      if(tok!==annSeqToken||G.phase!=='play'||(typeof G!=='undefined'&&G.sound===false)){ done(); return; }
      if(!merged){ annWebSrc=null; done(); return; }
      const s=AC.createBufferSource(), g=AC.createGain();
      g.gain.value=1.35;
      s.buffer=merged;
      s.connect(g);
      g.connect(AC.destination);
      annWebSrc=s;
      s.onended=()=>{ if(annWebSrc===s) annWebSrc=null; done(); };
      s.start(0);
    }).catch(()=>{ done(); });
  }catch(e){ console.warn('playAnnQueue error',e); annPlaying=false; }
}
function stPartJa(st){
  if(!st)return '';
  if(!BRANCH)return 'assets/audio/ann/parts/st_ja_'+st.i+'.mp3';
  const p=LINE_ID==='branch2'?'b2':LINE_ID==='branch3'?'b3':LINE_ID==='branch4'?'b4':LINE_ID==='branch5'?'b5':'b1';
  return 'assets/audio/ann/parts/st_'+p+'_ja_'+st.i+'.mp3';
}
function stPartEn(st){
  if(!st)return '';
  if(!BRANCH)return 'assets/audio/ann/parts/st_en_'+st.i+'.mp3';
  const p=LINE_ID==='branch2'?'b2':LINE_ID==='branch3'?'b3':LINE_ID==='branch4'?'b4':LINE_ID==='branch5'?'b5':'b1';
  return 'assets/audio/ann/parts/st_'+p+'_en_'+st.i+'.mp3';
}
function getAheadMajorStations(curIdx, dir, kind, count){
  const res=[];
  const step=dir>0?1:-1;
  for(let k=1;k<=NST&&res.length<count;k++){
    const idx=mod(curIdx+step*k,NST);
    const s=STATIONS[idx];
    if(s&&isMajorStation(s))res.push(s);
  }
  return res;
}
function getAfterStopStation(st, dir, kind){
  const step=dir>0?1:-1;
  for(let k=1;k<NST;k++){
    const idx=mod(st.i+step*k,NST);
    const s=STATIONS[idx];
    if(!s)continue;
    if(kind==='ltd'&&(s.cls==='M'||s.cls==='X'))return s;
    if(kind==='rapid'&&s.cls!=='L')return s;
    if(kind==='local'||BRANCH)return s;
  }
  return STATIONS[mod(st.i+step,NST)];
}
function getTransferPartsAndText(st){
  const lines=st&&st.lines?st.lines:null;
  if(!lines||!lines.length)return {parts:[],text:''};
  const parts=['assets/audio/ann/parts/ja_norikae_intro.mp3'];
  const texts=['お乗り換えのご案内を申し上げます。'];
  const baseMs=nowMs();
  const dirPairs=[['上り方面',0],['下り方面',1]];
  lines.forEach((ln,li)=>{
    const lname=ln[0];
    const lidx=CITYLINE_PART_IDX[lname];
    if(lidx==null)return;
    dirPairs.forEach(([dlabel,didx],di)=>{
      const depMs=baseMs+((li*2+di)*3+2)*60000;
      const dt=new Date(depMs);
      const hh=dt.getHours(),mm=dt.getMinutes();
      parts.push(
        'assets/audio/ann/parts/ja_kondo_no.mp3',
        'assets/audio/ann/parts/line_ja_'+lidx+'.mp3',
        'assets/audio/ann/parts/ja_wa.mp3',
        'assets/audio/ann/parts/dir_ja_'+didx+'.mp3',
        'assets/audio/ann/parts/ja_homen_ga.mp3',
        'assets/audio/ann/parts/ja_h_'+hh+'.mp3',
        'assets/audio/ann/parts/ja_m_'+mm+'.mp3'
      );
      texts.push('今度の'+lname+'は'+dlabel+'が'+hh+'時'+mm+'分発です。');
    });
  });
  return {parts,text:texts.join('')};
}
function buildAnnouncementData(st, mode){
  const P='assets/audio/ann/parts/';
  const isSoon=(mode==='soon');
  const isRide=!!(PAX&&RIDE&&RIDE.a);
  const dir=isRide?(RIDE.a.dir||1):((typeof G!=='undefined'&&G)?G.dir:1);
  const key=isRide?(RIDE.a.key||'A'):((typeof G!=='undefined'&&G&&G.key)?G.key:'A');
  const kind=KIND[key]||'local';
  const isOuter=dir>0;
  const sideIsLeft=isRide?(TK[key].side(st)*dir<0):(localSide(st)<0);
  const nextAfter=getAfterStopStation(st,dir,kind);
  const majorsAhead=getAheadMajorStations(st.i,dir,kind,3);
  const isMajor=isMajorStation(st);
  const isLtdStop=!BRANCH&&st.cls==='X'&&!isMajor;
  const parts=[];
  let text='';

  if(kind==='exp'&&!BRANCH){
    if(!isSoon){
      parts.push(
        P+'ja_thanks.mp3',
        P+(isOuter?'ja_outer.mp3':'ja_inner.mp3'),
        P+'ja_exp.mp3',
        P+'ja_desu.mp3',
        P+'ja_tsugiwa.mp3', stPartJa(st), P+'ja_ni_teisha.mp3',
        P+'en_exp.mp3', P+'en_next.mp3', stPartEn(st)
      );
      text='ご利用いただきありがとうございます。'+(isOuter?'外回り':'内回り')+'特急です。次は、'+st.name+'に停車します。（英語）';
    }else{
      parts.push(
        P+'ja_mamonaku.mp3', stPartJa(st), P+'ja_desu.mp3',
        P+(sideIsLeft?'ja_deguchi_l.mp3':'ja_deguchi_r.mp3'),
        stPartJa(st), P+'ja_no_tsugiwa.mp3', stPartJa(nextAfter), P+'ja_ni_teisha.mp3',
        P+'en_arr.mp3', stPartEn(st), P+(sideIsLeft?'en_exit_l.mp3':'en_exit_r.mp3'), P+'en_after.mp3', stPartEn(nextAfter)
      );
      text='まもなく、'+st.name+'です。出口は'+(sideIsLeft?'左':'右')+'側です。'+st.name+'の次は'+nextAfter.name+'に停車します。（英語）';
    }
    return {parts,text,isLtd:false};
  }

  if(kind==='ltd'&&!BRANCH){
    const destSt=majorsAhead[0]||nextAfter;
    if(!isSoon){
      parts.push(
        P+'ja_ltd_dep_intro.mp3',
        P+(isOuter?'ja_ltd_outer.mp3':'ja_ltd_inner.mp3'),
        stPartJa(destSt),
        P+'ja_ltd_homen_iki.mp3',
        P+'ja_ltd_next_stop.mp3',
        stPartJa(st),
        P+'ja_ltd_degozaimasu.mp3',
        P+'ainu_dep_intro.mp3', stPartJa(st), P+'ainu_dep_end.mp3',
        P+'oki_dep_intro.mp3', stPartJa(st), P+'oki_dep_end.mp3',
        P+(isOuter?'en_outer_ltd.mp3':'en_inner_ltd.mp3'), stPartEn(st),
        P+'ko_ltd_dep.mp3', P+'st_ko_'+st.i+'.mp3', P+'ko_desu.mp3',
        P+'zh_ltd_dep.mp3', P+'st_zh_'+st.i+'.mp3', P+'zh_station.mp3',
        P+'de_dep.mp3', P+'st_de_'+st.i+'.mp3',
        P+'fr_dep.mp3', P+'st_fr_'+st.i+'.mp3',
        P+'pt_dep.mp3', P+'st_pt_'+st.i+'.mp3'
      );
      text='本日も、汐見快特をご利用くださいまして、ありがとうございます。この列車は'+(isOuter?'外回り':'内回り')+'電車の'+destSt.name+'方面行きでございます。次の停車駅は'+st.name+'でございます。（アイヌ語・沖縄弁・英語・韓国語・中国語・独・仏・葡）';
    }else{
      const tr=isMajor?getTransferPartsAndText(st):{parts:[],text:''};
      parts.push(
        P+'ja_ltd_arr_intro.mp3', stPartJa(st), P+'ja_ltd_arr_prep.mp3',
        stPartJa(st), P+'ja_wo_demasuto.mp3', stPartJa(nextAfter), P+'ja_ni_teisha_itashimasu.mp3',
        ...tr.parts,
        P+'ainu_arr_intro.mp3', stPartJa(st), P+'ainu_arr_end.mp3',
        P+'oki_arr_intro.mp3', stPartJa(st), P+'oki_arr_end.mp3',
        P+'en_arr.mp3', stPartEn(st), P+'en_after.mp3', stPartEn(nextAfter),
        P+'ko_arr.mp3', P+'st_ko_'+st.i+'.mp3', P+'ko_arr_end.mp3',
        P+'zh_arr.mp3', P+'st_zh_'+st.i+'.mp3', P+'zh_station.mp3',
        P+'de_arr.mp3', P+'st_de_'+st.i+'.mp3',
        P+'fr_arr.mp3', P+'st_fr_'+st.i+'.mp3',
        P+'pt_arr.mp3', P+'st_pt_'+st.i+'.mp3'
      );
      text='ご乗車お疲れ様でした。まもなく、'+st.name+'でございます。降りられるお客様はどうぞお早めにお支度ください。'+st.name+'を出ますと'+nextAfter.name+'に停車いたします。'+tr.text+'（アイヌ語・沖縄弁・英語・韓国語・中国語・独・仏・葡）';
    }
    return {parts,text,isLtd:true};
  }

  if(!BRANCH && kind==='local'){
    const dname=isOuter?'outer':'inner';
    const mname=isSoon?'arr':'dep';
    const base='assets/audio/ann/v230/loop_local_'+dname+'_'+mname+'_'+st.i;
    const prevSt=STATIONS[mod(st.i-(dir>0?1:-1),NST)];
    const prevMajor=isMajorStation(prevSt);
    const sideStr=(sideIsLeft?'左':'右')+'側';
    if(!isSoon){
      if(prevMajor){
        const dirMajors=getAheadMajorStations(prevSt.i,dir,kind,2).map(s=>s.name).join('、');
        text='この電車は環状線'+(isOuter?'外回り':'内回り')+'、'+dirMajors+'方面行きです。次は'+st.name+'、'+st.name+'、お出口は'+sideStr+'です。（英語放送）';
      }else{
        text='次は'+st.name+'、'+st.name+'、お出口は'+sideStr+'です。（英語放送）';
      }
    }else{
      const trNames=(isMajor&&st.lines&&st.lines.length)?('（'+st.lines.map(l=>l[0]).join('・')+'はお乗り換え）'):'';
      text='まもなく、'+st.name+'、'+st.name+'、お出口は'+sideStr+'です。'+trNames+'（英語放送）';
    }
    return {parts:[base+'_ja.mp3',base+'_en.mp3'],text,isLtd:false,chimeType:'local'};
  }

  if(BRANCH && LINE_ID==='branch2'){
    const isDown=(dir>0);
    const dirName=isDown?'down':'up';
    const mname=isSoon?'arr':'dep';
    const idx=isDown?Math.max(1,Math.min(NST-1,st.i)):Math.max(0,Math.min(NST-2,st.i));
    const base='assets/audio/ann/v230/b2_'+dirName+'_'+mname+'_'+idx;
    const sideStr=sideIsLeft?'左':'右';
    const isFirst=(isDown&&idx===1)||(!isDown&&idx===NST-2);
    const isFinal=(isDown&&idx===NST-1)||(!isDown&&idx===0);
    const destName=isDown?STATIONS[NST-1].name:STATIONS[0].name;
    const prevIdx=idx-(isDown?1:-1);
    const prevLeft=STATIONS[prevIdx]?(TK[key].side(STATIONS[prevIdx])*dir<0):sideIsLeft;
    const chgStr=(sideIsLeft!==prevLeft)?('出口は'+sideStr+'側に変わります。'):'';
    const trStr=idx===0?'汐見環状線、空港線、西岳線、地下鉄つばさ線はお乗り換えです。':idx===NST-1?'四嶺連絡高速線はお乗り換えです。':'';
    if(!isSoon){
      text=isFirst
        ?('本日も紫雲地下線をご利用いただきまして、ありがとうございます。この電車は、'+destName+'ゆきです。次は、'+st.name+'です。（英語放送）')
        :isFinal
        ?('次は、'+st.name+'、終点です。'+trStr+'（英語放送）')
        :('次は、'+st.name+'です。'+trStr+chgStr+'（英語放送）');
    }else{
      text=isFinal
        ?('本日も紫雲地下線をご利用いただきまして、ありがとうございました。'+st.name+'、'+st.name+'。終点です。'+trStr+'お忘れ物のないよう、ご注意ください。'+sideStr+'側の扉が開きます。ご注意ください。（英語放送）')
        :(st.name+'、'+st.name+'。'+sideStr+'側の扉が開きます。ご注意ください。（英語放送）');
    }
    return {parts:[base+'_ja.mp3',base+'_en.mp3'],text,isLtd:false,chimeType:'branch2pt'};
  }

  if(BRANCH){
    const bp=LINE_ID==='branch2'?'b2':LINE_ID==='branch3'?'b3':LINE_ID==='branch4'?'b4':LINE_ID==='branch5'?'b5':'b1';
    const mname=isSoon?'arr':'dep';
    const file='assets/audio/ann/v230/br_'+bp+'_'+mname+'_'+st.i+'.mp3';
    text=isSoon
      ?('ご乗車お疲れ様でした。まもなく'+st.name+'です。ホーム側全てのドアが開きます')
      :('次は'+st.name+'に止まります');
    return {parts:[file],text,isLtd:false,chimeType:'branch2pt'};
  }

  if(isMajor&&!BRANCH){
    if(!isSoon){
      const dirParts=majorsAhead.map(s=>stPartJa(s));
      const dirNames=majorsAhead.map(s=>s.name).join('、');
      parts.push(
        P+'ja_loop_welcome.mp3',
        P+(isOuter?'ja_outer.mp3':'ja_inner.mp3'),
        P+(kind==='rapid'?'ja_rapid.mp3':'ja_local.mp3'),
        ...dirParts,
        P+'ja_homen_desu.mp3',
        P+'ja_tsugiwa.mp3', stPartJa(st), P+'ja_desu.mp3',
        P+(sideIsLeft?'ja_deguchi_l.mp3':'ja_deguchi_r.mp3'),
        P+(isOuter?(kind==='rapid'?'en_outer_rapid.mp3':'en_outer_local.mp3'):(kind==='rapid'?'en_inner_rapid.mp3':'en_inner_local.mp3')),
        P+'en_next.mp3', stPartEn(st), P+(sideIsLeft?'en_exit_l.mp3':'en_exit_r.mp3'),
        P+'ko_next.mp3', P+'st_ko_'+st.i+'.mp3', P+'ko_desu.mp3', P+(sideIsLeft?'ko_exit_l.mp3':'ko_exit_r.mp3'),
        P+'zh_next.mp3', P+'st_zh_'+st.i+'.mp3', P+'zh_station.mp3', P+(sideIsLeft?'zh_exit_l.mp3':'zh_exit_r.mp3')
      );
      text='環状線をご利用いただき、ありがとうございます。'+(isOuter?'外回り':'内回り')+(kind==='rapid'?'快速':'各駅停車')+'、'+dirNames+'方面です。次は'+st.name+'です。出口は'+(sideIsLeft?'左':'右')+'側です。（英語・韓国語・中国語）';
    }else{
      const tr=getTransferPartsAndText(st);
      parts.push(
        P+'ja_mamonaku.mp3', stPartJa(st), stPartJa(st), P+'ja_desu.mp3',
        P+(sideIsLeft?'ja_deguchi_l.mp3':'ja_deguchi_r.mp3'),
        P+'ja_konodensha.mp3', P+(isOuter?'ja_outer.mp3':'ja_inner.mp3'), P+(kind==='rapid'?'ja_rapid.mp3':'ja_local.mp3'), P+'ja_desu.mp3',
        stPartJa(st), P+'ja_wo_demasuto.mp3', stPartJa(nextAfter), P+'ja_ni_teisha_itashimasu.mp3',
        P+'en_arr.mp3', stPartEn(st), P+(sideIsLeft?'en_exit_l.mp3':'en_exit_r.mp3'), P+'en_after.mp3', stPartEn(nextAfter),
        P+'ko_arr.mp3', P+'st_ko_'+st.i+'.mp3', P+'ko_arr_end.mp3', P+(sideIsLeft?'ko_exit_l.mp3':'ko_exit_r.mp3'),
        P+'zh_arr.mp3', P+'st_zh_'+st.i+'.mp3', P+'zh_station.mp3', P+(sideIsLeft?'zh_exit_l.mp3':'zh_exit_r.mp3'),
        ...tr.parts
      );
      text='まもなく'+st.name+'、'+st.name+'です。出口は'+(sideIsLeft?'左':'右')+'側です。この電車は'+(isOuter?'外回り':'内回り')+(kind==='rapid'?'快速':'各駅停車')+'です。'+st.name+'を出ますと'+nextAfter.name+'に停車いたします。（英語・韓国語・中国語）'+tr.text;
    }
    return {parts,text,isLtd:false};
  }

  if(isLtdStop){
    if(!isSoon){
      parts.push(
        P+'ja_thanks.mp3',
        P+(isOuter?'ja_outer.mp3':'ja_inner.mp3'),
        P+(kind==='rapid'?'ja_rapid.mp3':'ja_local.mp3'),
        P+'ja_desu.mp3',
        P+'ja_tsugiwa.mp3', stPartJa(st), P+'ja_ni_teisha.mp3',
        P+'en_next.mp3', stPartEn(st)
      );
      text='ご利用いただきありがとうございます。'+(isOuter?'外回り':'内回り')+(kind==='rapid'?'快速':'各駅停車')+'です。次は、'+st.name+'に停車します。（英語）';
    }else{
      parts.push(
        P+'ja_mamonaku.mp3', stPartJa(st), P+'ja_desu.mp3',
        P+(sideIsLeft?'ja_deguchi_l.mp3':'ja_deguchi_r.mp3'),
        stPartJa(st), P+'ja_no_tsugiwa.mp3', stPartJa(nextAfter), P+'ja_ni_teisha.mp3',
        P+'en_arr.mp3', stPartEn(st), P+(sideIsLeft?'en_exit_l.mp3':'en_exit_r.mp3')
      );
      text='まもなく、'+st.name+'です。出口は'+(sideIsLeft?'左':'右')+'側です。'+st.name+'の次は'+nextAfter.name+'に停車します。（英語）';
    }
    return {parts,text,isLtd:false};
  }

  if(!isSoon){
    parts.push(P+'ja_tsugiwa.mp3', stPartJa(st), P+'ja_desu.mp3', P+'en_next.mp3', stPartEn(st));
    text='次は、'+st.name+'です。（英語）';
  }else{
    parts.push(P+'ja_mamonaku.mp3', stPartJa(st), P+'ja_desu.mp3', P+'en_arr.mp3', stPartEn(st));
    text='まもなく、'+st.name+'です。（英語）';
  }
  return {parts,text,isLtd:false};
}
function playStationAnnounce(st, mode){
  if(!st||(typeof G!=='undefined'&&G.sound===false)) return;
  const info=buildAnnouncementData(st,mode);
  playAnnQueue(info.parts);
}
function preloadStationAnnounce(st){
  if(!st||!AC)return;
  loadAnnBuffer(stPartJa(st)).catch(()=>{});
  loadAnnBuffer(stPartEn(st)).catch(()=>{});
}
const LATEST_UPDATE_AD_FILE='assets/audio/ann/ad_latest_v198.mp3';
const LATEST_UPDATE_AD_TEXT='最新アップデートのお知らせです。バージョン1.9.8では、ドアが閉まるときに、車内の案内画面が赤く点滅して、ドアが閉まりますと、大きくお知らせするようになりました。車内の広告画面は、デザインも表示のしかたも新しくなりました。駅のホームには、号車ごとの乗車位置案内を設置し、グリーン車の乗車口も分かりやすくしました。運転台と前面ガラスは、外から見ても、お客さまから見ても、運転士と同じ姿で、くもりのないクリアな見え方になりました。発車のタイミングも改善し、乗降促進と戸締め放送が終わると、すぐにドアが閉まります。汐見環状線を、これからもよろしくお願いいたします。';
const RANDOM_ADS=[
  {file:'assets/audio/ann/parts/ad_sns_share.mp3',text:'開発者よりお願いです。SNSなどでゲームの紹介や共有をしてくれると嬉しいです。ご協力お願い致します。'},
  {file:'assets/audio/ann/parts/ad_youtube.mp3',text:'汐見環状線公式YouTubeチャンネルを開設しました。走行映像や最新アップデート情報などをお届けしていく予定ですので、ホーム画面のリンクからぜひチャンネル登録をお願いいたします。'},
  {file:LATEST_UPDATE_AD_FILE,text:LATEST_UPDATE_AD_TEXT},
  {file:'assets/audio/ann/parts/ad_random_2.mp3',text:'汐見環状線より、車内マナーのお願いです。お年寄りや体の不自由なお客様には席をお譲りください。また、歩きながらのスマートフォン操作はおやめください。'},
  {file:'assets/audio/ann/parts/ad_random_3.mp3',text:'汐見環状線沿線のお出かけ情報です。碧浜の海岸プロムナードや蒼海中央の展望デッキ、白峰支線方面の渓谷温泉へは汐見一日乗車券が便利です。'},
  {file:'assets/audio/ann/parts/ad_random_4.mp3',text:'お客様にご案内いたします。この列車は各駅で乗客モードからもご乗車いただけます。他のお客様が運転する電車への乗車もぜひお楽しみください。'},
  {file:'assets/audio/ann/parts/ad_random_5.mp3',text:'お客様にお願いいたします。駆け込み乗車は大変危険です。無理なご乗車はお控えいただき、次の列車をご利用ください。'},
  {file:'assets/audio/ann/manner_quiet.mp3',text:'車内マナーのお願い（静かに・優先席・手すり）'},
  {file:'assets/audio/ann/manner_priority.mp3',text:'優先席と席の譲り合いのお願い'},
  {file:'assets/audio/ann/manner_hold.mp3',text:'揺れる車内での安全のお願い'},
  {file:'assets/audio/ann/info_transfer.mp3',text:'汐見環状線・各支線の乗り換えのご案内'}
];
let _adQueueTimer=null,_adWebSrc=null,_adAudio=null;
let annReservedUntil=0; /* 次駅放送の予約中は広告を割り込ませない */
function stopAdBroadcast(){
  if(_adQueueTimer){clearTimeout(_adQueueTimer);_adQueueTimer=null;}
  if(_adWebSrc){try{_adWebSrc.onended=null;_adWebSrc.stop();}catch(_){}_adWebSrc=null;}
  if(_adAudio){try{_adAudio.onended=null;_adAudio.pause();_adAudio.currentTime=0;}catch(_){}_adAudio=null;}
  if(master&&AC&&!annWebSrc)try{master.gain.setTargetAtTime(9.5,AC.currentTime,0.15);}catch(_){}
}
function playAdBroadcastForDep(depSt, nextSt){
  const isRide=!!(PAX&&RIDE&&RIDE.a);
  if((!PAX&&G.phase!=='play')||(PAX&&!isRide)||(typeof G!=='undefined'&&G.sound===false))return;
  if((depSt&&isMajorStation(depSt))||(nextSt&&isMajorStation(nextSt)))return;
  let item=null;
  if(!G.firstDepAdDone){
    G.firstDepAdDone=true;
    item={
      file:'assets/audio/ann/parts/ad_first_dep.mp3',
      text:'ゲームの開発者よりお願い申し上げます。バグを見つけた場合はどんなに小さなバグでも構いませんのでホーム画面のご意見箱より報告願います。また、通知が来たらすぐ修正するようにはしてますが開発者の予定の都合上返信に時間がかかる場合がございます。あらかじめご了承ください。'
    };
  }else{
    item=RANDOM_ADS[(Math.random()*RANDOM_ADS.length)|0];
  }
  const finishAll=()=>{if(master&&AC&&!annWebSrc)try{master.gain.setTargetAtTime(9.5,AC.currentTime,0.2);}catch(_){}};
  const inRun=()=>((!PAX&&G.phase==='play'&&G.atStation===null)||(PAX&&RIDE&&RIDE.a&&RIDE.a.state==='run'));
  const runAd=()=>{
    if(!inRun()){stopAdBroadcast();return;}
    if(master&&AC)try{master.gain.setTargetAtTime(4.2,AC.currentTime,0.08);}catch(_){}
    chime();
    toast('📢 広告放送：'+item.text,'info');
    try{
      initAudio();
      if(AC){
        if(AC.state==='suspended'){try{AC.resume();}catch(_){}}
        loadAnnBuffer(item.file).then(buf=>{
          if(!inRun()){stopAdBroadcast();return;}
          if(!buf){finishAll();return;}
          const s=AC.createBufferSource(),g=AC.createGain();
          g.gain.value=1.25;
          s.buffer=buf;s.connect(g);g.connect(AC.destination);
          _adWebSrc=s;
          s.onended=()=>{if(_adWebSrc===s)_adWebSrc=null;finishAll();};
          s.start(0);
        }).catch(()=>{finishAll();});
        return;
      }
    }catch(_){finishAll();}
  };
  const waitAnn=()=>{
    if(!inRun())return;
    if(annWebSrc||annPlaying||(annQ&&annQ.length)||(annAudio&&!annAudio.paused&&!annAudio.ended)||nowMs()<annReservedUntil){_adQueueTimer=setTimeout(waitAnn,350);return;}
    _adQueueTimer=setTimeout(runAd,600);
  };
  clearTimeout(_adQueueTimer);
  _adQueueTimer=setTimeout(waitAnn,1200);
}
function triggerRideAnnounce(a, mode){
  if(!PAX||!RIDE||RIDE.a!==a||(typeof G!=='undefined'&&G.sound===false))return;
  let nx=aiStop(a);
  if(mode!=='soon'&&nx&&nx.st&&RIDE.lastDepSt&&nx.st.i===RIDE.lastDepSt.i&&Math.abs(sdiff(a.s,nx.st.s+(TK[a.key]?TK[a.key].so:0)))<150){
    a.last=nx.st.i;
    nx=aiStop(a);
  }
  if(!nx||!nx.st)return;
  const nst=nx.st;
  const isSoon=(mode==='soon');
  if(isSoon)stopAdBroadcast();
  const info=buildAnnouncementData(nst,isSoon?'soon':'next');
  preloadAnnUrls(info.parts);
  try{prepareAnnBuffer(info.parts);}catch(e){}
  const run=()=>{
    if(!PAX||!RIDE||RIDE.a!==a)return;
    try{initAudio();}catch(_){}
    if(AC&&AC.state==='suspended'){try{AC.resume();}catch(_){}}
    const chimeDelay=info.isLtd?chimeLtdLong(AC?AC.destination:null):(chime(AC?AC.destination:null, info.chimeType),info.chimeType==='branch2pt'?520:600);
    if(annSeqTimer){clearTimeout(annSeqTimer);annSeqTimer=null;}
    annSeqTimer=setTimeout(()=>{
      annSeqTimer=null;
      if(!PAX||!RIDE||RIDE.a!==a)return;
      playAnnQueue(info.parts);
      if(!isSoon){
        const dst=RIDE.lastDepSt||null;
        RIDE.lastDepSt=null;
        playAdBroadcastForDep(dst,nst);
      }
    },chimeDelay);
  };
  if(!isSoon){
    if(annSeqTimer){clearTimeout(annSeqTimer);annSeqTimer=null;}
    annReservedUntil=nowMs()+14000; /* チャイム待ち＋放送の間、広告を割り込ませない */
    annSeqTimer=setTimeout(run,2000);
  }else{
    run();
  }
}
function triggerNextStationAnnounce(mode){
  if(G.phase!=='play'||(typeof G!=='undefined'&&G.sound===false))return;
  const nst=stOf(G.nv);
  if(!nst)return;
  if(mode==='soon')stopAdBroadcast();
  const isSoon=mode==='soon';
  const info=buildAnnouncementData(nst,isSoon?'soon':'next');
  preloadAnnUrls(info.parts);
  try{ prepareAnnBuffer(info.parts); }catch(e){}   /* v1.9.7：鳴らす前に結合しておく（途切れ防止） */
  const chimeDelay=info.isLtd?chimeLtdLong(AC?AC.destination:null):(chime(AC?AC.destination:null, info.chimeType),info.chimeType==='branch2pt'?520:600);
  if(!isSoon)annReservedUntil=nowMs()+Math.max(6000,chimeDelay+4000);
  toast((isSoon?'📢 まもなく放送：':'📢 次駅放送：')+info.text,'info');
  if(annSeqTimer){clearTimeout(annSeqTimer);annSeqTimer=null;}
  annSeqTimer=setTimeout(()=>{
    annSeqTimer=null;
    if(G.phase!=='play')return;
    playAnnQueue(info.parts);
    if(!isSoon){
      const dst=G.lastDepSt!=null?stOf(G.lastDepSt):null;
      G.lastDepSt=null;
      playAdBroadcastForDep(dst,nst);
    }
  },chimeDelay);
}

function panelAct(u,v){ // touch panel hit (u,v in 0..1)
  const x=u*512,y=(1-v)*284;
  const back=()=>{G.panel='main';if(G.panelZoomed){G.zoom=null;G.panelZoomed=false;}};
  if(G.panel==='ann'||G.panel==='promo'){if(y<52){if(x>380)back();return;}
    const i=(y<168?0:2)+(x<256?0:1);if(G.panel==='ann')broadcast(i);else promote(i);back();return;}

  if(G.tabNextAnn && x < 2 * (512 / 3)){
    triggerNextStationAnnounce(G.tabAnnMode || 'next');
    G.tabNextAnn = false;
    drawPanel();
    return;
  }

  const t=Math.floor(x/(512/3));
  if(t===0||t===1){G.panel=t===0?'promo':'ann';if(G.zoom!=='T'){G.zoom='T';G.panelZoomed=true;}}
  else if(y<142){startHoldHorn('elec');}else if(LINE_ID==='branch2'){startHoldHorn('air');}else{musicHorn();G.mhornT=nowMs();}
}
// stopped at a platform: the zoomed camera monitor works as a touch panel
function camTouchOn(){if(PAX||G.phase!=='play'||G.v>0.05)return false;if(G.atStation!==null||G.depCheck!==null)return true;const d=stopDist(G.nv);return d>-6.5&&d<17.9;}
function camTouch(k,i){const local=(k==='L'?-1:1)*SIDEINV;if(i===0)openDoor(local);else if(i===1)closeDoor(local);else promote(defaultPromo());
  const b=[BTN.lo,BTN.lc][0];clickSnd();}
function doAct(a,hit){
  initAudio();unlockSpeech();
  switch(a){case 'lo':openDoor(-1*SIDEINV);break;case 'lc':closeDoor(-1*SIDEINV);break;case 'ro':openDoor(1*SIDEINV);break;case 'rc':closeDoor(1*SIDEINV);break;
    case 'ato':if(G.crew==='twoC'){toast('運転は運転士が行います（車掌は合図で発車させます）','info');break;}toggleATO();break;case 'auto':toggleAuto();break;
    case 'hornA':startHoldHorn('air');break;case 'hornE':startHoldHorn('elec');break;
    case 'ann0':case 'ann1':case 'ann2':case 'ann3':broadcast(+a.slice(3));break;
    case 'leanL':toggleLean(-1);break;case 'leanR':toggleLean(1);break;
    case 'lnOpen':openDoor(G.lean);break;case 'lnClose':closeDoor(G.lean);break;case 'lnMelo':promote(defaultPromo());break;
    case 'panel':if(hit&&hit.uv)panelAct(hit.uv.x,hit.uv.y);break;
    case 'monL':case 'monR':{const k=a.slice(3);if(G.zoom===k&&camTouchOn()&&hit&&hit.point&&OLDMON){const M=MON[k],lp=M.g.worldToLocal(hit.point.clone()),x=(lp.x/M.w+0.5)*512,y=(0.5-lp.y/M.h)*384;
      if(y>=300){camTouch(k,Math.min(2,Math.floor(x/(512/3))));break;}}
    if(G.zoom===k&&camTouchOn()&&hit&&hit.point&&!OLDMON){const M=MON[k],lp=M.g.worldToLocal(hit.point.clone()),x=(lp.x/M.w+0.5)*1024,y=(0.5-lp.y/M.h)*768,B=MONBTN;
      if(y>=B.y&&x>=B.x&&x<B.x+B.w){camTouch(k,Math.min(2,Math.floor((x-B.x)/(B.w/3))));break;}}zoomTo(k);break;}
    case 'monS':case 'monI':case 'monM':case 'monMC':case 'monSTAF':case 'monWL':case 'monWR':zoomTo(a.slice(3));break;}
  const b=BTN[a]||(G.lean?BTN[a+G.lean]:null);if(b){b.cap.position.z=-0.008;setTimeout(()=>b.cap.position.z=0,160);}
}

/* ================= timetable estimate ================= */
function runEst(dist){const kd=BRANCH?'branch':KIND[G.key],v=LINE_ID==='branch5'?45:({local:15.5,rapid:20.5,ltd:27.5,exp:24.5,branch:15.5}[kd]||15.5);return (dist/v+58)*1000;}
function planFrom(t0){G.plan={};let t=t0,v=G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv-1;let s0=stOf(Math.max(0,v)).s;
  for(let k=0;k<8;k++){const vv=(G.atStation!==null||G.depCheck!==null)?v+1+k:G.nv+k;if(G.list&&vv>lastStop())break;const st=stOf(vv);const dist=Math.abs(G.dir*sdiff(s0,st.s))||1000;
    t+=runEst(dist);G.plan[vv]={arr:t,dep:t+(st.big?45000:30000)};t+=st.big?45000:30000;s0=st.s;}}

const trkSlope=()=>{const y=TK[G.key].y;return (y(G.s+2)-y(G.s-2))/4;};
/* ================= ATO ================= */
function atoControl(){
  const d=stopDist(G.nv)+(G.atoErr||0),v=G.v;
  let vt=(limitFor(G.key,G.s)-4)/3.6;
  for(const z of LIMITS){const en=G.dir>0?z.a:z.b,dz=G.dir*sdiff(G.s,en);if(onRapid(G.key,en))continue;if(dz>0&&dz<900)vt=Math.min(vt,Math.sqrt(Math.pow((z.v-4)/3.6,2)+2*0.55*dz));}
  if(inConn(G.key,G.s)||inConn(G.key,G.s+G.dir*250))vt=Math.min(vt,(45-3)/3.6);
  const ns=nextSignal(mainAt(G.key,G.s),G.s,G.dir);G.sig=ns;let sd=1e9;
  if(ns){if(ns.asp==='R')sd=ns.dist-22;else if(ns.asp==='Y')vt=Math.min(vt,Math.sqrt(12.5*12.5+2*0.55*ns.dist));else if(ns.asp==='YG')vt=Math.min(vt,Math.sqrt(18*18+2*0.55*ns.dist));}
  /* 先行のAI列車・他プレイヤー列車との実距離による追突・貫通防止 */
  for(const o of OT){
    if(!o||o.state==='off'||!o.key||!sameTrack({key:G.key,dir:G.dir},o.key,o.s,o.dir))continue;
    const dd=G.dir*sdiff(G.s,o.s);const prevLen=(o.tr&&o.tr.cars?o.tr.cars.length:carsFor(o.key))*CARL;
    const cg=dd-prevLen;if(dd>0&&cg<350){sd=Math.min(sd,Math.max(0,cg-26));if(cg<=28)vt=0;}
  }
  if(IS_ONLINE&&window.ONLINE_PLAYERS){
    const curLine=(typeof CFG!=='undefined'&&CFG)?CFG.id:'loop';
    for(const pid in ONLINE_PLAYERS){
      const op=ONLINE_PLAYERS[pid];if(!op||op.isPax||op.state!=='driving'||op.s==null||!op.key||(op.line||'loop')!==curLine)continue;
      const od=TK[op.key]?TK[op.key].dir:1;if(od!==G.dir||!sameTrack({key:G.key,dir:G.dir},op.key,op.s,od))continue;
      const dd=G.dir*sdiff(G.s,op.s);const prevLen=(op.nCar||carsFor(op.key))*CARL;
      const cg=dd-prevLen;if(dd>0&&cg<350){sd=Math.min(sd,Math.max(0,cg-26));if(cg<=28)vt=0;}
    }
  }
  const tgt=Math.min(d,sd);const vs=Math.sqrt(2*0.7*Math.max(tgt-0.1,0));let n;
  if(tgt<0.25&&v<0.35){n=-8;if(v===0&&d<0.3){G.ato=false;const e=stopDist(G.nv);toast(stOf(G.nv).name+' 停止位置'+(BRANCH&&Math.abs(e)>0.2?'（'+(e>0?'手前 ':'行き過ぎ ')+Math.abs(e).toFixed(1)+'m）':''),'ok');}}
  else if(vs<v+0.8&&tgt<Math.max(500,v*v/1.2+120)&&tgt>-20){const areq=v*v/(2*Math.max(tgt-0.05,0.05))+9.8*trkSlope()*G.dir;n=-clamp(Math.round(areq/(1.15/8)+0.3),1,8);}
  else if(v>vt+0.8)n=-2;
  else if(v>vt+0.2 && G.notch<0)n=G.notch;
  else if(v<Math.min(vt,vs)-1.5)n=Math.min(vt,vs)-v>4?5:3;
  else if(v<Math.min(vt,vs)-0.5 && G.notch>0)n=G.notch;
  else n=trkSlope()*G.dir>0.012?2:0;
  G.notch=n;
}

/* ================= full auto mode ================= */
function updAuto(dt){if(!G.auto||G.phase!=='play'||G.waiting||G.walkOn)return;G.autoT+=dt;const D=G.door;
  if(G.twoMan){if(G.askOpen)hideAsk(); /* ツーマン：ドアと乗降促進は車掌。運転士は合図を待って発車 */
    if(D.state==='closed'&&G.atStation===null&&G.depCheck===null&&!G.ato&&G.v===0){const d=stopDist(G.nv);if(!(d>-6.5&&d<17.9)||sigStopped()){if(G.autoPh!=='go'){G.autoPh='go';G.autoT=0;}else if(G.autoT>2){toggleATO();G.autoPh='';}}return;}
    if(D.state==='closed'&&G.depCheck!==null&&!G.ato&&G.v===0&&G.condOK){if(G.autoPh!=='dep'){G.autoPh='dep';G.autoT=0;}if(G.autoT>1.5){toggleATO();G.autoPh='';}}
    return;}
  if(G.askOpen)hideAsk();
  if(D.state!=='open')G.dwellT=0;
  if(D.state==='closed'&&G.atStation===null&&G.depCheck===null&&!G.ato&&G.v===0){const d=stopDist(G.nv);
    if(d>-6.5&&d<17.9&&!sigStopped()){if(G.autoPh!=='open'){G.autoPh='open';G.autoT=0;}if(G.autoT>1.2){openDoor(localSide(stOf(G.nv)));G.autoPh='';}} /* 停止信号で止まったときは開けずに、信号が変わったら進む */
    else if(G.autoPh!=='go'){G.autoPh='go';G.autoT=0;}else if(G.autoT>2){toggleATO();G.autoPh='';}return;}
  if((D.state==='open')&&G.atStation!==null){
    const curSt=stOf(G.atStation);
    const isMajor=isMajorStation(curSt);
    G.dwellT=(G.dwellT||0)+dt;
    if(G.autoMel==null) G.autoMel=isMajor?rand(1.6,2.6):rand(0.4,0.9);
    if(!G.promoted[G.atStation]){if(G.dwellT>=G.autoMel){promote(defaultPromo());G.autoT=0;}return;}
    const busy=pending()||jamCount()>0, melT=G.promoLoop?(nowMs()-G.promoLoop.t0)/1000:0;
    const pDur=(G.promoLoop&&G.promoLoop.onePhraseDur)?G.promoLoop.onePhraseDur:8.0;
    if(G.promoLoop){
      /* v1.9.8：メロディは1回鳴らし切ったら止める（主要駅でも繰り返さない） */
      const targetMelT=pDur+0.3;
      if((!busy&&melT>=targetMelT)||melT>18||G.dwellT>(isMajor?45:30)){promote(defaultPromo());G.autoT=0;}
      return;
    }
    if(G.promoOn){G.autoT=0;return;}
    if(busy&&G.dwellT<45){G.autoT=0;return;}
    /* v1.9.8：戸締め放送「ドアが閉まります」が終わったら間を置かずに戸閉する */
    if(doorAnnBusy()){G.autoT=0;return;}
    if(!G.closeWait&&G.autoT>0.15){closeDoor(D.local);G.autoT=0;}return;}
  if(D.state==='closed'&&G.depCheck!==null&&!G.ato&&G.v===0){
    const depSt=stOf(G.depCheck);
    const isMajor=isMajorStation(depSt);
    if(G.autoPh!=='dep'){G.autoPh='dep';G.autoT=0;}
    const depDelay=isMajor?1.2:0.4;   /* v1.9.8：戸閉完了後すぐ発車 */
    if(G.autoT>depDelay){toggleATO();G.autoPh='';}
  }
}

/* ================= 2-platform / 4-track stations, depot, waiting ================= */
function mainOf(k){return TK[k].main;}
function updTwin(){}
let askTimer=0,askTimeout=null;
function openAsk(title,msg,btns,timeout,onTimeout){if(G.auto)return;const box=document.getElementById('askBtns');box.innerHTML='';
  document.getElementById('askText').textContent=title;document.getElementById('askMsg').textContent=msg;
  btns.forEach(([label,fn,pri])=>{const b=document.createElement('button');b.textContent=label;b.className=pri?'pri':'sec';b.addEventListener('click',()=>{hideAsk();fn&&fn();});box.appendChild(b);});
  G.askOpen=true;askTimer=timeout||0;askTimeout=onTimeout||null;document.getElementById('ask').classList.remove('hide');}
function hideAsk(){G.askOpen=false;askTimeout=null;document.getElementById('ask').classList.add('hide');}
function askTwin(st,atStart){askStation(st,atStart);}
function askStation(st,atStart){ // 待ち合わせ（休憩）は廃止。車庫のみ
  const depot=!BRANCH&&st.i===0&&!atStart;if(!depot)return;
  const btns=[['そのまま運転を続ける',null,true],['乗務を終了（タイトルへ）',()=>location.href=location.pathname,false]];
  openAsk(st.name+'に着きました','汐見車庫に入りますか？ 何もしなければ15秒後にそのまま運転を続けます。',btns,15);}

/* ================= simulation ================= */
function physics(dt){
  if(G.dispatchHold){G.notch=-9;G.mnotch=-9;G.bc=400;G.prevV=G.v;G.v=Math.max(0,G.v-4.5*dt);G.s+=G.dir*G.v*dt;return;}
  if(G.manual||G.manualOverride){G.notch=G.mnotch;manualSafety();}
  else if(G.ato&&G.door.state==='closed')atoControl();else if(!G.ato)G.notch=G.v>0?-8:-4;
  if(G.slowMode&&G.v>(G.slowMaxV||25/3.6)){G.notch=Math.min(G.notch,-3);}
  if(!G.ato)G.sig=nextSignal(mainAt(G.key,G.s),G.s,G.dir);
  const v=G.v,closed=G.door.state==='closed';let a=0;
  const holdDep=(G.twoMan&&!G.condOK&&v<1&&(G.atStation!==null||G.depCheck!==null))||(v<1&&miniHold()); /* ツーマン：合図が出るまで力行しない */
  if(holdDep&&G.notch>0&&!G.holdToast){G.holdToast=1;toast('車掌からの合図がありません','warn');}if(!holdDep)G.holdToast=0;
  if(G.notch>0&&closed&&!holdDep)a+=(G.notch/5)*1.0*Math.min(1,11/Math.max(v,0.1));
  if(v>0)a-=0.03+0.00006*v*v;
  const bcT=G.notch<0?-G.notch/8*400:0;
  G.bc+=(Math.max(bcT,closed?0:200)-G.bc)*Math.min(1,dt*2.5);
  if(v>0)a-=G.bc/400*1.15;
  const gr=9.8*trkSlope()*G.dir;if(v>0||(a-gr>0))a-=gr;else if(G.bc<150)a-=gr;
  G.prevV=G.v;G.v=Math.max(0,v+a*dt);
  if(G.slowMode&&G.slowMaxV&&G.v>G.slowMaxV)G.v=Math.max(G.slowMaxV,G.v-2.2*dt);
  if(G.slowMode==='prev'){
    G.s-=G.dir*G.v*dt;
    if(G.slowPrevTargetS!=null&&Math.abs(sdiff(G.s,G.slowPrevTargetS))<2.5){
      G.s=G.slowPrevTargetS;G.v=0;G.notch=-4;G.mnotch=-4;
      if(G.list&&G.list.length)G.nv=Math.max(0,G.nv-1);
      else if(G.cyc&&G.cyc.length){G.cpos=mod(G.cpos-1,G.cyc.length);G.nv=0;}
      G.atStation=G.nv;G.slowMode=null;G.slowPrevTargetS=null;
      toast('✅ 一駅前に到着したため退行徐行運転を終了しました','ok');
    }
  }else{
    G.s+=G.dir*G.v*dt;
    if(G.slowMode==='next'&&G.atStation!==null&&G.v<0.05&&G.slowDeparted){
      G.slowMode=null;G.slowDeparted=false;
      toast('✅ 次の駅に到着したため徐行運転を解除しました','ok');
    }else if(G.slowMode==='next'&&G.atStation===null&&G.v>0.5){
      G.slowDeparted=true;
    }
  }
  G.clackDist+=G.v*dt;if(G.clackDist>=25){G.clackDist-=25;jointPass(G.v);}
  for(const z of LIMITS){const en=G.dir>0?z.a:z.b,ex=G.dir>0?z.b:z.a,dz=G.dir*sdiff(G.s,en),db=G.dir*sdiff(ex,G.s);const lap=Math.floor(G.s/L);
    if(onRapid(G.key,en))continue;
    if(dz>0&&dz<260)sayOnce('lim'+z.a+'_'+lap+G.key,'制限、'+z.v+'。','drv');if(db>0&&db<40)sayOnce('rel'+z.a+'_'+lap+G.key,'制限解除。','drv');}
  if(G.depCheck!==null&&G.v>0.3){G.leftSt=stOf(G.depCheck);G.depCheck=null;G.depAt=G.s;}
  if(G.atStation===null){const d=stopDist(G.nv),key=G.nv;
    const prevS=G.nv>0?stOf(G.nv-1).s:stOf(0).s,gap=Math.abs(G.dir*sdiff(prevS,stopS(G.nv)))||1000,shortGap=gap<1150;
    /* 発車後タイマーの加算 */
    if(G.atStation===null&&G.v>1){if(G.depTimer===undefined||G.depTimer===null)G.depTimer=0;G.depTimer+=dt;}
    else if(G.atStation!==null){G.depTimer=0;}

    /* タブレット自動切り替え：発車直後（次駅放送）、駅手前600m（快特は1000m前、近接駅は到着前スキップ） */
    const isDepartedRun = G.v > 1.2 && G.door && G.door.state === 'closed' && G.atStation === null;
    const isLtdRun = typeof G !== 'undefined' && G && G.key && KIND[G.key] === 'ltd';
    const soonDist = (LINE_ID === 'branch2') ? 200 : (isLtdRun ? 1000 : 600);
    const prevStObj = G.list ? stOf(Math.max(0, G.nv - 1)) : stOf(mod(G.nv - G.dir, NST));
    const segDist = (prevStObj && stOf(G.nv)) ? Math.abs(G.dir * sdiff(prevStObj.s, stOf(G.nv).s)) : 9999;
    const tooCloseForSoon = segDist < (isLtdRun ? 1100 : 750);
    if (isDepartedRun && d > soonDist && !G.tabDepAnnDone) {
      G.tabDepAnnDone = true;
      G.tabAnnMode = 'next';
      G.tabNextAnn = true;
      if (typeof drawPanel === 'function') drawPanel();
      /* 同じ区間（次駅）では一度だけ。途中停車→再発車では鳴らし直さない */
      if (shouldAutoNextAnn() && G.annSeg !== G.nv) {
        G.annSeg = G.nv;
        setTimeout(() => {
          if (G.tabNextAnn && G.tabAnnMode === 'next' && G.phase === 'play' && G.annSeg === G.nv) {
            triggerNextStationAnnounce('next');
            G.tabNextAnn = false;
            if (typeof drawPanel === 'function') drawPanel();
          }
        }, 1600);
      }
    }
    if (d <= soonDist && d > 25 && isDepartedRun && !G.tabSoonAnnDone) {
      G.tabSoonAnnDone = true;
      if (!tooCloseForSoon && G.soonSeg !== G.nv) {
        G.soonSeg = G.nv;
        G.tabAnnMode = 'soon';
        G.tabNextAnn = true;
        if (typeof drawPanel === 'function') drawPanel();
        if (shouldAutoNextAnn()) {
          setTimeout(() => {
            if (G.tabNextAnn && G.tabAnnMode === 'soon' && G.phase === 'play' && G.soonSeg === G.nv) {
              triggerNextStationAnnounce('soon');
              G.tabNextAnn = false;
              if (typeof drawPanel === 'function') drawPanel();
            }
          }, 800);
        }
      }
    }

    /* 自動放送は消去（タブレットの「次駅放送」「まもなく放送」ボタンによる手動放送のみ） */
    if(G.prevV>0&&G.v===0&&Math.abs(d)<25){
      say(Math.abs(d)<1?'停止位置、よし。':'停止位置。','drv');
    }
    if(d<-30&&G.nv<=lastStop()){G.nv++;preloadStationAnnounce(stOf(G.nv));}}
  if(G.atStation!==null){
    /* 駅に停まったときだけ次の区間の放送を許可する。途中の信号停車・一時停車ではリセットしない */
    G.tabDepAnnDone = false;
    G.tabSoonAnnDone = false;
    if(G.tabNextAnn){G.tabNextAnn=false;G.tabAnnMode=null;if(typeof drawPanel==='function')drawPanel();}
  }
}
function updFlow(dt){
  if(G.flowV<0)return;
  if(!pending()&&G.runnerPlanned&&!G.runnerSpawned){G.runnerT-=dt;if(G.runnerT<=0){G.runnerSpawned=true;if(G.door.state==='open'||G.door.state==='opening')spawnRunner();}}
}
/* ================= monitors ================= */
const CLS={ok:'#52d38d',bad:'#ff6b5a',warn:'#ffd23f',info:'#ffb45a'};
function wrap(x,text,x0,y,maxW,lh,maxLines){let line='',n=0;for(const ch of text){const t=line+ch;if(x.measureText(t).width>maxW&&line){x.fillText(line,x0,y);y+=lh;line=ch;n++;if(n>=maxLines)return;}else line=t;}if(line)x.fillText(line,x0,y);}
function header(x,title,col){x.fillStyle=col||'#0d2a52';x.fillRect(0,0,512,46);x.fillStyle='#fff';x.textAlign='left';x.textBaseline='alphabetic';x.font='700 24px '+FONT;x.fillText(title,12,32);
  x.textAlign='right';x.font='700 26px '+FONT;x.fillText(hms(nowMs()),500,33);}
function drawSpeed(){
  /* v1.9.0 グラスコックピット：デジタル速度計＋ATC/信号モニタ。1024×768の画面に512×384の座標で描く */
  const x=CANV.S.x;x.setTransform(2,0,0,2,0,0);x.textBaseline='alphabetic';
  const kmh=G.v*3.6,lim=limitFor(G.key,G.s),ncur=(G.manual||G.manualOverride)?(G.mnotch||0):(G.notch||0);
  const bg=x.createLinearGradient(0,0,0,384);bg.addColorStop(0,'#061019');bg.addColorStop(1,'#02060a');x.fillStyle=bg;x.fillRect(0,0,512,384);
  /* 上段：システム名・時刻 */
  x.fillStyle='#0a1a28';x.fillRect(0,0,512,38);x.fillStyle='#2fd0ff';x.fillRect(0,36,512,2);
  x.textAlign='left';x.fillStyle='#8fd6ff';x.font='700 19px '+FONT;x.fillText('運転台モニタ  v2.1',14,26);
  x.textAlign='right';x.fillStyle='#eaf6ff';x.font='700 26px '+FONT;x.fillText(hms(nowMs()),498,27);x.textAlign='left';
  /* 速度リング */
  const SMAX=(G.key==='G'||G.key==='H')?210:160; /* 特急は210km/hまで表示 */
  const cx=150,cy=192,R=116,a0=Math.PI*0.74,span=Math.PI*1.52,ang=v=>a0+span*clamp(v,0,SMAX)/SMAX;
  x.lineWidth=15;x.lineCap='butt';x.strokeStyle='#132b42';x.beginPath();x.arc(cx,cy,R,a0,a0+span);x.stroke();
  x.strokeStyle='#ff5a3c';x.beginPath();x.arc(cx,cy,R,ang(lim),a0+span);x.stroke();
  x.strokeStyle='#4be0a0';x.beginPath();x.arc(cx,cy,R,a0,Math.max(a0+0.002,ang(kmh)));x.stroke();
  x.fillStyle='#6d8aa6';x.font='500 14px '+FONT;x.textAlign='center';
  for(let v=0;v<=SMAX;v+=(SMAX>160?30:20)){const a=ang(v);x.fillText(String(v),cx+Math.cos(a)*(R-26),cy+Math.sin(a)*(R-26)+5);}
  x.fillStyle='#f2fbff';x.font='700 92px '+FONT;x.fillText(String(Math.round(kmh)),cx,cy+26);
  x.fillStyle='#6d8aa6';x.font='600 17px '+FONT;x.fillText('km/h',cx,cy+50);
  x.fillStyle='#12301e';x.fillRect(cx-72,cy+64,144,28);x.fillStyle='#7cf0b0';x.font='700 20px '+FONT;x.fillText('制限 '+lim+' km/h',cx,cy+84);
  /* 右：信号・ATC・計器 */
  const sg=G.sig,ac={G:['#3dff8a'],YG:['#ffc233','#3dff8a'],Y:['#ffc233'],R:['#ff3b30']}[sg?sg.asp:'G']||['#3dff8a'];
  const pnl=(py,ph,t)=>{x.fillStyle='#0b1c2c';x.fillRect(304,py,198,ph);x.fillStyle='#1d3a52';x.fillRect(304,py,198,1);
    x.fillStyle='#5f89a8';x.font='600 13px '+FONT;x.textAlign='left';x.fillText(t,312,py+17);};
  pnl(48,86,'信号・ATC');
  ac.forEach((c2,i)=>{x.fillStyle=c2;x.globalAlpha=0.9;x.beginPath();x.arc(330+(ac.length>1?(i?13:-13):0),88,10,0,Math.PI*2);x.fill();x.globalAlpha=1;});
  x.fillStyle='#fff';x.font='700 30px '+FONT;x.textAlign='left';x.fillText(sg?({G:'進行',YG:'減速',Y:'注意',R:'停止'})[sg.asp]+'　'+Math.round(sg.dist)+'m':'—',356,96);
  x.fillStyle='#9fb0c8';x.font='500 15px '+FONT;x.fillText('次閉塞までの距離 / 現示',312,120);
  pnl(140,74,'ブレーキ・空気');
  x.fillStyle='#eaf6ff';x.font='700 26px '+FONT;x.fillText('BC '+Math.round(G.bc),312,178);
  x.fillStyle='#9fd8ff';x.fillText('MR '+Math.round(G.mr),440,178);
  x.fillStyle='#9fb0c8';x.font='500 14px '+FONT;x.fillText('ブレーキシリンダ／元空気ダメ',312,200);
  pnl(220,96,'戸閉・運転');
  const closed=G.door.state==='closed';
  x.fillStyle=closed?'#1d4d3a':'#5a2418';x.fillRect(310,244,86,34);x.fillStyle=closed?'#7cf0b0':'#ffd0c0';x.font='700 20px '+FONT;x.textAlign='center';
  x.fillText(closed?'戸閉':({open:'戸開',opening:'開扉',closing:'閉扉'})[G.door.state],353,268);
  x.fillStyle=G.ato?'#1d4d3a':'#14202e';x.fillRect(402,244,92,34);x.fillStyle=G.ato?'#7cf0b0':'#48627a';x.fillText('ATO',448,268);
  x.fillStyle=G.auto?'#3b2a5e':'#14202e';x.fillRect(310,284,86,26);x.fillStyle=G.auto?'#d8bdf5':'#48627a';x.font='700 16px '+FONT;x.fillText('完全自動',353,303);
  x.fillStyle='#0b1c2c';x.fillRect(402,284,92,26);x.fillStyle='#9fd8ff';x.font='700 16px '+FONT;x.fillText(G.twoMan?'ツーマン':'ワンマン',448,303);
  /* 下段：マスコン段と次駅 */
  x.textAlign='left';
  const NB=[5,4,3,2,1,0,-1,-2,-3,-4,-5,-6,-7,-8],bw=496/NB.length;
  x.fillStyle='#4f7a9a';x.font='600 12px '+FONT;x.fillText('マスコン',8,318);
  NB.forEach((v,i)=>{const bx=8+i*bw,on=v===ncur;
    x.fillStyle=on?(v>0?'#3ddc84':v===0?'#dfe9f2':(v<=-8?'#ff4b3c':'#ffb03a')):'#0d2135';
    x.fillRect(bx,322,bw-2,20);
    x.fillStyle=on?'#04121c':'#4f7a9a';x.font='700 11px '+FONT;x.textAlign='center';
    x.fillText(v>0?'P'+v:v===0?'N':(v<=-8?'EB':'B'+(-v)),bx+bw/2-1,336);});
  x.textAlign='left';const nst=stOf(G.nv),dd=stopDist(G.nv),atS=G.atStation!==null?stOf(G.atStation):null;
  x.fillStyle='#0a1c2b';x.fillRect(0,348,512,36);
  x.fillStyle='#8fd6ff';x.font='600 15px '+FONT;x.fillText(atS?'停車中':'次は',10,371);
  x.fillStyle='#fff';x.font='700 24px '+FONT;x.fillText((atS||nst||{name:''}).name,60,372);
  x.textAlign='right';x.fillStyle='#ffd23f';x.font='700 22px '+FONT;
  x.fillText(atS?(localSide(atS)<0?'左扉':'右扉'):(Math.abs(dd)>=100?Math.round(Math.abs(dd))+' m':Math.abs(dd).toFixed(1)+' m'),500,372);x.textAlign='left';
  CANV.S.tex.needsUpdate=true;
}
function drawInfo(){
  const x=CANV.I.x,now=nowMs();x.setTransform(2,0,0,2,0,0);x.fillStyle='#061226';x.fillRect(0,0,512,384);x.textBaseline='alphabetic';
  if(G.phase==='title'){header(x,'汐見環状線 3Dトレインシミュレーター');x.textAlign='center';x.fillStyle='#8fd6ff';x.font='700 26px '+FONT;x.fillText('ホーム画面で路線を選んでください',256,200);
  }else{header(x,ROUTES[G.route].name+'　ワンマン');x.textAlign='left';
    const si=G.atStation!==null?G.atStation:G.depCheck;
    if(si!==null&&si!==undefined){const st=stOf(si);x.fillStyle=G.waiting?'#ffd23f':'#9fb0c8';x.font='500 20px '+FONT;x.fillText(G.waiting?'待ち合わせ中（後続 '+G.waiting.n+' 本）':'停車中'+(st.type==='twin'?'　'+PLATNO[G.key]+'番線':''),16,80);
      x.fillStyle='#fff';x.font='700 60px '+FONT;x.fillText(st.name,16,144);
      x.fillStyle='#bfe3ff';x.font='600 21px '+FONT;x.fillText(st.yomi||'',18,172);
      const open=G.door.state!=='closed';x.fillStyle='#8fd6ff';x.font='700 26px '+FONT;
      x.fillText(open?(pending()?'乗り降り中…':'乗降促進 → 戸閉'):(G.list&&G.nv>lastStop()?'ホームに出て折り返し':'ATOで出発できます'),16,214);
      x.fillStyle='#9fb0c8';x.font='500 20px '+FONT;x.fillText(G.list&&si>=G.list.length-1?'終点です　ホームに出て反対の運転室へ':'次は '+stOf(si+1).name+(G.plan[si+1]?'　着 '+hm(G.plan[si+1].arr):''),16,248);
    }else{const st=stOf(G.nv),d=stopDist(G.nv);x.fillStyle='#9fb0c8';x.font='500 20px '+FONT;x.fillText('次は　'+(localSide(st)<0?'左扉':'右扉')+(transferLines(st).length?'　乗換駅':''),16,80);
      x.fillStyle='#fff';x.font='700 60px '+FONT;x.fillText(st.name,16,144);
      x.fillStyle='#bfe3ff';x.font='600 21px '+FONT;x.fillText(st.yomi||'',18,172);
      x.fillStyle='#9fb0c8';x.font='500 20px '+FONT;x.fillText('停止位置まで',16,202);
      x.fillStyle=Math.abs(d)<100?'#ffd23f':'#fff';x.font='700 50px '+FONT;x.fillText(Math.abs(d)>=100?Math.round(d)+' m':d.toFixed(1)+' m',16,248);
      if(G.plan[G.nv]){x.fillStyle='#9fb0c8';x.font='500 18px '+FONT;x.fillText('到着予定',300,190);x.fillStyle='#fff';x.font='700 30px '+FONT;x.fillText(hms(G.plan[G.nv].arr),300,228);}
      if(G.arrKey&&st.type==='twin'){x.fillStyle='#1d3f7a';x.fillRect(300,56,196,40);x.fillStyle='#fff';x.font='700 24px '+FONT;x.fillText(PLATNO[G.arrKey]+'番線に到着',312,84);}}
    const closed=G.door.state==='closed';x.fillStyle=closed?'#ffae3a':'#c23a2a';x.fillRect(16,262,120,44);x.fillStyle=closed?'#1a1006':'#fff';
    x.font='700 26px '+FONT;x.textAlign='center';x.fillText(closed?'戸閉':({open:'戸開',opening:'開扉中',closing:'閉扉中'})[G.door.state],76,294);
    x.fillStyle=G.ato?'#1f9a5a':'#1e2a3d';x.fillRect(150,262,120,44);x.fillStyle=G.ato?'#fff':'#5d6f8c';x.fillText('ATO',210,294);
    /* 車両状態（TIMS）のミニ表示：側面パネルを見なくても状態がわかる */
    {const nn=(G.manual||G.manualOverride)?(G.mnotch||0):(G.notch||0);x.fillStyle='#0a1c2b';x.fillRect(286,262,212,44);
      x.fillStyle='#5f89a8';x.font='600 12px '+FONT;x.textAlign='left';x.fillText('TIMS',294,277);
      x.fillStyle=G.troubleActive?'#ffb03a':'#7cf0b0';x.font='600 13px '+FONT;x.fillText(G.troubleActive?'要注意':'異常なし',336,277);
      x.fillStyle='#9fd8ff';x.font='600 13px '+FONT;x.fillText('BC '+Math.round(G.bc)+'　MR '+Math.round(G.mr),294,296);
      x.fillStyle=nn>0?'#7cf0b0':nn===0?'#cfe0f0':'#ffb03a';x.font='700 13px '+FONT;x.fillText(nn>0?'力行P'+nn:nn===0?'惰行':(nn<=-8?'非常':'制動B'+(-nn)),420,296);}
  }
  if(G.msg&&now-G.msg.t<5000&&G.phase==='play'){x.fillStyle='rgba(0,0,0,.8)';x.fillRect(0,316,512,68);x.fillStyle=CLS[G.msg.cls]||'#fff';x.fillRect(0,316,8,68);
    x.font='700 24px '+FONT;x.textAlign='left';x.fillStyle='#fff';wrap(x,G.msg.text,18,346,484,28,1);}
  CANV.I.tex.needsUpdate=true;
}
// route map geometry
const MAPPTS=[];{let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<L;i+=50){mnx=Math.min(mnx,px[i]);mxx=Math.max(mxx,px[i]);mnz=Math.min(mnz,pz[i]);mxz=Math.max(mxz,pz[i]);}
  const sc=200/Math.max(mxx-mnx,mxz-mnz);var mapXY=s=>{const p=P(s);return [22+(p[0]-mnx)*sc+(200-(mxx-mnx)*sc)/2,70+(p[1]-mnz)*sc+(200-(mxz-mnz)*sc)/2];};}
function drawMap(){ /* 停車駅一覧（路線図なし） */
  const x=CANV.M.x;x.setTransform(2,0,0,2,0,0);x.fillStyle='#061226';x.fillRect(0,0,512,384);header(x,'停車駅');x.textBaseline='alphabetic';
  x.textAlign='left';x.font='500 16px '+FONT;x.fillStyle='#9fb0c8';x.fillText('駅',22,68);x.fillText('のりかえ',228,68);x.fillText('着(予定)',392,68);
  const v0=G.atStation!==null?G.atStation:G.nv,ROWS=10,RH=28;
  for(let k=0;k<ROWS;k++){const v=v0+k;if(G.list&&v>lastStop())break;const st=stOf(v),y=98+k*RH;
    x.fillStyle=k===0?'#24406e':k%2?'#0b1b33':'#0f2240';x.fillRect(10,y-20,492,RH-2);
    x.fillStyle=st.big?'#ffd23f':'#fff';fitText(x,st.name,22,y,196,22,'700');
    const tl=transferLines(st).map(l=>l[0]);if(tl.length){x.fillStyle='#8fd6ff';fitText(x,tl.join('・'),228,y,152,15,'500');}
    x.fillStyle='#fff';x.font='500 20px '+FONT;x.textAlign='left';const pl=G.plan[v];x.fillText(k===0&&G.atStation!==null?'停車中':pl?hms(pl.arr):'—',392,y);}
  x.font='500 14px '+FONT;x.fillStyle='#e8731e';x.textAlign='left';x.fillText(BRANCH?'白峰支線（各駅停車）':ROUTES[G.route].short+'　黄色＝主要駅',16,376);
  CANV.M.tex.needsUpdate=true;
}
const MONBTN={x:256,y:684,w:512,h:84}; // 1024×768 のオーバーレイ上。以前（512×384で幅いっぱい）と同じ実寸
function drawSideOverlayOld(k,st,active){const x=CANV[k].x;x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,1024,768);x.setTransform(2,0,0,2,0,0); /* 512×384の座標で描く */
  const tag=(t,x0,y)=>{x.font='700 26px '+FONT;const w=x.measureText(t).width+16;x.fillStyle='rgba(0,0,0,.6)';x.fillRect(x0,y,w,34);x.fillStyle='#e8f0ff';x.textAlign='left';x.textBaseline='middle';x.fillText(t,x0+8,y+18);};
  const nm=k==='L'?'左':'右',MQ=monQuads();x.fillStyle='rgba(0,0,0,.85)';x.fillRect(0,190,512,4);
  tag(nm+' 1〜'+MQ[0].n+'両'+(active&&st?'　'+st.name:''),6,6);tag(MQ[1]?nm+' '+(MQ[1].i0+1)+'〜'+(MQ[1].i0+MQ[1].n)+'両':nm+' ―',6,200);
  x.textAlign='right';x.font='700 24px '+FONT;x.fillStyle='rgba(0,0,0,.6)';x.fillRect(372,346,134,32);x.fillStyle='#e8f0ff';x.fillText(hms(nowMs()),500,363);
  if(G.zoom===k&&camTouchOn()){const local=(k==='L'?-1:1)*SIDEINV,D=G.door,stn=stOf(G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv),okSide=localSide(stn)===local;
    const open=(D.state==='open'||D.state==='opening')&&D.local===local;
    const btns=[['戸開',okSide&&D.state==='closed','#e8e4d8','#111'],['戸閉',open,'#c22f28','#fff'],[G.promoOn?'再生中':'乗降促進',open&&!G.promoOn,'#e0a21a','#111']];
    x.fillStyle='rgba(0,0,0,.72)';x.fillRect(0,300,512,84);
    btns.forEach(([t,en,bg,fg],i)=>{const bx=i*(512/3)+6,bw=512/3-12;x.globalAlpha=en?1:0.35;x.fillStyle=bg;x.fillRect(bx,308,bw,68);x.fillStyle=fg;x.font='700 30px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(t,bx+bw/2,343);x.globalAlpha=1;});
    x.fillStyle='rgba(0,0,0,.6)';x.fillRect(372,262,134,32);x.fillStyle='#e8f0ff';x.font='700 22px '+FONT;x.textAlign='right';x.fillText(okSide?'ホーム側':'反対側',500,279);}
  x.setTransform(1,0,0,1,0,0);CANV[k].tex.needsUpdate=true;}
function drawSideOverlay(k,st,active){const D0=G.door,sig=[hms(nowMs()),st?st.name:'',active,G.zoom,camTouchOn(),D0.state,D0.local,G.promoOn,ownTrain.cars.length].join('|');
  if(CANV[k].sig===sig)return;CANV[k].sig=sig;
  if(OLDMON){drawSideOverlayOld(k,st,active);return;}
  const x=CANV[k].x,CW=1024,CH=768;x.clearRect(0,0,CW,CH);
  const tag=(t,x0,y)=>{x.font='700 26px '+FONT;const w=x.measureText(t).width+16;x.fillStyle='rgba(0,0,0,.6)';x.fillRect(x0,y,w,34);x.fillStyle='#e8f0ff';x.textAlign='left';x.textBaseline='middle';x.fillText(t,x0+8,y+18);};
  const nm=k==='L'?'左':'右',MQ=monQuads();
  x.fillStyle='rgba(0,0,0,.85)';x.fillRect(CW/2-2,0,4,CH);x.fillRect(0,CH/2-2,CW,4); // 4分割の仕切り
  MQ.forEach((Q,q)=>{const x0=(q%2)*CW/2+6,y0=(q<2?0:CH/2)+6;tag(Q?nm+' '+(Q.i0+1)+'〜'+(Q.i0+Q.n)+'号車'+(q===0&&active?'　'+st.name:''):nm+' ―',x0,y0);});
  x.textAlign='right';x.font='700 24px '+FONT;x.fillStyle='rgba(0,0,0,.6)';x.fillRect(CW-140,CH-38,134,32);x.fillStyle='#e8f0ff';x.fillText(hms(nowMs()),CW-12,CH-21);
  if(G.zoom===k&&camTouchOn()){const local=(k==='L'?-1:1)*SIDEINV,D=G.door,stn=stOf(G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv),okSide=localSide(stn)===local;
    const open=(D.state==='open'||D.state==='opening')&&D.local===local,B=MONBTN;
    const btns=[['戸開',okSide&&D.state==='closed','#e8e4d8','#111'],['戸閉',open,'#c22f28','#fff'],[G.promoOn?'再生中':'乗降促進',open&&!G.promoOn,'#e0a21a','#111']];
    x.fillStyle='rgba(0,0,0,.72)';x.fillRect(B.x,B.y,B.w,B.h);
    btns.forEach(([t,en,bg,fg],i)=>{const bx=B.x+i*(B.w/3)+6,bw=B.w/3-12;x.globalAlpha=en?1:0.35;x.fillStyle=bg;x.fillRect(bx,B.y+8,bw,68);x.fillStyle=fg;x.font='700 30px '+FONT;x.textAlign='center';x.textBaseline='middle';x.fillText(t,bx+bw/2,B.y+43);x.globalAlpha=1;});
    x.fillStyle='rgba(0,0,0,.6)';x.fillRect(B.x+B.w-134,B.y-40,134,32);x.fillStyle='#e8f0ff';x.font='700 22px '+FONT;x.textAlign='right';x.fillText(okSide?'ホーム側':'反対側',B.x+B.w-8,B.y-23);}
  CANV[k].tex.needsUpdate=true;}
let _itvTmpC=null,_itvTmpPx=null;
function drawCrewItvPanel(ms,side,MQ){
  const cv=document.getElementById('crewItvCanvas');if(!cv)return;
  const x=cv.getContext('2d'),W=512,H=384;
  x.fillStyle='#071226';x.fillRect(0,0,W,H);
  const info=document.getElementById('crewItvInfo');
  if(!ms){
    x.fillStyle='#94a3b8';x.font='700 22px '+FONT;x.textAlign='center';x.textBaseline='middle';
    x.fillText('走行中（駅接近でホーム映像を表示）',W/2,H/2);
    if(info)info.textContent='走行中・駅接近時にホーム全体を表示します';
    return;
  }
  const k=side*SIDEINV<0?'L':'R',nm=side<0?'左ホーム':'右ホーム';
  for(let q=0;q<4;q++){
    const Q=MQ[q],qx=(q%2)*(W/2),qy=Math.floor(q/2)*(H/2),qw=W/2,qh=H/2;
    const rt=RT[k+q];
    if(Q&&rt){
      const rw=rt.width,rh=rt.height;
      if(!_itvTmpC){_itvTmpC=document.createElement('canvas');}
      if(_itvTmpC.width!==rw||_itvTmpC.height!==rh){_itvTmpC.width=rw;_itvTmpC.height=rh;_itvTmpPx=new Uint8Array(rw*rh*4);}
      try{
        renderer.readRenderTargetPixels(rt,0,0,rw,rh,_itvTmpPx);
        const tc=_itvTmpC.getContext('2d'),img=tc.createImageData(rw,rh);
        img.data.set(_itvTmpPx);tc.putImageData(img,0,0);
        x.save();x.translate(qx,qy+qh);x.scale(1,-1);x.drawImage(_itvTmpC,0,0,qw,qh);x.restore();
      }catch(e){}
      x.fillStyle='rgba(0,0,0,0.62)';x.fillRect(qx+4,qy+4,126,22);
      x.fillStyle='#e2e8f0';x.font='700 13px '+FONT;x.textAlign='left';x.textBaseline='middle';
      x.fillText((Q.i0+1)+'〜'+(Q.i0+Q.n)+'号車',qx+10,qy+15);
    }else{
      x.fillStyle='#0b1a33';x.fillRect(qx,qy,qw,qh);
      x.fillStyle='#64748b';x.font='700 14px '+FONT;x.textAlign='center';x.textBaseline='middle';
      x.fillText('―',qx+qw/2,qy+qh/2);
    }
  }
  x.strokeStyle='rgba(56,189,248,0.6)';x.lineWidth=2;
  x.beginPath();x.moveTo(W/2,0);x.lineTo(W/2,H);x.moveTo(0,H/2);x.lineTo(W,H/2);x.stroke();
  const D=G.door,dLbl=D.state==='open'?'ドア開':D.state==='opening'?'開扉中':D.state==='closing'?'閉扉中':'ドア閉';
  if(info)info.textContent=ms.name+'駅（'+nm+'） ・ '+dLbl+' ・ '+hms(nowMs());
}
function drawPanel(){const x=CANV.T.x,W=512,H=284;x.fillStyle='#07101e';x.fillRect(0,0,W,H);x.textBaseline='middle';x.textAlign='center';
  if(G.panel==='ann'||G.panel==='promo'){const pr=G.panel==='promo';x.fillStyle=pr?'#5a4410':'#0d2a52';x.fillRect(0,0,W,52);x.fillStyle='#fff';x.font='700 24px '+FONT;x.textAlign='left';x.fillText(pr?'乗降促進を選択':'放送を選択',14,27);
    x.fillStyle='#34445e';x.fillRect(392,8,112,36);x.fillStyle='#fff';x.textAlign='center';x.font='700 20px '+FONT;x.fillText('戻る',448,27);
    const dp=defaultPromo(),bS=BRANCH&&G.atStation!==null?stOf(G.atStation):null,opts=pr?[
      [bS?'駅メロディ':'外回り「汐鳴り」',bS?'「'+branchSongFor(bS).name+'」＋放送':'外回り専用（明るく爽快）'],
      ['音声のみ','ドアが閉まります'],
      ['内回り「潮風」','内回り専用（温かく落ち着き）'],
      ['快特「グラン汐見」','快速特急専用（豪華旋律）']
    ].map((o,i)=>i===dp?[o[0],'★既定　'+o[1]]:o)
      :[['案内放送',G.atStation!==null||G.depCheck!==null?'〇〇方面行き':'この先の停車駅'],['遅れのお詫び',''],['しばらく停車',''],['まもなく発車','ドアが閉まります']];
    opts.forEach(([t,sub],i)=>{const bx=(i%2)*256+6,by=58+Math.floor(i/2)*113;x.fillStyle=pr?'#6b4f12':'#1c3d6e';x.fillRect(bx,by,244,105);x.fillStyle='#fff';x.font='700 28px '+FONT;x.fillText((i+1)+'. '+t,bx+122,by+(sub?42:52));
      if(sub){x.fillStyle='#d6dde8';x.font='500 17px '+FONT;x.fillText(sub,bx+122,by+76);}});}
  else if(G.tabNextAnn){
    const bw=2*(W/3)-10;
    const isSoon=G.tabAnnMode==='soon';
    x.fillStyle=isSoon?'#0284c7':'#1d4ed8';
    x.fillRect(5,8,bw,H-16);
    x.strokeStyle=isSoon?'#38bdf8':'#60a5fa';
    x.lineWidth=4;
    x.strokeRect(8,11,bw-6,H-22);
    x.fillStyle='#fff';
    x.font='700 40px '+FONT;
    x.fillText(isSoon?'📢 まもなく放送':'📢 次駅放送',5+bw/2,H/2-22);
    const nst=stOf(G.nv);
    x.fillStyle='#bfdbfe';
    x.font='700 20px '+FONT;
    x.fillText((isSoon?'まもなく ':'次は ')+(nst?nst.name:'')+'（タップで放送）',5+bw/2,H/2+28);

    const bx=2*(W/3)+5,cw=W/3-10,isB2=(LINE_ID==='branch2'),hElecOn=(!!_activeHorn&&_activeHorn.kind==='elec')||(!_activeHorn&&nowMs()-G.hornT<600&&(!isB2||G.hornKind==='elec')),hAirOn=(!!_activeHorn&&_activeHorn.kind==='air')||(!_activeHorn&&nowMs()-G.hornT<600&&G.hornKind==='air'),mOn=nowMs()-(G.mhornT||0)<1600;
    x.fillStyle=hElecOn?'#e8e8e8':'#3a3e44';x.fillRect(bx,8,cw,126);x.fillStyle=hElecOn?'#111':'#fff';x.font='700 34px '+FONT;x.fillText(isB2?'電気笛':'警笛',bx+cw/2,56);x.font='600 16px '+FONT;x.fillText('長押しで鳴動',bx+cw/2,98);
    if(isB2){x.fillStyle=hAirOn?'#e8e8e8':'#4a4e56';x.fillRect(bx,146,cw,130);x.fillStyle=hAirOn?'#111':'#fff';x.font='700 34px '+FONT;x.fillText('空気笛',bx+cw/2,196);x.font='600 16px '+FONT;x.fillText('長押しで鳴動',bx+cw/2,238);}
    else{x.fillStyle=mOn?'#f2c230':'#6a3fa0';x.fillRect(bx,146,cw,130);x.fillStyle=mOn?'#111':'#fff';x.font='700 24px '+FONT;x.fillText('ミュージック',bx+cw/2,196);x.fillText('ホーン',bx+cw/2,228);}
  }
  else{const cw=W/3-10;
    [['乗降促進',G.promoOn?'#e0a21a':'#5a4410',G.promoOn?'再生中':'4種類'],['放送','#2e63a3','4種類']].forEach(([t,c,sub],i)=>{const bx=i*(W/3)+5;x.fillStyle=c;x.fillRect(bx,8,cw,H-16);
      x.fillStyle=(G.promoOn&&i===0)?'#111':'#fff';x.font='700 38px '+FONT;x.fillText(t,bx+cw/2,H/2-16);x.font='500 18px '+FONT;x.fillText(sub,bx+cw/2,H/2+30);});
    const bx=2*(W/3)+5,isB2=(LINE_ID==='branch2'),hElecOn=(!!_activeHorn&&_activeHorn.kind==='elec')||(!_activeHorn&&nowMs()-G.hornT<600&&(!isB2||G.hornKind==='elec')),hAirOn=(!!_activeHorn&&_activeHorn.kind==='air')||(!_activeHorn&&nowMs()-G.hornT<600&&G.hornKind==='air'),mOn=nowMs()-(G.mhornT||0)<1600;
    x.fillStyle=hElecOn?'#e8e8e8':'#3a3e44';x.fillRect(bx,8,cw,126);x.fillStyle=hElecOn?'#111':'#fff';x.font='700 34px '+FONT;x.fillText(isB2?'電気笛':'警笛',bx+cw/2,56);x.font='600 16px '+FONT;x.fillText('長押しで鳴動',bx+cw/2,98);
    if(isB2){x.fillStyle=hAirOn?'#e8e8e8':'#4a4e56';x.fillRect(bx,146,cw,130);x.fillStyle=hAirOn?'#111':'#fff';x.font='700 34px '+FONT;x.fillText('空気笛',bx+cw/2,196);x.font='600 16px '+FONT;x.fillText('長押しで鳴動',bx+cw/2,238);}
    else{x.fillStyle=mOn?'#f2c230':'#6a3fa0';x.fillRect(bx,146,cw,130);x.fillStyle=mOn?'#111':'#fff';x.font='700 24px '+FONT;x.fillText('ミュージック',bx+cw/2,196);x.fillText('ホーン',bx+cw/2,228);}}
  CANV.T.tex.needsUpdate=true;}
/* 新形運転台：側面パネル（WL=駅・時刻、WR=車両情報TIMS） */
function drawCabSide(){
  const now=nowMs(),ncur=G.manual?(G.mnotch||0):(G.notch||0),d=new Date(now);
  /* ---- 左：駅・時刻案内 ---- */
  {const x=CANV2.WL.x,W=640,H=384;x.fillStyle='#04101c';x.fillRect(0,0,W,H);x.textBaseline='middle';
    x.fillStyle='#0a1e2d';x.fillRect(0,0,W,44);x.fillStyle='#2fd0ff';x.fillRect(0,42,W,2);
    x.fillStyle='#8fd6ff';x.font='700 22px '+FONT;x.textAlign='left';x.fillText('駅・時刻案内',14,23);
    x.textAlign='right';x.fillStyle='#6d8aa6';x.font='600 18px '+FONT;x.fillText(ROUTES[G.route]?ROUTES[G.route].short:'',W-14,23);
    x.textAlign='center';x.fillStyle='#f2fbff';x.font='700 86px '+FONT;x.fillText(hms(now),W/2,112);
    x.fillStyle='#6d8aa6';x.font='600 17px '+FONT;x.fillText((d.getMonth()+1)+'月'+d.getDate()+'日　'+['日','月','火','水','木','金','土'][d.getDay()]+'曜日',W/2,162);
    const atS=G.atStation!==null?stOf(G.atStation):null,st=atS||stOf(G.nv);
    x.fillStyle='#0b2436';x.fillRect(14,182,W-28,116);
    x.fillStyle='#7fd7ff';x.font='600 19px '+FONT;x.fillText(atS?'停車中　Now at':'次は　Next',W/2,206);
    if(st){x.fillStyle='#fff';x.font='700 54px '+FONT;x.fillText(st.name,W/2,248);
      x.fillStyle='#bcd6f0';x.font='500 19px '+FONT;x.fillText(st.kana,W/2,280);}
    x.fillStyle='#0a1c2b';x.fillRect(14,308,W-28,62);
    x.textAlign='left';x.fillStyle='#5f89a8';x.font='600 15px '+FONT;x.fillText('種別',22,330);x.fillText('行先',22,352);x.fillText('両数',340,330);x.fillText('制限',340,352);
    x.fillStyle='#eaf6ff';x.font='700 18px '+FONT;x.fillText(BRANCH?'普通':(KINDNAME[G.key]||''),74,330);
    x.fillText(G.list?STATIONS[G.list[G.list.length-1]].name:'—',74,352);
    x.fillText(ownTrain.cars.length+' 両',398,330);
    x.fillStyle='#ffd23f';x.fillText(limitFor(G.key,G.s)+' km/h',398,352);
    CANV2.WL.tex.needsUpdate=true;}
  /* ---- 右：車両情報TIMS ---- */
  {const x=CANV2.WR.x,W=640,H=384;x.fillStyle='#04101c';x.fillRect(0,0,W,H);x.textBaseline='middle';
    x.fillStyle='#0a1e2d';x.fillRect(0,0,W,44);x.fillStyle='#2fd0ff';x.fillRect(0,42,W,2);
    x.fillStyle='#8fd6ff';x.font='700 22px '+FONT;x.textAlign='left';x.fillText('車両情報  TIMS',14,23);
    x.textAlign='right';x.fillStyle='#6d8aa6';x.font='600 16px '+FONT;x.fillText('編成 '+ownTrain.cars.length+'両',W-14,23);
    const tile=(tx,ty,tw,th,label,val,col,sub)=>{x.fillStyle='#0b1f30';x.fillRect(tx,ty,tw,th);x.fillStyle='#1b3a52';x.fillRect(tx,ty,tw,1);
      x.textAlign='left';x.fillStyle='#5f89a8';x.font='600 15px '+FONT;x.fillText(label,tx+12,ty+22);
      x.fillStyle=col||'#eaf6ff';x.font='700 34px '+FONT;x.fillText(val,tx+12,ty+58);
      if(sub){x.fillStyle='#5f89a8';x.font='500 14px '+FONT;x.fillText(sub,tx+12,ty+84);}};
    const I=ncur>0?Math.round(ncur*110+40):(ncur<0&&G.v>1?Math.round(-G.v*3.6*1.4):8);
    tile(14,58,300,96,'主回路電圧',(1.5+0.015*Math.sin(now/900)).toFixed(2)+' kV','#7cf0b0','架線 1,500V');
    tile(326,58,300,96,'主回路電流',I+' A',(ncur<0&&G.v>1)?'#ffd23f':'#9fd8ff',(ncur<0&&G.v>1)?'回生制動中':'力行電流');
    tile(14,160,300,96,'力行／制動',ncur>0?'力行 P'+ncur:ncur===0?'惰行 N':(ncur<=-8?'非常 EB':'制動 B'+(-ncur)),ncur>0?'#7cf0b0':ncur===0?'#cfe0f0':'#ffb03a',G.manual?'手動ノッチ':'ATO');
    tile(326,160,300,96,'空気ブレーキ','BC '+Math.round(G.bc),'#9fd8ff','元空気ダメ '+Math.round(G.mr));
    const cl=G.door.state==='closed';
    x.fillStyle='#0b1f30';x.fillRect(14,262,300,96);x.fillStyle='#1b3a52';x.fillRect(14,262,300,1);
    x.textAlign='left';x.fillStyle='#5f89a8';x.font='600 15px '+FONT;x.fillText('戸閉・ドア',26,284);
    x.fillStyle=cl?'#1d4d3a':'#5a2418';x.fillRect(26,300,150,40);x.fillStyle=cl?'#7cf0b0':'#ffd0c0';x.font='700 24px '+FONT;x.textAlign='center';
    x.fillText(cl?'全閉':({open:'開扉',opening:'開扉中',closing:'閉扉中'})[G.door.state],101,321);
    x.textAlign='left';x.fillStyle='#5f89a8';x.font='500 14px '+FONT;x.fillText('左 '+({open:'開',closed:'閉'})[G.door.state]+' ／ 右 '+({open:'開',closed:'閉'})[G.door.state],26,352);
    x.fillStyle='#0b1f30';x.fillRect(326,262,300,96);x.fillStyle='#1b3a52';x.fillRect(326,262,300,1);
    x.textAlign='left';x.fillStyle='#5f89a8';x.font='600 15px '+FONT;x.fillText('車両状態',338,284);
    x.fillStyle=G.troubleActive?'#ffb03a':'#7cf0b0';x.font='700 26px '+FONT;x.fillText(G.troubleActive?'要注意（指令対応中）':'異常なし',338,318);
    x.fillStyle='#5f89a8';x.font='500 14px '+FONT;x.fillText('VVVF・空調 稼働中',338,346);
    CANV2.WR.tex.needsUpdate=true;}
}
function updButtons(t){
  const D=G.door,blink=(Math.floor(t/450)%2)===0;const set=(k,lvl)=>{if(!BTN[k])return;BTN[k].mat.color.setHex(lvl===2?(blink?0xffffff:0xa0a0a0):lvl===1?0xffffff:0x9a9a9a);};
  const st=stOf(G.nv),d=stopDist(G.nv),canOpen=G.phase==='play'&&D.state==='closed'&&G.v===0&&G.atStation===null&&G.depCheck===null&&d>-6.5&&d<17.9&&!sigStopped();
  const lsd=localSide(st)*SIDEINV,dl=D.local*SIDEINV;set('lo',canOpen&&lsd<0?2:0);set('ro',canOpen&&lsd>0?2:0);
  const open=D.state==='open'||D.state==='opening',done=open&&!pending(),pr=G.atStation!==null&&G.promoted[G.atStation];
  set('lc',done&&dl<0&&(pr||G.atStation===null)&&!G.promoOn?2:open&&dl<0?1:0);set('rc',done&&dl>0&&(pr||G.atStation===null)&&!G.promoOn?2:open&&dl>0?1:0);
  set('ato',G.ato?1:(G.phase==='play'&&D.state==='closed'&&G.v===0&&!canOpen&&!G.lean)?2:0);set('auto',G.auto?1:0);
}
/* ================= view ================= */
const wrapA=a=>{a=(a+Math.PI)%(2*Math.PI);if(a<0)a+=2*Math.PI;return a-Math.PI;};
let portrait=false;
function applyView(){const W=innerWidth,H=innerHeight;portrait=H>W;camera.aspect=W/H;
  camera.fov=portrait?80:clamp(2*Math.atan(Math.tan(43*Math.PI/180)/camera.aspect)*180/Math.PI,44,75);camera.updateProjectionMatrix();renderer.setSize(W,H);}
function monStation(){if(G.atStation!==null)return stOf(G.atStation);if(G.depCheck!==null)return stOf(G.depCheck);const d=stopDist(G.nv);return d<260&&d>-10?stOf(G.nv):null;}
function zoomTo(k){if(!ZOOM[k])return;G.zoom=G.zoom===k?null:k;}
const camTarget=new THREE.Vector3();let camYaw=0,camPitch=-0.19;
function updCamera(dt,now){let yaw,pitch;

  if(G.lean){camTarget.set(G.lean*1.8,YE+0.03,1.35);yaw=Math.PI-G.lean*0.12+G.lookY;pitch=-0.16-G.lookP;}
  else if(G.zoom&&MON[G.zoom]){
    const mg=MON[G.zoom].g,sc=(G.zoom==='L'||G.zoom==='R')?MONBIG:1,dist=(portrait?0.32:0.24)*sc;
    const wc=new THREE.Vector3(),wq=new THREE.Quaternion(),wn=new THREE.Vector3(0,0,1);
    mg.getWorldPosition(wc);mg.getWorldQuaternion(wq);wn.applyQuaternion(wq);
    rig.worldToLocal(wc);
    const wt=wc.clone().addScaledVector(wn.applyQuaternion(rig.quaternion.clone().invert()),dist);
    camTarget.copy(wt);
    const dx=wc.x-camTarget.x,dy=wc.y-camTarget.y,dz=wc.z-camTarget.z;yaw=Math.atan2(-dx,-dz);pitch=Math.atan2(dy,Math.hypot(dx,dz));}
  else{const e=portrait?EYE_P:EYE_L;camTarget.copy(e.p);camTarget.y+=Math.sin(now*0.011)*(0.0012+Math.min(0.006,G.lat*0.006))*Math.min(1,G.v/15);yaw=G.lookY;pitch=e.pitch-G.lookP;}
  const k=1-Math.exp(-dt*9);camera.position.lerp(camTarget,k);yaw=camYaw+wrapA(yaw-camYaw);camYaw+=(yaw-camYaw)*k;camYaw=wrapA(camYaw);camPitch+=(pitch-camPitch)*k;camera.rotation.set(camPitch,camYaw,0);}

/* ================= input ================= */
/* ================= start (called by the home screen) ================= */
function isTripNoticeDay(){
  if(typeof location!=='undefined'&&location.search.indexOf('testNotice=1')>=0)return true;
  const jst=new Date(Date.now()+9*3600*1000);
  return jst.getUTCFullYear()===2026&&jst.getUTCMonth()+1===11&&(jst.getUTCDate()===19||jst.getUTCDate()===20);
}
let _tripNoticeAudio=null;
function stopTripNoticeAudio(){if(_tripNoticeAudio){try{_tripNoticeAudio.pause();_tripNoticeAudio.currentTime=0;}catch(e){}_tripNoticeAudio=null;}}
function playTripNoticeAudio(){
  stopTripNoticeAudio();
  try{
    const a=new Audio('assets/audio/ann/notice_20261119.mp3');
    _tripNoticeAudio=a;
    a.play().catch(()=>{});
  }catch(e){}
}
function showTripNoticeIfNeeded(){
  if(!isTripNoticeDay())return;
  const mod=document.getElementById('tripNoticeModal');
  if(!mod)return;
  window.__TRIP_NOTICE_OPEN=true;
  window.__TRIP_NOTICE_RENDERED=false;
  mod.style.display='flex';
  playTripNoticeAudio();
  const btnOk=document.getElementById('btnTripNoticeOk');
  const btnAud=document.getElementById('btnTripNoticeAudio');
  if(btnAud&&!btnAud._bound){btnAud._bound=true;btnAud.onclick=()=>playTripNoticeAudio();}
  if(btnOk&&!btnOk._bound){
    btnOk._bound=true;
    btnOk.onclick=()=>{stopTripNoticeAudio();mod.style.display='none';window.__TRIP_NOTICE_OPEN=false;};
  }
}
function startRoute(r,si){const R=SERVICES[r];initAudio();unlockSpeech();try{preloadGuides();}catch(e){}if(R.kind==='staff'){startPassenger(si);return;}
  if(R.kind!=='pax'){G.load=(R.kind==='test')?0:trainLoadFor(R.key||'A');setTimeout(()=>{if(!PAX)salFill((R.kind==='test')?0:saloonFromLoad(G.load,carsFor(R.key||'A')));},50);}
  if(R.kind==='pax'){G.route=r;startPassenger(si);return;}
  G.route=r;G.key=R.key;G.mainKey=G.key;G.dir=TK[G.key].dir;G.isTest=(R.kind==='test');G.isExtra=(R.kind==='extra');G.isCharter=(R.kind==='charter');G.rsManual=null;
  {const needCars=carsFor(G.key),needGreen=greenCarsFor(G.key);
    if(ownTrain.cars.length!==needCars){disposeTrain(ownTrain);ownTrain=buildTrain('普通',false,0x14935f,true,needGreen,needCars,BRANCH?OWNOLD:undefined);ownTrain.grp.traverse(o=>o.layers.set(1));if(OWNAI)OWNAI.tr=ownTrain;}}
  if(R.branch){const idx=STATIONS.filter(s=>serves(s,R.key)).map(s=>s.i);G.list=R.dir>0?idx:idx.slice().reverse();}
  else{G.list=null;G.cyc=STATIONS.filter(st=>serves(st,G.key)).map(st=>st.i);if(G.dir<0)G.cyc=[G.cyc[0],...G.cyc.slice(1).reverse()];G.cpos=Math.max(0,G.cyc.indexOf(si));}
  /* 乗務（ここで前回、上の停車駅リストの設定を壊していた → ツーマンで発車しない・別の駅に出る原因） */
  G.manual=MINI&&!PAX;G.mnotch=-4;setTimeout(()=>{updMascon();if(G.manual)toast('港見支線は手動運転：右のマスコンで加速（Q）・ブレーキ（Z）','info');},1200);
  G.crew=(R&&(R.kind==='ltd'||R.kind==='local'||R.line==='branch3')&&!PAX)?CREWSEL:'one';G.twoMan=G.crew!=='one';G.condOK=false;G.cPh='';G.cT=0;
  if(G.crew==='twoC'){G.auto=true;setTimeout(()=>{try{buildAvatar();}catch(e){}},0);setTimeout(()=>toast('ツーマン（車掌）：最後尾の乗務員室に乗務します。車内巡回・ITVモニタ・ドアやメロディ操作が使えます','info'),2500);}
  else if(G.crew==='twoD')setTimeout(()=>toast('ツーマン（運転士）：ドア・乗降促進・放送は車掌。ブザー（合図）が鳴ったら発車できます','info'),2500);
  const st=STATIONS[si];G.arrKey=null;
  G.s=st.s+TK[G.key].so;G.nv=G.list?Math.max(0,G.list.indexOf(si)):0;G.atStation=G.nv;G.depCheck=null;G.depAt=G.s;
  /* 車庫（汐見車両基地）からの出庫：本線に入った位置から扉を閉めてスタート */
  if(DEPOT_START&&!BRANCH&&!PAX&&!MINI&&TK[G.key].dir>0){
    G.s=mod(DEPOT.b+120,L);G.atStation=null;G.depCheck=null;G.v=0;G.nv=0;G.depAt=G.s;G.depotJoinPending=true;
    G.door={state:'closed',frac:0,side:1,local:1};G.flowV=-1;
    setTimeout(()=>{if(G.phase!=='play')return;toast('汐見車両基地から出庫しました。信号を確認して汐見駅へ','ok','車庫から、出庫します。');},1400);
    setTimeout(()=>{if(G.phase==='play'){try{playGuide('depot_out');}catch(e){}}},2300);
  }
  /* ダイヤモード（臨時・団体／変更ダイヤ）：音声案内なし */
  if((DIASH==='extra'||G.isExtra||G.isCharter)&&!PAX)setTimeout(()=>{try{spawnCharter();}catch(e){}},2600);
  if((DIASH!=='normal'||G.isExtra||G.isCharter)&&!PAX){
    setTimeout(()=>{if(G.phase!=='play')return;
      toast((DIASH==='extra'||G.isExtra||G.isCharter)?'🎉 イベント・臨時・団体列車ダイヤ：臨時・団体列車が運転されています':'変更ダイヤ：停車駅が変更されています','ok');},3000);
  }
  try{preloadStationAnnounce(stOf(G.nv));}catch(e){}
  /* v2.5.0：試運転列車のAI運行と撮り鉄（試運転・臨時ダイヤ時に増える） */
  try{refreshCameraFans();}catch(e){}
  if(!BRANCH&&!PAX){
    setTimeout(()=>{try{if(G.phase==='play'&&testCount()===0)spawnTestRun();}catch(e){}},9000);
    if(window.__TEST_INT){try{clearInterval(window.__TEST_INT);}catch(e){}}
    window.__TEST_INT=setInterval(()=>{try{if(!G||G.phase!=='play')return;if(testCount()===0)spawnTestRun();}catch(e){}},5*60000);
  }
  G.tabNextAnn=false;G.tabDepSwitched=false;G.tabAnnMode=null;G.tabDepAnnDone=false;G.tabSoonAnnDone=false;
  G.autoAnn = (typeof autoAnnEnabled !== 'undefined') ? autoAnnEnabled : true;
  ownTrain.flip=G.dir<0;ownTrain.lastFrac=-1;setLook(ownTrain,G.key);if(G.list||G.isTest||G.isExtra||G.isCharter||G.rsManual)drawOwnDest();
  updChunks(G.s,true);
  if(!BRANCH&&!MINI){initSyncedAiTrains();for(const k of ALLK)for(const a of POOL[k])if(a.state!=='off'&&!a.tr)acquireAiTr(a);}
  try{if(typeof buildCabModel==='function')buildCabModel();}catch(e){}
  for(const p of active.slice())freePerson(p);for(const s2 of STATIONS){s2.sp={};s2.staff=null;for(const k in s2.wait)s2.wait[k].length=0;}
  spawnWait(st,G.key);updSpawns();
  const loc=localSide(st);G.door=(DEPOT_START&&!BRANCH&&!PAX&&TK[G.key].dir>0)?{state:'closed',frac:0,side:1,local:1}:{state:'open',frac:1,side:loc*G.dir,local:loc};
  G.phase='play';G._spawnMs=nowMs();clearAiAroundPlayerSpawn();G.zoom=null;G.flowV=(DEPOT_START&&!BRANCH&&!PAX)?-1:G.nv;G.asked=false;if(G.isTest){G.load=0;}else{if(G.load==null||G.load<10)G.load=trainLoadFor(G.key);if(!(DEPOT_START&&!BRANCH&&!PAX))startFlows(st,G.key,G.s,'OWN');}salFill(G.isTest?0:saloonFromLoad(G.load,carsFor(G.key)));planFrom(nowMs()+30000);
  const b=boundFor(); if(!window.__DISP_MONITOR) setTimeout(()=>sayJE('ご乗車ありがとうございます。この電車は、'+lineJa()+'、'+b.ja+'です。','Thank you for riding the '+R.en+'. This train is '+b.en+'.'),1800);
  toast(R.name+'　'+b.jn+'　乗り降りを見て、促進・戸閉・ATOで出発','info');
  if(!G.list&&(st.cls==='M'||st.i===0))setTimeout(()=>{if(G.atStation===G.nv)askStation(st,true);},2600);
  showTripNoticeIfNeeded();}
/* ===== v2.5.0：ゲーム内メニュー「🚉 乗り換え・方向幕・ダイヤ」 =====
   タイトルに戻らず、オンライン接続（MQTT）を保ったまま別の列車・路線に乗り換える。
   古い列車・AI同期・購読は boot() の先頭でクリーンアップされる。 */
function closeTransferPanel(){const el=document.getElementById('transferPanel');if(el)el.classList.add('hide');}
window.__closeTransfer=closeTransferPanel;
function transferSameStation(list,kind){
  const curSt=STATIONS[G.atStation!=null?G.atStation:G.nv];
  const curName=curSt?curSt.name:'';
  const ok=(kind==='pax'||kind==='staff')?list:stopsOf(list,kind);
  let hit=null;for(const st of ok)if(st.name===curName){hit=st;break;}
  if(!hit)hit=ok.find(st=>st.cls==='M')||ok.find(st=>st.cls==='X')||ok[0];
  return hit?hit.i:0;
}
window.__transferTo=function(id){
  const S=SERVICES[id];if(!S)return;
  const line=S.line||'loop';
  const CFG2=lineConfig(line);
  const ST2=(CFG2&&CFG2.L!=null)?layoutStations(CFG2):null;
  if(!ST2||!ST2.length)return;
  const curSt=STATIONS[G.atStation!=null?G.atStation:G.nv];
  const curName=curSt?curSt.name:'';
  const ok=(S.kind==='pax'||S.kind==='staff')?ST2:stopsOf(ST2,S.kind);
  let hit=null;for(const st of ok)if(st.name===curName){hit=st;break;}
  if(!hit)hit=ok.find(st=>st.cls==='M')||ok.find(st=>st.cls==='X')||ok[0];
  const si=hit?(hit.i||0):0;
  closeTransferPanel();
  try{toast('🚉 オンラインを維持したまま乗り換えます：'+S.name,'ok');}catch(e){}
  setTimeout(()=>{try{window.__boot(line,id,si);}catch(e){console.error(e);}},180);
};
window.__setDia=function(v){
  try{localStorage.setItem('td_dia',v);}catch(e){}
  const curSt=STATIONS[G.atStation!=null?G.atStation:G.nv];
  const si=curSt?curSt.i:0;
  closeTransferPanel();
  try{toast('🗓️ ダイヤを「'+DIA_NAME[v==='auto'?diaForDate(new Date()):v]+'」に設定して再出発します','ok');}catch(e){}
  setTimeout(()=>{try{window.__boot(LINE_ID,G.route,si);}catch(e){console.error(e);}},180);
};
window.__setRollSign=function(v){
  G.rsManual=v||null;
  if(v==='試運転'||v==='回送'){G.load=0;if(OWNAI){OWNAI.load=0;releaseInterior(OWNAI);}salFill(0);}
  try{drawOwnDest();}catch(e){}
  try{toast(v?('🚃 方向幕を「'+v+'」にしました'):'🚃 方向幕を自動（行先表示）に戻しました','ok');}catch(e){}
};
function openTransferPanel(){
  let el=document.getElementById('transferPanel');
  if(!el){
    el=document.createElement('div');el.id='transferPanel';el.className='hide';
    el.style.cssText='position:fixed;inset:0;z-index:70;background:rgba(3,7,15,0.8);display:flex;align-items:flex-start;justify-content:center;padding:14px;overflow:auto;';
    document.body.appendChild(el);
  }
  const btnStyle='padding:9px 8px;border-radius:10px;border:1px solid rgba(148,163,184,0.35);background:#16233a;color:#e2e8f0;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;';
  const onBtn='border-color:#38bdf8;background:rgba(56,189,248,0.22);color:#7dd3fc;';
  const online=(IS_ONLINE&&ONLINE_CLIENT&&ONLINE_CLIENT.connected);
  const man=(()=>{try{return localStorage.getItem('td_dia')||'auto';}catch(e){return 'auto';}})();
  const curSt=STATIONS[G.atStation!=null?G.atStation:G.nv];
  const curName=curSt?curSt.name:'';
  const canBoardNow=PAX&&(!RIDE||RIDE.door>0||(RIDE.a&&Math.abs(RIDE.a.v||0)<0.1));
  const matchSvc=id=>{
    const S=SERVICES[id];if(!S||id===G.route)return false;
    const CFG2=lineConfig(S.line||'loop');
    const ST2=(CFG2&&CFG2.L!=null)?layoutStations(CFG2):null;
    if(!ST2||!ST2.length)return false;
    const ok=(S.kind==='pax'||S.kind==='staff')?ST2:stopsOf(ST2,S.kind);
    return ok.some(st=>st.name===curName);
  };
  const dirs=[['lo','各停 外回り'],['li','各停 内回り'],['ro','快速 外回り'],['ri','快速 内回り'],['eo','快特 外回り'],['ei','快特 内回り'],['exo','臨時 外回り'],['exi','臨時 内回り'],['cho','団体 外回り'],['chi','団体 内回り'],['test','試運転 外回り'],['testi','試運転 内回り']].filter(([id])=>canBoardNow&&matchSvc(id));
  const brs=[['bu','白峰支線 奥峰行'],['bd','白峰支線 白峰行'],['b2u','紫雲地下線 深雪行'],['b2d','紫雲地下線 紫雲新都行'],['b3u','天宮高架線 峰月行'],['b3d','天宮高架線 天宮行'],['b4u','港見支線 奥港行'],['c5u','四嶺連絡線 奥港行'],['pax','乗客モード（環状線）']].filter(([id])=>canBoardNow&&matchSvc(id));
  const grid=a=>'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;">'+a.map(([id,lb])=>'<button data-svc="'+id+'" style="'+btnStyle+'">'+lb+'</button>').join('')+'</div>';
  const rss=[['','自動（行先表示）'],['回送','回送'],['試運転','試運転'],['臨時','臨時'],['団体','団体'],['普通','普通'],['快速','快速'],['快特','快特']];
  const dias=[['auto','自動（毎月日替わり）'],['normal','通常ダイヤ'],['extra','臨時・団体ダイヤ'],['change','変更ダイヤ']];
  const titleTxt=PAX?('🚉 乗り換え（現在駅：'+(curName||'—')+'）'):'🚃 方向幕・ダイヤ';
  let bodyHtml='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;"><div style="font-size:16px;font-weight:800;color:#7dd3fc;">'+titleTxt+'</div><button id="tpClose" style="background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">✕</button></div>';
  if(PAX){
    bodyHtml+='<div style="font-size:12px;line-height:1.6;color:'+(online?'#34d399':'#f59e0b')+';margin-bottom:10px;">'+(online?'🌐 オンライン接続中：乗換駅では接続を保ったまま乗り換えできます':'📴 オフライン接続中')+'</div>';
    if(!canBoardNow){
      bodyHtml+='<div style="font-size:12.5px;color:#fbbf24;padding:10px;background:rgba(251,191,36,0.1);border-radius:10px;margin-bottom:10px;">走行中の列車に乗車中は乗り換えできません。駅に停車中またはホーム上でお試しください。</div>';
    }else if(!dirs.length&&!brs.length){
      bodyHtml+='<div style="font-size:12.5px;color:#94a3b8;padding:10px;background:rgba(148,163,184,0.1);border-radius:10px;margin-bottom:10px;">「'+(curName||'この駅')+'」には乗り換え可能な他路線・別種別がありません。乗換駅（汐見・白峰・紫雲新都・天宮など）へ移動すると乗り換えできます。</div>';
    }else{
      if(dirs.length)bodyHtml+='<div style="font-size:13px;font-weight:800;color:#fbbf24;margin:6px 0;">環状線の列車に乗り換え</div>'+grid(dirs);
      if(brs.length)bodyHtml+='<div style="font-size:13px;font-weight:800;color:#fbbf24;margin:12px 0 6px;">支線に乗り換え</div>'+grid(brs);
    }
  }else{
    bodyHtml+='<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">※ 乗り換えは乗客モードで乗換駅にいるときのみ利用できます。</div>';
    bodyHtml+='<div style="font-size:13px;font-weight:800;color:#fbbf24;margin:8px 0 6px;">🚃 方向幕（幕回し）／いまの表示：'+(G.rsManual||'自動')+'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;">'+rss.map(([v,lb])=>'<button data-rs="'+v+'" style="'+btnStyle+(String(G.rsManual||'')===v?onBtn:'')+'">'+lb+'</button>').join('')+'</div>';
  }
  bodyHtml+='<div style="font-size:13px;font-weight:800;color:#fbbf24;margin:12px 0 6px;">🗓️ ダイヤ設定（保存して再出発）</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">'+dias.map(([v,lb])=>'<button data-dia="'+v+'" style="'+btnStyle+((man||'auto')===v?onBtn:'')+'">'+lb+'</button>').join('')+'</div>';
  el.innerHTML='<div style="width:min(560px,100%);background:#0b1220;border:1px solid rgba(56,189,248,0.35);border-radius:16px;padding:14px;color:#e2e8f0;">'+bodyHtml+'</div>';
  el.classList.remove('hide');
  const c=document.getElementById('tpClose');if(c)c.onclick=closeTransferPanel;
  el.querySelectorAll('[data-svc]').forEach(bt=>bt.onclick=()=>window.__transferTo(bt.dataset.svc));
  el.querySelectorAll('[data-rs]').forEach(bt=>bt.onclick=()=>{window.__setRollSign(bt.dataset.rs);openTransferPanel();});
  el.querySelectorAll('[data-dia]').forEach(bt=>bt.onclick=()=>window.__setDia(bt.dataset.dia));
}
window.__openTransfer=openTransferPanel;
/* ================= walking on the platform ================= */
const HOLD_T=1.4;
function canExit(){return G.phase==='play'&&G.v===0&&!G.walkOn&&(G.atStation!==null||(G.depCheck!==null&&Math.abs(stopDist(G.depCheck))<20));}
const W={s:0,o:0,yaw:0,pitch:0,st:null,lo:0,hi:0,mv:{x:0,y:0},keys:{},ptr:new Map()};
function enterWalk(){if(!canExit())return;leanBack();const v=G.atStation!==null?G.atStation:G.depCheck,st=stOf(v),k=physKey(G.key,st.s),T=TK[k],isSh=!BRANCH&&st.i===0&&G.key!=='G'&&G.key!=='H',sd=isSh?-T.side(st):T.side(st),base=isSh?ownTrackOff(k,st.s):T.off(st.s);
  const [lo,hi]=platRange(st,k);W.lo=lo+0.35;W.hi=hi-0.35;W.st=st;W.area='plat';W.s=G.crew==='twoC'?condBoxS()+G.dir*3:G.s-G.dir*4; /* 車掌は最後尾から出る */W.o=clamp(base+sd*2.7,W.lo,W.hi);
  const t=P(W.s)[2],fx=-sd*Math.cos(t)-G.dir*Math.sin(t)*0.8,fz=-sd*Math.sin(t)+G.dir*Math.cos(t)*0.8;W.yaw=Math.atan2(-fx,-fz);W.pitch=0;
  G.walkOn=true;G.walkArea='plat';G.zoom=null;if(camera.parent)camera.parent.remove(camera);scene.add(camera);camera.layers.enable(1);camera.layers.disable(2);
  document.getElementById('walkUI').classList.remove('hide');toast('ホームに出ました（完全オートでも発車しません）','info');}
function enterSalWalk(){
  if(G.phase!=='play'||G.crew!=='twoC'||!ownTrain||!ownTrain.cars||!ownTrain.cars.length)return;
  if(G.walkOn&&G.walkArea==='train'){exitWalk();return;}
  leanBack();
  G.walkOn=true;G.walkArea='train';G.walkCar=ownTrain.cars.length-1;
  G.walkLx=0;G.walkLz=CARHALF-CABLEN-0.75;G.walkFl='deck';
  W.yaw=0;W.pitch=0;G.zoom=null;
  if(camera.parent)camera.parent.remove(camera);
  ownTrain.cars[G.walkCar].add(camera);camera.layers.enable(1);camera.layers.disable(2);
  document.getElementById('walkUI').classList.remove('hide');
  toast('車内巡回中（'+(G.walkCar+1)+'号車・乗務員室側へ戻ると帰れます）','info');
}
function ownTrainWalk(dt){
  if(!ownTrain||!ownTrain.cars||!ownTrain.cars.length){exitWalk();return;}
  const cars=ownTrain.cars;
  G.walkCar=clamp(G.walkCar|0,0,cars.length-1);
  const car=cars[G.walkCar];
  if(camera.parent!==car){try{if(camera.parent)camera.parent.remove(camera);car.add(camera);}catch(e){}}
  let mx=W.mv.x,my=W.mv.y;if(W.keys.KeyW||W.keys.ArrowUp)my+=1;if(W.keys.KeyS||W.keys.ArrowDown)my-=1;if(W.keys.KeyA||W.keys.ArrowLeft)mx-=1;if(W.keys.KeyD||W.keys.ArrowRight)mx+=1;
  const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
  const sp=1.35*dt,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw),rx=Math.cos(W.yaw),rz=-Math.sin(W.yaw);
  let nx=G.walkLx+(fx*my+rx*mx)*sp,nz=G.walkLz+(fz*my+rz*mx)*sp;
  const lmNew=rideXLim(car,nz);
  if(Math.abs(nx)>lmNew&&Math.abs(nx)>rideXLim(car,G.walkLz)-0.001)nz=G.walkLz;
  G.walkLx=clamp(nx,-rideXLim(car,nz),rideXLim(car,nz));
  const u=car.userData;
  if(Math.abs(G.walkLx)<0.48&&nz>9.2&&G.walkCar<cars.length-1&&!u.cabR){
    G.walkCar++;G.walkLz=-9.0;G.walkFl='deck';
    if(camera.parent)camera.parent.remove(camera);cars[G.walkCar].add(camera);
    toast((G.walkCar+1)+'号車に移りました','info');
  }else if(Math.abs(G.walkLx)<0.48&&nz<-9.2&&G.walkCar>0&&!u.cabF){
    G.walkCar--;G.walkLz=9.0;G.walkFl='deck';
    if(camera.parent)camera.parent.remove(camera);cars[G.walkCar].add(camera);
    toast((G.walkCar+1)+'号車に移りました','info');
  }else{
    nz=clamp(nz,-9.2,9.2);
    if(u.cabF)nz=Math.max(nz,-CARHALF+CABLEN+0.3);
    if(u.cabR)nz=Math.min(nz,CARHALF-CABLEN-0.3);
    G.walkLz=nz;
  }
  const isGr=!!(u.green&&!u.gflat);
  if(isGr){
    if(Math.abs(G.walkLz)<5.1)G.walkFl='down';
    else G.walkFl='deck';
  }else G.walkFl='deck';
  const floorY=isGr?GFLOOR[G.walkFl||'deck']:1.16;
  const bob=m>0.1?Math.sin(performance.now()*0.012)*0.02:0;
  camera.position.set(G.walkLx,floorY+paxEye()+bob,G.walkLz);camera.rotation.set(W.pitch,W.yaw,0);
  updAvatar(dt);
}
function exitWalk(){if(!G.walkOn)return;
  const wasPlat=G.walkArea==='plat',wS=W.s;
  G.walkOn=false;G.walkArea=null;if(camera.parent)camera.parent.remove(camera);rig.add(camera);camera.layers.disable(1);camera.layers.enable(2);camera.position.copy(EYE_L.p);G.lookY=0;G.lookP=0;
  document.getElementById('walkUI').classList.add('hide');W.ptr.clear();W.mv.x=W.mv.y=0;
  /* 終点：反対側の先頭車両の運転室の近くで長押し → 折り返して反対の運転室へ */
  let turned=false;
  if(wasPlat&&BRANCH&&G.atStation!==null&&G.list&&G.atStation>=lastStop()){
    const rearS=G.s-G.dir*(carsFor(G.key)*CARL-4);
    if(Math.abs(sdiff(wS,rearS))<12){turnaround();turned=true;}
  }
  if(!PAX&&typeof syncSalFromCar==='function')syncSalFromCar();
  toast(turned?'反対側の運転室に入りました。発車メロディを鳴らして発車できます':'乗務員室に戻りました','ok');
}
function updWalk(dt){if(RIDE){rideWalk(dt);return;}if(G.walkArea==='train'){ownTrainWalk(dt);return;}
  let mx=W.mv.x,my=W.mv.y;if(W.keys.KeyW||W.keys.ArrowUp)my+=1;if(W.keys.KeyS||W.keys.ArrowDown)my-=1;if(W.keys.KeyA||W.keys.ArrowLeft)mx-=1;if(W.keys.KeyD||W.keys.ArrowRight)mx+=1;
  const m=Math.hypot(mx,my);if(m>1){mx/=m;my/=m;}
  const sp=1.7*dt,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw),rx=Math.cos(W.yaw),rz=-Math.sin(W.yaw);
  const dx=(fx*my+rx*mx)*sp,dz=(fz*my+rz*mx)*sp,t=P(W.s)[2];
  W.s+=dx*Math.sin(t)-dz*Math.cos(t);W.o+=dx*Math.cos(t)+dz*Math.sin(t);
  const rawS=W.s,rawO=W.o;
  if(W.area==='conc'){
    const C=concourseGeom(W.st),B=(W.st.concY!=null?W.st.concY:CONC_Y);
    W.s=clamp(W.s,C.sc-21,C.sc+21);W.o=clamp(W.o,C.o1+1.4,C.o0-1.0);
    const bob=m>0.1?Math.sin(performance.now()*0.012)*0.025:0;
    if(PAX)G.s=W.s;
    if(PAX)updAvatar(dt);
    camera.position.copy(offsG(W.s,W.o,B+1.66+bob));camera.rotation.set(W.pitch,W.yaw,0);return;
  }
  W.area='plat';W.s=clamp(W.s,W.st.s-PBof(W.st)+2,W.st.s+PF-2);W.o=clamp(W.o,W.lo,W.hi);applyHDPlayer(W);applyFencePlayer(W);
  if(PAX&&m>0.1&&paxWalkIn(rawS,rawO))return; /* 開いたドアへ歩くとそのまま乗車 */
  if(PAX)walkBump();
  if(PAX){G.s=W.s;paxStairCheck();}
  const bob=m>0.1?Math.sin(performance.now()*0.012)*0.025:0;
  const isUgWalk=!BRANCH&&((!PAX&&(G.key==='G'||G.key==='H'))||(PAX&&PX.plats&&PX.plats[PX.pi]&&PX.plats[PX.pi].keys&&(PX.plats[PX.pi].keys.includes('G')||PX.plats[PX.pi].keys.includes('H'))));
  camera.position.copy(isUgWalk?offsG(W.s,W.o,LTD_DEPTH+PH+(PAX?paxEye():1.55)+bob):offs(W.s,W.o,PH+(PAX?paxEye():1.55)+bob));camera.rotation.set(W.pitch,W.yaw,0);if(PAX||G.crew==='twoC')updAvatar(dt);}
/* ================= passenger mode: walk every platform, stairs to other platforms ================= */
let PX={plats:[],pi:0,inStair:false,skipStair:false};
function platformsOf(st){const out=[],s=st.s-62;
  const add=(label,keys,rng,stairO)=>{const a=Math.min(rng[0],rng[1]),b=Math.max(rng[0],rng[1]);
    if(b-a<0.6)return;const mid=(a+b)/2;out.push({label,keys,rng:[a,b],mid,stairO:stairO!=null?stairO:mid});};
  const nm=k=>BRANCH?(TK[k].dir>0?STATIONS[NST-1].name+'方面':STATIONS[0].name+'方面'):({A:'各停',B:'各停',C:'快速',D:'快速',E:'快速特急',F:'快速特急',G:'特急',H:'特急'})[k]+' '+(TK[k].dir>0?'外回り':'内回り');
  /* 側方ホームの階段は縁から3.4m内側（建設コードと同じ） */
  const sideStair=(lo,hi,towardNeg)=>towardNeg?Math.max(lo,hi)-3.4:Math.min(lo,hi)+3.4;
  if(MINI&&st.cls==='L'){add('のりば　'+nm('A')+'／'+nm('B'),['A','B'],platRange(st,'A'));}
  else if(BRANCH&&st.cls==='Q'){const kA=serves(st,'C')?['A','C']:['A'],kB=serves(st,'D')?['D','B']:['B'];
    add('1・2番線　'+nm('A')+'（各停・快速）',kA,platRange(st,'A'));add('3・4番線　'+nm('B')+'（快速・各停）',kB,platRange(st,'B'));}
  else if(st.cls==='L'||st.cls==='T'&&BRANCH||(BRANCH&&st.cls!=='J'&&st.cls!=='I')){
    const rA=platRange(st,'A'),rB=platRange(st,'B');
    add((BRANCH?'1':PLATNO.A)+'番線　'+nm('A'),BRANCH&&serves(st,'C')?['A','C']:['A'],rA,sideStair(rA[0],rA[1],true));
    add((BRANCH?'2':PLATNO.B)+'番線　'+nm('B'),BRANCH&&serves(st,'D')?['B','D']:['B'],rB,sideStair(rB[0],rB[1],false));
  }else if(BRANCH){add('1・2番線　'+nm('A')+'／'+nm('B'),KEYS.filter(k=>serves(st,k)),platRange(st,'A'));}
  else if(!BRANCH&&st.i===0){
    const sr=(k)=>{const sd=-TK[k].dir,o0=TK[k].off(s);return [o0+(sd<0?-8.6:0)+1.72,o0+(sd<0?0:8.6)-1.72];};
    add('13・14番線　臨時・汐見始発',['J','I'],platRange(st,'I'));
    add('1・2番線　各停 外回り（左:退避 / 右:AI）',['A'],sr('A'));
    add('3・4番線　快速 外回り（左:退避 / 右:AI）',['C'],sr('C'));
    add('5・6番線　快速特急 外回り（左:退避 / 右:AI）',['E'],sr('E'));
    add('7・8番線　快速特急 内回り（左:退避 / 右:AI）',['F'],sr('F'));
    add('9・10番線　快速 内回り（左:退避 / 右:AI）',['D'],sr('D'));
    add('11・12番線　各停 内回り（左:退避 / 右:AI）',['B'],sr('B'));
  }else if(st.cls==='M'){
    const rA=platRange(st,'A'),rB=platRange(st,'B'),rC=platRange(st,'C'),rD=platRange(st,'D');
    add('1番線　各停 外回り',['A'],rA,sideStair(rA[0],rA[1],true));
    add('2・3番線　快速・快速特急 外回り',['C','E'],rC); /* 島式：中央に階段 */
    add('4・5番線　快速特急・快速 内回り',['F','D'],rD);
    add('6番線　各停 内回り',['B'],rB,sideStair(rB[0],rB[1],false));
  }else{
    add('1・2番線　各停・快速 外回り',['A','C'],platRange(st,'A'));
    if(st.cls==='X')add('3・4番線　快速特急 外回り・内回り',['E','F'],platRange(st,'E'));
    add('5・6番線　快速・各停 内回り',['D','B'],platRange(st,'B'));
  }
  for(const ex of st.extra){const lo=ex.lo(s),hi=ex.hi(s);add(ex.line[0]+' のりば',[],[lo,hi]);}
  return out;}
function paxWhere(){const p=PX.plats[PX.pi];if(!p)return;document.getElementById('paxWhere').innerHTML='<b>'+W.st.name+'</b>　'+p.label;}
function paxPlace(st,pi,atStair){PX.plats=platformsOf(st);if(!PX.plats.length)PX.plats=[{label:'ホーム',keys:['A'],rng:[-6,6],mid:0,stairO:0}];
  PX.pi=clamp(pi|0,0,PX.plats.length-1);const p=PX.plats[PX.pi];
  W.st=st;W.area='plat';W.lo=p.rng[0]+0.35;W.hi=p.rng[1]-0.35;if(W.lo>W.hi){const t=W.lo;W.lo=W.hi;W.hi=t;}
  const so=(p.stairO!=null)?p.stairO:p.mid;
  W.s=atStair?st.s-75:st.s-40;
  W.o=clamp(atStair?so:(p.mid+0.6*(W.lo<p.mid?-1:1)),W.lo,W.hi);
  /* ホーム中央に確実に置く */
  if(Math.abs(W.o-p.mid)>Math.abs(p.rng[1]-p.rng[0])*0.45)W.o=p.mid;
  W.yaw=-P(W.s)[2];W.pitch=0;G.s=W.s;updChunks(G.s,true);
  PX.inStair=false;PX.skipStair=true;
  paxWhere();
  /* カメラを即反映 */
  try{camera.position.copy(offs(W.s,W.o,PH+1.55));camera.rotation.set(W.pitch,W.yaw,0);}catch(e){}}
function paxClearPeople(){for(const p of active.slice())freePerson(p);for(const s2 of STATIONS){s2.sp={};s2.staff=null;for(const k in s2.wait)s2.wait[k].length=0;}}
function startPassenger(si){PAX=true;window.__PAX=true;for(const id of ['paxView','paxPhone','paxTab'])document.getElementById(id).classList.remove('hide');setTimeout(()=>{try{buildAvatar();}catch(e){console.error(e);}},0);const st=STATIONS[si];G.phase='play';G.key='A';G.dir=1;G.list=null;G.cyc=STATIONS.map(s=>s.i);G.cpos=si;G.nv=0;G.atStation=null;G.depCheck=null;
  G.door={state:'closed',frac:0,side:-1,local:-1};ownTrain.grp.visible=false;G.s=st.s-62;paxClearPeople();
  G.walkOn=true;rig.remove(camera);scene.add(camera);camera.layers.enable(1);camera.layers.disable(2);
  document.getElementById('walkUI').classList.remove('hide');document.getElementById('holdBack').classList.add('hide');document.getElementById('paxBtns').classList.remove('hide');
  document.getElementById('walkHint').textContent=STAFF?'ホームを見回ります。列車が来たら「安全確認」、ドアが閉まったら「発車合図」':'左側スワイプで移動　右側スワイプで視点　開いたドアへ歩くと乗車　階段に入ると別のホームへ';
  paxPlace(st,0,false);updSpawns();initAudio();initOTAudio();toast(STAFF?st.name+'駅に着任しました':st.name+'駅に来ました','info');showTripNoticeIfNeeded();}
/* ================= 駅員の仕事 ================= */
function updStaff(dt){staffTask=null;return;if(!STAFF||RIDE||W.area==='conc'){staffTask=null;return;}
  const st=W.st,plat=PX.plats[PX.pi];if(!plat){staffTask=null;return;}
  let near=null,best=1e9;
  for(const a of OT){if(!a.key||a.state==='off'||!plat.keys.includes(a.key))continue;
    if(a.state==='dwell'&&a.stSt===st){near={a,kind:'dep'};best=0;break;}
    if(a.state==='run'){const D=a.dir*sdiff(a.s,st.s+TK[a.key].so);if(D>0&&D<420&&D<best){best=D;near={a,kind:'safe'};}}}
  if(!near){staffTask=null;return;}
  if(near.kind==='safe')staffTask={a:near.a,type:'safe',label:'安全確認',ready:true};
  else staffTask={a:near.a,type:'dep',label:'発車合図',ready:near.a.frac<0.15&&near.a.t<6};}
function doStaffTask(){if(!staffTask||!staffTask.ready)return;
  if(staffTask.type==='safe'){staffScore++;toast('安全確認 よし！（'+staffScore+'）','ok');say('安全確認、よし。','drv');chime();}
  else{staffScore++;toast('発車合図（'+staffScore+'）','ok');chime();say('出発、進行。','drv');}
  staffTask=null;}
function gotoStation(i){document.getElementById('paxSel').classList.add('hide');paxClearPeople();paxPlace(STATIONS[i],0,false);updSpawns();toast(STATIONS[i].name+'駅に来ました','info');}
function openPaxSel(){const g=document.getElementById('paxGrid');g.innerHTML='';
  for(const st of STATIONS){const b=document.createElement('button');if(st.big)b.className='big';b.textContent=st.name;b.addEventListener('click',()=>gotoStation(st.i));g.appendChild(b);}
  document.getElementById('paxSel').classList.remove('hide');}
const CPEOPLE=[];let concSt=null;
function concWaypoints(st){const C=concourseGeom(st);return {
  stair:[C.sc+1.8,C.o0-2.2],gate:[C.sc-15,C.o0-10],out:[C.sc-C.len/2+3,C.o0-12],
  shopA:[C.sc-9,C.o1+3.0],shopB:[C.sc-4.4,C.o1+3.0],shopC:[C.sc+0.2,C.o1+3.0],
  wcM:[C.sc+12.1,C.o1+3.2],wcW:[C.sc+16.5,C.o1+3.2],wcK:[C.sc+19.5,C.o1+2.6],
  hallA:[C.sc-6,C.o0-14],hallB:[C.sc+4,C.o0-16],hallC:[C.sc+12,C.o0-11]};}
function concCount(st){return st.big?16:st.cls==='X'?11:st.cls==='R'?7:st.cls==='M'?16:4;}
function concSpawn(st){concClear();concSt=st;const W2=concWaypoints(st),n=concCount(st);
  for(let i=0;i<n;i++){const body=Math.random()<childRate(hourNow())?'child':'adult',p=getPerson(body);
    const keys=Object.keys(W2),k0=keys[irand(0,keys.length-1)],a=W2[k0];
    p.st=st.i;p.kind='conc';p.flow='conc';p.s=a[0]+rand(-1.5,1.5);p.o=a[1]+rand(-1.5,1.5);p.trackO=-99;p.face=0;p.path=[];p.end=null;p.g.visible=true;
    CPEOPLE.push({p,st,wait:rand(0,4),goal:null,hidden:false});}}
function concClear(){for(const e of CPEOPLE){if(e.p)freePerson(e.p);}CPEOPLE.length=0;concSt=null;}
function updConcourse(dt){return;
  const want=(PAX&&W.area==='conc')?W.st:null;
  if(want!==concSt){if(want)concSpawn(want);else concClear();}
  if(!concSt)return;const W2=concWaypoints(concSt),keys=Object.keys(W2);
  for(const e of CPEOPLE){const p=e.p;
    if(e.wait>0){e.wait-=dt;personPose(p.g,'stand');
      if(e.hidden&&e.wait<=0){p.g.visible=true;e.hidden=false;}
      p.g.position.copy(offs(p.s,p.o,CONC_Y));p.g.rotation.y=p.yaw||0;continue;}
    if(!e.goal){const k0=keys[irand(0,keys.length-1)];e.goal=[W2[k0][0]+rand(-1.2,1.2),W2[k0][1]+rand(-1.2,1.2)];e.gk=k0;}
    const ds=e.goal[0]-p.s,doo=e.goal[1]-p.o,d=Math.hypot(ds,doo),step=1.15*dt;
    if(d<=step){p.s=e.goal[0];p.o=e.goal[1];e.goal=null;e.wait=rand(2,9);
      if(/^wc/.test(e.gk)){p.g.visible=false;e.hidden=true;e.wait=rand(8,20);}        // トイレを使う
      else if(/^shop/.test(e.gk))e.wait=rand(5,14);                                    // 売店で買う
      else if(e.gk==='gate'||e.gk==='out')e.wait=rand(1,4);
      personPose(p.g,'stand');}
    else{p.s+=ds/d*step;p.o+=doo/d*step;personPose(p.g,'walk');p.walk=(p.walk||0)+dt*6;
      const u=p.g.userData,a2=Math.sin(p.walk)*0.5;if(u.legs[0]){u.legs[0].rotation.x=a2;u.legs[1].rotation.x=-a2;}
      const t=P(p.s)[2];p.yaw=Math.atan2(Math.sin(t)*ds+Math.cos(t)*doo,-Math.cos(t)*ds+Math.sin(t)*doo);}
    if(!e.hidden){p.g.position.copy(offs(p.s,p.o,CONC_Y));p.g.rotation.y=p.yaw||0;}}}
function enterConcourse(){/* ホームの階段から改札口・コンコースへ */
  if(!W||!W.st)return;const st=W.st,C=concourseGeom(st);
  if(W.area==='conc')return;
  W.area='conc';W.s=C.sc+2.4;W.o=-14.2;W.yaw=Math.PI;W.pitch=0;
  toast(st.name+'駅　改札口・コンコース','ok');
}
function leaveConcourse(){if(!W||!W.st)return;if(W.area!=='conc'){if(W.st)paxPlace(W.st,PX.pi,true);return;}
  W.area='plat';W.s=W.st.s-75;W.o=(W.lo+W.hi)/2;W.yaw+=Math.PI;
  toast('ホームに戻りました','info');}
function nearFacility(){return null;}
function useFacility(){const f=nearFacility();if(!f)return;
  if(f==='gate'){G.outside=!G.outside;toast(G.outside?'改札を出ました':'改札を入りました','ok');}
  else if(f==='toilet')toast('トイレを利用しました','ok');
  else if(f==='kids')toast('こどもトイレを利用しました','ok');
  else if(f==='shop')toast('売店で飲み物を買いました','ok');}
function openPlatSel(){if(!W.st||RIDE)return;const st=W.st;PX.plats=platformsOf(st);
  if(PX.plats.length<2){toast('この駅に他のホームはありません','info');return;}
  const btns=[];PX.plats.forEach((q,i)=>{
    const cur=i===PX.pi?'（現在）':'';
    btns.push([q.label+cur,()=>{paxPlace(st,i,true);toast(st.name+'　'+q.label,'ok');},i!==PX.pi]);
  });
  btns.push(['キャンセル',()=>{PX.inStair=false;},false]);
  /* G.auto 中でも開けるよう openAsk を直接使わず独自ダイアログ */
  const box=document.getElementById('askBtns');box.innerHTML='';
  document.getElementById('askText').textContent=st.name+'　ホーム移動';
  document.getElementById('askMsg').textContent='移動先のホームを選んでください';
  btns.forEach(([label,fn,pri])=>{const b=document.createElement('button');b.textContent=label;b.className=pri?'pri':'sec';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();hideAsk();fn&&fn();});box.appendChild(b);});
  G.askOpen=true;askTimer=0;document.getElementById('ask').classList.remove('hide');PX.inStair=true;}
function paxStairCheck(){if(!W.st||!PX.plats.length||RIDE)return;const st=W.st,p=PX.plats[PX.pi];if(!p)return;
  const sb=st.s-75;
  /* 階段付近：ホーム幅全体を判定（駅によって階段位置が違うため） */
  const inZ=Math.abs(sdiff(W.s,sb))<9&&W.o>=p.rng[0]-0.8&&W.o<=p.rng[1]+0.8;
  if(!inZ){if(!G.askOpen)PX.inStair=false;PX.skipStair=false;return;}
  if(PX.skipStair||PX.inStair||G.askOpen)return;
  PX.inStair=true;const btns=[];
  PX.plats.forEach((q,i)=>{if(i!==PX.pi)btns.push([q.label,()=>{paxPlace(st,i,true);toast(st.name+'　'+q.label,'info');},true]);});
  btns.push(['別の駅へ移動',()=>{W.s=sb+(W.s>sb?8:-8);PX.inStair=false;PX.skipStair=true;openPaxSel();},false]);
  btns.push(['もどる',()=>{W.s=sb+(W.s>sb?8:-8);PX.inStair=false;PX.skipStair=true;},false]);
  openAsk('階段（'+st.name+'）',PX.plats.length>1?'どのホームへ行きますか？':'別の駅へ移動できます',btns,0);}
_on(document.getElementById('paxStation'),'click',()=>openPaxSel());
/* 改札口・コンコースへの入退場ボタン（ホーム見学中に表示） */
{const wrap=document.getElementById('walkUI'),box=document.getElementById('paxBtns');
  if(wrap&&box&&!document.getElementById('concBtn')){const b=document.createElement('button');b.id='concBtn';b.textContent='🚪 改札口へ';
    /* 他の乗客ボタンと同じ列に並べる（画面の変な位置に浮かせない） */
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!W.st)return;
      if(W.area==='conc'){leaveConcourse();b.textContent='🚪 改札口へ';}
      else{enterConcourse();b.textContent='🚪 ホームに戻る';}});
    box.insertBefore(b,box.firstChild);}}
_on(document.getElementById('paxPlat'),'click',()=>openPlatSel());
_on(document.getElementById('paxQuit'),'click',()=>location.href=location.pathname);
_on(document.getElementById('paxClose'),'click',()=>{document.getElementById('paxSel').classList.add('hide');PX.inStair=false;});
/* ================= riding a train in passenger mode ================= */
function nearTrainDoor(){if(!PAX||RIDE||!W.st||!PX.plats.length)return null;const plat=PX.plats[PX.pi];if(!plat)return null;
  const trainList=[...OT];
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      const p = ONLINE_PLAYERS[pid];
      if(p && p.ai && p.tr && p.tr.cars && p.tr.cars.length && p.tr.grp && p.tr.grp.visible){
        trainList.push(p.ai);
      }
    }
  }
  for(const a of trainList){
    if(!a||!a.tr||!a.tr.cars||!a.tr.cars.length)continue;
    if(!a.key||!plat.keys.includes(a.key))continue;
    const isAtSt = (a.stSt===W.st) || (a.p && a.p.stName===W.st.name) || (Math.abs(sdiff(a.s, W.st.s + (TK[a.key]?TK[a.key].so:0))) < 55);
    const isOpen = (a.state==='dwell'||(a.p&&(a.p.door==='open'||a.p.door==='opening'))||(a.frac||0)>0.15);
    if(!isAtSt || !isOpen) continue;
    const T=TK[a.key],isShOn=!BRANCH&&W.st.i===0&&!!a.p,edge=(a.p?ownTrackOff(a.key,W.st.s):T.off(W.st.s))+(isShOn?-T.side(W.st):T.side(W.st))*1.72;if(Math.abs(W.o-edge)>2.9)continue;
    const NC=a.tr.cars.length,rel=a.dir*sdiff(W.s,a.s);if(rel<-1.5||rel>NC*CARL+1.5)continue;return {a,k:clamp(Math.floor(rel/CARL),0,NC-1),lz:clamp(CARHALF-(rel-Math.floor(rel/CARL)*CARL),-9,9)};}
  return null;}
function boardTrain(n){if(!n||!n.a||!n.a.tr||!n.a.tr.cars||!n.a.tr.cars.length)return;
  /* v1.9.7：号車番号を必ず実在する車両に丸める（編成が短い車両・差し替わった直後でも乗れるように） */
  let k0=Math.round(n.k||0);if(!isFinite(k0))k0=0;k0=clamp(k0,0,n.a.tr.cars.length-1);
  const walkUI=document.getElementById('walkUI');if(walkUI)walkUI.classList.remove('hide');
  RIDE={a:n.a,k:k0,lx:n.lx!=null?n.lx:0.2,lz:n.lz||0,prev:n.a.state||'dwell',depSt:n.a.stSt||(typeof stationNear==='function'?stationNear(n.a.s):null),seat:null,fl:'deck',boardTs:performance.now()};const car=n.a.tr.cars[k0];if(camera.parent)camera.parent.remove(camera);car.add(camera);
  {const lm0=Math.max(0.2,rideXLim(car,RIDE.lz)-0.05);RIDE.lx=clamp(RIDE.lx,-lm0,lm0);}
  const k=n.a.key||'A',T=TK[k]||TK.A,stRef=n.a.stSt||W.st||STATIONS[0],sd=T.side(stRef)*trSgn(n.a.tr);W.yaw=n.yaw!=null?n.yaw:(sd>0?-Math.PI/2:Math.PI/2);W.pitch=0;W.mv.x=W.mv.y=0;
  camera.position.set(RIDE.lx,1.16+1.56,RIDE.lz);camera.rotation.set(W.pitch,W.yaw,0);
  document.getElementById('walkHint').textContent='車内：左側スワイプで移動　右側スワイプで視点　駅に着いたら「降車する」';
  const label=(SVCLOOK[k]?SVCLOOK[k][1]:'列車')+(n.a.p?'（'+n.a.p.name+'運転士）':'');
  toast(label+'に乗車しました','ok');updInterior();}
/* ホームから開いているドアへ歩いて入ったら乗車（カメラは車両にくっつくので電車と一緒に動く） */
const _pwP=new THREE.Vector3(),_pwR=new THREE.Vector3();
function paxWalkIn(rawS,rawO){if(RIDE||!W.st||!PX.plats.length)return false;const plat=PX.plats[PX.pi];if(!plat)return false;
  const trainList=[...OT];
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      const p = ONLINE_PLAYERS[pid];
      if(p && p.ai && p.tr && p.tr.cars && p.tr.cars.length && p.tr.grp && p.tr.grp.visible){
        trainList.push(p.ai);
      }
    }
  }
  for(const a of trainList){
    if(!a||!a.tr||!a.tr.cars||!a.tr.cars.length)continue;
    if(!a.key||!plat.keys.includes(a.key))continue;
    const isAtSt = (a.stSt===W.st) || (a.p && a.p.stName===W.st.name) || (Math.abs(sdiff(a.s, W.st.s + (TK[a.key]?TK[a.key].so:0))) < 55);
    const isOpen = (a.state==='dwell'||(a.p&&(a.p.door==='open'||a.p.door==='opening'))||(a.frac||0)>0.15);
    if(!isAtSt || !isOpen) continue;
    for(let k=0;k<a.tr.cars.length;k++){const car=a.tr.cars[k];car.updateMatrixWorld(true);
      _pwP.copy(offs(W.s,W.o,PH+1));car.worldToLocal(_pwP);if(Math.abs(_pwP.z)>CARHALF||Math.abs(_pwP.x)>2.85)continue;
      const dzs=car.userData.green?GDOORZ:DOORZ;let dz=null;for(const d of dzs)if(Math.abs(_pwP.z-d)<0.85)dz=d;if(dz===null)continue;
      _pwR.copy(offs(rawS,rawO,PH+1));car.worldToLocal(_pwR);
      if(Math.abs(_pwR.x)>=Math.abs(_pwP.x)-0.001)continue;            // 電車の方へ進もうとしているときだけ
      const sx=Math.sign(_pwP.x)||1;boardTrain({a,k,lz:clamp(_pwP.z,dz-0.35,dz+0.35),lx:sx*0.45,yaw:sx*Math.PI/2});return true;}}
  return false;}
function stopGuide(){clearTimeout(guideTimer);if(guideAudio){try{guideAudio.pause();guideAudio.currentTime=0;}catch(e){}}}
function alightTrain(force){stopGuide();stopAdBroadcast();if(annSeqTimer){clearTimeout(annSeqTimer);annSeqTimer=null;}if(RESV&&RIDE&&RIDE.a===RESV.a)cancelResv();if(!RIDE)return;const a=RIDE.a;
  let st=a.stSt;
  if(!st && typeof STATIONS !== 'undefined' && STATIONS.length){
    let bd=1e9;for(const s of STATIONS){const d=Math.abs(sdiff(a.s,s.s));if(d<bd){bd=d;st=s;}}
  }
  if(!st && !force) return;
  if(!st && typeof stationNear==='function') st=stationNear(a.s||0);   /* 駅の無いところで降ろされた場合は最寄り駅のホームへ */
  standUp();
  const car = (a && a.tr && a.tr.cars) ? a.tr.cars[RIDE.k] : null;
  if (car && car.parent) { try { car.remove(camera); } catch(e){} }
  if (a && a.isGhost && a.tr && a.tr.grp && a.tr.grp.parent) {
    const _gGrp = a.tr.grp;
    setTimeout(() => { try { if (_gGrp.parent) _gGrp.parent.remove(_gGrp); } catch(e){} }, 12000);
  }   /* 降りた直後に目の前で消さず、少し経ってから片付ける */
  if (camera.parent !== scene) { scene.add(camera); }
  const carS = a.s - (a.dir || 1) * (CARHALF + RIDE.k * CARL) - (a.dir || 1) * (RIDE.lz || 0) * (a.tr ? trSgn(a.tr) : 1);
  RIDE = null;
  if(st){
    const plats=platformsOf(st),pi=Math.max(0,plats.findIndex(p=>p.keys.includes(a.key)));paxPlace(st,pi,false);
    const T = (typeof TK !== 'undefined' && a.key && TK[a.key]) ? TK[a.key] : Object.values(TK)[0];
    const isShOn=!BRANCH&&st.i===0&&!!a.p,sd=isShOn?-T.side(st):T.side(st),base=isShOn?ownTrackOff(a.key,st.s):T.off(st.s);
    W.s=clamp(carS,st.s-PBof(st)+2,st.s+PF-2);W.o=clamp(base+sd*2.9,W.lo,W.hi);W.yaw=-P(W.s)[2];
    toast(st.name+'で降りました','info');
  }else{
    /* v1.9.7：線路上に放り出さない。最寄り駅のホームへ降ろす */
    const st2=typeof stationNear==='function'?stationNear(carS):null;
    if(st2){const plats2=platformsOf(st2),pi2=Math.max(0,plats2.findIndex(p=>p.keys.includes(a.key)));paxPlace(st2,pi2,false);const T2=TK[a.key]||Object.values(TK)[0],sd2=T2.side(st2),base2=T2.off(st2.s);W.s=clamp(carS,st2.s-PBof(st2)+2,st2.s+PF-2);W.o=clamp(base2+sd2*2.9,W.lo,W.hi);W.yaw=-P(W.s)[2];toast(st2.name+'で降りました','info');}
    else{W.s=carS;W.o=0;W.yaw=0;toast('降車しました','info');}
  }
  document.getElementById('walkHint').textContent='左側スワイプで移動　右側スワイプで視点　開いたドアへ歩くと乗車　階段に入ると別のホームへ';}
function greenCar(){return !!(RIDE&&RIDE.a&&RIDE.a.tr&&RIDE.a.tr.cars&&RIDE.a.tr.cars[RIDE.k]&&RIDE.a.tr.cars[RIDE.k].userData.green&&!RIDE.a.tr.cars[RIDE.k].userData.gflat);}
function seatNear(){if(!RIDE||RIDE.seat!=null)return null;const a=RIDE.a,seats=seatsOf(a,RIDE.k),sl=carSlots(a,RIDE.k);
  if(greenCar()&&RIDE.fl==='deck')return null;                    // デッキには席がない
  let bi=null,bd=2.2;seats.forEach((s,i)=>{if(sl.seat[i])return;if(greenCar()&&s.fl!==RIDE.fl)return;const d=Math.abs(s.z-RIDE.lz)+0.28*Math.abs(s.x-RIDE.lx);
    if(d<bd-0.25||(d<bd+0.25&&bi!=null&&Math.abs(s.x)>Math.abs(seats[bi].x))||bi==null&&d<bd){bd=Math.min(bd,d);bi=i;}});return bi;}
function sitDown(){const i=seatNear();if(i==null)return;const a=RIDE.a,seats=seatsOf(a,RIDE.k),sl=carSlots(a,RIDE.k),st=seats[i];
  sl.seat[i]='PLAYER';RIDE.seat=i;RIDE.lx=st.x;RIDE.lz=st.z;if(st.fl)RIDE.fl=st.fl;W.yaw=st.yaw+Math.PI;W.pitch=-0.05;
  toast(a.tr.cars[RIDE.k].userData.green?'グリーン車の席に座りました':'席に座りました','ok');}
function standUp(){if(!RIDE||RIDE.seat==null)return;const a=RIDE.a,seats=seatsOf(a,RIDE.k),sl=carSlots(a,RIDE.k),st=seats[RIDE.seat];
  if(sl.seat[RIDE.seat]==='PLAYER')sl.seat[RIDE.seat]=(RESV&&RESV.a===a&&RESV.k===RIDE.k&&RESV.si===RIDE.seat)?'RES':null;RIDE.seat=null;RIDE.lx=clamp(st.x*0.3,-0.8,0.8);RIDE.lz=st.z;}
function rideAnn(a,prefix){const nx=aiStop(a);if(!nx)return null;const st=nx.st,sd=TK[a.key].side(st)*a.dir;
  return {ja:prefix+st.yomi+'です。'+(sd<0?'左':'右')+'側のドアが開きます。'+transferText(st),en:'The next station is '+enName(st)+'. The doors on the '+(sd<0?'left':'right')+' side will open.'+transferEn(st)};}
/* 歩ける幅（車両の中心からの横の限界）：ロングシートの前は0.8m、ドアのところはドアの内側ぎりぎり、グリーン車は2階建て部分が通路だけ・デッキは広い */
function rideXLim(car,z){const u=car.userData;if(u.green&&!u.gflat){const az=Math.abs(z);if(az>5.7){for(const dz of GDOORZ)if(Math.abs(z-dz)<0.66)return 1.28;return 1.1;}return 0.26;}
  for(const dz of DOORZ){const d=Math.abs(z-dz);if(d<0.64)return 1.28;if(d<1.12)return 1.1;}if(u.cabF&&z<-CARHALF+CABLEN+0.6)return 1.1;if(u.cabR&&z>CARHALF-CABLEN-0.6)return 1.1;return 0.8;}
/* 車内：他の乗客の実際の形(OBB)に合わせて押し戻される */
function rideBump(){const a=RIDE.a,car=a.tr.cars[RIDE.k];if(!a.inside)return;
  if(RIDE.boardTs&&performance.now()-RIDE.boardTs<2200){const lm=rideXLim(car,RIDE.lz);RIDE.lx=clamp(RIDE.lx,-lm,lm);return;}
  const pAx=obbAxesXZ(W.yaw+Math.PI),pEx={hx:0.24,hz:0.12};
  for(const q of a.inside){if(!q.used||!(q.g.parent===car||q.pbH===car))continue;
    if(Math.abs(RIDE.lx-q.g.position.x)>0.8||Math.abs(RIDE.lz-q.g.position.z)>0.8)continue;
    const qAx=obbAxesXZ(q.g.rotation.y||0),qEx=personHalfExtents(q.g);
    const res=resolveOBB2D(RIDE.lx,RIDE.lz,pAx,pEx,q.g.position.x,q.g.position.z,qAx,qEx);
    if(res){RIDE.lx+=clamp(res[0]*0.45,-0.08,0.08);RIDE.lz+=clamp(res[1]*0.45,-0.08,0.08);}}
  const lm=rideXLim(car,RIDE.lz);RIDE.lx=clamp(RIDE.lx,-lm,lm);}
/* ホーム：他の人の実際の形(OBB)に合わせて押し戻される */
function walkBump(){if(!W.st)return;const si=W.st.i;
  const tW=P(W.s)[2],pAx=obbAxesSO(tW,W.yaw+Math.PI),pEx={hx:0.28,hz:0.14};
  for(const q of active){if(q.st!==si||!q.g.visible)continue;
    if(Math.abs(W.s-q.s)>0.9||Math.abs(W.o-q.o)>0.9)continue;
    const qAx=obbAxesSO(tW,q.yaw||0),qEx=personHalfExtents(q.g);
    const res=resolveOBB2D(W.s,W.o,pAx,pEx,q.s,q.o,qAx,qEx);
    if(res){W.s+=res[0];W.o+=res[1];}}
  W.o=clamp(W.o,W.lo,W.hi);}
function rideGhostTrain(p){
  /* v1.9.7：運転士が退出・路線変更したとき、その列車に乗っている乗客を線路上に放り出さない。
     列車をその場に残して停車・ドア開にし、乗客が「降車する」でホームに降りられるようにする */
  if(!RIDE||!RIDE.a)return false;
  const a=RIDE.a;
  if(p&&!a.p&&a!==p.ai)return false;
  if(p&&p.tr){a.tr=p.tr;p.tr=null;if(p.ai)p.ai.tr=null;}   /* 列車の持ち主を乗客側へ移す（呼び出し元の dispose を避ける） */
  if(!a.tr)return false;
  a.tr.grp.visible=true;
  a.state='dwell';a.v=0;a.frac=1;a.t=9999;a.dwellTot=9999;
  if(!a.side)a.side=1;
  if(typeof stationNear==='function'){const st0=stationNear(a.s||0);if(st0)a.stSt=st0;}
  if(a.p&&a.p.id)a.pid=a.p.id;
  a.p=null;a.isGhost=true;a.dispHold=true;
  if(!a.key)a.key='A';if(!a.dir)a.dir=1;
  try{toast('運転士が退出したため、この列車は停車しました。「降車する」でホームへ降りられます','warn');}catch(e){}
  return true;
}
window.__RIDEHOOK={ghost:rideGhostTrain,get:()=>RIDE};
function rideGangway(nk,nz){const cars=RIDE.a.tr.cars;cars[RIDE.k].remove(camera);cars[nk].add(camera);RIDE.k=nk;RIDE.lz=nz;RIDE.lx=clamp(RIDE.lx,-0.4,0.4);RIDE.fl='deck';
  toast((nk+1)+'号車に移りました','info');}
function rideWalk(dt){
  if (!RIDE || !RIDE.a) return;
  const a = RIDE.a;
  /* v1.9.7：乗車中に編成が差し替わっても、勝手に降ろされないようにする。
     車両プールに戻されていたら取り直し、カメラは必ず「今の号車」に付け直す */
  if (!a.tr || !a.tr.cars || !a.tr.cars.length) {
    if (!a.p && a.state && a.state !== 'off' && typeof acquireAiTr === 'function') { try { acquireAiTr(a); } catch(e) {} }
    if (!a.tr || !a.tr.cars || !a.tr.cars.length) {
      if ((a.v || 0) < 0.25 && typeof alightTrain === 'function') alightTrain(true);  /* 本当に編成が消えたときだけ・停車後 */
      return;
    }
  }
  const _cars0 = a.tr.cars;
  if (RIDE.k == null || RIDE.k >= _cars0.length || !_cars0[RIDE.k]) RIDE.k = Math.max(0, _cars0.length - 1);
  if (RIDE.k < 0) RIDE.k = 0;
  if (camera.parent !== _cars0[RIDE.k]) { try { if (camera.parent) camera.parent.remove(camera); _cars0[RIDE.k].add(camera); } catch(e) {} }
  let mx=W.mv.x,my=W.mv.y;if(W.keys.KeyW||W.keys.ArrowUp)my+=1;if(W.keys.KeyS||W.keys.ArrowDown)my-=1;if(W.keys.KeyA||W.keys.ArrowLeft)mx-=1;if(W.keys.KeyD||W.keys.ArrowRight)mx+=1;
  if(RIDE.seat!=null&&(Math.abs(mx)>0.6||Math.abs(my)>0.6))standUp();
  if(RIDE.seat==null){const sp=1.2*dt,fx=-Math.sin(W.yaw),fz=-Math.cos(W.yaw),rx=Math.cos(W.yaw),rz=-Math.sin(W.yaw);
    let nx2=RIDE.lx+(fx*my+rx*mx)*sp,nz=RIDE.lz+(fz*my+rz*mx)*sp;const car0=a.tr.cars[RIDE.k];
    { /* 座席の前は通路まで、ドアのところはドアぎりぎりまで（壁に引っかかって動かなくならないよう通路側へ逃がしながら進む） */const lmNew=rideXLim(car0,nz);if(Math.abs(RIDE.lx)>lmNew+0.02&&Math.abs(nx2)>=Math.abs(RIDE.lx)){RIDE.lx=clamp(RIDE.lx*0.88,-lmNew,lmNew);}else{RIDE.lx=clamp(nx2,-lmNew,lmNew);}}
    const cars=a.tr.cars,u=cars[RIDE.k].userData;
    if(Math.abs(RIDE.lx)<0.45&&nz>9.2&&RIDE.k<cars.length-1&&!u.cabR)rideGangway(RIDE.k+1,-9.1);      /* 貫通路：後ろの号車へ */
    else if(Math.abs(RIDE.lx)<0.45&&nz<-9.2&&RIDE.k>0&&!u.cabF)rideGangway(RIDE.k-1,9.1);           /* 貫通路：前の号車へ */
    else{nz=clamp(nz,-9.2,9.2);if(u.cabF)nz=Math.max(nz,-CARHALF+CABLEN+0.3);if(u.cabR)nz=Math.min(nz,CARHALF-CABLEN-0.3);RIDE.lz=nz;}}
  if(RIDE.seat==null)rideBump();
  let floorY=1.16;if(greenCar())floorY=GFLOOR[RIDE.fl];
  if(greenCar()&&RIDE.seat==null){ // 階段の外へは出られない
    if(RIDE.fl==='deck')RIDE.lz=Math.abs(RIDE.lz)<5.6?(RIDE.lz>=0?5.6:-5.6):clamp(RIDE.lz,-9.2,9.2);
    else RIDE.lz=clamp(RIDE.lz,-5.1,5.1);}
  const eye=RIDE.seat!=null?seatsOf(RIDE.a,RIDE.k)[RIDE.seat].h+(greenCar()?0.86:0.72)*(paxEye()/1.55):floorY+paxEye()*1.006;
  camera.position.set(RIDE.lx,eye,RIDE.lz);camera.rotation.set(W.pitch,W.yaw,0);G.s=a.s;W.s=a.s;updAvatar(dt);
  if(RIDE.prev==='dwell'&&a.state==='run'){
    const depSt=RIDE.depSt||a.stSt||(typeof stationNear==='function'?stationNear(a.s):null);
    if(depSt&&Math.abs(sdiff(a.s,depSt.s+(TK[a.key]?TK[a.key].so:0)))<120)a.last=depSt.i;
    RIDE.lastDepSt=depSt||null;RIDE.soon=false;
    /* 同じ駅間では一度だけ放送する（区間の途中で信号停車→再発車しても鳴らし直さない） */
    const ns=aiStop(a),segKey=(a.name||'T')+'|'+(a.dir||1)+'|'+(depSt?depSt.i:'')+'|'+(ns&&ns.st?ns.st.i:'');
    if(RIDE.annSeg!==segKey){RIDE.annSeg=segKey;triggerRideAnnounce(a,'next');}}
  if(!RIDE.soon&&a.state==='run'){const nx=aiStop(a),thr=(LINE_ID==='branch2')?200:((KIND[a.key]==='ltd'&&!BRANCH)?1000:600);if(nx&&nx.D<thr){RIDE.soon=true;triggerRideAnnounce(a,'soon');}}
  if(RIDE.prev==='run'&&a.state==='dwell'){RIDE.depSt=a.stSt||stationNear(a.s);stopAdBroadcast();}
  RIDE.prev=a.state;}
/* ================= people inside trains (seats, standing, walking in/out) ================= */
const INTP=[],INTW=[];
/* 車内で止まっている（座っている・立っている）人は、車両ごとに1つのメッシュへまとめて描く。
   見た目は個別に描くのと同じ。動き出す人だけ個別に戻す。→ 描画回数が 人数ぶん → 車両1回 に減る */
const PB_DIRTY=new Set(),_pbM=new THREE.Matrix4(),_pbN=new THREE.Matrix3();
function pbOf(h){let b=h.userData.pb;if(b)return b;b={h,geo:null,mesh:null,cap:0,used:0,garbage:0,members:new Map(),lo:Infinity,hi:-1,rebuild:false,pos:null,nor:null,col:null};h.userData.pb=b;return b;}
function pbSphere(h){return h===cab?new THREE.Sphere(new THREE.Vector3(0,2.2,11),12):new THREE.Sphere(new THREE.Vector3(0,2.2,0),12.5);}
function pbAlloc(b,cap){if(b.geo)b.geo.dispose();b.cap=cap;b.pos=new Float32Array(cap*3);b.nor=new Int8Array(cap*3);b.col=new Uint8Array(cap*3); /* 向き・色は1バイト */
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(b.pos,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal',new THREE.BufferAttribute(b.nor,3,true).setUsage(THREE.DynamicDrawUsage));g.setAttribute('color',new THREE.BufferAttribute(b.col,3,true).setUsage(THREE.DynamicDrawUsage));
  g.boundingSphere=pbSphere(b.h);g.setDrawRange(0,0);b.geo=g;
  if(!b.mesh){b.mesh=new THREE.Mesh(g,upperMat);b.mesh.layers.mask=b.h.layers.mask;b.mesh.matrixAutoUpdate=false;b.h.add(b.mesh);}else b.mesh.geometry=g;}
function pbWrite(b,p,at){const g=p.g,src=g.userData.mesh.geometry,n=src.attributes.position.count;g.updateMatrix();_pbM.copy(g.matrix);_pbN.getNormalMatrix(_pbM);
  const e=_pbM.elements,ne=_pbN.elements,sp=src.attributes.position.array,sn=src.attributes.normal.array,sc=src.attributes.color.array,P=b.pos,N=b.nor,C=b.col;
  for(let i=0;i<n;i++){const i3=i*3,o=(at+i)*3,x=sp[i3],y=sp[i3+1],z=sp[i3+2];
    P[o]=e[0]*x+e[4]*y+e[8]*z+e[12];P[o+1]=e[1]*x+e[5]*y+e[9]*z+e[13];P[o+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
    const a=sn[i3],bb=sn[i3+1],c=sn[i3+2];let nx=ne[0]*a+ne[3]*bb+ne[6]*c,ny=ne[1]*a+ne[4]*bb+ne[7]*c,nz=ne[2]*a+ne[5]*bb+ne[8]*c;const l=Math.hypot(nx,ny,nz)||1;
    N[o]=Math.round(nx/l*127);N[o+1]=Math.round(ny/l*127);N[o+2]=Math.round(nz/l*127);C[o]=Math.round(sc[i3]*255);C[o+1]=Math.round(sc[i3+1]*255);C[o+2]=Math.round(sc[i3+2]*255);}
  return n;}
function pbMark(b,lo,hi){if(lo<b.lo)b.lo=lo;if(hi>b.hi)b.hi=hi;PB_DIRTY.add(b);}
function pbRebuild(b){if(!b.members.size){if(b.mesh){b.h.remove(b.mesh);b.mesh=null;}if(b.geo){b.geo.dispose();b.geo=null;}b.pos=b.nor=b.col=null;b.cap=0;b.used=0;b.garbage=0;b.rebuild=false;return;}let tot=0;for(const q of b.members.keys())tot+=q.g.userData.mesh.geometry.attributes.position.count;
  const need=Math.max(2000,Math.ceil(tot*1.15));if(!b.geo||need>b.cap||need<b.cap*0.4)pbAlloc(b,need);
  let at=0;for(const q of b.members.keys()){const n=pbWrite(b,q,at);b.members.set(q,[at,n]);at+=n;}
  b.used=at;b.garbage=0;b.geo.setDrawRange(0,at);b.lo=0;b.hi=at;b.rebuild=false;PB_DIRTY.add(b);
  const f=b.members.keys().next().value;if(f&&b.mesh)b.mesh.layers.mask=f.g.userData.mesh.layers.mask;}
function pbDetach(p,h){p.pb=h.userData.pb;p.pbH=h;h.remove(p.g);}
function pbAdd(p){const h=p.g.parent;if(!h||p.pb||!p.used)return;const b=pbOf(h),n=p.g.userData.mesh.geometry.attributes.position.count;
  if(!b.geo||b.used+n>b.cap){b.members.set(p,null);pbDetach(p,h);pbRebuild(b);return;}
  const at=b.used;pbWrite(b,p,at);b.members.set(p,[at,n]);b.used+=n;b.geo.setDrawRange(0,b.used);pbMark(b,at,at+n);pbDetach(p,h);}
function pbAddMany(h,list){const b=pbOf(h);let any=false;for(const p of list)if(p&&p.used&&!p.pb&&p.g.parent===h){b.members.set(p,null);pbDetach(p,h);any=true;}if(any)pbRebuild(b);}
function pbRemove(p,reattach){const b=p.pb;if(!b)return;const r=b.members.get(p);b.members.delete(p);
  if(r){b.pos.fill(0,r[0]*3,(r[0]+r[1])*3);b.garbage+=r[1];pbMark(b,r[0],r[0]+r[1]);if(b.garbage>3000&&b.garbage>b.used*0.4)b.rebuild=true;}
  const h=p.pbH;p.pb=null;p.pbH=null;if(reattach!==false&&h){h.add(p.g);p.g.visible=true;}}
function pbClear(h){const b=h&&h.userData.pb;if(!b)return;for(const q of b.members.keys()){q.pb=null;q.pbH=null;}b.members.clear();b.used=0;b.garbage=0;
  if(b.mesh){b.h.remove(b.mesh);b.mesh=null;}if(b.geo){b.geo.dispose();b.geo=null;}b.pos=b.nor=b.col=null;b.cap=0;PB_DIRTY.delete(b);} /* メモリを返す */
function pbFlush(){for(const b of PB_DIRTY){if(b.rebuild||(b.geo&&b.garbage>0&&b.used>0&&b.garbage>=b.used*0.9))pbRebuild(b);if(b.hi>b.lo&&b.geo){for(const k of ['position','normal','color']){const at=b.geo.attributes[k];at.updateRange.offset=b.lo*3;at.updateRange.count=(b.hi-b.lo)*3;at.needsUpdate=true;}}b.lo=Infinity;b.hi=-1;}PB_DIRTY.clear();}
function intPerson(body){body=body||pickKind();let p=INTP.find(x=>!x.used&&x.body===body);if(!p){p={g:makePerson(body==='child'?'child':null),body,used:false};INTP.push(p);}p.used=true;p.g.visible=true;p.path=null;p.sit=null;p.onDone=null;p.strapI=null;p.strapYaw=null;p.tgt=null;p.standYaw=null;return p;}
const mkSeats=(front,rear)=>{const o=[];for(const sg of [-1,1])for(const [a,b] of salLayout(front,rear).seats)for(let z=a+0.35;z<b-0.2;z+=0.55)o.push({x:sg*1.02,z,yaw:sg<0?Math.PI/2:-Math.PI/2,h:1.67});return o;};
const SEATS=mkSeats(false,false),SEATS_F=mkSeats(true,false),SEATS_R=mkSeats(false,true),SEATS_FR=mkSeats(true,true);
const standRange=car=>{const u=car.userData;if(u.green)return [-8.6,8.6]; /* グリーン車は standGreen で別扱い */const [z0,z1]=salZRange(!!u.cabF,!!u.cabR);return [Math.max(-8.6,z0+0.45),Math.min(8.6,z1-0.45)];};
const GSEATS=GSEATS2.map(s2=>({x:s2.x,z:s2.z-0.06,yaw:Math.PI,h:GFLOOR[s2.fl]+0.46,fl:s2.fl}));
const GSEATS_FLAT=(()=>{const o=[];for(let z=-5.9;z<=5.95;z+=1.05)for(const x of [-1.00,-0.52,0.52,1.00])o.push({x,z:z-0.06,yaw:Math.PI,h:1.16+0.46});return o;})();
const seatsOf=(a,k)=>{const c=a.tr.cars[k],u=c?c.userData:{};if(u.green)return u.gflat?GSEATS_FLAT:GSEATS;return u.cabF&&u.cabR?SEATS_FR:u.cabF?SEATS_F:u.cabR?SEATS_R:SEATS;};
const isPop=(a,k)=>!!(a.insideSet&&a.insideSet.has(k));
function carSlots(a,k){a.slots=a.slots||{};return a.slots[k]||(a.slots[k]={seat:new Array(seatsOf(a,k).length).fill(null),stand:[]});}
function releaseOne(a,p){pbRemove(p,false);p.used=false;p.g.visible=false;p.path=null;p.onDone=null;if(p.g.parent)p.g.parent.remove(p.g);if(a.inside){const i=a.inside.indexOf(p);if(i>=0)a.inside.splice(i,1);}}
function releaseInterior(a){if(a.tr&&a.tr.cars)for(const c of a.tr.cars)pbClear(c);if(a.inside)for(const p of a.inside.slice()){p.pb=null;p.pbH=null;p.used=false;p.g.visible=false;p.path=null;p.onDone=null;if(p.g.parent)p.g.parent.remove(p.g);}a.inside=null;a.insideSet=null;a.slots=null;}
/* つり革：立ち位置（車両ローカル）。手がつり革（x=±0.75）の下にくるよう体をずらす */
const STRAPSP={};
function strapSpots(front,rear){const k=(+!!front)+''+(+!!rear);if(STRAPSP[k])return STRAPSP[k];const o=[];
  for(const sg of [-1,1])for(const z of salLayout(!!front,!!rear).straps)o.push({sg,z});return STRAPSP[k]=o;}
function canStrap(p){const u=p.g.userData;return !u.child&&!u.staff;}
function strapPlace(p,sg,z){const g=p.g,sc=g.scale.x,ax=(VD[g.userData.vi].shoulder/2+0.045)*sc;
  return {x:sg*0.62,z:sg>0?z+ax:z-ax,yaw:sg>0?Math.PI/2:-Math.PI/2};}
function strapPose(p,sp,y){const q=strapPlace(p,sp.sg,sp.z);p.g.position.set(q.x,y,q.z);p.g.rotation.set(0,q.yaw,0);personPose(p.g,'strap');}
function nearStrapTaken(list,spots,x,z){if(Math.abs(x)<0.4||Math.abs(x)>0.9)return false;for(let j=0;j<list.length;j++)if(list[j]&&spots[j].sg===Math.sign(x)&&Math.abs(spots[j].z-z)<0.5)return true;return false;}
function sitPose(p,st){const g=p.g;personPose(g,'sit');g.position.set(st.x,st.h-0.84*g.scale.y,st.z);g.rotation.set(0,st.yaw,0);}
function isNoPaxTrain(a){
  if(!a)return false;
  if(a===OWNAI)return !!(G&&(G.isTest||G.rsManual==='試運転'||G.rsManual==='回送'));
  return !!a.test;
}
function populateCars(a,cars){if(isNoPaxTrain(a))return;if(!_crowdSeedDepth)return withCrowdSeed('inside|'+LINE_ID+'|'+trainStopSeed(a)+'|'+(cars||[]).join(','),()=>populateCarsBody(a,cars));return populateCarsBody(a,cars);}
function populateCarsBody(a,cars){if(isNoPaxTrain(a))return;a.inside=a.inside||[];a.insideSet=a.insideSet||new Set();const perCar=Math.min(SEATS.length+standCap(),Math.max(0,Math.round((a.load||0)/Math.max(1,a.tr.cars.length))));
  const doorZs=(a.tr.cars[0]&&a.tr.cars[0].userData.green)?GDOORZ:DOORZ;
  const doorDist=z=>Math.min(...doorZs.map(d=>Math.abs(z-d)));
  for(const k of cars){if(a.insideSet.has(k)||!a.tr.cars[k])continue;a.insideSet.add(k);const car=a.tr.cars[k],sl=carSlots(a,k),SE=seatsOf(a,k);let rs=(k*7919+a.name.charCodeAt(1)*131+7)%2147483647;const rr=()=>{rs=(rs*16807)%2147483647;return (rs-1)/2147483646;};
    const order=SE.map((v,i)=>[rr(),i]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]),maxSeat=PAX?Math.max(0,SE.length-4):SE.length,seated=Math.min(perCar,maxSeat);
    if(RESV&&RESV.a===a&&RESV.k===k&&!sl.seat[RESV.si])sl.seat[RESV.si]='RES'; /* 予約席は空けておく */
    const bl=[]; // 静止した人（まとめ描画に入れる）
    for(let i=0;i<seated;i++){const si=order[i];if(sl.seat[si])continue;const p=intPerson();sitPose(p,SE[si]);car.add(p.g);p.g.traverse(o2=>o2.layers.mask=car.layers.mask);a.inside.push(p);sl.seat[si]=p;bl.push(p);}
    /* 立ち位置：車内全体にばらけて立つ（ドア付近・ドア横にも） */
    const [sz0,sz1]=standRange(car),cands=[],ZS=standStepZ();{let row=0;for(let z=sz0;z<=sz1;z+=ZS,row++){if(car.userData.green&&Math.abs(z)<5.9)continue; /* グリーン車はデッキだけ */
      for(const x of (car.userData.green?[-0.9,-0.3,0.3,0.9]:standXs(row)))cands.push({x:x+(rr()-0.5)*0.05,z:z+(rr()-0.5)*0.05,d:doorDist(z)});}}
    if(!car.userData.green)for(const dz of DOORZ)for(const sg of [-1,1])for(const k2 of [-1,1]){const z=dz+k2*0.95;if(z>sz0-0.3&&z<sz1+0.3)cands.push({x:sg*1.08,z,d:0.3,yaw:Math.atan2(-sg*1.08,-k2*0.95)});} /* ドア横（戸袋の前） */
    for(const c of cands)c.k=rr()-(c.d<1.1?0.18:0);cands.sort((a2,b2)=>a2.k-b2.k); // ドア付近をやや優先しつつ全体に
    const standN=Math.min(perCar-seated,standCap());
    const SP=car.userData.green?[]:strapSpots(car.userData.cabF,car.userData.cabR);if(!sl.strap)sl.strap=new Array(SP.length).fill(null);
    const sOrd=SP.map((v,i)=>[rr(),i]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]);let sj=0,ci=0;
    for(let i=0;i<standN;i++){const p=intPerson();car.add(p.g);p.g.traverse(o2=>o2.layers.mask=car.layers.mask);a.inside.push(p);sl.stand.push(p);
      bl.push(p);
      if(sj<sOrd.length&&canStrap(p)&&rr()<0.6){const j=sOrd[sj++];if(!sl.strap[j]){sl.strap[j]=p;p.strapI=j;strapPose(p,SP[j],1.16);continue;}} /* つり革につかまる */
      let c2=cands[ci++%cands.length],g2=0;while(nearStrapTaken(sl.strap,SP,c2.x,c2.z)&&g2++<cands.length)c2=cands[ci++%cands.length];
      p.g.position.set(c2.x,1.16,c2.z);p.g.rotation.set(0,c2.yaw!=null?c2.yaw:rr()*6.28,0);personPose(p.g,'stand');}
    pbAddMany(car,bl);}}
// a passenger who just stepped in: take a free seat if there is one, otherwise stand
function boardInside(a,k,dz,ls,srcG){if(a.tr&&a.tr.rev)dz=-dz;const car=a.tr.cars[k];if(!car)return false;const sl=carSlots(a,k),SE=seatsOf(a,k);const p=intPerson(srcG&&srcG.userData&&srcG.userData.child?'child':null);if(srcG)copyPersonLook(p.g,srcG);car.add(p.g);p.g.traverse(o2=>o2.layers.mask=car.layers.mask);a.inside.push(p);
  p.g.position.set(ls*1.12,1.16,dz);p.g.rotation.set(0,0,0);personPose(p.g,'stand');
  const free=[];sl.seat.forEach((v,i)=>{if(!v)free.push(i);});free.sort((i1,i2)=>Math.abs(SE[i1].z-dz)-Math.abs(SE[i2].z-dz));
  if(free.length){free.sort((i1,i2)=>Math.abs(SE[i1].z-dz)-Math.abs(SE[i2].z-dz)); /* 近い席優先だが奥へ */
    const deep=free.slice().sort((i1,i2)=>Math.abs(SE[i2].z-dz)-Math.abs(SE[i1].z-dz));
    const si=(deep[0]!=null&&Math.random()<0.65)?deep[0]:free[Math.floor(Math.random()*Math.min(3,free.length))];
    sl.seat[si]=p;const st=SE[si];p.path=[[ls*0.45,dz],[st.x*0.5,st.z],[st.x,st.z]];p.sit=st;}
  else{ /* 立ち：ドアから遠い奥を優先。空いていればつり革につかまる */
    const doorZs=DOORZ,[sz0,sz1]=standRange(car);const cand=[];for(let z=sz0;z<=sz1;z+=0.7)cand.push(z);
    cand.sort((a,b)=>Math.min(...doorZs.map(d=>Math.abs(b-d)))-Math.min(...doorZs.map(d=>Math.abs(a-d))));
    const tz=cand[Math.min(sl.stand.length,cand.length-1)]+rand(-0.2,0.2);
    sl.stand.push(p);p.sit=null;
    const SP=car.userData.green?[]:strapSpots(car.userData.cabF,car.userData.cabR);if(!sl.strap)sl.strap=new Array(SP.length).fill(null);
    let bj=-1,bd=1e9;if(canStrap(p)&&Math.random()<0.6)SP.forEach((sp,j)=>{if(sl.strap[j])return;const d=Math.abs(sp.z-tz)+rand(0,1.2);if(d<bd){bd=d;bj=j;}});
    if(bj>=0){sl.strap[bj]=p;p.strapI=bj;const q=strapPlace(p,SP[bj].sg,SP[bj].z);p.strapYaw=q.yaw;p.tgt={x:q.x,z:q.z};p.path=[[SP[bj].sg*0.4,q.z],[q.x,q.z]];}
    else{const [g0,g1]=standRange(car),gr0=standGrid(g0,g1,car.userData.green?null:DOORZ),fs=pickFreeSpot(car.userData.green?gr0.filter(c2=>Math.abs(c2.z)>5.9):gr0,sl.stand,p,sl.strap,SP);
      if(fs){p.tgt={x:fs.x,z:fs.z};p.standYaw=fs.yaw!=null?fs.yaw:rand(0,Math.PI*2);p.path=[[ls*0.55,dz],[fs.x,fs.z]];}else{const fx=rand(-0.5,0.5),fz=car.userData.green?(dz<0?-1:1)*rand(6.0,9.2):rand(g0,g1);p.tgt={x:fx,z:fz};p.standYaw=rand(0,Math.PI*2);p.path=[[ls*0.55,dz],[fx,fz]];}}} /* 満員でも1か所に固まらず向きもランダム（グリーン車はデッキ） */
  INTW.push(p);return true;}
/* 乗ってきた人の立ち位置：決まった立ち位置の中から、立っている人（向かっている途中の人の行き先も）と0.45m以上離れた所を選ぶ。
   なるべく周りが空いている所を選ぶので、ドア付近に固まらず車内に散らばる */
function standGrid(z0,z1,doors){const c=[];let row=0;for(let z=z0;z<=z1;z+=standStepZ(),row++)for(const x of standXs(row))c.push({x,z});
  if(doors)for(const dz of doors)for(const sg of [-1,1])for(const k2 of [-1,1]){const z=dz+k2*0.95;if(z>z0-0.3&&z<z1+0.3)c.push({x:sg*1.08,z,yaw:Math.atan2(-sg*1.08,-k2*0.95)});}return c;}
function pickFreeSpot(grid,stand,self,strapList,strapSpots){
  const occ=[];for(const q of stand){if(!q||q===self)continue;const pt=q.tgt||{x:q.g.position.x,z:q.g.position.z};occ.push({x:pt.x,z:pt.z,ax:obbAxesXZ(q.g?q.g.rotation.y||0:0),ex:personHalfExtents(q.g)});}
  const sAx=obbAxesXZ(0),sEx=self?personHalfExtents(self.g):{hx:0.28,hz:0.14};
  let best=null,bs=-1;for(let n=0;n<30;n++){const c=grid[Math.floor(Math.random()*grid.length)];if(!c)break;
    const cAx=c.yaw!=null?obbAxesXZ(c.yaw):sAx;let hit=false,md=9;
    for(const o of occ){if(resolveOBB2D(c.x,c.z,cAx,sEx,o.x,o.z,o.ax,o.ex)){hit=true;break;}const d=Math.hypot(o.x-c.x,o.z-c.z);if(d<md)md=d;}
    if(hit)continue;if(strapList&&strapSpots&&nearStrapTaken(strapList,strapSpots,c.x,c.z))continue;const sc=Math.min(md,2.0)+Math.random()*0.5;if(sc>bs){bs=sc;best=c;}}
  if(best)return best;for(const c of grid){const cAx=c.yaw!=null?obbAxesXZ(c.yaw):sAx;let ok=true;for(const o of occ)if(resolveOBB2D(c.x,c.z,cAx,sEx,o.x,o.z,o.ax,o.ex)){ok=false;break;}if(ok)return c;}return null;}
// someone inside gets up, walks to the door, then continues on the platform
/* ドアに近い席の人ほど降りやすい（近い3人から選ぶ） */
function pickSeatedNear(seats,SE,z0){const c=[];seats.forEach((q,i)=>{if(q&&q.used)c.push([Math.abs(SE[i].z-z0),i]);});if(!c.length)return -1;
  c.sort((x,y)=>x[0]-y[0]);return c[Math.floor(Math.random()*Math.min(3,c.length))][1];}
/* 空いた席には近くに立っている人が座る（ときどき） */
function sitFromStand(stand,strapArr,seatArr,si,st,rel){let bi=-1,bd=3.5;
  stand.forEach((q,i)=>{if(!q||!q.used||(q.path&&q.path.length))return;const d=Math.abs(q.g.position.z-st.z);if(d<bd){bd=d;bi=i;}});
  if(bi<0||Math.random()>0.75)return false;const q=stand.splice(bi,1)[0];
  if(q.strapI!=null&&strapArr&&strapArr[q.strapI]===q)strapArr[q.strapI]=null;q.strapI=null;q.strapYaw=null;
  pbRemove(q);seatArr[si]=q;q.sit=st;const g=q.g;g.position.y=1.16;personPose(g,'walk');q.path=[[st.x*0.45,g.position.z],[st.x*0.5,st.z],[st.x,st.z]];if(!INTW.includes(q))INTW.push(q);return true;}
function seatRefill(a,k,si){if(!isPop(a,k))return;const sl=carSlots(a,k),SE=seatsOf(a,k);if(sl.seat[si]||!SE[si])return;sitFromStand(sl.stand,sl.strap,sl.seat,si,SE[si]);}
function alightInside(a,k,dz,ls,done){if(a.tr&&a.tr.rev)dz=-dz; /* 折り返して逆向きの編成 */const sl=carSlots(a,k),SE=seatsOf(a,k);let p=null,si=-1;
  const fromSeat=sl.seat.some(q=>q&&q.used)&&(!sl.stand.length||Math.random()<0.4); /* 座っている人も一部降りる */
  if(!fromSeat&&sl.stand.length){let bi=0,bd=1e9;sl.stand.forEach((q,i)=>{const d=Math.abs(q.g.position.z-dz);if(d<bd){bd=d;bi=i;}});p=sl.stand.splice(bi,1)[0];
    if(p&&p.strapI!=null&&sl.strap)sl.strap[p.strapI]=null;if(p){p.strapI=null;p.strapYaw=null;}}
  else{si=pickSeatedNear(sl.seat,SE,dz);if(si>=0){p=sl.seat[si];sl.seat[si]=null;
      if(!a.tr.cars[k].userData.green){const fs=si;JOBS.push({t:rand(1.2,2.4),fn:()=>seatRefill(a,k,fs)});}}}
  if(!p||!p.used){done();return;}
  pbRemove(p);const g=p.g;personPose(g,'walk');const x0=g.position.x;g.position.y=1.16;g.position.x=x0*0.8;
  p.path=[[x0*0.4,g.position.z],[ls*0.45,dz],[ls*1.25,dz]];p.sit=null;p.onDone=()=>{const sg=p.g;releaseOne(a,p);done(sg);};if(!INTW.includes(p))INTW.push(p);}
function updIntWalkers(dt){
  const walkSet=new Set();
  for(const p of INTW)if(p&&p.g)walkSet.add(p.g);
  const carsToResolve=new Set();
  for(let i=INTW.length-1;i>=0;i--){const p=INTW[i];if(!p.used||!p.path||!p.path.length){INTW.splice(i,1);continue;}
  const t=p.path[0],g=p.g,dx=t[0]-g.position.x,dz=t[1]-g.position.z,d=Math.hypot(dx,dz),st=1.1*dt;
  if(d>0.01)g.rotation.y=Math.atan2(dx,dz);personPose(g,'walk');p.walk=(p.walk||0)+dt*6;const sw=Math.sin(p.walk)*0.5;g.userData.legs[0].rotation.x=sw;g.userData.legs[1].rotation.x=-sw;
  if(d<=st){g.position.x=t[0];g.position.z=t[1];p.path.shift();if(!p.path.length){INTW.splice(i,1);walkSet.delete(g);
      if(p.sit)sitPose(p,p.sit);else if(p.strapYaw!=null){g.rotation.y=p.strapYaw;personPose(g,'strap');}else{if(p.standYaw!=null)g.rotation.y=p.standYaw;personPose(g,'stand');}
      if(!p.sit&&g.parent&&g.parent.userData&&g.parent.userData.cabF!==undefined)carsToResolve.add(g.parent);
      p.tgt=null;p.standYaw=null;if(p.onDone){const f=p.onDone;p.onDone=null;f();}else pbAdd(p);}}
  else{g.position.x+=dx/d*st;g.position.z+=dz/d*st;}}
  for(const car of carsToResolve){
    const ppl=[];
    for(const ch of car.children){if(ch.visible&&!walkSet.has(ch)&&ch.userData&&ch.userData.mesh&&ch.userData.mode!=='sit'&&Math.abs(ch.position.y-1.16)<0.2)ppl.push(ch);}
    const hasRidePlayer=typeof RIDE!=='undefined'&&RIDE&&RIDE.seat==null&&RIDE.a&&RIDE.a.tr&&RIDE.a.tr.cars&&RIDE.a.tr.cars[RIDE.k]===car;
    if(hasRidePlayer){
      const pAx=obbAxesXZ(W.yaw+Math.PI),pEx={hx:0.30,hz:0.16};
      for(const a of ppl){
        if(Math.abs(a.position.x-RIDE.lx)>0.85||Math.abs(a.position.z-RIDE.lz)>0.85)continue;
        const aAx=obbAxesXZ(a.rotation.y||0),aEx=personHalfExtents(a);
        const res=resolveOBB2D(a.position.x,a.position.z,aAx,aEx,RIDE.lx,RIDE.lz,pAx,pEx);
        if(res){a.position.x=clamp(a.position.x+res[0]*0.9,-rideXLim(car,a.position.z),rideXLim(car,a.position.z));a.position.z+=res[1]*0.9;}
      }
    }
    if(ppl.length<2)continue;
    for(let i=0;i<ppl.length;i++){
      const a=ppl[i],aAx=obbAxesXZ(a.rotation.y||0),aEx=personHalfExtents(a);
      for(let j=i+1;j<ppl.length;j++){
        const b=ppl[j];
        if(Math.abs(a.position.x-b.position.x)>0.85||Math.abs(a.position.z-b.position.z)>0.85)continue;
        const bAx=obbAxesXZ(b.rotation.y||0),bEx=personHalfExtents(b);
        const res=resolveOBB2D(a.position.x,a.position.z,aAx,aEx,b.position.x,b.position.z,bAx,bEx);
        if(!res)continue;
        a.position.x+=res[0]*0.5;a.position.z+=res[1]*0.5;
        b.position.x-=res[0]*0.5;b.position.z-=res[1]*0.5;
        const lmA=rideXLim(car,a.position.z),lmB=rideXLim(car,b.position.z);
        a.position.x=clamp(a.position.x,-lmA,lmA);b.position.x=clamp(b.position.x,-lmB,lmB);
      }
    }
  }
}
let OWNAI=null;
function ownAI(){if(PAX)return null;
  if(!OWNAI)OWNAI={name:'OWN0',tr:ownTrain,vis:true,slots:null,inside:null,insideSet:null,load:60};
  OWNAI.key=G.key;OWNAI.dir=G.dir;OWNAI.s=G.s;OWNAI.state=G.atStation!==null?'dwell':'run';
  OWNAI.stSt=G.atStation!==null?stOf(G.atStation):null;
  if(G.load==null||G.load<10)G.load=trainLoadFor(G.key);
  OWNAI.load=clamp(G.load,0,maxLoadFor(G.key));return OWNAI;}
function updInterior(){const want=new Map();
  if(!PAX){const o=ownAI();
    if(isNoPaxTrain(o)){o.load=0;if(o.insideSet)releaseInterior(o);}
    else if(o&&o.tr&&o.tr.cars){const all=[];for(let i=0;i<o.tr.cars.length;i++)all.push(i);want.set(o,all);}}
  if(RIDE&&RIDE.a&&RIDE.a.tr&&RIDE.a.tr.cars){const NC=RIDE.a.tr.cars.length;want.set(RIDE.a,Array.from({length:NC},(_,i)=>i));}
  const camS=PAX?(RIDE?RIDE.a.s:W.s):G.s;
  const allTrains = [...OT];
  if(IS_ONLINE && window.ONLINE_PLAYERS){
    for(const pid in ONLINE_PLAYERS){
      const p = ONLINE_PLAYERS[pid];
      if(p && p.ai && p.tr && p.tr.cars && p.tr.cars.length && p.tr.grp && p.tr.grp.visible){
        p.ai.vis = true;
        allTrains.push(p.ai);
      }
    }
  }
  for(const a of allTrains){if(!a.key||a.state==='off'||!a.tr||!a.tr.cars||want.has(a))continue;
    if(isNoPaxTrain(a)){a.load=0;if(a.insideSet)releaseInterior(a);continue;}
    if(!a.vis)continue;
    const R0=(a.state==='dwell'?200:160)*(QMODE==='heavy'?1.5:1),dist=[];let any=false;
    for(let i=0;i<a.tr.cars.length;i++){const cs=a.s-(a.dir||1)*(CARHALF+i*CARL),dd=Math.abs(sdiff(camS,cs));dist.push([dd,i]);if(dd<R0)any=true;}
    if(any||(a.insideSet&&dist.some(x=>x[0]<R0+280))){dist.sort((x,y)=>x[0]-y[0]);want.set(a,dist.map(x=>x[1]));} /* 間引きなしで編成全体を描画 */
    else if(a.insideSet&&a.state==='dwell')want.set(a,[]);}
  for(const a of allTrains){if(a.insideSet&&!want.has(a))releaseInterior(a);}
  for(const [a,cars] of want){if(!isNoPaxTrain(a)&&a!==OWNAI&&a.key&&(a.load==null||a.load<carsFor(a.key)*5))a.load=trainLoadFor(a.key);let add=cars.filter(k=>!isPop(a,k));if(add.length)populateCars(a,add);}}
/* ================= in-car displays ================= */
function curTrainInfo(){ // which train's guidance to show
  if(RIDE){const a=RIDE.a,k=a.key||'A',nx=aiStop(a);return {kind:BRANCH?'普通':(KINDNAME[k]||'各停'),col:(SVCLOOK[k]?SVCLOOK[k][0]:0x14935f),dir:a.dir||1,key:k,at:a.state==='dwell'?(a.stSt||stationNear(a.s)):null,next:nx?nx.st:null};}
  if(!PAX&&G.phase==='play'){const st=stOf(G.nv);return {kind:BRANCH?'普通':KINDNAME[G.key],col:SVCLOOK[G.key][0],dir:G.dir,key:G.key,at:G.atStation!==null?stOf(G.atStation):null,next:st};}
  return null;}
/* ================= passengers in the saloon behind the cab (driving mode) ================= */
const SALSEAT=SEATS_F.map(st=>Object.assign({},st,{z:st.z+CARHALF})); // ホーム側と同じ座席位置
const SAL={on:false,pool:[],seat:new Array(SALSEAT.length).fill(null),stand:[],people:[]};
const SALSTRAP=strapSpots(true,false).map(sp=>({sg:sp.sg,z:sp.z+CARHALF}));SAL.strap=new Array(SALSTRAP.length).fill(null);
function salPerson(body){body=body||pickKind();let p=SAL.pool.find(x=>!x.used&&x.body===body);
  if(!p){const g=makePerson(body==='child'?'child':null);g.traverse(o=>o.layers.set(2));p={g,body,used:false};SAL.pool.push(p);}
  p.used=true;p.g.visible=true;p.path=null;p.sit=null;p.onDone=null;p.strapI=null;p.strapYaw=null;p.tgt=null;p.standYaw=null;cab.add(p.g);SAL.people.push(p);return p;}
function salFree(p){pbRemove(p,false);if(p.strapI!=null&&SAL.strap[p.strapI]===p)SAL.strap[p.strapI]=null;p.strapI=null;p.strapYaw=null;p.used=false;p.g.visible=false;p.path=null;p.onDone=null;if(p.g.parent)p.g.parent.remove(p.g);const i=SAL.people.indexOf(p);if(i>=0)SAL.people.splice(i,1);}
function syncSalFromCar(){
  if(PAX||!ownTrain||!ownTrain.cars||!ownTrain.cars.length)return;
  const a=ownAI();if(!a)return;
  const k0=CONDV?(ownTrain.cars.length-1):0;
  if(!isPop(a,k0))populateCars(a,[k0]);
  const sl=carSlots(a,k0);if(!sl)return;
  const flip=(CONDV?1:0)^(ownTrain.rev?1:0);
  const mapX=x=>flip?-x:x;
  const mapZ=z=>flip?(CARHALF-z):(z+CARHALF);
  const mapYRot=ry=>flip?(ry+Math.PI):ry;
  SAL.on=true;for(const p of SAL.people.slice())salFree(p);SAL.seat.fill(null);SAL.stand.length=0;SAL.strap.fill(null);
  const bl=[];
  if(sl.seat){
    for(let i=0;i<sl.seat.length;i++){
      const sp=sl.seat[i];if(!sp||!sp.used||typeof sp==='string')continue;
      const p=salPerson(sp.body);
      copyPersonLook(p.g,sp.g);
      personPose(p.g,'sit');
      p.g.position.set(mapX(sp.g.position.x),sp.g.position.y,mapZ(sp.g.position.z));
      p.g.rotation.set(0,mapYRot(sp.g.rotation.y||0),0);
      if(i<SAL.seat.length)SAL.seat[i]=p;
      bl.push(p);
    }
  }
  if(sl.stand){
    for(const sp of sl.stand){
      if(!sp||!sp.used)continue;
      const p=salPerson(sp.body);
      copyPersonLook(p.g,sp.g);
      SAL.stand.push(p);
      personPose(p.g,sp.strapI!=null?'strap':'stand');
      const pz=clamp(mapZ(sp.g.position.z),2.6,19.4);
      p.g.position.set(mapX(sp.g.position.x),sp.g.position.y,pz);
      p.g.rotation.set(0,mapYRot(sp.g.rotation.y||0),0);
      bl.push(p);
    }
  }
  pbAddMany(cab,bl);
}
function salFill(n){syncSalFromCar();}
function salFillBody(n){if(G&&(G.isTest||G.rsManual==='試運転'||G.rsManual==='回送'))n=0;n=Math.min(n,SALSEAT.length+standCap()-6);SAL.on=true;for(const p of SAL.people.slice())salFree(p);SAL.seat.fill(null);SAL.stand.length=0;
  const order=SALSEAT.map((v,i)=>[Math.random(),i]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),seated=Math.min(n,SALSEAT.length);
  for(let i=0;i<seated;i++){const si=order[i],p=salPerson();sitPose(p,SALSEAT[si]);SAL.seat[si]=p;}
  SAL.strap.fill(null);const sOrd=SALSTRAP.map((v,i)=>[Math.random(),i]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);let sj=0;
  const scand=[];{let row=0;for(let z=3.2;z<=18.6;z+=standStepZ(),row++)for(const x of standXs(row))scand.push({x:x+rand(-0.025,0.025),z:z+rand(-0.025,0.025),r:Math.random()});}for(const dz of salLayout(true,false).doors)for(const sg of [-1,1])for(const k2 of [-1,1]){const z=dz+CARHALF+k2*0.95;if(z>3.0&&z<19.0)scand.push({x:sg*1.08,z,r:Math.random()-0.18,yaw:Math.atan2(-sg*1.08,-k2*0.95)});}
  scand.sort((a,b)=>a.r-b.r); // 重ならない立ち位置（ドア横も）
  for(let i=seated;i<n;i++){const p=salPerson();SAL.stand.push(p);
    if(sj<sOrd.length&&canStrap(p)&&Math.random()<0.6){const j=sOrd[sj++];SAL.strap[j]=p;p.strapI=j;strapPose(p,SALSTRAP[j],1.16);continue;} /* つり革 */
    let c2=null;while(scand.length){const c=scand.pop();if(!nearStrapTaken(SAL.strap,SALSTRAP,c.x,c.z)){c2=c;break;}}
    if(!c2)c2={x:rand(-0.3,0.3),z:rand(3.2,18.6)};
    p.g.position.set(c2.x,1.16,c2.z);p.g.rotation.set(0,c2.yaw!=null?c2.yaw:rand(0,6.28),0);personPose(p.g,'stand');}
  pbAddMany(cab,SAL.people.filter(q=>q.used&&!(q.path&&q.path.length)));}
function salBoard(dz,ls,srcG){const p=salPerson(srcG&&srcG.userData&&srcG.userData.child?'child':null),z0=9.75+dz;
  if(srcG)copyPersonLook(p.g,srcG);
  p.g.position.set(ls*1.12,1.16,z0);p.g.rotation.set(0,0,0);personPose(p.g,'stand');
  const free=[];SAL.seat.forEach((v,i)=>{if(!v)free.push(i);});free.sort((a,b)=>Math.abs(SALSEAT[a].z-z0)-Math.abs(SALSEAT[b].z-z0));
  if(free.length){const deep=free.slice().sort((a,b)=>Math.abs(SALSEAT[b].z-z0)-Math.abs(SALSEAT[a].z-z0));
    const si=(Math.random()<0.6)?deep[0]:free[Math.floor(Math.random()*Math.min(3,free.length))];
    SAL.seat[si]=p;const st=SALSEAT[si];p.path=[[ls*0.45,z0],[st.x*0.5,st.z],[st.x,st.z]];p.sit=st;}
  else{ /* 立ちは奥（z大きい／ドアから遠い）へ */
    const tz=z0+(z0<12?rand(2.5,6.5):rand(-6.5,-2.5));SAL.stand.push(p);
    let bj=-1,bd=1e9;if(canStrap(p)&&Math.random()<0.6)SALSTRAP.forEach((sp,j)=>{if(SAL.strap[j])return;const d=Math.abs(sp.z-tz)+rand(0,1.2);if(d<bd){bd=d;bj=j;}});
    if(bj>=0){SAL.strap[bj]=p;p.strapI=bj;const q=strapPlace(p,SALSTRAP[bj].sg,SALSTRAP[bj].z);p.strapYaw=q.yaw;p.tgt={x:q.x,z:q.z};p.path=[[SALSTRAP[bj].sg*0.4,q.z],[q.x,q.z]];}
    else{const fs=pickFreeSpot(standGrid(3.2,18.6,salLayout(true,false).doors.map(d=>d+CARHALF)),SAL.stand,p,SAL.strap,SALSTRAP);
      if(fs){p.tgt={x:fs.x,z:fs.z};p.standYaw=fs.yaw!=null?fs.yaw:rand(0,Math.PI*2);p.path=[[ls*0.55,z0],[fs.x,fs.z]];}else{const fx=rand(-0.5,0.5),fz=rand(3.4,18.4);p.tgt={x:fx,z:fz};p.standYaw=rand(0,Math.PI*2);p.path=[[ls*0.55,z0],[fx,fz]];}}}
  INTW.push(p);}
function salAlight(dz,ls,done){const z0=9.75+dz;let p=null,si=-1;
  const fromSeat=SAL.seat.some(q=>q&&q.used)&&(!SAL.stand.length||Math.random()<0.4); /* 座っている人も一部降りる */
  if(!fromSeat&&SAL.stand.length){let bi=0,bd=1e9;SAL.stand.forEach((q,i)=>{const d=Math.abs(q.g.position.z-z0);if(d<bd){bd=d;bi=i;}});p=SAL.stand.splice(bi,1)[0];
    if(p&&p.strapI!=null&&SAL.strap[p.strapI]===p)SAL.strap[p.strapI]=null;if(p){p.strapI=null;p.strapYaw=null;}}
  else{si=pickSeatedNear(SAL.seat,SALSEAT,z0);if(si>=0){p=SAL.seat[si];SAL.seat[si]=null;const fs=si;
      JOBS.push({t:rand(1.2,2.4),fn:()=>{if(SAL.on&&!SAL.seat[fs])sitFromStand(SAL.stand,SAL.strap,SAL.seat,fs,SALSEAT[fs]);}});}}
  if(!p||!p.used){done();return;}
  pbRemove(p);const g=p.g;personPose(g,'walk');g.position.y=1.16;g.position.x*=0.8;
  p.path=[[g.position.x*0.4,g.position.z],[ls*0.45,z0],[ls*1.25,z0]];p.sit=null;p.onDone=()=>{const sg=p.g;salFree(p);done(sg);};if(!INTW.includes(p))INTW.push(p);}
function fitText(x,t,cx,cy,maxW,size,weight,align){let sz=size;x.textAlign=align||'left';
  for(let i=0;i<14;i++){x.font=(weight||'700')+' '+sz+'px '+FONT;if(x.measureText(t).width<=maxW||sz<=11)break;sz-=2;}
  x.fillText(t,cx,cy);return sz;}
function upcomingStops(n){const out=[];
  if(RIDE){const a=RIDE.a,nx=aiStop(a);if(!nx)return out;let cur=STATIONS.indexOf(nx.st),guard=0;
    while(out.length<n&&guard++<200){const s2=STATIONS[cur];if(BRANCH||serves(s2,a.key))out.push(s2);
      if(BRANCH&&((a.dir>0&&cur===NST-1)||(a.dir<0&&cur===0)))break;cur=mod(cur+a.dir,NST);}
    return out;}
  for(let v=0;v<n;v++){const s2=stOf(G.nv+v);if(!s2)break;out.push(s2);}
  return out;}
function etaList(n){ // rough arrival clocks for the stops ahead
  const key=RIDE?RIDE.a.key:G.key,kd=BRANCH?'branch':KIND[key],vAvg={local:15,rapid:20,ltd:26,exp:24,branch:15}[kd]||15;
  const here=RIDE?RIDE.a.s:G.s,dir=RIDE?RIDE.a.dir:G.dir,list=upcomingStops(n),out=[];let t=0,prev=here;
  for(let i2=0;i2<list.length;i2++){const st=list[i2],d=Math.abs(dir*sdiff(st.s,prev));t+=d/vAvg+(i2?28:0);prev=st.s;
    out.push({st,at:new Date(nowMs()+t*1000)});}
  return out;}
function stationInfo(st){const tl=transferLines(st).map(l=>l[0]);
  const ex=st.big?['東口','西口','中央口']:st.cls==='L'?['駅前口']:['東口','西口'];
  const fac=[];if(st.big||st.cls==='X')fac.push('エレベーター');if(st.big)fac.push('みどりの窓口','コインロッカー');fac.push('多機能トイレ');
  return {tl,ex,fac};}
/* 車内の横長案内液晶ディスプレイ（旧電光掲示板を液晶へ刷新）とドア開閉予告灯 */
const OLS={msg:'',w:0,x:0};
function drawOLED(dt){if(!BRANCH)return;const inf=curTrainInfo(),x=OLED.x,W=768,H=80;let msg='';
  if(inf){const n=inf.next;if(inf.at)msg=inf.at.name+'（'+enName(inf.at)+'）　｜　'+(n?'次は '+n.name+'（Next: '+enName(n)+'）':'終点です。ご乗車ありがとうございました。');
    else if(n)msg='この電車は 普通 '+(inf.dir>0?STATIONS[NST-1]:STATIONS[0]).name+'行き　｜　次は '+n.name+'（Next: '+enName(n)+'）';}
  else msg='ご乗車ありがとうございます。';
  x.font='700 34px '+FONT;if(msg!==OLS.msg){OLS.msg=msg;OLS.w=x.measureText(msg).width;OLS.x=W;}
  OLS.x-=dt*115;if(OLS.x<-OLS.w)OLS.x=W;
  const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0e1b30');bg.addColorStop(1,'#09111f');
  x.fillStyle=bg;x.fillRect(0,0,W,H);
  x.fillStyle=inf?('#'+inf.col.toString(16).padStart(6,'0')):'#2e8b57';x.fillRect(0,0,10,H);
  x.fillStyle='#eef5ff';x.textBaseline='middle';x.textAlign='left';x.fillText(msg,OLS.x,H/2);
  OLED.tex.needsUpdate=true;}
function updDoorLamps(){if(!BRANCH)return;let side=0,on=false; /* 車両の左右（-1/+1）のどちら側が開くか */
  if(RIDE){const a=RIDE.a,T=TK[a.key],fl=trSgn(a.tr);const st=a.state==='dwell'?a.stSt:(()=>{const n=aiStop(a);return n&&n.D<700?n.st:null;})();
    if(st){side=T.side(st)*fl;on=true;}}
  else if(!PAX&&G.phase==='play'){const d=stopDist(G.nv),st=G.atStation!==null?stOf(G.atStation):(d<700&&d>-5?stOf(G.nv):null);
    if(st){side=localSide(st);on=true;}}
  const lit=0xff3b1f,off=0x3a0e0a;TM.ilampL.color.setHex(on&&side<0?lit:off);TM.ilampR.color.setHex(on&&side>0?lit:off);}
/* v1.9.8：戸締め放送のあいだ、車内LCDを赤背景の点滅表示にする */
function drawDoorWarn(cv,txt){const x=cv.x,W=cv.w||512,H=cv.h||274,nowp=performance.now(),on=(nowp%620)<400;
  const g=x.createLinearGradient(0,0,0,H);
  g.addColorStop(0,on?'#e01b12':'#8d0d08');g.addColorStop(1,on?'#9c0f09':'#5c0603');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  x.save();x.globalAlpha=on?0.13:0.07;x.fillStyle='#ffffff';
  const off=(nowp*0.04)%64;
  for(let q=-H-64;q<W+64;q+=64){x.beginPath();x.moveTo(q+off,0);x.lineTo(q+26+off,0);x.lineTo(q+26+H+off,H);x.lineTo(q+H+off,H);x.closePath();x.fill();}
  x.restore();
  const cx=W/2,cy=H*0.27,iw=Math.min(W,H)*0.15;
  x.strokeStyle='#ffffff';x.lineWidth=Math.max(3,W*0.009);
  x.strokeRect(cx-iw*0.62,cy-iw*0.62,iw*0.54,iw*1.24);
  x.strokeRect(cx+iw*0.08,cy-iw*0.62,iw*0.54,iw*1.24);
  x.fillStyle='#ffffff';x.beginPath();x.moveTo(cx-iw*0.30,cy);x.lineTo(cx-iw*0.08,cy-iw*0.22);x.lineTo(cx-iw*0.08,cy+iw*0.22);x.closePath();x.fill();
  x.beginPath();x.moveTo(cx+iw*0.30,cy);x.lineTo(cx+iw*0.08,cy-iw*0.22);x.lineTo(cx+iw*0.08,cy+iw*0.22);x.closePath();x.fill();
  x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#ffffff';fitText(x,txt||'ドアが閉まります',W/2,H*0.60,W-30,H*0.19,'700','center');
  x.fillStyle=on?'#ffe08a':'#ffc24a';fitText(x,'Doors are closing',W/2,H*0.79,W-40,H*0.10,'700','center');
  x.fillStyle='rgba(255,255,255,.88)';fitText(x,'ご注意ください',W/2,H*0.91,W-40,H*0.075,'500','center');
  cv.tex.needsUpdate=true;}

function drawInfoPanel(){const x=DLED.x,W=512,H=274,inf=curTrainInfo();
  if(doorWarnOn()){drawDoorWarn(DLED,'ドアが閉まります');drawDoorWarn(DLED_R,'ドアが閉まります');return;}
  x.fillStyle='#0a1422';x.fillRect(0,0,W,H);
  const line=BRANCH?(LINE_ID==='branch2'?'紫雲地下線':LINE_ID==='branch3'?'天宮高架線':LINE_ID==='branch4'?'港見支線':LINE_ID==='branch5'?'四嶺連絡高速線':'白峰支線'):'汐見環状線',kind=inf?inf.kind:'',col=inf?'#'+inf.col.toString(16).padStart(6,'0'):'#14935f';
  const tm=RIDE?!!(RIDE.a&&RIDE.a.twoMan):(!PAX&&!!G.twoMan);
  x.fillStyle=col;x.fillRect(0,0,W,46);x.fillStyle='#fff';x.textBaseline='middle';fitText(x,line+'　'+kind+'　'+(tm?'ツーマン':'ワンマン'),14,24,340,26,'700');
  x.textAlign='right';x.font='700 24px '+FONT;x.fillText(hms(nowMs()),W-14,24);x.textAlign='left';
  if(!inf){x.fillStyle='#9fb0c8';fitText(x,'ご乗車ありがとうございます',W/2,150,W-40,24,'500','center');DLED.tex.needsUpdate=true;return;}
  const st=inf.at||inf.next;if(!st){DLED.tex.needsUpdate=true;return;}
  const page=Math.floor(performance.now()/6500)%5,sd=TK[inf.key].side(st)*inf.dir;
  if(page===0){ // 次の駅
    x.fillStyle='#9fb0c8';fitText(x,inf.at?'ただいま':'次は　Next',18,78,300,22,'500');
    x.fillStyle='#fff';fitText(x,st.name,18,130,W-40,62,'700');x.fillStyle='#cfe0ff';fitText(x,st.kana,20,172,W-40,26,'500');
    const tl=transferLines(st).map(l=>l[0]);
    if(tl.length){x.fillStyle='#ffd23f';fitText(x,'のりかえ：'+tl.join('・'),18,208,W-36,20,'500');}}
  else if(page===1){ // この先の停車駅と到着時刻
    x.fillStyle='#9fb0c8';fitText(x,'この先の停車駅　Stops ahead',18,74,W-36,22,'500');
    const rows=etaList(4);rows.forEach((r,i2)=>{const y=110+i2*38;
      x.fillStyle=i2?'#16263f':'#1d3f7a';x.fillRect(14,y-17,W-28,34);
      x.fillStyle='#fff';fitText(x,r.st.name,24,y,300,26,'700');
      x.fillStyle='#8fd6ff';x.textAlign='right';x.font='700 24px '+FONT;x.fillText(hms(+r.at),W-24,y);x.textAlign='left';});}
  else if(page===2){ // 駅の案内
    const I=stationInfo(st);
    x.fillStyle='#9fb0c8';fitText(x,(inf.at?'この駅':'次の駅')+'のご案内',18,72,W-36,22,'500');
    x.fillStyle='#fff';fitText(x,st.name+'　'+st.kana,18,108,W-36,34,'700');
    x.fillStyle='#ffd23f';fitText(x,'のりかえ：'+(I.tl.length?I.tl.join('・'):'なし'),18,150,W-36,22,'500');
    x.fillStyle='#cfe0ff';fitText(x,'出口：'+I.ex.join('・'),18,184,W-36,22,'500');
    fitText(x,'設備：'+I.fac.join('・'),18,216,W-36,22,'500');}
  else if(page===3){ // この号車
    const kcar=RIDE?RIDE.k:0,green=RIDE?RIDE.a.tr.cars[kcar].userData.green:(ownTrain.cars[kcar]&&ownTrain.cars[kcar].userData.green);
    const ncar=RIDE?RIDE.a.tr.cars.length:ownTrain.cars.length;
    x.fillStyle=green?'#1f7a4a':'#16263f';x.fillRect(14,64,W-28,150);
    x.fillStyle='#fff';fitText(x,(kcar+1)+'号車',W/2,116,W-60,58,'700','center');
    fitText(x,green?'グリーン車　Green Car':'普通車　'+ncar+'両編成',W/2,176,W-60,26,'700','center');
    x.fillStyle='#9fb0c8';fitText(x,(sd<0?'左側':'右側')+'のドアが開きます',W/2,240,W-40,22,'500','center');}
  else{ // お願い
    const tips=['携帯電話はマナーモードに設定し、通話はお控えください。','優先席をお譲りください。','ドアに手や荷物を挟まれないようご注意ください。','駆け込み乗車はおやめください。','お忘れ物のないようご注意ください。'];
    const tip=tips[Math.floor(performance.now()/6500/5)%tips.length];
    x.fillStyle='#b3202a';x.fillRect(14,64,W-28,60);x.fillStyle='#fff';fitText(x,'お願い　Notice',W/2,94,W-60,30,'700','center');
    x.fillStyle='#e8eef6';const words=tip.split('');let ln='',y=162;
    for(const ch of words){if(x.measureText(ln+ch).width>W-70&&ln.length>6){fitText(x,ln,W/2,y,W-50,24,'500','center');y+=34;ln='';}ln+=ch;}
    if(ln)fitText(x,ln,W/2,y,W-50,24,'500','center');}
  x.fillStyle=col;x.fillRect(0,H-46,W,46);x.fillStyle='#fff';
  fitText(x,inf.at?'まもなく発車します':(sd<0?'左側':'右側')+'のドアが開きます　Doors open on the '+(sd<0?'left':'right'),W/2,H-23,W-24,24,'700','center');
  for(let q=0;q<5;q++){x.fillStyle=q===page?'#fff':'rgba(255,255,255,.35)';x.beginPath();x.arc(W-70+q*14,H-38,4,0,Math.PI*2);x.fill();}
  
  /* 右画面（DLED_R）：この先の停車駅一覧・路線図・乗換案内 */
  {const rx=DLED_R.x;rx.fillStyle='#0a1422';rx.fillRect(0,0,W,H);
    rx.fillStyle=col;rx.fillRect(0,0,W,46);rx.fillStyle='#fff';rx.textBaseline='middle';
    fitText(rx,'この先の停車駅　Stops ahead',14,24,340,24,'700');
    rx.textAlign='right';rx.font='700 22px '+FONT;rx.fillText(hms(nowMs()),W-14,24);rx.textAlign='left';
    if(inf&&st){
      const rows=etaList(4);
      rows.forEach((r,i2)=>{const y=80+i2*38;
        rx.fillStyle=i2===0?'#1a3c6e':'#142033';rx.fillRect(14,y-16,W-28,34);
        rx.fillStyle=i2===0?'#ffd23f':'#5a95f5';rx.fillRect(14,y-16,6,34);
        rx.fillStyle='#fff';fitText(rx,(i2===0?'▶ ':'')+r.st.name,28,y,280,24,'700');
        const rI=stationInfo(r.st);
        if(rI&&rI.tl&&rI.tl.length){rx.fillStyle='#ffd23f';fitText(rx,rI.tl[0],220,y,140,18,'500');}
        rx.fillStyle='#8fd6ff';rx.textAlign='right';rx.font='700 22px '+FONT;rx.fillText(hms(+r.at),W-22,y);rx.textAlign='left';});
      rx.fillStyle=col;rx.fillRect(0,H-40,W,40);rx.fillStyle='#fff';
      fitText(rx,inf.at?'まもなく発車します':'次の停車駅：'+st.name+' ('+st.kana+')',W/2,H-20,W-24,20,'700','center');
    }else{rx.fillStyle='#9fb0c8';fitText(rx,'ご乗車ありがとうございます',W/2,150,W-40,24,'500','center');}
    DLED_R.tex.needsUpdate=true;}
DLED.tex.needsUpdate=true;}
/* 新形車両：ドア上のワイド画面（トレインビジョン・640×240） */
function drawWidePanel(){const x=DLED2.x,W=640,H=240,inf=curTrainInfo();
  if(doorWarnOn()){drawDoorWarn(DLED2,'ドアが閉まります');return;}
  x.fillStyle='#071120';x.fillRect(0,0,W,H);x.textBaseline='middle';
  const line=BRANCH?(LINE_ID==='branch2'?'紫雲地下線':LINE_ID==='branch3'?'天宮高架線':LINE_ID==='branch4'?'港見支線':LINE_ID==='branch5'?'四嶺連絡高速線':'白峰支線'):'汐見環状線';
  const kind=inf?inf.kind:'',col=inf?'#'+inf.col.toString(16).padStart(6,'0'):'#14935f';
  x.fillStyle=col;x.fillRect(0,0,W,34);
  x.fillStyle='#fff';fitText(x,line+'　　'+kind,12,18,340,20,'700');
  x.textAlign='right';x.font='700 20px '+FONT;x.fillText(hms(nowMs()),W-12,18);x.textAlign='left';
  if(!inf){x.fillStyle='#9fb0c8';fitText(x,'ご乗車ありがとうございます',W/2,130,W-40,22,'500','center');DLED2.tex.needsUpdate=true;return;}
  const st=inf.at||inf.next;if(!st){DLED2.tex.needsUpdate=true;return;}
  const sd=TK[inf.key].side(st)*inf.dir;
  x.fillStyle='#0d1e34';x.fillRect(0,34,400,H-34);
  x.fillStyle='#7fd7ff';fitText(x,inf.at?'ただいま　Now at':'次は　Next',16,58,240,18,'500');
  x.fillStyle='#fff';fitText(x,st.name,16,104,300,52,'700');
  x.fillStyle='#bcd6f0';fitText(x,st.kana,18,142,300,22,'500');
  const tl=transferLines(st).map(l=>l[0]);
  x.fillStyle='#ffd23f';fitText(x,'のりかえ　'+(tl.length?tl.join('・'):'—'),16,172,330,18,'500');
  x.fillStyle='#8fd6ff';fitText(x,(sd<0?'左側':'右側')+'のドアが開きます',16,202,330,18,'500');
  x.fillStyle='#0a1626';x.fillRect(400,34,W-400,H-34);
  x.fillStyle=col;x.fillRect(400,34,6,H-34);
  x.fillStyle='#9fb0c8';fitText(x,'この先の停車駅',414,55,200,16,'500');
  const rows=etaList(4);
  rows.forEach((r,i)=>{const y=84+i*36;
    x.fillStyle=i===0?'#1b3c6b':'#101f33';x.fillRect(412,y-15,W-424,30);
    x.fillStyle=i===0?'#ffd23f':'#3f6ea8';x.beginPath();x.arc(426,y,5,0,7);x.fill();
    x.fillStyle='#fff';fitText(x,r.st.name,440,y,120,20,'700');
    x.fillStyle='#8fd6ff';x.textAlign='right';x.font='700 18px '+FONT;x.fillText(hms(+r.at),W-14,y);x.textAlign='left';});
  DLED2.tex.needsUpdate=true;}
/* ================= 側面の電光掲示板 ================= */
const SLED={N:(LINE_ID==='branch2'?3:8),W:512,H:92,slots:[],drawT:0};
const SLED_GRID=(()=>{const c=document.createElement('canvas');c.width=512;c.height=92;const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,0.38)';for(let yy=0;yy<92;yy+=4)x.fillRect(0,yy,512,1);for(let xx=0;xx<512;xx+=4)x.fillRect(xx,0,1,92);return c;})();
function sledSlot(){const k=mkCanvas(SLED.W,SLED.H);k.tex.minFilter=THREE.LinearFilter;k.tex.generateMipmaps=false;
  const mat=new THREE.MeshBasicMaterial({map:k.tex,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  return {k,mat,tr:null,key:'',segs:null,tw:0,scroll:0,mode:''};}
const SLED_KIND={local:['普通','Local','#46ff7e'],rapid:['快速','Rapid','#ff9d2e'],ltd:['快速特急','Limited Rapid Express','#ff4b3c'],exp:['特急','Limited Express','#4f9dff']};
function sledStops(at,key,dir,n){const out=[];if(!at)return out;
  for(let k=1;k<NST&&out.length<n;k++){const i=at.i+dir*k;if(BRANCH){if(i<0||i>=NST)break;out.push(STATIONS[i]);}
    else{const s2=STATIONS[mod(i,NST)];if(serves(s2,key))out.push(s2);}}return out;}
function sledInfoOwn(){const si=G.atStation!==null?G.atStation:(G.depCheck!==null&&G.v<0.3?G.depCheck:null);
  const inf={v:G.v*3.6,key:G.key,at:null,stops:[],term:false,promo:!!G.promoOn&&G.door.state!=='closed',
    dest:G.list?STATIONS[G.list[G.list.length-1]]:null};
  if(si!==null){inf.at=stOf(si);inf.term=!!G.list&&si>=lastStop();
    if(!inf.term)for(let k=1;k<=5;k++){if(G.list&&si+k>lastStop())break;inf.stops.push(stOf(si+k));}}
  return inf;}
function sledInfoAI(a){const dir=TK[a.key].dir,inf={v:a.v*3.6,key:a.key,at:null,stops:[],term:false,promo:false,dest:null};
  if(BRANCH)inf.dest=dir>0?STATIONS[NST-1]:STATIONS[0];
  if(a.state==='dwell'&&a.stSt){inf.at=a.stSt;inf.promo=a.doors&&a.t<13.5&&a.t>4.1;inf.stops=sledStops(a.stSt,a.key,dir,5);inf.term=!inf.stops.length;}
  return inf;}
function sledSegs(inf){const K=SLED_KIND[KIND[inf.key]||'local']||SLED_KIND.local,AMB='#ffb347',WH='#f4efe0',DIM='#9ad7ff';
  const dir=TK[inf.key].dir,dest=inf.dest||(BRANCH?(dir>0?STATIONS[NST-1]:STATIONS[0]):null);
  const dJ=dest?dest.name+'行':(dir>0?'外回り':'内回り'),dE=dest?'for '+enName(dest):(dir>0?'Outer Circle':'Inner Circle');
  if(!inf.at)return [[K[0],K[2]],['　'+dJ,AMB],['　　'+K[1],K[2]],['  '+dE,WH]];
  const S=[['ただいま ',DIM],[inf.at.name,AMB],['  '+enName(inf.at),WH]];
  if(inf.term){S.push(['　終点',AMB],['  Terminal',WH]);return S;}
  const nx=inf.stops[0];if(nx)S.push(['　次は ',DIM],[nx.name,AMB],['  Next: '+enName(nx),WH]);
  if(inf.stops.length){S.push(['　停車駅 ',DIM],[inf.stops.map(s2=>s2.name).join('・'),AMB],['  Stops: '+inf.stops.map(enName).join(', '),WH]);}
  return S;}
function sledDraw(sl,dt){const x=sl.k.x,W=SLED.W,H=SLED.H;
  if(sl.mode==='flip'){const pg=Math.floor(performance.now()/1800)%2;if(pg===sl.page)return;sl.page=pg; /* 切り替わるときだけ描く */
    x.fillStyle='#050505';x.fillRect(0,0,W,H);x.textBaseline='middle';x.textAlign='center';x.fillStyle=pg?'#ff9d2e':'#46ff7e';x.font='400 60px '+DOTF;x.fillText(sl.pages[pg],W/2,H/2+3);
    x.drawImage(SLED_GRID,0,0);sl.k.tex.needsUpdate=true;return;}
  x.fillStyle='#050505';x.fillRect(0,0,W,H);x.textBaseline='middle';
  if(sl.mode==='blink'){const on=(performance.now()%700)<420;
    if(on){x.textAlign='center';x.fillStyle='#ff4b3c';fitText(x,'ドアが閉まります',W/2,31,W-24,44,'400','center');x.fillStyle='#ffb347';fitText(x,'Doors are closing',W/2,72,W-24,28,'400','center');}}
  else{x.font='400 56px '+DOTF;x.textAlign='left';
    if(!sl.tw){let w=0;for(const g of sl.segs)w+=x.measureText(g[0]).width;sl.tw=w+W;} /* 右から入って左へ抜けたら次 */
    sl.scroll=(sl.scroll+dt*170)%sl.tw;let cx=W-sl.scroll;
    for(const g of sl.segs){const w=x.measureText(g[0]).width;if(cx+w>0&&cx<W){x.fillStyle=g[1];x.fillText(g[0],cx,H/2+3);}cx+=w;}}
  /* LEDの粒 */
  x.drawImage(SLED_GRID,0,0);
  sl.k.tex.needsUpdate=true;}
function updSideLEDs(dt){if(!SLED.slots.length)for(let i=0;i<SLED.N;i++)SLED.slots.push(sledSlot());
  const cw=camera.getWorldPosition(camW2),cand=[];
  const near=tr=>{let d=1e9;for(const c of tr.cars)d=Math.min(d,c.position.distanceTo(cw));return d;};
  if(!PAX&&ownTrain.grp.visible)cand.push({tr:ownTrain,info:sledInfoOwn});
  for(const a of OT)if(a.vis&&a.state!=='off'&&a.tr&&a.tr.leds&&a.tr.leds.length&&a.tr.grp&&a.tr.grp.visible)cand.push({tr:a.tr,info:()=>sledInfoAI(a)});
  if (IS_ONLINE && window.ONLINE_PLAYERS) {
    for (const pid in ONLINE_PLAYERS) {
      const p = ONLINE_PLAYERS[pid];
      if (p && p.tr && p.tr.leds && p.tr.leds.length && p.tr.grp && p.tr.grp.visible) {
        cand.push({tr: p.tr, info: () => {
          const dir = p.dir || 1;
          const k = p.key || 'A';
          return {
            v: (p.v || 0) * 3.6,
            key: k,
            at: p.ai ? p.ai.stSt : null,
            stops: p.ai && p.ai.stSt ? sledStops(p.ai.stSt, k, dir, 5) : [],
            term: false,
            promo: !!p.promoOn,
            dest: BRANCH ? (dir > 0 ? STATIONS[NST - 1] : STATIONS[0]) : null
          };
        }});
      }
    }
  }
  for(const c of cand)c.d=near(c.tr);cand.sort((p,q)=>p.d-q.d);
  const want=new Set(cand.filter(c=>c.d<230).slice(0,SLED.N).map(c=>c.tr));
  for(const sl of SLED.slots)if(sl.tr&&!want.has(sl.tr)){for(const m of sl.tr.leds)m.material=SLED_OFF;sl.tr.sled=null;sl.tr=null;}
  for(const c of cand){const tr=c.tr;if(!want.has(tr)){if(tr.leds[0]&&tr.leds[0].material!==SLED_OFF)for(const m of tr.leds)m.material=SLED_OFF;continue;}
    let sl=tr.sled;if(!sl){sl=SLED.slots.find(q=>!q.tr);if(!sl)continue;sl.tr=tr;tr.sled=sl;sl.key='';sl.mode='';}
    const inf=c.info();
    if(inf.v>=80){if(tr.leds[0].material!==SLED_OFF)for(const m of tr.leds)m.material=SLED_OFF;sl.mode='off';continue;} /* 80km/h以上は消灯 */
    if(tr.old){ /* 古い形式：種別と行先を交互に切り替えるだけ */
      const d=inf.dest||(TK[inf.key].dir>0?STATIONS[NST-1]:STATIONS[0]),pages=[KIND[inf.key]==='rapid'?'快速':'普通',d.name+'行'],key='F|'+pages.join('|');
      if(sl.mode!=='flip'||sl.key!==key){sl.mode='flip';sl.key=key;sl.pages=pages;sl.page=-1;}}
    else if(inf.promo){if(sl.mode!=='blink'){sl.mode='blink';sl.key='';}}
    else{const segs=sledSegs(inf),key=segs.map(g=>g[0]).join('|');if(sl.mode!=='scroll'||sl.key!==key){sl.mode='scroll';sl.key=key;sl.segs=segs;sl.tw=0;sl.scroll=0;}}
    if(tr.leds[0].material!==sl.mat)for(const m of tr.leds)m.material=sl.mat;}
  SLED.drawT+=dt;if(SLED.drawT>=0.04){const d2=SLED.drawT;SLED.drawT=0;for(const sl of SLED.slots)if(sl.tr&&(sl.mode==='scroll'||sl.mode==='blink'||sl.mode==='flip'))sledDraw(sl,d2);}}
const camW2=new THREE.Vector3();
/* animated adverts on the other screens */
const ADN=24;
/* 追加の広告（15種類） */
const ADEX=[{g:['#f7d9e3','#f2a7bf'],t:'桜まつり開催',s:'汐見公園 ライトアップ18時〜',n:'臨時列車も運転',ic:'petal',fg:'#7a1f3d'},{g:['#0b2a4a','#06121f'],t:'港見ナイトクルーズ',s:'港見駅から徒歩5分',n:'毎日19:00 出航',ic:'wave',fg:'#e8f0ff'},
  {g:['#ffe9a8','#ffc94a'],t:'こども電車教室',s:'運転台に座ってみよう！',n:'汐見車両センター',ic:'train',fg:'#3a2a00'},{g:['#1f3a2a','#0d1c14'],t:'英会話のシオミ',s:'駅前教室 無料体験',n:'朱雀台・蒼海中央',ic:'bubble',fg:'#e8fff0'},
  {g:['#ffffff','#dfe8f3'],t:'しおみデンタル',s:'歯のクリーニング 予約受付中',n:'月見ヶ丘駅 東口',ic:'tooth',fg:'#1d3f7a'},{g:['#2c1810','#0f0805'],t:'炭火焼き鳥 とり坊',s:'仕事帰りの一杯に',n:'港見駅 北口すぐ',ic:'fire',fg:'#ffd8a8'},
  {g:['#e6f4ff','#b8dcf5'],t:'転職ならシオミキャリア',s:'あなたに合う仕事、見つかる',n:'登録無料',ic:'up',fg:'#123a5a'},{g:['#3a0f0f','#140505'],t:'映画「青い列車」',s:'全国ロードショー',n:'汐見シネマで上映中',ic:'film',fg:'#ffe0e0'},
  {g:['#fff4e0','#ffd9a8'],t:'もちもち食パン',s:'ベーカリー こむぎ',n:'焼きたて 毎朝7時',ic:'bread',fg:'#6b3a12'},{g:['#e0f5ea','#a8e0c0'],t:'汐見動物園',s:'赤ちゃんパンダ公開中',n:'動物園前駅すぐ',ic:'paw',fg:'#1f5a3a'},
  {g:['#1a1d3a','#0a0b18'],t:'プラネタリウム',s:'星降る夜の物語',n:'汐見科学館',ic:'star',fg:'#e8e0ff'},{g:['#fde2e2','#f7b5b5'],t:'港見海岸 花火大会',s:'8月15日 臨時列車運転',n:'混雑が予想されます',ic:'firework',fg:'#7a1f1f'},
  {g:['#eeeeee','#bdbdbd'],t:'スマホ修理 即日',s:'画面割れ 最短30分',n:'蒼海中央駅 地下街',ic:'phone',fg:'#222'},{g:['#0d3b2e','#062018'],t:'港前ゴルフ練習場',s:'早朝6時から営業',n:'港前駅から送迎あり',ic:'ball',fg:'#d8f5e6'},
  {g:['#2a2a72','#009ffd'],t:'汐見ウォーターパーク',s:'夏はプールへ！',n:'7月オープン',ic:'wave',fg:'#ffffff'}];
/* ===== v1.9.8：車内LCDの広告を一新（汐見メトロ・サイネージ／縦スライド＋フェード＋ティッカー） ===== */
const ADSYS=[
  {tag:'開発者より',h1:'SNSで紹介・共有',h2:'お願いします！',sub:'開発者よりお願いです。ご協力お願い致します。',brand:'汐見環状線 3D',c1:'#0a2540',c2:'#040d1a',ac:'#38bdf8',art:'phone'},
  {tag:'お知らせ',h1:'アプリでもっと',h2:'便利に',sub:'走行位置・混雑・グリーン車予約',brand:'しおみアプリ',c1:'#062a42',c2:'#010b14',ac:'#3fd0ff',art:'phone'},
  {tag:'新型車両',h1:'快速特急',h2:'グラン汐見',sub:'12両編成・グリーン車連結',brand:'汐見メトロ',c1:'#08281f',c2:'#020d0a',ac:'#f0c25a',art:'train'},
  {tag:'イベント',h1:'港見海岸',h2:'花火大会',sub:'8月15日 臨時列車を運転します',brand:'港見観光協会',c1:'#101a45',c2:'#05060f',ac:'#ff7a9c',art:'fire'},
  {tag:'クリニック',h1:'歯のクリーニング',h2:'予約受付中',sub:'月見ヶ丘駅 東口すぐ',brand:'しおみデンタル',c1:'#0b3140',c2:'#04141c',ac:'#7fe3d0',art:'ring'},
  {tag:'ベーカリー',h1:'焼きたてを',h2:'毎朝7時に',sub:'もちもち食パン 好評です',brand:'こむぎ',c1:'#3a2410',c2:'#150c04',ac:'#ffbe63',art:'sun'},
  {tag:'音楽',h1:'汐見ミュージック',h2:'フェス 10.3',sub:'碧浜アリーナ 開場17時',brand:'汐見ミュージック',c1:'#2c1246',c2:'#100520',ac:'#c99bff',art:'sound'},
  {tag:'求人',h1:'あなたに合う',h2:'仕事が見つかる',sub:'登録無料・駅から5分',brand:'シオミキャリア',c1:'#06303a',c2:'#021114',ac:'#4be2b0',art:'arrow'},
  {tag:'カフェ',h1:'一冊と、',h2:'一杯のコーヒー',sub:'各駅ビル 2階',brand:'ブックカフェ灯台',c1:'#33200f',c2:'#140b04',ac:'#e0a860',art:'book'},
  {tag:'動物園',h1:'赤ちゃんパンダ',h2:'公開中',sub:'動物園前駅から徒歩3分',brand:'汐見動物園',c1:'#0d3320',c2:'#03110a',ac:'#8ce89a',art:'dots'},
  {tag:'グルメ',h1:'こだわりの',h2:'一杯',sub:'朱雀台駅 西口すぐ',brand:'らーめん 汐波',c1:'#3a1010',c2:'#150404',ac:'#ff9d6b',art:'wave'},
  {tag:'エコ',h1:'省エネ運転に',h2:'ご協力ください',sub:'こまめな力行・早めの制動',brand:'汐見メトロ 運転部',c1:'#0a3326',c2:'#03110c',ac:'#7ee0a8',art:'leaf'},
  {tag:'きっぷ',h1:'汐見一日',h2:'乗車券',sub:'環状線と4支線が1日乗り放題',brand:'汐見メトロ',c1:'#122a4a',c2:'#050d18',ac:'#8fd6ff',art:'ticket'}
];
function _adRGBA(hex,a){const h=hex.replace('#','');const r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);return 'rgba('+r+','+g+','+b+','+a+')';}
function adArt(x,kind,cx,cy,r,ac,t){x.save();x.translate(cx,cy);x.lineCap='round';x.lineJoin='round';
  x.strokeStyle=ac;x.fillStyle=ac;
  if(kind==='phone'){x.lineWidth=5;x.strokeRect(-r*0.38,-r*0.78,r*0.76,r*1.56);x.globalAlpha=0.5;x.fillRect(-r*0.30,-r*0.60,r*0.60,r*0.90);x.globalAlpha=0.9;
    for(let k=0;k<3;k++){const yy=r*0.30+k*r*0.13;x.fillRect(-r*0.26,yy,r*(0.30+0.14*Math.sin(t*1.6+k)),r*0.05);}}
  else if(kind==='train'){x.lineWidth=5;x.beginPath();x.moveTo(-r*0.85,r*0.25);x.lineTo(r*0.85,r*0.25);x.lineTo(r*0.70,r*-0.35);x.lineTo(-r*0.70,r*-0.35);x.closePath();x.stroke();
    x.globalAlpha=0.75;for(let k=-1;k<=1;k++)x.fillRect(k*r*0.30-r*0.10,r*-0.22,r*0.20,r*0.16);x.globalAlpha=1;
    x.lineWidth=4;x.beginPath();x.moveTo(-r*1.0,r*0.48);x.lineTo(r*1.0,r*0.48);x.stroke();x.beginPath();x.moveTo(-r*0.7,r*0.62);x.lineTo(r*0.7,r*0.62);x.stroke();}
  else if(kind==='fire'){const ph=(t*0.8)%1;x.lineWidth=4;for(let k=0;k<14;k++){const a2=k/14*6.283+r*0.0;const rr=r*(0.25+ph*0.7);
      x.globalAlpha=1-ph;x.beginPath();x.moveTo(Math.cos(a2)*rr*0.5,Math.sin(a2)*rr*0.5);x.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);x.stroke();}
    x.globalAlpha=1;x.beginPath();x.arc(0,0,r*0.13,0,7);x.fill();}
  else if(kind==='ring'){x.lineWidth=6;x.beginPath();x.arc(0,0,r*0.72,0,7);x.stroke();x.globalAlpha=0.55;x.beginPath();x.arc(0,0,r*0.46,0,7);x.stroke();x.globalAlpha=1;
    const a2=t*1.2;x.beginPath();x.moveTo(Math.cos(a2)*r*0.72,Math.sin(a2)*r*0.72);x.lineTo(Math.cos(a2)*r*0.46,Math.sin(a2)*r*0.46);x.stroke();}
  else if(kind==='sun'){x.beginPath();x.arc(0,0,r*0.36,0,7);x.fill();
    for(let k=0;k<10;k++){const a2=k/10*6.283+t*0.3;x.globalAlpha=0.6;x.lineWidth=4;x.beginPath();x.moveTo(Math.cos(a2)*r*0.52,Math.sin(a2)*r*0.52);x.lineTo(Math.cos(a2)*r*0.78,Math.sin(a2)*r*0.78);x.stroke();}x.globalAlpha=1;}
  else if(kind==='sound'){for(let k=0;k<7;k++){const hh=r*(0.22+0.55*Math.abs(Math.sin(t*2.2+k*0.7)));x.globalAlpha=0.55+0.45*Math.sin(k*0.9);x.fillRect(-r*0.78+k*r*0.24,-hh/2,r*0.13,hh);}x.globalAlpha=1;}
  else if(kind==='arrow'){x.lineWidth=7;for(let k=0;k<3;k++){const o=(t*0.9+k*0.33)%1;x.globalAlpha=1-o*0.7;x.beginPath();x.moveTo(-r*0.5+o*r*0.7,r*0.45);x.lineTo(r*0.1+o*r*0.7,0);x.lineTo(-r*0.5+o*r*0.7,-r*0.45);x.stroke();}x.globalAlpha=1;}
  else if(kind==='book'){x.lineWidth=5;x.strokeRect(-r*0.62,-r*0.62,r*0.56,r*1.24);x.strokeRect(r*0.06,-r*0.62,r*0.56,r*1.24);x.globalAlpha=0.6;
    for(let k=0;k<4;k++){const yy=-r*0.38+k*r*0.24;x.beginPath();x.moveTo(-r*0.50,yy);x.lineTo(-r*0.18,yy);x.stroke();x.beginPath();x.moveTo(r*0.18,yy);x.lineTo(r*0.50,yy);x.stroke();}x.globalAlpha=1;}
  else if(kind==='dots'){for(let gy=-1;gy<=1;gy++)for(let gx=-2;gx<=2;gx++){const d=Math.sin(t*2+gx*0.6+gy*0.9)*0.5+0.5;x.globalAlpha=0.35+0.6*d;x.beginPath();x.arc(gx*r*0.30,gy*r*0.30,r*0.055+r*0.03*d,0,7);x.fill();}x.globalAlpha=1;}
  else if(kind==='wave'){x.lineWidth=5;for(let k=0;k<3;k++){x.globalAlpha=0.45+k*0.25;x.beginPath();for(let q=-r;q<=r;q+=6){const yy=k*r*0.26-r*0.26+Math.sin(q/r*3+t*2.4+k)*r*0.12;q===-r?x.moveTo(q,yy):x.lineTo(q,yy);}x.stroke();}x.globalAlpha=1;}
  else if(kind==='leaf'){x.beginPath();x.ellipse(0,0,r*0.45,r*0.72,Math.PI/5,0,7);x.fill();x.strokeStyle='#03110c';x.lineWidth=4;x.beginPath();x.moveTo(-r*0.30,r*0.42);x.lineTo(r*0.30,-r*0.42);x.stroke();}
  else{x.lineWidth=4;x.setLineDash([9,7]);x.strokeRect(-r*0.82,-r*0.42,r*1.64,r*0.84);x.setLineDash([]);x.globalAlpha=0.7;x.fillRect(-r*0.60,-r*0.12,r*0.55,r*0.24);x.globalAlpha=1;}
  x.restore();}
function drawAds(){const x=ADS.x,W=512,H=274,now=performance.now()/1000;
  const SC=6.4,idx=Math.floor(now/SC)%ADSYS.length,p=(now%SC)/SC,A=ADSYS[idx];
  const g=x.createLinearGradient(0,0,W*0.6,H);g.addColorStop(0,A.c1);g.addColorStop(1,A.c2);x.fillStyle=g;x.fillRect(0,0,W,H);
  const rg=x.createRadialGradient(W*0.78,H*0.44,6,W*0.78,H*0.44,W*0.70);
  rg.addColorStop(0,_adRGBA(A.ac,0.34));rg.addColorStop(0.55,_adRGBA(A.ac,0.08));rg.addColorStop(1,_adRGBA(A.ac,0));
  x.fillStyle=rg;x.fillRect(0,0,W,H);
  adArt(x,A.art,W*0.775,H*0.40,H*0.28,A.ac,now);
  x.fillStyle=_adRGBA('#ffffff',0.10);x.fillRect(W*0.56,H*0.12,1.5,H*0.62);
  const ease=v=>1-Math.pow(1-Math.max(0,Math.min(1,v)),3);
  const aIn=ease(p/0.12),aOut=ease((1-p)/0.09),al=Math.min(aIn,aOut);
  x.save();x.globalAlpha=al;x.translate(0,(1-aIn)*12-(1-aOut)*12);
  x.textBaseline='middle';x.textAlign='left';
  x.fillStyle=_adRGBA(A.ac,0.22);x.fillRect(10,H*0.20,4,H*0.60);
  x.fillStyle=_adRGBA(A.ac,0.95);x.beginPath();if(x.roundRect){x.roundRect(24,H*0.11,106,24,6);x.fill();}else{x.fillRect(24,H*0.11,106,24);}
  x.fillStyle=A.c2;x.font='700 15px '+FONT;x.textAlign='center';x.fillText(A.tag,77,H*0.11+12.5);x.textAlign='left';
  x.fillStyle='#ffffff';fitText(x,A.h1,26,H*0.36,W*0.52,40,'700');
  x.fillStyle=A.ac;fitText(x,A.h2,26,H*0.55,W*0.52,40,'700');
  x.fillStyle=_adRGBA('#ffffff',0.72);fitText(x,A.sub,26,H*0.72,W*0.52,18,'500');
  x.fillStyle=_adRGBA(A.ac,0.85);x.fillRect(26,H*0.835,18,2.5);
  x.fillStyle=_adRGBA('#ffffff',0.85);fitText(x,A.brand,50,H*0.845,W*0.44,15,'700');
  x.restore();
  /* 常時表示のフッター（汐見メトロ サイネージ）＋進行バー */
  x.fillStyle=_adRGBA('#000000',0.42);x.fillRect(0,H-22,W,22);
  x.fillStyle=_adRGBA(A.ac,0.9);x.font='700 12px '+FONT;x.textAlign='left';x.fillText('汐見メトロ　CHANNEL',12,H-11);
  x.textAlign='right';x.fillStyle=_adRGBA('#ffffff',0.55);x.fillText((idx+1)+' / '+ADSYS.length, W-12, H-11);
  x.textAlign='left';x.fillStyle=_adRGBA(A.ac,0.95);x.fillRect(0,H-3,W*p,3);
  x.fillStyle=_adRGBA('#ffffff',0.12);x.fillRect(W*p,H-3,W-W*p,3);
  ADS.tex.needsUpdate=true;}

_on(document.getElementById('paxSit'),'click',()=>{if(RIDE&&RIDE.seat!=null)standUp();else sitDown();});
function goFloor(f){if(!RIDE)return;standUp();RIDE.fl=f;RIDE.lz=f==='deck'?(RIDE.lz>=0?6.3:-6.3):(RIDE.lz>=0?4.6:-4.6);RIDE.lx=f==='up'?-0.4:f==='down'?0.4:0.2;
  toast(f==='up'?'2階へ上がりました':f==='down'?'1階へ下りました':'デッキに出ました','ok');}
_on(document.getElementById('paxUp'),'click',()=>goFloor(RIDE&&RIDE.fl==='deck'?'up':'deck'));
_on(document.getElementById('paxUse'),'click',()=>useFacility());
_on(document.getElementById('paxBack2'),'click',()=>leaveConcourse());
_on(document.getElementById('paxTask'),'click',()=>doStaffTask());
_on(document.getElementById('paxDown'),'click',()=>goFloor(RIDE&&RIDE.fl==='deck'?'down':'deck'));
let uiHidden=false;
function setPaxUI(on){uiHidden=!on;const w=document.getElementById('walkUI');w.classList.toggle('uihide',!on);
  if(!on)toast('画面をタップすると表示が戻ります','info');}
_on(document.getElementById('paxHide'),'click',e=>{e.stopPropagation();setPaxUI(false);});
{let px=0,py=0,pt=0;
 _on(window,'pointerdown',e=>{px=e.clientX;py=e.clientY;pt=performance.now();},true);
 _on(window,'pointerup',e=>{if(!uiHidden)return;if(performance.now()-pt<400&&Math.hypot(e.clientX-px,e.clientY-py)<12)setPaxUI(true);},true);}
_on(document.getElementById('paxAlight'),'click',()=>alightTrain());
{const hb=document.getElementById('holdBack');let t0=0,raf=0;const stop=()=>{t0=0;hb.style.setProperty('--p',0);};
  const tick=()=>{if(!t0)return;const p=Math.min(1,(performance.now()-t0)/(HOLD_T*1000));hb.style.setProperty('--p',p);if(p>=1){stop();exitWalk();return;}raf=requestAnimationFrame(tick);};
  _on(hb,'pointerdown',e=>{e.preventDefault();e.stopPropagation();t0=performance.now();tick();});['pointerup','pointerleave','pointercancel'].forEach(ev=>_on(hb,ev,stop));}

_on(window,'keyup',e=>{W.keys[e.code]=false;});
_on(window,'keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return;
  if(G.phase!=='play')return;
  initAudio();unlockSpeech();
  if(G.walkOn){W.keys[e.code]=true;e.preventDefault();return;}
  if(PAX)return;
  if(e.repeat&&!['KeyQ','KeyE'].includes(e.code))return;
  // キーボード操作：右矢印で右扉の開閉、左矢印で左扉の開閉、エンターキーでATO、スペースキーで次駅放送
  if(e.code==='ArrowRight'){
    e.preventDefault();
    const isRightOpen=(G.door&&G.door.state==='open'&&G.door.local===1*SIDEINV);
    if(isRightOpen)doAct('rc');else doAct('ro');
    return;
  }
  if(e.code==='ArrowLeft'){
    e.preventDefault();
    const isLeftOpen=(G.door&&G.door.state==='open'&&G.door.local===-1*SIDEINV);
    if(isLeftOpen)doAct('lc');else doAct('lo');
    return;
  }
  if(e.code==='ArrowUp'||e.code==='ArrowDown'){
    e.preventDefault();
    if(G.phase!=='play'||G.crew==='twoC')return;
    if(G.ato){G.ato=false;G.manualOverride=true;G.mnotch=clamp(G.notch||0,-8,5);toast('手動運転に切り替えました','info');}
    else if(!G.manual&&!G.manualOverride){G.manualOverride=true;G.mnotch=clamp(G.notch||0,-8,5);}
    const inv = (typeof window.__MC_INV === 'boolean') ? window.__MC_INV : true;
    const delta = inv ? (e.code==='ArrowDown'?1:-1) : (e.code==='ArrowUp'?1:-1);
    setMNotch(G.mnotch + delta);
    return;
  }
  if(e.code==='Enter'){
    e.preventDefault();
    doAct('ato');
    return;
  }
  if(e.code==='Space'){
    e.preventDefault();
    triggerNextStationAnnounce(G.tabAnnMode||'next');
    if(G.tabNextAnn){G.tabNextAnn=false;if(typeof drawPanel==='function')drawPanel();}
    return;
  }
  switch(e.code){
    case 'KeyH':if(!e.repeat)startHoldHorn('elec');break;case 'KeyG':if(!e.repeat)startHoldHorn('air');break;case 'KeyY':if(!e.repeat)startHoldHorn('both');break;
    case 'KeyA':doAct('lo');break;case 'KeyZ':if(G.manual)setMNotch(G.mnotch>0?0:G.mnotch-1);else doAct('lc');break;case 'KeyD':doAct('ro');break;case 'KeyC':doAct('rc');break;
    case 'KeyB':G.panel='ann';G.zoom='T';G.panelZoomed=true;break;case 'KeyP':G.panel='promo';G.zoom='T';G.panelZoomed=true;break;case 'KeyJ':if(LINE_ID==='branch2'){if(!e.repeat)startHoldHorn('air');}else{musicHorn();G.mhornT=nowMs();}break;case 'KeyK':if(LINE_ID==='branch2'){if(!e.repeat)startHoldHorn('air');}else{musicHorn2();G.mhornT=nowMs();}break;case 'KeyO':doAct('ato');break;case 'KeyU':doAct('auto');break;case 'KeyW':endWaiting();break;
    case 'Digit1':if(G.panel==='ann'||G.panel==='promo'){(G.panel==='ann'?broadcast:promote)(0);G.panel='main';G.zoom=null;break;}zoomTo('L');break;case 'Digit2':if(G.panel==='ann'||G.panel==='promo'){(G.panel==='ann'?broadcast:promote)(1);G.panel='main';G.zoom=null;break;}zoomTo('S');break;case 'Digit3':if(G.panel==='ann'||G.panel==='promo'){(G.panel==='ann'?broadcast:promote)(2);G.panel='main';G.zoom=null;break;}zoomTo('I');break;case 'Digit4':if(G.panel==='ann'||G.panel==='promo'){(G.panel==='ann'?broadcast:promote)(3);G.panel='main';G.zoom=null;break;}zoomTo('M');break;case 'Digit6':zoomTo('T');break;case 'Digit5':zoomTo('R');break;
    case 'KeyQ':if(G.manual)setMNotch(G.mnotch<0?0:G.mnotch+1);else{G.zoom=null;G.lookY=wrapA(G.lookY+0.15);}break;case 'KeyE':G.zoom=null;G.lookY=wrapA(G.lookY-0.15);break;
    case 'KeyV':case 'Digit0':case 'Escape':G.zoom=null;G.lookY=0;G.lookP=0;break;
    default:return;}
  e.preventDefault();});
const ray=new THREE.Raycaster();ray.layers.enableAll();const ndc=new THREE.Vector2();let drag=null;
const cv=renderer.domElement;
cv.addEventListener('pointerdown',e=>{
  initAudio();
  if(G.walkOn){W.ptr.set(e.pointerId,{role:e.clientX<innerWidth/2?'move':'look',x0:e.clientX,y0:e.clientY,x:e.clientX,y:e.clientY});try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}
  ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(INTER,false).filter(h=>{const u=h.object.userData;return G.lean?(u.lean&&u.side===G.lean):!u.lean;})[0];try{cv.setPointerCapture(e.pointerId);}catch(_){}
  if(G.phase==='title')return;
  if(hit&&hit.object.userData.act.startsWith('exit')){G.hold={t:0,k:hit.object.userData.act.slice(4),id:e.pointerId};drag=null;return;}
  if(hit){unlockSpeech();doAct(hit.object.userData.act,hit);drag=null;}else drag={x:e.clientX,y:e.clientY,moved:0};});
cv.addEventListener('pointermove',e=>{if(G.walkOn){const p=W.ptr.get(e.pointerId);if(!p)return;if(p.role==='look'){W.yaw-=(e.clientX-p.x)*0.005;W.pitch=clamp(W.pitch-(e.clientY-p.y)*0.004,-1.0,0.9);}
    else{const dx=e.clientX-p.x0,dy=e.clientY-p.y0;W.mv.x=clamp(dx/70,-1,1);W.mv.y=clamp(-dy/70,-1,1);}p.x=e.clientX;p.y=e.clientY;return;}
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);
  if(drag.moved>8){G.zoom=null;G.lookY=wrapA(G.lookY+dx*0.005);G.lookP=clamp(G.lookP+dy*0.004,-0.6,0.5);}});
cv.addEventListener('pointerup',e=>{G.hold=null;stopHoldHorn();if(G.walkOn){const p=W.ptr.get(e.pointerId);if(p&&p.role==='move'){W.mv.x=W.mv.y=0;}W.ptr.delete(e.pointerId);return;}unlockSpeech();if(G.phase==='title')return;if(drag&&drag.moved<=8&&G.zoom)G.zoom=null;drag=null;});
cv.addEventListener('click',()=>{unlockSpeech();});
cv.addEventListener('pointercancel',e=>{drag=null;G.hold=null;stopHoldHorn();W.ptr.delete(e.pointerId);W.mv.x=W.mv.y=0;});
_on(window,'keyup',e=>{if(e.code==='KeyH'||e.code==='KeyG'||e.code==='KeyY'||(LINE_ID==='branch2'&&(e.code==='KeyJ'||e.code==='KeyK')))stopHoldHorn();});
_on(window,'blur',()=>stopHoldHorn());
cv.addEventListener('dblclick',()=>{G.zoom=null;G.lookY=0;G.lookP=0;});
cv.addEventListener('contextmenu',e=>e.preventDefault());
_on(window,'resize',applyView);_on(window,'orientationchange',()=>setTimeout(applyView,200));

/* ================= home screen / terminal question ================= */
_on(document.getElementById('waitEnd'),'click',()=>endWaiting());
let askT=0;
function updAsk(dt){if(G.askOpen&&askTimer>0){askTimer-=dt;if(askTimer<=0){const f=askTimeout;hideAsk();f&&f();}}
  if(G.askOpen&&G.v>0.5)hideAsk();
  if(!G.list||G.asked||G.atStation===null||G.atStation<lastStop()){askT=0;return;}
  if(G.door.state==='open'&&!pending())askT+=dt;if(askT>1.5){G.asked=true;const st=STATIONS[G.list[0]];
    openAsk(stOf(G.atStation).name+'（終点）に着きました',st.name+' 方面へ折り返すには、ホームに出て、反対の先頭車両の「運転室へ」を長押ししてください。',[['ホームに出る',()=>enterWalk(),true],['タイトル画面に戻る',()=>location.href=location.pathname,false]],0);}}
/* LED departure boards */
const LEDTK_VIS=Math.round(32*1.94/(0.535*30/176)); // テロップの見える幅（px）
function LEDTEX_SHARED(t){return t===ledIdle||LEDLIVE.some(k=>k.tex===t||k.tk.tex===t);}
const LEDLIVE=[0,1,2,3,4,5,6,7,8,9,10,11].map(()=>{const m=mkCanvas(1024,288),t=mkCanvas(2048,48);t.tex.wrapS=THREE.RepeatWrapping;t.tex.repeat.set(LEDTK_VIS/2048,1);
  SHARED.add(m.tex);SHARED.add(t.tex);return {c:m.c,x:m.x,tex:m.tex,tk:t,msg:'',gk:null};});
function rrect(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.lineTo(px+w-r,py);x.quadraticCurveTo(px+w,py,px+w,py+r);x.lineTo(px+w,py+h-r);x.quadraticCurveTo(px+w,py+h,px+w-r,py+h);x.lineTo(px+r,py+h);x.quadraticCurveTo(px,py+h,px,py+h-r);x.lineTo(px,py+r);x.quadraticCurveTo(px,py,px+r,py);x.closePath();}
function destLoop(st,dir){const bigs=[];for(let k=1;k<NST&&bigs.length<2;k++){const s2=STATIONS[mod(st.i+dir*k,NST)];if(s2.big)bigs.push(s2.name);}return bigs.join('・')+'方面';}
const LK={local:['普通','Local','#1b8a4b'],rapid:['快速','Rapid','#e56b1a'],ltd:['快速特急','Ltd. Rapid','#cf2e2e'],exp:['特急','Ltd. Express','#1f5fbf']};
function ledCond(x,t,x0,y,maxW){const w=x.measureText(t).width;if(w<=maxW){x.fillText(t,x0,y);return;}x.save();x.translate(x0,y);x.scale(maxW/w,1);x.fillText(t,0,0);x.restore();}
function ledDestOf(st,key,dir){if(BRANCH){const d=dir>0?STATIONS[NST-1]:STATIONS[0];return {ja:d.name+'行',en:'for '+enName(d),st:d};}
  for(let q=1;q<NST;q++){const s2=STATIONS[mod(st.i+dir*q,NST)];if(s2.big)return {ja:s2.name+'方面',en:'for '+enName(s2),st:s2};}return {ja:'',en:'',st:null};}
function tickerDraw(k,segs){const key=segs.map(g=>g[0]).join('');if(k.msg===key)return;k.msg=key;const x=k.tk.x,W=2048,H=48;
  const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0e1b30');bg.addColorStop(1,'#09111f');
  x.fillStyle=bg;x.fillRect(0,0,W,H);x.fillStyle='#1f3558';x.fillRect(0,0,W,2);
  x.font='600 28px '+FONT;x.textBaseline='middle';x.textAlign='left';
  let tw=0;for(const g of segs)tw+=x.measureText(g[0]).width;const P=tw+260;let sx=1,n=1,per=W;
  if(P>W)sx=W/P;else{n=Math.floor(W/P);per=W/n;}
  for(let i=0;i<n;i++){x.save();x.translate(i*per+48,H/2+1);x.scale(sx,1);let cx=0;for(const g of segs){x.fillStyle=g[1];x.fillText(g[0],cx,0);cx+=x.measureText(g[0]).width;}x.restore();}
  k.tk.tex.offset.x=0;k.tk.tex.needsUpdate=true;}
function drawLED(led,k){const x=k.x,now=nowMs(),st=led.st,W=1024,H=288,ph=Math.floor(now/4500)%2,blink=Math.floor(now/500)%2===0;
  /* 高精細フルカラー液晶（LCD）発車案内ディスプレイ */
  const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#0f1c32');bg.addColorStop(1,'#09111f');
  x.fillStyle=bg;x.fillRect(0,0,W,H);
  /* ヘッダー */
  const k0=led.keys[0];
  const no=BRANCH?(MINI?1:(st.cls==='Q'?({A:1,C:2,D:3,B:4}[k0]||1):(led.dir<0?2:({A:1,C:1,B:2,D:2}[k0]||(TK[k0]&&TK[k0].dir>0?1:2))))):(PLATNO[k0]||1);
  const hdrCol=BRANCH?'#1f8f54':'#1565c0';
  const hdr=x.createLinearGradient(0,0,W,0);hdr.addColorStop(0,hdrCol);hdr.addColorStop(1,'#0d2547');
  x.fillStyle=hdr;x.fillRect(0,0,W,54);
  x.fillStyle='rgba(255,255,255,0.16)';x.fillRect(0,52,W,2);
  rrect(x,14,9,118,36,8);x.fillStyle='#ffffff';x.fill();
  x.fillStyle='#0d2547';x.font='800 22px '+FONT;x.textAlign='center';x.textBaseline='middle';
  x.fillText(ph?no+'番線':'Track '+no,73,28);
  x.textAlign='left';x.fillStyle='#ffffff';x.font='700 26px '+FONT;
  x.fillText(ph?st.name+'駅　発車案内':enName(st)+' Departures',148,28);
  x.textAlign='right';x.font='700 28px '+FONT;x.fillStyle='#cfe3ff';
  x.fillText(hms(now),W-18,28);x.textAlign='left';
  /* 列車の一覧（自分の電車も含む） */
  const list=[];
  for(const a of OT){if(!a.key||a.state==='off')continue;const ak=physKey(a.key,st.s);if(!led.keys.includes(ak))continue;
    if(a.state==='dwell'&&a.stSt===st){list.push({D:0,key:a.key,dir:a.dir,dwell:true,dep:a.t<9.5&&a.t>3.0,tm:!!a.twoMan});continue;}
    const D=a.dir*sdiff(a.s,st.s+TK[a.key].so);if(D>-30&&D<9000)list.push({D:Math.max(0,D),key:a.key,dir:a.dir,tm:!!a.twoMan});}
  if(!PAX&&G.phase==='play'){const ok=physKey(G.key,st.s);if(led.keys.includes(ok)){
    if(G.atStation!==null&&stOf(G.atStation)===st)list.push({D:0,key:G.key,dir:G.dir,dwell:true,dep:!!G.promoOn,own:true,tm:!!G.twoMan});
    else if(stOf(G.nv)===st){const D=stopDist(G.nv);if(D>-30&&D<9000)list.push({D:Math.max(0,D),key:G.key,dir:G.dir,own:true,tm:!!G.twoMan});}}}
  list.sort((p,q)=>p.D-q.D);
  const spd=kk=>BRANCH?(LINE_ID==='branch5'?48:KIND[kk]==='rapid'?16:14):({local:15,rapid:19,ltd:24,exp:22})[KIND[kk]]||15;
  const rows=list.slice(0,3).map(e=>{const sec=e.D/spd(e.key)+(e.D>0?10:0),kd=KIND[e.key]||'local';
    return {e,t:now+sec*1000,kd,dest:ledDestOf(st,e.key,TK[e.key].dir),cars:carsFor(e.key),gc:BRANCH?[]:greenCarsFor(e.key),min:Math.max(1,Math.round(sec/60)),soon:!e.dwell&&e.D<430};});
  { /* 3本先まで：まだ遠くて見えない電車は汐見駅ダイヤ（環状線）または運転間隔から時刻を出す */
    const last={};for(const r of rows)last[r.e.key]=Math.max(last[r.e.key]||0,r.t);let guard=0;
    while(rows.length<3&&guard++<12){let best=null;for(const k of led.keys){if(!serves(st,k))continue;const h=hdwSec(k);if(h>7200)continue;const t=(!BRANCH&&st.i===0&&SHIOMI_TT[k])?nextShiomiDepMs(k,Math.max(now,(last[k]||now)+60000)):(last[k]||now)+h*1000;if(!best||t<best.t)best={k,t};}
      if(!best)break;last[best.k]=best.t;const sec=(best.t-now)/1000;
      rows.push({e:{D:1e9,key:best.k,dir:TK[best.k].dir,tm:KIND[best.k]==='ltd'&&Math.floor(best.t/(hdwSec(best.k)*1000))%2===1},t:best.t,kd:KIND[best.k]||'local',dest:ledDestOf(st,best.k,TK[best.k].dir),cars:carsFor(best.k),gc:BRANCH?[]:greenCarsFor(best.k),min:Math.max(1,Math.round(sec/60)),soon:false});}
    rows.sort((a2,b2)=>a2.t-b2.t);rows.length=Math.min(rows.length,3);}
  for(let r=0;r<3;r++){const row=rows[r],cy=64+r*58;
    rrect(x,12,cy,W-24,52,8);x.fillStyle=r===0?'#152744':'#101d34';x.fill();
    x.strokeStyle=r===0?'#2b4c7e':'#1c3052';x.lineWidth=1.5;x.stroke();
    const ym=cy+26;
    if(!row){x.font='600 24px '+FONT;x.fillStyle='#4a6185';x.fillText('－－：－－',190,ym);continue;}
    const K=LK[row.kd]||LK.local;
    /* 種別ピル */
    rrect(x,22,cy+9,144,34,6);x.fillStyle=K[2];x.fill();
    x.fillStyle='#ffffff';x.font='700 22px '+FONT;x.textAlign='center';ledCond(x,ph?K[0]:K[1],94,ym+1,132);x.textAlign='left';
    /* 発車時刻 */
    x.font='800 32px '+FONT;x.fillStyle=r===0?'#ffffff':'#cbd9ee';x.fillText(hms2(row.t),182,ym+1);
    /* 行先 */
    x.fillStyle='#ffffff';x.font='700 28px '+FONT;ledCond(x,ph?row.dest.ja:row.dest.en,294,ym+1,260);
    /* 両数・G・乗務 */
    rrect(x,568,cy+11,76,30,5);x.fillStyle='#1d3557';x.fill();
    x.fillStyle='#9ad0ff';x.font='700 19px '+FONT;x.textAlign='center';x.fillText(ph?row.cars+'両':row.cars+'C',606,ym+1);x.textAlign='left';
    if(row.gc.length){rrect(x,652,cy+11,30,30,5);x.fillStyle='#1f9a4c';x.fill();x.fillStyle='#fff';x.font='800 18px '+FONT;x.textAlign='center';x.fillText('G',667,ym+1);x.textAlign='left';}
    x.font='600 17px '+FONT;x.fillStyle=row.e.tm?'#ffd23f':'#8fa8cc';x.fillText(ph?(row.e.tm?'ツーマン':'ワンマン'):(row.e.tm?'2-Crew':'1-Crew'),692,ym+1);
    /* ステータスバッジ */
    let stTxt='',stBg='',stFg='#fff';
    if(row.e.dwell){if(row.e.dep){stTxt=ph?'発車します':'Departing';stBg=blink?'#d93829':'#8f241b';}else{stTxt=ph?'停車中':'Boarding';stBg='#1b8a4b';}}
    else if(row.soon){stTxt=ph?'まもなく到着':'Arriving';stBg=blink?'#d93829':'#8f241b';}
    else{stTxt=ph?('あと'+row.min+'分'):(row.min+' min');stBg='#1c3354';stFg='#a8c5eb';}
    rrect(x,W-198,cy+9,174,34,17);x.fillStyle=stBg;x.fill();
    x.fillStyle=stFg;x.font='700 20px '+FONT;x.textAlign='center';x.fillText(stTxt,W-111,ym+1);x.textAlign='left';}
  x.fillStyle='#09111f';x.fillRect(0,240,W,48);
  k.tex.needsUpdate=true;
  /* テロップ：到着・停車中・次の電車・混雑などを日本語と英語で */
  const AMB='#e2eeff',WH='#9bc2f5',RED='#ff7b7b',YEL='#ffd86b',hd=HOMEDOOR.has(st.i),segs=[];
  const r0=rows[0];
  if(r0){const K=LK[r0.kd]||LK.local,stops=sledStops(st,r0.e.key,TK[r0.e.key].dir,6),sJ=stops.map(s2=>s2.name).join('・'),sE=stops.map(enName).join(', ');
    if(r0.soon){segs.push(['まもなく、'+no+'番線に　',RED],[K[0]+'　'+r0.dest.ja,YEL],['　がまいります。危ないですから'+(hd?'ホームドアから離れて':'黄色い線の内側まで')+'お下がりください。',RED],
        ['　　Attention please. The '+K[1]+' train '+r0.dest.en+' is now arriving. Please stand '+(hd?'back from the platform doors.':'behind the yellow line.'),WH]);}
    else if(r0.e.dwell){segs.push(['この電車は　',AMB],[K[0]+'　'+r0.dest.ja,YEL],['　です。'+(sJ?'停車駅：'+sJ+'　':''),AMB],
        [r0.e.dep?'まもなくドアが閉まります。駆け込み乗車はおやめください。':'発車までしばらくお待ちください。',r0.e.dep?RED:AMB],
        ['　　This is the '+K[1]+' train '+r0.dest.en+'.'+(sE?' Stops: '+sE+'.':'')+(r0.e.dep?' The doors are closing.':''),WH]);}
    else{segs.push(['次の電車は　',AMB],[hms2(r0.t)+'発　'+K[0]+'　'+r0.dest.ja,YEL],['　'+r0.cars+'両編成です。'+(r0.gc.length?'グリーン車は'+r0.gc.map(q=>q+1).join('・')+'号車です。':'')+(sJ?'停車駅：'+sJ+'　':''),AMB],
        ['　　The next train is the '+hms2(r0.t)+' '+K[1]+' '+r0.dest.en+', '+r0.cars+' cars.'+(sE?' Stops: '+sE+'.':''),WH]);}}
  else segs.push(['本日も'+(BRANCH?LINENAME:'汐見環状線')+'をご利用いただき、ありがとうございます。',AMB],['　　Thank you for using the '+(BRANCH?LINEEN+'.':'Shiomi Loop Line.'),WH]);
  if(isRushHour())segs.push(['　　ただいま大変混雑しています。車内の奥までお進みください。',AMB],['　The trains are very crowded. Please move inside the car.',WH]);
  if(hd)segs.push(['　　ホームドアに寄りかからないでください。',AMB]);
  tickerDraw(k,segs);}
function hms2(t){const d=new Date(t);return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function updLEDs(){const here=G.s,gkOf=l=>l.st.i+'|'+l.keys.join(','),groups=new Map();
  for(const l of LEDS){if(Math.abs(sdiff(here,l.st.s))>=900)continue;const gk=gkOf(l);if(!groups.has(gk))groups.set(gk,[]);groups.get(gk).push(l);}
  const gl=[...groups.entries()].sort((a,b)=>Math.abs(sdiff(here,a[1][0].st.s))-Math.abs(sdiff(here,b[1][0].st.s))).slice(0,LEDLIVE.length),live=new Set(gl.map(g=>g[0]));
  for(const k of LEDLIVE)if(k.gk&&!live.has(k.gk))k.gk=null;
  for(const l of LEDS)if(l.live&&(!l.live.gk||l.live.gk!==gkOf(l))){l.live=null;l.mat.map=ledIdle;l.mat.needsUpdate=true;if(l.tmat){l.tmat.map=null;l.tmat.color.setHex(0x0b1526);l.tmat.needsUpdate=true;}}
  for(const [gk,ls] of gl){let k=LEDLIVE.find(q=>q.gk===gk);if(!k){k=LEDLIVE.find(q=>!q.gk);if(!k)continue;k.gk=gk;k.msg='';}
    for(const l of ls)if(l.live!==k){l.live=k;l.mat.map=k.tex;l.mat.needsUpdate=true;if(l.tmat){l.tmat.map=k.tk.tex;l.tmat.color.setHex(0xffffff);l.tmat.needsUpdate=true;}}
    drawLED(ls[0],k);}}
/* ================= main loop ================= */
applyView();updEnv();
let last=performance.now(),envT=0,clkT=0,frameN=0,monT=0,spT=0,audT=0,sigT=0,bellT=0,ledT=0,panT=0,intT=0,adT=0;
function update(dt,now){
  try{sweepPeople(dt);}catch(e){console.error(e);}
  envT+=dt;if(envT>3){envT=0;updEnv();}
  clkT+=dt;if(clkT>0.5){clkT=0;drawClock();}
  if(G.phase==='play'&&!PAX){
    physics(dt);updDoor(dt);updBranchAutoMelody(dt);updFlow(dt);updAsk(dt);updAuto(dt);
    if (typeof recordDrivingProgress === 'function') {
      const curSpd = Math.abs(G.v || 0);
      recordDrivingProgress((curSpd / 3600) * dt, dt);
    }
  }else setDoors(ownTrain,G.door.side,G.door.frac);
  updChunks((window.__DISP&&window.__DISP.on&&window.__DISP.focusS!=null)?window.__DISP.focusS:(G.walkOn?W.s:G.s));spT+=dt;if(spT>0.5){spT=0;updSpawns();}
  updPeople(dt);updPools(dt);updFT(dt);updShin(dt);updCity(dt);updCrossings(dt);updHomeDoors(dt);updWeather(dt);updConditionFx(dt);
  sigT+=dt;if(sigT>0.2){sigT=0;updSignals();const dv=Math.abs(sdiff(G.s,(DEPOT.a+DEPOT.b)/2))<2200;depotTrains.forEach(t=>t.grp.visible=dv);}
  ledT+=dt;if(ledT>0.5){ledT=0;updLEDs();} /* v2.5.1：駅の電光掲示板は2Hzに（1024×288の描画＋テクスチャ転送を半減） */
  panT+=dt;if(panT>0.25){panT=0;drawInfoPanel();if(typeof drawWidePanel==='function')drawWidePanel();}
  adT+=dt;if(adT>0.09){adT=0;drawAds();}
  if(G.promoLoop&&!(G.door.state==='open'||G.door.state==='opening'))stopPromoLoop(false);
  try{updLive();}catch(e){}
  updSideLEDs(dt);pbFlush();try{updTraffic(dt);}catch(e){console.error(e);}try{updSea(dt);}catch(e){console.error(e);}
  CABT=(typeof CABT==='number'?CABT:0)+dt;if(CABT>0.8){CABT=0;try{updCabModels();}catch(e){console.error(e);}try{updOwnCrew();}catch(e){console.error(e);}if(PAX)updResv();}
  else{if(!PAX)try{updOwnCrew();}catch(e){}}
  if(BRANCH){OLS.t=(OLS.t||0)+dt;if(OLS.t>0.07){drawOLED(OLS.t);updDoorLamps();OLS.t=0;}}
  for(const k of LEDLIVE)k.tk.tex.offset.x=(k.tk.tex.offset.x+dt*80/2048)%1; // 駅の電光掲示板のテロップ
  if(!PAX)updSalDoors();
  updArrivals(dt);updStationPA(dt);updConcourse(dt);if(STAFF)updStaff(dt);updIntWalkers(dt);intT+=dt;if(intT>0.9){intT=0;updInterior();}
  if(PAX&&uiHidden){document.getElementById('paxWhere').innerHTML='';}
  else if(PAX){{
  let canAlight = false;
  if (RIDE && RIDE.a && (!greenCar() || RIDE.fl === 'deck')) {
    const a = RIDE.a;
    const isStopped = a.state === 'dwell' || (a.v || 0) < 0.6;
    const isDoorOpen = (a.frac || 0) > 0.15 || (a.p && (a.p.door === 'open' || a.p.door === 'opening'));
    if (isStopped && isDoorOpen) canAlight = true;
  }
  const btn = document.getElementById('paxAlight');
  if (btn) btn.classList.toggle('hide', !canAlight);
}
    document.getElementById('paxStation').classList.toggle('hide',!!RIDE);
    {const cb=document.getElementById('concBtn');if(cb){cb.classList.toggle('hide',!!RIDE);cb.textContent=W.area==='conc'?'🚪 ホームに戻る':'🚪 改札口へ';}}document.getElementById('paxPlat').classList.toggle('hide',!!RIDE||!PX.plats||PX.plats.length<2);
    const sb=document.getElementById('paxSit'),sitting=!!(RIDE&&RIDE.seat!=null),canSit=!!(RIDE&&seatNear()!=null);
    sb.classList.toggle('hide',!(canSit||sitting));sb.textContent=sitting?'立つ':'座る';
    const fac=nearFacility(),ub=document.getElementById('paxUse'),bb=document.getElementById('paxBack2');
    ub.classList.toggle('hide',!fac);if(fac)ub.textContent={gate:G.outside?'改札を入る':'改札を出る',toilet:'トイレを使う',kids:'こどもトイレを使う',shop:'売店で買う'}[fac];
    bb.classList.toggle('hide',W.area!=='conc');
    const tb=document.getElementById('paxTask');tb.classList.toggle('hide',!(STAFF&&staffTask&&staffTask.ready));if(STAFF&&staffTask)tb.textContent=staffTask.label;
    const st1=document.getElementById('paxUp'),st2=document.getElementById('paxDown');
    const atStair=!!(RIDE&&greenCar()&&RIDE.seat==null&&Math.abs(Math.abs(RIDE.lz)-5.5)<1.4);
    st1.classList.toggle('hide',!(atStair&&RIDE.fl!=='up'));st2.classList.toggle('hide',!(atStair&&RIDE.fl!=='down'));
    st1.textContent=RIDE&&RIDE.fl==='deck'?'2階へ':'デッキへ';st2.textContent=RIDE&&RIDE.fl==='deck'?'1階へ':'デッキへ';
    if(STAFF&&!RIDE)document.getElementById('paxWhere').innerHTML='<b>'+W.st.name+'　駅員</b>　'+(W.area==='conc'?'コンコース':PX.plats[PX.pi]?PX.plats[PX.pi].label:'')+'　対応 '+staffScore+'件';
    else if(RIDE)document.getElementById('paxWhere').innerHTML='<b>'+(SVCLOOK[RIDE.a.key]?SVCLOOK[RIDE.a.key][1]:'列車')+(RIDE.a.p?'（'+escapeHtml(RIDE.a.p.name)+'運転士）':'')+'</b> '+(greenCar()?'グリーン車':(RIDE.k+1)+'号車')+(sitting?'　着席中':'')+'　'+(RIDE.a.state==='dwell'&&RIDE.a.stSt?RIDE.a.stSt.name+' 停車中':'走行中');}
  bellT+=dt;if(bellT>0.42){bellT=0;const bellS=PAX?(RIDE?RIDE.a.s:W.s):G.s;for(const cr of CROSS)if(cr.act&&Math.abs(sdiff(bellS,cr.s))<500)playAt(offsG(cr.s,0,2),bellSnd);}placeTrain(ownTrain,G.s,s=>ownTrackOff(G.key,s),TK[G.key].y);
  const near=stationNear(G.s),ls=near.s-60;stLights.forEach(l=>l.intensity=near.under?1.5:1.5*(G.stLit||0));stLights[0].position.copy(offs(ls,near.type==='side'?-4.5:offC(ls)/2,4.5));stLights[1].position.copy(offs(ls,near.type==='side'?sepB(ls)+4.5:sepB(ls)/2,4.5));
  const offF=s=>ownTrackOff(G.key,s),rs=CONDV?G.s-G.dir*(carsFor(G.key)*CARL-0.7):G.s,rd=CONDV?-G.dir:G.dir,rp=trackPt(rs,offF),rq=trackPt(rs+rd*2,offF);
  const spd = Math.max(0, G.v || 0); // 速度 (m/s)
  const spdF = Math.min(1.5, spd / 20); // 速度係数 (0〜1.5)
  const nowSec = now * 0.001;

  // 1. レール継ぎ目通過ショック（ぶれる揺れは除去）
  const jointBounce = 0;
  const jointPitch = 0;

  // 2. 加減速時のピッチング（ノーズダイブ／ノーズアップ）
  const currentAccel = (G.a != null ? G.a : (G.mnotch > 0 ? G.mnotch * 0.3 : G.mnotch * 0.4));
  if (typeof G.accelPitch === 'undefined') G.accelPitch = 0;
  G.accelPitch += (-clamp(currentAccel * 0.005, -0.016, 0.016) - G.accelPitch) * Math.min(1, dt * 3.5);

  // 3. 軌道狂い・台車蛇行動（左右ヨーイング・ローリング・上下ピッチング）
  const swayYaw = (Math.sin(nowSec * 2.7) * 0.0022 + Math.sin(nowSec * 5.4 + 1.2) * 0.0008) * spdF;
  const swayRoll = (Math.sin(nowSec * 2.1 + 0.7) * 0.006 + Math.sin(nowSec * 6.8) * 0.0022) * spdF;
  const swayPitch = (Math.sin(nowSec * 3.8 + G.s * 0.2) * 0.0018 + jointPitch) * spdF;

  // 4. カーブ遠心力によるカント・車体ロール
  const curv = wrapA(P(G.s + 6)[2] - P(G.s - 6)[2]) / 12 * G.dir;
  const lat = G.v * G.v * curv;
  G.lat = Math.abs(lat);
  G.roll += (clamp(lat * 0.028, -0.055, 0.055) - G.roll) * Math.min(1, dt * 2.0);

  // 5. 上下サスペンションのバウンス
  const vertBounce = (Math.sin(nowSec * 7.2 + G.s * 0.3) * 0.012 + jointBounce * 4.0) * spdF;

  // 位置と回転の適用
  rig.position.set(rp[0], TK[G.key].y(rs) + vertBounce, rp[1]);
  const basePitch = Math.atan(((TK[G.key].y(rs + 2) - TK[G.key].y(rs - 2)) / 4) * rd);
  const baseYaw = -Math.atan2(rq[0] - rp[0], -(rq[1] - rp[1]));
  rig.rotation.set(
    basePitch + G.accelPitch + swayPitch,
    baseYaw + swayYaw,
    G.roll + swayRoll
  );
  skyGroup.position.set(rig.position.x,0,rig.position.z);groundPlane.position.set(rig.position.x,-0.3,rig.position.z);
  if(G.walkOn)updWalk(dt);else{updCamera(dt,now);if(G.crew==='twoC')updAvatar(dt);}
  const ex=canExit();if(G.hold&&ex){G.hold.t+=dt;if(G.hold.t>=HOLD_T){G.hold=null;enterWalk();}}
  for(const k of ['L','R'])drawExitBtn(k,G.hold&&G.hold.k===k?Math.min(1,G.hold.t/HOLD_T):0,ex);
  updMascon3D(dt);
  monT+=dt;if(monT>0.28&&!G.walkOn&&!PAX){monT=0;if(OWNOLD){if(!G.paperT||nowMs()-G.paperT>2000){G.paperT=nowMs();drawPaper();}}else{drawSpeed();drawInfo();drawMap();drawPanel();if(typeof drawCabSide==='function')drawCabSide();if(typeof drawIndicatorLamps==='function')drawIndicatorLamps();if(!G.stafT||nowMs()-G.stafT>3000){G.stafT=nowMs();if(typeof drawStaf==='function')drawStaf();}const ms=monStation();
    drawSideOverlay('L',ms,ms&&localSide(ms)*SIDEINV<0);drawSideOverlay('R',ms,ms&&localSide(ms)*SIDEINV>0);}}
  if(G.lean&&G.v>0.05&&G.crew!=='twoC')leanBack();
  if(OWNOLD){updGauges(dt);if(G.lean)updLeanUI();
    const mb=document.getElementById('meloBtn');if(mb){const on=nearMeloBox()&&(G.door.state==='open'||G.door.state==='opening');mb.classList.toggle('hide',!on);mb.textContent=G.promoOn?'再生中…':'発車メロディ';}}
  /* 終点のホーム：反対側の先頭車両の横では「反対の運転室へ」 */
  {const hb=document.getElementById('holdBack');
    if(hb&&G.walkOn&&G.walkArea==='plat'){
      const sp=hb.querySelector('span');
      if(sp){const nearTerm=BRANCH&&G.atStation!==null&&G.list&&G.atStation>=lastStop()&&Math.abs(sdiff(W.s,G.s-G.dir*(carsFor(G.key)*CARL-4)))<14;
        const txt=nearTerm?'長押しで<br>反対の運転室へ':'長押しで<br>運転室へ';
        if(sp.innerHTML!==txt)sp.innerHTML=txt;}}}
  updButtons(now);
  if(typeof updateTutorialHUD==='function')updateTutorialHUD();
  updAudio();if(typeof updRemotePassengers==='function')updRemotePassengers(dt);if(typeof updTroubleVisual==='function')updTroubleVisual(dt);audT+=dt;if(audT>0.1){updOTAudio();audT=0;}
}

function updateTutorialHUD() {
  const hud = document.getElementById('gameTutorialHUD');
  if (!hud) return;
  if (!window.TUTORIAL_ENABLED || typeof G === 'undefined' || !G || G.phase !== 'play') {
    hud.classList.add('hide');
    return;
  }
  hud.classList.remove('hide');

  const stepEl = document.getElementById('tutHudStep');
  const descEl = document.getElementById('tutHudDesc');
  const subEl = document.getElementById('tutHudSub');

  if (PAX) {
    if (stepEl) stepEl.innerHTML = '🚶 ホーム見学モード';
    if (descEl) descEl.textContent = '左側スワイプまたはWASDで移動、右側スワイプで視点変更。開いている電車のドアへ歩いて入ると乗車できます。';
    if (subEl) subEl.textContent = '階段から別のホームへ移動可能 / 電車に乗ったら「降車する」でホームへ戻れます';
    return;
  }

  if (G.crew === 'twoC') {
    if (stepEl) stepEl.innerHTML = '👮 車掌乗務中';
    const D = G.door;
    if (D.state === 'closed' && G.atStation !== null) {
      if (descEl) descEl.textContent = '駅に到着しました。画面下の「ホームに出る」を押してホームへ出てください。';
      if (subEl) subEl.textContent = 'ホームに出たら「戸開」を押してドアを開けます。';
    } else if (D.state === 'open') {
      if (descEl) descEl.textContent = '乗客の乗降を確認し、操作箱の前で「発車メロディ」または「乗降促進」を鳴らしてください。';
      if (subEl) subEl.textContent = '「戸閉」でドアを閉め、最後尾の車内に戻ったら「合図」を押して運転士を発車させます。';
    } else {
      if (descEl) descEl.textContent = '車掌室で立って乗務中。電車が駅に到着するのを待ちます。';
      if (subEl) subEl.textContent = '画面ドラッグで車内や後方展望を360度見回せます。';
    }
    return;
  }

  const D = G.door;
  const vKmh = Math.round(G.v * 3.6);
  const d = stopDist(G.nv);
  const nst = stOf(G.nv);
  const atStop = G.v === 0 && (G.atStation !== null || G.depCheck !== null || (d > -6.5 && d < 17.9));

  if (G.manual) {
    if (atStop && D.state === 'closed') {
      if (stepEl) stepEl.innerHTML = '🚪 【手順 1】ドアを開ける';
      if (descEl) descEl.textContent = '駅に停車しました。運転席左側の「戸開」ボタンを押してドアを開けてください。';
      if (subEl) subEl.textContent = 'ホーム側のボタン（緑に点滅）を押します。';
    } else if (D.state === 'open' && !pending() && !G.promoted[G.atStation]) {
      if (stepEl) stepEl.innerHTML = '🎵 【手順 2】発車メロディ・乗降促進';
      if (descEl) descEl.textContent = '乗り降りが終わりました。中央下のタブレットで「乗降促進」を押してください。';
      if (subEl) subEl.textContent = 'メロディ放送が流れ、駆け込み乗車を防ぎます。';
    } else if (D.state === 'open') {
      if (stepEl) stepEl.innerHTML = '🔴 【手順 3】ドアを閉める';
      if (descEl) descEl.textContent = '運転席左側の赤い「戸閉」ボタンを押してドアを閉めてください。';
      if (subEl) subEl.textContent = '左右の車外モニターで人が挟まっていないか確認します。';
    } else {
      if (stepEl) stepEl.innerHTML = '🕹️ 【手動運転中】マスコン操作';
      if (descEl) descEl.textContent = '画面右のマスコンで「▲ 加速(Q)」と「▼ ブレーキ(Z)」を操作して運転します。';
      if (subEl) subEl.textContent = '次は ' + (nst ? nst.name : '') + ' 駅（あと ' + Math.round(d) + ' m）。停止位置±1m以内に停車させます。';
    }
    return;
  }

  if (atStop && D.state === 'closed') {
    if (stepEl) stepEl.innerHTML = '🚪 【手順 1】ドアを開ける';
    if (descEl) descEl.textContent = '駅に到着・停車しました。運転席左側の「戸開」ボタンを押してドアを開けてください。';
    if (subEl) subEl.textContent = 'ホーム側ボタン（緑色に点滅）を押します。モニタータップで拡大可能。';
  } else if (D.state === 'open' && pending()) {
    if (stepEl) stepEl.innerHTML = '👥 【乗降中】お客さまの乗り降りを待つ';
    if (descEl) descEl.textContent = '乗客が乗り降りしています。左右の車外モニターで乗り降りの様子を確認してください。';
    if (subEl) subEl.textContent = '乗り降りが終わると案内表示が「乗降促進」に変わります。';
  } else if (D.state === 'open' && (!G.promoted[G.atStation] || G.promoOn)) {
    if (stepEl) stepEl.innerHTML = '🎵 【手順 2】乗降促進メロディを流す';
    if (descEl) descEl.textContent = '乗り降りが終わりました。中央下のタブレットで「乗降促進」ボタンを押してください。';
    if (subEl) subEl.textContent = 'メロディとともに「ドアが閉まります」の合図アナウンスが流れます。';
  } else if (D.state === 'open') {
    if (stepEl) stepEl.innerHTML = '🔴 【手順 3】ドアを閉める';
    if (descEl) descEl.textContent = '運転席左側の赤い「戸閉」ボタンを押してドアを閉めてください。';
    if (subEl) subEl.textContent = 'モニターで駆け込み客がいないか確認します。';
  } else if (D.state === 'closed' && G.v === 0) {
    if (stepEl) stepEl.innerHTML = '🟢 【手順 4】ATOで出発・加速！';
    if (descEl) descEl.textContent = '運転席の緑色の「ATO」ボタンを押すと、自動で加速して次の駅へ出発します！';
    if (subEl) subEl.textContent = '「完全オート」ボタンを押せば、以後の全操作（戸開閉・乗降促進・発車）も自動化できます。';
  } else if (G.tabNextAnn) {
    const isSoon = G.tabAnnMode === 'soon';
    if (stepEl) stepEl.innerHTML = isSoon ? '📢 【まもなく到着】まもなく放送を流せます' : '📢 【走行中】次駅案内放送を流せます';
    if (descEl) descEl.textContent = isSoon
      ? ('駅まであと約 ' + Math.round(d) + ' m。タブレット「まもなく放送」を押すと「まもなく ' + (nst ? nst.name : '') + '」案内（英語放送つき）が流れます。')
      : ('時速 ' + vKmh + ' km/h で走行中。タブレット「次駅放送」を押すと「次は ' + (nst ? nst.name : '') + '」案内（乗り換え・英語放送つき）が流れます。');
    if (subEl) subEl.textContent = 'ボタンを押すと車内チャイムとともに音声放送が流れ、通常の乗降促進・放送ボタンに戻ります。';
  } else if (d <= 600) {
    if (stepEl) stepEl.innerHTML = '🏁 【まもなく到着】次は ' + (nst ? nst.name : '') + ' 駅';
    if (descEl) descEl.textContent = '駅まであと約 ' + Math.round(d) + ' m。ATOが自動で停止位置に合わせてブレーキをかけます。';
    if (subEl) subEl.textContent = '完全に停止したら「戸開」を押してドアを開けてください。';
  } else {
    if (stepEl) stepEl.innerHTML = '🚅 【順調に走行中】次は ' + (nst ? nst.name : '') + ' 駅';
    if (descEl) descEl.textContent = '速度 ' + vKmh + ' km/h で巡航中。画面をドラッグすると360度自由に運転席や外の景色を見回せます。';
    if (subEl) subEl.textContent = '警笛やミュージックホーンはタブレット右側からいつでも鳴らせます。';
  }
}
window.updateTutorialHUD = updateTutorialHUD;
/* 自動画質：フレームが遅いときは描画解像度を少しずつ下げ、速くなったら戻す（ゲームの中身は変わらない） */
const QUAL={max:Math.min(window.devicePixelRatio||1, isMobileDevice ? 0.95 : 1.05),min:0.45,pr:0,ema:16,t:0,lock:0,pend:null};QUAL.pr=QUAL.max;
function updQuality(ms){if(QMODE!=='light'&&QMODE!=='ultralight'&&QMODE!=='extreme')return;ms=Math.min(ms,100);QUAL.ema+=(ms-QUAL.ema)*0.08;QUAL.t+=ms;if(QUAL.lock>0){QUAL.lock-=ms;return;}if(QUAL.t<900)return;QUAL.t=0;
  if(QUAL.ema>19.5){if(QUAL.pend){if(QUAL.ema>QUAL.pend.ema*0.93){QUAL.pr=QUAL.pend.pr;renderer.setPixelRatio(QUAL.pr);QUAL.pend=null;QUAL.lock=60000;return;}QUAL.pend=null;} // 下げても効かない（画面の更新上限）→戻す
    if(QUAL.pr>QUAL.min+0.01){QUAL.pend={ema:QUAL.ema,pr:QUAL.pr};QUAL.pr=Math.max(QUAL.min,QUAL.pr*0.82);renderer.setPixelRatio(QUAL.pr);}}
  else{QUAL.pend=null;if(QUAL.ema<16.5&&QUAL.pr<QUAL.max-0.01){QUAL.pr=Math.min(QUAL.max,QUAL.pr*1.06);renderer.setPixelRatio(QUAL.pr);QUAL.t=-2500;}}}
/* 見えない物は描かない：カメラの後ろ・霧の向こう（完全に霧の色で見えない距離）のまち区画と車両を描画から外す */
const _frus=new THREE.Frustum(),_pm4=new THREE.Matrix4(),_cwp=new THREE.Vector3(),_b3=new THREE.Box3();
function chunkSphere(ch){if(ch.sph!==undefined&&ch.sphN===ch.g.children.length)return ch.sph;ch.g.updateMatrixWorld(true);const box=new THREE.Box3();if(ch.ibox)box.union(ch.ibox);
  ch.g.traverse(o=>{if(o===ch.g||o.isInstancedMesh||!o.geometry)return;const g=o.geometry;if(!g.boundingBox)g.computeBoundingBox();const bb=g.boundingBox;
    if(!bb||!isFinite(bb.min.x)||!isFinite(bb.max.x))return;_b3.copy(bb).applyMatrix4(o.matrixWorld);box.union(_b3);});
  ch.sph=box.isEmpty()?null:box.getBoundingSphere(new THREE.Sphere());ch.sphN=ch.g.children.length;return ch.sph;}
const _trsList = [];
function cullFor(cam){if(QMODE==='normal')return;cam.updateWorldMatrix(true,false);_pm4.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse);_frus.setFromProjectionMatrix(_pm4);
  const cp=cam.getWorldPosition(_cwp),fogFar=(scene.fog?scene.fog.far:3600)+60;
  const far=(typeof monCam!=='undefined'&&cam===monCam)?260:(QMODE==='extreme'?Math.min(fogFar,1100):QMODE==='ultralight'?Math.min(fogFar,1400):QMODE==='light'?Math.min(fogFar,1800):fogFar);
  for(const ch of CHUNKS){if(!ch.built||!ch.g)continue;const sp=chunkSphere(ch);if(!sp){ch.g.visible=true;continue;}
    ch.g.visible=_frus.intersectsSphere(sp)&&(cp.distanceTo(sp.center)-sp.radius)<far;}
  _trsList.length = 0;
  _trsList.push(ownTrain);
  for(const a of OT) if (a && a.tr) _trsList.push(a.tr);
  for(const t of cityTrains) if (t) _trsList.push(t);
  for(const t of depotTrains) if (t) _trsList.push(t);
  if(IS_ONLINE && window.ONLINE_PLAYERS){for(const pid in ONLINE_PLAYERS){if(ONLINE_PLAYERS[pid].tr)_trsList.push(ONLINE_PLAYERS[pid].tr);}}
  for(const tr of _trsList){if(!tr||!tr.cars)continue;for(const car of tr.cars)car.visible=tr.isRemotePlayer?(car.position.distanceTo(cp)<3200):(car.position.distanceTo(cp)<far+14);}}
/* ===== 総合指令所：選択列車の近くの「定点カメラ」リアルタイム背景映像 ===== */
window.__DISP = window.__DISP || { on:false, sel:null, camOn:true, pos:null, focusS:null };
const DISPCAM = {cam:null,cv:null,last:0,anchor:null,side:1,ready:false,lastAnchor:null,lastLbl:'',aim:new THREE.Vector3(),pos:new THREE.Vector3(),target:new THREE.Vector3(),asp:0,ST:260};
function dispCamCanvas(){ if(!DISPCAM.cv) DISPCAM.cv = document.getElementById('dispCamCanvas'); return DISPCAM.cv; }
function dispCamReset(){ DISPCAM.anchor=null; DISPCAM.ready=false; DISPCAM.lastAnchor=null; }
window.__DISP.resetCam = dispCamReset;
function dispCamPickAnchor(ts,dir){ const idx=Math.round((ts+(dir||1)*80)/DISPCAM.ST);
  if(DISPCAM.anchor==null||Math.abs(sdiff(DISPCAM.anchor,ts))>DISPCAM.ST*0.98){ DISPCAM.anchor=mod(idx*DISPCAM.ST,L); DISPCAM.side=(mod(idx,2)===0)?1:-1; }
  return DISPCAM.anchor; }
function dispCamFrame(now){ const D=window.__DISP; if(!D||!D.on||D.camOn===false) return false;
  const cv=dispCamCanvas(); if(!cv) return false;
  const pid=D.sel; let p=pid?ONLINE_PLAYERS[pid]:null;
  if(!p&&pid&&pid.startsWith('ai:')){const aiObj=OT.find(x=>x&&x.state!=='off'&&('ai:'+x.name)===pid);if(aiObj&&aiObj.tr&&aiObj.tr.cars&&aiObj.tr.cars.length)p={s:aiObj.s,smoothS:aiObj.s,dir:aiObj.dir,tr:aiObj.tr,name:'AI '+((SVCLOOK[aiObj.key]&&SVCLOOK[aiObj.key][1])||aiObj.key)+'('+aiObj.name+')'};}
  const ts=(p&&isFinite(p.smoothS))?p.smoothS:((p&&isFinite(p.s))?p.s:null);
  if(!p||ts==null||!p.tr||!p.tr.cars||!p.tr.cars.length){ D.focusS=null; if(cv.style.display!=='none') cv.style.display='none'; return false; }
  if(!DISPCAM.cam){ DISPCAM.cam=new THREE.PerspectiveCamera(52,innerWidth/Math.max(1,innerHeight),0.25,1500); }
  const cam=DISPCAM.cam;
  const a=dispCamPickAnchor(ts,p.dir||1);
  const y=Yat(a); let off,h;
  if(y<-4){ off=5.2; h=3.0; }            /* 地下：トンネル内の壁面カメラ */
  else if(y>4){ off=9.0; h=4.2; }        /* 高架：高架下から見上げる */
  else { off=15.0; h=6.8; }              /* 地上：軌道脇のポールカメラ */
  cam.position.copy(offs(a,DISPCAM.side*off,h));
  const cars=p.tr.cars; const mid=cars[Math.floor((cars.length-1)/2)];
  try{ mid.getWorldPosition(DISPCAM.target); }catch(e){ DISPCAM.target.copy(offs(ts,0,2)); }
  if(!DISPCAM.ready||DISPCAM.lastAnchor!==a){ DISPCAM.aim.copy(DISPCAM.target); DISPCAM.ready=true; DISPCAM.lastAnchor=a; }
  else DISPCAM.aim.lerp(DISPCAM.target,0.28);
  const asp=innerWidth/Math.max(1,innerHeight);
  if(DISPCAM.asp!==asp){ DISPCAM.asp=asp; cam.aspect=asp; cam.updateProjectionMatrix(); }
  cam.lookAt(DISPCAM.aim);
  D.focusS=ts; D.pos=cam.position;
  /* ラベル（最寄り駅・側面） */
  let near=null,best=1e9; for(const st of STATIONS){ const dd=Math.abs(sdiff(st.s,ts)); if(dd<best){ best=dd; near=st; } }
  const lbl='📹 定点カメラ：'+(near?(near.name+'駅'+(best<420?'（ホーム脇）':' 付近')):'沿線')+'・'+(DISPCAM.side>0?'下り側':'上り側')+'　／　'+p.name+' を追跡中';
  if(lbl!==DISPCAM.lastLbl){ DISPCAM.lastLbl=lbl; const el=document.getElementById('dispCamLabel'); if(el) el.textContent=lbl; }
  /* 描画は約25fpsに間引く（指令画面の背景なので十分） */
  if(now-DISPCAM.last<40) return true;
  DISPCAM.last=now;
  try{
    cullFor(cam); renderer.setRenderTarget(null); renderer.render(scene,cam);
    const vw=Math.max(1,innerWidth), vh=Math.max(1,innerHeight), sc=Math.min(1,1024/vw);
    const cw=Math.max(160,Math.round(vw*sc)), ch=Math.max(90,Math.round(vh*sc));
    if(cv.width!==cw||cv.height!==ch){ cv.width=cw; cv.height=ch; }
    const ctx=cv.getContext('2d');
    if(ctx){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cw,ch); ctx.drawImage(renderer.domElement,0,0,cw,ch); }
    if(cv.style.display!=='block') cv.style.display='block';
  }catch(e){}
  return true;
}
function frameBody(now){
  if(window.__TRIP_NOTICE_OPEN){last=now;if(!window.__TRIP_NOTICE_RENDERED){window.__TRIP_NOTICE_RENDERED=true;try{if(typeof renderer!=='undefined'&&renderer&&scene&&camera)renderer.render(scene,camera);}catch(e){}}return;}
  updQuality(now-last);
  const dt=Math.min(0.05,(now-last)/1000);last=now;frameN++;
  try{update(dt,now);}catch(e){LOOPERR.n++;console.error('update error',e);if(now-LOOPERR.shown>20000){LOOPERR.shown=now;try{toast('一時的な不具合を自動で回復しました','warn');}catch(_){}}} /* 更新で失敗しても描画は続ける */
  if (IS_ONLINE && typeof scene !== 'undefined') {
    try {
      const L = (typeof CFG !== 'undefined' && CFG && CFG.L) ? CFG.L : 72000;
      const nowMsTime = Date.now();
      for (const pid in ONLINE_PLAYERS) {
        try {
          const p = ONLINE_PLAYERS[pid];
          if (!p) continue;
          if (nowMsTime - p.lastSeen > 45000) {
            removeRemotePlayer(pid);
            continue;
          }
          const pLine = p.line || 'loop';
          if (pLine !== (typeof CFG !== 'undefined' && CFG ? CFG.id : 'loop')) {
            if (window.__RIDEHOOK && p.ai) window.__RIDEHOOK.ghost(p);   /* v1.9.7：乗客を降ろさず列車を停める */
            if (p.tr && p.tr.grp) p.tr.grp.visible = false;
            if (p.snd && p.snd.g && p.snd.g.gain) {
              try { p.snd.g.gain.setTargetAtTime(0, (window.__AC && window.__AC.currentTime) || 0, 0.8); } catch(e) {}
            }
            continue;
          }
          if (p.s == null || !isFinite(p.s) || p.state === 'passenger' || p.isPax || p.state === 'title' || p.state === 'dispatch') {
            /* 乗客が乗っている列車は、運転士が一瞬タイトル等に戻っても止めずゴースト化して降車まで残す */
            const ridingThis = !!(typeof RIDE !== 'undefined' && RIDE && p.ai && RIDE.a === p.ai);
            if (ridingThis && window.__RIDEHOOK) {
              window.__RIDEHOOK.ghost(p);
            } else if (!ridingThis) {
              if (p.tr && p.tr.grp) p.tr.grp.visible = false;
            }
            continue;
          }
          const k = (p.key && typeof TK !== 'undefined' && TK[p.key]) ? p.key : 'A';
          const svcId = p.service || null;
          const svc = (typeof SERVICES !== 'undefined' && svcId) ? SERVICES[svcId] : null;
          const flip = (p.dir != null ? p.dir : 1) < 0;
          const liv = (p.liv != null) ? p.liv : ((svc && svc.col) ? parseInt(svc.col.replace('#', ''), 16) : (SVCLOOK[k] ? SVCLOOK[k][0] : 0x14935f));
          const svcLabel = svc ? svc.short : (SVCLOOK[k] ? SVCLOOK[k][1] : '環状線');
          const nCar = p.nCar || (BRANCH ? NCAR : (typeof carsFor === 'function' ? carsFor(k) : 6));
          const greenCars = p.greenCars || (typeof greenCarsFor === 'function' ? greenCarsFor(k) : []);
          const isOld = p.old !== undefined ? !!p.old : (p.line === 'branch');
          const isTwoMan = !!p.twoMan;

          const avSig = JSON.stringify(p.avatar || null) + '|' + (p.crew || 'one');
          // 他プレイヤーの乗務員室・種別・両数・旧型仕様・アバターに変更があれば自動で再構築
          const someoneRiding = !!(typeof RIDE !== 'undefined' && RIDE && p.ai && RIDE.a === p.ai);
          if (!someoneRiding && p.tr && (p.currentKey !== k || p.currentNCars !== nCar || p.currentOld !== isOld || p.currentFlip !== flip || p.currentLiv !== liv || p.currentAvSig !== avSig)) {
            if (window.__RIDEHOOK && p.ai) window.__RIDEHOOK.ghost(p);       /* v1.9.7：乗客を降ろさない */
            if (p.tr) { disposeTrain(p.tr); p.tr = null; }
          }

          if (!p.tr) {
            const tr = buildTrain(p.dest || '', flip, liv, true, greenCars, nCar, isOld);
            setLook(tr, k);
            if (p.dest) {
              if (tr.old) drawDestRoll(tr.dk, p.dest);
              else drawDest(tr.dk, p.dest);
            }
            const plate = makeNameplateSprite(p.name, svcLabel, !!p.isDev);
            plate.position.set(0, 4.6, -CARHALF + 2.5);
            tr.cars[0].add(plate);
            tr.nameplate = plate;
            addCustomCrew(tr, isTwoMan, p.avatar, p.crew);
            tr.isRemotePlayer = true;
            p.tr = tr;
            p.currentAvSig = avSig;
            p.currentKey = k;
            p.currentNCars = nCar;
            p.currentOld = isOld;
            p.currentFlip = flip;
            p.currentLiv = liv;
            p.currentName = p.name;
            p.currentIsDev = !!p.isDev;
            p.currentSvcLabel = svcLabel;
            p.smoothS = (typeof p.s === 'number' && isFinite(p.s)) ? p.s : 0;
            placeTrain(p.tr, p.smoothS, s=>ownTrackOff(k, s), TK[k].y);

            p.ai = {
              name: 'P_' + (p.id || 'rem').slice(0, 6),
              tr: tr,
              key: k,
              load: p.load || 180,
              inside: [],
              insideSet: new Set(),
              p: p,
              isOnline: true
            };
          } else if (p.currentName !== p.name || p.currentIsDev !== !!p.isDev || p.currentSvcLabel !== svcLabel) {
            // 名前・開発者バッジ・種別ラベル変更時にネームプレートを更新
            try {
              if (p.tr.nameplate) {
                if (p.tr.cars && p.tr.cars[0]) p.tr.cars[0].remove(p.tr.nameplate);
                if (p.tr.nameplate.material) {
                  if (p.tr.nameplate.material.map) p.tr.nameplate.material.map.dispose();
                  p.tr.nameplate.material.dispose();
                }
              }
              const plate = makeNameplateSprite(p.name, svcLabel, !!p.isDev);
              plate.position.set(0, 4.6, -CARHALF + 2.5);
              p.tr.cars[0].add(plate);
              p.tr.nameplate = plate;
              p.currentName = p.name;
              p.currentIsDev = !!p.isDev;
              p.currentSvcLabel = svcLabel;
            } catch(e) {}
          }
          // 行先表示の動的同期
          if (p.tr && p.dest && p.tr.dk && p.tr.dk.txt !== p.dest) {
            if (p.tr.old) drawDestRoll(p.tr.dk, p.dest);
            else drawDest(p.tr.dk, p.dest);
          }

          // カクつき解消：速度と方向によるデッドレコニング（外挿）で滑らかに補間
          /* v1.9.7：受信した位置を「時刻つき」で貯めて、少し前（240ms）の時刻を補間して描く。
             通信間隔でのカクつき・速度の詰まり・位置飛びをなくす */
          p.samples = p.samples || [];
          if (!p.samples.length || p.samples[p.samples.length-1].ts !== p.lastSeen) {
            p.samples.push({ ts: p.lastSeen, s: (p.s||0), v: (p.v||0), dir: (p.dir||1) });
            if (p.samples.length > 8) p.samples.shift();
          }
          const PLAYOUT = 240;
          const trT = nowMsTime - PLAYOUT;
          let sA = p.samples[0], sB = null;
          for (let i = p.samples.length - 1; i >= 0; i--) { const q = p.samples[i]; if (q.ts <= trT) { sA = q; sB = p.samples[i+1] || null; break; } }
          let targetS2;
          if (sB && sB.ts > sA.ts) targetS2 = mod(sA.s + sdiff(sA.s, sB.s) * clamp((trT - sA.ts)/(sB.ts - sA.ts), 0, 1), L);
          else targetS2 = mod(sA.s + (sA.dir||1) * (sA.v||0) * Math.max(0, trT - sA.ts)/1000, L);
          if (!isFinite(p.smoothS)) p.smoothS = targetS2;
          let ds = sdiff(p.smoothS, targetS2);
          if (!isFinite(ds)) ds = 0;
          const _maxStep = (Math.abs(p.v||0) + 8) * dt;   /* 1フレームで詰められる量に上限（速度が飛ばない） */
          if (Math.abs(ds) > 80) {
            p.smoothS = targetS2;                          /* 路線変更・出現時・大きなズレは即座に合わせる */
          } else {
            p.smoothS = mod(p.smoothS + clamp(ds, -_maxStep, _maxStep), L);
          }

          if (!p.ai) {
            p.ai = {
              name: 'P_' + (p.id || 'rem').slice(0, 6),
              tr: p.tr,
              key: k,
              load: p.load || 180,
              inside: [],
              insideSet: new Set(),
              p: p,
              isOnline: true
            };
          }
          p.ai.tr = p.tr;
          p.ai.key = k;
          p.ai.dir = p.dir || 1;
          p.ai.s = p.smoothS;
          p.ai.v = p.v || 0;
          p.ai.frac = p.doorFrac != null ? p.doorFrac : (p.door === 'open' ? 1.0 : 0.0);
          p.ai.state = ((p.v || 0) < 0.6 && (p.door === 'open' || p.door === 'opening' || p.ai.frac > 0.3)) ? 'dwell' : 'run';
          
          let curStObj = null;
          if (typeof STATIONS !== 'undefined' && STATIONS && TK[k]) {
            for (const st of STATIONS) {
              const d = Math.abs(sdiff(p.smoothS, st.s + TK[k].so));
              if (d < 55) { curStObj = st; break; }
            }
            if (!curStObj && p.stName) {
              for (const st of STATIONS) {
                if (p.stName === st.name && Math.abs(sdiff(p.smoothS, st.s + TK[k].so)) < 180) { curStObj = st; break; }
              }
            }
          }
          p.ai.stSt = curStObj;
          if (curStObj && (p.ai.state === 'dwell' || p.ai.last == null || p.ai.last < 0)) {
            p.ai.last = curStObj.i;
          }
          p.ai.side = p.doorSide || (curStObj ? TK[k].side(curStObj) : 1);
          p.ai.sq = p.sq | 0;
          /* 運転士・車掌が歩いているときは座席の運転士を消す（自車・他車で同じ見え方に） */
          try{if(p.tr.crew&&p.tr.crew.length){p.tr.crew[0].visible=!p.crewWalk;if(p.tr.crew[1])p.tr.crew[1].visible=(p.tr.crew.length>1)&&!!p.twoMan&&!(p.crewWalk&&p.crewArea==='train');}}catch(e){}

          // 乗客モード対応：カメラの実際の位置（W.s / RIDE.a.s / G.s）からの距離で正しく判定
          const camS = (typeof PAX !== 'undefined' && PAX) ? ((typeof RIDE !== 'undefined' && RIDE && RIDE.a) ? RIDE.a.s : (typeof W !== 'undefined' ? W.s : 0)) : ((typeof G !== 'undefined' && G && G.s != null) ? G.s : 0);
          const camDist = Math.abs(sdiff(p.smoothS, camS));
          /* 指令所の定点カメラ：選択列車の周辺は指令カメラの位置で描画判定する */
          const camDist2 = (window.__DISP&&window.__DISP.on&&window.__DISP.focusS!=null)?Math.abs(sdiff(p.smoothS,window.__DISP.focusS)):camDist;
          const camDistEff = Math.min(camDist, camDist2);
          if (camDistEff < 2600 || (typeof RIDE !== 'undefined' && RIDE && p.ai && RIDE.a === p.ai)) {
            if (p.tr && p.tr.grp) p.tr.grp.visible = true;
            placeTrain(p.tr, p.smoothS, s=>ownTrackOff(k, s), TK[k].y);
            if (p.tr) {
              const dFrac = p.doorFrac != null ? p.doorFrac : (p.door === 'open' ? 1.0 : (p.door === 'closed' ? 0.0 : 0.5));
              setDoors(p.tr, p.doorSide || 1, dFrac);
            }
          } else {
            if (p.tr && p.tr.grp) p.tr.grp.visible = false;
          }
        } catch(e) {}
      }
    } catch(e) {}
  }
const ms=monStation(),side=ms?localSide(ms):0;
  const MQ=monQuads();
  for(const k of ['L','R']){if(!MON[k])continue;const sd=(k==='L'?-1:1)*SIDEINV;MON[k].screens.forEach((sc,h)=>{const want=side===sd&&MQ[h]?RT[k+h].texture:CANV.NS.tex;if(sc.mat.map!==want){sc.mat.map=want;sc.mat.needsUpdate=true;}});}
  const itvPanelEl=document.getElementById('crewItvPanel');
  const itvOpen=!!(itvPanelEl&&!itvPanelEl.classList.contains('hide'));
  if(ms&&(!G.walkOn||itvOpen)&&!PAX&&!OWNOLD){const k=side*SIDEINV<0?'L':'R',zoomed=G.zoom==='L'||G.zoom==='R'||itvOpen;let n=0;
    /* v2.5.1：ホームカメラ（側面モニター／ITV）の実写更新を間引く。
       駅の手前260m〜停車中は、全景をもう1〜4回描いていたため、汐見環状線の駅接近時だけ
       フレーム時間が跳ね上がっていた（支線の旧型車はモニター自体がないので発生しない）。
       モニターを見ているとき（ズーム・ITV・見回し）だけ高頻度に更新し、正面を向いて運転して
       いる間は数フレームに1枚に落とす。駅が変わった直後は1枚ずつ順に全画面を撮り直す。 */
    if(window.__MONST!==ms){window.__MONST=ms;window.__MONC=0;}
    const look=Math.abs(G.lookY||0),warm=(window.__MONC|0),per=zoomed?2:(look>0.5?5:14);
    for(let q=0;q<4;q++){if(!MQ[q])continue;
      if(warm<4){if(q!==warm)continue;}else if((frameN+q)%per!==0)continue;
      aimCamQ(ms,MQ[q]);cullFor(monCam);renderer.setRenderTarget(RT[k+q]);renderer.render(scene,monCam);n++;}
    window.__MONC=Math.min(4,warm+1);
    if(n)renderer.setRenderTarget(null);}
  if(itvOpen&&frameN%8===0){try{drawCrewItvPanel(ms,side,MQ);}catch(e){}}
  if(window.__DISP&&window.__DISP.on){ if(window.__DISP.camOn!==false&&dispCamFrame(now)) return; }
  /* v1.9.7：指令所では3Dの背景を描かない（専用画面・無音・CPU節約） */
  if(window.__DISP&&window.__DISP.on&&!window.__DISP_NO_RENDER_OFF){ return; }
  pbFlush();cullFor(camera);renderer.render(scene,camera);
  if(PHOTO_REQ){PHOTO_REQ=false;try{PHOTOS.unshift(renderer.domElement.toDataURL('image/jpeg',0.82));if(PHOTOS.length>40)PHOTOS.pop();}catch(e){}}}
/* 毎フレーム：先に次のフレームを予約してから処理する。途中でエラーが起きてもゲームは止まらずに続く */
const LOOPERR={n:0,t:0,shown:0};
function frame(now){if(window.__FRAME_TOKEN!==TOKEN)return;requestAnimationFrame(frame);
  if(CTXLOST)return;
  try{frameBody(now);if(isFinite(G.s)&&isFinite(G.v))G.lastGood={s:G.s,v:G.v};else if(G.lastGood){G.s=G.lastGood.s;G.v=0;}}
  catch(e){try{renderer.setRenderTarget(null);}catch(_){}last=now;LOOPERR.n++;if(!LOOPERR.t)LOOPERR.t=now;console.error('frame error',e);
    if(now-LOOPERR.shown>20000){LOOPERR.shown=now;try{toast('一時的な不具合を自動で回復しました','warn');}catch(_){}}}
  if(now-LOOPERR.t>60000){LOOPERR.n=0;LOOPERR.t=0;}}
/* ===== 運転台の模型：運転モードの運転台（机・モニター・計器・ボタン・椅子）をまとめて1つの形にし、近くの電車の先頭・最後尾に取り付ける ===== */
let CABMODEL=null;const CABPOOL=[],CABATT=new Map();
function buildCabModel(){if(CABMODEL)return;
  try{if(typeof drawSpeed==='function')drawSpeed();if(typeof drawInfo==='function')drawInfo();if(typeof drawMap==='function')drawMap();if(typeof drawPanel==='function')drawPanel();if(typeof drawExitBtn==='function'){drawExitBtn('L',0,false);drawExitBtn('R',0,false);}}catch(e){}
  const MONG=new Set(Object.values(MON).map(m=>m&&m.g).filter(Boolean));cab.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(cab.matrixWorld).invert(),groups=new Map(),skip=new Set([CM.shell,CM.hit]),tmp=new THREE.Vector3();
  const pbm=cab.userData.pb&&cab.userData.pb.mesh;
  cab.traverse(o=>{if(!o.isMesh||!o.geometry||!o.material||Array.isArray(o.material)||o===pbm||o.material===upperMat)return;const m=o.material;if(skip.has(m)||m.visible===false||m.transparent&&m.opacity<0.2)return;
    let q=o;while(q&&q!==cab){if(q.userData&&q.userData.legs)return;q=q.parent;}if(o.userData&&o.userData.act&&m===CM.hit)return;
    o.getWorldPosition(tmp);cab.worldToLocal(tmp);if(tmp.z>2.65||tmp.z<-0.4)return;           /* 運転台〜背面仕切りまで（後ろの客室は除く） */
    const g=o.geometry;if(!g.attributes.position||!g.attributes.normal)return;
    const M=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    /* 運転士が見ているのと同じ位置・同じ大きさで複製する（モニターの位置補正はしない） */
    if(!groups.has(m))groups.set(m,[]);groups.get(m).push([g,M]);});
  CABMODEL=[];for(const [m,list] of groups){try{const ok=list.filter(([g])=>g.attributes.uv);if(!ok.length)continue;CABMODEL.push({geo:mergeGeos(ok),mat:m});}catch(e){}}}
function cabInst(){let g=CABPOOL.pop();if(g)return g;g=new THREE.Group();for(const c of CABMODEL){const ms=new THREE.Mesh(c.geo,c.mat);ms.matrixAutoUpdate=false;g.add(ms);}return g;}
const _cabCamP = new THREE.Vector3();
function updCabModels(){if(!CABMODEL){try{buildCabModel();}catch(e){CABMODEL=[];}}if(!CABMODEL.length)return;
  const camP=camera.getWorldPosition(_cabCamP),want=new Set();
  const trs=[];for(const a of OT)if(a.vis&&a.state!=='off'&&a.tr&&a.tr.leds&&a.tr.leds.length)trs.push(a.tr);
  /* 他プレイヤーの列車にも同じ運転台を入れる（外から覗いても・車内から見ても同じ運転台） */
  if(IS_ONLINE&&window.ONLINE_PLAYERS){for(const pid in ONLINE_PLAYERS){const p2=ONLINE_PLAYERS[pid];if(p2&&p2.tr&&p2.tr.cars&&p2.tr.cars.length&&p2.tr.grp&&p2.tr.grp.visible)trs.push(p2.tr);}}
  /* 自列車：運転席から見える本物の運転台（レイヤー2）とは別に、外・車内巡回から見える同じ運転台（レイヤー1）を先頭と最後尾に入れる */
  if(typeof ownTrain!=='undefined'&&ownTrain&&ownTrain.cars&&ownTrain.cars.length&&ownTrain.grp)trs.push(ownTrain);
  for(const tr of trs){if(!tr||!tr.cars||!tr.cars.length)continue;const c0=tr.cars[0],cl=tr.cars[tr.cars.length-1];if(Math.min(c0.position.distanceTo(camP),cl.position.distanceTo(camP))<220)want.add(tr);}
  for(const [tr,gs] of CABATT)if(!want.has(tr)){for(const g of gs){if(g.parent)g.parent.remove(g);CABPOOL.push(g);}CABATT.delete(tr);}
  for(const tr of want){if(CABATT.has(tr))continue;const gs=[];
    for(const car of tr.cars){if(car.userData.cabF){const f=cabInst();f.position.set(0,0,-CARHALF);f.rotation.set(0,0,0);car.add(f);gs.push(f);}if(car.userData.cabR){const r=cabInst();r.position.set(0,0,CARHALF);r.rotation.set(0,Math.PI,0);car.add(r);gs.push(r);}}
    for(const g of gs){g.updateMatrix();g.traverse(o=>{o.layers.mask=tr.cars[0].layers.mask;});}CABATT.set(tr,gs);}}
/* ===== スマホ・タブレット（乗客モード） ===== */
let RESV=null,PHOTO_REQ=false,CABT=0;const PHOTOS=[],RECS=[];const DEV={kind:null,app:null,timer:null,rec:null,dest:null,raf:null};
const KN={local:'普通',rapid:'快速',ltd:'快速特急',exp:'特急'};
function refStation(){if(RIDE){const n=aiStop(RIDE.a);return n?n.st:null;}return W.st||null;}
function etaTo(a,st){if(!a.key||!serves(st,a.key))return null;if(a.state==='dwell'&&a.stSt===st)return 0;const D=a.dir*sdiff(a.s,st.s+TK[a.key].so);if(D<-20||D>9000)return null;
  let stops=0;for(const s2 of STATIONS){const d2=a.dir*sdiff(a.s,s2.s);if(d2>5&&d2<D-5&&serves(s2,a.key))stops++;}return D/((KIND[a.key]==='ltd'?22:KIND[a.key]==='rapid'?17:13))+stops*30;}
function crowdLbl(a){const r=(a.load||0)/(carsFor(a.key)*72);return r<0.35?['空いています','#7fe3a0']:r<0.7?['座れる程度','#c9e36a']:r<1.1?['やや混雑','#ffd23f']:r<1.5?['混雑','#ff9d2e']:['大変混雑','#ff5a4a'];}
function destName(a){const d=TK[a.key].dir;if(BRANCH)return (d>0?STATIONS[NST-1]:STATIONS[0]).name+'行';for(let q=1;q<NST;q++){const s2=STATIONS[mod((a.stSt?a.stSt.i:0)+d*q,NST)];if(s2.big)return s2.name+'方面';}return d>0?'外回り':'内回り';}
function devEl(){return document.getElementById('devScreen');}
function openDev(kind){if(!PAX)return;DEV.kind=kind;const d=document.getElementById('dev');d.classList.remove('hide');d.className=kind;devHome();}
function closeDev(){devStop();document.getElementById('dev').classList.add('hide');DEV.kind=null;}
function devStop(){clearInterval(DEV.timer);DEV.timer=null;cancelAnimationFrame(DEV.raf);DEV.raf=null;DEV.app=null;}
function devHome(){devStop();document.getElementById('devTitle').textContent=DEV.kind==='phone'?'スマートフォン':'タブレット';
  const apps=DEV.kind==='phone'?[['shiomi','しおみ','🚃','#1f7a4a'],['map','マップ','🗺️','#2c5aa0'],['cam','カメラ','📷','#3a3f4a'],['photo','写真','🖼️','#8a3f5f'],['rec','録音','🎙️','#c8322b']]
    :[['mole','もぐらたたき','🔨','#6b4a2e'],['puz','15パズル','🧩','#2f5a8a'],['video','動画','▶️','#c8322b'],['anime','アニメ','🎬','#7a3fa0']];
  const e=devEl();e.innerHTML='<div class="devGrid">'+apps.map(a=>'<button class="devIcon" data-a="'+a[0]+'"><span style="background:'+a[3]+'">'+a[2]+'</span>'+a[1]+'</button>').join('')+'</div><div class="devClock">'+hms(nowMs()).slice(0,5)+'</div>';
  e.querySelectorAll('.devIcon').forEach(b=>b.onclick=()=>openApp(b.dataset.a));}
function openApp(id){devStop();DEV.app=id;const e=devEl(),T=document.getElementById('devTitle');
  const titles={shiomi:'しおみアプリ',map:'マップ',cam:'カメラ',photo:'写真',rec:'録音',mole:'もぐらたたき',puz:'15パズル',video:'しおみ動画',anime:'しおみアニメ'};T.textContent=titles[id]||'';
  ({shiomi:appShiomi,map:appMap,cam:appCam,photo:appPhoto,rec:appRec,mole:appMole,puz:appPuz,video:appVideo,anime:appAnime})[id](e);}
/* --- しおみアプリ：走行位置・混雑・グリーン車予約 --- */
function appShiomi(e,tab){tab=tab||'pos';e.innerHTML='<div class="tabs">'+[['pos','走行位置'],['crowd','混雑'],['green','グリーン予約'],['my','予約確認']].map(t=>'<button data-t="'+t[0]+'" class="'+(t[0]===tab?'on':'')+'">'+t[1]+'</button>').join('')+'</div><div id="shBody"></div>';
  e.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>appShiomi(e,b.dataset.t));const B=e.querySelector('#shBody');
  const draw=()=>{const st=refStation();
    if(tab==='pos'){B.innerHTML='<canvas id="shCv" width="640" height="560"></canvas><div class="note">'+(st?'基準：'+st.name+'駅':'')+'　●普通 ●快速 ●快速特急　あなた＝赤い枠</div>';const cv=B.querySelector('#shCv'),x=cv.getContext('2d');
      const c0=st?st.i:0,list=[];for(let q=-5;q<=5;q++){const i=BRANCH?c0+q:mod(c0+q,NST);if(i<0||i>=NST)continue;list.push(STATIONS[i]);}
      x.fillStyle='#0b1322';x.fillRect(0,0,640,560);const s0=list[0].s,s1=list[list.length-1].s,span=Math.max(100,sdiff(s0,s1)),Y=s2=>40+480*sdiff(s0,s2)/span;
      for(const xx of [220,420]){x.fillStyle='#3a4560';x.fillRect(xx-3,30,6,500);}x.font='16px sans-serif';x.textAlign='center';
      for(const s2 of list){const y=Y(s2.s);x.fillStyle='#e8f0ff';x.fillRect(250,y-2,140,4);x.fillText(s2.name,320,y-8);}
      x.textAlign='left';x.fillStyle='#9fb0c8';x.fillText('↓'+(BRANCH?'下り':'外回り'),180,22);x.fillText('↑'+(BRANCH?'上り':'内回り'),400,22);
      const col=k=>KIND[k]==='ltd'?'#ff5a4a':KIND[k]==='rapid'?'#ff9d2e':'#46ff7e';
      for(const a of OT){if(!a.key||a.state==='off')continue;const d=sdiff(s0,a.s);if(d<-50||d>span+50)continue;const xx=TK[a.key].dir>0?220:420,y=Y(a.s);x.fillStyle=col(a.key);x.beginPath();x.arc(xx,y,9,0,7);x.fill();
        if(RIDE&&RIDE.a===a){x.strokeStyle='#ff2a2a';x.lineWidth=4;x.strokeRect(xx-14,y-14,28,28);}}}
    else if(tab==='crowd'){if(!st){B.innerHTML='<div class="note">駅にいないと表示できません</div>';return;}const rows=[];for(const a of OT){const t=etaTo(a,st);if(t==null)continue;rows.push([t,a]);}rows.sort((p,q)=>p[0]-q[0]);
      B.innerHTML='<div class="note">'+st.name+'駅に来る電車</div>'+rows.slice(0,8).map(([t,a])=>{const c=crowdLbl(a);return '<div class="row"><b>'+(KN[KIND[a.key]]||'普通')+'</b> '+destName(a)+'<span class="eta">'+(t<20?'まもなく':Math.round(t/60)+'分後')+'</span><span class="crowd" style="background:'+c[1]+'">'+c[0]+'</span></div>';}).join('')||'<div class="note">近くに電車がいません</div>';}
    else if(tab==='green'){if(!st){B.innerHTML='<div class="note">駅にいないと予約できません</div>';return;}const rows=[];for(const a of OT){if(!a.key||!greenCarsFor(a.key).length)continue;const t=etaTo(a,st);if(t==null)continue;rows.push([t,a]);}rows.sort((p,q)=>p[0]-q[0]);
      B.innerHTML='<div class="note">'+st.name+'駅から乗れるグリーン車（快速特急 4・5号車）</div>'+(rows.slice(0,6).map(([t,a],i)=>'<div class="row"><b>快速特急</b> '+destName(a)+'<span class="eta">'+(t<20?'まもなく':Math.round(t/60)+'分後')+'</span><button class="go" data-i="'+i+'">席を選ぶ</button></div>').join('')||'<div class="note">いま予約できる快速特急はありません</div>');
      B.querySelectorAll('.go').forEach(b=>b.onclick=()=>seatPick(B,rows[+b.dataset.i][1]));clearInterval(DEV.timer);DEV.timer=null;return;}
    else{B.innerHTML=RESV?'<div class="row"><b>予約中</b> 快速特急 '+destName(RESV.a)+'　'+RESV.label+'</div><div class="note">その電車に乗ったら「予約した席へ」ボタンで席に行けます（席はあなたのために空けてあります）</div><button class="big" id="resCancel">予約を取り消す</button>':'<div class="note">予約はありません</div>';
      const c=B.querySelector('#resCancel');if(c)c.onclick=()=>{cancelResv();appShiomi(e,'my');};clearInterval(DEV.timer);DEV.timer=null;return;}};
  draw();DEV.timer=setInterval(()=>{if(DEV.app==='shiomi')draw();},700);}
function seatPick(B,a){clearInterval(DEV.timer);DEV.timer=null;let car=greenCarsFor(a.key)[0],fl='up';
  const render=()=>{B.innerHTML='<div class="note">快速特急 '+destName(a)+'　座席を選んでください</div><div class="tabs">'+greenCarsFor(a.key).map(k=>'<button data-c="'+k+'" class="'+(k===car?'on':'')+'">'+(k+1)+'号車</button>').join('')+
    [['up','2階'],['down','1階']].map(f=>'<button data-f="'+f[0]+'" class="'+(f[0]===fl?'on':'')+'">'+f[1]+'</button>').join('')+'</div><div class="seatMap">'+
    GROWZ.map((z,ri)=>'<div class="srow"><span>'+(ri+1)+'</span>'+['A','B','','C','D'].map((L,ci)=>{if(!L)return '<i></i>';const col=ci>2?ci-1:ci,si=((ri*4)+col)*2+(fl==='up'?1:0);return '<button class="seat" data-s="'+si+'" data-l="'+(ri+1)+L+'">'+L+'</button>';}).join('')+'</div>').join('')+'</div>';
    B.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{car=+b.dataset.c;render();});B.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{fl=b.dataset.f;render();});
    B.querySelectorAll('.seat').forEach(b=>b.onclick=()=>{reserve(a,car,+b.dataset.s,(car+1)+'号車 '+(fl==='up'?'2階':'1階')+' '+b.dataset.l+'席');B.innerHTML='<div class="note big">予約しました：'+RESV.label+'</div><div class="note">その電車に乗ったら「予約した席へ」を押してください</div>';});};render();}
function reserve(a,k,si,label){cancelResv();RESV={a,k,si,label};if(a.slots){const sl=carSlots(a,k),q=sl.seat[si];if(q&&q!=='PLAYER'&&q!=='RES'&&q.used){sl.seat[si]=null;releaseOne(a,q);}sl.seat[si]='RES';}toast('グリーン車を予約しました（'+label+'）','ok');}
function cancelResv(){if(!RESV)return;const a=RESV.a;if(a.slots){const sl=carSlots(a,RESV.k);if(sl.seat[RESV.si]==='RES')sl.seat[RESV.si]=null;}RESV=null;}
function goReserved(){if(!RIDE||!RESV||RIDE.a!==RESV.a)return;const a=RIDE.a;if(RIDE.seat!=null)standUp();
  if(RIDE.k!==RESV.k){a.tr.cars[RIDE.k].remove(camera);a.tr.cars[RESV.k].add(camera);RIDE.k=RESV.k;}
  const sl=carSlots(a,RESV.k),st=seatsOf(a,RESV.k)[RESV.si],q=sl.seat[RESV.si];if(q&&q!=='RES'&&q!=='PLAYER'&&q.used){sl.seat[RESV.si]=null;releaseOne(a,q);}
  sl.seat[RESV.si]='PLAYER';RIDE.seat=RESV.si;RIDE.lx=st.x;RIDE.lz=st.z;if(st.fl)RIDE.fl=st.fl;W.yaw=st.yaw+Math.PI;W.pitch=-0.05;toast('予約した席に座りました（'+RESV.label+'）','ok');}
function updResv(){const b=document.getElementById('paxResv');if(!b)return;if(RESV&&RESV.a.state==='off'&&!(RIDE&&RIDE.a===RESV.a)){RESV=null;toast('予約した電車が遠くへ行ったため予約は取り消されました','warn');}
  const show=!!(RESV&&RIDE&&RIDE.a===RESV.a&&RIDE.seat!==RESV.si);b.classList.toggle('hide',!show);}
/* --- マップ --- */
function appMap(e){e.innerHTML='<canvas id="mpCv" width="640" height="640"></canvas><div class="note">●あなた　●電車</div>';const cv=e.querySelector('#mpCv'),x=cv.getContext('2d');
  const a0=BRANCH?TRK0:0,a1=BRANCH?TRK1:L,pts=[];for(let s2=a0;s2<=a1;s2+=Math.max(40,(a1-a0)/400)){const p=P(s2);pts.push([p[0],p[1]]);}
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(const [px2,pz2] of pts){mnx=Math.min(mnx,px2);mxx=Math.max(mxx,px2);mnz=Math.min(mnz,pz2);mxz=Math.max(mxz,pz2);}
  const sc=560/Math.max(mxx-mnx,mxz-mnz),X=v=>40+(v-mnx)*sc,Z=v=>40+(v-mnz)*sc;
  const draw=()=>{x.fillStyle='#e9efe4';x.fillRect(0,0,640,640);x.strokeStyle='#2f6f4f';x.lineWidth=5;x.beginPath();pts.forEach(([a,b],i)=>i?x.lineTo(X(a),Z(b)):x.moveTo(X(a),Z(b)));x.stroke();
    x.font='13px sans-serif';for(const st of STATIONS){const p=P(st.s);x.fillStyle='#fff';x.strokeStyle='#2f6f4f';x.lineWidth=2;x.beginPath();x.arc(X(p[0]),Z(p[1]),5,0,7);x.fill();x.stroke();x.fillStyle='#223';x.fillText(st.name,X(p[0])+7,Z(p[1])-6);}
    for(const a of OT){if(!a.key||a.state==='off')continue;const p=P(a.s);x.fillStyle=KIND[a.key]==='ltd'?'#d0342c':KIND[a.key]==='rapid'?'#e8731e':'#1f9a4c';x.fillRect(X(p[0])-4,Z(p[1])-4,8,8);}
    const me=camera.getWorldPosition(new THREE.Vector3());x.fillStyle='#ff2a2a';x.beginPath();x.arc(X(me.x),Z(me.z),8+Math.sin(performance.now()/200)*2,0,7);x.fill();};
  draw();DEV.timer=setInterval(()=>{if(DEV.app==='map')draw();},500);}
/* --- カメラ・写真 --- */
function appCam(e){e.innerHTML='<div class="note">画面に映っている景色を撮影します</div><button class="shutter" id="shut"></button><div id="camLast"></div>';
  e.querySelector('#shut').onclick=()=>{PHOTO_REQ=true;const f=document.getElementById('devFlash');f.classList.remove('hide');setTimeout(()=>f.classList.add('hide'),120);
    setTimeout(()=>{const l=e.querySelector('#camLast');if(l&&PHOTOS[0])l.innerHTML='<img src="'+PHOTOS[0]+'"><div class="note">保存しました（写真 '+PHOTOS.length+'枚）</div>';},200);};}
function appPhoto(e){if(!PHOTOS.length){e.innerHTML='<div class="note">写真はまだありません。カメラで撮影してください</div>';return;}
  e.innerHTML='<div class="photoGrid">'+PHOTOS.map((p,i)=>'<img data-i="'+i+'" src="'+p+'">').join('')+'</div>';
  e.querySelectorAll('img').forEach(im=>im.onclick=()=>{const i=+im.dataset.i;e.innerHTML='<img class="photoBig" src="'+PHOTOS[i]+'"><div class="tabs"><button id="phBack">一覧へ</button><button id="phDel">削除</button></div>';
    e.querySelector('#phBack').onclick=()=>appPhoto(e);e.querySelector('#phDel').onclick=()=>{PHOTOS.splice(i,1);appPhoto(e);};});}
/* --- 録音（ゲームの音を録音） --- */
function appRec(e){const R=DEV;const draw=()=>{e.innerHTML='<div class="note">まわりの音（電車・放送・メロディ）を録音します</div><button class="recBtn'+(R.rec?' on':'')+'" id="recB">'+(R.rec?'■ 停止':'● 録音')+'</button>'+
    RECS.map((r,i)=>'<div class="row">録音'+(i+1)+'　'+r.len+'秒<audio controls src="'+r.url+'"></audio></div>').join('');
  e.querySelector('#recB').onclick=()=>{try{if(R.rec){R.rec.stop();return;}initAudio();if(!R.dest){R.dest=AC.createMediaStreamDestination();master.connect(R.dest);}
    const mr=new MediaRecorder(R.dest.stream),ch=[],t0=performance.now();mr.ondataavailable=ev=>{if(ev.data.size)ch.push(ev.data);};
    mr.onstop=()=>{const b=new Blob(ch,{type:mr.mimeType||'audio/mp4'});RECS.unshift({url:URL.createObjectURL(b),len:Math.round((performance.now()-t0)/1000)});R.rec=null;if(DEV.app==='rec')draw();};mr.start();R.rec=mr;draw();}
    catch(err){toast('この端末では録音できません','warn');}};};draw();}
/* --- タブレット：もぐらたたき --- */
function appMole(e){let score=0,left=30,cur=-1;e.innerHTML='<div class="note" id="mlInfo"></div><div class="moleGrid">'+[0,1,2,3,4,5,6,7,8].map(i=>'<button data-i="'+i+'"></button>').join('')+'</div><button class="big" id="mlStart">スタート</button>';
  const info=()=>{e.querySelector('#mlInfo').textContent='得点 '+score+'　のこり '+left+'秒';};info();const btns=[...e.querySelectorAll('.moleGrid button')];
  btns.forEach(b=>b.onclick=()=>{if(+b.dataset.i===cur){score++;b.textContent='💥';cur=-1;info();}});
  e.querySelector('#mlStart').onclick=()=>{score=0;left=30;info();clearInterval(DEV.timer);let tk=0;DEV.timer=setInterval(()=>{tk++;btns.forEach(b=>b.textContent='');if(tk%2===0){left--;info();}
    if(left<=0){clearInterval(DEV.timer);DEV.timer=null;cur=-1;e.querySelector('#mlInfo').textContent='おわり！ 得点 '+score;return;}cur=Math.floor(Math.random()*9);btns[cur].textContent='🐹';},500);};}
/* --- タブレット：15パズル --- */
function appPuz(e){let t=[...Array(15).keys()].map(i=>i+1).concat([0]);const nb=i=>[i-4,i+4,i%4?i-1:-1,i%4<3?i+1:-1].filter(j=>j>=0&&j<16);
  for(let k=0;k<300;k++){const z=t.indexOf(0),c=nb(z),j=c[Math.floor(Math.random()*c.length)];[t[z],t[j]]=[t[j],t[z]];}let mv=0;
  const draw=()=>{const win=t.slice(0,15).every((v,i)=>v===i+1);e.innerHTML='<div class="note">'+(win?'クリア！ '+mv+'手':'手数 '+mv)+'</div><div class="puz">'+t.map((v,i)=>'<button data-i="'+i+'" class="'+(v?'':'emp')+'">'+(v||'')+'</button>').join('')+'</div><button class="big" id="pzNew">もう一度</button>';
    e.querySelectorAll('.puz button').forEach(b=>b.onclick=()=>{const i=+b.dataset.i,z=t.indexOf(0);if(nb(z).includes(i)){[t[z],t[i]]=[t[i],t[z]];mv++;draw();}});e.querySelector('#pzNew').onclick=()=>appPuz(e);};draw();}
/* --- タブレット：動画サイト・アニメサイト（その場で描く映像） --- */
const VIDS=[['車窓から 汐見環状線一周','train'],['夜の花火大会','fire'],['海辺の波','sea'],['夜景ドライブ','night'],['雨の街','rain']],
  ANIS=[['ゆるでん！ 第1話「はじめての運転」','a'],['ゆるでん！ 第2話「満員電車」','b'],['ゆるでん！ 第3話「発車メロディ」','c'],['ほしぞら駅 第1話','d']];
function appVideo(e){e.innerHTML='<div class="vlist">'+VIDS.map((v,i)=>'<button data-i="'+i+'"><span class="th th'+i+'"></span>'+v[0]+'<small>'+(1000+i*3717)%9000+'回再生</small></button>').join('')+'</div>';
  e.querySelectorAll('.vlist button').forEach(b=>b.onclick=()=>player(e,VIDS[+b.dataset.i],false));}
function appAnime(e){e.innerHTML='<div class="vlist">'+ANIS.map((v,i)=>'<button data-i="'+i+'"><span class="th tha'+i+'"></span>'+v[0]+'<small>24分</small></button>').join('')+'</div>';
  e.querySelectorAll('.vlist button').forEach(b=>b.onclick=()=>player(e,ANIS[+b.dataset.i],true));}
function player(e,v,anime){e.innerHTML='<div class="note">'+v[0]+'</div><canvas id="vCv" width="640" height="360"></canvas><div class="vctl"><button id="vPlay">❚❚</button><input id="vSeek" type="range" min="0" max="600" value="0"><span id="vT">0:00</span></div><button class="big" id="vBack">一覧へ</button>';
  const cv=e.querySelector('#vCv'),x=cv.getContext('2d'),seek=e.querySelector('#vSeek');let t=0,play=true,last=performance.now();
  e.querySelector('#vPlay').onclick=()=>{play=!play;e.querySelector('#vPlay').textContent=play?'❚❚':'▶';};seek.oninput=()=>{t=+seek.value/10;};e.querySelector('#vBack').onclick=()=>{devStop();(anime?appAnime:appVideo)(e);};
  const LINES=['おはよう！今日も電車に乗るよ','ドアが閉まります、ご注意ください','次は〜しおみ〜しおみ〜','満員だね…がんばろう！','発車メロディ、いい曲だよね','またあした！'];
  const loop=now=>{const dt=(now-last)/1000;last=now;if(play){t+=dt;if(t>60)t=0;}seek.value=Math.round(t*10);e.querySelector('#vT').textContent=Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
    const W2=640,H2=360,k=v[1];
    if(!anime){if(k==='train'){x.fillStyle='#8fc4ee';x.fillRect(0,0,W2,H2);x.fillStyle='#6f9a3c';x.fillRect(0,230,W2,130);for(let i=0;i<9;i++){const xx=((i*130-t*220)%1170+1170)%1170-150;x.fillStyle='#4d7a3a';x.beginPath();x.arc(xx,230,40+(i%3)*15,Math.PI,0);x.fill();x.fillStyle='#d9d4c7';x.fillRect(xx+70,170,50,60);}
        for(let i=0;i<16;i++){const xx=((i*60-t*900)%960+960)%960-60;x.fillStyle='#5a4a3a';x.fillRect(xx,300,8,60);}x.fillStyle='#333';x.fillRect(0,0,W2,26);x.fillRect(0,H2-26,W2,26);}
      else if(k==='fire'){x.fillStyle='rgba(5,8,20,0.25)';x.fillRect(0,0,W2,H2);for(let n=0;n<3;n++){const ph=(t*0.7+n*0.33)%1,cx=120+n*200,cy=120+((n*53)%60);x.fillStyle=['#ff6b6b','#ffd23f','#8fd6ff'][n];for(let a2=0;a2<24;a2++){const an=a2/24*6.283;x.fillRect(cx+Math.cos(an)*ph*120,cy+Math.sin(an)*ph*120+ph*ph*40,3,3);}}}
      else if(k==='sea'){x.fillStyle='#9fd0f0';x.fillRect(0,0,W2,H2);x.fillStyle='#ffe9a8';x.beginPath();x.arc(500,80,40,0,7);x.fill();for(let r=0;r<8;r++){x.fillStyle='hsl(200,60%,'+(40+r*3)+'%)';x.beginPath();x.moveTo(0,H2);for(let xx=0;xx<=W2;xx+=16)x.lineTo(xx,180+r*24+Math.sin(xx/60+t*1.5+r)*8);x.lineTo(W2,H2);x.fill();}}
      else if(k==='night'){x.fillStyle='#0a1024';x.fillRect(0,0,W2,H2);for(let i=0;i<40;i++){const bx=((i*41-t*60)%880+880)%880-120,bh=60+(i*37)%160;x.fillStyle='#141c34';x.fillRect(bx,H2-bh,36,bh);for(let w=0;w<bh/14;w++)if((i*7+w*3)%5<3){x.fillStyle='#ffd58a';x.fillRect(bx+6,H2-bh+6+w*14,8,6);x.fillRect(bx+22,H2-bh+6+w*14,8,6);}}}
      else{x.fillStyle='#5a6370';x.fillRect(0,0,W2,H2);x.strokeStyle='rgba(200,220,255,0.5)';for(let i=0;i<120;i++){const xx=(i*53+t*30)%W2,yy=(i*97+t*400)%H2;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx-3,yy+14);x.stroke();}x.fillStyle='#2a3038';x.fillRect(0,250,W2,110);}}
    else{const bg=['#ffe3ef','#e3f0ff','#fff3d6','#1a1d3a'][['a','b','c','d'].indexOf(k)];x.fillStyle=bg;x.fillRect(0,0,W2,H2);x.fillStyle=k==='d'?'#3a3f6a':'#c9e6c0';x.fillRect(0,260,W2,100);
      for(let n=0;n<2;n++){const cx=200+n*240+Math.sin(t*2+n)*20,cy=200+Math.abs(Math.sin(t*4+n))*-18;x.fillStyle=n?'#ffcf9a':'#ffd8b0';x.beginPath();x.arc(cx,cy,56,0,7);x.fill();
        x.fillStyle=n?'#5a3a2a':'#2b211c';x.beginPath();x.arc(cx,cy-18,58,Math.PI,0);x.fill();x.fillStyle='#222';const bl=Math.sin(t*3+n*2)>0.95;x.fillRect(cx-22,cy-4,10,bl?2:12);x.fillRect(cx+12,cy-4,10,bl?2:12);
        x.strokeStyle='#c2566b';x.lineWidth=3;x.beginPath();x.arc(cx,cy+18,12,0.2,Math.PI-0.2);x.stroke();x.fillStyle=n?'#3f63b0':'#e08cb0';x.fillRect(cx-40,cy+52,80,70);}
      const li=Math.floor(t/4)%LINES.length;x.fillStyle='rgba(0,0,0,0.6)';x.fillRect(40,300,560,44);x.fillStyle='#fff';x.font='bold 22px sans-serif';x.textAlign='center';x.fillText(LINES[li],320,330);x.textAlign='left';}
    DEV.raf=requestAnimationFrame(loop);};DEV.raf=requestAnimationFrame(loop);}
/* 支線：顔を出したときのボタン・ホームのメロディボタン */
{const on=(id,f)=>{const e=document.getElementById(id);if(e)_on(e,'click',ev=>{ev.stopPropagation();initAudio();f();});};
  on('leanBackB',()=>leanBack());
  on('paxView',()=>toggle3P());on('liveBtn',()=>toggleLive());
  on('mcUp',()=>{const inv=(typeof window.__MC_INV==='boolean')?window.__MC_INV:true;if(inv)setMNotch(G.mnotch>0?0:G.mnotch-1);else setMNotch(G.mnotch<0?0:G.mnotch+1);});
  on('mcDn',()=>{const inv=(typeof window.__MC_INV==='boolean')?window.__MC_INV:true;if(inv)setMNotch(G.mnotch<0?0:G.mnotch+1);else setMNotch(G.mnotch>0?0:G.mnotch-1);});
  on('mcN',()=>setMNotch(0));on('mcEB',()=>setMNotch(-8));
  on('paxPhone',()=>openDev('phone'));on('paxTab',()=>openDev('tablet'));on('paxResv',()=>goReserved());
  on('devClose',()=>closeDev());on('devHome',()=>devHome());
  _on(window,'keydown',e=>{if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return;if(G.phase==='play'&&e.code==='KeyV'&&(PAX||G.crew==='twoC'))toggle3P();});
  on('cExit',()=>enterWalk());on('cSal',()=>enterSalWalk());on('cLean',()=>{if(G.lean){leanBack();return;}const st=stOf(G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv);const sd=(st?localSide(st)*SIDEINV:-1)||-1;toggleLean(sd);});on('cView',()=>toggle3P());
  on('cMic',()=>{const p=document.getElementById('crewMicPanel');if(p)p.classList.toggle('hide');});
  on('btnCrewMicFab',()=>{const p=document.getElementById('crewMicPanel');if(p)p.classList.toggle('hide');});
  on('crewMicClose',()=>{const p=document.getElementById('crewMicPanel');if(p)p.classList.add('hide');});
  on('micInBtn',()=>startCrewMic('in'));
  on('micOutBtn',()=>startCrewMic('out'));
  on('micOffBtn',()=>stopCrewMic());
  on('cItv',()=>{const p=document.getElementById('crewItvPanel');if(p)p.classList.toggle('hide');});
  on('crewItvClose',()=>{const p=document.getElementById('crewItvPanel');if(p)p.classList.add('hide');});
  on('cStaf',()=>{const p=document.getElementById('crewStafPanel');if(!p)return;const show=p.classList.contains('hide');p.classList.toggle('hide',!show);if(show)drawCrewStaf(true);});
  on('crewStafClose',()=>{const p=document.getElementById('crewStafPanel');if(p)p.classList.add('hide');});
  on('cAnn',()=>{const p=document.getElementById('crewAnnPanel');if(p)p.classList.toggle('hide');});
  on('crewAnnClose',()=>{const p=document.getElementById('crewAnnPanel');if(p)p.classList.add('hide');});
  for(let i=0;i<4;i++)on('annBtn'+i,()=>{broadcast(i);});
  on('itvOpenBtn',()=>{const st=stOf(G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv);openDoor(localSide(st));});
  on('itvCloseBtn',()=>closeDoor(G.door.local));
  on('itvMeloBtn',()=>promote('st'));
  on('cOpen',()=>{const st=stOf(G.atStation!==null?G.atStation:G.depCheck!==null?G.depCheck:G.nv);openDoor(localSide(st));});on('cClose',()=>closeDoor(G.door.local));
  on('cMelo',()=>promote('st'));on('cPromo',()=>promote(1));on('cSig',()=>giveSignal());on('meloBtn',()=>promote(defaultPromo()));
  if(OWNOLD&&G.crew!=='twoC')setTimeout(()=>toast('支線の古い電車：乗降確認・戸開閉・発車メロディは、運転室の左右の壁「窓から顔を出す」から（メロディはホームのボタンでも）','info'),4200);}
/* 画質・動作の設定を反映（ゲーム中に変えても、その場で切り替わる） */
window.__applyQ=()=>{const dpr=window.devicePixelRatio||1;
  const isMob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (QMODE==='extreme') {
    QUAL.max = isMob ? 0.45 : 0.55;
    QUAL.min = 0.35;
  } else if (QMODE==='ultralight') {
    QUAL.max = isMob ? 0.6 : 0.72;
    QUAL.min = 0.42;
  } else if (QMODE==='heavy') {
    QUAL.max = isMob ? Math.min(dpr, 1.2) : Math.min(dpr, 2);
    QUAL.min = 0.5;
  } else {
    QUAL.max = isMob ? Math.min(dpr, 1.0) : Math.min(dpr, 1.1);
    QUAL.min = 0.5;
  }
  QUAL.pr=QUAL.max;QUAL.pend=null;QUAL.lock=0;QUAL.ema=16;renderer.setPixelRatio(QUAL.pr);
  for(const k in RT) {
    if (QMODE==='extreme') RT[k].setSize(160, 120);
    else if (QMODE==='ultralight') RT[k].setSize(240, 180);
    else if (QMODE==='heavy') isMob ? RT[k].setSize(384, 288) : RT[k].setSize(640, 480);
    else RT[k].setSize(320, 240);
  }
  if(QMODE==='normal'){for(const ch of CHUNKS)if(ch&&ch.g)ch.g.visible=true;const trs=[ownTrain];for(const a of OT)trs.push(a.tr);for(const t of cityTrains)trs.push(t);for(const t of depotTrains)trs.push(t);for(const tr of trs)if(tr&&tr.cars)for(const c of tr.cars)c.visible=true;}
  if(TRAF.ready){for(const k of ['body','cab','whl','hl','tl','pb','ph','pl'])if(TRAF[k]){scene.remove(TRAF[k]);TRAF[k].geometry.dispose();TRAF[k].dispose&&TRAF[k].dispose();}TRAF.ready=false;}
  try{toast('画質：'+({extreme:'最軽量',ultralight:'超軽量',light:'軽い',normal:'普通',heavy:'重い'})[QMODE],'info');}catch(e){}};
window.__reloadOtherTrains=()=>{
  let reloadedCount = 0;
  if (IS_ONLINE && window.ONLINE_PLAYERS) {
    for (const pid in ONLINE_PLAYERS) {
      const p = ONLINE_PLAYERS[pid];
      if (!p || p.isPax || p.state === 'passenger' || p.s == null) continue;
      if (p.tr) {
        if (p.tr.grp) p.tr.grp.visible = true;
        if (p.tr.cars) for (const c of p.tr.cars) c.visible = true;
        if (p.tr.nameplate) p.tr.nameplate.visible = true;
      }
      reloadedCount++;
    }
  }
  for (const ch of CHUNKS) if (ch && ch.g) ch.g.visible = true;
  if (IS_ONLINE && ONLINE_CLIENT && !ONLINE_CLIENT.connected && !isConnectingOnline) {
    initOnlineClient();
  }
  toast('🔄 他列車の表示をリフレッシュしました' + (reloadedCount ? '（' + reloadedCount + '両同期中）' : ''), 'ok');
};
(function applyQMode(){const dpr=window.devicePixelRatio||1;
  const isMob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (QMODE==='extreme') {
    QUAL.max = isMob ? 0.45 : 0.55;
    QUAL.min = 0.35;
  } else if (QMODE==='ultralight') {
    QUAL.max = isMob ? 0.6 : 0.72;
    QUAL.min = 0.42;
  } else if (QMODE==='heavy') {
    QUAL.max = isMob ? Math.min(dpr, 1.2) : Math.min(dpr, 2);
    QUAL.min = 0.5;
  } else {
    QUAL.max = isMob ? Math.min(dpr, 1.0) : Math.min(dpr, 1.1);
    QUAL.min = 0.5;
  }
  QUAL.pr=QUAL.max;QUAL.pend=null;QUAL.lock=0;renderer.setPixelRatio(QUAL.pr);
  if(QMODE==='heavy')for(const k in RT)OLDMON?RT[k].setSize(768,288):(isMob?RT[k].setSize(384,288):RT[k].setSize(640,480)); // ホームカメラ映像を高精細に
  else if(QMODE==='extreme')for(const k in RT)RT[k].setSize(160,120);
  else if(QMODE==='ultralight')for(const k in RT)RT[k].setSize(240,180);
})();
requestAnimationFrame(frame);
startRoute(SVC,START_I);
if (IS_ONLINE) {
  const myPlate = makeNameplateSprite(MY_PLAYER_NAME, SVCLOOK[G.key][1], !!window.IS_DEV);
  myPlate.position.set(0, 4.6, -CARHALF + 2.5);
  ownTrain.cars[0].add(myPlate);
  ownTrain.nameplate = myPlate;
  startOnlinePublishLoop();
  const hudBtn = document.getElementById('btnOnlineHud');
  if (hudBtn) hudBtn.classList.remove('hide');
  const chatFab = document.getElementById('btnChatFab');
  if (chatFab) chatFab.classList.remove('hide');
  const dtFab = document.getElementById('btnDriverTablet');
  if (dtFab && !PAX) dtFab.classList.remove('hide');
  const tfFab = document.getElementById('btnTransfer');
  if (tfFab) {
    tfFab.classList.remove('hide');
    tfFab.textContent = PAX ? '🚉 乗り換え' : '🚃 方向幕・ダイヤ';
    tfFab.onclick = function(){ try{ openTransferPanel(); }catch(e){ console.warn(e); } };
  }
  /* 運転条件モーダルの手動ダイヤ選択 */
  if (typeof window.__initDiaSelectUI === 'function') window.__initDiaSelectUI();
  const micFab = document.getElementById('btnCrewMicFab');
  if (micFab && !PAX) micFab.classList.remove('hide');
  updateOnlineHud(true);
}
window.__initDiaSelectUI = function(){
  const MAP={btnDiaAuto:'auto',btnDiaNormal:'normal',btnDiaExtra:'extra',btnDiaChange:'change'};
  const man=(()=>{try{return localStorage.getItem('td_dia')||'auto';}catch(e){return 'auto';}})();
  for(const id in MAP){const e=document.getElementById(id);if(!e)continue;e.style.outline=(man===MAP[id])?'3px solid #38bdf8':'none';
    e.onclick=()=>{const v=MAP[id];try{localStorage.setItem('td_dia',v);}catch(err){}
      try{refreshDailyCond();}catch(err){}
      for(const id2 in MAP){const e2=document.getElementById(id2);if(e2)e2.style.outline=(id2===id)?'3px solid #38bdf8':'none';}
      const note=document.getElementById('diaSelNote');if(note)note.textContent='選択中：'+(v==='auto'?'自動（毎月日替わり）':DIA_NAME[v])+'（保存しました。この設定で乗務を開始します）';};
  }
};
try{ window.__initDiaSelectUI(); }catch(e){}
const btr = document.getElementById('btnTitleReturn');
if (btr) btr.classList.remove('hide');
let troubleVisGrp=null,troubleVisKind=null,troubleVisT=0;
function clearTroubleVisual(){
  if(troubleVisGrp){try{scene.remove(troubleVisGrp);}catch(e){}troubleVisGrp=null;}
  troubleVisKind=null;
  if(G)G.sigBug=false;
  if(typeof rig!=='undefined')rig.rotation.z=0;
}
function spawnTroubleVisual(reason){
  clearTroubleVisual();
  if(!G||PAX)return;
  const r=String(reason||'');
  troubleVisT=0;
  if(r.includes('信号')){
    troubleVisKind='signal';
    G.sigBug=true;
    return;
  }
  const grp=new THREE.Group();
  const fwdS=G.s+G.dir*80;
  const trkO=TK[G.key]?TK[G.key].o:0;
  if(r.includes('踏切')){
    troubleVisKind='crossing';
    const base=offs(fwdS,trkO,0);
    grp.position.copy(base);
    const obs=new THREE.Mesh(boxGeo(2.2,1.1,1.6),lam(0xd97706));obs.position.set(0,0.55,0);grp.add(obs);
    const pole=new THREE.Mesh(boxGeo(0.14,3.4,0.14),lam(0xeab308));pole.position.set(2.2,1.7,0);grp.add(pole);
    const l1=new THREE.Mesh(new THREE.SphereGeometry(0.24,10,10),new THREE.MeshBasicMaterial({color:0xff2222}));l1.position.set(2.2,3.1,0);grp.add(l1);
    grp.userData.flash=l1;
  }else if(r.includes('火災')||r.includes('発煙')){
    troubleVisKind='fire';
    const base=offs(fwdS+G.dir*15,trkO+6.5,0);
    grp.position.copy(base);
    const glow=new THREE.Mesh(new THREE.SphereGeometry(1.4,12,12),new THREE.MeshBasicMaterial({color:0xff5500}));glow.position.set(0,1.2,0);grp.add(glow);
    const smokes=[];
    for(let i=0;i<8;i++){
      const sm=new THREE.Mesh(new THREE.SphereGeometry(0.9+i*0.25,10,10),new THREE.MeshBasicMaterial({color:0x64748b,transparent:true,opacity:0.55}));
      sm.position.set((Math.random()-0.5)*1.8,2+i*1.6,(Math.random()-0.5)*1.8);
      grp.add(sm);smokes.push(sm);
    }
    grp.userData.glow=glow;grp.userData.smokes=smokes;
  }else if(r.includes('人立ち入り')){
    troubleVisKind='person';
    const base=offs(fwdS-G.dir*15,trkO,0);
    grp.position.copy(base);
    const p=makePerson('adult');p.position.set(0,0,0);grp.add(p);
  }else if(r.includes('先行列車')||r.includes('車両点検')){
    troubleVisKind='train';
    const base=offs(fwdS+G.dir*35,trkO,0);
    grp.position.copy(base);
    const body=new THREE.Mesh(boxGeo(2.8,3.2,18),lam(0x94a3b8));body.position.set(0,2.2,0);grp.add(body);
    const tail=new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8),new THREE.MeshBasicMaterial({color:0xff1111}));tail.position.set(0.9,1.8,-9.05);grp.add(tail);
    const tail2=tail.clone();tail2.position.x=-0.9;grp.add(tail2);
    grp.userData.flash=tail;grp.userData.flash2=tail2;
  }else if(r.includes('強風')){
    troubleVisKind='wind';
    const base=offs(fwdS,trkO,2.2);
    grp.position.copy(base);
    const streaks=[];
    for(let i=0;i<14;i++){
      const st=new THREE.Mesh(boxGeo(3.5,0.06,0.06),new THREE.MeshBasicMaterial({color:0xe2e8f0,transparent:true,opacity:0.5}));
      st.position.set((Math.random()-0.5)*14,(Math.random()-0.5)*4,(Math.random()-0.5)*20);
      grp.add(st);streaks.push(st);
    }
    grp.userData.streaks=streaks;
  }
  scene.add(grp);troubleVisGrp=grp;
}
function updTroubleVisual(dt){
  if(!troubleVisKind)return;
  troubleVisT+=dt;
  if(troubleVisKind==='signal'&&G&&G.sigBug){
    if(Math.floor(troubleVisT*7)!==Math.floor((troubleVisT-dt)*7)){
      const opts=['R','YY','Y','YG','G'];
      G.sig=opts[Math.floor(Math.random()*opts.length)];
      if(typeof drawPanel==='function')drawPanel();
    }
    return;
  }
  if(!troubleVisGrp)return;
  if(troubleVisKind==='crossing'&&troubleVisGrp.userData.flash){
    troubleVisGrp.userData.flash.visible=Math.sin(troubleVisT*14)>0;
  }else if(troubleVisKind==='fire'&&troubleVisGrp.userData.smokes){
    const s=1+0.25*Math.sin(troubleVisT*10);
    if(troubleVisGrp.userData.glow)troubleVisGrp.userData.glow.scale.set(s,s,s);
    troubleVisGrp.userData.smokes.forEach((m,i)=>{
      m.position.y+=dt*(1.8+i*0.15);
      if(m.position.y>16)m.position.y=2;
    });
  }else if(troubleVisKind==='train'&&troubleVisGrp.userData.flash){
    const on=Math.sin(troubleVisT*8)>0;
    troubleVisGrp.userData.flash.visible=on;
    if(troubleVisGrp.userData.flash2)troubleVisGrp.userData.flash2.visible=!on;
  }else if(troubleVisKind==='wind'&&troubleVisGrp.userData.streaks){
    troubleVisGrp.userData.streaks.forEach(m=>{
      m.position.x+=dt*26;
      if(m.position.x>9)m.position.x=-9;
    });
    if(typeof rig!=='undefined')rig.rotation.z=Math.sin(troubleVisT*9)*0.012;
  }
}
window.__spawnTroubleVisual=spawnTroubleVisual;
window.__clearTroubleVisual=clearTroubleVisual;
window.toast=toast;
window.__AUD={get AC(){return AC;},get master(){return master;},get camera(){return camera;},get TK(){return TK;},get STATIONS(){return STATIONS;},offsG,tone,mnote,melody,playSong,chime,ponSnd,doorOpenSnd,doorCloseSnd,playGuide,playStationAnnounce,ltdSong,SONG_A,SONG_B,promoRun,loadAnnBuffer,listenerSealed,clamp};
window.__T={
  /* v1.9.7：放送の結合結果を確認するための診断（開発・検証用。読み取りのみ） */
  annTest:(urls)=>prepareAnnBuffer(urls).then(buf=>{ if(!buf) return null; const d=buf.getChannelData(0), sr=buf.sampleRate;
    let peak=0; for(let i=0;i<d.length;i+=3){const v=d[i]<0?-d[i]:d[i]; if(v>peak)peak=v;}
    let run=0,start=0; const gaps=[];
    for(let i=0;i<d.length;i++){ const quiet=(d[i]<0?-d[i]:d[i])<Math.max(0.001,peak*0.02);
      if(quiet){ if(!run)start=i; run++; } else { if(run>sr*0.06){ gaps.push([+(start/sr).toFixed(2), +(run/sr).toFixed(2)]); } run=0; } }
    return {dur:+(buf.length/sr).toFixed(2), peak:+peak.toFixed(3), gapCount:gaps.length, gaps:gaps.slice(0,30)};
  }).catch(e=>String(e)),
  annState:()=>({playing:annPlaying, queued:annQ.length, cached:annMergeCache.size}),
  annPlay:(urls)=>{ try{ playAnnQueue(urls); return true; }catch(e){ return String(e); } },
  AVATAR,enterConcourse,leaveConcourse,nearFacility,useFacility,concourseGeom,guideBoardTex,guideBoardRows,updStaff,doStaffTask,getTask:()=>staffTask,goFloor,greenCar,ownAI,updInterior,VD,VDC,NVAR,NVARC,upcomingStops,etaList,stationInfo,drawInfoPanel,ownTrain,PBof,carsFor,POOL,SALDOOR,sitDown,standUp,seatNear,seatsOf,SAL,INTW,isPop,doAct,camTouchOn,nearTrainDoor,boardTrain,alightTrain,getRide:()=>RIDE,INTP,PX,platformsOf,paxPlace,gotoStation,G,OT,POOL,STATIONS,CHUNKS,startRoute,toggleAuto,toggleATO,openDoor,closeDoor,promote,broadcast,active,pending,inZone,stopDist,stOf,localSide,SIGNALS,CROSS,Yat,enterWalk,exitWalk,canExit,W,FT,startWaiting,endWaiting,LEDS,SHIN,SH,serves,TK,CFG,updChunks,updChunksForce:()=>updChunks(),startClosing,drawPanel};
}
/* ================= home screen (before the world is built) ================= */
// audio must be started inside the user's tap (iOS / Chrome autoplay rules)
function unlockMedia(pax){try{if(!window.__AC){const A=new (window.AudioContext||window.webkitAudioContext)();window.__AC=A;}if(window.__AC.state==='suspended')window.__AC.resume();try{preloadGuides();}catch(e){}
    const o=window.__AC.createOscillator(),g=window.__AC.createGain();g.gain.value=0.0001;o.connect(g);g.connect(window.__AC.destination);o.start();o.stop(window.__AC.currentTime+0.05);}catch(e){}}
(function home(){
  setTimeout(() => initOnlineClient(), 200);
  const cfg=lineConfig('loop'),sts=layoutStations(cfg);const LN={};for(const id of ['branch','branch2','branch3','branch4','branch5']){const c=lineConfig(id);LN[id]={cfg:c,sts:layoutStations(c)};}const bcfg=LN.branch.cfg,bsts=LN.branch.sts;
  const path=genPath(cfg.L,0);
  // route map
  const cv=document.getElementById('homeMap'),x=cv.getContext('2d');const W=cv.width,H=cv.height;
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(let i=0;i<cfg.L;i+=200){mnx=Math.min(mnx,path.px[i]);mxx=Math.max(mxx,path.px[i]);mnz=Math.min(mnz,path.pz[i]);mxz=Math.max(mxz,path.pz[i]);}
  const sc=Math.min((W-120)/(mxx-mnx),(H-60)/(mxz-mnz)),ox=(W-(mxx-mnx)*sc)/2-30,oz=(H-(mxz-mnz)*sc)/2;
  const XY=s=>{const i=Math.floor(mod(s,cfg.L));return [ox+(path.px[i]-mnx)*sc,oz+(path.pz[i]-mnz)*sc];};
  const MV={z:1,px:0,py:0};
  function drawHomeMap(){x.setTransform(1,0,0,1,0,0);x.fillStyle='#0b1322';x.fillRect(0,0,W,H);x.setTransform(MV.z,0,0,MV.z,MV.px,MV.py);
  for(const [w,c] of [[9,'#c8322b'],[6,'#e8731e'],[3,'#14935f']]){x.lineWidth=w;x.strokeStyle=c;x.beginPath();for(let s=0;s<=cfg.L;s+=300){const [a,b]=XY(s);s?x.lineTo(a,b):x.moveTo(a,b);}x.closePath();x.stroke();}
  const J=sts[cfg.junction],[ja,jb]=XY(J.s),cx=(ox+(mxx-mnx)*sc/2),cz=(oz+(mxz-mnz)*sc/2),dx=ja-cx,dz=jb-cz,dl=Math.hypot(dx,dz);
  x.setLineDash([]);
  const stub=(si,col,label,len,dash)=>{const [a,b]=XY(sts[si].s),ux=a-cx,uz=b-cz,ul=Math.hypot(ux,uz)||1;x.lineWidth=3;x.strokeStyle=col;x.setLineDash(dash||[]);x.beginPath();x.moveTo(a,b);x.lineTo(a+ux/ul*len,b+uz/ul*len);x.stroke();x.setLineDash([]);
    x.fillStyle=col;x.font='700 12px '+FONT;x.textAlign='center';x.fillText(label,a+ux/ul*(len+10),b+uz/ul*(len+10)+4);x.textAlign='left';};
  stub(cfg.junction,'#5aa832','白峰支線',66);stub(64,'#7a3fa0','紫雲地下線',80,[7,4]);stub(81,'#2aa6d8','天宮高架線',58);stub(17,'#2a5caa','港見支線',44,[3,3]);
  for(const st of sts){const [a,b]=XY(st.s);const m=st.cls==='M';x.fillStyle=m?'#ffd23f':st.cls==='X'?'#ff8a80':st.cls==='R'?'#ffc27a':'#e8eef6';const r=m?5.5:2.2;x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fill();
    if(m||st.i===0){x.fillStyle='#fff';x.font='700 12px '+FONT;x.fillText(st.name+(st.i===cfg.shin?'（新幹線）':''),a+(a>cx?8:-8-x.measureText(st.name+(st.i===cfg.shin?'（新幹線）':'')).width),b+4);}}

  const SVCLOOK_NAMES = { A: '普通', B: '普通', C: '快速', D: '快速', E: '快速特急', F: '快速特急', G: '特急', H: '特急' };
  if (window.ONLINE_PLAYERS) {
    for (const pid in window.ONLINE_PLAYERS) {
      const p = window.ONLINE_PLAYERS[pid];
      if (p.s != null && (!p.line || p.line === 'loop')) {
        const [a, b] = XY(p.s);
        const pulse = 1 + 0.3 * Math.sin(Date.now() / 180);
        x.save();
        
        // 1. Pulsing radar ripple
        x.fillStyle = 'rgba(56, 189, 248, 0.35)';
        x.beginPath();
        x.arc(a, b, 14 * pulse, 0, Math.PI * 2);
        x.fill();
        
        // 2. Center glowing dot
        x.fillStyle = '#38bdf8';
        x.shadowColor = '#00f2fe';
        x.shadowBlur = 14;
        x.beginPath();
        x.arc(a, b, 7, 0, Math.PI * 2);
        x.fill();
        x.shadowBlur = 0;
        
        // 3. Clear badge with pointer
        const svcLabel = (SVCLOOK_NAMES[p.key] || '環状線') + ' ' + (p.dir > 0 ? '外回り' : '内回り');
        const locLabel = p.stName ? '・' + p.stName : '';
        const tagText = '🚃 ' + p.name + ' (' + svcLabel + locLabel + ')';
        
        x.font = 'bold 12px ' + FONT;
        const tw = x.measureText(tagText).width;
        const th = 22;
        const tx = Math.min(W - tw - 18, Math.max(8, a - (tw + 16) / 2));
        const ty = (b < 60) ? b + 16 : b - 32;
        
        // Connecting line
        x.strokeStyle = '#38bdf8';
        x.lineWidth = 1.5;
        x.beginPath();
        x.moveTo(a, b);
        x.lineTo(tx + (tw + 16) / 2, (b < 60) ? ty : ty + th);
        x.stroke();
        
        // Pill background
        x.fillStyle = 'rgba(15, 23, 42, 0.95)';
        x.strokeStyle = '#38bdf8';
        x.lineWidth = 1.5;
        if (x.roundRect) {
          x.beginPath();
          x.roundRect(tx, ty, tw + 16, th, 6);
          x.fill();
          x.stroke();
        } else {
          x.fillRect(tx, ty, tw + 16, th);
          x.strokeRect(tx, ty, tw + 16, th);
        }
        
        // Text
        x.fillStyle = '#ffffff';
        x.textAlign = 'left';
        x.textBaseline = 'middle';
        x.fillText(tagText, tx + 8, ty + th / 2);
        
        x.restore();
      }
    }
  }

  x.setTransform(1,0,0,1,0,0);
  x.font='500 12px '+FONT;[['#14935f','各駅停車'],['#e8731e','快速'],['#c8322b','快速特急'],['#ffd23f','主要駅']].forEach(([c,t],i)=>{x.fillStyle=c;x.fillRect(W-100,14+i*20,14,10);x.fillStyle='#cfd6e4';x.fillText(t,W-80,23+i*20);});

  const onlineDriverList = Object.values(window.ONLINE_PLAYERS || {}).filter(p => p.s != null);
  if (onlineDriverList.length > 0) {
    x.save();
    x.fillStyle = 'rgba(15, 23, 42, 0.9)';
    x.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    x.lineWidth = 1;
    const boxH = 26 + onlineDriverList.length * 20;
    if (x.roundRect) {
      x.beginPath();
      x.roundRect(12, 12, 270, boxH, 8);
      x.fill();
      x.stroke();
    } else {
      x.fillRect(12, 12, 270, boxH);
      x.strokeRect(12, 12, 270, boxH);
    }
    x.fillStyle = '#38bdf8';
    x.font = 'bold 12px ' + FONT;
    x.fillText('👥 走行中の運転士 (' + onlineDriverList.length + '名)', 20, 28);
    onlineDriverList.forEach((p, idx) => {
      const svc = (SVCLOOK_NAMES[p.key] || '環状線') + ' ' + (p.dir > 0 ? '外' : '内');
      const loc = p.stName ? ' ' + p.stName + '付近' : '';
      x.fillStyle = '#e2e8f0';
      x.font = '11px ' + FONT;
      x.fillText('• ' + p.name + ' [' + svc + ']' + loc, 24, 48 + idx * 20);
    });
    x.restore();
  }
  x.fillStyle='#98a7bf';x.fillText('全長 約'+Math.round(cfg.L/1000)+'km　'+sts.length+'駅',12,H-12);}
  window.drawHomeMap = drawHomeMap;
  drawHomeMap();
  setInterval(() => {
    const vl = document.getElementById('viewLoop');
    if (vl && !vl.classList.contains('hide')) {
      drawHomeMap();
    }
  }, 350);
  /* 路線図は指で動かせる（1本指で移動・2本指で拡大）。ここでのスワイプはページの「戻る」にならないよう、すべてこの図で受け取る */
  {const pts=new Map();let pinch=null;const rect=()=>cv.getBoundingClientRect(),toC=(e)=>{const r=rect();return [(e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height];};
    const clampV=()=>{MV.z=Math.max(1,Math.min(5,MV.z));MV.px=Math.min(0,Math.max(W-W*MV.z,MV.px));MV.py=Math.min(0,Math.max(H-H*MV.z,MV.py));};
    cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}pts.set(e.pointerId,toC(e));if(pts.size===2){const [p1,p2]=[...pts.values()];pinch={d:Math.hypot(p1[0]-p2[0],p1[1]-p2[1]),z:MV.z,cx:(p1[0]+p2[0])/2,cy:(p1[1]+p2[1])/2,px:MV.px,py:MV.py};}});
    cv.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;e.preventDefault();const prev=pts.get(e.pointerId),cur=toC(e);pts.set(e.pointerId,cur);
      if(pts.size===2&&pinch){const [p1,p2]=[...pts.values()],d=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]),z=Math.max(1,Math.min(5,pinch.z*d/Math.max(10,pinch.d)));
        const wx=(pinch.cx-pinch.px)/pinch.z,wy=(pinch.cy-pinch.py)/pinch.z;MV.z=z;MV.px=pinch.cx-wx*z;MV.py=pinch.cy-wy*z;}
      else if(pts.size===1){MV.px+=cur[0]-prev[0];MV.py+=cur[1]-prev[1];}clampV();drawHomeMap();});
    const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    for(const ev of ['touchstart','touchmove'])cv.addEventListener(ev,e=>{e.preventDefault();},{passive:false});
    cv.addEventListener('dblclick',()=>{MV.z=1;MV.px=0;MV.py=0;drawHomeMap();});
    cv.addEventListener('wheel',e=>{e.preventDefault();const [cx2,cy2]=toC(e),z0=MV.z,z=Math.max(1,Math.min(5,z0*(e.deltaY<0?1.15:1/1.15)));MV.px=cx2-(cx2-MV.px)*z/z0;MV.py=cy2-(cy2-MV.py)*z/z0;MV.z=z;clampV();drawHomeMap();},{passive:false});}
  // service cards with lap time
  const times={local:lapTime(cfg,sts,'local'),rapid:lapTime(cfg,sts,'rapid'),ltd:lapTime(cfg,sts,'ltd'),exp:lapTime(cfg,sts,'exp'),test:lapTime(cfg,sts,'test'),branch:lapTime(bcfg,bsts,'branch'),pax:0};
  const timeOf=S=>S.line?lapTime(LN[S.line].cfg,LN[S.line].sts,'branch'):(times[S.kind]||times.local);
  /* ランダム背景写真（ゲーム実機のスクリーンショット） */
  const BG_PHOTOS = [
    'assets/bg/game_cab_day.webp?v=2',
    'assets/bg/game_cab_night.webp?v=2',
    'assets/bg/game_cab_sunset.webp?v=2',
    'assets/bg/game_inside_passenger.webp?v=2',
    'assets/bg/game_outside_sunset.webp?v=2',
    'assets/bg/game_platform.webp?v=2',
    'assets/bg/game_station_night.webp?v=2',
    'assets/bg/game_elevated_view.webp?v=2'
  ];
  let bgIdx = Math.floor(Math.random() * BG_PHOTOS.length);
  const homeBg = document.getElementById('homeBg');
  if (homeBg) {
    homeBg.style.backgroundImage = 'url("' + BG_PHOTOS[bgIdx] + '")';
    setInterval(() => {
      bgIdx = (bgIdx + 1 + Math.floor(Math.random() * (BG_PHOTOS.length - 1))) % BG_PHOTOS.length;
      homeBg.style.backgroundImage = 'url("' + BG_PHOTOS[bgIdx] + '")';
    }, 12000);
  }

  /* 画面遷移制御 */
  const VIEWS = ['viewMain', 'viewDutySelect', 'viewLoop', 'viewBranch', 'viewSettings', 'viewCredits', 'viewFeedback', 'viewFaq', 'viewChangelog'];
  let currentDutyView = 'viewLoop';
  function showHomeView(id) {
    for (const v of VIEWS) {
      const el = document.getElementById(v);
      if (el) el.classList.toggle('hide', v !== id);
    }
    /* 画面を切り替えたら先頭から表示する（ご意見箱が途中から開いて見出しに戻れない不具合の修正） */
    try{const home=document.getElementById('home');if(home)home.scrollTop=0;window.scrollTo(0,0);}catch(e){}
    if (id === 'viewMain' || id === 'viewDutySelect') {
      updateDriverCardUI();
      if (typeof updateBranchLockUI === 'function') updateBranchLockUI();
    }
    if (id === 'viewLoop') {
      setTimeout(() => { if (typeof drawHomeMap === 'function') drawHomeMap(); }, 50);
    }
  }
  showHomeView('viewMain');

  const btnNavDuty = document.getElementById('btnNavDuty');
  if (btnNavDuty) btnNavDuty.onclick = () => {
    for (const pid in ONLINE_PLAYERS) {
      if (pid !== ONLINE_CLIENT_ID && ONLINE_PLAYERS[pid].name === MY_PLAYER_NAME) {
        MY_PLAYER_NAME = (MY_PLAYER_NAME.replace(/#\d+$/, '') || '運転士') + '#' + Math.floor(1000 + Math.random() * 9000);
        CURRENT_DRIVER.name = MY_PLAYER_NAME;
        saveCurrentDriverLocally();
        updateDriverCardUI();
        toast('運転士名を「' + MY_PLAYER_NAME + '」に自動調整しました', 'info');
        break;
      }
    }
    showHomeView('viewDutySelect');
  };
  const btnChangeName = document.getElementById('btnChangeName');
  const btnCardLogin = document.getElementById('btnCardLogin');
  const onlineModal = document.getElementById('onlineModal');
  const onlineNameInput = document.getElementById('onlineNameInput');
  const driverPassInput = document.getElementById('driverPassInput');
  const btnOnlineCancel = document.getElementById('btnOnlineCancel');
  const btnOnlineProceed = document.getElementById('btnOnlineProceed');
  const closeOnlineModal = document.getElementById('closeOnlineModal');
  const driverModalStatus = document.getElementById('driverModalStatus');

  const hideOnlineModal = () => {
    if (onlineModal) onlineModal.classList.add('hide');
    if (driverModalStatus) driverModalStatus.style.display = 'none';
    if (driverPassInput) driverPassInput.value = '';
  };
  const showOnlineModal = () => {
    if (onlineNameInput) onlineNameInput.value = CURRENT_DRIVER.name || '';
    if (driverPassInput) driverPassInput.value = '';
    if (driverModalStatus) driverModalStatus.style.display = 'none';
    updateDriverCardUI();
    if (onlineModal) onlineModal.classList.remove('hide');
  };
  if (btnChangeName) btnChangeName.onclick = showOnlineModal;
  if (btnCardLogin) btnCardLogin.onclick = showOnlineModal;
  if (btnOnlineCancel) btnOnlineCancel.onclick = hideOnlineModal;
  if (closeOnlineModal) closeOnlineModal.onclick = hideOnlineModal;

  const unlockDispatchMode = (fromSubmit) => {
    try { sessionStorage.setItem('shiomi_dispatch_unlocked', '1'); } catch(e) {}
    window.IS_DEV = true;
    if (typeof publishPresence === 'function') publishPresence(true);
    const btnDisp = document.getElementById('btnSelectDispatch');
    if (btnDisp) btnDisp.classList.remove('hide');
    if (fromSubmit) {
      hideOnlineModal();
      if (typeof toast === 'function') toast('📡 指令業務モードが解放されました！「乗務開始」から入れます', 'ok');
    } else if (driverModalStatus) {
      driverModalStatus.style.display = 'block';
      driverModalStatus.style.background = 'rgba(245, 158, 11, 0.16)';
      driverModalStatus.style.border = '1px solid #f59e0b';
      driverModalStatus.style.color = '#fde68a';
      driverModalStatus.textContent = '📡 指令業務モードが解放されました！「乗務開始」の中に「指令業務」が表示されます。';
    }
  };
  try {
    if (sessionStorage.getItem('shiomi_dispatch_unlocked') === '1') {
      const btnDisp = document.getElementById('btnSelectDispatch');
      if (btnDisp) btnDisp.classList.remove('hide');
    }
  } catch(e) {}
  if (driverPassInput) {
    driverPassInput.addEventListener('input', () => {
      if ((driverPassInput.value || '').trim() === '291129') {
        unlockDispatchMode(false);
      }
    });
    driverPassInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (driverPassInput.value || '').trim() === '291129') {
        e.preventDefault();
        unlockDispatchMode(true);
      }
    });
  }
  const btnSelectDispatch = document.getElementById('btnSelectDispatch');
  if (btnSelectDispatch) {
    btnSelectDispatch.addEventListener('click', () => {
      if (typeof window.__openDispatchConsole === 'function') window.__openDispatchConsole();
    });
  }

  if (btnOnlineProceed) {
    btnOnlineProceed.onclick = async () => {
      const name = (onlineNameInput.value || '').trim();
      const pwd = (driverPassInput.value || '').trim();
      if (pwd === '291129') {
        unlockDispatchMode(true);
        return;
      }
      const statusEl = document.getElementById('driverModalStatus');
      
      const showErr = (msg) => {
        if (!statusEl) return;
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
        statusEl.style.border = '1px solid #ef4444';
        statusEl.style.color = '#fca5a5';
        statusEl.textContent = msg;
      };
      const showOk = (msg) => {
        if (!statusEl) return;
        statusEl.style.display = 'block';
        statusEl.style.background = 'rgba(34, 197, 94, 0.15)';
        statusEl.style.border = '1px solid #22c55e';
        statusEl.style.color = '#86efac';
        statusEl.textContent = msg;
      };

      if (!name) {
        showErr('プレイヤー名を入力してください。');
        return;
      }
      if (name.length < 2) {
        showErr('プレイヤー名は2文字以上で入力してください。');
        return;
      }
      if (name.length > 16) {
        showErr('プレイヤー名は16文字以内で入力してください。');
        return;
      }
      if (isSexualOrNSFW(name)) {
        showErr('⚠️ 不適切な言葉（性的な表現など）が含まれているため登録できません。別の名前を入力してください。');
        return;
      }

      // オンライン上で現在他の人が使っているかチェック
      for (const pid in ONLINE_PLAYERS) {
        if (pid !== ONLINE_CLIENT_ID && ONLINE_PLAYERS[pid].name === name) {
          showErr('⚠️ 「' + name + '」は現在他の運転士がオンライン乗務中です。別の名前を入力してください。');
          return;
        }
      }

      // アカウントDB（ローカル＆MQTT）をチェック
      let localDb = {};
      try { localDb = JSON.parse(localStorage.getItem('shiomi_driver_db') || '{}'); } catch(e) {}
      const targetAcc = GLOBAL_ACCOUNTS[name] || localDb[name] || (CURRENT_DRIVER.name === name ? CURRENT_DRIVER : null);

      const passHash = pwd ? await hashPassword(pwd) : '';

      if (targetAcc && targetAcc.passHash) {
        // 既存アカウントが存在する場合
        if (!pwd) {
          showErr('⚠️ 「' + name + '」はパスワード保護されています。パスワードを入力してログインしてください。');
          return;
        }
        if (passHash !== targetAcc.passHash) {
          showErr('❌ パスワードが一致しません。正しいパスワードを入力してください。');
          return;
        }
        // ログイン成功！
        CURRENT_DRIVER.name = name;
        CURRENT_DRIVER.passHash = passHash;
        CURRENT_DRIVER.totalDist = Math.max(CURRENT_DRIVER.totalDist || 0, targetAcc.totalDist || 0);
        CURRENT_DRIVER.totalTime = Math.max(CURRENT_DRIVER.totalTime || 0, targetAcc.totalTime || 0);
        CURRENT_DRIVER.runs = Math.max(CURRENT_DRIVER.runs || 0, targetAcc.runs || 0);
        CURRENT_DRIVER.isGuest = false;
        MY_PLAYER_NAME = name;
        saveCurrentDriverLocally();
        syncDriverToMQTT();
        updateDriverCardUI();
        showOk('✨ ログインしました！累計走行距離: ' + formatDriverDist(CURRENT_DRIVER.totalDist) + '、累計乗務時間: ' + formatDriverTime(CURRENT_DRIVER.totalTime));
        setTimeout(() => {
          hideOnlineModal();
          toast('運転士「' + name + '」でログインしました', 'ok');
          updateOnlineHud();
        }, 1200);
        return;
      }

      // 新規アカウント（または既存だがパスワード未設定）の場合
      if (!pwd) {
        showErr('⚠️ プレイヤー名を保護し、次回から走行距離などを引き継ぐために、パスワード（4文字以上）を設定してください。');
        return;
      }
      if (pwd.length < 4) {
        showErr('⚠️ パスワードは4文字以上で設定してください。');
        return;
      }

      // 新規登録成功！
      CURRENT_DRIVER.name = name;
      CURRENT_DRIVER.passHash = passHash;
      CURRENT_DRIVER.isGuest = false;
      MY_PLAYER_NAME = name;
      saveCurrentDriverLocally();
      syncDriverToMQTT();
      updateDriverCardUI();
      showOk('🎉 運転士「' + name + '」を登録しました！次回からもこの名前とパスワードで記録が引き継がれます。');
      setTimeout(() => {
        hideOnlineModal();
        toast('運転士「' + name + '」を登録しました', 'ok');
        updateOnlineHud();
      }, 1200);
    };
  }
  updateDriverCardUI();

  const btnOnlineHud = document.getElementById('btnOnlineHud');
  const onlinePanel = document.getElementById('onlinePanel');
  const opClose = document.getElementById('opClose');
  if (btnOnlineHud) {
    btnOnlineHud.onclick = () => {
      updateOnlineHud();
      if (onlinePanel) onlinePanel.classList.toggle('hide');
    };
  }
  if (opClose) {
    opClose.onclick = () => {
      if (onlinePanel) onlinePanel.classList.add('hide');
    };
  }

  const btnNavSettings = document.getElementById('btnNavSettings');
  if (btnNavSettings) btnNavSettings.onclick = () => showHomeView('viewSettings');
  const btnNavFaq = document.getElementById('btnNavFaq');
  if (btnNavFaq) btnNavFaq.onclick = () => showHomeView('viewFaq');
  const btnNavChangelog = document.getElementById('btnNavChangelog');
  if (btnNavChangelog) btnNavChangelog.onclick = () => showHomeView('viewChangelog');
  const btnNavCredits = document.getElementById('btnNavCredits');
  if (btnNavCredits) btnNavCredits.onclick = () => showHomeView('viewCredits');
  const btnNavFeedback = document.getElementById('btnNavFeedback');
  if (btnNavFeedback) btnNavFeedback.onclick = () => showHomeView('viewFeedback');

  const btnBackToMain = document.getElementById('btnBackToMain');
  if (btnBackToMain) btnBackToMain.onclick = () => showHomeView('viewMain');
  const btnBackFromSettings = document.getElementById('btnBackFromSettings');
  if (btnBackFromSettings) btnBackFromSettings.onclick = () => showHomeView('viewMain');
  const btnBackFromFaq = document.getElementById('btnBackFromFaq');
  if (btnBackFromFaq) btnBackFromFaq.onclick = () => showHomeView('viewMain');
  const btnBackFromChangelog = document.getElementById('btnBackFromChangelog');
  if (btnBackFromChangelog) btnBackFromChangelog.onclick = () => showHomeView('viewMain');
  const btnBackFromCredits = document.getElementById('btnBackFromCredits');
  if (btnBackFromCredits) btnBackFromCredits.onclick = () => showHomeView('viewMain');
  const btnBackFromFeedback = document.getElementById('btnBackFromFeedback');
  if (btnBackFromFeedback) btnBackFromFeedback.onclick = () => showHomeView('viewMain');

  let autoAnnEnabled = (()=>{try{return localStorage.getItem('td_auto_ann')!=='0';}catch(e){return true;}})();
  const setAutoAnn = (on, silent) => {
    autoAnnEnabled = on;
    try{localStorage.setItem('td_auto_ann', on ? '1' : '0');}catch(e){}
    const bOff = document.getElementById('btnAutoAnnOff'), bOn = document.getElementById('btnAutoAnnOn');
    if (bOff) bOff.classList.toggle('on', !on);
    if (bOn) bOn.classList.toggle('on', on);
    if (typeof G !== 'undefined' && G) G.autoAnn = on;
    if (!silent && typeof toast === 'function') toast(on ? '🔊 自動次駅放送をONにしました' : '🔇 自動次駅放送をOFFにしました', 'info');
  };
  const bAutoAnnOff = document.getElementById('btnAutoAnnOff'), bAutoAnnOn = document.getElementById('btnAutoAnnOn');
  if (bAutoAnnOff) bAutoAnnOff.onclick = () => setAutoAnn(false);
  if (bAutoAnnOn) bAutoAnnOn.onclick = () => setAutoAnn(true);
  setAutoAnn(autoAnnEnabled, true);

  let mcInvEnabled = (()=>{try{return localStorage.getItem('td_mc_inv')!=='0';}catch(e){return true;}})();
  const setMcInv = (inv, silent) => {
    mcInvEnabled = inv;
    window.__MC_INV = inv;
    try{localStorage.setItem('td_mc_inv', inv ? '1' : '0');}catch(e){}
    const bOff = document.getElementById('btnMcInvOff'), bOn = document.getElementById('btnMcInvOn');
    if (bOff) bOff.classList.toggle('on', !inv);
    if (bOn) bOn.classList.toggle('on', inv);
    const mu = document.getElementById('mcUp'), md = document.getElementById('mcDn');
    if (mu) mu.textContent = inv ? '▲ ブレーキ' : '▲ 加速';
    if (md) md.textContent = inv ? '▼ 加速' : '▼ ブレーキ';
    const kh = document.getElementById('keyHintMc');
    if (kh) kh.innerHTML = '<b style="color:#fff;background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">' + (inv ? '↓ / ↑' : '↑ / ↓') + ' (上下矢印)</b> : 力行 / ブレーキ';
    if (!silent && typeof toast === 'function') toast(inv ? '🎛️ マスコン：↓で力行 / ↑でブレーキ にしました' : '🎛️ マスコン：↑で力行 / ↓でブレーキ にしました', 'info');
  };
  const bMcInvOff = document.getElementById('btnMcInvOff'), bMcInvOn = document.getElementById('btnMcInvOn');
  if (bMcInvOff) bMcInvOff.onclick = () => setMcInv(false);
  if (bMcInvOn) bMcInvOn.onclick = () => setMcInv(true);
  setMcInv(mcInvEnabled, true);

  /* 意見箱フォーム送信（メールアドレス非公開・安全送信） */
  const fbForm = document.getElementById('feedbackForm');
  if (fbForm) {
    fbForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = document.getElementById('fbSubmitBtn');
      const status = document.getElementById('fbStatus');
      const name = document.getElementById('fbName').value.trim() || '名無し運転士';
      const message = document.getElementById('fbMessage').value.trim();
      if (!message) return;

      btn.disabled = true;
      btn.textContent = '送信中...';
      status.style.color = '#38bdf8';
      status.textContent = '送信しています...';

      const nowIso = new Date().toISOString();
      const payload = {
        name: name,
        message: message,
        time: nowIso,
        _subject: '【汐見環状線3D】ご意見箱から新しいメッセージが届きました (' + name + 'さん)'
      };

      // 1. MQTTオンラインブローカーへ即時配信（10ms・確実に作者側へ到達）
      if (typeof ONLINE_CLIENT !== 'undefined' && ONLINE_CLIENT && ONLINE_CLIENT.connected) {
        try {
          ONLINE_CLIENT.publish('shiomi3d/v1/feedback', JSON.stringify(payload), { qos: 1 });
        } catch(e) {}
      }

      // 2. FormSubmit（メール通知）へ非同期送信（UIをフリーズさせないようバックグラウンドで実行）
      try {
        fetch('https://formsubmit.co/ajax/77c0266b3c001f710fb0460bf4ef7d9e', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      } catch(e) {}

      // 3. ユーザーへ即座に送信成功フィードバックを提示
      setTimeout(() => {
        status.style.color = '#22c55e';
        status.textContent = '✨ ご意見を送信しました！作者に届きました。ありがとうございます。';
        document.getElementById('fbMessage').value = '';
        btn.textContent = '送信完了';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '📨 意見を送信する';
        }, 3000);
      }, 350);
    });
  }

  const btnSelectLoop = document.getElementById('btnSelectLoop');
  if (btnSelectLoop) btnSelectLoop.onclick = () => { currentDutyView = 'viewLoop'; showHomeView('viewLoop'); };
  const btnSelectBranch = document.getElementById('btnSelectBranch');
  if (btnSelectBranch) btnSelectBranch.onclick = () => {
    currentDutyView = 'viewBranch';
    showHomeView('viewBranch');
  };

  const btnBackToDutyFromLoop = document.getElementById('btnBackToDutyFromLoop');
  if (btnBackToDutyFromLoop) btnBackToDutyFromLoop.onclick = () => {
    if (IS_ONLINE) showHomeView('viewMain');
    else showHomeView('viewDutySelect');
  };
  const btnBackToDutyFromBranch = document.getElementById('btnBackToDutyFromBranch');
  if (btnBackToDutyFromBranch) btnBackToDutyFromBranch.onclick = () => showHomeView('viewDutySelect');

  /* 路線別カード生成 */
  const contLoop = document.getElementById('cardsLoop');
  const contBranch = document.getElementById('cardsBranch');
  for (const [id, S] of Object.entries(SERVICES)) {
    const b = document.createElement('button');
    b.className = 'card';
    b.style.setProperty('--c', S.col);
    const LS = S.line ? LN[S.line] : null, n = LS ? LS.sts.length : (S.kind === 'pax' || S.kind === 'staff') ? sts.length : stopsOf(sts, S.kind).length;
    if (S.kind === 'staff') continue;
    const isBranch = Boolean(S.branch || S.line);
    const isMinatomi = S.line === 'branch4';
    if (S.kind === 'pax') {
      b.innerHTML = '<div class="no">' + S.short + '</div><h2>' + S.name.replace('　', ' ') + '</h2><p>ホームを歩いて見学。階段から別のホームへ、電車にも乗れます。</p><div class="meta"><span>全' + n + '駅</span><span>歩いて見学</span>' + (isMinatomi ? '<span style="border-color:#f59e0b;color:#f59e0b;">📴 オフライン</span>' : '<span style="border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,0.12);">🌐 常時オンライン</span>') + '</div>';
      b.addEventListener('click', () => {
        currentDutyView = isBranch ? 'viewBranch' : 'viewLoop';
        pickStation(id);
      });
      if (isBranch && contBranch) contBranch.appendChild(b);
      else if (!isBranch && contLoop) contLoop.appendChild(b);
      continue;
    }
    const modeBadge = isMinatomi 
      ? '<span style="border-color:#f59e0b;color:#f59e0b;">📴 オフライン専用</span>'
      : '<span style="border-color:#38bdf8;color:#38bdf8;background:rgba(56,189,248,0.12);">🌐 常時オンライン</span>';
    b.innerHTML = '<div class="no">' + S.short + '</div><h2>' + S.name.replace('　', ' ') + '</h2><p>' + (S.line === 'branch4' ? '港見から奥港まで4駅の単線ローカル線。港前で必ず行き違い。軍港の軍艦や海岸線を眺めて走る、3両の古い電車（路線長16kmのためオフライン専用）。' : S.line === 'branch5' ? '白峰支線の奥峰、紫雲地下線の深雪、天宮高架線の峰月、港見支線の奥港。4つの支線の終点どうしを結ぶ連絡高速線（7駅・複線・各駅停車・全長約71km・最高200km/h）。環状線と各支線終点の位置関係から距離を計算して縮尺を合わせました。' : S.line === 'branch2' ? '紫雲新都から深雪まで15駅。駅間距離1kmで地下を走る複線。' : S.line === 'branch3' ? '天宮から峰月まで40駅。快速は廃止し、各駅停車のみで運転します。' : S.branch ? '白峰〜奥峰の支線（複線・各駅停車）。' : S.kind === 'local' ? '全駅に停車。方向別三複線のいちばん外側を走ります。' : S.kind === 'rapid' ? '主要駅と快速停車駅に停車。外側から2番目の線路を最高120km/hで。' : S.kind === 'exp' ? '汐見駅と主要駅だけに停車。環状線の地下を専用線で走る、全車グリーン車の最速210km/h列車です。' : S.kind === 'test' ? '表示器・信号・閉塞・ホームドアを確認しながら走る試運転列車。各駅停車と同じ駅に停車し、前面・側面の方向幕に「試運転」を掲出します（乗客は乗車しません）。' : S.kind === 'extra' ? 'イベント開催時に運転される臨時列車。快速停車駅に停車し、イベント臨時列車増発・撮り鉄増加の演出で走ります。' : S.kind === 'charter' ? 'イベント時に運転される貸切の団体列車。方向幕に「団体」を掲出し、イベント臨時・団体ダイヤ演出の中で運転します。' : '主要駅と6駅だけに停車。真ん中の線路を最高150km/hで。') + '</p><div class="meta"><span>' + n + '駅</span><span>' + (S.branch ? '片道' : '一周') + ' 約' + fmtDur(timeOf(S)) + '</span>' + modeBadge + '</div>';
    b.addEventListener('click', () => {
      currentDutyView = isBranch ? 'viewBranch' : 'viewLoop';
      pickStation(id);
    });
    if (isBranch && contBranch) contBranch.appendChild(b);
    else if (!isBranch && contLoop) contLoop.appendChild(b);
  }
  /* 乗客モード：駅を選ぶ前に自分の見た目を選ぶ */
  let avFor=null;
  const AVSKIN=['#e8c49a','#e0b894','#d6a87c','#c59468','#f0d3b4'],AVHAIR=['#1d1a18','#2b211c','#3a2b20','#5a4a3a','#8a7a68'],
    AVTOP=[
      0x2f3b52,0x6b3a3a,0x3f5a45,0xc9c2b0,0x23262b,0xf2efe6,0x3a5f8a,0x8a3f5f,0xd9702b,0xe08cb0,0x7a3fa0,0xe8d27a,
      0x1e293b,0x475569,0x94a3b8,0x0f766e,0x15803d,0x0284c7,0x4338ca,0x7e22ce,0xbe123c,0xb45309,0x3f3f46,0x57534e
    ],
    AVBOT=[
      0x2b2d33,0x1b2740,0x5a4a3a,0x3b5b8c,0x6b6f78,0xc4456b,0x2f5a3f,0x7a2b3a,0xf0c8d8,0x9ec7e8,0xf2efe6,0x3a3a42,
      0x1e3a8a,0x2563eb,0x064e3b,0x78350f,0x451a03,0x581c87,0x0f172a,0x334155,0x64748b,0x831843,0x713f12,0x14532d
    ],
    AVSOCK=[0xf4f2ec,0x1b2740,0x2a2a2a,0x8a8f99,0xe08cb0],AVSHOE=[0x2a2a2a,0xc8322b,0x3f63b0,0xf2f2f2,0xe08cb0,0x6b4a2e,0x2f7f5f];
  const SKN=['タイト','プリーツ','ティアード','フレア','チェックのプリーツ','キルト','ジャンパースカート','デニム','チュール','ラップ','サスペンダー付き','キュロット','裾フリル','ボーダー'];
  const hx=c=>'#'+c.toString(16).padStart(6,'0');
  function drawAvPrev(){const c=document.getElementById('avPrev'),x=c.getContext('2d'),A=AVATAR,W2=c.width,H2=c.height;x.clearRect(0,0,W2,H2);
    x.fillStyle='#1a2236';x.fillRect(0,H2-30,W2,30);const hm=A.height/100,sc=(H2-60)/2.0*hm/1.0,cx=W2/2,fy=H2-30,u=v=>fy-v*sc/hm*(hm/1.0)*1;
    const U=v=>fy-v*(H2-60)/2.0;const k=hm/1.7,Y=v=>fy-v*k*(H2-60)/2.0*1.0,Xs=v=>v*k*(H2-60)/2.0;
    const rect=(x0,y0,w,h,col)=>{x.fillStyle=col;x.fillRect(cx+Xs(x0)-Xs(w)/2,Y(y0+h),Xs(w),Xs(h));};
    const shoe=hx(A.shoeC),skin=AVSKIN[A.skin],top=hx(A.top),bot=hx(A.bottomC),hair=AVHAIR[A.hair];
    for(const lx of [-0.085,0.085]){ /* 脚 */
      if(A.bottom==='long'||A.bottom==='jeans'||A.bottom==='wide'||A.bottom==='cargo'){
        const wLeg = (A.bottom==='wide') ? 0.15 : 0.12;
        rect(lx,0.04,wLeg,0.82,bot);
        if(A.bottom==='cargo')rect(lx+(lx>0?0.06:-0.06),0.45,0.045,0.13,bot);
      } else {
        rect(lx,0.04,0.11,0.82,A.sock===4?hx(A.sockC):skin);
        if(A.sock===2||A.sock===3)rect(lx,0.04,0.115,0.36,hx(A.sockC));
        else if(A.sock===1)rect(lx,0.04,0.115,0.1,hx(A.sockC));
        if(A.bottom==='shorts')rect(lx,0.55,0.13,0.32,bot);
      }
      rect(lx,0,0.13,0.06,shoe);
    }
    // 上の服（胴体）
    if(A.topStyle==='coat'){
      rect(0,0.68,0.42,0.74,top);
      rect(0,0.86,0.36,0.56,top);
    } else {
      rect(0,0.86,0.36,0.56,top);
    }
    // 上の服のスタイル別ディテール
    if(A.topStyle==='hoodie'){
      rect(0,1.38,0.26,0.10,top);
      rect(0,0.96,0.24,0.15,top);
      x.strokeStyle='rgba(0,0,0,0.3)';x.lineWidth=1.5;x.strokeRect(cx-Xs(0.12),Y(1.11),Xs(0.24),Xs(0.15));
    } else if(A.topStyle==='jacket'){
      rect(0,1.25,0.14,0.17,'#ffffff');
      rect(0,1.22,0.04,0.18,'#dc2626');
      x.strokeStyle='rgba(0,0,0,0.45)';x.lineWidth=2;
      x.beginPath();x.moveTo(cx-Xs(0.12),Y(1.42));x.lineTo(cx-Xs(0.06),Y(1.22));x.lineTo(cx,Y(1.18));x.stroke();
      x.beginPath();x.moveTo(cx+Xs(0.12),Y(1.42));x.lineTo(cx+Xs(0.06),Y(1.22));x.lineTo(cx,Y(1.18));x.stroke();
    } else if(A.topStyle==='shirt'){
      rect(0,1.39,0.18,0.05,top);
      x.strokeStyle='rgba(255,255,255,0.7)';x.lineWidth=2;
      x.beginPath();x.moveTo(cx,Y(1.42));x.lineTo(cx,Y(0.86));x.stroke();
    } else if(A.topStyle==='sweater'){
      x.strokeStyle='rgba(0,0,0,0.18)';x.lineWidth=1.5;
      for(let yy=0.90;yy<=1.38;yy+=0.08){x.beginPath();x.moveTo(cx-Xs(0.17),Y(yy));x.lineTo(cx+Xs(0.17),Y(yy));x.stroke();}
    } else if(A.topStyle==='cardigan'){
      rect(0,1.20,0.16,0.22,'#f8fafc');
      x.strokeStyle='rgba(0,0,0,0.3)';x.lineWidth=2;
      x.beginPath();x.moveTo(cx-Xs(0.08),Y(1.42));x.lineTo(cx,Y(1.15));x.lineTo(cx+Xs(0.08),Y(1.42));x.stroke();
    }
    for(const sx of [-1,1]){
      const armCol=(A.topStyle==='vest')?'#f8fafc':(A.sleeve==='none'?skin:(A.sleeve==='short'?skin:top));
      rect(sx*0.23,0.86,0.085,0.5,armCol);
      if(A.sleeve==='short')rect(sx*0.23,1.12,0.09,0.24,top);
      else if(A.sleeve==='none')rect(sx*0.23,1.30,0.09,0.08,top);
      rect(sx*0.23,0.8,0.075,0.08,skin);
    }
    if(A.bottom==='skirt'){const t=A.skirtType,L=A.skirtLen*1.0,y0=0.93-L,wT=0.36,wB=(t===0?0.42:t===3||t===8?0.72:t===11?0.56:0.6);
      x.fillStyle=bot;x.beginPath();x.moveTo(cx-Xs(wT)/2,Y(0.95));x.lineTo(cx+Xs(wT)/2,Y(0.95));x.lineTo(cx+Xs(wB)/2,Y(y0));x.lineTo(cx-Xs(wB)/2,Y(y0));x.closePath();x.fill();
      x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1.5;if(t===1||t===4||t===5||t===10){for(let i=-3;i<=3;i++){x.beginPath();x.moveTo(cx+Xs(wT)*i/8,Y(0.95));x.lineTo(cx+Xs(wB)*i/8,Y(y0));x.stroke();}}
      if(t===4||t===5||t===13){x.strokeStyle=t===13?'#f4f2ec':'#15181f';x.lineWidth=3;for(const f of [0.3,0.6,0.85]){const yy=0.95-L*f,ww=wT+(wB-wT)*f;x.beginPath();x.moveTo(cx-Xs(ww)/2,Y(yy));x.lineTo(cx+Xs(ww)/2,Y(yy));x.stroke();}}
      if(t===2||t===12){x.strokeStyle='rgba(255,255,255,.5)';for(const f of [0.4,0.72]){const yy=0.95-L*f,ww=wT+(wB-wT)*f;x.beginPath();x.moveTo(cx-Xs(ww)/2,Y(yy));x.lineTo(cx+Xs(ww)/2,Y(yy));x.stroke();}}
      if(t===6||t===10){x.fillStyle=t===6?bot:'#15181f';for(const sx of [-1,1])x.fillRect(cx+Xs(sx*0.08)-Xs(0.04)/2,Y(1.42),Xs(0.04),Xs(0.5));}}
    else if(A.bottom!=='long'&&A.bottom!=='jeans'&&A.bottom!=='wide'&&A.bottom!=='cargo') rect(0,0.86,0.37,0.12,bot);
    rect(0,1.42,0.1,0.06,skin);x.fillStyle=skin;x.beginPath();x.arc(cx,Y(1.6),Xs(0.12),0,7);x.fill();     /* 首・頭 */
    x.fillStyle=hair;x.beginPath();x.arc(cx,Y(1.63),Xs(0.125),Math.PI,0);x.fill();if(A.hairLong||A.tails)rect(0,1.38,0.27,0.28,hair);if(A.tails)for(const sx of [-1,1]){x.beginPath();x.arc(cx+Xs(sx*0.15),Y(1.55),Xs(0.05),0,7);x.fill();}
    if(A.glasses){x.strokeStyle='#111';x.lineWidth=2;for(const sx of [-1,1]){x.beginPath();x.arc(cx+Xs(sx*0.045),Y(1.6),Xs(0.03),0,7);x.stroke();}}
    if(A.bag===2){x.fillStyle='#3a3f4a';x.fillRect(cx+Xs(0.19),Y(1.35),Xs(0.08),Xs(0.32));}else if(A.bag===1){x.fillStyle='#3a3f4a';x.fillRect(cx+Xs(0.26),Y(0.9),Xs(0.1),Xs(0.18));}else if(A.bag===3){x.fillStyle='#3a3f4a';x.fillRect(cx-Xs(0.3),Y(1.05),Xs(0.1),Xs(0.14));}
    x.fillStyle='#e8f0ff';x.font='700 15px sans-serif';x.textAlign='center';x.fillText(A.height+' cm',cx,H2-10);}
  function buildAvCtl(){const box=document.getElementById('avCtl');box.innerHTML='';const A=AVATAR,save=()=>{try{localStorage.setItem('td_avatar',JSON.stringify(A));}catch(e){}drawAvPrev();};
    const row=t=>{const r=document.createElement('div');r.className='avRow';const l=document.createElement('div');l.className='lb';l.textContent=t;r.appendChild(l);box.appendChild(r);return r;};
    const seg=(t,key,opts,cb)=>{const r=row(t);for(const [v,lab] of opts){const b=document.createElement('button');b.textContent=lab;b.classList.toggle('on',A[key]===v);b.onclick=()=>{A[key]=v;if(cb)cb();save();buildAvCtl();};r.appendChild(b);}};
    const sw=(t,key,cols,css)=>{const r=row(t);cols.forEach((c,i)=>{const b=document.createElement('button');b.className='sw';const v=css?i:c;b.style.background=css?c:hx(c);b.classList.toggle('on',A[key]===v);b.onclick=()=>{A[key]=v;save();buildAvCtl();};r.appendChild(b);});};
    const sl=(t,key,mn,mx,st,fmt)=>{const r=row(t);const i=document.createElement('input');i.type='range';i.min=mn;i.max=mx;i.step=st;i.value=A[key];const v=document.createElement('span');v.className='val';v.textContent=fmt(A[key]);
      i.oninput=()=>{A[key]=+i.value;v.textContent=fmt(A[key]);save();};r.appendChild(i);r.appendChild(v);};
    seg('性別','female',[[false,'男'],[true,'女']]);
    sl('身長','height',100,200,1,v=>v+' cm');
    sw('肌の色','skin',AVSKIN,true);
    seg('髪型','hairLong',[[false,'短い'],[true,'長い']],()=>{if(!A.hairLong)A.tails=false;});
    if(A.female||A.height<145)seg('結び方','tails',[[false,'なし'],[true,'ツインテール']],()=>{if(A.tails)A.hairLong=true;});
    sw('髪の色','hair',AVHAIR,true);
    seg('服の種類（上）','topStyle',[['shirt','ワイシャツ'],['hoodie','パーカー'],['sweater','セーター'],['jacket','ブレザー/スーツ'],['coat','ロングコート'],['cardigan','カーディガン'],['vest','ベスト'],['tshirt','Tシャツ']]);
    seg('上の服の袖','sleeve',[['long','長袖'],['short','半袖'],['none','ノースリーブ']]);
    sw('上の服の色','top',AVTOP);
    seg('服の種類（下）','bottom',[['long','長ズボン'],['jeans','ジーンズ'],['wide','ワイドパンツ'],['cargo','カーゴパンツ'],['shorts','短パン'],['skirt','スカート']]);
    if(A.bottom==='skirt'){const r=row('スカートの種類');SKN.forEach((n,i)=>{const b=document.createElement('button');b.textContent=n;b.classList.toggle('on',A.skirtType===i);b.onclick=()=>{A.skirtType=i;save();buildAvCtl();};r.appendChild(b);});
      sl('スカートの丈','skirtLen',0.2,0.6,0.01,v=>Math.round(v*100)+' cm');}
    sw('下の服の色','bottomC',AVBOT);
    if(A.bottom!=='long'&&A.bottom!=='jeans'&&A.bottom!=='wide'&&A.bottom!=='cargo'){seg('靴下','sock',[[0,'なし'],[1,'くるぶし'],[2,'ハイソックス'],[4,'タイツ']]);if(A.sock)sw('靴下の色','sockC',AVSOCK);}
    sw('靴の色','shoeC',AVSHOE);
    seg('かばん','bag',[[0,'なし'],[1,'手さげ'],[2,'リュック'],[3,'ショルダー']]);
    seg('眼鏡','glasses',[[false,'なし'],[true,'あり']]);
    drawAvPrev();}
  let crewFor=null,avFromCrew=false;
  document.getElementById('avGo').addEventListener('click',()=>{document.getElementById('avSel').classList.add('hide');if(avFor)pickStationGo(avFor);});
  document.getElementById('avBack').addEventListener('click',()=>{
    document.getElementById('avSel').classList.add('hide');
    if(avFromCrew){avFromCrew=false;document.getElementById('crewSel').classList.remove('hide');return;}
    document.getElementById('home').classList.remove('hide');showHomeView(currentDutyView);
  });
  /* 快速特急・各駅停車：開始駅を選ぶ前に乗務（ワンマン／ツーマン運転士／ツーマン車掌）を選ぶ */
  function pickStation(id){const S=SERVICES[id];avFromCrew=false;
    if(S.kind==='pax'){avFor=id;document.getElementById('home').classList.add('hide');buildAvCtl();document.getElementById('avSel').classList.remove('hide');return;}
    if(S.kind==='ltd'||S.kind==='local'||S.line==='branch3'){crewFor=id;document.getElementById('home').classList.add('hide');document.getElementById('crewSelTitle').textContent=S.name.replace('　',' ');
      for(const b of document.querySelectorAll('#crewGrid button'))b.classList.toggle('on',b.dataset.c===CREWSEL);document.getElementById('crewSel').classList.remove('hide');return;}
    pickStationGo(id);}
  for(const b of document.querySelectorAll('#crewGrid button'))b.addEventListener('click',()=>{CREWSEL=b.dataset.c;try{localStorage.setItem('td_crew',CREWSEL);}catch(e){}
    document.getElementById('crewSel').classList.add('hide');
    if(CREWSEL==='twoC'&&crewFor){avFor=crewFor;avFromCrew=true;buildAvCtl();document.getElementById('avSel').classList.remove('hide');return;}
    if(crewFor)pickStationGo(crewFor);});
  document.getElementById('crewBack').addEventListener('click',()=>{document.getElementById('crewSel').classList.add('hide');document.getElementById('home').classList.remove('hide');showHomeView(currentDutyView);});
  function pickStationGo(id){
    const S=SERVICES[id];
    const isMinatomi = (S.line === 'branch4');
    const isOnlineSvc = !isMinatomi && S.kind !== 'pax' && S.kind !== 'staff'; // 港見支線・乗客・駅員以外は他列車から1km以上離して開始
    curOnlineStList = null;
    curOnlineService = S;
    document.getElementById('home').classList.add('hide');
    document.getElementById('stSel').classList.remove('hide');
    document.getElementById('stSelTitle').textContent=S.name.replace('　',' ')+((S.kind==='ltd'||S.kind==='local'||S.line==='branch3')?'（'+({one:'ワンマン',twoD:'ツーマン・運転士',twoC:'ツーマン・車掌'})[CREWSEL]+'）':'') + (!isMinatomi ? ' [🌐 リアルタイム常時オンライン]' : ' [📴 オフライン専用]');
    document.getElementById('stSelSub').textContent=(S.kind==='pax'||S.kind==='staff') ? '【乗客・駅員モード】どの駅でも選べます（他プレイヤーがいる駅にもそのまま行けます）' : (isOnlineSvc ? '【リアルタイム常時オンライン】他列車から1km以上離れた駅を選択してください' : '【オフライン専用】港見支線は短距離ローカル線（16km・4駅）のためオフライン運行です。開始駅を選択してください');
    const g=document.getElementById('stGrid');g.innerHTML='';const L2=S.line?LN[S.line].sts:null;const L3=S.rapid?L2.filter(st=>LN[S.line].cfg.rapidStops.includes(st.i)):S.line==='branch4'?(S.dir>0?[L2[0],L2[0]]:[L2[L2.length-1],L2[L2.length-1]]):L2;
    const list=(S.kind==='pax'||S.kind==='staff')?(L2||sts):S.branch?(S.dir>0?L3.slice(0,-1):L3.slice(1).reverse()):stopsOf(sts,S.kind);
    curOnlineStList = list;
    if (!window.__stSelPoll) {
      window.__stSelPoll = setInterval(() => {
        if (typeof updateStationSelectButtons === 'function') updateStationSelectButtons();
      }, 1500);
    }
    for(const st of list){
      const bt=document.createElement('button');
      if(st.cls==='M')bt.className='big';
      const blocked = isOnlineSvc ? checkOnlineStationBlocked(st, S.key, S.line || 'loop') : null;
      if (blocked) {
        bt.disabled = true;
        bt.style.opacity = '0.45';
        bt.style.cursor = 'not-allowed';
        bt.style.borderColor = '#ef4444';
        bt.innerHTML = st.name + '<small style="color:#ef4444;font-weight:700;">⛔ ' + blocked.name + '接近中 (' + blocked.dist + 'm)</small>';
      } else {
        bt.innerHTML=st.name+'<small>'+({M:'主要駅',X:'快特停車',R:'快速停車',L:'',J:'乗換駅',Q:'2面4線',T:'通過線',I:'島式'}[st.cls]||'')+'</small>';
      }
      bt.addEventListener('click',()=>{
        if (isOnlineSvc) {
          const freshBlocked = checkOnlineStationBlocked(st, S.key, S.line || 'loop');
          if (freshBlocked) {
            toast('他列車（' + freshBlocked.name + 'さん）が1km以内に接近したため選択できません', 'warn');
            updateStationSelectButtons();
            return;
          }
        }
        const launchSelectedStation = () => {
          unlockMedia(S.kind==='pax'||S.kind==='staff');
          document.getElementById('stSel').classList.add('hide');
          document.getElementById('loading').classList.remove('hide');
          setTimeout(()=>{
            try{
              boot(S.line||'loop',id,st.i);
              document.getElementById('loading').classList.add('hide');
            }catch(err){
              console.error(err);
              const ld=document.getElementById('loading');
              ld.style.flexDirection='column';
              ld.style.padding='20px';
              ld.style.textAlign='center';
              ld.textContent='読み込み中にエラーが発生しました：'+(err&&err.message||err);
            }
          },60);
        };
        if (S.kind === 'pax' || S.kind === 'staff') {
          window.__TROUBLE_MODE = false;
          launchSelectedStation();
        } else {
          const tm = document.getElementById('troubleConfirmModal');
          const bOff = document.getElementById('btnTroubleOff');
          const bOn = document.getElementById('btnTroubleOn');
          if (tm && bOff && bOn) {
            /* 天候・ダイヤは自動（今日の日付から決定）。ここではトラブル発生モードだけを聞く */
            if (typeof refreshDailyCond === 'function') refreshDailyCond();
            tm.classList.remove('hide');
            bOff.onclick = () => { tm.classList.add('hide'); window.__TROUBLE_MODE = false; launchSelectedStation(); };
            bOn.onclick = () => { tm.classList.add('hide'); window.__TROUBLE_MODE = true; launchSelectedStation(); };
          } else {
            window.__TROUBLE_MODE = false;
            launchSelectedStation();
          }
        }
      });
      g.appendChild(bt);
    }
  }
  {const QD={
      extreme:'最軽量：さらに負荷を抑えた極限モード。解像度・ホームカメラ・遠景描画を最小限に絞り、古い端末でも最大限軽く動かします。',
      ultralight:'超軽量：低スペック端末向け。描画解像度と遠景負荷を極限まで抑えてサクサク動かします。機能や音、演出は一切削りません。',
      light:'軽い：重いときは自動で描く細かさを下げ、見えない物（カメラの後ろ・霧の向こう）を描かずにさくさく動かします。低スペックのパソコンやスマホ向け。',
      normal:'普通：描く細かさを固定して、すべてを毎回描きます（前のバージョンと同じ）。',
      heavy:'重い：最高画質。高解像度で描き、ホームカメラの映像も高精細・毎フレーム更新、車内の乗客も遠くまで表示します。高性能な端末向け。'};
    const row=document.getElementById('qualRow'),upd=()=>{for(const b of row.querySelectorAll('button[data-q]'))b.classList.toggle('on',b.dataset.q===QMODE);document.getElementById('qualDesc').textContent=QD[QMODE];};
    const sh=document.getElementById('qualSheet'),upd2=()=>{for(const b of sh.querySelectorAll('.qbtns button[data-q]'))b.classList.toggle('on',b.dataset.q===QMODE);document.getElementById('qualDesc2').textContent=QD[QMODE]+(window.__applyQ?'（すぐに切り替わります）':'');};
    const setQ=m=>{QMODE=m;try{localStorage.setItem('td_quality',QMODE);}catch(e){}upd();upd2();if(window.__applyQ)window.__applyQ();};
    for(const b of row.querySelectorAll('button[data-q]'))b.addEventListener('click',()=>setQ(b.dataset.q));
    for(const b of sh.querySelectorAll('.qbtns button[data-q]'))b.addEventListener('click',()=>setQ(b.dataset.q));
    const btnRel1 = document.getElementById('btnReloadOtherTrains');
    if (btnRel1) btnRel1.addEventListener('click', () => { if (window.__reloadOtherTrains) window.__reloadOtherTrains(); });
    const btnRel2 = document.getElementById('btnReloadOtherTrainsSheet');
    if (btnRel2) btnRel2.addEventListener('click', () => { if (window.__reloadOtherTrains) window.__reloadOtherTrains(); });
    document.getElementById('qualFab').addEventListener('click',e=>{e.stopPropagation();upd2();sh.classList.remove('hide');});
    document.getElementById('qualClose').addEventListener('click',()=>sh.classList.add('hide'));sh.addEventListener('click',e=>{if(e.target===sh)sh.classList.add('hide');});
    for(const ev of ['pointerdown','touchstart'])sh.addEventListener(ev,e=>e.stopPropagation(),{passive:true});
    upd();

    // オンラインチャット（自由入力＆定型文）
    const btnChatFab = document.getElementById('btnChatFab');
    const chatTray = document.getElementById('chatTray');
    const btnChatClose = document.getElementById('btnChatClose');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    if (btnChatFab && chatTray) {
      btnChatFab.addEventListener('click', (e) => {
        e.stopPropagation();
        chatTray.classList.toggle('hide');
      });
    }
    // 運転士用タブレット＆総合指令所（パスワード 291129）
    let dispatchManualUntil = 0;
    let dispatchHB = null;
    let dispSelectedId = null;
    let dtUnreadCount = 0;
    const playDispatchChime = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!window.__DISP_AC) window.__DISP_AC = new Ctx();
        const ac = window.__DISP_AC;
        if (ac.state === 'suspended') ac.resume().catch(()=>{});
        const now = ac.currentTime;
        [[880, 0, 0.14], [1318.5, 0.11, 0.35]].forEach(([freq, off, dur]) => {
          const osc = ac.createOscillator(), g = ac.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + off);
          g.gain.setValueAtTime(0.001, now + off);
          g.gain.exponentialRampToValueAtTime(0.24, now + off + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + off + dur);
          osc.connect(g); g.connect(ac.destination);
          osc.start(now + off); osc.stop(now + off + dur + 0.02);
        });
      } catch(e) {}
    };
    const updateDtUnreadBadge = () => {
      const b = document.getElementById('dtUnreadBadge');
      if (!b) return;
      if (dtUnreadCount > 0) {
        b.textContent = String(dtUnreadCount);
        b.classList.remove('hide');
      } else {
        b.classList.add('hide');
      }
    };
    const showToast = (m, t) => { try { if (typeof window.toast === 'function') window.toast(m, t); } catch(e) {} };
    const isDispatchManual = () => Date.now() < dispatchManualUntil;
    const updateDispatchBadges = () => {
      const b = document.getElementById('dtDispatchBadge');
      if (b) {
        if (isDispatchManual()) {
          b.textContent = '🟢 指令：製作者が手動対応中';
          b.style.color = '#4ade80';
        } else {
          b.textContent = '🤖 指令：自動対応中';
          b.style.color = '#94a3b8';
        }
      }
    };
    setInterval(updateDispatchBadges, 2000);
    const dispatchThreads = {};
    const dispatchUnread = {};
    const renderDispatchThread = (pid) => {
      const el = document.getElementById('dispLog');
      if (!el) return;
      el.innerHTML = '';
      if (!pid) {
        el.innerHTML = '<div style="color:#94a3b8;">列車を選ぶと、その列車との1対1個別チャットが表示されます。</div>';
        return;
      }
      const list = dispatchThreads[pid] || [];
      if (!list.length) {
        el.innerHTML = '<div style="color:#94a3b8;">この列車との個別チャットはまだありません。</div>';
        return;
      }
      for (const item of list) {
        el.insertAdjacentHTML('beforeend', item.html);
      }
      el.scrollTop = el.scrollHeight;
    };
    const appendDispatchThreadLog = (pid, who, text, kind) => {
      if (!pid) return;
      const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const html = `<div><span style="color:#64748b;font-size:10.5px;">[${timeStr}]</span> <b style="color:${kind==='disp'?'#fbbf24':kind==='sys'?'#34d399':'#38bdf8'};">${who}:</b> <span>${String(text).replace(/</g,'&lt;')}</span></div>`;
      if (!dispatchThreads[pid]) dispatchThreads[pid] = [];
      dispatchThreads[pid].push({ html });
      if (dispatchThreads[pid].length > 60) dispatchThreads[pid].shift();
      if (dispSelectedId === pid) renderDispatchThread(pid);
      else dispatchUnread[pid] = (dispatchUnread[pid] || 0) + 1;
    };
    const appendDispatchLog = (who, text, kind) => {
      const timeStr = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const html = `<div><span style="color:#64748b;font-size:10.5px;">[${timeStr}]</span> <b style="color:${kind==='disp'?'#fbbf24':kind==='sys'?'#34d399':'#38bdf8'};">${who}:</b> <span>${String(text).replace(/</g,'&lt;')}</span></div>`;
      const el = document.getElementById('dtLog');
      if (el) {
        el.insertAdjacentHTML('beforeend', html);
        while (el.children.length > 50) el.removeChild(el.firstChild);
        el.scrollTop = el.scrollHeight;
      }
    };
    const executeLocalTrainCmd = (cmd, byWho, extra) => {
      const T = window.__T;
      if (!T || !T.G || T.G.phase !== 'play' || window.__PAX) return;
      const g = T.G;
      const isFromDispatch = (byWho === '製作者指令' || byWho === '自動指令');
      if (cmd === 'trouble') {
        const reason = (extra && extra.reason) || '踏切支障検知装置が作動しました。直ちに安全確認を行ってください。';
        g.troubleActive = true;
        g.troubleReason = reason;
        g.dispatchHold = true;
        g.ato = false;
        g.auto = false;
        const tb = document.getElementById('dtTroubleBanner');
        const tt = document.getElementById('dtTroubleText');
        if (tb && tt) {
          tt.textContent = reason;
          tb.classList.remove('hide');
        }
        const dtm = document.getElementById('driverTabletModal');
        if (dtm) {
          updateDispatchBadges();
          dtm.classList.remove('hide');
          dtUnreadCount = 0;
          updateDtUnreadBadge();
        }
        if (typeof T.drawPanel === 'function') T.drawPanel();
        if (typeof window.__spawnTroubleVisual === 'function') window.__spawnTroubleVisual(reason);
        playDispatchChime();
        showToast('🚨 ' + reason, 'warn');
        appendDispatchLog('🚨 異常検知', reason + '（指令の許可があるまで運転再開できません）', 'sys');
        publishDispatchMsg({ from: 'driver', id: ONLINE_CLIENT_ID, name: MY_PLAYER_NAME, text: '🚨 【自動通報】' + reason });
        return;
      }
      if (g.troubleActive && !isFromDispatch && (cmd === 'resume' || cmd === 'prevStation' || cmd === 'nextStation')) {
        showToast('⚠️ トラブル対応中は司令の許可なしに運転再開できません', 'warn');
        appendDispatchLog('システム', '⚠️ 司令の許可が出るまで運転再開できません。指令室へ連絡してください。', 'sys');
        return;
      }
      if (cmd === 'stop') {
        g.dispatchHold = true;
        g.ato = false;
        g.auto = false;
        if (typeof T.drawPanel === 'function') T.drawPanel();
        showToast('🛑 ' + (byWho || '指令') + '：緊急停止しました', 'warn');
        appendDispatchLog('システム', '列車を緊急停止しました（運転再開まで停車保持）', 'sys');
      } else if (cmd === 'resume') {
        g.troubleActive = false;
        g.troubleReason = null;
        const tb = document.getElementById('dtTroubleBanner');
        if (tb) tb.classList.add('hide');
        if (typeof window.__clearTroubleVisual === 'function') window.__clearTroubleVisual();
        g.dispatchHold = false;
        g.slowMode = null;
        g.slowMaxV = null;
        g.notch = 0;
        g.mnotch = 0;
        if (typeof T.drawPanel === 'function') T.drawPanel();
        showToast('▶️ ' + (byWho || '指令') + '：通常運転を再開しました', 'ok');
        appendDispatchLog('システム', '停止・徐行を解除し通常運転を再開しました', 'sys');
      } else if (cmd === 'prevStation') {
        g.troubleActive = false;
        g.troubleReason = null;
        const tb = document.getElementById('dtTroubleBanner');
        if (tb) tb.classList.add('hide');
        if (typeof window.__clearTroubleVisual === 'function') window.__clearTroubleVisual();
        g.dispatchHold = false;
        g.slowMode = 'prev';
        g.slowMaxV = 20 / 3.6;
        let prevIdx = 0;
        if (g.list && g.list.length) prevIdx = g.list[Math.max(0, g.nv - 1)];
        else if (g.cyc && g.cyc.length) prevIdx = g.cyc[((g.cpos - 1) % g.cyc.length + g.cyc.length) % g.cyc.length];
        const targetSt = T.STATIONS[prevIdx];
        if (targetSt && T.TK && T.TK[g.key]) {
          g.slowPrevTargetS = targetSt.s + T.TK[g.key].so;
        }
        g.atStation = null;
        if (g.door && g.door.state !== 'closed' && typeof T.startClosing === 'function') T.startClosing();
        if (typeof T.drawPanel === 'function') T.drawPanel();
        const msg = '⏮️ ' + (targetSt ? targetSt.name + '駅（一駅前）' : '一駅前') + 'まで退行徐行運転（上限20km/h）が許可されました';
        showToast(msg, 'warn');
        appendDispatchLog('システム', msg, 'sys');
      } else if (cmd === 'nextStation') {
        g.troubleActive = false;
        g.troubleReason = null;
        const tb = document.getElementById('dtTroubleBanner');
        if (tb) tb.classList.add('hide');
        if (typeof window.__clearTroubleVisual === 'function') window.__clearTroubleVisual();
        g.dispatchHold = false;
        g.slowMode = 'next';
        g.slowMaxV = 25 / 3.6;
        g.slowDeparted = (g.atStation === null);
        if (g.door && g.door.state !== 'closed' && typeof T.startClosing === 'function') T.startClosing();
        if (typeof T.drawPanel === 'function') T.drawPanel();
        const nextSt = T.stOf(g.nv);
        const msg = '⏭️ ' + (nextSt ? nextSt.name + '駅（次の駅）' : '次の駅') + 'まで徐行運転（上限25km/h）で運転再開が許可されました';
        showToast(msg, 'ok');
        appendDispatchLog('システム', msg, 'sys');
      }
    };
    const NATURAL_TROUBLES = [
      '踏切支障検知装置が作動しました。直ちに安全確認を行ってください。',
      '沿線火災（発煙）の通報が入りました。指令の指示を待ってください。',
      '先行列車で車両点検（ドア故障）が発生しています。',
      '信号保安システム（ATC/ATS）に一時異常を検知しました。',
      '線路内人立ち入りの通報がありました。安全確認が完了するまで停車してください。',
      '強風規制（運転見合わせ基準）に達しました。'
    ];
    /* 自然トラブルの間隔：乗務開始から1〜9.5分のあいだに1回。その後は30分以上あけない */
    const TRBL_FIRST_FROM = 60, TRBL_FIRST_TO = 570, TRBL_COOLDOWN = 1800;
    let trblTripAt = 0, trblNextAt = 0, trblFired = 0;
    setInterval(() => {
      const T = window.__T;
      if (!window.__TROUBLE_MODE || !T || !T.G || T.G.phase !== 'play' || window.__PAX) {
        trblTripAt = 0; trblNextAt = 0; trblFired = 0;
        return;
      }
      const g = T.G, now = Date.now();
      if (!trblTripAt) { /* 乗務を始めた瞬間：1回目のタイミングを決める */
        trblTripAt = now;
        trblNextAt = now + (TRBL_FIRST_FROM + Math.random() * (TRBL_FIRST_TO - TRBL_FIRST_FROM)) * 1000;
        trblFired = 0;
        return;
      }
      if (g.troubleActive) return;
      if (g.v < 3) return;
      if (now < trblNextAt) return;
      trblFired++;
      trblNextAt = now + (TRBL_COOLDOWN + Math.random() * 300) * 1000; /* 次は30分以上あと */
      const reason = NATURAL_TROUBLES[Math.floor(Math.random() * NATURAL_TROUBLES.length)];
      executeLocalTrainCmd('trouble', 'システム', { reason });
    }, 3000);
    const sendDispatchAutoReply = (text) => {
      if (isDispatchManual()) return;
      setTimeout(() => {
        if (isDispatchManual()) return;
        const T = window.__T;
        const inTrouble = !!(T && T.G && T.G.troubleActive);
        let reply = '総合指令（自動対応）です。了解しました。安全を確認のうえ運転を継続してください。';
        if (inTrouble && /再開|確認|許可|報告|解除|異常|対応/.test(text)) {
          reply = '総合指令（自動対応）です。現地の安全確認完了を了解しました。通常運転の再開を許可します。';
          appendDispatchLog('🤖 自動指令', reply, 'disp');
          playDispatchChime();
          executeLocalTrainCmd('resume', '自動指令');
          return;
        }
        if (/緊急|停止|止ま/.test(text)) reply = '総合指令（自動対応）です。緊急停止を確認しました。安全確認後、再開要請を送信してください。';
        else if (/再開/.test(text)) reply = '総合指令（自動対応）です。進路開通を確認しました。運転再開を許可します。';
        else if (/一駅前|戻/.test(text)) reply = '総合指令（自動対応）です。一駅前への退行徐行運転を了解しました。';
        else if (/一駅先|進/.test(text)) reply = '総合指令（自動対応）です。次の駅までの徐行運転再開を許可します。';
        appendDispatchLog('🤖 自動指令', reply, 'disp');
        playDispatchChime();
        const dtm = document.getElementById('driverTabletModal');
        if (dtm && dtm.classList.contains('hide')) { dtUnreadCount++; updateDtUnreadBadge(); }
      }, 800);
    };
    const handleAiRadio = (msg) => {
      const T = window.__T;
      if (!T || !T.OT || !T.G || T.G.phase !== 'play') return false;
      if (!/AI|先発|譲|退避|先に行|先に発車/.test(msg)) return false;
      const g = T.G, L = (T.CFG && T.CFG.L) || 72000;
      let best = null, bd = 1e9;
      for (const a of T.OT) {
        if (!a || a.state === 'off' || a.key !== g.key) continue;
        const d = Math.abs(((a.s - g.s + L * 1.5) % L) - L * 0.5);
        if (d < 800 && d < bd) { bd = d; best = a; }
      }
      if (!best) {
        setTimeout(() => appendDispatchLog('📻 AI列車無線', '現在付近（800m以内）に同じ路線のAI列車はいません。', 'sys'), 350);
        return true;
      }
      if (/譲|退避|先に行/.test(msg)) {
        best.yieldToPlayer = false;
        best.forceDep = true;
        if (best.state === 'dwell' && best.t > 5) best.t = 5;
        if (ONLINE_CLIENT && ONLINE_CLIENT.connected) try { ONLINE_CLIENT.publish('shiomi3d/v1/ai/cmd', JSON.stringify({ name: best.name, cmd: 'forceDep' }), { qos: 0 }); } catch(e) {}
        setTimeout(() => {
          appendDispatchLog('📻 AI(' + best.name + ')', '了解しました。当列車が先に発車します。貴列車はそのまま退避をお願いします。', 'sys');
          playDispatchChime();
        }, 450);
      } else {
        best.forceDep = false;
        best.yieldToPlayer = true;
        if (ONLINE_CLIENT && ONLINE_CLIENT.connected) try { ONLINE_CLIENT.publish('shiomi3d/v1/ai/cmd', JSON.stringify({ name: best.name, cmd: 'yield' }), { qos: 0 }); } catch(e) {}
        setTimeout(() => {
          appendDispatchLog('📻 AI(' + best.name + ')', '了解しました。貴列車を先にお通しします。発車までホームで待機します。', 'sys');
          playDispatchChime();
        }, 450);
      }
      return true;
    };
    window.handleDispatchPacket = (topic, dp) => {
      if (topic === 'shiomi3d/v1/dispatch/status') {
        if (dp.active) dispatchManualUntil = Date.now() + 10000;
        else dispatchManualUntil = 0;
        updateDispatchBadges();
        return;
      }
      if (topic === 'shiomi3d/v1/dispatch/msg') {
        if (dp.from === 'dispatch') {
          const isMe = (dp.targetId && dp.targetId === ONLINE_CLIENT_ID) || (dp.targetName && dp.targetName === MY_PLAYER_NAME);
          if (isMe) {
            if (dp.cmd === 'trouble') {
              executeLocalTrainCmd('trouble', 'システム', { reason: dp.reason });
              return;
            }
            if (dp.text) {
              appendDispatchLog('📡 製作者指令', dp.text, 'disp');
              playDispatchChime();
              const dtm = document.getElementById('driverTabletModal');
              if (dtm && dtm.classList.contains('hide')) {
                dtUnreadCount++;
                updateDtUnreadBadge();
              }
            }
            if (dp.cmd) {
              executeLocalTrainCmd(dp.cmd, '製作者指令');
            }
          }
        } else if (dp.from === 'driver') {
          const vd = document.getElementById('viewDispatch');
          if (vd && !vd.classList.contains('hide') && dp.id) {
            appendDispatchThreadLog(dp.id, dp.name || '運転士', dp.text || ('[' + dp.cmd + ']'), 'drv');
            playDispatchChime();
          }
        }
      }
    };
    const publishDispatchMsg = (obj) => {
      if (ONLINE_CLIENT && ONLINE_CLIENT.connected) {
        try { ONLINE_CLIENT.publish('shiomi3d/v1/dispatch/msg', JSON.stringify(obj), { qos: 0 }); return true; } catch(e) {}
      }
      if (typeof showToast === 'function') showToast('⚠️ オンライン未接続のため送信できませんでした', 'warn');
      return false;
    };
    const btnDriverTablet = document.getElementById('btnDriverTablet');
    const driverTabletModal = document.getElementById('driverTabletModal');
    const dtClose = document.getElementById('dtClose');
    if (btnDriverTablet && driverTabletModal) {
      btnDriverTablet.addEventListener('click', (e) => {
        e.stopPropagation();
        updateDispatchBadges();
        dtUnreadCount = 0;
        updateDtUnreadBadge();
        driverTabletModal.classList.remove('hide');
      });
    }
    if (dtClose && driverTabletModal) {
      dtClose.addEventListener('click', () => driverTabletModal.classList.add('hide'));
    }
    const bindHoldBtn = (id, kind) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('pointerdown', e => {
        e.stopPropagation();
        try { if (b.setPointerCapture && e.pointerId != null) b.setPointerCapture(e.pointerId); } catch(_){}
        startHoldHorn(kind);
      });
      b.addEventListener('pointerup', e => { e.stopPropagation(); stopHoldHorn(); });
      b.addEventListener('pointercancel', e => { e.stopPropagation(); stopHoldHorn(); });
      b.addEventListener('click', e => { e.stopPropagation(); if (AC && AC.state !== 'running') { try { AC.resume(); } catch(_){} } });
    };
    bindHoldBtn('dtHornElec', 'elec');
    bindHoldBtn('dtHornAir', 'air');
    bindHoldBtn('dtHornBoth', 'both');
    const bMH1 = document.getElementById('dtMHorn1');
    if (bMH1) bMH1.addEventListener('click', () => { if (window.__CUR_LINE_ID === 'branch2') return; musicHorn(); if (typeof G !== 'undefined') G.mhornT = nowMs(); });
    const bMH2 = document.getElementById('dtMHorn2');
    if (bMH2) bMH2.addEventListener('click', () => { if (window.__CUR_LINE_ID === 'branch2') return; musicHorn2(); if (typeof G !== 'undefined') G.mhornT = nowMs(); });
    const bindDtCmd = (id, cmd, label) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => {
        executeLocalTrainCmd(cmd, 'タブレット');
        publishDispatchMsg({ from: 'driver', id: ONLINE_CLIENT_ID, name: MY_PLAYER_NAME, cmd, text: label });
      });
    };
    bindDtCmd('dtBtnStop', 'stop', '緊急停止を実行しました');
    bindDtCmd('dtBtnResume', 'resume', '運転再開を実行しました');
    bindDtCmd('dtBtnPrev', 'prevStation', '一駅前まで戻りました');
    bindDtCmd('dtBtnNext', 'nextStation', '一駅先まで運転再開しました');
    document.querySelectorAll('.dt-quick').forEach(b => {
      b.addEventListener('click', () => {
        const msg = b.dataset.msg;
        if (!msg) return;
        appendDispatchLog(MY_PLAYER_NAME, msg, 'drv');
        if (handleAiRadio(msg)) return;
        publishDispatchMsg({ from: 'driver', id: ONLINE_CLIENT_ID, name: MY_PLAYER_NAME, text: msg });
        sendDispatchAutoReply(msg);
      });
    });
    const dtForm = document.getElementById('dtForm');
    const dtInput = document.getElementById('dtInput');
    if (dtForm && dtInput) {
      dtForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = dtInput.value.trim();
        if (!msg) return;
        dtInput.value = '';
        appendDispatchLog(MY_PLAYER_NAME, msg, 'drv');
        if (handleAiRadio(msg)) return;
        publishDispatchMsg({ from: 'driver', id: ONLINE_CLIENT_ID, name: MY_PLAYER_NAME, text: msg });
        sendDispatchAutoReply(msg);
      });
    }
    const viewDispatch = document.getElementById('viewDispatch');
    const btnBackFromDispatch = document.getElementById('btnBackFromDispatch');
    const dispDriversList = document.getElementById('dispDriversList');
    const dispTargetLabel = document.getElementById('dispTargetLabel');
    const dispMapCanvas = document.getElementById('dispMapCanvas');
    const dispHitBoxes = [];
    const tidLineTabsEl = document.getElementById('tidLineTabs');
    const tidBoardInfoEl = document.getElementById('tidBoardInfo');
    const tidStripEl = document.getElementById('tidStationStrip');
    const tidStripInfoEl = document.getElementById('tidStripInfo');
    const tidTrainCountEl = document.getElementById('tidTrainCount');
    const tidClockEl = document.getElementById('tidClock');
    const tidAlarmEl = document.getElementById('tidAlarm');
    const tidLampEl = document.getElementById('tidLamp');

    /* ===== v1.9.7 総合指令所：本線＋支線4路線を監視・操作 ===== */
    const DISP_LINES = [
      { id:'loop',    name:'汐見環状線', short:'本線', col:'#14935f', loop:true },
      { id:'branch',  name:'白峰支線',   short:'白峰', col:'#5aa832' },
      { id:'branch2', name:'紫雲地下線', short:'紫雲', col:'#7a3fa0' },
      { id:'branch3', name:'天宮高架線', short:'天宮', col:'#2aa6d8' },
      { id:'branch4', name:'港見支線',   short:'港見', col:'#2a5caa', single:true },
      { id:'branch5', name:'四嶺連絡高速線', short:'四嶺', col:'#6b7f3a' }
    ];
    let dispLineId = 'loop';
    const dispLineById = id => DISP_LINES.find(l => l.id === id) || DISP_LINES[0];
    const sdm = (a,b,L) => { let d = ((b-a+L/2) % L + L) % L; return d - L/2; };
    const DISP_SIM = {};
    function dispSimOf(id){
      if (DISP_SIM[id]) return DISP_SIM[id];
      let cfg, sts;
      try { cfg = lineConfig(id); sts = layoutStations(cfg); } catch(e) { return null; }
      const L = cfg.L;
      const n = id === 'branch4' ? 2 : id === 'branch' ? 4 : id === 'branch2' ? 6 : 8;
      const cars = cfg.ncar || 6;
      const trains = [];
      for (let i = 0; i < n; i++){
        const dir = (i % 2) ? -1 : 1;
        trains.push({ id:'sim:'+id+':'+i, idx:i, dir, s: (((cfg.s0||2000) + Math.round(L*i/n)) % L), v: 9+((i*3)%7), state:'run', t:0, delay:0, hold:false, trouble:false, stSt:null, cars });
      }
      DISP_SIM[id] = { cfg, sts, L, trains, last:0, single:!!(dispLineById(id).single) };
      return DISP_SIM[id];
    }
    function dispSimName(id,i){
      const def = dispLineById(id);
      if (id === 'branch')  return '白峰' + (101 + i*2);
      if (id === 'branch2') return '紫雲' + (201 + i*2);
      if (id === 'branch3') return '天宮' + (301 + i*2);
      if (id === 'branch4') return '港見' + (i + 1);
      if (id === 'branch5') return '四嶺' + (201 + i*2);
      return def.short + (i + 1);
    }
    function dispNextSt(D, t){
      let best = null, bd = 1e9;
      for (const st of D.sts){ const d = t.dir * sdm(t.s, st.s, D.L); if (d > 1 && d < bd){ bd = d; best = st; } }
      return best ? { st:best, d:bd } : null;
    }
    /* 単線（港見支線）：これから入る区間に反対列車がいれば駅で待つ（行き違い） */
    function dispSecBusy(D, t, fromSt, toSt){
      const len = Math.abs(sdm(fromSt.s, toSt.s, D.L));
      for (const o of D.trains){
        if (o === t || o.dir === t.dir) continue;
        const d0 = Math.abs(t.dir * sdm(fromSt.s, o.s, D.L));
        if (d0 > 2 && d0 < len - 2) return true;
      }
      return false;
    }
    function dispSimStep(){
      const now = Date.now();
      for (const id in DISP_SIM){
        const D = DISP_SIM[id];
        const dt = D.last ? Math.min(1.2, (now - D.last) / 1000) : 0.5; D.last = now;
        for (const t of D.trains){
          if (t.hold || t.trouble){ t.v = Math.max(0, t.v - 3*dt); t.s = ((t.s + t.dir*t.v*dt) % D.L + D.L) % D.L; if (t.v < 0.05) t.state = 'dwell'; continue; }
          if (t.state === 'dwell'){
            t.t -= dt;
            if (t.t <= 0){
              const nx0 = dispNextSt(D, t);
              if (D.single && nx0 && t.stSt && dispSecBusy(D, t, t.stSt, nx0.st)){ t.t = 8; continue; }  /* 行き違い待ち */
              t.state = 'run'; t.v = 0; t.stSt = null;
            }
            continue;
          }
          const nx = dispNextSt(D, t);
          const vmax = D.single ? 12 : 16;
          t.v = Math.min(vmax, t.v + 0.9*dt);
          if (nx){ const brake = Math.sqrt(2*0.55*Math.max(nx.d - 5, 0)); if (t.v > brake) t.v = Math.max(0, brake); }
          t.s = ((t.s + t.dir*t.v*dt) % D.L + D.L) % D.L;
          if (nx && nx.d < 5 && t.v < 1.4){ t.state = 'dwell'; t.v = 0; t.t = 18 + Math.random()*6 + Math.min(90, t.delay*0.12); t.stSt = nx.st; }
        }
      }
    }
    /* 指令（支線の自動運転列車） */
    function dispSimCmd(pid, cmd, reason){
      const parts = String(pid).split(':');
      const D = DISP_SIM[parts[1]]; if (!D) return false;
      const t = D.trains[+parts[2]]; if (!t) return false;
      if (cmd === 'stop'){ t.hold = true; }
      else if (cmd === 'resume'){ t.hold = false; t.trouble = false; if (t.state === 'dwell') t.t = Math.min(t.t, 6); }
      else if (cmd === 'prevStation'){ t.hold = false; t.trouble = false; t.dir = -t.dir; t.state = 'run'; t.v = 4; t.delay += 60; }
      else if (cmd === 'nextStation'){ t.hold = false; t.trouble = false; if (t.state === 'dwell') t.t = Math.min(t.t, 3); t.delay += 30; }
      else if (cmd === 'trouble'){ t.trouble = true; t.hold = true; t.delay += 180; }
      return true;
    }
    /* 指令所に出す列車一覧（路線別） */
    function dispLineTrains(id){
      const out = [];
      const pushPlayer = (pid) => {
        const p = window.ONLINE_PLAYERS && window.ONLINE_PLAYERS[pid];
        if (!p || p.state !== 'driving' || p.s == null) return;
        if ((p.line || 'loop') !== id) return;
        out.push({ pid, name:p.name, dir:p.dir||1, s:p.s, v:p.v||0, state:(p.v||0) < 0.6 ? 'dwell' : 'run', delay:0, kind:'player', key:p.key||'A', cars:p.nCar||6 });
      };
      if (window.ONLINE_PLAYERS) for (const pid in window.ONLINE_PLAYERS) pushPlayer(pid);
      if (id === 'loop'){
        const T = window.__T;
        if (T && T.OT) for (const ai of T.OT){
          if (!ai || ai.state === 'off' || ai.s == null) continue;
          out.push({ pid:'ai:'+ai.name, name:'AI '+ai.name, dir:ai.dir||1, s:ai.s, v:ai.v||0, state:ai.state === 'dwell' ? 'dwell' : 'run', delay:0, kind:(ai.dispHold||ai.troubleActive) ? 'hold' : 'ai', key:ai.key, cars:6 });
        }
      } else {
        const T = window.__T;
        if (T && T.CFG && T.CFG.id === id && T.OT) {
          for (const ai of T.OT){
            if (!ai || ai.state === 'off' || ai.s == null) continue;
            out.push({ pid:'ai:'+ai.name, name:'AI '+ai.name, dir:ai.dir||1, s:ai.s, v:ai.v||0, state:ai.state === 'dwell' ? 'dwell' : 'run', delay:0, kind:(ai.dispHold||ai.troubleActive) ? 'hold' : 'ai', key:ai.key, cars:6 });
          }
        } else {
          const D = dispSimOf(id);
          if (D) for (const t of D.trains) out.push({ pid:t.id, name:dispSimName(id, t.idx), dir:t.dir, s:t.s, v:t.v, state:t.state, delay:t.delay, kind:(t.hold||t.trouble) ? 'hold' : 'sim', key:t.dir > 0 ? 'A' : 'B', cars:t.cars });
        }
      }
      return out;
    }
    /* ===== 路線タブ ===== */
    function renderLineTabs(){
      if (!tidLineTabsEl) return;
      /* v1.9.7：タブは一度だけ作り、文字だけ更新（毎回作り直すと操作が取りこぼされ重くなるため） */
      if (!tidLineTabsEl.dataset.built){
        let html = '';
        for (const d of DISP_LINES){
          html += '<button class="tid-tab" data-line="'+d.id+'">'
                + '<i style="background:'+d.col+'"></i>'+d.name+'<span class="n">0</span></button>';
        }
        tidLineTabsEl.innerHTML = html;
        tidLineTabsEl.dataset.built = '1';
        tidLineTabsEl.querySelectorAll('.tid-tab').forEach(b => {
          b.addEventListener('click', () => {
            dispLineId = b.dataset.line;
            dispSelectedId = null;
            dispTargetLabel.textContent = '対象列車：未選択';
            renderDispatchThread(null);
            if (window.__DISP) { window.__DISP.sel = null; window.__DISP.focusS = null; }
            if (dispLineId === 'loop' && !window.__DISP_MONITOR && typeof window.__ensureMonitorWorld === 'function') window.__ensureMonitorWorld();
            refreshDispatchDrivers();
          });
        });
      }
      tidLineTabsEl.querySelectorAll('.tid-tab').forEach(b => {
        const id = b.dataset.line;
        const n = dispLineTrains(id).length;
        const el = b.querySelector('.n');
        if (el && el.textContent !== String(n)) el.textContent = String(n);
        const on = id === dispLineId;
        if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
      });
    }
    /* ===== 在線表示盤（TID）===== */
    const drawDispatchMap = () => {
      if (!dispMapCanvas || !viewDispatch || viewDispatch.classList.contains('hide')) return;
      const ctx = dispMapCanvas.getContext('2d');
      const W = dispMapCanvas.width, H = dispMapCanvas.height;
      const def = dispLineById(dispLineId);
      let cfg, sts;
      try { cfg = lineConfig(def.id); sts = layoutStations(cfg); } catch(e) { return; }
      const L = cfg.L;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#071122'); g.addColorStop(1, '#03070d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(56,189,248,0.055)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 32){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 32){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const padL = 66, padR = 26, padT = 44;
      const span = W - padL - padR;
      const X = s => padL + (((s % L) + L) % L) / L * span;
      const laneUp = padT + 46, laneDn = padT + 132;
      /* 路線名 */
      ctx.fillStyle = '#e6f2ff'; ctx.font = '800 15px ' + FONT; ctx.textAlign = 'left';
      ctx.fillText(def.name + '　在線状況', padL - 40, 30);
      ctx.fillStyle = '#5d7fa6'; ctx.font = '700 11px ' + FONT;
      ctx.fillText(def.loop ? '環状運転　全' + sts.length + '駅' : '片道運転　全' + sts.length + '駅', padL - 40, 47);
      /* 線路帯 */
      const lanes = [[laneUp, 1, '上り（外回り）'], [laneDn, -1, '下り（内回り）']];
      if (!def.loop){ lanes[0][2] = '上り'; lanes[1][2] = '下り'; }
      for (const [lane, , label] of lanes){
        ctx.fillStyle = 'rgba(17,35,54,0.95)';
        ctx.fillRect(padL - 12, lane - 12, span + 24, 24);
        ctx.strokeStyle = 'rgba(56,189,248,0.28)'; ctx.lineWidth = 1;
        ctx.strokeRect(padL - 12, lane - 12, span + 24, 24);
        ctx.fillStyle = '#4d7191'; ctx.font = '700 10px ' + FONT; ctx.textAlign = 'right';
        ctx.fillText(label, padL - 18, lane + 4);
      }
      /* 駅 */
      const many = sts.length > 22;
      let labRow = 0;
      const stationLabels = [];
      ctx.textAlign = 'center';
      for (const st of sts){
        const x = X(st.s);
        const major = st.cls === 'M' || st.cls === 'X' || st.cls === 'J' || st.cls === 'I' || st.cls === 'Q';
        for (const [lane] of lanes){
          ctx.strokeStyle = major ? 'rgba(251,191,36,0.75)' : 'rgba(148,163,184,0.35)';
          ctx.lineWidth = major ? 1.6 : 1;
          ctx.beginPath(); ctx.moveTo(x, lane - 13); ctx.lineTo(x, lane + 13); ctx.stroke();
        }
        const showName = !many || major;
        if (showName){
          ctx.font = (major ? '700 11px ' : '10px ') + FONT;
          const nw = ctx.measureText(st.name).width;
          let lx = Math.min(W - nw - 4, Math.max(4, x - nw / 2));
          let ly = H - 14 - (labRow % 2) * 15;
          let bad = false;
          for (const t of stationLabels){ if (Math.abs(t.y - ly) < 13 && lx < t.x + t.w && lx + nw > t.x){ bad = true; break; } }
          if (!bad){
            stationLabels.push({ x:lx, y:ly, w:nw });
            ctx.fillStyle = major ? '#ffd76b' : '#8fa8c4';
            ctx.textAlign = 'left';
            ctx.fillText(st.name, lx, ly);
            labRow++;
          }
        }
      }
      ctx.textAlign = 'left';
      if (def.loop){
        ctx.fillStyle = 'rgba(251,191,36,0.55)'; ctx.font = '700 10px ' + FONT;
        ctx.fillText('◀ 汐見（起点・終点）', padL - 40, laneDn + 34);
        ctx.textAlign = 'right'; ctx.fillText('環状（汐見へ戻る）▶', padL + span + 12, laneDn + 34); ctx.textAlign = 'left';
      }
      /* 列車 */
      dispHitBoxes.length = 0;
      const drawnLabels = [];
      const trains = dispLineTrains(dispLineId);
      for (const tr of trains){
        const lane = tr.dir > 0 ? laneUp : laneDn;
        const s = ((tr.s % L) + L) % L;
        const x = X(s);
        const wPx = Math.max(12, Math.min(70, (tr.cars * 20.2) / L * span));
        const sel = dispSelectedId === tr.pid;
        /* 閉塞（次の駅までの在線区間） */
        const nx = (function(){ let b = null, bd = 1e9; for (const st of sts){ const d = tr.dir * sdm(s, st.s, L); if (d > 0.5 && d < bd){ bd = d; b = st; } } return b; })();
        if (nx){
          const x2 = X(nx.s);
          ctx.fillStyle = 'rgba(251,191,36,0.10)';
          const xa = Math.min(x, x2), xb = Math.max(x, x2);
          ctx.fillRect(xa, lane - 11, Math.max(1, xb - xa), 22);
        }
        const SVCCOL = { A:'#14935f', B:'#14935f', C:'#e8731e', D:'#e8731e', E:'#c8322b', F:'#c8322b', G:'#1f5fbf', H:'#1f5fbf' };
        const col = tr.kind === 'hold' ? '#f87171' : tr.kind === 'player' ? '#fbbf24' : (def.id === 'loop' ? (SVCCOL[tr.key] || def.col) : (def.col || '#38bdf8'));
        ctx.fillStyle = col;
        const x0 = tr.dir > 0 ? x : x - wPx;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x0, lane - 6, wPx, 12, 3); else ctx.rect(x0, lane - 6, wPx, 12);
        ctx.fill();
        if (sel){ ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); }
        /* 名前（重なるときは上下に段をずらして全列車を表示） */
        const tag = tr.name + (tr.delay > 0 ? ' +' + Math.max(1, Math.round(tr.delay / 60)) + '分' : '');
        ctx.font = '700 10.5px ' + FONT;
        const tw = ctx.measureText(tag).width;
        let ty = tr.dir > 0 ? lane - 12 : lane + 24;
        const tx = Math.min(W - tw - 8, Math.max(4, x - tw / 2));
        for (let row = 0; row < 4; row++) {
          const candY = tr.dir > 0 ? (lane - 12 - row * 17) : (lane + 24 + row * 17);
          const hit = drawnLabels.some(lb => Math.abs(lb.y - candY) < 14 && tx < lb.x + lb.w && tx + tw + 8 > lb.x);
          if (!hit) { ty = candY; break; }
        }
        drawnLabels.push({ x:tx, y:ty, w:tw + 8 });
        ctx.fillStyle = sel ? 'rgba(120,63,6,0.95)' : 'rgba(6,14,24,0.9)';
        ctx.strokeStyle = sel ? '#fbbf24' : 'rgba(120,150,180,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx, ty - 11, tw + 8, 15, 4); else ctx.rect(tx, ty - 11, tw + 8, 15);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8f3ff';
        ctx.fillText(tag, tx + 4, ty);
        dispHitBoxes.push({ pid: tr.pid, x, y: lane, rx: tx, ry: ty - 11, rw: tw + 8, rh: 15 });
      }
      if (!trains.length){
        ctx.fillStyle = '#5d7fa6'; ctx.font = '700 13px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText('この路線に在線中の列車はありません', W / 2, H / 2 + 30); ctx.textAlign = 'left';
      }
      /* タブ・駅ストリップの更新 */
      if (tidBoardInfoEl) tidBoardInfoEl.textContent = '在線 ' + trains.length + ' 本 ／ ' + (def.loop ? '環状' : '片道') + ' ' + Math.round(L / 1000) + 'km';
      if (tidStripInfoEl) tidStripInfoEl.textContent = sts.length + '駅';
      if (tidStripEl && tidStripEl.dataset.line === dispLineId){
        const dw = new Set();
        for (const tr of trains) if (tr.state === 'dwell'){
          let near = null, bd = 1e9;
          for (const st of sts){ const d = Math.abs(sdm(tr.s, st.s, L)); if (d < bd){ bd = d; near = st; } }
          if (near && bd < 60) dw.add(near.i);
        }
        const kids = tidStripEl.children;
        for (let i = 0; i < kids.length && i < sts.length; i++){
          const want = dw.has(sts[i].i);
          if (kids[i].classList.contains('dw') !== want) kids[i].classList.toggle('dw', want);
        }
      }
      if (tidStripEl && tidStripEl.dataset.line !== dispLineId){
        const dwMap = {};
        for (const tr of trains) if (tr.state === 'dwell'){
          let near = null, bd = 1e9;
          for (const st of sts){ const d = Math.abs(sdm(tr.s, st.s, L)); if (d < bd){ bd = d; near = st; } }
          if (near && bd < 60) dwMap[near.i] = (dwMap[near.i] || 0) + 1;
        }
        let html = '';
        for (const st of sts){
          const c = dwMap[st.i];
          html += '<span class="tid-st' + (c ? ' dw' : '') + '"><b>' + escapeHtml(st.name) + '</b></span>';
        }
        tidStripEl.innerHTML = html;
        tidStripEl.dataset.line = dispLineId;
      }
      if (tidTrainCountEl) tidTrainCountEl.textContent = trains.length + ' 本';
    };
    const selectDispatchTarget = (pid) => {
      dispSelectedId = pid;
      dispatchUnread[pid] = 0;
      if (window.__DISP) { window.__DISP.sel = dispSelectedId; }
      const p = ONLINE_PLAYERS[dispSelectedId];
      let label = dispSelectedId;
      if (p) label = p.name;
      else if (dispSelectedId && dispSelectedId.startsWith('ai:')) label = 'AI列車 (' + dispSelectedId.slice(3) + ')';
      else if (dispSelectedId && dispSelectedId.startsWith('sim:')){
        const q = dispSelectedId.split(':');
        label = '自動運転列車 ' + dispSimName(q[1], +q[2]) + '（' + dispLineById(q[1]).name + '）';
      }
      if (dispTargetLabel) dispTargetLabel.textContent = '対象列車：' + label;
      renderDispatchThread(dispSelectedId);
      refreshDispatchDrivers();
      drawDispatchMap();
    };
    if (dispMapCanvas) {
      dispMapCanvas.addEventListener('click', (e) => {
        const rect = dispMapCanvas.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (dispMapCanvas.width / rect.width);
        const cy = (e.clientY - rect.top) * (dispMapCanvas.height / rect.height);
        for (const hb of dispHitBoxes) {
          if (Math.hypot(cx - hb.x, cy - hb.y) < 20 || (cx >= hb.rx && cx <= hb.rx + hb.rw && cy >= hb.ry && cy <= hb.ry + hb.rh)) {
            selectDispatchTarget(hb.pid);
            break;
          }
        }
      });
    }
    let _lastDispSig = '';
    const refreshDispatchDrivers = () => {
      if (!dispDriversList || !viewDispatch || viewDispatch.classList.contains('hide')) return;
      if (window.__DISP_MONITOR) ['btnDriverTablet','btnCrewMicFab','btnOnlineHud','btnTitleReturn','walkUI'].forEach(id => { const e = document.getElementById(id); if (e && !e.classList.contains('hide')) e.classList.add('hide'); });
      const chatFab = document.getElementById('btnChatFab');
      if (chatFab && chatFab.classList.contains('hide')) chatFab.classList.remove('hide');
      dispSimStep();
      drawDispatchMap();
      const rows = dispLineTrains(dispLineId);
      /* 時計・異常表示 */
      if (tidClockEl){ const d = new Date(); tidClockEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
      if (tidAlarmEl){
        const abn = rows.filter(r => r.kind === 'hold').length;
        const dly = rows.filter(r => r.delay > 0).length;
        if (abn) { tidAlarmEl.textContent = '⚠ 異常・抑止 ' + abn + ' 本'; tidAlarmEl.style.color = '#fca5a5'; if (tidLampEl) tidLampEl.classList.add('warn'); }
        else if (dly) { tidAlarmEl.textContent = '△ 遅延 ' + dly + ' 本'; tidAlarmEl.style.color = '#fcd34d'; if (tidLampEl) tidLampEl.classList.remove('warn'); }
        else { tidAlarmEl.textContent = '全線 平常運転'; tidAlarmEl.style.color = '#7dd3fc'; if (tidLampEl) tidLampEl.classList.remove('warn'); }
      }
      renderLineTabs();
      /* v1.9.7：列車の顔ぶれが変わったときだけ一覧を作り直す（毎回作り直すとタップが取りこぼされる） */
      const sig = dispLineId + '|' + dispSelectedId + '|' + rows.map(r => r.pid + ':' + r.kind).join(',');
      if (sig === _lastDispSig && rows.length){
        for (const r of rows){
          const el = dispDriversList.querySelector('[data-pid="' + r.pid + '"]');
          if (!el) continue;
          const mv = el.querySelector('.disp-mv');
          if (mv) mv.textContent = (r.dir > 0 ? '上り' : '下り') + '・' + (r.state === 'dwell' ? '停車中' : Math.round(r.v * 3.6) + 'km/h');
          const ps = el.querySelector('.disp-pos');
          if (ps) ps.textContent = String(Math.round(((r.s % 100000) + 100000) % 100000)).padStart(5, '0');
        }
        return;
      }
      _lastDispSig = sig;
      let html = '';
      if (dispLineId === 'loop' && !window.__DISP_MONITOR){
        html += '<div style="color:#fca5a5;font-size:11.5px;line-height:1.5;padding:7px 9px;border:1px solid rgba(248,113,113,0.35);border-radius:8px;background:rgba(70,10,10,0.35);">本線のAI列車の在線は3Dモニターの起動が必要です。この端末では3Dモニターを起動できませんでした（WebGLが使えない状態）。ほかの路線の監視・指令はそのまま使えます。</div>';
      }
      for (const r of rows){
        const sel = dispSelectedId === r.pid;
        const cls = 'disp-drv-row' + (sel ? ' on' : '');
        const mark = r.kind === 'hold' ? '🛑' : r.kind === 'player' ? '🧑‍✈️' : r.kind === 'ai' ? '🤖' : '🚃';
        const dirTxt = r.dir > 0 ? '上り' : '下り';
        const stTxt = r.state === 'dwell' ? '停車中' : Math.round(r.v * 3.6) + 'km/h';
        const dly = r.delay > 0 ? '<span style="color:#fcd34d;font-size:10px;margin-left:4px;">+' + Math.max(1, Math.round(r.delay/60)) + '分</span>' : '';
        html += '<button class="'+cls+'" data-pid="'+r.pid+'"><span>'+mark+' '+escapeHtml(r.name)+dly
             + '<small class="disp-mv" style="color:#7d94b0"> （'+dirTxt+'・'+stTxt+'）</small></span>'
             + '<span class="disp-pos" style="font-family:\'DotGothic16\',monospace;font-size:10.5px;color:#7dd3fc">'+String(Math.round(((r.s%100000)+100000)%100000)).padStart(5,'0')+'</span></button>';
      }
      if (!html) html = '<div style="color:#64748b;font-size:12px;padding:8px;">この路線に在線中の列車はありません</div>';
      dispDriversList.innerHTML = html;
      dispDriversList.querySelectorAll('.disp-drv-row').forEach(btn => {
        btn.addEventListener('click', () => selectDispatchTarget(btn.dataset.pid));
      });
    };
    renderLineTabs();
    setInterval(refreshDispatchDrivers, 500);
    const btnDispOpenGlobalChat = document.getElementById('btnDispOpenGlobalChat');
    if (btnDispOpenGlobalChat) btnDispOpenGlobalChat.addEventListener('click', () => {
      const fab = document.getElementById('btnChatFab');
      if (fab) fab.click();
    });
    /* v1.9.7：指令所は「専用の運転管理画面」。3Dの背景（定点カメラ）は廃止し、ゲームの音も止める。
       本線のAI列車の在線情報は、裏で3Dモニターを起動して取得する（画面・音は出さない） */
    const DISP_MUTE = { prev: null };
    function dispSetSound(on){
      try {
        const T = window.__T;
        if (on){
          if (T && T.G) T.G.sound = (DISP_MUTE.prev === null ? undefined : DISP_MUTE.prev);
        } else {
          if (T && T.G){ if (DISP_MUTE.prev === null) DISP_MUTE.prev = (T.G.sound === undefined ? 'auto' : T.G.sound); T.G.sound = false; }
        }
        const A = window.__AUD;
        if (A && A.master && A.AC){ A.master.gain.setTargetAtTime(on ? 1 : 0, A.AC.currentTime, 0.05); }
        if (!on){
          if (window.__DISPANN && window.__DISPANN.src){ try { window.__DISPANN.src.stop(); } catch(e) {} window.__DISPANN.src = null; }
          const ACt = window.__AC;
          if (ACt && ACt.state === 'running'){ try { ACt.suspend(); } catch(e) {} }
        } else {
          const ACt = window.__AC;
          if (ACt && ACt.state === 'suspended'){ try { ACt.resume(); } catch(e) {} }
          if (A && A.master && A.AC){ A.master.gain.setTargetAtTime(1, A.AC.currentTime, 0.05); }
        }
      } catch(e) {}
    }
    function dispHideWorld(on){
      const gl = document.getElementById('gl');
      if (gl){ gl.style.display = on ? 'none' : 'block'; gl.style.left = on ? '-20000px' : '0px'; gl.style.visibility = on ? 'hidden' : 'visible'; }
      const pc = document.getElementById('dispCamCanvas');
      if (pc) pc.style.display = 'none';
    }
    window.__ensureMonitorWorld = () => {
      if (window.__DISP) return true;                 /* すでに3Dの世界ができている */
      if (window.__DISP_BOOTING) return false;
      window.__DISP_BOOTING = true;
      setTimeout(() => {
        try {
          boot('loop', 'lo', 0);
          window.__DISP_MONITOR = true;
          ['btnDriverTablet','btnCrewMicFab','btnOnlineHud','btnTitleReturn','walkUI'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hide'); });
          dispHideWorld(true);
          dispSetSound(false);
        } catch(e) { console.error('指令モニター起動失敗', e); }
        window.__DISP_BOOTING = false;
        const onDisp = !!(viewDispatch && !viewDispatch.classList.contains('hide'));
        const D = window.__DISP;
        if (D) { D.on = onDisp; D.sel = onDisp ? dispSelectedId : null; D.camOn = false; D.focusS = null; }
        if (onDisp) refreshDispatchDrivers();
      }, 80);
      return false;
    };
    window.__openDispatchConsole = () => {
      if (!viewDispatch) return;
      document.querySelectorAll('.home-view').forEach(v => v.classList.add('hide'));
      viewDispatch.classList.remove('hide');
      document.body.classList.add('disp-monitor');
      const _wrap=document.querySelector('#home .wrap'); if(_wrap)_wrap.classList.add('disp-wide');
      if (typeof initOnlineClient === 'function') initOnlineClient();
      if (typeof window.__ensureMonitorWorld === 'function') window.__ensureMonitorWorld();
      /* 指令所は無音・背景なしの専用画面 */
      dispHideWorld(true);
      dispSetSound(false);
      if (window.__DISP) {
        window.__DISP.on = true;
        window.__DISP.sel = dispSelectedId || null;
        window.__DISP.focusS = null;
        window.__DISP.camOn = false;
      }
      const sendHB = () => {
        dispatchManualUntil = Date.now() + 10000;
        if (ONLINE_CLIENT && ONLINE_CLIENT.connected) {
          try { ONLINE_CLIENT.publish('shiomi3d/v1/dispatch/status', JSON.stringify({ active: true, ts: Date.now() }), { qos: 0 }); } catch(e) {}
        }
        updateDispatchBadges();
      };
      sendHB();
      if (dispatchHB) clearInterval(dispatchHB);
      dispatchHB = setInterval(sendHB, 3000);
      renderLineTabs();
      refreshDispatchDrivers();
      drawDispatchMap();
    };
    if (btnBackFromDispatch && viewDispatch) {
      btnBackFromDispatch.addEventListener('click', () => {
        viewDispatch.classList.add('hide');
        document.body.classList.remove('disp-monitor');
        const _wrap2=document.querySelector('#home .wrap'); if(_wrap2)_wrap2.classList.remove('disp-wide');
        if (window.__DISP) { window.__DISP.on = false; window.__DISP.sel = null; window.__DISP.focusS = null; window.__DISP.camOn = false; }
        dispHideWorld(false);
        dispSetSound(true);
        /* モニター世界はタイトル裏で動き続けるので、そこだけは無音のままにする（次の乗務で新しく作り直される） */
        if (window.__DISP_MONITOR && window.__T && window.__T.G) window.__T.G.sound = false;
        const vd = document.getElementById('viewDutySelect');
        if (vd) vd.classList.remove('hide');
        if (dispatchHB) { clearInterval(dispatchHB); dispatchHB = null; }
        if (ONLINE_CLIENT && ONLINE_CLIENT.connected) {
          try { ONLINE_CLIENT.publish('shiomi3d/v1/dispatch/status', JSON.stringify({ active: false, ts: Date.now() }), { qos: 0 }); } catch(e) {}
        }
      });
    }
    const execAiDispatchCmd = (pid, cmd, reason) => {
      const T = window.__T;
      if (!T || !T.OT) return false;
      const ai = T.OT.find(x => x && ('ai:' + x.name) === pid);
      if (!ai) return false;
      if (cmd === 'stop') { ai.dispHold = true; ai.slowMode = null; ai._cmdTs = Date.now(); ai.v = Math.min(ai.v || 0, 2); }
      else if (cmd === 'resume') { ai.dispHold = false; ai.troubleActive = false; ai.slowMode = null; ai.forceDep = true; ai._cmdTs = Date.now(); }
      else if (cmd === 'prevStation') { ai.dispHold = false; ai.troubleActive = false; ai.slowMode = 'prev'; ai._cmdTs = Date.now(); }
      else if (cmd === 'nextStation') { ai.dispHold = false; ai.troubleActive = false; ai.slowMode = 'next'; ai._cmdTs = Date.now(); }
      else if (cmd === 'trouble') { ai.troubleActive = true; ai.dispHold = true; ai._cmdTs = Date.now(); ai.v = Math.min(ai.v || 0, 2); }
      if (ONLINE_CLIENT && ONLINE_CLIENT.connected) {
        try { ONLINE_CLIENT.publish('shiomi3d/v1/ai/cmd', JSON.stringify({ name: ai.name, cmd, reason, ts: Date.now() }), { qos: 1 }); } catch(e) {}
      }
      return true;
    };
    const bindDispCmd = (id, cmd, label) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => {
        if (!dispSelectedId) { showToast('先に対象の列車を選択してください', 'warn'); return; }
        if (dispSelectedId.startsWith('sim:')) {            /* v1.9.7：支線の自動運転列車 */
          dispSimCmd(dispSelectedId, cmd);
          appendDispatchThreadLog(dispSelectedId, '📡 指令', '自動運転列車へ「' + label + '」を指示しました', 'disp');
          refreshDispatchDrivers();
          return;
        }
        if (dispSelectedId.startsWith('ai:')) {
          execAiDispatchCmd(dispSelectedId, cmd);
          appendDispatchThreadLog(dispSelectedId, '📡 製作者指令', 'AI列車へ「' + label + '」を指示しました', 'disp');
          return;
        }
        const p = ONLINE_PLAYERS[dispSelectedId];
        const msg = '【指令】' + (p ? p.name : '') + ' へ「' + label + '」を送信しました';
        appendDispatchThreadLog(dispSelectedId, '📡 製作者指令', msg, 'disp');
        publishDispatchMsg({ from: 'dispatch', targetId: dispSelectedId, targetName: p ? p.name : null, cmd, text: label + 'の指令を受信しました' });
      });
    };
    bindDispCmd('dispCmdStop', 'stop', '運転抑止');
    bindDispCmd('dispCmdResume', 'resume', '運転再開');
    bindDispCmd('dispCmdPrev', 'prevStation', '一駅前まで移動');
    bindDispCmd('dispCmdNext', 'nextStation', '一駅先まで運転再開');
    const dispCmdTrouble = document.getElementById('dispCmdTrouble');
    const dispTroubleSelect = document.getElementById('dispTroubleSelect');
    if (dispCmdTrouble && dispTroubleSelect) {
      dispCmdTrouble.addEventListener('click', () => {
        if (!dispSelectedId) { showToast('先に対象の列車を選択してください', 'warn'); return; }
        const reason = dispTroubleSelect.value;
        if (dispSelectedId.startsWith('sim:')) {
          dispSimCmd(dispSelectedId, 'trouble', reason);
          appendDispatchThreadLog(dispSelectedId, '📡 指令メモ', '自動運転列車で異常を発報しました: ' + reason, 'sys');
          refreshDispatchDrivers();
          return;
        }
        if (dispSelectedId.startsWith('ai:')) {
          execAiDispatchCmd(dispSelectedId, 'trouble', reason);
          appendDispatchThreadLog(dispSelectedId, '📡 指令メモ', 'AI列車でトラブルを発生させました: ' + reason, 'sys');
          return;
        }
        const p = ONLINE_PLAYERS[dispSelectedId];
        appendDispatchThreadLog(dispSelectedId, '📡 指令メモ', (p ? p.name : '') + ' の路線でトラブルを発生させました: ' + reason, 'sys');
        publishDispatchMsg({ from: 'dispatch', targetId: dispSelectedId, targetName: p ? p.name : null, cmd: 'trouble', reason });
      });
    }
    const dispForm = document.getElementById('dispForm');
    const dispInput = document.getElementById('dispInput');
    if (dispForm && dispInput) {
      dispForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = dispInput.value.trim();
        if (!msg) return;
        if (!dispSelectedId) { showToast('先に1対1で話す列車を選択してください', 'warn'); return; }
        dispInput.value = '';
        if (dispSelectedId.startsWith('sim:')) {
          appendDispatchThreadLog(dispSelectedId, '📡 指令', msg, 'disp');
          appendDispatchThreadLog(dispSelectedId, '🚃 自動運転', '指令を受信しました。', 'sys');
          return;
        }
        if (dispSelectedId.startsWith('ai:')) {
          appendDispatchThreadLog(dispSelectedId, '📡 製作者指令', msg, 'disp');
          appendDispatchThreadLog(dispSelectedId, '🤖 AI列車', '了解しました。指令に従い運行します。', 'sys');
          return;
        }
        const p = ONLINE_PLAYERS[dispSelectedId];
        appendDispatchThreadLog(dispSelectedId, '📡 製作者指令', msg, 'disp');
        publishDispatchMsg({ from: 'dispatch', targetId: dispSelectedId, targetName: p ? p.name : null, text: msg });
      });
    }
    if (btnChatClose && chatTray) {
      btnChatClose.addEventListener('click', () => chatTray.classList.add('hide'));
    }
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;
        if (typeof sendQuickChat === 'function') sendQuickChat(msg);
        chatInput.value = '';
      });
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && chatTray) {
          chatInput.blur();
          chatTray.classList.add('hide');
        }
      });
    }
    document.querySelectorAll('.chat-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        if (typeof sendQuickChat === 'function') sendQuickChat(msg);
      });
    });
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
      if (e.code === 'KeyT' && typeof G !== 'undefined' && G && G.phase === 'play') {
        if (chatTray) {
          chatTray.classList.toggle('hide');
          if (!chatTray.classList.contains('hide') && chatInput) {
            setTimeout(() => chatInput.focus(), 30);
          }
        }
      }
    });

    // ご意見箱 返信コーナー（作者サトタケ / riku06568 が反映）
    window.FEEDBACK_REPLIES = [
      {
        id: 29,
        date: '2026/11/28',
        sender: '名無し運転士さん',
        q: '試運転の場合は乗客を乗せないようにしてください！ 後団体列車とか臨時列車はイベントの時みたいにしてください！！ 今後とも面白いゲーム制作を頑張ってください！！',
        a: '応援のメッセージとご提案ありがとうございます！\n①試運転列車（プレイヤー運転・AI試運転・手動幕の「試運転」「回送」）では、車内にも乗客を乗せず、ホームからの乗車も行われないように修正しました。\n②路線選択と乗り換えメニューに「臨時列車（外回り／内回り）」と「団体列車（外回り／内回り）」を追加し、イベント時と同様に臨時・団体列車の増発や撮り鉄の増加、専用方向幕（「臨時」「団体」）で運転できるようにしました。ぜひ遊んでみてください！'
      },
      {
        id: 28,
        date: '2026/11/28',
        sender: 'すじこさん',
        q: '駅名標の隣に時刻表を置いて',
        a: 'ご意見ありがとうございます！環状線・各支線・地下駅・特急地下ホームの駅名標の隣に、それぞれの駅・方面・種別（普通／快速／快特）に対応した駅時刻表パネルを設置しました。ホームを見学する際などにぜひ見てみてください。'
      },
      {
        id: 27,
        date: '2026/11/28',
        sender: 'U8さん',
        q: '画面がカクカクします。それと、力行を↓、ブレーキを↑にしてほしいです。',
        a: 'ご報告・ご要望ありがとうございます！\n①マスコン操作を実車風の「↓で力行／↑でブレーキ」に対応し、「設定・操作」画面から従来の「↑で力行／↓でブレーキ」といつでも切り替えられるようにしました（画面右のマスコンボタンも連動します）。\n②描画の自動解像度調整（`light`以上）の反応を早め、毎フレームの不要なメモリ確保を減らしてカクつきを抑えました。「設定・操作」で画質を「超軽量」「最軽量」にするとさらに軽くなりますので、あわせてお試しください。'
      },
      {
        id: 26,
        date: '2026/11/25',
        sender: '天才運転士さん',
        q: '汐見環状線を運転しているとき発車してからは普通にぬるぬる動くのに駅に到着する前から映像がカクカクになります 各支線を運転しているときはなりません',
        a: 'ご報告ありがとうございます。原因を調べて修正しました。\n汐見環状線で駅の手前260mに入ると、運転台の側面モニター（ホームカメラ・ITV）に映す映像を作るため、3Dの全景をもう1〜4回描き直していました。支線の旧型車にはこのモニターがないため、支線では起きていませんでした。発車して260mほど走ると描き直しが止まるので、走行中はなめらかに見えていた、という形です。\nv2.5.1で、モニターを見ているとき（拡大・ITV・見回し）だけ高い頻度で更新し、正面を向いて運転している間は数フレームに1枚へ間引くようにしました（全景の描き直しは最大4回/フレーム → 平均0.3〜0.4回/フレーム程度）。あわせて、駅の電光掲示板の再描画も每秒4回→2回に減らしています。駅の接近・停車・発車時の引っかかりが減っているはずなので、もう一度試してみてください。貴重なご報告をありがとうございました。'
      },
      {
        id: 25,
        date: '2026/11/25',
        sender: '天才運転士さん',
        q: 'ミッション要素などを追加してみたらどうでしょうか',
        a: 'ご意見ありがとうございます。ミッション要素の追加は、今後の検討候補として受け取りました。\nいまのゲームは決まったダイヤで定時に運転することが中心なので、たとえば「時間内に指定の駅まで運転する」「乗降を遅らせずに発車する」といった目標を出す形が考えられます。運転・放送・乗降の流れを壊さずに入れられるか、設計から検討します。貴重なご意見をありがとうございました。'
      },
      {
        id: 24,
        date: '2026/11/25',
        sender: '運転手30番さん',
        q: '峰月から紫雲新都を結ぶ路線を作ってください',
        a: 'ご意見ありがとうございます。峰月（天宮高架線）と紫雲新都（汐見環状線）を結ぶ路線は、今後の路線拡張の候補として検討します。\n新しい路線は、線路・駅・信号・ダイヤ・ホームの位置関係をゼロから作る必要があるため、すぐにとはいきません。ただ、四嶺連絡高速線のように、既存の支線の終点どうしを結ぶ形なら作りやすいので、その方向も含めて考えます。貴重なご意見をありがとうございました。'
      },
      {
        id: 23,
        date: '2026/11/24',
        sender: '肉っちさん',
        q: 'もっと路線を増やしてほしいです。 あと特急専用の列車などを追加してほしいです（成田エクスプレスみたいな？） よろしくお願いします',
        a: 'ご意見ありがとうございます。新しい路線の追加と、成田エクスプレスのような特急専用車両の追加は、今後の検討課題として受け取りました。\n特急は以前に一度汐見環状線へ入れましたが、停車駅・ダイヤ・信号・ホームドア・放送で不具合が多く、安心して遊べる状態にできなかったためv2.1.0でいったん廃止した経緯があります。作り直して安定して走らせられる目処が立ったら再挑戦したいと思っています。路線の追加も、まず今ある路線の動作を軽く・安定させてから進めたいです。貴重なご意見をありがとうございました。'
      },
      {
        id: 22,
        date: '2026/11/24',
        sender: '運転手30番さん',
        q: '改札に案内板をつけてください',
        a: 'ご意見ありがとうございます。各駅の改札口（コンコース）に案内板を設置しました（v2.5.1）。\n駅名と路線名、○番線ごとの方面（環状線は外回り・内回り、支線は行先）と種別（各停・快速・快特）、出口・トイレ・売店・のりばの構内案内を1枚にまとめて表示しています。環状線も支線も、すべての駅の改札の手前で見られます（ホーム見学モードで階段を上がった改札口・コンコース）。貴重なご意見をありがとうございました。'
      },
      {
        id: 21,
        date: '2026/11/24',
        sender: '運転手30番さん',
        q: '紫雲地下線に快速を追加してください',
        a: 'ご意見ありがとうございます。紫雲地下線への快速の追加は、今後のアップデート候補として検討します。\n快速を入れるには、停車駅・ダイヤ・信号・行き違いの設備を作り直す必要があるため、まずは現在の各駅停車が安定して走れることを優先しています。余裕をもって作れる目処が立ったら対応します。貴重なご意見をありがとうございました。'
      },
      {
        id: 20,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: '主要駅に25人追加して下さい。 あと方向幕追加して下さい',
        a: 'ご意見ありがとうございます！\n①方向幕：車両前面の行先表示器をより大きく読みやすい表示に刷新し、新たに側面（ドアの上）にも方向幕を追加しました。各停・快速・快特・試運転・臨時で種別と行先がはっきり表示され、環状線は「外回り／内回り」、支線は行先駅名が出ます。ゲーム中の「🚉 乗り換え・方向幕」ボタンから、いま掲出している方向幕の確認と手動の幕回し（回送・試運転・臨時・団体・普通・快速・快特）もできます。\n②主要駅への25人追加は、動作の軽さ（フレームレート）を保つため今回は見送りました。人が多すぎると低スペックな端末でカクついてしまうためで、今後、描画を軽くする工夫と合わせて検討します。ご了承ください。'
      },
      {
        id: 19,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: '特急列車を汐見環状線に追加して下さい。',
        a: 'ご意見ありがとうございます。特急列車については、以前に一度汐見環状線へ追加したことがあるのですが、停車駅・ダイヤ・信号・ホームドア・放送などでバグが多く、安心して遊べる状態にできなかったため、v2.1.0で廃止しました。現在は各停・快速・快速特急の3種別で安定して運行できることを優先しています。将来、余裕をもって作り直せる目処が立てば再追加を検討します。貴重なご意見をありがとうございました。'
      },
      {
        id: 18,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: '快特でツーマン乗務の時ドアを閉めるまでの時間が長すぎるのでもうちょっと早くしてもよいと思います',
        a: 'ご意見ありがとうございます！快速特急のツーマン乗務で、車掌がドアを閉めるまでの待ち時間を短縮しました。発車メロディは1回鳴らし切ったら間を置かずに戸閉し、乗降が落ち着いていれば待たずに閉めます（主要駅でも待ち時間の上限を大きく短くしました）。テンポよく発車できるようになっていますので、ぜひ確かめてみてください。'
      },
      {
        id: 17,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: 'そのままオンラインになってて、乗り換えができるようにして',
        a: 'ご意見ありがとうございます！タイトルに戻らなくても、乗客モードで乗り換え駅にいるとき、そのままのオンライン接続を保ったまま別の列車・路線に乗り換えられるようにしました。\n乗客モード中に「🚉 乗り換え」ボタンから、その駅で接続している路線や別種別（環状線各停・快速・快特・試運転・各支線）を選んで乗り換えられます。乗り換え時は前の状態を片付けてから切り替えるので、チャットや他プレイヤーとのオンライン状態はそのまま続きます。'
      },
      {
        id: 16,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: '深雪より先の駅を作ってください',
        a: 'ご意見ありがとうございます。深雪より先（紫雲地下線の延伸）の駅について、以前に一度作ろうとしたのですが、地下トンネル・ホーム・信号・ダイヤのつながりでバグが多く、きちんと遊べる形にできませんでした。そのため今は実装できていません。将来、余裕をもって作れるようになれば挑戦したいと思います。応援ありがとうございます。'
      },
      {
        id: 15,
        date: '2026/11/24',
        sender: '名無し運転士さん',
        q: '試運転列車の追加、撮り鉄を追加（試運転列車や団体・臨時列車の場合はホーム端・エキセンや線路沿いの撮影地などに多めに追加）、前のアップデートのようにダイヤの設定を自分で設定できるようにしてほしい',
        a: 'たくさんのご意見をありがとうございます！\n①試運転列車：乗務開始の路線選択に「試運転　外回り／内回り」を追加し、自分で試運転列車を運転できるようにしました。前面・側面の方向幕は「試運転」表示になり、各停と同じ線路・信号・閉塞・ホームドアで走ります。AIの試運転列車も一定間隔で出庫して走ります。\n②撮り鉄：カメラを構えた人をホーム端（エキセン）や線路沿いの撮影地に追加しました。普段は少人数ですが、試運転列車が走っているときや臨時・団体ダイヤのときは人数が増えます。\n③ダイヤの手動設定：運転条件の画面と、ゲーム中の「🚉 乗り換え・方向幕」メニューから「自動（毎月日替わり）／通常ダイヤ／臨時・団体ダイヤ／変更ダイヤ」を選べるように復活させました。自動に戻せば、これまでどおり毎月日替わりのダイヤで遊べます。'
      },
      {
        id: 14,
        date: '2026/11/21',
        sender: '天才運転士さん',
        q: '快速特急ツーマン運転車掌の時にITVモニタが欲しいです',
        a: 'ご意見ありがとうございます！車掌モード（快速特急・各駅停車）で使えるITVモニタを実装しました。\nホームの最後尾付近（車掌の停止位置）に3DのITVモニタを設置したほか、画面上の「📺 ITVモニタ」ボタンからいつでも4分割のホーム全体映像（1〜12両）を確認でき、そのまま戸開・戸閉・発車メロディも操作できます。ぜひ使ってみてください！'
      },
      {
        id: 13,
        date: '2026/11/20',
        sender: '名無し運転士さん',
        q: '天宮高架線に 乗れないバグと 天宮高架線の駅ホームドア付いてる駅全駅のホームドアが開かないバグがある',
        a: 'いつも遊んでいただきありがとうございます。ご報告いただいた2件、原因を突き止めて修正しました。\n天宮高架線は快速と各駅停車が同じホーム（同じ線路）を使う駅があり、その駅で「到着した列車の種別」と「ホームの番線」の対応が取れておらず、ホームドアが開かない・ホームドアが閉まったままで乗車できない状態になっていました。\n列車の種別とホームの番線を正しく対応させるよう根本から修正し、快速・各駅停車のどちらでも、ホームドアのある全駅で確実に開閉することを確認しました。ご不便をおかけして申し訳ありませんでした。'
      },
      {
        id: 12,
        date: '2026/11/19',
        sender: '名無し運転士さん',
        q: '改札に行けるようにして',
        a: 'ご意見ありがとうございます。乗客モード（ホーム見学）で、ホームの階段の上にある改札口・コンコースまで歩いて行けるようにしました。\n自動改札機・駅名や出口の案内看板・トイレ・売店のあるコンコースで、ホームへ戻るボタンでいつでもホームに戻れます。ホーム見学中は画面右の「🚪 改札口へ」ボタンから行けます。'
      },
      {
        id: 11,
        date: '2026/11/19',
        sender: '名無し運転士さん',
        q: '天宮高架線の ホームドアが開かない',
        a: 'ご報告ありがとうございます。天宮高架線でホームドアが開かない不具合を確認し、修正しました。\n快速と各駅停車が同じホームを使う駅で、到着した列車の種別とホームの番線の対応が取れていなかったのが原因です。現在は全駅で、停車した列車のドアに合わせてホームドアが開閉します。'
      },
      {
        id: 10,
        date: '2026/11/18',
        sender: '名無し運転士さん',
        q: 'いつも面白いゲームをありがとうございます！ ダイヤの設定として天候を設定したりを行い京急などの逝っとけダイヤなどや臨時列車のダイヤや団体列車のダイヤを作っていただけると嬉しいです！…車庫から列車を出すのを再現できるようにしていただきたいです！…警笛の案を採用していただきありがとうございました！',
        a: 'たくさんのご意見をいただき、ありがとうございます！\n①天候設定：晴れ・曇り・雨・雪・霧から選べるようにしました。空と霧の見え方、雨・雪の降り方、ブレーキの効き（雨・雪・霧では速度を抑えて運転します）が変わります。\n②ダイヤ設定：「通常ダイヤ」「臨時・団体列車ダイヤ（臨時列車を増発）」「変更ダイヤ（快速と特急の停車駅を入れ替える、いわゆる“逝っとけ”風のダイヤ）」を選べるようにしました。\n③車庫からの出庫：汐見車両基地から本線に出て、汐見駅を目指して運転を始められる「車庫から出庫」を追加しました（本線・外回り）。\n警笛も喜んでいただけてうれしいです。\n（v2.1.0で、天候は毎日・季節に合わせて自動で変わる方式に、ダイヤは毎月自動で始まる方式に変更し、車庫からの出庫は廃止しました。選ばなくても毎日違う天気・ダイヤで遊べます）\nこれからもよろしくお願いします！'
      },
      {
        id: 9,
        date: '2026/11/18',
        sender: '名無し運転士さん',
        q: '支線の終点すべてを結ぶ支線を作って！',
        a: 'ご意見ありがとうございます！白峰支線の奥峰、紫雲地下線の深雪、天宮高架線の峰月、港見支線の奥港——4つの支線の終点どうしを結ぶ新しい連絡線「四嶺連絡線」を作りました。\n全7駅・複線の各駅停車で、路線選択の「各支線」から乗務できます。ホーム見学（乗客モード）にも対応しています。'
      },
      {
        id: 8,
        date: '2026/11/18',
        sender: '天才運転士さん',
        q: 'どうやったら指令を解除できますか',
        a: 'ご質問ありがとうございます。ゲーム中の「指令」による停車・抑止は、次のように解除できます。\n・信号が赤（停止）のとき：同じ線路の前の列車が進むと自動で青に戻ります。赤のまま無理に進もうとするとATSが働いて非常ブレーキがかかります。\n・「待ち合わせ中」の表示が出ているとき：後続の列車が先に発車すると自動で解除されます。画面の「待ち合わせを終わる」ボタンでも解除できます。\n・トラブル発生モードで停車したとき：運転士タブレットが開くので、指令との連絡後に「▶️ 運転再開」を押すと運転を再開できます。\n・車庫や駅で停止したままのとき：扉を閉めてからATO（またはマスコン）で発車してください。\nもし解除できない場面があれば、そのときの画面を添えてご意見箱に送っていただけると助かります。'
      },
      {
        id: 7,
        date: '2026/11/18',
        sender: '海葡萄は？海葡萄は？さん',
        q: '汐見駅のホーム増やして！',
        a: 'ご意見ありがとうございます！汐見駅を6面12線から7面14線に増設しました。\n新しい13・14番線（島式ホーム）は、臨時列車や汐見始発の列車が使えるホームです（特急はv2.1.0から地下の専用ホームを使います）。ホームドア・乗車位置案内・発車案内表示・ホーム見学にも対応しています。'
      },
      {
        id: 6,
        date: '2026/11/18',
        sender: '名無し運転士さん',
        q: '電車の運行間隔が1から3分 の間隔にして',
        a: 'ご意見ありがとうございます。本線の列車の運行間隔を1〜3分間隔になるように調整しました。\n各駅停車・快速・特急・快速特急を合わせて、おおむね1〜3分おきに列車が来るようになっています（朝ラッシュはさらに多くなります）。支線も本数を増やし、朝ラッシュは2.5分間隔で運転します。'
      },
      {
        id: 5,
        date: '2026/11/18',
        sender: '海葡萄ではないさん',
        q: 'とても面白いゲームをありがとうございます！ ご意見↓ 夕映駅に快速が止まるように していただきたいです！',
        a: 'あそんでいただき、ありがとうございます！夕映駅を快速の停車駅に追加しました。\n快速の停車駅リスト・ダイヤ・自動運転・AI列車・車内/駅の放送・LCD表示もあわせて更新し、夕映駅に快速が停車するようになっています（快速特急はこれまでどおり通過します）。'
      },
      {
        id: 4,
        date: '2026/11/18',
        sender: '名無し運転士さん',
        q: '種別を追加してください。 特急を追加してほしいです。',
        a: 'ご意見ありがとうございます！新しい種別「特急」を追加しました。\n（※特急は v2.1.0 のアップデートにて廃止し、各停・快速・快速特急の3種別構成に戻しました）'
      },
      {
        id: 3,
        date: '2026/11/18',
        sender: '名無し運転士さん',
        q: 'アナウンスをもっと増やして！',
        a: 'ご意見ありがとうございます！アナウンスを大幅に増やしました（すべて事前録音の音声です）。\n特急の車内放送、天候（晴れ・曇り・雨・雪・霧）のお知らせ、車庫からの出庫・本線合流の放送、臨時列車・団体列車・変更ダイヤの放送、車内マナー（静かに・優先席・手すり）や乗り換えのご案内などを追加しています。'
      },
      {
        id: 2,
        date: '2026/11/16',
        sender: '名無し運転士さん',
        q: 'いつも面白いゲームをありがとうございます！\n警笛の種類を増やしていただいて欲しくて長く警笛が鳴らせるようにしていただきたいです！',
        a: '貴重なご意見をいただき、またいつも遊んでいただきありがとうございます。\nご要望いただいた「警笛の種類の追加（電笛・空笛・電＋空・ミュージックホーン2種）」と「長押しで長く警笛を鳴らせる機能」を実装しましたので、ぜひお試しください！'
      },
      {
        id: 1,
        date: '2026/11/14',
        sender: '名無し運転士さん',
        q: '楽しかったです！乗降促進の音を増やしてくれると嬉しいです。',
        a: '貴重なご意見をいただきありがとうございます。\n乗降促進の件ですが、今あるバグを修正した後増やす予定です。ご期待ください。'
      }
    ];

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
    }

    window.renderFeedbackReplies = function() {
      const list = document.getElementById('fbRepliesList');
      if (!list) return;
      list.innerHTML = '';
      (window.FEEDBACK_REPLIES || []).forEach(item => {
        const card = document.createElement('div');
        card.style.cssText = 'background:rgba(30,41,59,0.7);border:1px solid rgba(148,163,184,0.2);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;';
        
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:4px;';
        top.innerHTML = '<span>👤 ' + escapeHtml(item.sender) + '</span><span>' + escapeHtml(item.date) + '</span>';
        card.appendChild(top);

        const qBox = document.createElement('div');
        qBox.style.cssText = 'font-size:13px;color:#e2e8f0;line-height:1.5;background:rgba(15,23,42,0.5);border-radius:8px;padding:8px 10px;';
        qBox.innerHTML = '<span style="color:#38bdf8;font-weight:700;margin-right:4px;">Q.</span>' + escapeHtml(item.q);
        card.appendChild(qBox);

        const aBox = document.createElement('div');
        aBox.style.cssText = 'font-size:13px;color:#f8fafc;line-height:1.55;background:rgba(2,132,199,0.15);border:1px solid rgba(56,189,248,0.3);border-radius:8px;padding:8px 10px;white-space:pre-wrap;';
        aBox.innerHTML = '<div style="font-weight:800;color:#38bdf8;font-size:12px;margin-bottom:3px;display:flex;align-items:center;gap:4px;"><span>🛠️ 作者</span><span style="font-size:10.5px;color:#94a3b8;font-weight:normal;">（サトタケ / riku06568）</span></div>' + escapeHtml(item.a);
        if (item.img) {
          const img = document.createElement('img');
          img.src = item.img;
          img.style.cssText = 'max-width:100%;border-radius:6px;margin-top:6px;';
          aBox.appendChild(img);
        }
        card.appendChild(aBox);

        list.appendChild(card);
      });
    };
    window.renderFeedbackReplies();

    // 利用規約モーダル表示制御
    function checkAndShowTermsModal() {
      let answered = false;
      let seenNov15_16 = false;
      try {
        answered = localStorage.getItem('td_terms_answered') === 'true';
        seenNov15_16 = localStorage.getItem('td_terms_seen_nov15_16') === 'true';
      } catch(e) {}
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
      // 明日・明後日（2026年11月15日・16日）の二日間
      const isTargetDates = (y === 2026 && m === 11 && (d === 15 || d === 16));

      let shouldShow = false;
      if (!answered) {
        shouldShow = true; // 新規プレイヤー
      } else if (isTargetDates && !seenNov15_16) {
        shouldShow = true; // 明日と明後日の二日間
      }

      const modal = document.getElementById('termsModal');
      if (shouldShow && modal) {
        modal.classList.remove('hide');
      }

      const btnAgree = document.getElementById('btnTermsAgree');
      const btnDisagree = document.getElementById('btnTermsDisagree');
      if (btnAgree) {
        btnAgree.onclick = () => {
          try {
            localStorage.setItem('td_terms_answered', 'true');
            localStorage.setItem('td_terms_consent', 'agree');
            if (isTargetDates) localStorage.setItem('td_terms_seen_nov15_16', 'true');
          } catch(e) {}
          if (modal) modal.classList.add('hide');
          toast('✓ 利用規約に同意しました。ありがとうございます！', 'ok');
        };
      }
      if (btnDisagree) {
        btnDisagree.onclick = () => {
          try {
            localStorage.setItem('td_terms_answered', 'true');
            localStorage.setItem('td_terms_consent', 'disagree');
            if (isTargetDates) localStorage.setItem('td_terms_seen_nov15_16', 'true');
          } catch(e) {}
          if (modal) modal.classList.add('hide');
          toast('利用規約を確認しました（全機能を制限なくプレイできます）', 'info');
        };
      }
    }
    checkAndShowTermsModal();
  }
  
  let TUTORIAL_ENABLED = localStorage.getItem('shiomi_tutorial') === '1'; // 設定でオンにすると有効
  window.TUTORIAL_ENABLED = TUTORIAL_ENABLED;
  function setTutorialEnabled(on) {
    TUTORIAL_ENABLED = on;
    window.TUTORIAL_ENABLED = on;
    try { localStorage.setItem('shiomi_tutorial', on ? '1' : '0'); } catch(e) {}
    updTut();
    if (typeof updateTutorialHUD === 'function') updateTutorialHUD();
    toast(on ? '💡 チュートリアル表示をONにしました' : '💡 チュートリアル表示をOFFにしました', 'info');
  }
  function updTut() {
    const btnOff = document.getElementById('btnTutOff');
    const btnOn = document.getElementById('btnTutOn');
    if (btnOff) btnOff.classList.toggle('on', !TUTORIAL_ENABLED);
    if (btnOn) btnOn.classList.toggle('on', TUTORIAL_ENABLED);

    const qOff = document.getElementById('qTutOff');
    const qOn = document.getElementById('qTutOn');
    if (qOff) qOff.classList.toggle('on', !TUTORIAL_ENABLED);
    if (qOn) qOn.classList.toggle('on', TUTORIAL_ENABLED);

    const tOff = document.getElementById('btnTitleTutOff');
    const tOn = document.getElementById('btnTitleTutOn');
    if (tOff) tOff.classList.toggle('on', !TUTORIAL_ENABLED);
    if (tOn) tOn.classList.toggle('on', TUTORIAL_ENABLED);

    const tips = document.querySelectorAll('.menu-tut-tip');
    tips.forEach(t => t.classList.toggle('hide', !TUTORIAL_ENABLED));
    if (typeof updateTutorialHUD === 'function') updateTutorialHUD();
  }
  const btnTutOff = document.getElementById('btnTutOff');
  if (btnTutOff) btnTutOff.addEventListener('click', () => setTutorialEnabled(false));
  const btnTutOn = document.getElementById('btnTutOn');
  if (btnTutOn) btnTutOn.addEventListener('click', () => setTutorialEnabled(true));
  const qTutOff = document.getElementById('qTutOff');
  if (qTutOff) qTutOff.addEventListener('click', () => setTutorialEnabled(false));
  const qTutOn = document.getElementById('qTutOn');
  if (qTutOn) qTutOn.addEventListener('click', () => setTutorialEnabled(true));
  const tTutOff = document.getElementById('btnTitleTutOff');
  if (tTutOff) tTutOff.addEventListener('click', () => setTutorialEnabled(false));
  const tTutOn = document.getElementById('btnTitleTutOn');
  if (tTutOn) tTutOn.addEventListener('click', () => setTutorialEnabled(true));
  const bfr = document.getElementById('btnForceReload');
  if (bfr) bfr.addEventListener('click', () => {
    location.href = location.pathname + '?v=' + Date.now();
  });
  updTut();

  const btnShareX = document.getElementById('btnShareX');
  if (btnShareX) btnShareX.addEventListener('click', () => {
    let km = 0;
    try {
      const s = JSON.parse(localStorage.getItem('shiomi_driver_stats_v1') || '{}');
      km = Number(s.km || 0);
    } catch(e) {}
    const distStr = km > 0 ? `（累計走行距離: ${km.toFixed(1)} km）` : '';
    const text = `『汐見環状線 3Dトレインシミュレーター』をプレイ中！${distStr}\n全85駅・三複線を走る無料ブラウザ3D電車ゲーム！\n#汐見環状線3D #電車ゲーム #ブラウザゲーム`;
    const url = 'https://riku06568.github.io/train-driver-3d/';
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  });

  const btr = document.getElementById('btnTitleReturn');
  if (btr) btr.addEventListener('click', () => {
    if (confirm('乗務を終了してタイトル画面に戻りますか？')) {
      location.href = location.pathname;
    }
  });
try{refreshDailyCond();}catch(e){}
setInterval(()=>{try{refreshDailyCond();}catch(e){}},60000);
document.getElementById('stBack').addEventListener('click',()=>{document.getElementById('stSel').classList.add('hide');document.getElementById('home').classList.remove('hide');showHomeView(currentDutyView);});
})();
window.__boot=boot;
})();
