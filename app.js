/* =========================================================
   CINEVO / DRAMA TREE TRACKER
   Firebase Firestore Realtime Cloud Sync (Anti-Echo Fix)
   ========================================================= */

"use strict";

const STORAGE_KEY = "dramaTreeTrackerData";
const CINEVO_ANONYMOUS_STORAGE_KEY = `${STORAGE_KEY}_anonymous`;
const CINEVO_USER_STORAGE_PREFIX = `${STORAGE_KEY}_user_`;
const CINEVO_LAST_UID_KEY = `${STORAGE_KEY}_last_uid`;

/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const menuButton = document.getElementById("menuButton");
const closeSidebarButton = document.getElementById("closeSidebarButton");

const addPlatformButton = document.getElementById("addPlatformButton");
const platformForm = document.getElementById("platformForm");
const platformNameInput = document.getElementById("platformNameInput");

const treeContainer = document.getElementById("treeContainer");
const emptyState = document.getElementById("emptyState");

const searchInput = document.getElementById("searchInput");
const findButton = document.getElementById("findButton");
const searchStatus = document.getElementById("searchStatus");

const libraryDashboard = document.getElementById("libraryDashboard");
const libraryQuickStats = document.getElementById("libraryQuickStats");
const statsOverlay = document.getElementById("statsOverlay");
const closeStatsButton = document.getElementById("closeStatsButton");

const statPlatforms = document.getElementById("statPlatforms");
const statDramas = document.getElementById("statDramas");
const statWatched = document.getElementById("statWatched");
const statRating = document.getElementById("statRating");
const statPriority = document.getElementById("statPriority");
const statSubscription = document.getElementById("statSubscription");

/* =========================================================
   STORAGE HELPERS & STATE
   ========================================================= */

let cinevoCloudUser = null;
let cinevoCloudReady = false;
let cinevoCloudUnsubscribe = null;
let cinevoCloudSaveTimer = null;
let cinevoCloudSyncToken = 0;

function getCinevoUserStorageKey(uid) {
    return `${CINEVO_USER_STORAGE_PREFIX}${uid}`;
}

function readCinevoStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error("Storage read error:", error);
        return null;
    }
}

function writeCinevoStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error("Storage write error:", error);
    }
}

function createDefaultLibrary() {
    return {
        priorityPlatformId: null,
        platforms: []
    };
}

function isValidLibrary(data) {
    return Boolean(
        data &&
        typeof data === "object" &&
        Array.isArray(data.platforms)
    );
}

function normalizeLibrary(data) {
    if (!isValidLibrary(data)) {
        return createDefaultLibrary();
    }
    return {
        priorityPlatformId: Object.prototype.hasOwnProperty.call(data, "priorityPlatformId")
            ? data.priorityPlatformId
            : null,
        platforms: Array.isArray(data.platforms) ? data.platforms : []
    };
}

/* =========================================================
   LOAD LOCAL / ANONYMOUS LIBRARY
   ========================================================= */

function loadLibrary() {
    try {
        const anonymousData = readCinevoStorage(CINEVO_ANONYMOUS_STORAGE_KEY);
        if (anonymousData && isValidLibrary(anonymousData)) {
            return normalizeLibrary(anonymousData);
        }

        const oldData = readCinevoStorage(STORAGE_KEY);
        if (oldData && isValidLibrary(oldData)) {
            const normalized = normalizeLibrary(oldData);
            writeCinevoStorage(CINEVO_ANONYMOUS_STORAGE_KEY, normalized);
            return normalized;
        }
    } catch (error) {
        console.error("Could not load library:", error);
    }
    return createDefaultLibrary();
}

let library = loadLibrary();

/* =========================================================
   LOCAL & CLOUD SAVING
   ========================================================= */

function saveCinevoLocalLibrary(data = library) {
    const normalized = normalizeLibrary(data);
    if (cinevoCloudUser?.uid) {
        writeCinevoStorage(getCinevoUserStorageKey(cinevoCloudUser.uid), normalized);
    } else {
        writeCinevoStorage(CINEVO_ANONYMOUS_STORAGE_KEY, normalized);
        writeCinevoStorage(STORAGE_KEY, normalized);
    }
}

