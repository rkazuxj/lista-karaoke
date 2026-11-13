"use strict";

const keys = {
    lists: "lista-karaoke:lists:v1",
    theme: "lista-karaoke:theme",
    install: "lista-karaoke:install-tip"
};
const priorities = {
    "1": "TENHO que cantar🤩",
    "2": "Quero MUITO cantar🎤",
    "3": "Se der tempo eu canto👍"
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
const listActions = byId("list-actions");
const toggleListButton = byId("toggle-list");
const themeButton = byId("theme-button");
const splash = byId("splash");
const installDialog = byId("install-dialog");
const installHelp = byId("install-help");
const recordButton = byId("record-play");
const recordAudio = byId("record-audio");
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
    return state.completed.reduce((next, list) => Math.max(next, list.id + 1), state.nextListId ?? 1);
}

function currentList() {
    if (activeId === null) return state.draft;
    return state.completed.find((list) => list.id === activeId);
}

function renderListStatus(list) {
    byId("editor-description").textContent = list.finished ? "✓ Lista concluída" : "Marque as músicas que você já cantou.";
    toggleListButton.textContent = list.finished ? "Reabrir lista" : "Concluir lista";
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
        if (draft) byId("editor-description").textContent = "Adicione músicas ao seu repertório.";
        else renderListStatus(currentList());
        const back = byId("editor-back");
        back.href = draft ? "#" : "#listas";
        back.textContent = draft ? "← Voltar ao início" : "← Minhas listas";
        finishButton.hidden = !draft;
        listActions.hidden = draft;
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
        target.append(emptyMessage("Suas listas salvas vão aparecer aqui."));
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
        if (list.finished) {
            const done = document.createElement("p");
            done.className = "list-done";
            done.textContent = "✓ Concluída";
            description.append(done);
        }
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        card.append(description, arrow);
        target.append(card);
    }
}

function renderSongs() {
    const list = currentList();
    const draft = activeId === null;
    const target = byId("songs");
    target.replaceChildren();
    const shown = list.songs
        .filter((song) => priorityFilter === "all" || song.priority === priorityFilter)
        .sort((first, second) => Number(first.priority) - Number(second.priority));

    byId("song-count").textContent = priorityFilter === "all"
        ? songCount(list.songs.length)
        : `${shown.length} de ${songCount(list.songs.length)}`;
    finishButton.disabled = list.songs.length === 0;
    for (const button of filters.querySelectorAll("button")) {
        button.setAttribute("aria-pressed", String(button.dataset.priority === priorityFilter));
    }

    if (shown.length === 0) {
        const message = draft ? "As músicas adicionadas aparecem aqui." : "Esta lista está sem músicas.";
        target.append(emptyMessage(priorityFilter === "all" ? message : "Nenhuma música nessa categoria."));
        return;
    }

    const items = document.createElement("ul");
    items.className = "song-list";
    for (const song of shown) {
        const item = document.createElement("li");
        item.className = song.sung ? "song-row song-sung" : "song-row";
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

        const actions = document.createElement("div");
        actions.className = "song-actions";
        const edit = songAction("Editar", `Editar ${song.name}`, () => openSong(song));
        edit.dataset.editSong = song.id;
        actions.append(edit);
        if (!draft) {
            const toggle = songAction(song.sung ? "✓ Cantada" : "Marcar como cantada",
                `Marcar como cantada: ${song.name}`, () => updateSavedSong(song.id, "toggle"));
            toggle.dataset.toggleSong = song.id;
            toggle.setAttribute("aria-pressed", String(Boolean(song.sung)));
            const remove = songAction("Excluir", `Excluir ${song.name}`, () => {
                if (window.confirm(`Excluir “${song.name}” desta lista?`)) updateSavedSong(song.id, "remove");
            });
            remove.classList.add("button-delete");
            actions.prepend(toggle);
            actions.append(remove);
        }
        item.append(number, details, actions);
        items.append(item);
    }
    target.append(items);
}

function songAction(text, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-outline";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
}

function focusSongAction(action, id) {
    const button = [...byId("songs").querySelectorAll("button")]
        .find((candidate) => candidate.dataset[action] === id);
    (button ?? byId("song-panel-title")).focus();
}

function openSong(song) {
    editingSong = song.id;
    form.hidden = false;
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
    form.hidden = activeId !== null;
    byId("form-title").textContent = "Adicionar música";
    byId("submit-song").textContent = "Adicionar música";
    byId("cancel-edit").hidden = true;
}

function saveSongs(songs) {
    const next = activeId === null
        ? { ...state, draft: { ...state.draft, songs } }
        : { ...state, completed: state.completed.map((list) => list.id === activeId ? { ...list, songs } : list) };
    return saveLists(next);
}

function updateSavedSong(id, action) {
    if (activeId === null) return;
    state = readLists();
    const list = currentList();
    const song = list?.songs.find((item) => item.id === id);
    if (!song) {
        route();
        announce("A música já saiu desta lista.");
        return;
    }

    const remove = action === "remove";
    const songs = remove
        ? list.songs.filter((item) => item.id !== id)
        : list.songs.map((item) => item.id === id ? { ...item, sung: !song.sung } : item);
    if (!saveSongs(songs)) return;
    if (remove && editingSong === id) resetForm();
    renderSongs();
    focusSongAction("toggleSong", id);
    announce(remove ? "Música excluída." : song.sung ? "Música marcada como pendente." : "Música marcada como cantada.");
}

