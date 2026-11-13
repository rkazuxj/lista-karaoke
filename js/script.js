"use strict";

const keys = {
    lists: "lista-karaoke:lists:v1",
    theme: "lista-karaoke:theme",
    install: "lista-karaoke:install-tip"
};
const priorities = {
    "1": "Obrigatório cantar",
    "2": "Quero muito cantar",
    "3": "Se der tempo eu canto"
};
const byId = (id) => document.getElementById(id);
const home = byId("home");
const lists = byId("lists");
const editor = byId("editor");
const form = byId("song-form");
const nameField = byId("song-name");
const artistField = byId("song-artist");
const priorityField = byId("song-priority");
const filters = byId("filters");
const finishButton = byId("finish-list");
const themeButton = byId("theme-button");
const splash = byId("splash");
const installDialog = byId("install-dialog");
const status = byId("status");

let state = readLists();
let activeId = null;
let editingSong = null;
let priorityFilter = "all";
let statusTimeout;

function readPreference(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writePreference(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

function readLists() {
    try {
        const saved = JSON.parse(readPreference(keys.lists));
        if (Array.isArray(saved?.completed)) return saved;
    } catch {
        // A fresh state also handles an interrupted or invalid stored value.
    }
    return { completed: [], draft: { songs: [] } };
}

function saveLists(next) {
    if (!writePreference(keys.lists, JSON.stringify(next))) {
        announce("Não foi possível salvar. Verifique o armazenamento do navegador.");
        return false;
    }
    state = next;
    return true;
}

function announce(message) {
    clearTimeout(statusTimeout);
    status.textContent = message;
    statusTimeout = setTimeout(() => { status.textContent = ""; }, 3500);
}

function setTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]').content = dark ? "#15172C" : "#FEF1CF";
    themeButton.setAttribute("aria-pressed", String(dark));
    byId("theme-label").textContent = dark ? "Modo claro" : "Modo escuro";
}

function nextListNumber() {
    return state.completed.reduce((highest, list) => Math.max(highest, list.id), 0) + 1;
}

function currentList() {
    if (activeId === null) return state.draft;
    return state.completed.find((list) => list.id === activeId);
}

function show(view, title, focusHeading) {
    for (const section of [home, lists, editor]) section.hidden = section !== view;
    if (focusHeading) {
        window.scrollTo(0, 0);
        byId(title).focus({ preventScroll: true });
    }
}

function route(focusHeading = true) {
    const hash = location.hash;
    const match = hash.match(/^#lista\/([1-9][0-9]*)$/);
    activeId = match ? Number(match[1]) : null;
    priorityFilter = "all";
    resetForm();

    if (hash === "#criar" || (match && currentList())) {
        const draft = activeId === null;
        byId("editor-title").textContent = `Lista ${draft ? nextListNumber() : activeId}`;
        byId("editor-description").textContent = draft
            ? "Adicione músicas ao seu repertório."
            : "Adicione ou edite músicas e filtre por prioridade.";
        const back = byId("editor-back");
        back.href = draft ? "#" : "#listas";
        back.textContent = draft ? "← Voltar ao início" : "← Minhas listas";
        finishButton.hidden = !draft;
        filters.hidden = draft;
        renderSongs();
        show(editor, "editor-title", focusHeading);
    } else if (hash === "#listas" || match) {
        renderLists();
        show(lists, "lists-title", focusHeading);
    } else {
        show(home, "home-title", focusHeading);
    }
}

function emptyMessage(message) {
    const paragraph = document.createElement("p");
    paragraph.className = "empty";
    paragraph.textContent = message;
    return paragraph;
}

function songCount(count) {
    return count === 1 ? "1 música" : `${count} músicas`;
}

function renderLists() {
    const target = byId("saved-lists");
    target.replaceChildren();
    if (state.completed.length === 0) {
        target.append(emptyMessage("Suas listas concluídas vão aparecer aqui."));
        return;
    }

    for (const list of [...state.completed].reverse()) {
        const card = document.createElement("a");
        card.className = "panel saved-card";
        card.href = `#lista/${list.id}`;
        const description = document.createElement("div");
        const title = document.createElement("h2");
        title.textContent = `Lista ${list.id}`;
        const count = document.createElement("p");
        count.textContent = songCount(list.songs.length);
        description.append(title, count);
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        card.append(description, arrow);
        target.append(card);
    }
}

function renderSongs() {
    const list = currentList();
    const target = byId("songs");
    target.replaceChildren();
    const shown = priorityFilter === "all"
        ? list.songs
        : list.songs.filter((song) => song.priority === priorityFilter);

    byId("song-count").textContent = priorityFilter === "all"
        ? songCount(list.songs.length)
        : `${shown.length} de ${songCount(list.songs.length)}`;
    finishButton.disabled = list.songs.length === 0;
    for (const button of filters.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.priority === priorityFilter));
    }

    if (shown.length === 0) {
        target.append(emptyMessage(priorityFilter === "all"
            ? "As músicas adicionadas aparecem aqui."
            : "Nenhuma música com essa prioridade."));
        return;
    }

    const items = document.createElement("ul");
    items.className = "song-list";
    for (const song of shown) {
        const item = document.createElement("li");
        item.className = "song-row";
        const number = document.createElement("span");
        number.className = `priority-number priority-${song.priority}`;
        number.textContent = song.priority;
        number.title = priorities[song.priority];
        number.setAttribute("aria-label", `Prioridade ${song.priority}: ${priorities[song.priority]}`);

        const details = document.createElement("div");
        details.className = "song-details";
        const title = document.createElement("strong");
        title.textContent = song.name;
        const artist = document.createElement("span");
        artist.textContent = song.artist;
        details.append(title, artist);

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "button button-outline";
        edit.textContent = "Editar";
        edit.setAttribute("aria-label", `Editar ${song.name}`);
        edit.addEventListener("click", () => openSong(song));
        item.append(number, details, edit);
        items.append(item);
    }
    target.append(items);
}