async function saveCinevoCloudLibrary() {
    if (!cinevoCloudUser?.uid || !cinevoCloudReady || !window.cinevoFirebase) {
        return;
    }

    try {
        const { db, doc, setDoc, serverTimestamp } = window.cinevoFirebase;
        const userRef = doc(db, "users", cinevoCloudUser.uid);

        await setDoc(
            userRef,
            {
                library: normalizeLibrary(library),
                updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
            },
            { merge: true }
        );
        console.log("Cinevo library synced to Firestore.");
    } catch (error) {
        console.error("Firestore sync error:", error);
    }
}

function queueCinevoCloudSave() {
    if (!cinevoCloudUser?.uid || !cinevoCloudReady) {
        return;
    }

    clearTimeout(cinevoCloudSaveTimer);
    cinevoCloudSaveTimer = setTimeout(() => {
        saveCinevoCloudLibrary();
    }, 250);
}

function saveLibrary() {
    try {
        saveCinevoLocalLibrary(library);
        updateLibraryDashboard();
        queueCinevoCloudSave();
    } catch (error) {
        console.error("Could not save library:", error);
        alert("Could not save your library.");
    }
}

/* =========================================================
   FIRESTORE CLOUD SYNC
   ========================================================= */

async function startCinevoCloudSync(user) {
    if (!user || !window.cinevoFirebase) {
        return;
    }

    if (cinevoCloudUser && cinevoCloudUser.uid === user.uid && cinevoCloudReady) {
        return;
    }

    const currentToken = ++cinevoCloudSyncToken;

    if (cinevoCloudUnsubscribe) {
        cinevoCloudUnsubscribe();
        cinevoCloudUnsubscribe = null;
    }

    clearTimeout(cinevoCloudSaveTimer);
    cinevoCloudUser = user;
    cinevoCloudReady = false;

    const { db, doc, getDoc, setDoc, onSnapshot, serverTimestamp } = window.cinevoFirebase;
    const userDoc = doc(db, "users", user.uid);

    try {
        const snapshot = await getDoc(userDoc);

        if (currentToken !== cinevoCloudSyncToken || cinevoCloudUser !== user) {
            return;
        }

        if (snapshot.exists()) {
            const cloudData = snapshot.data();
            if (cloudData.library && isValidLibrary(cloudData.library)) {
                library = normalizeLibrary(cloudData.library);
                writeCinevoStorage(getCinevoUserStorageKey(user.uid), library);
                renderTree(searchInput.value.trim());
                updateLibraryDashboard();
                console.log("Cinevo library loaded from Firestore.");
            }
        } else {
            const localAccountLibrary = readCinevoStorage(getCinevoUserStorageKey(user.uid)) ||
                                        readCinevoStorage(CINEVO_ANONYMOUS_STORAGE_KEY) ||
                                        loadLibrary();

            library = normalizeLibrary(localAccountLibrary);
            writeCinevoStorage(getCinevoUserStorageKey(user.uid), library);

            cinevoCloudReady = true;

            await setDoc(
                userDoc,
                {
                    library: library,
                    updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString()
                },
                { merge: true }
            );

            renderTree(searchInput.value.trim());
            updateLibraryDashboard();
        }

        localStorage.setItem(CINEVO_LAST_UID_KEY, user.uid);
        cinevoCloudReady = true;

        // Start Realtime Listener
        cinevoCloudUnsubscribe = onSnapshot(
            userDoc,
            (cloudSnapshot) => {
                if (currentToken !== cinevoCloudSyncToken || cinevoCloudUser !== user) return;
                if (!cloudSnapshot.exists()) return;

                const cloudData = cloudSnapshot.data();
                if (!cloudData.library || !isValidLibrary(cloudData.library)) return;

                // ====================================================
                // THE ANTI-ECHO FIX: 
                // Check if incoming cloud data matches our local data
                // ====================================================
                const incomingDataString = JSON.stringify(normalizeLibrary(cloudData.library));
                const currentDataString = JSON.stringify(normalizeLibrary(library));

                if (incomingDataString === currentDataString) {
                    // Data is identical! This is just our own echo. 
                    // Do not redraw the screen. Stop the folders from snapping.
                    return; 
                }

                // If data IS different (edited on another device), we update and redraw.
                library = normalizeLibrary(cloudData.library);
                writeCinevoStorage(getCinevoUserStorageKey(user.uid), library);
                renderTree(searchInput.value.trim());
                updateLibraryDashboard();
            },
            (error) => {
                console.error("Firestore realtime sync listener error:", error);
            }
        );

    } catch (error) {
        cinevoCloudReady = false;
        console.error("Could not start Firestore sync:", error);
    }
}

