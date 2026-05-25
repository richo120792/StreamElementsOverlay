// Variable para almacenar el estado anterior de los datos y evitar parpadeos
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
    initPodiumGrid(config);
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

async function initPodiumGrid(config) {
    const DATA_REFRESH_INTERVAL = 10000;
    
    setDynamicBackground(document.body, "PodioBajasJugador", config); 
    applyColorConfig(config);
    
    const gridContainer = document.getElementById('gridContainer');
    if (!gridContainer) return;

    const offset = parseInt(config.Settings.n_PodioBajasJugadorOffset || '0', 10);
    gridContainer.style.top = (250 + offset) + "px";

    const enablePrizes = (config.Settings.b_EnableTopFraggerPrizes || 'FALSE').toUpperCase() === 'TRUE';
    const prizeCount = parseInt(config.Settings.n_TopFraggerPrizesCount || '3', 10);
    
    const showTeamLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";

    // --- GENERADOR HTML LOGO ---
    const getTeamLogoHTML = (teamName) => {
        if (!showTeamLogos || !logosPath || !teamName) return "";
        const cleanName = teamName.replace(/^Team\s+/i, '').trim().toLowerCase();
        
        const logoUrlPng = `${logosPath}${cleanName}.png`;
        const logoUrlJpg = `${logosPath}${cleanName}.jpg`;

        // CAMBIO CRUCIAL: Si falla la carga, ocultamos el CONTENEDOR padre (.logo-box-top)
        const stepHide = "this.closest('.logo-box-top').style.display='none';";
        
        // Primero intentamos JPG si falla PNG, si falla JPG ocultamos el contenedor
        const onErrorLogic = `this.onerror=null; this.src='${logoUrlJpg}'; this.onerror=function(){ ${stepHide} };`.replace(/"/g, "'");

        return `
            <div class="logo-box-top">
                <img src="${logoUrlPng}" class="team-logo-img" onerror="${onErrorLogic}">
            </div>
        `;
    };

    const createPlayerPodiumItemHTML = (playerData) => {
        const { Top = "-", Jugador = "N/A", Kills = "0", Rondas = "0", Equipo = "" } = playerData;
        const playerPhotoBaseUrl = config.Settings.PATH_PLAYER_PHOTOS;
        
        // Foto Jugador
        let photoContent = ''; 
        if (playerPhotoBaseUrl) {
            const normalizedName = Jugador.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            const playerPhotoUrlPng = `${playerPhotoBaseUrl}Background/${normalizedName}.png`;
            const playerPhotoUrlJpg = `${playerPhotoBaseUrl}Background/${normalizedName}.jpg`;
            const defaultPhotoUrlPng = `${playerPhotoBaseUrl}Background/default.png`;
            const defaultPhotoUrlJpg = `${playerPhotoBaseUrl}Background/default.jpg`; 
            
            const step4_code = `this.onerror=null; this.style.display='none';`;
            const step3_handler = `function() { this.src='${defaultPhotoUrlJpg}'; this.classList.add('default-img'); this.onerror = function() { ${step4_code} }; }`;
            const step2_handler = `function() { this.src='${defaultPhotoUrlPng}'; this.classList.add('default-img'); this.onerror = ${step3_handler}; }`;
            const onErrorLogic = `this.src='${playerPhotoUrlJpg}'; this.onerror = ${step2_handler};`.replace(/"/g, "'").replace(/\n/g, " ");

            photoContent = `<img src="${playerPhotoUrlPng}" class="player-photo" alt="${Jugador}" onerror="${onErrorLogic}">`;
        } else {
            photoContent = `<span style="color:white; font-size: 1.8em; padding: 15px; text-align: center;">${Jugador}</span>`;
        }
        
        let prizeClass = "";
        const topNumber = parseInt(Top, 10);
        if (enablePrizes && !isNaN(topNumber)) {
            if (topNumber === 1 && prizeCount >= 1) prizeClass = "fragger-top1";
            else if (topNumber === 2 && prizeCount >= 2) prizeClass = "fragger-top2";
            else if (topNumber === 3 && prizeCount >= 3) prizeClass = "fragger-top3";
        }

        // --- VALIDACIÓN DE EQUIPO ---
        const checkName = (Equipo || "").trim().toLowerCase();
        const isGenericTeam = checkName === "team" || checkName === "";
        const hasTeam = (showTeamLogos && !isGenericTeam);

        const teamLogoHTML = hasTeam ? getTeamLogoHTML(Equipo) : "";

        return `
            <div class="podium-wrapper ${prizeClass}" data-player-name="${Jugador}" data-team-name="${Equipo}">
                <div class="info-bar-top ${prizeClass}">
                    <div class="identity-wrapper">
                        ${teamLogoHTML}
                        <div class="item-team-name">${Jugador}</div>
                    </div>
                </div>
                <div class="player-photo-container">
                    ${photoContent}
                </div>
                <div class="info-bar-bottom ${prizeClass}">
                    <div class="item-pos-bottom">
                        ${Top}
                        <span class="item-rounds">R${Rondas}</span>
                    </div>
                    <div class="item-kills">
                        ${Kills}
                    </div>
                </div>
            </div>
        `;
    };

    const updatePlayerPodiumItemDOM = (domElement, playerData) => {
        const { Top = "-", Jugador = "N/A", Kills = "0", Rondas = "0", Equipo = "" } = playerData;
        
        // --- 1. LÓGICA ANTI-PARPADEO PARA LA BARRA SUPERIOR ---
        const elTopBar = domElement.querySelector('.info-bar-top');
        
        // Aseguramos que el wrapper exista
        let elIdentity = elTopBar.querySelector('.identity-wrapper');
        if (!elIdentity) {
             // Si por alguna razón se perdió, lo recreamos
             elTopBar.innerHTML = `<div class="identity-wrapper"><div class="item-team-name"></div></div>`;
             elIdentity = elTopBar.querySelector('.identity-wrapper');
        }

        // Actualizamos siempre el nombre del jugador
        const elTeamNameDiv = elIdentity.querySelector('.item-team-name');
        if (elTeamNameDiv) elTeamNameDiv.textContent = Jugador;

        // Revisamos si el equipo cambió para decidir si tocar el logo
        const currentTeam = domElement.dataset.teamName;
        
        if (currentTeam !== Equipo) {
             domElement.dataset.teamName = Equipo; // Actualizar dataset

             // Calculamos si debe llevar logo
             const checkName = (Equipo || "").trim().toLowerCase();
             const isGenericTeam = checkName === "team" || checkName === "";
             const hasTeam = (showTeamLogos && !isGenericTeam);
             
             // Buscamos logo existente
             const existingLogo = elIdentity.querySelector('.logo-box-top');

             if (hasTeam) {
                 const newLogoHTML = getTeamLogoHTML(Equipo);
                 if (existingLogo) {
                     existingLogo.outerHTML = newLogoHTML; // Reemplazar
                 } else {
                     elIdentity.insertAdjacentHTML('afterbegin', newLogoHTML); // Insertar nuevo
                 }
             } else {
                 if (existingLogo) {
                     existingLogo.remove(); // Borrar si ya no debe tener
                 }
             }
        }
        // NOTA: Si el equipo NO cambió, NO tocamos el logo. 
        // Esto mantiene el estado de 'display: none' si el onerror ya se disparó.

        // --- 2. RESTO DE ACTUALIZACIONES ---
        const elPos = domElement.querySelector('.item-pos-bottom');
        const elKills = domElement.querySelector('.item-kills');
        const elPhotoContainer = domElement.querySelector('.player-photo-container');
        const elBottomBar = domElement.querySelector('.info-bar-bottom');
        
        if (elPos) elPos.innerHTML = `${Top}<span class="item-rounds">R${Rondas}</span>`;
        if (elKills) elKills.textContent = Kills;

        // Actualizar foto solo si cambia el jugador (Anti-Parpadeo foto jugador)
        if (domElement.dataset.playerName !== Jugador) {
            domElement.dataset.playerName = Jugador;
            const playerPhotoBaseUrl = config.Settings.PATH_PLAYER_PHOTOS;
            if (playerPhotoBaseUrl && elPhotoContainer) {
                const normalizedName = Jugador.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                const playerPhotoUrlPng = `${playerPhotoBaseUrl}Background/${normalizedName}.png`;
                const playerPhotoUrlJpg = `${playerPhotoBaseUrl}Background/${normalizedName}.jpg`;
                const defaultPhotoUrlPng = `${playerPhotoBaseUrl}Background/default.png`;
                const defaultPhotoUrlJpg = `${playerPhotoBaseUrl}Background/default.jpg`; 
                
                const step4_code = `this.onerror=null; this.style.display='none';`;
                const step3_handler = `function() { this.src='${defaultPhotoUrlJpg}'; this.classList.add('default-img'); this.onerror = function() { ${step4_code} }; }`;
                const step2_handler = `function() { this.src='${defaultPhotoUrlPng}'; this.classList.add('default-img'); this.onerror = ${step3_handler}; }`;
                const onErrorLogic = `this.src='${playerPhotoUrlJpg}'; this.onerror = ${step2_handler};`.replace(/"/g, "'").replace(/\n/g, " ");
                
                elPhotoContainer.innerHTML = `<img src="${playerPhotoUrlPng}" class="player-photo" alt="${Jugador}" onerror="${onErrorLogic}">`;
            }
        }

        // --- 3. ESTILOS DE PREMIO ---
        let prizeClass = "";
        const topNumber = parseInt(Top, 10);
        if (enablePrizes && !isNaN(topNumber)) {
            if (topNumber === 1 && prizeCount >= 1) prizeClass = "fragger-top1";
            else if (topNumber === 2 && prizeCount >= 2) prizeClass = "fragger-top2";
            else if (topNumber === 3 && prizeCount >= 3) prizeClass = "fragger-top3";
        }
        
        domElement.className = `podium-wrapper ${prizeClass}`;
        if (elTopBar) elTopBar.className = `info-bar-top ${prizeClass}`;
        if (elBottomBar) elBottomBar.className = `info-bar-bottom ${prizeClass}`;
    };

    const refreshData = async () => {
        const fetchedData = await fetchSheetDataSE("GID_BajasJugador", config);
        
        if (Array.isArray(fetchedData) && fetchedData.length > 0) {
            const top5Players = fetchedData.slice(0, 5);
            
            const currentItems = gridContainer.querySelectorAll('.podium-wrapper');

            if (currentItems.length === top5Players.length && currentItems.length > 0) {
                top5Players.forEach((player, index) => {
                    updatePlayerPodiumItemDOM(currentItems[index], player);
                });
            } else {
                let newHTML = "";
                top5Players.forEach((player) => {
                    newHTML += createPlayerPodiumItemHTML(player);
                });
                gridContainer.innerHTML = newHTML;
            }
            gridContainer.style.opacity = 1;
        } else {
            gridContainer.innerHTML = '';
            gridContainer.style.opacity = 0;
        }
    };

    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}