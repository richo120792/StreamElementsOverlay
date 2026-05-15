// Definimos la URL manualmente ya que no estamos en StreamElements
const MY_CONFIG_URL = "https://api.jsonbin.io/v3/b/6864add38960c979a5b59aa6";

window.addEventListener('DOMContentLoaded', function () {
    // Usamos la URL que definimos arriba directamente
    main(MY_CONFIG_URL); 
});
async function main(configUrl) { const config = await fetchConfigSE(configUrl); if (!config) return; setupCanvas(config); initPuntosEquipoLiga(config); }
function setupCanvas(config) { const canvasWidth = parseInt(config.Settings?.n_CanvasWidth || '1920', 10); const canvasHeight = parseInt(config.Settings?.n_CanvasHeight || '1080', 10); const baseWidth = 1920; document.body.style.width = `${canvasWidth}px`; document.body.style.height = `${canvasHeight}px`; const wrapper = document.querySelector('.scale-wrapper'); if (wrapper) { const scaleFactor = canvasWidth / baseWidth; wrapper.style.transform = `scale(${scaleFactor})`; } }
async function fetchConfigSE(url) { try { const response = await fetch(url + `?t=${new Date().getTime()}`); if (!response.ok) throw new Error(`Error: ${response.status}`); const configData = await response.json(); return configData.record; } catch (error) { console.error("Error en fetchConfigSE:", error); return null; } }
function applyColorConfig(config) { const root = document.documentElement; if (!root || !config.Themes || !config.active_theme_name) return; const activeTheme = config.Themes[config.active_theme_name]; if (!activeTheme) return; for (const key in activeTheme) { if (Object.hasOwnProperty.call(activeTheme, key)) { const cssVarName = `--${key.toLowerCase().replace(/_/g, '-')}`; root.style.setProperty(cssVarName, activeTheme[key]); } } }
async function fetchSheetDataSE(gidKey, config) { const sheetId = config.Settings?.SPREADSHEET_ID; const apiKey = config.Settings?.API_KEY; let sheetName = ''; for (const key in config.GIDs) { if (key === gidKey) { sheetName = key.replace('GID_', ''); break; } } if (!sheetId || !apiKey || !sheetName) { return []; } if (apiKey.startsWith("AQUÍ")) { return []; } const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${apiKey}`; try { const response = await fetch(url); if (!response.ok) throw new Error(`Error de API: ${response.status}`); const jsonResponse = await response.json(); if (!jsonResponse.values || jsonResponse.values.length < 1) return []; const headers = jsonResponse.values[0]; const rows = jsonResponse.values.slice(1); return rows.map(row => { let obj = {}; headers.forEach((header, i) => { obj[header] = row[i] || ""; }); return obj; }); } catch (error) { console.error(`Error en fetchSheetDataSE para ${gidKey}:`, error); return []; } }
function setDynamicBackground(element, backgroundFileName, config) { const path = config.Settings?.PATH_BACKGROUNDS; if (path && element) { let imageUrlPng = `${path}${backgroundFileName}.png`; let imageUrlJpg = `${path}${backgroundFileName}.jpg`; const image = new Image(); image.src = imageUrlPng; image.onload = () => { element.style.backgroundImage = `url('${imageUrlPng}')`; }; image.onerror = () => { element.style.backgroundImage = `url('${imageUrlJpg}')`; }; } }
function renderGroupLegend(config) { const legendContainer = document.getElementById("groupLegend"); if (!legendContainer) return; const enableGroupColors = (config.Settings.b_EnableGroupColors || "FALSE").toUpperCase() === "TRUE"; if (!enableGroupColors) { legendContainer.innerHTML = ""; return; } const groupsToShow = parseInt(config.Settings.n_GroupsToShowInLegend || "4", 10); const activeTheme = config.Themes[config.active_theme_name]; const groupInfo = [{ name: "Group A", color: activeTheme.COLOR_POSITION_BOX }, { name: "Group B", color: activeTheme.COLOR_GROUP_B_BOX }, { name: "Group C", color: activeTheme.COLOR_GROUP_C_BOX }, { name: "Group D", color: activeTheme.COLOR_GROUP_D_BOX }]; let legendHTML = ""; for (let i = 0; i < groupsToShow; i++) { if (groupInfo[i] && groupInfo[i].color) { legendHTML += `<div class="legend-item"><div class="legend-color-circle" style="background-color: ${groupInfo[i].color};"></div><span>${groupInfo[i].name}</span></div>`; } } legendContainer.innerHTML = legendHTML; }
function updatePageLegend(currentPage, totalPages, itemsPerPage, totalItems) { const pageLegendContainer = document.getElementById("pageLegend"); if (!pageLegendContainer) return; const startItem = currentPage * itemsPerPage + 1; const endItem = Math.min((currentPage + 1) * itemsPerPage, totalItems); pageLegendContainer.innerHTML = `Page ${currentPage + 1}/${totalPages}: ${startItem} - ${endItem}`; }

function renderLigaHeader(config) {
    const headerContainer = document.getElementById("ligaHeader");
    if (!headerContainer) return;

    // --- LOGICA DE VARIANTE ---
    const variant = parseInt(config.Settings.n_LeagueVariant || '1', 10);

    if (variant === 2) {
        // VARIANTE 2: Columnas personalizadas (Kills, Avg, Wins)
        const headersString = config.Settings.s_League2Headers || "Kills,Avg Placement,Map Wins";
        const headers = headersString.split(',').map(h => h.trim());
        // Cantidad de columnas (por defecto length de headers o variable explicita)
        const colCount = parseInt(config.Settings.n_League2Columns || headers.length, 10);

        let columnLabelsHTML = '';
        headers.forEach(h => { columnLabelsHTML += `<div>${h}</div>`; });

        headerContainer.innerHTML = `<div class="header-spacer"></div><div class="header-labels"><div class="header-team-label"></div><div class="header-map-labels">${columnLabelsHTML}</div></div><div class="header-points-label">TOTAL</div>`;
        
        const headerMapLabels = headerContainer.querySelector('.header-map-labels');
        if (headerMapLabels) {
            headerMapLabels.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
        }

    } else {
        // VARIANTE 1: Mapas 1 a X (Original)
        const mapsPlayed = parseInt(config.Settings.n_LigaMapsPlayed || '15', 10);
        let mapLabelsHTML = '';
        for (let i = 1; i <= mapsPlayed; i++) { mapLabelsHTML += `<div>M${i}</div>`; }
        headerContainer.innerHTML = `<div class="header-spacer"></div><div class="header-labels"><div class="header-team-label"></div><div class="header-map-labels">${mapLabelsHTML}</div></div><div class="header-points-label">TOTAL</div>`;
        const headerMapLabels = headerContainer.querySelector('.header-map-labels');
        if (headerMapLabels) {
            headerMapLabels.style.gridTemplateColumns = `repeat(${mapsPlayed}, 1fr)`;
        }
    }
}

function initPuntosEquipoLiga(config) {
    // =========================================================================
    // CONFIGURACIÓN MANUAL DE PÁGINA (ESTÁTICA)
    const PAGE_TO_SHOW = 3; 
    // =========================================================================

    const DATA_REFRESH_INTERVAL = 10000;
    setDynamicBackground(document.body, 'overall_leaderboard', config);
    applyColorConfig(config);
    renderGroupLegend(config);
    renderLigaHeader(config);
    const gridContainer = document.getElementById('gridContainer');
    const legendContainer = document.getElementById('groupLegend');
    if (!gridContainer || !legendContainer) return;
    
    // Configuración General
    const showLogos = (config.Settings.b_ShowTeamLogos || 'FALSE').toUpperCase() === 'TRUE';
    const logosPath = config.Settings.PATH_TEAM_LOGOS || "";
    const itemsPerPage = 10;
    const playersPerTeam = parseInt(config.Settings.n_PlayersPerTeam || '4', 10);
    const totalLeagueTeams = parseInt(config.Settings.n_TotalLeagueTeams || '100', 10);
    const enableQualification = (config.Settings.b_EnableQualificationHighlight || 'FALSE').toUpperCase() === 'TRUE';
    const qualificationThreshold = parseInt(config.Settings.n_QualificationThreshold || '22', 10);
    const enableGroupColors = (config.Settings.b_EnableGroupColors || 'FALSE').toUpperCase() === 'TRUE';
    
    // Variables de Variante
    const variant = parseInt(config.Settings.n_LeagueVariant || '1', 10);
    const mapsPlayed = parseInt(config.Settings.n_LigaMapsPlayed || '15', 10);
    
    // Variables Variante 2
    const league2Keys = (config.Settings.s_League2DataKeys || config.Settings.s_League2Headers || "Kills,Avg Placement,Map Wins").split(',').map(k => k.trim());
    const league2ColCount = parseInt(config.Settings.n_League2Columns || league2Keys.length, 10);

    let allData = [];
    let currentPage = PAGE_TO_SHOW - 1; 
    if (currentPage < 0) currentPage = 0;

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
        const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "" } = teamData;
        
        let players = [];
        for (let i = 1; i <= playersPerTeam; i++) { if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]); }
        let playersHTML = '';
        if (players.length === 4) { playersHTML = `<div class="player-grid"><div class="player-row">${players[0]} | ${players[1]}</div><div class="player-row">${players[2]} | ${players[3]}</div></div>`; } 
        else if (players.length === 3) { playersHTML = `<div class="player-row">${players[0]} | ${players[1]}</div><div class="player-row">${players[2]}</div>`; } 
        else { playersHTML = players.join(' | '); }

        // --- Generación de Columnas (Mapas o Stats) ---
        let columnsHTML = '';
        if (variant === 2) {
            league2Keys.forEach(key => {
                const val = teamData[key] !== undefined ? teamData[key] : '-';
                columnsHTML += `<div class="map-score">${val}</div>`;
            });
        } else {
            for (let i = 1; i <= mapsPlayed; i++) { columnsHTML += `<div class="map-score">${teamData[`Map${i}`] || '-'}</div>`; }
        }

        let positionBoxStyle = '';
        const normalizedGroup = (Grupo || "").trim().toUpperCase();

        if (enableGroupColors) { 
            const activeTheme = config.Themes[config.active_theme_name]; 
            if (normalizedGroup === 'GROUP B' && activeTheme.COLOR_GROUP_B_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_B_BOX};"`; 
            else if (normalizedGroup === 'GROUP C' && activeTheme.COLOR_GROUP_C_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_C_BOX};"`; 
            else if (normalizedGroup === 'GROUP D' && activeTheme.COLOR_GROUP_D_BOX) positionBoxStyle = `style="background-color: ${activeTheme.COLOR_GROUP_D_BOX};"`; 
        }
        
        let boxClass = "item-box";
        if (enableQualification && parseInt(Top, 10) <= qualificationThreshold) { boxClass += " qualification-highlight"; }

        const logoHTML = getLogoHTML(Equipo);
        const cleanName = Equipo.replace(/^Team\s+/i, '').trim().toLowerCase();

        return `<div class="${boxClass}" data-team-name="${cleanName}">
                    <div class="item-top" ${positionBoxStyle}>${Top}<span class="item-rounds">R${Rondas}</span></div>
                    <div class="team-info-container">
                        <div class="team-identity">
                            ${logoHTML}
                            <div class="team-names">
                                <div class="item-team-name">${Equipo}</div>
                                <div class="item-players">${playersHTML}</div>
                            </div>
                        </div>
                        <div class="map-scores-container">${columnsHTML}</div>
                    </div>
                    <div class="item-points">${Puntos}</div>
                </div>`;
    };

    const updateTeamItemDOM = (domElement, teamData) => {
        try {
            const { Top = "-", Equipo = "N/A", Puntos = "0", Rondas = "0", Grupo = "" } = teamData;
            
            let players = [];
            for (let i = 1; i <= playersPerTeam; i++) { if (teamData[`Jugador${i}`]) players.push(teamData[`Jugador${i}`]); }
            let playersHTML = '';
            if (players.length === 4) { playersHTML = `<div class="player-grid"><div class="player-row">${players[0]} | ${players[1]}</div><div class="player-row">${players[2]} | ${players[3]}</div></div>`; } 
            else if (players.length === 3) { playersHTML = `<div class="player-row">${players[0]} | ${players[1]}</div><div class="player-row">${players[2]}</div>`; } 
            else { playersHTML = players.join(' | '); }

            const elTop = domElement.querySelector('.item-top');
            const elName = domElement.querySelector('.item-team-name');
            const elPlayers = domElement.querySelector('.item-players');
            const elPoints = domElement.querySelector('.item-points');
            const elLogoContainer = domElement.querySelector('.team-logo-container');
            const elMapContainer = domElement.querySelector('.map-scores-container');
            const elTeamIdentity = domElement.querySelector('.team-identity');

            if(elTop) elTop.innerHTML = `${Top}<span class="item-rounds">R${Rondas}</span>`;
            if(elName) elName.textContent = Equipo;
            if(elPlayers) elPlayers.innerHTML = playersHTML;
            if(elPoints) elPoints.textContent = Puntos;

            if (elMapContainer) {
                let columnsHTML = '';
                if (variant === 2) {
                    league2Keys.forEach(key => {
                        const val = teamData[key] !== undefined ? teamData[key] : '-';
                        columnsHTML += `<div class="map-score">${val}</div>`;
                    });
                } else {
                    for (let i = 1; i <= mapsPlayed; i++) { columnsHTML += `<div class="map-score">${teamData[`Map${i}`] || '-'}</div>`; }
                }
                elMapContainer.innerHTML = columnsHTML;
            }

            let boxClass = "item-box";
            if (enableQualification && parseInt(Top, 10) <= qualificationThreshold) { boxClass += " qualification-highlight"; }
            domElement.className = boxClass;

            if(elTop) {
                elTop.style.backgroundColor = ""; 
                if (enableGroupColors) {
                    const activeTheme = config.Themes[config.active_theme_name];
                    const normalizedGroup = (Grupo || "").trim().toUpperCase();
                    if (activeTheme) {
                        if (normalizedGroup === 'GROUP B' && activeTheme.COLOR_GROUP_B_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_B_BOX;
                        else if (normalizedGroup === 'GROUP C' && activeTheme.COLOR_GROUP_C_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_C_BOX;
                        else if (normalizedGroup === 'GROUP D' && activeTheme.COLOR_GROUP_D_BOX) elTop.style.backgroundColor = activeTheme.COLOR_GROUP_D_BOX;
                    }
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
                    } else if (elTeamIdentity) {
                        elTeamIdentity.insertAdjacentHTML('afterbegin', newLogoHTML);
                    }
                }
            }
        } catch (e) {
            console.error("Error actualizando fila:", e);
        }
    };

    const displayCurrentPage = () => {
        if (!gridContainer) return;
        const totalPages = Math.ceil(allData.length / itemsPerPage);
        
        if (currentPage >= totalPages && totalPages > 0) currentPage = totalPages - 1;
        if (totalPages === 0) currentPage = 0;

        const start = currentPage * itemsPerPage;
        const pageData = allData.slice(start, start + itemsPerPage);

        const currentItems = gridContainer.querySelectorAll('.item-box');

        if (currentItems.length === pageData.length && currentItems.length > 0) {
            pageData.forEach((team, index) => {
                updateTeamItemDOM(currentItems[index], team);
            });
        } else {
            let newHTML = "";
            pageData.forEach(team => { newHTML += createTeamItemHTML(team); });
            gridContainer.innerHTML = newHTML;
        }
        
        // --- Aplicar estilo de columnas GRID ---
        let gridColsStyle = "";
        if (variant === 2) {
            gridColsStyle = `repeat(${league2ColCount}, 1fr)`;
        } else {
            gridColsStyle = `repeat(${mapsPlayed}, 1fr)`;
        }

        gridContainer.querySelectorAll('.map-scores-container').forEach(container => {
            container.style.gridTemplateColumns = gridColsStyle;
        });

        // Ajuste de fuente (Misma lógica, aplicable a ambos)
        let fontSize = '1.1em';
        if (variant === 1) {
            if (mapsPlayed > 24) fontSize = '0.8em';
            else if (mapsPlayed > 18) fontSize = '0.9em';
        }
        document.querySelectorAll('.map-score, .header-map-labels > div').forEach(el => el.style.fontSize = fontSize);

        gridContainer.style.opacity = 1;
        legendContainer.style.opacity = 1;
        
        updatePageLegend(currentPage, totalPages, itemsPerPage, allData.length);
    };
    
    const refreshData = async () => { const fetchedData = await fetchSheetDataSE("GID_PuntosEquipoLiga", config); if (Array.isArray(fetchedData) && fetchedData.length > 0) { allData = fetchedData.slice(0, totalLeagueTeams); displayCurrentPage(); } };

    refreshData();
    setInterval(refreshData, DATA_REFRESH_INTERVAL);
}