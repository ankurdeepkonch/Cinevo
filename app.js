/* =========================================================
   DRAMA TREE TRACKER
   Complete Vanilla JavaScript
   ========================================================= */

"use strict";


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY = "dramaTreeTrackerData";


/* =========================================================
   DOM ELEMENTS
   ========================================================= */

const sidebar = document.getElementById("sidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");

const menuButton = document.getElementById("menuButton");
const closeSidebarButton =
    document.getElementById("closeSidebarButton");

const addPlatformButton =
    document.getElementById("addPlatformButton");

const platformForm =
    document.getElementById("platformForm");

const platformNameInput =
    document.getElementById("platformNameInput");

const treeContainer =
    document.getElementById("treeContainer");

const emptyState =
    document.getElementById("emptyState");

const searchInput =
    document.getElementById("searchInput");

const findButton =
    document.getElementById("findButton");

const searchStatus =
    document.getElementById("searchStatus");


/* =========================================================
   LIBRARY DASHBOARD ELEMENTS
   ========================================================= */

const libraryDashboard =
    document.getElementById("libraryDashboard");

const libraryQuickStats =
    document.getElementById("libraryQuickStats");

const statsOverlay =
    document.getElementById("statsOverlay");

const closeStatsButton =
    document.getElementById("closeStatsButton");

const statPlatforms =
    document.getElementById("statPlatforms");

const statDramas =
    document.getElementById("statDramas");

const statWatched =
    document.getElementById("statWatched");

const statRating =
    document.getElementById("statRating");

const statPriority =
    document.getElementById("statPriority");

const statSubscription =
    document.getElementById("statSubscription");


/* =========================================================
   LOAD DATA
   ========================================================= */

let library = loadLibrary();


/* =========================================================
   DEFAULT DATA
   ========================================================= */

function createDefaultLibrary() {

    return {
        priorityPlatformId: null,
        platforms: []
    };
}


/* =========================================================
   LOAD FROM LOCAL STORAGE
   ========================================================= */

function loadLibrary() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return createDefaultLibrary();
        }

        const data =
            JSON.parse(saved);

        if (
            !data ||
            !Array.isArray(data.platforms)
        ) {
            return createDefaultLibrary();
        }

        if (
            !Object.prototype.hasOwnProperty.call(
                data,
                "priorityPlatformId"
            )
        ) {
            data.priorityPlatformId = null;
        }

        return data;

    } catch (error) {

        console.error(
            "Could not load library:",
            error
        );

        return createDefaultLibrary();
    }
}


/* =========================================================
   SAVE TO LOCAL STORAGE
   ========================================================= */

function saveLibrary() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(library)
        );

        updateLibraryDashboard();

    } catch (error) {

        console.error(
            "Could not save library:",
            error
        );

        alert(
            "Could not save your library."
        );
    }
}


/* =========================================================
   UNIQUE ID
   ========================================================= */

function generateId(prefix) {

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


/* =========================================================
   SIDEBAR
   ========================================================= */

function openSidebar() {

    sidebar.classList.add("active");

    sidebarOverlay.classList.add("active");

    sidebar.setAttribute(
        "aria-hidden",
        "false"
    );

    sidebarOverlay.setAttribute(
        "aria-hidden",
        "false"
    );

    renderTree(
        searchInput.value.trim()
    );
}


function closeSidebar() {

    sidebar.classList.remove("active");

    sidebarOverlay.classList.remove("active");

    sidebar.setAttribute(
        "aria-hidden",
        "true"
    );

    sidebarOverlay.setAttribute(
        "aria-hidden",
        "true"
    );
}


menuButton.addEventListener(
    "click",
    openSidebar
);


closeSidebarButton.addEventListener(
    "click",
    closeSidebar
);


sidebarOverlay.addEventListener(
    "click",
    closeSidebar
);


/* =========================================================
   ADD PLATFORM
   ========================================================= */

addPlatformButton.addEventListener(
    "click",
    function () {

        platformForm.classList.toggle(
            "hidden"
        );

        if (
            !platformForm.classList.contains(
                "hidden"
            )
        ) {

            platformNameInput.focus();
        }
    }
);


platformForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();

        const name =
            platformNameInput.value.trim();

        if (!name) {
            return;
        }


        /* Prevent duplicate platform */

        const alreadyExists =
            library.platforms.some(
                platform =>
                    platform.name.toLowerCase() ===
                    name.toLowerCase()
            );


        if (alreadyExists) {

            alert(
                "This platform already exists."
            );

            platformNameInput.focus();

            return;
        }


        /* Create platform */

        const platform = {

            id: generateId("platform"),

            name: name,

            createdAt:
                new Date().toISOString(),

            subscriptionExpiresAt:
                null,

            dramas: []
        };


        library.platforms.push(
            platform
        );


        saveLibrary();


        platformNameInput.value = "";

        platformForm.classList.add(
            "hidden"
        );


        renderTree(
            searchInput.value.trim()
        );
    }
);