function openSong(song) {
    editingSong = song.id;
    nameField.value = song.name;
    artistField.value = song.artist;
    priorityField.value = song.priority;
    byId("form-title").textContent = "Editar música";
    byId("submit-song").textContent = "Salvar alterações";
    byId("cancel-edit").hidden = false;
    nameField.focus();
}

function resetForm() {
    form.reset();
    for (const field of [nameField, artistField]) field.setCustomValidity("");
    editingSong = null;
    byId("form-title").textContent = "Adicionar música";
    byId("submit-song").textContent = "Adicionar música";
    byId("cancel-edit").hidden = true;
}

function saveSong(event) {
    event.preventDefault();
    for (const field of [nameField, artistField]) {
        if (!field.value.trim()) {
            field.setCustomValidity("Preencha este campo.");
            field.reportValidity();
            return;
        }
    }
    const editing = editingSong !== null;
    const song = {
        id: editingSong ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
        name: nameField.value.trim(),
        artist: artistField.value.trim(),
        priority: priorityField.value
    };
    state = readLists();
    const list = currentList();
    if (!list || (editing && !list.songs.some((existing) => existing.id === editingSong))) {
        route();
        announce("A lista mudou. Abra a música de novo para editar.");
        return;
    }
    const songs = editing
        ? list.songs.map((existing) => existing.id === editingSong ? song : existing)
        : [...list.songs, song];
    const next = activeId === null
        ? { ...state, draft: { songs } }
        : { ...state, completed: state.completed.map((saved) => saved.id === activeId ? { ...saved, songs } : saved) };

    if (!saveLists(next)) return;
    if (priorityFilter !== "all" && priorityFilter !== song.priority) priorityFilter = "all";
    resetForm();
    renderSongs();
    if (!editing) nameField.focus();
    announce(editing ? "Música atualizada." : "Música adicionada.");
}

function finishList() {
    if (editingSong !== null || nameField.value.trim() || artistField.value.trim() || priorityField.value) {
        announce("Salve a música do formulário antes de concluir a lista.");
        byId("submit-song").focus();
        return;
    }
    state = readLists();
    if (state.draft.songs.length === 0) {
        renderSongs();
        return;
    }
    const list = { id: nextListNumber(), songs: state.draft.songs };
    if (!saveLists({ completed: [...state.completed, list], draft: { songs: [] } })) return;
    location.hash = "listas";
    announce(`Lista ${list.id} concluída.`);
}

function showInstallTip() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
    if ((!ios && !android) || standalone || readPreference(keys.install)) return;

    byId("install-copy").textContent = ios
        ? "No Safari, toque em Compartilhar e em Adicionar à Tela de Início. Ative Abrir como App da Web se a opção aparecer e toque em Adicionar."
        : "No menu do navegador, toque em Adicionar à tela inicial ou Instalar app e confirme.";
    installDialog.showModal();
    writePreference(keys.install, "seen");
}

themeButton.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(theme);
    writePreference(keys.theme, theme);
});
for (const id of ["create-list", "new-list"]) {
    byId(id).addEventListener("click", () => { location.hash = "criar"; });
}
form.addEventListener("submit", saveSong);
for (const field of [nameField, artistField]) {
    field.addEventListener("input", () => field.setCustomValidity(""));
}
byId("cancel-edit").addEventListener("click", () => {
    resetForm();
    nameField.focus();
});
filters.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    priorityFilter = button.dataset.priority;
    renderSongs();
});
finishButton.addEventListener("click", finishList);
window.addEventListener("hashchange", () => route());
window.addEventListener("storage", (event) => {
    if (event.key === keys.theme) setTheme(event.newValue);
    if (event.key !== keys.lists) return;
    state = readLists();
    if (!editor.hidden && currentList()) {
        if (activeId === null) byId("editor-title").textContent = `Lista ${nextListNumber()}`;
        renderSongs();
    }
    if (!lists.hidden) renderLists();
});

setTheme(readPreference(keys.theme));
route(false);

const elapsed = performance.now();
const minimum = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 580;
setTimeout(() => {
    splash.classList.add("is-dismissing");
    document.documentElement.classList.remove("is-loading");
    setTimeout(() => {
        splash.remove();
        showInstallTip();
    }, minimum === 0 ? 0 : 200);
}, Math.max(0, minimum - elapsed));

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { });
    });
}
