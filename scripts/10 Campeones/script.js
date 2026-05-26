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
    initCampeonesOverlay(config);
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

// Función para aplicar colores del tema al CSS
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
    if (!sheetId || !apiKey || !sheetName || apiKey.startsWith("AQUÍ")) return [];
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`;
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Error API: ${response.status}`);
        const json = await response.json();
        if (!json.values || json.values.length < 1) return [];
        
        const headers = json.values[0]; 
        const rows = json.values.slice(1);
        
        let mappedData = {};
        // Objeto auxiliar para guardar datos por número de fila/Top (para estadísticas dinámicas)
        let indexedStats = {};

        const topColIndex = headers.indexOf("Top");
        const varColIndex = headers.indexOf("Variable");
        const valColIndex = headers.indexOf("Valor");

        if (varColIndex !== -1 && valColIndex !== -1) {
            rows.forEach(row => {
                const key = row[varColIndex];
                const val = row[valColIndex];
                const top = row[topColIndex]; // El número de la columna A

                // 1. Mapeo normal por Nombre (para Equipo, Jugadores, etc)
                if (key) mappedData[key] = val;

                // 2. Mapeo por Posición (para las Stats 6, 7 y 8)
                if (top) {
                    indexedStats[top.toString()] = { label: key, value: val };
                }
            });
        }
        
        // Inyectamos las stats indexadas en el objeto principal
        mappedData._indexedStats = indexedStats;

        return [mappedData];

    } catch (e) { console.error(e); return []; }
}

function setDynamicBackground(element, backgroundFileName, config) {
    if (element.style.backgroundImage) return;
    const path = config.Settings?.PATH_BACKGROUNDS;
    if (path && element) {
        const img = new Image();
        img.src = `${path}${backgroundFileName}.png`;
        img.onload = () => element.style.backgroundImage = `url('${img.src}')`;
        img.onerror = () => element.style.backgroundImage = `url('${path}${backgroundFileName}.jpg')`;
    }
}

async function initCampeonesOverlay(config) {
    const DATA_REFRESH_INTERVAL = 10000;
    
    setDynamicBackground(document.body, "campeones", config);
    applyColorConfig(config); 

    const gridContainer = document.getElementById('championsGrid');
    if (!gridContainer) return;

    // --- VARIABLE DE OFFSET: n_CampeonesOffset ---
    const offset = parseInt(config.Settings.n_CampeonesOffset || '0', 10);
    gridContainer.style.transform = `translateY(calc(-50% + ${offset}px))`;

    const showTeamLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";
    const playerPhotoBaseUrl = config.Settings.PATH_PLAYER_PHOTOS || "";

    const getTeamLogoHTML = (teamName) => {
        if (!showTeamLogos || !logosPath || !teamName) return "";
        const cleanName = teamName.replace(/^Team\s+/i, '').trim().toLowerCase();
        const logoPng = `${logosPath}${cleanName}.png`;
        const logoJpg = `${logosPath}${cleanName}.jpg`;
        const onError = `this.style.display='none';`; 
        const onErrorLogic = `this.onerror=null; this.src='${logoJpg}'; this.onerror=function(){${onError}};`.replace(/"/g, "'");
        return `<img src="${logoPng}" class="team-logo-large" onerror="${onErrorLogic}">`;
    };

    const getPlayerPhotoHTML = (playerName) => {
        if (!playerPhotoBaseUrl || !playerName) return "";
        const cleanName = playerName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        const photoPng = `${playerPhotoBaseUrl}Background/${cleanName}.png`;
        const photoJpg = `${playerPhotoBaseUrl}Background/${cleanName}.jpg`;
        const defPng = `${playerPhotoBaseUrl}Background/default.png`;
        const defJpg = `${playerPhotoBaseUrl}Background/default.jpg`;
        
        const step4 = `this.onerror=null; this.style.display='none';`;
        const step3 = `function(){this.src='${defJpg}';this.classList.add('default-img');this.onerror=function(){${step4}};}`;
        const step2 = `function(){this.src='${defPng}';this.classList.add('default-img');this.onerror=${step3};}`;
        const onError = `this.src='${photoJpg}';this.onerror=${step2};`.replace(/"/g, "'").replace(/\n/g, " ");

        return `<img src="${photoPng}" class="player-photo" alt="${playerName}" onerror="${onError}">`;
    };

    const createTeamBox = (data) => {
        const name = data["Equipo"] || "N/A";
        const stats = data._indexedStats || {};

        // Helper para obtener datos de las filas 6, 7 y 8 del Excel (Top)
        const getStatRow = (index, fallbackLabel) => {
            if (stats[index]) {
                return { label: stats[index].label, value: stats[index].value };
            }
            return { label: fallbackLabel, value: "-" };
        };

        const s1 = getStatRow("6", "Points");
        const s2 = getStatRow("7", "Kills");
        const s3 = getStatRow("8", "Avg Plcmt");
        
        const logoHTML = getTeamLogoHTML(name);

        return `
            <div class="champion-box team-stats-box">
                <div class="team-header-section">
                    ${logoHTML}
                    <div class="team-name-large">${name}</div>
                </div>
                <div class="team-stats-details">
                    <div class="stat-row">
                        <span class="stat-label">${s1.label}</span>
                        <span class="stat-value">${s1.value}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">${s2.label}</span>
                        <span class="stat-value">${s2.value}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">${s3.label}</span>
                        <span class="stat-value">${s3.value}</span>
                    </div>
                </div>
            </div>
        `;
    };

    const createPlayerBox = (playerName, playerKills) => {
        const safeName = playerName || "";
        const safeKills = playerKills || "0";
        const photoHTML = getPlayerPhotoHTML(safeName);

        return `
            <div class="champion-box">
                <div class="player-top-bar">${safeName}</div>
                <div class="player-photo-container">
                    ${photoHTML}
                </div>
                <div class="player-bottom-bar">${safeKills}</div>
            </div>
        `;
    };

    const refreshData = async () => {
        const fetchedData = await fetchSheetDataSE("GID_Campeones", config);
        
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            const data = fetchedData[0];
            const currentDataJSON = JSON.stringify(data);

            if (currentDataJSON === lastDataJSON && gridContainer.innerHTML !== "") {
                return;
            }
            lastDataJSON = currentDataJSON;

            let fullHTML = "";
            fullHTML += createTeamBox(data);
            fullHTML += createPlayerBox(data["Jugador1"], data["Kills Jugador1"]);
            fullHTML += createPlayerBox(data["Jugador2"], data["Kills Jugador2"]);
            fullHTML += createPlayerBox(data["Jugador3"], data["Kills Jugador3"]);

            gridContainer.innerHTML = fullHTML;
            gridContainer.style.opacity = 1;
        } else {
            console.log("No data found for Campeones");
        }
    };

    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}