/* =========================================================
   RENAME PLATFORM
   ========================================================= */

function renamePlatform(platformId) {

    const platform =
        library.platforms.find(
            item =>
                item.id === platformId
        );


    if (!platform) {
        return;
    }


    const newName =
        prompt(
            "Enter the new platform name:",
            platform.name
        );


    if (newName === null) {
        return;
    }


    const trimmedName =
        newName.trim();


    if (!trimmedName) {

        alert(
            "Platform name cannot be empty."
        );

        return;
    }


    /* Check duplicate */

    const duplicate =
        library.platforms.some(
            item =>
                item.id !== platformId &&
                item.name.toLowerCase() ===
                trimmedName.toLowerCase()
        );


    if (duplicate) {

        alert(
            "A platform with this name already exists."
        );

        return;
    }


    platform.name =
        trimmedName;


    saveLibrary();


    renderTree(
        searchInput.value.trim()
    );
}


/* =========================================================
   DELETE PLATFORM
   ========================================================= */

function deletePlatform(platformId) {

    const platform =
        library.platforms.find(
            item =>
                item.id === platformId
        );


    if (!platform) {
        return;
    }


    const dramaCount =
        platform.dramas.length;


    let message;


    if (dramaCount > 0) {

        message =
            `Delete "${platform.name}" and its ` +
            `${dramaCount} drama` +
            `${dramaCount === 1 ? "" : "s"}? ` +
            `This cannot be undone.`;

    } else {

        message =
            `Delete "${platform.name}"? ` +
            `This cannot be undone.`;
    }


    const confirmed =
        confirm(message);


    if (!confirmed) {
        return;
    }


    /* Remove platform */

    library.platforms =
        library.platforms.filter(
            item =>
                item.id !== platformId
        );


    /* Remove priority if necessary */

    if (
        library.priorityPlatformId ===
        platformId
    ) {

        library.priorityPlatformId =
            null;
    }


    saveLibrary();


    renderTree(
        searchInput.value.trim()
    );
}


/* =========================================================
   PRIORITY PLATFORM
   ========================================================= */

function setPriority(platformId) {

    const platform =
        library.platforms.find(
            item =>
                item.id === platformId
        );


    if (!platform) {
        return;
    }


    const confirmed =
        confirm(
            `Set "${platform.name}" as the Priority platform?`
        );


    if (!confirmed) {
        return;
    }


    library.priorityPlatformId =
        platformId;


    /* Move priority platform to top */

    const index =
        library.platforms.findIndex(
            item =>
                item.id === platformId
        );


    if (index !== -1) {

        const priorityPlatform =
            library.platforms.splice(
                index,
                1
            )[0];


        library.platforms.unshift(
            priorityPlatform
        );
    }


    /* Ask subscription */

    while (true) {

        const answer =
            prompt(
                "How many days are left on your subscription?"
            );


        /* User cancelled */

        if (answer === null) {
            break;
        }


        const days =
            Number(
                answer.trim()
            );


        if (
            Number.isInteger(days) &&
            days >= 0
        ) {

            const expiry =
                new Date();


            expiry.setDate(
                expiry.getDate() + days
            );


            platform.subscriptionExpiresAt =
                expiry.toISOString();


            break;
        }


        alert(
            "Please enter a valid whole number of days."
        );
    }


    saveLibrary();


    renderTree(
        searchInput.value.trim()
    );
}


