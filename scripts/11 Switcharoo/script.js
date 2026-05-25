// Variables globales para el timer
let timerInterval = null;
let timeLeft = 0;
let timerPaused = false;
let previousTimerState = "";
let previousRespinFee = null;
let timerDuration = 300000; 

// Definimos la URL manualmente ya que no estamos en StreamElements
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

window.addEventListener('DOMContentLoaded', function () {
    // Usamos la URL que definimos arriba directamente
    main(MY_CONFIG_URL); 
});

async function main(configUrl) {
    const config = await fetchConfigSE(configUrl);
    if (!config) return;
    
    timerDuration = parseInt(config.Settings.n_SwitcharooTimerStart || '300000', 10);
    timeLeft = timerDuration; 

    setupCanvas(config);
    initSwitcharoo(config);
}

function setupCanvas(config) { const canvasWidth = parseInt(config.Settings?.n_CanvasWidth || '1920', 10); const canvasHeight = parseInt(config.Settings?.n_CanvasHeight || '1080', 10); const baseWidth = 1920; document.body.style.width = `${canvasWidth}px`; document.body.style.height = `${canvasHeight}px`; const wrapper = document.querySelector('.scale-wrapper'); if (wrapper) { const scaleFactor = canvasWidth / baseWidth; wrapper.style.transform = `scale(${scaleFactor})`; } }

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

