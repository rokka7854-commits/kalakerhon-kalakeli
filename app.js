const state = { lat: 60.1699, lon: 24.9384, name: "Helsinki", timezone: "Europe/Helsinki" };
const $ = (id) => document.getElementById(id);
let deferredPrompt;

const weatherCodes = { 0:["Selkeää","☀"],1:["Enimmäkseen selkeää","◔"],2:["Puolipilvistä","◒"],3:["Pilvistä","☁"],45:["Sumua","≋"],48:["Huurresumua","≋"],51:["Tihkusadetta","☂"],53:["Tihkusadetta","☂"],55:["Tihkusadetta","☂"],61:["Vesisadetta","☂"],63:["Vesisadetta","☂"],65:["Vesisadetta","☂"],71:["Lumikuuroja","❄"],73:["Lumikuuroja","❄"],75:["Lumisadetta","❄"],80:["Sadekuuroja","☂"],81:["Sadekuuroja","☂"],82:["Sadekuuroja","☂"],95:["Ukkosta","ϟ"],96:["Ukkoskuuroja","ϟ"],99:["Ukkoskuuroja","ϟ"] };

function formatTime(date) { return new Intl.DateTimeFormat("fi-FI", { hour:"2-digit", minute:"2-digit", timeZone:state.timezone }).format(date); }
function dateText() { return new Intl.DateTimeFormat("fi-FI", { weekday:"long", day:"numeric", month:"long", timeZone:state.timezone }).format(new Date()); }
function degToDirection(deg) { const dirs=["P","PPKO","KO","IKKO","I","ILKO","L","LLKO","L","LLKA","LÄ","ELÄ","E","ELO","LO","LLO","PLO"]; return dirs[Math.round(deg/22.5)%16]; }
function pad(v) { return String(v).padStart(2,"0"); }

function sunTimes(date, lat, lon) {
  const rad=Math.PI/180, day=Math.floor((Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate())-Date.UTC(date.getUTCFullYear(),0,0))/86400000);
  const gamma=2*Math.PI/365*(day-1+(date.getUTCHours()-12)/24);
  const eq=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
  const dec=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
  const zen=90.833*rad, ha=Math.acos(Math.min(1,Math.max(-1,(Math.cos(zen)/(Math.cos(lat*rad)*Math.cos(dec))-Math.tan(lat*rad)*Math.tan(dec)))))/rad;
  const tzOffset=-new Date().getTimezoneOffset();
  const rise=720-4*(lon+ha)-eq+tzOffset, set=720-4*(lon-ha)-eq+tzOffset;
  const toDate=(mins)=>new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),0,Math.round(mins)));
  return { rise:toDate(rise), set:toDate(set) };
}

function lunarAge(date) { const known=Date.UTC(2000,0,6,18,14); return ((date.getTime()-known)/86400000%29.530588853+29.530588853)%29.530588853; }
function moonInfo(date) { const age=lunarAge(date), pct=(1-Math.cos(2*Math.PI*age/29.530588853))/2; let label="Kasvava sirppi", icon="☾"; if(age<1.85||age>27.68){label="Uusikuu";icon="●";} else if(age<7.38){label="Kasvava kuu";icon="◔";} else if(age<9.23){label="Ensimmäinen neljännes";icon="◐";} else if(age<14.77){label="Kasvava kuu";icon="◕";} else if(age<16.61){label="Täysikuu";icon="○";} else if(age<22.15){label="Vähenevä kuu";icon="◕";} else if(age<24){label="Viimeinen neljännes";icon="◐";} else {label="Vähenevä sirppi";icon="◔";} return { age, pct, label, icon }; }
function calculateFishing(date) {
  const moon=moonInfo(date), phaseBoost=Math.abs(Math.cos(Math.PI*moon.age/14.765));
  const seasonal=0.35+0.25*Math.cos((new Date().getMonth()-5)*Math.PI/6);
  const score=Math.min(5,Math.max(1,Math.round(2.1+1.65*phaseBoost+seasonal)));
  const labels=["Heikko","Kohtalainen","Hyvä","Erittäin hyvä","Erinomainen"];
  const base=(moon.age/29.530588853*24 + state.lon/15)%24;
  const range=(hour)=>`${pad(Math.floor((hour+24)%24))}.${pad(Math.round(((hour+24)%1)*60))}–${pad(Math.floor((hour+1.7+24)%24))}.${pad(Math.round((((hour+1.7)+24)%1)*60))}`;
  $("fishScore").textContent=score+"/5"; $("fishLabel").textContent=labels[score-1]+" kalakeli";
  $("fishExplanation").textContent=`${moon.label} ja päivän valo tukevat aktiivisimpia hetkiä.`;
  $("morningBite").textContent=range(base-4.5); $("eveningBite").textContent=range(base+7.5);
  $("fishScale").innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<score?"active":""}"></span>`).join("");
  $("moonPhase").textContent=`${moon.label} ${Math.round(moon.pct*100)} %`; $("moonIcon").textContent=moon.icon;
}

