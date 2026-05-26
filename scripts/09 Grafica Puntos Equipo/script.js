
// Forzamos la URL de configuración directamente
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

// Cambiamos 'onWidgetLoad' por 'DOMContentLoaded' para ejecución estándar
window.addEventListener('DOMContentLoaded', function () {
    main(MY_CONFIG_URL); 
});

async function main(configUrl) { const config = await fetchConfigSE(configUrl); if (!config) return; if (typeof Chart==='undefined'||typeof ChartDataLabels==='undefined'){setTimeout(()=>initChart(config),500)}else{initChart(config)} }

async function fetchConfigSE(url) {
    // 1. Intentar cargar desde el servidor principal (JSONBin)
    try {
        console.log("Intentando cargar configuración desde JSONBin...");
        const response = await fetch(url + `?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`JSONBin respondió con estado: ${response.status}`);
        const configData = await response.json();
        return configData.record;
    } catch (error) {
        console.warn("Falló el servidor principal (JSONBin). Buscando respaldo en la raíz de GitHub...", error);
        
        // 2. Sistema de respaldo: Apuntar al config.json en la raíz (un nivel arriba)
        try {
            const backupResponse = await fetch(`../config.json?t=${new Date().getTime()}`);
            if (!backupResponse.ok) throw new Error(`No se encontró el config.json de respaldo en la raíz.`);
            const backupData = await backupResponse.json();
            
            console.log("¡Configuración de respaldo cargada con éxito desde la raíz de GitHub!");
            return backupData.record ? backupData.record : backupData;
        } catch (backupError) {
            console.error("Error crítico: Ambos servidores de configuración fallaron.", backupError);
            return null;
        }
    }
}

function applyColorConfig(config) { const root = document.documentElement; if (!root || !config.Themes || !config.active_theme_name) return; const activeTheme = config.Themes[config.active_theme_name]; if (!activeTheme) return; for (const key in activeTheme) { if (Object.hasOwnProperty.call(activeTheme, key)) { const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`; root.style.setProperty(cssVarName, activeTheme[key]); } } }
async function fetchSheetDataSE(gidKey, config) { const sheetId = config.Settings?.SPREADSHEET_ID; const apiKey = config.Settings?.API_KEY; let sheetName = ''; for (const key in config.GIDs) { if (key === gidKey) { sheetName = key.replace('GID_', ''); break; } } if (!sheetId || !apiKey || !sheetName) { return []; } if (apiKey.startsWith("AQUÍ")) { return []; } const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`; try { const response = await fetch(url); if (!response.ok) throw new Error(`Error de API: ${response.status}`); const jsonResponse = await response.json(); if (!jsonResponse.values || jsonResponse.values.length < 1) return []; const headers = jsonResponse.values[0]; const rows = jsonResponse.values.slice(1); return rows.map(row => { let obj = {}; headers.forEach((header, i) => { obj[header] = row[i] || ""; }); return obj; }); } catch (error) { console.error(`Error en fetchSheetDataSE para ${gidKey}:`, error); return []; } }
function setDynamicBackground(element, backgroundFileName, config) { const path = config.Settings?.PATH_BACKGROUNDS; if (path && element) { let imageUrlPng = `${path}${backgroundFileName}.png`; let imageUrlJpg = `${path}${backgroundFileName}.jpg`; const image = new Image(); image.src = imageUrlPng; image.onload = () => { element.style.backgroundImage = `url('${imageUrlPng}')`; }; image.onerror = () => { element.style.backgroundImage = `url('${imageUrlJpg}')`; }; } }

function initChart(config) {
    Chart.register(ChartDataLabels);
    // --- AJUSTE: Aumentamos el tamaño de fuente por defecto para 2K ---
    Chart.defaults.font.size = 16;

    const ctx = document.getElementById('puntosChart')?.getContext('2d');
    if (!ctx) return;
    setDynamicBackground(document.body, 'grafica_puntos_equipo', config);
    applyColorConfig(config);
    const DATA_REFRESH_INTERVAL = 60000;
    const maxTeamsToShow = parseInt(config.Settings.n_TeamsToShowInChart || '10');
    const teamColors = ['#FF6384','#36A2EB','#FFCE56','#4BC0C0','#9966FF','#FF9F40','#2ECC71','#E74C3C','#C9CBCF','#4D5360'];
    let myLineChart;
    const processDataForChart = (rawData) => { const topTeamsData = rawData.slice(0, maxTeamsToShow); let maxRounds = 0; topTeamsData.forEach(team => { const roundsPlayed = parseInt(team.Rondas, 10); if (!isNaN(roundsPlayed) && roundsPlayed > maxRounds) maxRounds = roundsPlayed; }); const labels = ['Start']; for (let i = 1; i <= maxRounds; i++) labels.push(`Map ${i}`); const datasets = topTeamsData.map((team, index) => { const dataPoints = [0.0]; for (let i = 1; i <= maxRounds; i++) { const mapKey = `Map${i}`; const score = parseFloat(team[mapKey] || 0); dataPoints.push(isNaN(score) ? 0 : score); } return { label: `${team.Top}. ${team.Equipo}`, data: dataPoints, borderColor: teamColors[index % teamColors.length], backgroundColor: teamColors[index % teamColors.length] + '33', fill: false, tension: 0.1, pointRadius: 5, pointBackgroundColor: teamColors[index % teamColors.length] }; }); return { labels, datasets }; };
    const updateLegend = (datasets) => { const t = document.getElementById("customLegend"); if (!t) return; t.style.gridTemplateRows = `repeat(${Math.ceil(datasets.length/2)}, auto)`, t.innerHTML = "", datasets.forEach(e => { const o = document.createElement("div"); o.className = "legend-item", o.innerHTML = `<div class="legend-color-box" style="background-color: ${e.borderColor}"></div><span>${e.label}</span>`, t.appendChild(o) }) };
    const matchpointLinePlugin = {id:"matchpointLine",beforeDraw:t=>{const e=(config.Settings.b_IsMatchpoint||"FALSE").toUpperCase()==="TRUE",o=parseInt(config.Settings.n_MatchpointThreshold,10);if(!e||isNaN(o))return;const activeTheme=config.Themes[config.active_theme_name];if(!activeTheme)return;const{ctx:n,chartArea:{top:a,right:r,bottom:i,left:l},scales:{y:s}}=t,d=s.getPixelForValue(o);d>=a&&d<=i&&(n.save(),n.strokeStyle=activeTheme.COLOR_MATCHPOINT_BORDER,n.lineWidth=2,n.setLineDash([6,6]),n.beginPath(),n.moveTo(l,d),n.lineTo(r,d),n.stroke(),n.fillStyle=activeTheme.COLOR_MATCHPOINT_BORDER,n.font="bold 16px Arial",n.textAlign="left",n.textBaseline="bottom",n.fillText("Matchpoint",l+5,d-5),n.restore())}};
    
    const refreshData = async () => {
        const rawData = await fetchSheetDataSE('GID_GrafPuntosEquipo', config);
        if (!Array.isArray(rawData) || rawData.length === 0) return;
        const { labels, datasets } = processDataForChart(rawData);
        updateLegend(datasets);
        const allScores=datasets.flatMap(t=>t.data),maxScore=Math.max(...allScores,parseInt(config.Settings.n_MatchpointThreshold||"0",10)),yAxisMax=10*Math.ceil(1.1*maxScore/10),chartData={labels,datasets};
        if(myLineChart){ myLineChart.data = chartData; myLineChart.options.scales.y.max = yAxisMax; myLineChart.update('none'); } 
        else { myLineChart=new Chart(ctx,{type:"line",data:chartData,plugins:[matchpointLinePlugin],options:{responsive:!0,maintainAspectRatio:!1,animation:!1,plugins:{legend:{display:!1},tooltip:{mode:"index",intersect:!1},datalabels:{display:(config.Settings.b_ShowDataLabelsOnChart||"TRUE").toUpperCase()==="TRUE",color:t=>t.dataset.borderColor,anchor:"end",align:"end",formatter:t=>t>0?Math.round(t):null,font:{weight:"bold",size:14},padding:4,textStrokeColor:"black",textStrokeWidth:2}},scales:{y:{beginAtZero:!0,max:yAxisMax,ticks:{color:"white",precision:0,font:{size:16}}},x:{ticks:{color:"white",font:{size:16}},grid:{color:"rgba(255,255,255,0.2)",borderDash:[5,5]}}}}}) }
    };

    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}