async function fetchSheetDataSE(gidKey, config) { 
    const sheetId = config.Settings?.SPREADSHEET_ID; 
    const apiKey = config.Settings?.API_KEY; 
    let sheetName = ''; 
    for (const key in config.GIDs) { 
        if (key === gidKey) { 
            sheetName = key.replace('GID_', ''); 
            break; 
        } 
    } 
    if (!sheetId || !apiKey || !sheetName) return []; 
    if (apiKey.startsWith("AQUÍ")) return []; 
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}&t=${new Date().getTime()}`; 
    
    try { 
        const response = await fetch(url, { cache: 'no-store' }); 
        if (!response.ok) throw new Error(`Error de API: ${response.status}`); 
        const jsonResponse = await response.json(); 
        if (!jsonResponse.values || jsonResponse.values.length < 1) return []; 
        const headers = jsonResponse.values[0]; 
        const rows = jsonResponse.values.slice(1); 
        return rows.map(row => { 
            let obj = {}; 
            headers.forEach((header, i) => { obj[header] = row[i] || ""; }); 
            return obj; 
        }); 
    } catch (error) { 
        return []; 
    } 
}

function setDynamicBackground(element, backgroundFileName, config) { if (element.style.backgroundImage) return; const path = config.Settings?.PATH_BACKGROUNDS; if (path && element) { let imageUrlPng = `${path}${backgroundFileName}.png`; let imageUrlJpg = `${path}${backgroundFileName}.jpg`; const image = new Image(); image.src = imageUrlPng; image.onload = () => { element.style.backgroundImage = `url('${imageUrlPng}')`; }; image.onerror = () => { element.style.backgroundImage = `url('${imageUrlJpg}')`; }; } }

function initSwitcharoo(config) {
    setDynamicBackground(document.body, 'switcharoo', config);
    applyColorConfig(config);
    
    const gridContainer = document.getElementById('gridContainer');
    const infoHeader = document.getElementById('infoHeader');
    if (!gridContainer) return;

    // --- VARIABLES Y LÓGICA DE GRID ---
    const totalTeams = parseInt(config.Settings.n_TotalTeams || '50', 10);
    const playersPerTeam = parseInt(config.Settings.n_PlayersPerTeam || '4', 10);
    const offset = parseInt(config.Settings.n_SwitcharooOffset || '0', 10);

    // Posicionamiento de Grid desde el centro
    gridContainer.style.top = "50%";
    gridContainer.style.transform = `translateY(calc(-50% + ${offset}px))`;

    // Restricción a Máximo 3 Columnas
    const columns = 3;
    const rowsCalc = Math.ceil(totalTeams / columns);
    gridContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rowsCalc}, 66px)`;

    // --- VARIABLES DE CATEGORÍAS ---
    // CORRECCIÓN: Se lee la variable correcta b_EnableSwitchCategories
    const enableCategories = (config.Settings.b_EnableSwitchCategories || config.Settings.b_EnableSwtichCategories || 'FALSE').toUpperCase() === 'TRUE';
    const catHeaders = (config.Settings.s_SwitcharooHeaders || "").split(',').map(s => s.trim());
    const catKeys = (config.Settings.s_SwitcharooDataKeys || "").split(',').map(s => s.trim());
    
    const activeTheme = config.Themes[config.active_theme_name];
    const categoryColors = [
        activeTheme.COLOR_POSITION_BOX,
        activeTheme.COLOR_GROUP_B_BOX || activeTheme.COLOR_POSITION_BOX,
        activeTheme.COLOR_GROUP_C_BOX || activeTheme.COLOR_POSITION_BOX,
        activeTheme.COLOR_GROUP_D_BOX || activeTheme.COLOR_POSITION_BOX
    ];

    // --- RENDERIZAR LEYENDA DE CATEGORÍAS ---
    const legendContainer = document.getElementById("categoryLegend");
    if (legendContainer) {
        if (enableCategories && catHeaders.length > 0 && catHeaders[0] !== "") {
            let legendHTML = "";
            const maxLegends = Math.min(catHeaders.length, categoryColors.length);
            for (let i = 0; i < maxLegends; i++) {
                legendHTML += `<div class="legend-item"><div class="legend-color-circle" style="background-color: ${categoryColors[i]};"></div><span>${catHeaders[i]}</span></div>`;
            }
            legendContainer.innerHTML = legendHTML;
        } else {
            legendContainer.innerHTML = "";
        }
    }

    // --- LECTURA DE TÍTULO Y FORMATO ---
    const updateHeaderInfo = async () => {
        if (!infoHeader) return;
        const configData = await fetchSheetDataSE("GID_Configuracion", config);
        
        if (configData && configData.length > 0) {
            const rowData = configData[0]; // Fila 2
            const elTitle = document.getElementById('tournamentTitle');
            const elFormat = document.getElementById('tournamentFormat');

            if(elTitle) elTitle.textContent = rowData["Titulo"] || "";
            if(elFormat) elFormat.textContent = rowData["Formato"] || "";
        }
    };

    // --- POSICIÓN DEL FOOTER (DEBAJO DE LA BARRA INFERIOR) ---
    const updateHeaderPosition = () => {
        if (!infoHeader) return;
        const gridHeight = (rowsCalc * 66) + ((rowsCalc - 1) * 12);
        const canvasCenterY = 540; 
        const bottomGridY = canvasCenterY + offset + (gridHeight / 2);
        
        // CORRECCIÓN: La barra del Switcharoo termina en y=960. Lo colocamos en 980 para que quede debajo.
        const targetTop = 970; 
        const minTop = Math.max(bottomGridY + 120, 970); // Si la cuadrícula crece muchísimo, la empuja
        const finalTop = Math.max(targetTop, minTop);
        
        infoHeader.style.top = finalTop + "px";
    };

    const createTeamItemHTML = (teamData) => {
        const { Top = "#", Grupo = "" } = teamData;
        
        let playerSpans = [];
        
        for (let i = 0; i < playersPerTeam; i++) {
            let key = (catKeys.length > i && catKeys[i] !== "") ? catKeys[i] : `Jugador${i+1}`;
            let playerName = teamData[key];
            
            // CORRECCIÓN: Plan B (Fallback) por si en el config pusieron "Category1" pero la columna de Sheets dice "Jugador1"
            if (!playerName) {
                playerName = teamData[`Jugador${i+1}`];
            }
            
            if (playerName) {
                if (enableCategories) {
                    let pColor = categoryColors[i] || "#FFFFFF";
                    playerSpans.push(`<span style="color: ${pColor};">${playerName}</span>`);
                } else {
                    playerSpans.push(`<span>${playerName}</span>`);
                }
            }
        }
        
        let playersHTML = playerSpans.join('<span style="color: white;"> | </span>');
        
        let positionBoxStyle = '';
        const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
        if (enableGroupColors && !enableCategories) {
            if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`;
            else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`;
            else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`;
        }
        
        return `<div class="item-box"><div class="item-top" ${positionBoxStyle}>${Top}</div><div class="item-info"><div class="item-players">${playersHTML}</div></div></div>`;
    };

    function displayAllTeams(allData) {
        if (!gridContainer) return;
        let newHTML = "";
        const displayData = allData.slice(0, totalTeams);
        displayData.forEach(team => { newHTML += createTeamItemHTML(team); });
        gridContainer.innerHTML = newHTML;
        gridContainer.style.opacity = "1";
        
        if (infoHeader) infoHeader.style.opacity = "1";
        updateHeaderPosition();
    }

    function updateGlobalBar(settings) {
        const prizePoolEl = document.getElementById('prizePoolBox').querySelector('.value');
        const respinPoolEl = document.getElementById('respinPoolBox').querySelector('.value');
        if (prizePoolEl) prizePoolEl.textContent = settings.PrizePool || '$0';
        
        const respinPool = settings.RespinPool || '$0';
        const newRespinFee = settings.RespinFee || '$0';
        if (respinPoolEl) {
            respinPoolEl.textContent = `${respinPool} / ${newRespinFee}`;
        }
        
        const newTimerState = settings.Timer || "STOP";
        const timerElement = document.getElementById('timerBox').querySelector('.value');
        
        if (previousRespinFee === null) {
            previousRespinFee = newRespinFee;
        }

        if (newRespinFee !== previousRespinFee) {
            previousRespinFee = newRespinFee; 
            previousTimerState = "RESTART"; 
            
            clearInterval(timerInterval);
            timeLeft = timerDuration; 
            timerPaused = false;
            runTimer(timerElement);
            return; 
        }

        if (newTimerState === previousTimerState) return; 

        clearInterval(timerInterval);

        if (newTimerState === "RESUME") {
            if (previousTimerState === "STOP") timeLeft = timerDuration;
            timerPaused = false;
            runTimer(timerElement);
        }
        else if (newTimerState === "START") {
            if (previousTimerState === "STOP") timerElement.textContent = "TIMEOUT";
            else if (previousTimerState === "PAUSE") {
                timerPaused = false;
                runTimer(timerElement);
            } else {
                timeLeft = timerDuration; 
                timerPaused = false;
                runTimer(timerElement);
            }
        }
        else if (newTimerState === "RESTART") {
            timeLeft = timerDuration; 
            timerPaused = false;
            runTimer(timerElement);
        } 
        else if (newTimerState === "PAUSE") {
            timerPaused = true;
        } 
        else if (newTimerState === "STOP") {
            timerPaused = true;
            timeLeft = 0;
            timerElement.textContent = "TIMEOUT";
        }
        
        previousTimerState = newTimerState; 
    }

    const refreshAllData = async () => {
        await updateHeaderInfo();
        
        const fetchedData = await fetchSheetDataSE("GID_Switcharoo", config);
        if (!Array.isArray(fetchedData) || fetchedData.length === 0) return;

        const settings = fetchedData[0];
        updateGlobalBar(settings);
        displayAllTeams(fetchedData);
    };

    runTimer(document.getElementById('timerBox').querySelector('.value'));
    refreshAllData();
    setInterval(refreshAllData, 3000); 
}

function runTimer(element) {
    if (!element) return;
    
    const tick = () => {
        if (timerPaused) {
            clearInterval(timerInterval);
            return;
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            element.textContent = "TIMEOUT";
            previousTimerState = "STOP"; 
            return;
        }
        
        timeLeft -= 1000; 
        
        const minutes = Math.floor((timeLeft / 1000) / 60);
        const seconds = Math.floor((timeLeft / 1000) % 60);
        element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    tick(); 
    timerInterval = setInterval(tick, 1000);
}