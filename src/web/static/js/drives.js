document.addEventListener('DOMContentLoaded', () => {
    const driveModal = document.getElementById('driveModal');
    const openDriveModalBtn = document.getElementById('openDriveModalBtn');
    const closeDriveBtn = document.getElementById('closeDriveBtn');
    const cancelDriveBtn = document.getElementById('cancelDriveBtn');
    const driveForm = document.getElementById('driveForm');
    const blockCreateNew = document.getElementById('blockCreateNew');
    const blockLinkExisting = document.getElementById('blockLinkExisting');
    const existingChannelSelect = document.getElementById('existingChannelSelect');

    if (openDriveModalBtn) {
        openDriveModalBtn.addEventListener('click', () => {
            if (driveModal) driveModal.style.display = 'flex';
            loadTgChannels();
        });
    }

    if (closeDriveBtn) {
        closeDriveBtn.addEventListener('click', () => {
            if (driveModal) driveModal.style.display = 'none';
        });
    }

    if (cancelDriveBtn) {
        cancelDriveBtn.addEventListener('click', () => {
            if (driveModal) driveModal.style.display = 'none';
        });
    }

    document.querySelectorAll('input[name="driveAction"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'create_new') {
                if (blockCreateNew) blockCreateNew.style.display = 'block';
                if (blockLinkExisting) blockLinkExisting.style.display = 'none';
            } else {
                if (blockCreateNew) blockCreateNew.style.display = 'none';
                if (blockLinkExisting) blockLinkExisting.style.display = 'block';
            }
        });
    });

    async function loadTgChannels() {
        if (!existingChannelSelect) return;
        try {
            const res = await fetch('/api/tg/channels');
            if (res.ok) {
                const channels = await res.json();
                const savedMsgText = window.t ? window.t('driveModal.savedMessagesOption') : '💬 Избранное (Saved Messages)';
                existingChannelSelect.innerHTML = `<option value="me">${savedMsgText}</option>`;
                channels.forEach(ch => {
                    if (ch.id !== 'me') {
                        const opt = document.createElement('option');
                        opt.value = ch.id;
                        opt.text = `📢 ${ch.title}`;
                        existingChannelSelect.appendChild(opt);
                    }
                });
            }
        } catch (err) {
            console.error("Ошибка загрузки каналов", err);
        }
    }

    if (driveForm) {
        driveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('letter', (document.getElementById('driveLetterInput').value || 'D').toUpperCase());
            formData.append('label', document.getElementById('driveLabelInput').value.trim() || 'Drive');
            
            const actionRadio = document.querySelector('input[name="driveAction"]:checked');
            const action = actionRadio ? actionRadio.value : 'link_existing';
            formData.append('action', action);
            
            if (action === 'create_new') {
                const titleInput = document.getElementById('newChannelTitle');
                formData.append('title', titleInput ? titleInput.value.trim() : 'Storage');
            } else {
                formData.append('tg_chat_id', existingChannelSelect ? existingChannelSelect.value : 'me');
            }

            const btn = driveForm.querySelector('button[type="submit"]');
            const originalText = btn ? btn.innerText : '';
            if (btn) btn.innerText = '⏳ ...';
            
            try {
                const res = await fetch('/api/drives', { method: 'POST', body: formData });
                if (res.ok) {
                    if (driveModal) driveModal.style.display = 'none';
                    driveForm.reset();
                    if (typeof window.loadDrives === 'function') {
                        window.loadDrives();
                    }
                } else {
                    alert('Ошибка при создании диска');
                }
            } catch (err) {
                alert('Ошибка при сохранении диска: ' + (err.message || err));
            } finally {
                if (btn) btn.innerText = originalText;
            }
        });
    }
});