/* =========================================================
   SUBSCRIPTION BADGE
   ========================================================= */

function createSubscriptionBadge(platform) {

    const badge =
        document.createElement("span");

    badge.className =
        "subscription-badge";


    if (
        !platform.subscriptionExpiresAt
    ) {

        badge.textContent =
            "⏳ No expiry";

        return badge;
    }


    const expiry =
        new Date(
            platform.subscriptionExpiresAt
        );


    const difference =
        expiry.getTime() -
        Date.now();


    if (difference <= 0) {

        badge.classList.add(
            "expired"
        );

        badge.textContent =
            "⚠️ Expired";

        return badge;
    }


    const days =
        Math.ceil(
            difference /
            (1000 * 60 * 60 * 24)
        );


    badge.textContent =
        `⏳ ${days} day` +
        `${days === 1 ? "" : "s"} left`;


    return badge;
}


/* =========================================================
   ADD DRAMA FORM
   ========================================================= */

function toggleDramaForm(
    platformId,
    platformDetails
) {

    const existing =
        platformDetails.querySelector(
            ".drama-form"
        );


    /* Close if already open */

    if (existing) {

        existing.remove();

        return;
    }


    const form =
        document.createElement("form");

    form.className =
        "drama-form";


    form.innerHTML = `
        <input
            type="text"
            name="dramaName"
            placeholder="Drama Name"
            maxlength="120"
            autocomplete="off"
            required
        >

        <input
            type="url"
            name="dramaUrl"
            placeholder="https://example.com/drama"
            autocomplete="off"
            required
        >

        <button type="submit">
            Save Drama
        </button>
    `;


    form.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();
        }
    );


    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const name =
                form.elements.dramaName.value.trim();


            const url =
                form.elements.dramaUrl.value.trim();


            if (!name || !url) {
                return;
            }


            /* Validate URL */

            let validUrl;


            try {

                validUrl =
                    new URL(url);


                if (
                    validUrl.protocol !== "http:" &&
                    validUrl.protocol !== "https:"
                ) {

                    throw new Error(
                        "Invalid URL"
                    );
                }

            } catch {

                alert(
                    "Please enter a valid HTTP or HTTPS URL."
                );

                return;
            }


            /* Find platform */

            const platform =
                library.platforms.find(
                    item =>
                        item.id === platformId
                );


            if (!platform) {
                return;
            }


            /* Create drama */

            const drama = {

                id: generateId("drama"),

                name: name,

                url: validUrl.href,

                watched: false,

                rating: 0,

                addedAt:
                    new Date().toISOString()
            };


            platform.dramas.push(
                drama
            );


            saveLibrary();


            const query =
                searchInput.value.trim();


            renderTree(query);


            /* Re-open platform */

            const newPlatform =
                treeContainer.querySelector(
                    `[data-platform-id="${CSS.escape(platformId)}"]`
                );


            if (newPlatform) {

                newPlatform.open =
                    true;
            }
        }
    );


    platformDetails.appendChild(
        form
    );


    platformDetails.open =
        true;


    form.elements.dramaName.focus();
}


/* =========================================================
   RENAME DRAMA
   ========================================================= */

function renameDrama(
    platformId,
    dramaId
) {

    const platform =
        library.platforms.find(
            item =>
                item.id === platformId
        );


    if (!platform) {
        return;
    }


    const drama =
        platform.dramas.find(
            item =>
                item.id === dramaId
        );


    if (!drama) {
        return;
    }


    const newName =
        prompt(
            "Enter the new drama name:",
            drama.name
        );


    if (newName === null) {
        return;
    }


    const trimmedName =
        newName.trim();


    if (!trimmedName) {

        alert(
            "Drama name cannot be empty."
        );

        return;
    }


    drama.name =
        trimmedName;


    saveLibrary();


    renderTree(
        searchInput.value.trim()
    );
}


/* =========================================================
   DELETE DRAMA
   ========================================================= */