async function getWeather() {
  $("weatherTitle").textContent="Haetaan säätä…";
  const vars="temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m";
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current=${vars}&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,weather_code&daily=sunrise,sunset&forecast_days=2&timezone=auto`;
  try {
    const response=await fetch(url); if(!response.ok) throw new Error("Säähaku ei onnistunut");
    const data=await response.json(); state.timezone=data.timezone||state.timezone; const c=data.current; const [description,symbol]=weatherCodes[c.weather_code]||["Vaihtelevan pilvistä","◌"];
    $("weatherTitle").textContent=state.name; $("weatherSymbol").textContent=symbol; $("temperature").textContent=`${Math.round(c.temperature_2m)}°`; $("weatherDescription").textContent=description;
    $("sunrise").textContent=data.daily.sunrise[0].slice(11); $("sunset").textContent=data.daily.sunset[0].slice(11);
    $("wind").textContent=`${Math.round(c.wind_speed_10m)} m/s ${degToDirection(c.wind_direction_10m)}`; $("gusts").textContent=`${Math.round(c.wind_gusts_10m)} m/s`; $("pressure").textContent=`${Math.round(c.pressure_msl)} hPa`;
    $("rain").textContent=`${Number(c.precipitation).toFixed(1)} mm`; $("clouds").textContent=`${Math.round(c.cloud_cover)} %`; $("humidity").textContent=`${Math.round(c.relative_humidity_2m)} %`;
    const now=new Date(), currentHour=now.getHours(), cells=[];
    for(let i=1;i<=6;i++){const index=Math.min(data.hourly.time.length-1,currentHour+i); const [_,s]=weatherCodes[data.hourly.weather_code[index]]||["","◌"]; cells.push(`<div class="forecast-cell"><span>${String((currentHour+i)%24).padStart(2,"0")}.00</span><b>${s}</b><small>${Math.round(data.hourly.wind_speed_10m[index])} m/s</small><small>${data.hourly.precipitation_probability[index]??0} % sade</small></div>`);}
    $("forecastStrip").innerHTML=cells.join("");
  } catch(error) { $("weatherTitle").textContent="Säähaku ei onnistunut"; $("weatherDescription").textContent="Tarkista verkkoyhteys ja yritä uudelleen."; $("forecastStrip").innerHTML="<p>Sääennustetta ei saatu juuri nyt.</p>"; }
}

function renderAstronomy() { const now=new Date(); $("todayDate").textContent=dateText(); calculateFishing(now); }
function updateWindy() { $("windyLink").href=`https://www.windy.com/${state.lat.toFixed(4)}/${state.lon.toFixed(4)}?${state.lat.toFixed(4)},${state.lon.toFixed(4)},9,i:wind`; }
function refresh() { $("locationStatus").textContent=`Käytössä: ${state.name}`; renderAstronomy(); updateWindy(); getWeather(); }

$("locateButton").addEventListener("click",()=>{ if(!navigator.geolocation){ $("locationStatus").textContent="Selain ei tue paikannusta."; return; } $("locationStatus").textContent="Haetaan sijaintia…"; navigator.geolocation.getCurrentPosition((pos)=>{ state.lat=pos.coords.latitude; state.lon=pos.coords.longitude; state.name="Oma sijainti"; refresh(); },()=>{ $("locationStatus").textContent="Paikannus ei onnistunut. Voit hakea paikan nimellä."; },{enableHighAccuracy:false,timeout:10000}); });
$("searchForm").addEventListener("submit",async(e)=>{ e.preventDefault(); const query=$("placeInput").value.trim(); if(!query) return; $("locationStatus").textContent="Haetaan paikkaa…"; try { const res=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=fi&format=json`); const data=await res.json(); const result=data.results?.[0]; if(!result) throw new Error("Paikkaa ei löytynyt"); state.lat=result.latitude; state.lon=result.longitude; state.name=[result.name,result.admin1,result.country].filter(Boolean).join(", "); refresh(); } catch { $("locationStatus").textContent="Paikkaa ei löytynyt. Kokeile paikkakuntaa tai järven nimeä."; } });

window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();deferredPrompt=e;$("installButton").hidden=false;});
$("installButton").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installButton").hidden=true;});
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
refresh();