function stopCinevoCloudSync() {
    ++cinevoCloudSyncToken;

    if (cinevoCloudUnsubscribe) {
        cinevoCloudUnsubscribe();
        cinevoCloudUnsubscribe = null;
    }

    clearTimeout(cinevoCloudSaveTimer);
    cinevoCloudUser = null;
    cinevoCloudReady = false;

    library = readCinevoStorage(CINEVO_ANONYMOUS_STORAGE_KEY) || createDefaultLibrary();
    renderTree(searchInput.value.trim());
    updateLibraryDashboard();
}

/* =========================================================
   AUTH & READY EVENT LISTENERS
   ========================================================= */

window.addEventListener("cinevo-auth-changed", (event) => {
    const user = event.detail?.user || null;
    if (user) {
        startCinevoCloudSync(user);
    } else {
        stopCinevoCloudSync();
    }
});

window.addEventListener("cinevo-firebase-ready", () => {
    if (window.cinevoCurrentUser) {
        startCinevoCloudSync(window.cinevoCurrentUser);
    }
});

if (window.cinevoFirebase && window.cinevoCurrentUser) {
    startCinevoCloudSync(window.cinevoCurrentUser);
}

/* =========================================================
   CORE APP HELPERS & RENDERING
   ========================================================= */

function generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openSidebar() {
    sidebar.classList.add("active");
    sidebarOverlay.classList.add("active");
    sidebar.setAttribute("aria-hidden", "false");
    sidebarOverlay.setAttribute("aria-hidden", "false");
    renderTree(searchInput.value.trim());
}

function closeSidebar() {
    sidebar.classList.remove("active");
    sidebarOverlay.classList.remove("active");
    sidebar.setAttribute("aria-hidden", "true");
    sidebarOverlay.setAttribute("aria-hidden", "true");
}

menuButton.addEventListener("click", openSidebar);
closeSidebarButton.addEventListener("click", closeSidebar);
sidebarOverlay.addEventListener("click", closeSidebar);

addPlatformButton.addEventListener("click", () => {
    platformForm.classList.toggle("hidden");
    if (!platformForm.classList.contains("hidden")) {
        platformNameInput.focus();
    }
});

platformForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = platformNameInput.value.trim();
    if (!name) return;

    const alreadyExists = library.platforms.some(
        p => p.name.toLowerCase() === name.toLowerCase()
    );

    if (alreadyExists) {
        alert("This platform already exists.");
        platformNameInput.focus();
        return;
    }

    const platform = {
        id: generateId("platform"),
        name: name,
        createdAt: new Date().toISOString(),
        subscriptionExpiresAt: null,
        dramas: []
    };

    library.platforms.push(platform);
    saveLibrary();
    platformNameInput.value = "";
    platformForm.classList.add("hidden");
    renderTree(searchInput.value.trim());
});

function renamePlatform(platformId) {
    const platform = library.platforms.find(item => item.id === platformId);
    if (!platform) return;

    const newName = prompt("Enter the new platform name:", platform.name);
    if (newName === null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
        alert("Platform name cannot be empty.");
        return;
    }

    const duplicate = library.platforms.some(
        item => item.id !== platformId && item.name.toLowerCase() === trimmed.toLowerCase()
    );

    if (duplicate) {
        alert("A platform with this name already exists.");
        return;
    }

    platform.name = trimmed;
    saveLibrary();
    renderTree(searchInput.value.trim());
}