function deleteDrama(
    platformId,
    dramaId
) {

    const platform =
        library.platforms.find(
            item =>
                item.id === platformId
        );


    if (!platform) {
        return;
    }


    const drama =
        platform.dramas.find(
            item =>
                item.id === dramaId
        );


    if (!drama) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${drama.name}"? ` +
            `This cannot be undone.`
        );


    if (!confirmed) {
        return;
    }


    platform.dramas =
        platform.dramas.filter(
            item =>
                item.id !== dramaId
        );


    saveLibrary();


    renderTree(
        searchInput.value.trim()
    );
}


/* =========================================================
   CREATE PLATFORM ELEMENT
   ========================================================= */

function createPlatformElement(
    platform,
    matchingDramas,
    query
) {

    const details =
        document.createElement("details");

    details.className =
        "platform-details";


    details.dataset.platformId =
        platform.id;


    const isPriority =
        platform.id ===
        library.priorityPlatformId;


    if (isPriority) {

        details.classList.add(
            "priority-platform"
        );
    }


    /* Automatically expand search matches */

    if (query) {

        const platformMatches =
            platform.name
                .toLowerCase()
                .includes(
                    query.toLowerCase()
                );


        if (
            platformMatches ||
            matchingDramas.length > 0
        ) {

            details.open = true;
        }
    }


    /* =====================================================
       PLATFORM SUMMARY
       ===================================================== */

    const summary =
        document.createElement("summary");


    summary.innerHTML = `
        <span class="platform-chevron">▶</span>

        <span class="platform-icon">
            ${isPriority ? "⭐" : "📂"}
        </span>

        <span class="platform-name">
            ${escapeHtml(platform.name)}
        </span>
    `;


    /* Subscription */

    if (isPriority) {

        summary.appendChild(
            createSubscriptionBadge(
                platform
            )
        );
    }


    /* =====================================================
       PLATFORM ACTIONS
       ===================================================== */

    const actions =
        document.createElement("span");

    actions.className =
        "platform-actions";


    /* Rename */

    const renameButton =
        document.createElement("button");

    renameButton.type =
        "button";

    renameButton.className =
        "tree-action";

    renameButton.title =
        "Rename Platform";

    renameButton.textContent =
        "✏️";


    renameButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            renamePlatform(
                platform.id
            );
        }
    );


    /* Delete */

    const deleteButton =
        document.createElement("button");

    deleteButton.type =
        "button";

    deleteButton.className =
        "tree-action delete-action";

    deleteButton.title =
        "Delete Platform";

    deleteButton.textContent =
        "🗑️";


    deleteButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            deletePlatform(
                platform.id
            );
        }
    );


    /* Priority */

    const pinButton =
        document.createElement("button");

    pinButton.type =
        "button";

    pinButton.className =
        "tree-action";

    pinButton.title =
        "Set as Priority";

    pinButton.textContent =
        "📌";


    pinButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            setPriority(
                platform.id
            );
        }
    );


    /* Add Drama */

    const addDramaButton =
        document.createElement("button");

    addDramaButton.type =
        "button";

    addDramaButton.className =
        "tree-action";

    addDramaButton.title =
        "Add Drama";

    addDramaButton.textContent =
        "+";


    addDramaButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            toggleDramaForm(
                platform.id,
                details
            );
        }
    );


    actions.appendChild(
        renameButton
    );

    actions.appendChild(
        deleteButton
    );

    actions.appendChild(
        pinButton
    );

    actions.appendChild(
        addDramaButton
    );


    summary.appendChild(
        actions
    );


    details.appendChild(
        summary
    );


    /* =====================================================
       DRAMAS
       ===================================================== */

    const dramaList =
        document.createElement("div");

    dramaList.className =
        "drama-list";


    const platformMatches =
        query &&
        platform.name
            .toLowerCase()
            .includes(
                query.toLowerCase()
            );


    let dramasToShow;


    if (!query || platformMatches) {

        dramasToShow =
            platform.dramas;

    } else {

        dramasToShow =
            matchingDramas;
    }


    dramasToShow.forEach(
        drama => {

            dramaList.appendChild(
                createDramaElement(
                    platform,
                    drama,
                    query
                )
            );
        }
    );


    details.appendChild(
        dramaList
    );


    return details;
}


/* =========================================================
   CREATE DRAMA ELEMENT
   ========================================================= */

