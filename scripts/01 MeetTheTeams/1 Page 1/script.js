// ==========================================
// MODO DEBUG - Cámbialo a false para apagar los mensajes en consola
const DEBUG_MODE = true; 
// ==========================================

let lastDataJSON = "";

// Definimos la URL manualmente ya que no estamos en StreamElements
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

window.addEventListener('DOMContentLoaded', function () {
    // Usamos la URL que definimos arriba directamente
    main(MY_CONFIG_URL); 
});

async function main(configUrl) {
    const config = await fetchConfigSE(configUrl);
    if (!config) return;
    setupCanvas(config);
    initMeetTheTeams(config);
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

// FUNCIÓN BASE ORIGINAL CON DEBUG AÑADIDO
async function fetchSheetDataSE(gidKey, config) { 
    if(DEBUG_MODE) console.log(`[DEBUG] Intentando leer: ${gidKey}`);
    const sheetId = config.Settings?.SPREADSHEET_ID; 
    const apiKey = config.Settings?.API_KEY; 
    let sheetName = ''; 
    for (const key in config.GIDs) { if (key === gidKey) { sheetName = key.replace('GID_', ''); break; } } 
    
    if (!sheetId || !apiKey || !sheetName) { 
        if(DEBUG_MODE) console.warn(`[DEBUG] Faltan credenciales o GID para: ${gidKey}`);
        return []; 
    } 
    if (apiKey.startsWith("AQUÍ")) { return []; } 
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}&t=${new Date().getTime()}`; 
    try { 
        const response = await fetch(url, { cache: 'no-store' }); 
        if (!response.ok) {
            if(DEBUG_MODE) console.error(`[DEBUG] Error de red leyendo ${sheetName}. Status: ${response.status}`);
            throw new Error(`Error de API: ${response.status}`); 
        }
        const jsonResponse = await response.json(); 
        if (!jsonResponse.values || jsonResponse.values.length < 1) {
            if(DEBUG_MODE) console.warn(`[DEBUG] La hoja ${sheetName} está vacía.`);
            return []; 
        }
        const headers = jsonResponse.values[0]; 
        const rows = jsonResponse.values.slice(1); 
        
        if(DEBUG_MODE) console.log(`[DEBUG] Datos leídos correctamente de ${sheetName}. Filas: ${rows.length}`);
        
        return rows.map(row => { 
            let obj = {}; 
            headers.forEach((header, i) => { obj[header] = row[i] || ""; }); 
            return obj; 
        }); 
    } catch (error) { 
        if(DEBUG_MODE) console.error(`[DEBUG] Catch Error en fetchSheetDataSE para ${gidKey}:`, error); 
        return []; 
    } 
}

function setDynamicBackground(element, backgroundFileName, config) { if (element.style.backgroundImage) return; const path = config.Settings?.PATH_BACKGROUNDS; if (path && element) { let imageUrlPng = `${path}${backgroundFileName}.png`; let imageUrlJpg = `${path}${backgroundFileName}.jpg`; const image = new Image(); image.src = imageUrlPng; image.onload = () => { element.style.backgroundImage = `url('${imageUrlPng}')`; }; image.onerror = () => { element.style.backgroundImage = `url('${imageUrlJpg}')`; }; } }

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

function initMeetTheTeams(config) {
    // === CAMBIA ESTO A 2 PARA TU SEGUNDO OVERLAY ===
    const PAGE_TO_SHOW = 1; 
    // ===============================================
    
    const DATA_REFRESH_INTERVAL = 10000;
    
    if(DEBUG_MODE) console.log("[DEBUG] Inicializando MeetTheTeams...");

    const showPlayerPhotos = (config.Settings.b_ShowPlayerPhotos || 'FALSE').toUpperCase() === 'TRUE';
    const bgName = showPlayerPhotos ? 'conoce_los_equipos_2' : 'conoce_los_equipos';
    
    setDynamicBackground(document.body, bgName, config);
    applyColorConfig(config);
    renderGroupLegend(config);
    
    const gridContainer = document.getElementById('gridContainer');
    const infoHeader = document.getElementById('infoHeader');
    
    if (!gridContainer) {
        if(DEBUG_MODE) console.error("[DEBUG] HTML incompleto: No se encontró gridContainer");
        return;
    }

    const showLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";
    const playersPath = config.Settings.PATH_PLAYER_PHOTOS || ""; 
    
    let offset = 0;
    if (showPlayerPhotos) {
        offset = parseInt(config.Settings.n_MeetTheTeams2Offset || config.Settings.n_MeetTheTeamsOffset || '0', 10);
    } else {
        offset = parseInt(config.Settings.n_MeetTheTeamsOffset || '0', 10);
    }

    gridContainer.style.top = "50%";
    gridContainer.style.transform = `translateY(calc(-50% + ${offset}px))`;

    const totalTeamsConfig = parseInt(config.Settings.n_TotalTeams || '50', 10);
    const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
    const playersPerTeam = parseInt(config.Settings.n_PlayersPerTeam || '4', 10);
    let allData = [];

    let cols = 3;
    let rows = 0;
    let rowHeight = 66; 
    let gap = 12;

    if (showPlayerPhotos) {
        gridContainer.classList.add('with-photos');
        cols = 4;
        rows = Math.ceil(totalTeamsConfig / cols);
        rowHeight = 200;
    } else {
        gridContainer.classList.remove('with-photos');
        cols = 3; // Forzamos siempre a 3 columnas
        rows = 10; // Base inicial máxima
        rowHeight = 66;
    }
    
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gridContainer.style.gridTemplateRows = `repeat(${rows}, ${rowHeight}px)`;

    // --- POSICIÓN DEL ENCABEZADO ---
    const updateHeaderPosition = () => {
        if (!infoHeader) return;
        const gridHeight = (rows * rowHeight) + ((rows - 1) * gap);
        const canvasCenterY = 540; 
        const bottomGridY = canvasCenterY + offset + (gridHeight / 2);
        
        const targetTop = 960; 
        const minTop = bottomGridY + 30; 
        const finalTop = Math.max(targetTop, minTop);
        
        if(DEBUG_MODE) console.log(`[DEBUG] Posicionando Header: Bottom del Grid=${bottomGridY}, Top Final=${finalTop}`);
        infoHeader.style.top = finalTop + "px";
    };

    // --- LECTURA DE TÍTULO Y FORMATO ---
    const updateHeaderInfo = async () => {
        if (!infoHeader) return;
        const configData = await fetchSheetDataSE("GID_Configuracion", config);
        
        if (configData && configData.length > 0) {
            const rowData = configData[0]; // Fila 2 de sheets
            if(DEBUG_MODE) console.log("[DEBUG] Leyendo Titulo y Formato de Fila 2:", rowData);
            
            const elTitle = document.getElementById('tournamentTitle');
            const elFormat = document.getElementById('tournamentFormat');

            if (elTitle) elTitle.textContent = rowData["Titulo"] || "";
            if (elFormat) elFormat.textContent = rowData["Formato"] || "";
        } else {
            if(DEBUG_MODE) console.warn("[DEBUG] La lectura de GID_Configuracion devolvió vacío.");
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

    const getPhotosHTML = (players) => {
        if (!showPlayerPhotos || !playersPath) return "";
        let html = `<div class="player-photos-block">`;
        players.forEach((player) => {
            if (!player) return;
            const cleanPlayerName = player.trim().replace(/[^a-zA-Z0-9_ ]/g, '').toLowerCase();
            const photoUrl = `${playersPath}NoBackground/${cleanPlayerName}.png`;
            const defaultUrl = `${playersPath}NoBackground/default.png`;
            const onErrorLogic = `this.onerror=null; this.src='${defaultUrl}';`.replace(/"/g, "'");
            html += `<div class="player-slot"><img src="${photoUrl}" class="player-silhouette" data-player-name="${player}" onerror="${onErrorLogic}"></div>`;
        });
        html += `</div>`;
        return html;
    };

    const createTeamItemHTML = (teamData) => {
        const { Top = "#", Equipo = "N/A", Grupo = "" } = teamData;
        let players = [];
        for (let i = 1; i <= playersPerTeam; i++) {
            if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]);
        }
        let playersHTML = players.join(' | ');
        let positionBoxStyle = '';
        if (enableGroupColors) {
            const activeTheme = config.Themes[config.active_theme_name];
            if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`;
            else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`;
            else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`;
        }
        const logoHTML = getLogoHTML(Equipo);
        const cleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();
        const photosBlockHTML = getPhotosHTML(players);
        return `<div class="item-box" data-team-name="${cleanName}"><div class="item-top" ${positionBoxStyle}>${Top}</div>${logoHTML}<div class="item-info"><div class="item-team-name">${Equipo}</div>${photosBlockHTML}<div class="item-players">${playersHTML}</div></div></div>`;
    };

    const updateTeamItemDOM = (domElement, teamData) => {
        const { Top = "#", Equipo = "N/A", Grupo = "" } = teamData;
        let players = [];
        for (let i = 1; i <= playersPerTeam; i++) {
            if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]);
        }
        let playersHTML = players.join(' | ');
        const elTop = domElement.querySelector('.item-top');
        const elName = domElement.querySelector('.item-team-name');
        const elPlayers = domElement.querySelector('.item-players');
        const elLogoContainer = domElement.querySelector('.team-logo-container');
        const elPhotosBlock = domElement.querySelector('.player-photos-block');

        if(elTop) elTop.innerHTML = `${Top}`;
        if(elName) elName.textContent = Equipo;
        if(elPlayers) elPlayers.textContent = playersHTML;

        if (elTop) {
            elTop.style.backgroundColor = ""; 
            if (enableGroupColors) {
                const activeTheme = config.Themes[config.active_theme_name];
                if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_B_BOX;
                else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_C_BOX;
                else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_D_BOX;
            }
        }

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
        }

        if (showPlayerPhotos && elPhotosBlock) {
            const currentImgs = elPhotosBlock.querySelectorAll('img.player-silhouette');
            let needsUpdate = false;
            if (currentImgs.length !== players.length) needsUpdate = true;
            else {
                for (let i = 0; i < players.length; i++) {
                    if (currentImgs[i].dataset.playerName !== players[i]) {
                        needsUpdate = true;
                        break;
                    }
                }
            }
            if (needsUpdate) elPhotosBlock.outerHTML = getPhotosHTML(players);
        } else if (showPlayerPhotos && !elPhotosBlock) {
            const newPhotosHTML = getPhotosHTML(players);
            if (elPlayers) elPlayers.insertAdjacentHTML('beforebegin', newPhotosHTML);
        }
    };

    const displayAllTeams = () => {
        if (!gridContainer) return;
        let displayData = [];
        
        if (showPlayerPhotos) {
            // --- LÓGICA INTACTA PARA FOTOS ---
            if (totalTeamsConfig > 16) {
                const itemsPerPage = 9; 
                const startIndex = (PAGE_TO_SHOW - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                displayData = allData.slice(startIndex, endIndex);

                if (displayData.length === 0) {
                    gridContainer.innerHTML = "";
                    if (infoHeader) infoHeader.style.opacity = 0;
                    return; 
                }
                cols = 3;
                rows = Math.ceil(displayData.length / cols);
            } else {
                if (totalTeamsConfig <= 12) { cols = 3; } else { cols = 4; }
                displayData = allData.slice(0, totalTeamsConfig);
                rows = Math.ceil(displayData.length / cols);
            }
        } else {
            // --- NUEVA LÓGICA: SIN FOTOS (CON DISTRIBUCIÓN EQUITATIVA) ---
            const splitEvenly = (config.Settings.b_SplitTeamsEvenly || 'FALSE').toUpperCase() === 'TRUE';
            let itemsPerPage = 30; // Máximo por default sin dividir (3 cols x 10 rows)

            if (splitEvenly && totalTeamsConfig > 30) {
                // Divide la cantidad total entre las 2 páginas
                itemsPerPage = Math.ceil(totalTeamsConfig / 2);
            }

            const startIndex = (PAGE_TO_SHOW - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            displayData = allData.slice(startIndex, endIndex);

            if (displayData.length === 0) {
                gridContainer.innerHTML = "";
                if (infoHeader) infoHeader.style.opacity = 0;
                return; 
            }

            cols = 3; // Siempre 3 columnas
            rows = Math.ceil(displayData.length / cols);
        }

        gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rows}, ${rowHeight}px)`;
        
        const currentItems = gridContainer.querySelectorAll('.item-box');

        if (currentItems.length === displayData.length && currentItems.length > 0) {
            displayData.forEach((team, index) => {
                updateTeamItemDOM(currentItems[index], team);
            });
        } else {
            let newHTML = "";
            displayData.forEach(team => { newHTML += createTeamItemHTML(team); });
            gridContainer.innerHTML = newHTML;
        }

        gridContainer.style.opacity = 1;
        if (infoHeader) infoHeader.style.opacity = 1;
        updateHeaderPosition();
    };
    
    const refreshData = async () => {
        // 1. Mostrar título y formato (Independiente de los equipos)
        await updateHeaderInfo();

        // 2. Fetch y mostrar Equipos
        const fetchedData = await fetchSheetDataSE("GID_MeetTheTeams", config);
        
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            const slicedData = fetchedData.slice(0, totalTeamsConfig);
            const currentDataJSON = JSON.stringify(slicedData);
            
            if (currentDataJSON !== lastDataJSON) {
                lastDataJSON = currentDataJSON; 
                allData = slicedData;
                displayAllTeams();
            }
        } else {
            if(DEBUG_MODE) console.warn("[DEBUG] GID_MeetTheTeams devolvió un array vacío.");
        }
    };
    
    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}