function deletePlatform(platformId) {
    const platform = library.platforms.find(item => item.id === platformId);
    if (!platform) return;

    const count = platform.dramas.length;
    const msg = count > 0
        ? `Delete "${platform.name}" and its ${count} drama${count === 1 ? "" : "s"}? This cannot be undone.`
        : `Delete "${platform.name}"? This cannot be undone.`;

    if (!confirm(msg)) return;

    library.platforms = library.platforms.filter(item => item.id !== platformId);
    if (library.priorityPlatformId === platformId) {
        library.priorityPlatformId = null;
    }

    saveLibrary();
    renderTree(searchInput.value.trim());
}

function setPriority(platformId) {
    const platform = library.platforms.find(item => item.id === platformId);
    if (!platform) return;

    if (!confirm(`Set "${platform.name}" as the Priority platform?`)) return;

    library.priorityPlatformId = platformId;
    const index = library.platforms.findIndex(item => item.id === platformId);
    if (index !== -1) {
        const priorityPlatform = library.platforms.splice(index, 1)[0];
        library.platforms.unshift(priorityPlatform);
    }

    while (true) {
        const answer = prompt("How many days are left on your subscription?");
        if (answer === null) break;

        const days = Number(answer.trim());
        if (Number.isInteger(days) && days >= 0) {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + days);
            platform.subscriptionExpiresAt = expiry.toISOString();
            break;
        }
        alert("Please enter a valid whole number of days.");
    }

    saveLibrary();
    renderTree(searchInput.value.trim());
}

function createSubscriptionBadge(platform) {
    const badge = document.createElement("span");
    badge.className = "subscription-badge";

    if (!platform.subscriptionExpiresAt) {
        badge.textContent = "⏳ No expiry";
        return badge;
    }

    const expiry = new Date(platform.subscriptionExpiresAt);
    const diff = expiry.getTime() - Date.now();

    if (diff <= 0) {
        badge.classList.add("expired");
        badge.textContent = "⚠️ Expired";
        return badge;
    }

    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    badge.textContent = `⏳ ${days} day${days === 1 ? "" : "s"} left`;
    return badge;
}

function toggleDramaForm(platformId, platformDetails) {
    const existing = platformDetails.querySelector(".drama-form");
    if (existing) {
        existing.remove();
        return;
    }

    const form = document.createElement("form");
    form.className = "drama-form";
    form.innerHTML = `
        <input type="text" name="dramaName" placeholder="Drama Name" maxlength="120" autocomplete="off" required>
        <input type="url" name="dramaUrl" placeholder="https://example.com/drama" autocomplete="off" required>
        <button type="submit">Save Drama</button>
    `;

    form.addEventListener("click", e => e.stopPropagation());
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = form.elements.dramaName.value.trim();
        const url = form.elements.dramaUrl.value.trim();
        if (!name || !url) return;

        try {
            const validUrl = new URL(url);
            if (validUrl.protocol !== "http:" && validUrl.protocol !== "https:") {
                throw new Error("Invalid URL");
            }
        } catch {
            alert("Please enter a valid HTTP or HTTPS URL.");
            return;
        }

        const platform = library.platforms.find(item => item.id === platformId);
        if (!platform) return;

        platform.dramas.push({
            id: generateId("drama"),
            name: name,
            url: url,
            watched: false,
            rating: 0,
            addedAt: new Date().toISOString()
        });

        saveLibrary();
        renderTree(searchInput.value.trim());

        const newPlatform = treeContainer.querySelector(`[data-platform-id="${CSS.escape(platformId)}"]`);
        if (newPlatform) newPlatform.open = true;
    });

    platformDetails.appendChild(form);
    platformDetails.open = true;
    form.elements.dramaName.focus();
}