function createDramaElement(
    platform,
    drama,
    query
) {

    const details =
        document.createElement("details");

    details.className =
        "drama-details";


    if (query) {

        details.open =
            true;
    }


    /* =====================================================
       DRAMA SUMMARY
       ===================================================== */

    const summary =
        document.createElement("summary");


    summary.innerHTML = `
        <span class="drama-chevron">▶</span>

        <span class="drama-icon">
            📑
        </span>

        <span class="drama-title">
            ${escapeHtml(drama.name)}
        </span>

        <span class="drama-actions"></span>
    `;


    /* Drama actions */

    const dramaActions =
        summary.querySelector(
            ".drama-actions"
        );


    /* Rename Drama */

    const renameButton =
        document.createElement("button");

    renameButton.type =
        "button";

    renameButton.className =
        "tree-action";

    renameButton.title =
        "Rename Drama";

    renameButton.textContent =
        "✏️";


    renameButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            renameDrama(
                platform.id,
                drama.id
            );
        }
    );


    /* Delete Drama */

    const deleteButton =
        document.createElement("button");

    deleteButton.type =
        "button";

    deleteButton.className =
        "tree-action delete-action";

    deleteButton.title =
        "Delete Drama";

    deleteButton.textContent =
        "🗑️";


    deleteButton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            event.stopPropagation();

            deleteDrama(
                platform.id,
                drama.id
            );
        }
    );


    dramaActions.appendChild(
        renameButton
    );

    dramaActions.appendChild(
        deleteButton
    );


    details.appendChild(
        summary
    );


    /* =====================================================
       DRAMA STATS
       ===================================================== */

    const stats =
        document.createElement("div");

    stats.className =
        "drama-stats";


    /* URL */

    const urlLink =
        document.createElement("a");

    urlLink.className =
        "drama-url";

    urlLink.href =
        drama.url;

    urlLink.target =
        "_blank";

    urlLink.rel =
        "noopener noreferrer";

    urlLink.textContent =
        "🔗 Open Drama";


    stats.appendChild(
        urlLink
    );


    /* =====================================================
       WATCHED
       ===================================================== */

    const watchedRow =
        document.createElement("div");

    watchedRow.className =
        "drama-control-row";


    const watchedLabel =
        document.createElement("label");


    const watchedCheckbox =
        document.createElement("input");

    watchedCheckbox.type =
        "checkbox";

    watchedCheckbox.checked =
        Boolean(drama.watched);


    const watchedText =
        document.createElement("span");

    watchedText.textContent =
        "Watched";


    watchedLabel.appendChild(
        watchedCheckbox
    );

    watchedLabel.appendChild(
        watchedText
    );


    watchedCheckbox.addEventListener(
        "change",
        function () {

            drama.watched =
                watchedCheckbox.checked;

            saveLibrary();
        }
    );


    watchedRow.appendChild(
        watchedLabel
    );


    stats.appendChild(
        watchedRow
    );


    /* =====================================================
       RATING
       ===================================================== */

    const ratingRow =
        document.createElement("div");

    ratingRow.className =
        "drama-control-row";


    const ratingLabel =
        document.createElement("span");

    ratingLabel.textContent =
        "Rating";


    const ratingSelect =
        document.createElement("select");

    ratingSelect.className =
        "rating-select";


    const ratings = [
        ["0", "Not rated"],
        ["1", "★☆☆☆☆"],
        ["2", "★★☆☆☆"],
        ["3", "★★★☆☆"],
        ["4", "★★★★☆"],
        ["5", "★★★★★"]
    ];


    ratings.forEach(
        function ([value, label]) {

            const option =
                document.createElement("option");


            option.value =
                value;

            option.textContent =
                label;


            if (
                Number(drama.rating) ===
                Number(value)
            ) {

                option.selected =
                    true;
            }


            ratingSelect.appendChild(
                option
            );
        }
    );


    ratingSelect.addEventListener(
        "change",
        function () {

            drama.rating =
                Number(
                    ratingSelect.value
                );

            saveLibrary();
        }
    );


    ratingRow.appendChild(
        ratingLabel
    );

    ratingRow.appendChild(
        ratingSelect
    );


    stats.appendChild(
        ratingRow
    );


    /* =====================================================
       ADDED DATE
       ===================================================== */

    const addedTime =
        document.createElement("div");

    addedTime.className =
        "added-time";


    addedTime.textContent =
        `Added: ${formatDate(
            drama.addedAt
        )}`;


    stats.appendChild(
        addedTime
    );


    details.appendChild(
        stats
    );


    return details;
}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formatDate(isoDate) {

    const date =
        new Date(isoDate);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Unknown date";
    }


    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "medium"
        }
    ).format(date);
}


