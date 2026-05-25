window.addEventListener('onWidgetLoad', function (obj) {
    const configUrl = obj.detail.fieldData.configUrl;
    if (!configUrl) return;
    main(configUrl);
});

// Definimos la URL manualmente ya que no estamos en StreamElements
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

window.addEventListener('DOMContentLoaded', async function () {
    // 1. Cargamos primero la configuración usando nuestro sistema de respaldo
    const config = await fetchConfigSE(MY_CONFIG_URL);
    if (config) {
        // 2. Ejecutamos la función inicializadora real del Ticker pasándole la config
        initTickerPuntos(config);
    } else {
        console.error("Error crítico: No se pudo obtener la configuración para el Ticker.");
    }
});

// --- FUNCIONES DE AYUDA ---
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
    for (const key in config.GIDs) { if (key === gidKey) { sheetName = key.replace('GID_', ''); break; } } 
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
    } catch (error) { console.error(`Error en fetchSheetDataSE para ${gidKey}:`, error); return []; } 
}

function renderGroupLegend(config) { 
    const legendContainer = document.getElementById("groupLegend"); 
    if (!legendContainer) return; 
    const enableGroupColors = (config.Settings.b_EnableGroupColors || "FALSE").toUpperCase() === "TRUE"; 
    if (!enableGroupColors) { legendContainer.innerHTML = ""; return; } 
    const groupsToShow = parseInt(config.Settings.n_GroupsToShowInLegend || "4", 10); 
    const activeTheme = config.Themes[config.active_theme_name]; 
    const groupInfo = [{ name: "Group A", color: activeTheme.COLOR_POSITION_BOX }, { name: "Group B", color: activeTheme.COLOR_GROUP_B_BOX }, { name: "Group C", color: activeTheme.COLOR_GROUP_C_BOX }, { name: "Group D", color: activeTheme.COLOR_GROUP_D_BOX }]; 
    let legendHTML = ""; 
    for (let i = 0; i < groupsToShow; i++) { 
        if (groupInfo[i] && groupInfo[i].color) { 
            legendHTML += `<div class="legend-item"><div class="legend-color-circle" style="background-color: ${groupInfo[i].color};"></div><span>${groupInfo[i].name}</span></div>`; 
        } 
    } 
    legendContainer.innerHTML = legendHTML; 
}

