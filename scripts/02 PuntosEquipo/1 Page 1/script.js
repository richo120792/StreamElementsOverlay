// Variable para control de cambios y evitar parpadeo
let lastDataJSON = "";

// Definimos la URL manualmente ya que no estamos en StreamElements
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

window.addEventListener('DOMContentLoaded', function () {
    // Usamos la URL que definimos arriba directamente
    main(MY_CONFIG_URL); 
});

async function main(configUrl) { const config = await fetchConfigSE(configUrl); if (!config) return; setupCanvas(config); initPuntosGrid(config); }
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
            const backupResponse = await fetch(`../../config.json?t=${new Date().getTime()}`);
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
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`; 
    
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

function initPuntosGrid(config) {
    // === CAMBIA ESTO A 2 PARA TU SEGUNDO OVERLAY DE PÁGINA 2 ===
    const PAGE_TO_SHOW = 1; 
    // ============================================================

    const DATA_REFRESH_INTERVAL = 10000;
    setDynamicBackground(document.body, "puntos_equipo", config);
    applyColorConfig(config);
    renderGroupLegend(config);
    
    const gridContainer = document.getElementById('gridContainer');
    const infoHeader = document.getElementById('infoHeader');
    if (!gridContainer) return;
    
    // --- VARIABLES ---
    const showLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";
    const offset = parseInt(config.Settings.n_PuntosEquipoOffset || '0', 10);

    // Aplicar offset desde el centro de la pantalla
    gridContainer.style.top = "50%";
    gridContainer.style.transform = `translateY(calc(-50% + ${offset}px))`;

    const totalTeamsConfig = parseInt(config.Settings.n_TotalTeams || '50', 10);
    
    // Variables de prioridades (Matchpoint y Clasificacion)
    const isMatchpointMode = (config.Settings.b_IsMatchpoint || 'FALSE').toUpperCase() === 'TRUE';
    const matchpointThreshold = parseInt(config.Settings.n_MatchpointThreshold || '150', 10);
    const enableQualificationHighlight = (config.Settings.b_EnableQualificationHighlight || 'FALSE').toUpperCase() === 'TRUE';
    const qualificationThreshold = parseInt(config.Settings.n_QualificationThreshold || '10', 10);

    const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
    const playersPerTeam = parseInt(config.Settings.n_PlayersPerTeam || '4', 10);
    let allData = [];

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

    // --- POSICIÓN DINÁMICA DEL ENCABEZADO ---
    const updateHeaderPosition = (rowsCalc) => {
        if (!infoHeader) return;
        const gridHeight = (rowsCalc * 66) + ((rowsCalc - 1) * 12);
        const canvasCenterY = 540; 
        const bottomGridY = canvasCenterY + offset + (gridHeight / 2);
        
        const targetTop = 940; // Altura estándar alineado con todo lo demás
        const minTop = bottomGridY + 30; // 30px de margen si la cuadrícula crece
        const finalTop = Math.max(targetTop, minTop);
        
        infoHeader.style.top = finalTop + "px";
    };

    // Helper para generar el HTML del logo
    const getLogoHTML = (equipoName) => {
        if (!showLogos || !logosPath) return "";
        const cleanName = equipoName.replace(/^Team\s+/i, '').trim().toLowerCase();
        
        const logoUrlPng = `${logosPath}${cleanName}.png`;
        const logoUrlJpg = `${logosPath}${cleanName}.jpg`;
        const defaultUrlPng = `${logosPath}default.png`;
        const defaultUrlJpg = `${logosPath}default.jpg`;

        const step4 = `this.onerror=null; this.style.display='none';`;
        const step3 = `function() { this.src='${defaultUrlJpg}'; this.onerror = function() { ${step4} }; }`;
        const step2 = `function() { this.src='${defaultUrlPng}'; this.onerror = ${step3}; }`;
        const onErrorLogic = `this.src='${logoUrlJpg}'; this.onerror = ${step2};`.replace(/"/g, "'").replace(/\n/g, " ");

        return `
            <div class="team-logo-container">
                <img src="${logoUrlPng}" class="team-logo" onerror="${onErrorLogic}">
            </div>
        `;
    };

    const createTeamItemHTML = (teamData) => {
        const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "", Win = "" } = teamData;
        
        let players = [];
        for (let i = 1; i <= playersPerTeam; i++) { if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]); }
        let playersHTML = players.join(' | ');
        
        let specialClass = "", positionBoxStyle = ''; 
        const numericPoints = parseFloat(Puntos); 
        const numericTop = parseInt(Top, 10);
        
        // EVALUACIÓN DE 3 PRIORIDADES
        if (isMatchpointMode) {
            if ((!isNaN(numericPoints) && numericPoints >= 998) || Win === "1") {
                specialClass = "match-winner";
            } else if (!isNaN(numericPoints) && numericPoints >= matchpointThreshold) {
                specialClass = "matchpoint-active";
            }
        } else if (enableQualificationHighlight) {
            if (!isNaN(numericTop) && numericTop > 0 && numericTop <= qualificationThreshold) {
                specialClass = "matchpoint-active";
            }
        }
        
        if (enableGroupColors) { 
            const activeTheme = config.Themes[config.active_theme_name]; 
            if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`; 
            else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`; 
            else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`; 
        } 
        
        const logoHTML = getLogoHTML(Equipo);
        // Guardamos el nombre limpio en dataset para validaciones futuras
        const cleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();

        return `<div class="item-box ${specialClass}" data-team-name="${cleanName}"><div class="item-top" ${positionBoxStyle}>${Top}<span class="item-rounds">R${Rondas}</span></div>${logoHTML}<div class="item-info"><div class="item-team-name">${Equipo}</div><div class="item-players">${playersHTML}</div></div><div class="item-points">${Puntos}</div></div>`;
    };

    const updateTeamItemDOM = (domElement, teamData) => {
        const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "", Win = "" } = teamData;
        
        // 1. Textos
        let players = [];
        for (let i = 1; i <= playersPerTeam; i++) { if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]); }
        const playersHTML = players.join(' | ');

        const elTop = domElement.querySelector('.item-top');
        const elName = domElement.querySelector('.item-team-name');
        const elPlayers = domElement.querySelector('.item-players');
        const elPoints = domElement.querySelector('.item-points');
        const elLogoContainer = domElement.querySelector('.team-logo-container');

        if(elTop) elTop.innerHTML = `${Top}<span class="item-rounds">R${Rondas}</span>`;
        if(elName) elName.textContent = Equipo;
        if(elPlayers) elPlayers.textContent = playersHTML;
        if(elPoints) elPoints.textContent = Puntos;

        // 2. Clases y Estilos (Matchpoint / Clasificacion / Winner / Groups)
        domElement.className = "item-box"; // Reset clases base
        const numericPoints = parseFloat(Puntos);
        const numericTop = parseInt(Top, 10);
        
        // EVALUACIÓN DE 3 PRIORIDADES
        if (isMatchpointMode) {
            if ((!isNaN(numericPoints) && numericPoints >= 998) || Win === "1") {
                domElement.classList.add("match-winner");
            } else if (!isNaN(numericPoints) && numericPoints >= matchpointThreshold) {
                domElement.classList.add("matchpoint-active");
            }
        } else if (enableQualificationHighlight) {
            if (!isNaN(numericTop) && numericTop > 0 && numericTop <= qualificationThreshold) {
                domElement.classList.add("matchpoint-active");
            }
        }
        
        // Colores de grupo
        if(elTop) {
            elTop.style.backgroundColor = ""; // Reset inline style
            if (enableGroupColors) {
                const activeTheme = config.Themes[config.active_theme_name];
                if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_B_BOX;
                else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_C_BOX;
                else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_D_BOX;
            }
        }

        // 3. LOGOS (Validación Inteligente)
        if (showLogos && logosPath) {
            const newCleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();
            const currentCleanName = domElement.dataset.teamName;

            if (newCleanName !== currentCleanName) {
                domElement.dataset.teamName = newCleanName;
                if (elLogoContainer) {
                    elLogoContainer.outerHTML = getLogoHTML(Equipo);
                }
            }
        }
    };

    const displayCurrentPage = () => { 
        if (!gridContainer) return; 
        
        const relevantData = allData.slice(0, totalTeamsConfig); 
        
        // --- LÓGICA DE PAGINACIÓN ---
        const splitEvenly = (config.Settings.b_SplitTeamsEvenly || 'FALSE').toUpperCase() === 'TRUE';
        let itemsPerPage = 30; // Máximo estándar por página (3 columnas x 10 filas)

        if (splitEvenly && totalTeamsConfig > 30) {
            // Dividir equitativamente
            itemsPerPage = Math.ceil(totalTeamsConfig / 2);
        }

        const start = (PAGE_TO_SHOW - 1) * itemsPerPage; 
        const pageData = relevantData.slice(start, start + itemsPerPage); 

        // Si la página está vacía (ej. Página 2, pero solo hay 20 equipos en total)
        if (pageData.length === 0) {
            gridContainer.innerHTML = "";
            if (infoHeader) infoHeader.style.opacity = "0";
            return;
        }

        // --- CÁLCULO DE CUADRÍCULA ---
        const columns = 3;
        let rowsCalc = 10;

        if (splitEvenly && totalTeamsConfig > 30) {
            rowsCalc = Math.ceil(pageData.length / columns);
        } else {
            if (totalTeamsConfig > 30) {
                // Fuerza diseño idéntico en Pag 1 y Pag 2 (10 filas) para evitar el 3x7
                rowsCalc = 10; 
            } else {
                rowsCalc = Math.ceil(relevantData.length / columns);
            }
        }

        gridContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        gridContainer.style.gridTemplateRows = `repeat(${rowsCalc}, 66px)`;
        gridContainer.style.gridAutoFlow = "column"; 
        
        // Verificar si la estructura DOM ya existe y tiene la misma cantidad de elementos
        const currentItems = gridContainer.querySelectorAll('.item-box');
        
        if (currentItems.length === pageData.length && currentItems.length > 0) {
            // MODO ACTUALIZACIÓN: Modificamos lo existente
            pageData.forEach((team, index) => {
                updateTeamItemDOM(currentItems[index], team);
            });
        } else {
            // MODO RENDERIZADO COMPLETO: Primera carga o cambio de cantidad de equipos
            let newHTML = ""; 
            pageData.forEach(team => { newHTML += createTeamItemHTML(team); }); 
            gridContainer.innerHTML = newHTML; 
        }
        
        gridContainer.style.opacity = "1"; 
        if (infoHeader) infoHeader.style.opacity = "1"; 
        updateHeaderPosition(rowsCalc);
    };
    
    const refreshData = async () => {
        // Mostrar título y formato
        await updateHeaderInfo();

        const fetchedData = await fetchSheetDataSE("GID_PuntosEquipo", config);
        
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            const currentDataSlice = fetchedData.slice(0, totalTeamsConfig);
            const currentDataJSON = JSON.stringify(currentDataSlice);
            
            if (currentDataJSON === lastDataJSON) {
                return; 
            }
            lastDataJSON = currentDataJSON; 

            allData = fetchedData;
            displayCurrentPage();
        }
    };
    
    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}