function saveSong(event) {
    event.preventDefault();
    const editing = editingSong !== null;
    if (activeId !== null && !editing) return;
    for (const field of [nameField, artistField]) {
        if (!field.value.trim()) {
            field.setCustomValidity("Preencha este campo.");
            field.reportValidity();
            return;
        }
    }
    if (!Object.hasOwn(priorities, priorityField.value)) return;
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
        ? list.songs.map((existing) => existing.id === editingSong ? { ...existing, ...song } : existing)
        : [...list.songs, song];

    if (!saveSongs(songs)) return;
    if (priorityFilter !== "all" && priorityFilter !== song.priority) priorityFilter = "all";
    resetForm();
    renderSongs();
    if (activeId === null) nameField.focus();
    else focusSongAction("editSong", song.id);
    announce(editing ? "Música atualizada." : "Música adicionada.");
}

function saveDraftList() {
    if (activeId !== null) return;
    if (editingSong !== null || nameField.value.trim() || artistField.value.trim() || priorityField.value) {
        announce("Salve a música do formulário antes de salvar a lista.");
        byId("submit-song").focus();
        return;
    }
    state = readLists();
    if (state.draft.songs.length === 0) {
        renderSongs();
        return;
    }
    const list = { id: nextListNumber(), songs: state.draft.songs };
    if (!saveLists({ ...state, completed: [...state.completed, list], draft: { songs: [] }, nextListId: list.id + 1 })) return;
    location.hash = "listas";
    announce(`Lista ${list.id} salva.`);
}

function toggleSavedList() {
    if (activeId === null) return;
    state = readLists();
    const list = currentList();
    if (!list) {
        location.hash = "listas";
        return;
    }

    const updated = { ...list, finished: !list.finished };
    const completed = state.completed.map((item) => item.id === list.id ? updated : item);
    if (!saveLists({ ...state, completed })) return;
    renderListStatus(updated);
    announce(`Lista ${list.id} ${updated.finished ? "concluída" : "reaberta"}.`);
}

function deleteSavedList() {
    const id = activeId;
    if (id === null || !window.confirm(`Excluir a Lista ${id} e todas as suas músicas?`)) return;

    state = readLists();
    const completed = state.completed.filter((list) => list.id !== id);
    if (completed.length !== state.completed.length) {
        if (!saveLists({ ...state, completed, nextListId: nextListNumber() })) return;
        announce(`Lista ${id} excluída.`);
    }
    location.hash = "listas";
}

function setupInstallHelp() {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
    if ((!ios && !android) || standalone) return;

    byId("install-copy").textContent = ios
        ? "No Safari, toque em Compartilhar e em Adicionar à Tela de Início. Ative Abrir como App da Web se a opção aparecer e toque em Adicionar."
        : "No menu do navegador, toque em Adicionar à tela inicial ou Instalar app e confirme.";
    installHelp.hidden = false;
    installHelp.addEventListener("click", () => installDialog.showModal());
    if (!readPreference(keys.install)) {
        installDialog.showModal();
        writePreference(keys.install, "seen");
    }
}

function updateRecordButton() {
    const playing = !recordAudio.paused && !recordAudio.ended;
    recordButton.setAttribute("aria-pressed", String(playing));
    recordButton.title = playing ? "Pausar música" : "Tocar música";
}

recordButton.addEventListener("click", async () => {
    if (!recordAudio.paused) {
        recordAudio.pause();
        return;
    }
    try {
        await recordAudio.play();
    } catch (error) {
        if (error.name !== "AbortError") announce("Áudio indisponível. Adicione o arquivo audio/karaoke.mp3.");
    }
});
for (const event of ["play", "pause", "ended", "error"]) {
    recordAudio.addEventListener(event, updateRecordButton);
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
    const id = editingSong;
    resetForm();
    if (activeId === null) nameField.focus();
    else focusSongAction("editSong", id);
});
filters.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    priorityFilter = button.dataset.priority;
    renderSongs();
});
finishButton.addEventListener("click", saveDraftList);
toggleListButton.addEventListener("click", toggleSavedList);
byId("delete-list").addEventListener("click", deleteSavedList);
window.addEventListener("hashchange", () => route());
window.addEventListener("storage", (event) => {
    if (event.key === keys.theme) setTheme(event.newValue);
    if (event.key !== keys.lists) return;
    state = readLists();
    if (!editor.hidden) {
        const list = currentList();
        if (!list) {
            location.hash = "listas";
            return;
        }
        if (activeId === null) byId("editor-title").textContent = `Lista ${nextListNumber()}`;
        else renderListStatus(list);
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
        setupInstallHelp();
    }, minimum === 0 ? 0 : 200);
}, Math.max(0, minimum - elapsed));

if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { });
    });
}