function renameDrama(platformId, dramaId) {
    const platform = library.platforms.find(item => item.id === platformId);
    if (!platform) return;
    const drama = platform.dramas.find(item => item.id === dramaId);
    if (!drama) return;

    const newName = prompt("Enter the new drama name:", drama.name);
    if (newName === null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
        alert("Drama name cannot be empty.");
        return;
    }

    drama.name = trimmed;
    saveLibrary();
    renderTree(searchInput.value.trim());
}

function deleteDrama(platformId, dramaId) {
    const platform = library.platforms.find(item => item.id === platformId);
    if (!platform) return;
    const drama = platform.dramas.find(item => item.id === dramaId);
    if (!drama) return;

    if (!confirm(`Delete "${drama.name}"? This cannot be undone.`)) return;

    platform.dramas = platform.dramas.filter(item => item.id !== dramaId);
    saveLibrary();
    renderTree(searchInput.value.trim());
}

function createPlatformElement(platform, matchingDramas, query) {
    const details = document.createElement("details");
    details.className = "platform-details";
    details.dataset.platformId = platform.id;

    const isPriority = platform.id === library.priorityPlatformId;
    if (isPriority) details.classList.add("priority-platform");

    if (query) {
        const platformMatches = platform.name.toLowerCase().includes(query.toLowerCase());
        if (platformMatches || matchingDramas.length > 0) details.open = true;
    }

    const summary = document.createElement("summary");
    summary.innerHTML = `
        <span class="platform-chevron">▶</span>
        <span class="platform-icon">${isPriority ? "⭐" : "📂"}</span>
        <span class="platform-name">${escapeHtml(platform.name)}</span>
    `;

    if (isPriority) {
        summary.appendChild(createSubscriptionBadge(platform));
    }

    const actions = document.createElement("span");
    actions.className = "platform-actions";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "tree-action";
    renameBtn.title = "Rename Platform";
    renameBtn.textContent = "✏️";
    renameBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        renamePlatform(platform.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "tree-action delete-action";
    deleteBtn.title = "Delete Platform";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deletePlatform(platform.id);
    });

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "tree-action";
    pinBtn.title = "Set as Priority";
    pinBtn.textContent = "📌";
    pinBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPriority(platform.id);
    });

    const addDramaBtn = document.createElement("button");
    addDramaBtn.type = "button";
    addDramaBtn.className = "tree-action";
    addDramaBtn.title = "Add Drama";
    addDramaBtn.textContent = "+";
    addDramaBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDramaForm(platform.id, details);
    });

    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(pinBtn);
    actions.appendChild(addDramaBtn);
    summary.appendChild(actions);
    details.appendChild(summary);

    const dramaList = document.createElement("div");
    dramaList.className = "drama-list";

    const platformMatches = query && platform.name.toLowerCase().includes(query.toLowerCase());
    const dramasToShow = (!query || platformMatches) ? platform.dramas : matchingDramas;

    dramasToShow.forEach(drama => {
        dramaList.appendChild(createDramaElement(platform, drama, query));
    });

    details.appendChild(dramaList);
    return details;
}