/* =========================================================
   SEARCH FILTER
   ========================================================= */

function filterLibrary(query) {

    if (!query) {

        return library.platforms.map(
            platform => ({

                platform: platform,

                matchingDramas:
                    platform.dramas,

                platformMatches: true
            })
        );
    }


    const search =
        query.toLowerCase();


    return library.platforms

        .map(
            platform => {

                const platformMatches =
                    platform.name
                        .toLowerCase()
                        .includes(search);


                const matchingDramas =
                    platform.dramas.filter(
                        drama =>
                            drama.name
                                .toLowerCase()
                                .includes(search)
                    );


                return {

                    platform: platform,

                    matchingDramas:
                        matchingDramas,

                    platformMatches:
                        platformMatches
                };
            }
        )

        .filter(
            result =>
                result.platformMatches ||
                result.matchingDramas.length > 0
        );
}


/* =========================================================
   RENDER TREE
   ========================================================= */

function renderTree(query = "") {

    treeContainer.innerHTML = "";


    const results =
        filterLibrary(query);


    /* Empty library */

    if (
        library.platforms.length === 0
    ) {

        emptyState.classList.remove(
            "hidden"
        );

        searchStatus.classList.add(
            "hidden"
        );

        return;
    }


    emptyState.classList.add(
        "hidden"
    );


    /* Search status */

    if (query) {

        searchStatus.classList.remove(
            "hidden"
        );


        const dramaMatches =
            results.reduce(
                (total, result) =>
                    total +
                    result.matchingDramas.length,
                0
            );


        searchStatus.textContent =
            `${results.length} platform` +
            `${results.length === 1 ? "" : "s"} · ` +
            `${dramaMatches} matching drama` +
            `${dramaMatches === 1 ? "" : "s"}`;

    } else {

        searchStatus.classList.add(
            "hidden"
        );
    }


    /* No results */

    if (
        results.length === 0
    ) {

        treeContainer.innerHTML = `
            <div class="no-results">

                <div class="no-results-icon">
                    🔎
                </div>

                <h3>
                    No matches found
                </h3>

                <p>
                    Try another platform or drama name.
                </p>

            </div>
        `;

        return;
    }


    /* Priority first */

    const sortedResults =
        [...results].sort(
            (a, b) => {

                const aPriority =
                    a.platform.id ===
                    library.priorityPlatformId;

                const bPriority =
                    b.platform.id ===
                    library.priorityPlatformId;


                if (aPriority && !bPriority) {
                    return -1;
                }


                if (!aPriority && bPriority) {
                    return 1;
                }


                return 0;
            }
        );


    sortedResults.forEach(
        result => {

            treeContainer.appendChild(
                createPlatformElement(
                    result.platform,
                    result.matchingDramas,
                    query
                )
            );
        }
    );
}


/* =========================================================
   DASHBOARD STATISTICS
   ========================================================= */

function getLibraryStatistics() {

    const platforms =
        library.platforms.length;


    const dramas =
        library.platforms.reduce(
            (total, platform) =>
                total +
                platform.dramas.length,
            0
        );


    const watched =
        library.platforms.reduce(
            (total, platform) =>
                total +
                platform.dramas.filter(
                    drama =>
                        Boolean(drama.watched)
                ).length,
            0
        );


    const ratedDramas =
        library.platforms
            .flatMap(
                platform =>
                    platform.dramas
            )
            .filter(
                drama =>
                    Number(drama.rating) > 0
            );


    let averageRating =
        "—";


    if (
        ratedDramas.length > 0
    ) {

        const totalRating =
            ratedDramas.reduce(
                (total, drama) =>
                    total +
                    Number(drama.rating),
                0
            );


        averageRating =
            (
                totalRating /
                ratedDramas.length
            ).toFixed(1);
    }


    const priority =
        library.platforms.find(
            platform =>
                platform.id ===
                library.priorityPlatformId
        );


    return {

        platforms,

        dramas,

        watched,

        averageRating,

        priority
    };
}