// --- LÓGICA ESPECÍFICA DEL TICKER ---
function initTickerPuntos(config) {
    const DATA_REFRESH_INTERVAL = 10000;
    applyColorConfig(config);
    renderGroupLegend(config);

    const tickerContainer = document.getElementById('tickerItems');
    if (!tickerContainer) return;

    // Variables de configuración de formato (Matchpoint y Clasificación)
    const isMatchpointMode = (config.Settings.b_IsMatchpoint || 'FALSE').toUpperCase() === 'TRUE';
    const matchpointThreshold = parseInt(config.Settings.n_MatchpointThreshold || '150', 10);
    const enableQualificationHighlight = (config.Settings.b_EnableQualificationHighlight || 'FALSE').toUpperCase() === 'TRUE';
    const qualificationThreshold = parseInt(config.Settings.n_QualificationThreshold || '10', 10);

    const totalTeamsConfig = parseInt(config.Settings.n_TotalTeams || '50', 10);
    const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
    
    // Configuraciones de vista
    const itemsPerView = parseInt(config.Settings.n_TickerItemsPerView || '5', 10);
    tickerContainer.style.gridTemplateColumns = `repeat(${itemsPerView}, 1fr)`;
    
    // Variables adicionales requeridas para Logos y Jugadores
    const showLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";
    const showPlayers = (config.Settings.b_TickerShowPlayers || 'FALSE').toUpperCase() === 'TRUE';
    const playersPerTeam = parseInt(config.Settings.n_PlayersPerTeam || '4', 10);

    const blockCycleInterval = 10000;
    let allData = [], currentBlockIndex = 0;

    const updateHeaderInfo = async () => {
        // Usamos tu función original, que extrae el nombre "Configuracion" de manera segura
        const configData = await fetchSheetDataSE("GID_Configuracion", config);
        
        // Verificamos que la hoja tenga datos
        if (configData && configData.length > 0) {
            const rowData = configData[0]; // configData[0] es la Fila 2 del Excel
            
            const elTitle = document.getElementById('tournamentTitle');
            const elFormat = document.getElementById('tournamentFormat');

            // Inyectamos los valores de H2 e I2 directamente a los textos
            if(elTitle) elTitle.textContent = rowData["Titulo"] || "";
            if(elFormat) elFormat.textContent = rowData["Formato"] || "";
        }
    };

    const getLogoHTML = (teamName) => {
        if (!showLogos || !logosPath || !teamName) return "";
        const cleanName = teamName.replace(/^Team\s+/i, '').trim().toLowerCase();
        const logoUrlPng = `${logosPath}${cleanName}.png`;
        const logoUrlJpg = `${logosPath}${cleanName}.jpg`;
        const defaultUrlPng = `${logosPath}default.png`;
        const defaultUrlJpg = `${logosPath}default.jpg`;
        const step4 = `this.onerror=null; this.style.display='none';`;
        const step3 = `function() { this.src='${defaultUrlJpg}'; this.onerror = function() { ${step4} }; }`;
        const step2 = `function() { this.src='${defaultUrlPng}'; this.onerror = ${step3}; }`;
        const onErrorLogic = `this.src='${logoUrlJpg}'; this.onerror = ${step2};`.replace(/"/g, "'").replace(/\n/g, " ");
        return `<div class="team-logo-container"><img src="${logoUrlPng}" class="team-logo" onerror="${onErrorLogic}"></div>`;
    };

    const createTeamItemHTML = (teamData) => {
        const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "" } = teamData;
        
        let specialClass = "";
        const numericPoints = parseFloat(Puntos);
        const numericTop = parseInt(Top, 10);
        
        // --- NUEVA LÓGICA DE RESALTADO ---
        if (isMatchpointMode) {
            if (!isNaN(numericPoints)) {
                if (numericPoints >= 998) specialClass = "match-winner";
                else if (numericPoints >= matchpointThreshold) specialClass = "matchpoint-active";
            }
        } else if (enableQualificationHighlight) {
            if (!isNaN(numericTop) && numericTop > 0 && numericTop <= qualificationThreshold) {
                specialClass = "matchpoint-active";
            }
        }

        let positionBoxStyle = '';
        if (enableGroupColors) {
            const activeTheme = config.Themes[config.active_theme_name];
            if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`;
            else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`;
            else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`;
        }

        const cleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();
        const logoHTML = getLogoHTML(Equipo);

        let playersStr = "";
        if (showPlayers) {
            let p = [];
            for (let i = 1; i <= playersPerTeam; i++) {
                if (teamData[`Jugador${i}`]) p.push(teamData[`Jugador${i}`]);
            }
            playersStr = p.join(' | ');
        }
        const playersDisplay = showPlayers ? "block" : "none";

        return `
            <div class="item-box ${specialClass}" data-team-name="${cleanName}">
                <div class="item-top" ${positionBoxStyle}>${Top}<span class="item-rounds">R${Rondas}</span></div>
                ${logoHTML}
                <div class="item-info">
                    <div class="item-team-name">${Equipo}</div>
                    <div class="item-players" style="display: ${playersDisplay};">${playersStr}</div>
                </div>
                <div class="item-points">${Puntos}</div>
            </div>`;
    };

    // Actualización inteligente (DOM Diffing) para anti-parpadeo
    const updateTeamItemDOM = (domElement, teamData) => {
        const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "" } = teamData;
        
        let specialClass = "";
        const numericPoints = parseFloat(Puntos);
        const numericTop = parseInt(Top, 10);
        
        // --- NUEVA LÓGICA DE RESALTADO ---
        if (isMatchpointMode) {
            if (!isNaN(numericPoints)) {
                if (numericPoints >= 998) specialClass = "match-winner";
                else if (numericPoints >= matchpointThreshold) specialClass = "matchpoint-active";
            }
        } else if (enableQualificationHighlight) {
            if (!isNaN(numericTop) && numericTop > 0 && numericTop <= qualificationThreshold) {
                specialClass = "matchpoint-active";
            }
        }
        domElement.className = `item-box ${specialClass}`;

        const elTop = domElement.querySelector('.item-top');
        const elName = domElement.querySelector('.item-team-name');
        const elPoints = domElement.querySelector('.item-points');
        const elPlayers = domElement.querySelector('.item-players');
        const elLogoContainer = domElement.querySelector('.team-logo-container');

        if (elTop) {
            elTop.innerHTML = `${Top}<span class="item-rounds">R${Rondas}</span>`;
            elTop.style.backgroundColor = ""; 
            if (enableGroupColors) {
                const activeTheme = config.Themes[config.active_theme_name];
                if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_B_BOX;
                else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_C_BOX;
                else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_D_BOX;
            }
        }

        if (elName) elName.textContent = Equipo;
        if (elPoints) elPoints.textContent = Puntos;

        if (showPlayers && elPlayers) {
            let players = [];
            for (let i = 1; i <= playersPerTeam; i++) {
                if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]);
            }
            elPlayers.textContent = players.join(' | ');
            elPlayers.style.display = "block";
        } else if (elPlayers) {
            elPlayers.style.display = "none";
        }

        // Lógica de Logo anti-parpadeo
        if (showLogos && logosPath) {
            const newCleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();
            const currentCleanName = domElement.dataset.teamName;
            
            if (newCleanName !== currentCleanName) {
                domElement.dataset.teamName = newCleanName;
                const newLogoHTML = getLogoHTML(Equipo);
                if (elLogoContainer) {
                    elLogoContainer.outerHTML = newLogoHTML;
                } else {
                    if(elTop) elTop.insertAdjacentHTML('afterend', newLogoHTML);
                }
            }
        } else if (!showLogos && elLogoContainer) {
            elLogoContainer.remove();
        }
    };

    const displayCurrentBlock = () => { 
        if (!tickerContainer) return; 
        if (allData.length === 0) {
            tickerContainer.innerHTML = "";
            return;
        }

        const start = currentBlockIndex * itemsPerView; 
        const blockData = allData.slice(start, start + itemsPerView); 

        // Recuperar cajas actuales para evitar parpadeos
        const currentItems = tickerContainer.querySelectorAll('.item-box');

        // Si tenemos exactamente el mismo numero de cajas, actualizamos en vivo
        if (currentItems.length === blockData.length) {
            blockData.forEach((team, index) => {
                updateTeamItemDOM(currentItems[index], team);
            });
        } else {
            // Si la cantidad de items de la página cambia, regeneramos el HTML
            let newHTML = ""; 
            blockData.forEach(team => { newHTML += createTeamItemHTML(team); }); 
            tickerContainer.innerHTML = newHTML; 
        }
    };
    
    const cycleToNextBlock = () => { 
        const totalBlocks = Math.ceil(allData.length / itemsPerView); 
        currentBlockIndex = totalBlocks > 0 ? (currentBlockIndex + 1) % totalBlocks : 0; 
        displayCurrentBlock(); 
    };
    
    const refreshData = async () => {
        const fetchedData = await fetchSheetDataSE("GID_PuntosEquipo", config);
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            allData = fetchedData.slice(0, totalTeamsConfig);
            if (currentBlockIndex >= Math.ceil(allData.length / itemsPerView)) {
                currentBlockIndex = 0;
            }
        }
        await updateHeaderInfo();
    };
    
    refreshData().then(() => {
        displayCurrentBlock();
        if (allData.length > itemsPerView) { setInterval(cycleToNextBlock, blockCycleInterval); }
        setInterval(refreshData, DATA_REFRESH_INTERVAL);
    });
}