function createDramaElement(platform, drama, query) {
    const details = document.createElement("details");
    details.className = "drama-details";
    details.dataset.dramaId = drama.id; 
    if (query) details.open = true;

    const summary = document.createElement("summary");
    summary.innerHTML = `
        <span class="drama-chevron">▶</span>
        <span class="drama-icon">📑</span>
        <span class="drama-title">${escapeHtml(drama.name)}</span>
        <span class="drama-actions"></span>
    `;

    const dramaActions = summary.querySelector(".drama-actions");

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "tree-action";
    renameBtn.title = "Rename Drama";
    renameBtn.textContent = "✏️";
    renameBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameDrama(platform.id, drama.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "tree-action delete-action";
    deleteBtn.title = "Delete Drama";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteDrama(platform.id, drama.id);
    });

    dramaActions.appendChild(renameBtn);
    dramaActions.appendChild(deleteBtn);
    details.appendChild(summary);

    const stats = document.createElement("div");
    stats.className = "drama-stats";

    const urlLink = document.createElement("a");
    urlLink.className = "drama-url";
    urlLink.href = drama.url;
    urlLink.target = "_blank";
    urlLink.rel = "noopener noreferrer";
    urlLink.textContent = "🔗 Open Drama";
    stats.appendChild(urlLink);

    const watchedRow = document.createElement("div");
    watchedRow.className = "drama-control-row";
    const watchedLabel = document.createElement("label");
    const watchedCheckbox = document.createElement("input");
    watchedCheckbox.type = "checkbox";
    watchedCheckbox.checked = Boolean(drama.watched);
    const watchedText = document.createElement("span");
    watchedText.textContent = "Watched";

    watchedCheckbox.addEventListener("change", () => {
        drama.watched = watchedCheckbox.checked;
        saveLibrary();
    });

    watchedLabel.appendChild(watchedCheckbox);
    watchedLabel.appendChild(watchedText);
    watchedRow.appendChild(watchedLabel);
    stats.appendChild(watchedRow);

    const ratingRow = document.createElement("div");
    ratingRow.className = "drama-control-row";
    const ratingLabel = document.createElement("span");
    ratingLabel.textContent = "Rating";
    const ratingSelect = document.createElement("select");
    ratingSelect.className = "rating-select";

    const ratings = [
        ["0", "Not rated"],
        ["1", "★☆☆☆☆"],
        ["2", "★★☆☆☆"],
        ["3", "★★★☆☆"],
        ["4", "★★★★☆"],
        ["5", "★★★★★"]
    ];

    ratings.forEach(([val, text]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = text;
        if (Number(drama.rating) === Number(val)) opt.selected = true;
        ratingSelect.appendChild(opt);
    });

    ratingSelect.addEventListener("change", () => {
        drama.rating = Number(ratingSelect.value);
        saveLibrary();
    });

    ratingRow.appendChild(ratingLabel);
    ratingRow.appendChild(ratingSelect);
    stats.appendChild(ratingRow);

    const addedTime = document.createElement("div");
    addedTime.className = "added-time";
    addedTime.textContent = `Added: ${formatDate(drama.addedAt)}`;
    stats.appendChild(addedTime);

    details.appendChild(stats);
    return details;
}

function formatDate(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium"
    }).format(date);
}

function filterLibrary(query) {
    if (!query) {
        return library.platforms.map(p => ({
            platform: p,
            matchingDramas: p.dramas,
            platformMatches: true
        }));
    }

    const search = query.toLowerCase();
    return library.platforms.map(platform => {
        const platformMatches = platform.name.toLowerCase().includes(search);
        const matchingDramas = platform.dramas.filter(d => d.name.toLowerCase().includes(search));
        return {
            platform,
            matchingDramas,
            platformMatches
        };
    }).filter(res => res.platformMatches || res.matchingDramas.length > 0);
}

