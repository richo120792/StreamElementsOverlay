// Variable para control de cambios y evitar parpadeo
let lastDataJSON = "";

// Forzamos la URL de configuración directamente
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

// Cambiamos 'onWidgetLoad' por 'DOMContentLoaded' para ejecución estándar
window.addEventListener('DOMContentLoaded', function () {
    main(MY_CONFIG_URL); 
});

async function main(configUrl) {
    const config = await fetchConfigSE(configUrl);
    if (!config) return;
    setupCanvas(config);
    initBajasPromedioGrid(config);
}

function setupCanvas(config) {
    const canvasWidth = parseInt(config.Settings?.n_CanvasWidth || '1920', 10);
    const canvasHeight = parseInt(config.Settings?.n_CanvasHeight || '1080', 10);
    const baseWidth = 1920;
    document.body.style.width = `${canvasWidth}px`;
    document.body.style.height = `${canvasHeight}px`;
    const wrapper = document.querySelector('.scale-wrapper');
    if (wrapper) {
        const scaleFactor = canvasWidth / baseWidth;
        wrapper.style.transform = `scale(${scaleFactor})`;
    }
}

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

function applyColorConfig(config) {
    const root = document.documentElement;
    if (!root || !config.Themes || !config.active_theme_name) return;
    const activeTheme = config.Themes[config.active_theme_name];
    if (!activeTheme) return;
    for (const key in activeTheme) {
        if (Object.hasOwnProperty.call(activeTheme, key)) {
            const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`;
            root.style.setProperty(cssVarName, activeTheme[key]);
        }
    }
}

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
            headers.forEach((header, i) => {
                obj[header] = row[i] || "";
            });
            return obj;
        });
    } catch (error) {
        console.error("Error fetching sheet data:", error);
        return [];
    }
}

function setDynamicBackground(element, backgroundFileName, config) {
    if (element.style.backgroundImage) return;
    const path = config.Settings?.PATH_BACKGROUNDS;
    if (path && element) {
        let imageUrlPng = `${path}${backgroundFileName}.png`;
        let imageUrlJpg = `${path}${backgroundFileName}.jpg`;

        const image = new Image();
        image.src = imageUrlPng;
        image.onload = () => {
            element.style.backgroundImage = `url('${imageUrlPng}')`;
        };
        image.onerror = () => {
            element.style.backgroundImage = `url('${imageUrlJpg}')`;
        };
    }
}

function renderGroupLegend(config) {
    const legendContainer = document.getElementById("groupLegend");
    if (!legendContainer) return;
    const enableGroupColors = (config.Settings.b_EnableGroupColors || "FALSE").toUpperCase() === "TRUE";
    if (!enableGroupColors) {
        legendContainer.innerHTML = "";
        return;
    }
    const groupsToShow = parseInt(config.Settings.n_GroupsToShowInLegend || "4", 10);
    const activeTheme = config.Themes[config.active_theme_name];
    const groupInfo = [
        { name: "Group A", color: activeTheme.COLOR_POSITION_BOX },
        { name: "Group B", color: activeTheme.COLOR_GROUP_B_BOX },
        { name: "Group C", color: activeTheme.COLOR_GROUP_C_BOX },
        { name: "Group D", color: activeTheme.COLOR_GROUP_D_BOX }
    ];
    let legendHTML = "";
    for (let i = 0; i < groupsToShow; i++) {
        if (groupInfo[i] && groupInfo[i].color) {
            legendHTML += `<div class="legend-item"><div class="legend-color-circle" style="background-color: ${groupInfo[i].color};"></div><span>${groupInfo[i].name}</span></div>`;
        }
    }
    legendContainer.innerHTML = legendHTML;
}

function initBajasPromedioGrid(config) {
    const DATA_REFRESH_INTERVAL = 10000;
    setDynamicBackground(document.body, 'bajas_promedio_jugador', config);
    applyColorConfig(config);
    renderGroupLegend(config);
    const gridContainer = document.getElementById('gridContainer');
    const legendContainer = document.getElementById('groupLegend');
    if (!gridContainer || !legendContainer) return;

    const offset = parseInt(config.Settings.n_BajasPromedioJugadorOffset || '0', 10);
    gridContainer.style.top = (150 + offset) + "px";

    const totalTeamsConfig = parseInt(config.Settings.n_TotalTeams || '50', 10);
    const itemsToShow = Math.min(totalTeamsConfig, 30);
    const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
    
    // --- NUEVO: Variables para logos de equipo ---
    const showTeamLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";

    let allData = [];

    const columns = 3;
    const rows = Math.ceil(itemsToShow / columns);
    gridContainer.style.gridTemplateRows = `repeat(${rows}, 66px)`;

    // --- HELPER LOGO (Misma lógica que BajasJugador) ---
    const getLogoHTML = (teamName) => {
        if (!showTeamLogos || !logosPath || !teamName) return "";
        const cleanName = teamName.replace(/^Team\s+/i, '').trim().toLowerCase();
        
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

    const createPlayerItemHTML = (playerData) => {
        const { Top = "-", Jugador = "N/A", Kills: killsAvg = "0.0", Rondas = "0", Grupo = "", Equipo = "" } = playerData;
        let positionBoxStyle = '';
        if (enableGroupColors) {
            const activeTheme = config.Themes[config.active_theme_name];
            if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`;
            else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`;
            else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`;
        }
        
        // Generar Logo
        const logoHTML = getLogoHTML(Equipo);
        // Guardamos nombre de equipo en dataset para el update
        const cleanTeamName = (Equipo || "").replace(/^Team\s+/i, '').trim().toLowerCase();

        return `<div class="item-box" data-team-name="${cleanTeamName}">
                    <div class="item-top" ${positionBoxStyle}>${Top}<span class="item-rounds">R${Rondas}</span></div>
                    ${logoHTML}
                    <div class="item-info"><div class="item-team-name">${Jugador}</div></div>
                    <div class="item-points">${killsAvg}</div>
                </div>`;
    };

    // --- FUNCIÓN DE ACTUALIZACIÓN DOM INTELIGENTE (Anti-Parpadeo) ---
    const updatePlayerItemDOM = (domElement, playerData) => {
        const { Top = "-", Jugador = "N/A", Kills: killsAvg = "0.0", Rondas = "0", Grupo = "", Equipo = "" } = playerData;

        // 1. Textos
        const elTop = domElement.querySelector('.item-top');
        const elName = domElement.querySelector('.item-team-name');
        const elPoints = domElement.querySelector('.item-points');
        const elLogoContainer = domElement.querySelector('.team-logo-container');

        if(elTop) elTop.innerHTML = `${Top}<span class="item-rounds">R${Rondas}</span>`;
        if(elName) elName.textContent = Jugador;
        if(elPoints) elPoints.textContent = killsAvg;

        // 2. Colores
        if (elTop) {
            elTop.style.backgroundColor = ""; 
            if (enableGroupColors) {
                const activeTheme = config.Themes[config.active_theme_name];
                if (Grupo === 'Group B' && activeTheme.COLOR_GROUP_B_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_B_BOX;
                else if (Grupo === 'Group C' && activeTheme.COLOR_GROUP_C_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_C_BOX;
                else if (Grupo === 'Group D' && activeTheme.COLOR_GROUP_D_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_D_BOX;
            }
        }

        // 3. LOGOS (Validación Inteligente)
        if (showTeamLogos && logosPath) {
            const newCleanTeamName = (Equipo || "").replace(/^Team\s+/i, '').trim().toLowerCase();
            const currentCleanTeamName = domElement.dataset.teamName;

            // SOLO actualizamos si el nombre del equipo ha cambiado
            if (newCleanTeamName !== currentCleanTeamName) {
                domElement.dataset.teamName = newCleanTeamName;
                
                const newLogoHTML = getLogoHTML(Equipo);

                if (elLogoContainer) {
                    elLogoContainer.outerHTML = newLogoHTML;
                } else {
                    // Si no existía (config cambiada), insertamos después del item-top
                    if (elTop) elTop.insertAdjacentHTML('afterend', newLogoHTML);
                }
            }
        }
    };

    const displayPage = () => {
        if (!gridContainer) return;
        const displayData = allData.slice(0, itemsToShow);

        // Verificar si la estructura DOM ya existe y coincide en cantidad
        const currentItems = gridContainer.querySelectorAll('.item-box');

        if (currentItems.length === displayData.length && currentItems.length > 0) {
            // ACTUALIZAR existentes
            displayData.forEach((player, index) => {
                updatePlayerItemDOM(currentItems[index], player);
            });
        } else {
            // RENDERIZAR nuevos
            let newHTML = "";
            displayData.forEach(player => { newHTML += createPlayerItemHTML(player); });
            gridContainer.innerHTML = newHTML;
        }

        gridContainer.style.opacity = 1;
        legendContainer.style.opacity = 1;
    };
    
    const refreshData = async () => {
        const fetchedData = await fetchSheetDataSE("GID_BajasPromedioJugador", config);
        
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            // --- LÓGICA ANTI-PARPADEO (Datos) ---
            const currentDataSlice = fetchedData.slice(0, itemsToShow);
            const currentDataJSON = JSON.stringify(currentDataSlice);
            
            if (currentDataJSON === lastDataJSON) {
                return; // No hubo cambios, no redibujar
            }
            lastDataJSON = currentDataJSON; 
            // ------------------------------------

            allData = fetchedData;
            displayPage();
        } else {
            console.log("BajasPromedio: No se recibieron datos nuevos o hubo un error.");
        }
    };

    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}