/* =========================================================
   UPDATE DASHBOARD
   ========================================================= */

function updateLibraryDashboard() {

    if (
        !libraryQuickStats
    ) {
        return;
    }


    const stats =
        getLibraryStatistics();


    /* Quick stats */

    libraryQuickStats.textContent =
        `${stats.platforms} Platform` +
        `${stats.platforms === 1 ? "" : "s"} · ` +
        `${stats.dramas} Drama` +
        `${stats.dramas === 1 ? "" : "s"}`;


    /* Statistics */

    statPlatforms.textContent =
        stats.platforms;


    statDramas.textContent =
        stats.dramas;


    statWatched.textContent =
        stats.watched;


    statRating.textContent =
        stats.averageRating;


    /* Priority */

    if (stats.priority) {

        statPriority.textContent =
            `⭐ ${stats.priority.name}`;

    } else {

        statPriority.textContent =
            "None";
    }


    /* Subscription */

    if (
        stats.priority &&
        stats.priority.subscriptionExpiresAt
    ) {

        const expiry =
            new Date(
                stats.priority.subscriptionExpiresAt
            );


        const difference =
            expiry.getTime() -
            Date.now();


        if (difference <= 0) {

            statSubscription.textContent =
                "⚠️ Expired";

        } else {

            const days =
                Math.ceil(
                    difference /
                    (1000 * 60 * 60 * 24)
                );


            statSubscription.textContent =
                `⏳ ${days} day` +
                `${days === 1 ? "" : "s"} left`;
        }

    } else {

        statSubscription.textContent =
            "None";
    }
}


/* =========================================================
   OPEN DASHBOARD
   ========================================================= */

function openStatistics() {

    updateLibraryDashboard();


    statsOverlay.classList.add(
        "active"
    );


    statsOverlay.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   CLOSE DASHBOARD
   ========================================================= */

function closeStatistics() {

    statsOverlay.classList.remove(
        "active"
    );


    statsOverlay.setAttribute(
        "aria-hidden",
        "true"
    );
}


/* =========================================================
   DASHBOARD EVENTS
   ========================================================= */

libraryDashboard.addEventListener(
    "click",
    openStatistics
);


closeStatsButton.addEventListener(
    "click",
    closeStatistics
);


statsOverlay.addEventListener(
    "click",
    function (event) {

        if (
            event.target ===
            statsOverlay
        ) {

            closeStatistics();
        }
    }
);


/* =========================================================
   SEARCH EVENTS
   ========================================================= */

searchInput.addEventListener(
    "input",
    function () {

        const query =
            searchInput.value.trim();


        if (query) {

            openSidebar();
        }


        renderTree(query);
    }
);


findButton.addEventListener(
    "click",
    function () {

        openSidebar();

        searchInput.focus();

        renderTree(
            searchInput.value.trim()
        );
    }
);


/* =========================================================
   ESC KEY
   ========================================================= */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            if (
                statsOverlay.classList.contains(
                    "active"
                )
            ) {

                closeStatistics();

                return;
            }


            if (
                sidebar.classList.contains(
                    "active"
                )
            ) {

                closeSidebar();
            }
        }
    }
);


/* =========================================================
   REFRESH SUBSCRIPTION EVERY MINUTE
   ========================================================= */

setInterval(
    function () {

        if (
            library.priorityPlatformId
        ) {

            renderTree(
                searchInput.value.trim()
            );

            updateLibraryDashboard();
        }

    },
    60 * 1000
);


/* =========================================================
   INITIALIZE
   ========================================================= */

renderTree();

updateLibraryDashboard();


/* =========================================================
   SERVICE WORKER
   ========================================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        function () {

            navigator.serviceWorker
                .register("./sw.js")

                .then(
                    registration => {

                        console.log(
                            "Service Worker registered:",
                            registration.scope
                        );
                    }
                )

                .catch(
                    error => {

                        console.error(
                            "Service Worker registration failed:",
                            error
                        );
                    }
                );
        }
    );
}