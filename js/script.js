"use strict";

const keys = {
    lists: "lista-karaoke:lists:v1",
    theme: "lista-karaoke:theme",
    install: "lista-karaoke:install-tip",
    senderName: "lista-karaoke:sender-name"
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
const importButton = byId("import-list");
const sharedActions = byId("shared-actions");
const copyAppLink = byId("copy-app-link");
const importTip = byId("import-tip");
const transferLink = byId("transfer-link");
const importDialog = byId("import-dialog");
const importLink = byId("import-link");
const listActions = byId("list-actions");
const toggleListButton = byId("toggle-list");
const shareDialog = byId("share-dialog");
const shareName = byId("share-name");
const shareInvite = byId("share-invite");
const sendInviteButton = byId("send-invite");
const copyInviteButton = byId("copy-invite");
const shareFeedback = byId("share-feedback");
const themeButton = byId("theme-button");
const splash = byId("splash");
const installDialog = byId("install-dialog");
const installHelp = byId("install-help");
const recordButton = byId("record-play");
const recordAudio = byId("record-audio");
const status = byId("status");
const sharedRoute = "#compartilhada/";
const maxSharedPayloadLength = 64000;

let state = readLists();
let activeId = null;
let sharedList = null;
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
    if (sharedList) return sharedList;
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
    const sharing = hash.startsWith(sharedRoute);
    const match = hash.match(/^#lista\/([1-9][0-9]*)$/);
    activeId = match ? Number(match[1]) : null;
    sharedList = sharing ? readSharedList(hash) : null;
    priorityFilter = "all";
    resetForm();
    sharedActions.hidden = !sharedList;
    copyAppLink.hidden = !sharedList || !isAppleMobile() || isStandalone();
    importTip.hidden = true;
    transferLink.hidden = true;

    if (sharing) {
        if (!sharedList) {
            show(home, "home-title", focusHeading);
            announce("Este link de karaokê está inválido ou incompleto.");
            return;
        }
        byId("editor-title").textContent = `Lista ${sharedList.id}`;
        const invitation = sharedList.sender ? invitationText(sharedList.sender) : "Lista compartilhada";
        byId("editor-description").textContent = sharedList.finished ? `${invitation} · ✓ Concluída` : invitation;
        const back = byId("editor-back");
        back.href = "#";
        back.textContent = "← Voltar ao início";
        finishButton.hidden = true;
        listActions.hidden = true;
        filters.hidden = false;
        renderImportButton();
        renderSongs();
        show(editor, "editor-title", focusHeading);
        return;
    }

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
    const draft = activeId === null && !sharedList;
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
        item.append(number, details);
        if (sharedList) {
            item.classList.add("song-readonly");
            if (song.sung) {
                const sung = document.createElement("span");
                sung.className = "song-sung-label";
                sung.textContent = "✓ Cantada";
                item.append(sung);
            }
            items.append(item);
            continue;
        }

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
        item.append(actions);
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
    form.hidden = activeId !== null || sharedList !== null;
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
    if (sharedList) return;
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
        id: editingSong ?? newSongId(),
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

function newSongId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function saveDraftList() {
    if (activeId !== null || sharedList) return;
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

function findImportedList() {
    return state.completed.find((list) => list.sharedSource === sharedList.source);
}

function renderImportButton() {
    importButton.textContent = findImportedList() ? "Abrir minha cópia" : "Adicionar às minhas listas";
}

function importSharedList() {
    if (!sharedList) return;
    state = readLists();
    const existing = findImportedList();
    if (existing) {
        location.hash = `lista/${existing.id}`;
        return;
    }
    const id = nextListNumber();
    const list = {
        id,
        finished: sharedList.finished,
        songs: sharedList.songs.map((song) => ({ ...song, id: newSongId() })),
        sharedSource: sharedList.source
    };
    if (!saveLists({ ...state, completed: [...state.completed, list], nextListId: id + 1 })) return;
    location.hash = `lista/${id}`;
    announce("Lista adicionada às suas listas.");
}

function openImportDialog() {
    importLink.value = "";
    importLink.setCustomValidity("");
    importDialog.showModal();
}

function openImportedLink(event) {
    if (event.submitter?.formMethod === "dialog") return;
    event.preventDefault();
    const hash = importLink.value.match(/https?:\/\/[^\s<>"]+(#compartilhada\/[A-Za-z0-9_/-]+)/)?.[1];
    if (!hash || !readSharedList(hash)) {
        importLink.setCustomValidity("Cole um link válido de uma lista do Lista Karaokê.");
        importLink.reportValidity();
        return;
    }
    importDialog.close();
    location.hash = hash;
}

async function copyLinkForApp() {
    const url = location.href;
    importTip.hidden = false;
    try {
        await navigator.clipboard.writeText(url);
        announce("Link copiado. Agora abra o app pela tela de início.");
    } catch {
        if (location.href !== url) return;
        transferLink.value = url;
        transferLink.hidden = false;
        transferLink.focus();
        transferLink.select();
    }
}

function invitationText(sender) {
    return `${sender} compartilhou esta lista com você. Confira e vamos cantar! 🎤`;
}

function createSharedUrl(list, sender) {
    const songs = list.songs.map(({ name, artist, priority, sung }) => [name, artist, priority, Boolean(sung)]);
    const bytes = new TextEncoder().encode(JSON.stringify([list.id, Boolean(list.finished), songs, sender]));
    const payload = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
        .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    if (payload.length > maxSharedPayloadLength) return null;
    const url = new URL(location.href);
    url.hash = `${sharedRoute}v2/${payload}`;
    return url.href;
}

function readSharedList(hash) {
    if (hash.length > sharedRoute.length + 3 + maxSharedPayloadLength) return null;
    const match = hash.slice(sharedRoute.length).match(/^(v1|v2)\/([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    const [, version, payload] = match;
    try {
        const bytes = Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
            (character) => character.charCodeAt(0));
        const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        if (!Array.isArray(data) || data.length !== (version === "v2" ? 4 : 3)) return null;
        const [id, finished, entries, sender = ""] = data;
        if (!Number.isSafeInteger(id) || id < 1 || typeof finished !== "boolean" || !Array.isArray(entries)) return null;
        if (version === "v2" && (typeof sender !== "string" || !sender.trim() || sender.length > shareName.maxLength)) return null;
        const songs = [];
        for (const entry of entries) {
            if (!Array.isArray(entry) || entry.length !== 4) return null;
            const [name, artist, priority, sung] = entry;
            if (typeof name !== "string" || !name.trim() || name.length > nameField.maxLength
                || typeof artist !== "string" || !artist.trim() || artist.length > artistField.maxLength
                || typeof priority !== "string" || !Object.hasOwn(priorities, priority) || typeof sung !== "boolean") return null;
            songs.push({ name, artist, priority, sung });
        }
        return { id, finished, songs, sender, source: hash };
    } catch {
        return null;
    }
}

function openShareDialog() {
    if (activeId === null) return;
    if (!/^https?:$/.test(location.protocol)) {
        announce("Abra o app pelo endereço publicado para compartilhar um link.");
        return;
    }
    shareName.value = readPreference(keys.senderName) ?? "";
    sendInviteButton.hidden = typeof navigator.share !== "function";
    shareFeedback.hidden = true;
    hideInvitePreview();
    shareDialog.showModal();
}

function hideInvitePreview() {
    shareInvite.hidden = true;
    byId("share-invite-label").hidden = true;
}

async function shareSavedList(event) {
    if (event.submitter?.formMethod === "dialog") return;
    event.preventDefault();
    if (activeId === null) return;
    const sender = shareName.value.trim();
    if (!sender) {
        shareName.setCustomValidity("Digite o nome que deve aparecer no convite.");
        shareName.reportValidity();
        return;
    }
    const list = readLists().completed.find((item) => item.id === activeId);
    if (!list) {
        location.hash = "listas";
        return;
    }
    const url = createSharedUrl(list, sender);
    if (!url) {
        shareFeedback.textContent = "Esta lista é grande demais para compartilhar em um link.";
        shareFeedback.hidden = false;
        return;
    }
    writePreference(keys.senderName, sender);
    const text = invitationText(sender);
    const invite = `${text}\n${url}`;
    if (event.submitter !== copyInviteButton && typeof navigator.share === "function") {
        try {
            await navigator.share({ text, url });
            if (shareDialog.open) shareDialog.close();
            return;
        } catch (error) {
            if (error.name === "AbortError") return;
        }
    }
    await copySharedInvite(invite);
}

async function copySharedInvite(invite) {
    try {
        await navigator.clipboard.writeText(invite);
        if (shareDialog.open) shareDialog.close();
        announce("Convite com link copiado.");
    } catch {
        if (!shareDialog.open) return;
        shareInvite.value = invite;
        shareInvite.hidden = false;
        byId("share-invite-label").hidden = false;
        shareFeedback.textContent = "Copie o convite selecionado pelo menu do navegador ou com Ctrl+C (⌘C no Mac).";
        shareFeedback.hidden = false;
        shareInvite.focus();
        shareInvite.select();
    }
}

function isAppleMobile() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
    return navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
}

function setupInstallHelp() {
    const ios = isAppleMobile();
    const android = /Android/i.test(navigator.userAgent);
    if ((!ios && !android) || isStandalone()) return;

    byId("install-copy").textContent = ios
        ? "No Safari, toque em Compartilhar e em Adicionar à Tela de Início. Ative Abrir como App da Web se a opção aparecer e toque em Adicionar."
        : "No menu do navegador, toque em Adicionar à tela inicial ou Instalar app e confirme.";
    installHelp.hidden = false;
    installHelp.addEventListener("click", () => installDialog.showModal());
    if (!sharedList && !readPreference(keys.install)) {
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
importButton.addEventListener("click", importSharedList);
copyAppLink.addEventListener("click", copyLinkForApp);
byId("open-import").addEventListener("click", openImportDialog);
byId("import-form").addEventListener("submit", openImportedLink);
importLink.addEventListener("input", () => importLink.setCustomValidity(""));
toggleListButton.addEventListener("click", toggleSavedList);
byId("delete-list").addEventListener("click", deleteSavedList);
byId("share-list").addEventListener("click", openShareDialog);
byId("share-form").addEventListener("submit", shareSavedList);
shareName.addEventListener("input", () => {
    shareName.setCustomValidity("");
    shareFeedback.hidden = true;
    hideInvitePreview();
});
window.addEventListener("hashchange", () => {
    if (shareDialog.open) shareDialog.close();
    if (importDialog.open) importDialog.close();
    route();
});
window.addEventListener("storage", (event) => {
    if (event.key === keys.theme) setTheme(event.newValue);
    if (event.key !== keys.lists) return;
    state = readLists();
    if (sharedList) {
        renderImportButton();
        return;
    }
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