function renderTree(query = "") {
    const openPlatforms = new Set();
    const openDramas = new Set();

    if (treeContainer) {
        treeContainer.querySelectorAll('.platform-details[open]').forEach(el => {
            if (el.dataset.platformId) openPlatforms.add(el.dataset.platformId);
        });
        treeContainer.querySelectorAll('.drama-details[open]').forEach(el => {
            if (el.dataset.dramaId) openDramas.add(el.dataset.dramaId);
        });
    }

    treeContainer.innerHTML = "";
    const results = filterLibrary(query);

    if (library.platforms.length === 0) {
        emptyState.classList.remove("hidden");
        searchStatus.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    if (query) {
        searchStatus.classList.remove("hidden");
        const dramaMatches = results.reduce((tot, res) => tot + res.matchingDramas.length, 0);
        searchStatus.textContent = `${results.length} platform${results.length === 1 ? "" : "s"} · ${dramaMatches} matching drama${dramaMatches === 1 ? "" : "s"}`;
    } else {
        searchStatus.classList.add("hidden");
    }

    if (results.length === 0) {
        treeContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔎</div>
                <h3>No matches found</h3>
                <p>Try another platform or drama name.</p>
            </div>
        `;
        return;
    }

    const sortedResults = [...results].sort((a, b) => {
        const aPriority = a.platform.id === library.priorityPlatformId;
        const bPriority = b.platform.id === library.priorityPlatformId;
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return 0;
    });

    sortedResults.forEach(res => {
        const platformEl = createPlatformElement(res.platform, res.matchingDramas, query);
        
        if (!query && openPlatforms.has(res.platform.id)) {
            platformEl.open = true;
        }
        
        treeContainer.appendChild(platformEl);
    });

    if (!query) {
        openDramas.forEach(dramaId => {
            const dramaEl = treeContainer.querySelector(`.drama-details[data-drama-id="${CSS.escape(dramaId)}"]`);
            if (dramaEl) dramaEl.open = true;
        });
    }
}

function getLibraryStatistics() {
    const platforms = library.platforms.length;
    const dramas = library.platforms.reduce((tot, p) => tot + p.dramas.length, 0);
    const watched = library.platforms.reduce((tot, p) => tot + p.dramas.filter(d => Boolean(d.watched)).length, 0);
    const ratedDramas = library.platforms.flatMap(p => p.dramas).filter(d => Number(d.rating) > 0);

    let averageRating = "—";
    if (ratedDramas.length > 0) {
        const total = ratedDramas.reduce((tot, d) => tot + Number(d.rating), 0);
        averageRating = (total / ratedDramas.length).toFixed(1);
    }

    const priority = library.platforms.find(p => p.id === library.priorityPlatformId);

    return { platforms, dramas, watched, averageRating, priority };
}

function updateLibraryDashboard() {
    if (!libraryQuickStats) return;
    const stats = getLibraryStatistics();

    libraryQuickStats.textContent = `${stats.platforms} Platform${stats.platforms === 1 ? "" : "s"} · ${stats.dramas} Drama${stats.dramas === 1 ? "" : "s"}`;
    statPlatforms.textContent = stats.platforms;
    statDramas.textContent = stats.dramas;
    statWatched.textContent = stats.watched;
    statRating.textContent = stats.averageRating;

    if (stats.priority) {
        statPriority.textContent = `⭐ ${stats.priority.name}`;
    } else {
        statPriority.textContent = "None";
    }

    if (stats.priority && stats.priority.subscriptionExpiresAt) {
        const expiry = new Date(stats.priority.subscriptionExpiresAt);
        const diff = expiry.getTime() - Date.now();
        if (diff <= 0) {
            statSubscription.textContent = "⚠️ Expired";
        } else {
            const days = Math.round(diff / (1000 * 60 * 60 * 24));
            statSubscription.textContent = `⏳ ${days} day${days === 1 ? "" : "s"} left`;
        }
    } else {
        statSubscription.textContent = "None";
    }
}

function openStatistics() {
    updateLibraryDashboard();
    statsOverlay.classList.add("active");
    statsOverlay.setAttribute("aria-hidden", "false");
}

function closeStatistics() {
    statsOverlay.classList.remove("active");
    statsOverlay.setAttribute("aria-hidden", "true");
}

libraryDashboard.addEventListener("click", openStatistics);
closeStatsButton.addEventListener("click", closeStatistics);
statsOverlay.addEventListener("click", (e) => {
    if (e.target === statsOverlay) closeStatistics();
});

searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    if (q) openSidebar();
    renderTree(q);
});

findButton.addEventListener("click", () => {
    openSidebar();
    searchInput.focus();
    renderTree(searchInput.value.trim());
});

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (statsOverlay.classList.contains("active")) {
        closeStatistics();
        return;
    }
    if (sidebar.classList.contains("active")) {
        closeSidebar();
    }
});

setInterval(() => {
    if (library.priorityPlatformId) {
        renderTree(searchInput.value.trim());
        updateLibraryDashboard();
    }
}, 60 * 1000);

renderTree();
updateLibraryDashboard();

/* =========================================================
   SERVICE WORKER
   ========================================================= */

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./sw.js")
            .then(reg => console.log("Service Worker registered:", reg.scope))
            .catch(err => console.error("Service Worker registration failed:", err));
    });
}