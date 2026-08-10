document.addEventListener('DOMContentLoaded', () => {
    const driveModal = document.getElementById('driveModal');
    const openDriveModalBtn = document.getElementById('openDriveModalBtn');
    const closeDriveBtn = document.getElementById('closeDriveBtn');
    const driveForm = document.getElementById('driveForm');
    const blockCreateNew = document.getElementById('blockCreateNew');
    const blockLinkExisting = document.getElementById('blockLinkExisting');
    const existingChannelSelect = document.getElementById('existingChannelSelect');
    const drivesList = document.getElementById('drivesList');

    window.currentDriveId = 1;

    if (openDriveModalBtn) {
        openDriveModalBtn.addEventListener('click', () => {
            driveModal.style.display = 'flex';
            loadTgChannels();
        });
    }

    if (closeDriveBtn) {
        closeDriveBtn.addEventListener('click', () => {
            driveModal.style.display = 'none';
        });
    }

    document.querySelectorAll('input[name="driveAction"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'create_new') {
                blockCreateNew.style.display = 'block';
                blockLinkExisting.style.display = 'none';
            } else {
                blockCreateNew.style.display = 'none';
                blockLinkExisting.style.display = 'block';
            }
        });
    });

    async function loadTgChannels() {
        try {
            const res = await fetch('/api/tg/channels');
            const channels = await res.json();
            existingChannelSelect.innerHTML = '';
            channels.forEach(ch => {
                const opt = document.createElement('option');
                opt.value = ch.id;
                opt.text = ch.title;
                existingChannelSelect.appendChild(opt);
            });
        } catch (err) {
            console.error("Ошибка загрузки каналов", err);
            existingChannelSelect.innerHTML = '<option>Ошибка загрузки</option>';
        }
    }

    async function loadDrives() {
        try {
            const res = await fetch('/api/drives');
            const drives = await res.json();
            drivesList.innerHTML = '';
            drives.forEach(drive => {
                const a = document.createElement('a');
                a.href = '#';
                a.className = `nav-link ${drive.id === window.currentDriveId ? 'active' : ''}`;
                a.innerHTML = `<span class="nav-icon">💽</span><span class="nav-text">${drive.letter}: ${drive.label}</span>`;
                a.onclick = (e) => {
                    e.preventDefault();
                    window.currentDriveId = drive.id;
                    loadDrives();
                    
                    if (typeof window.loadFiles === 'function') {
                        window.loadFiles(); 
                    }
                };
                drivesList.appendChild(a);
            });
        } catch (err) {
            console.error("Ошибка загрузки дисков", err);
        }
    }

    if (driveForm) {
        driveForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('letter', document.getElementById('driveLetterInput').value.toUpperCase());
            formData.append('label', document.getElementById('driveLabelInput').value);
            
            const action = document.querySelector('input[name="driveAction"]:checked').value;
            formData.append('action', action);
            
            if (action === 'create_new') {
                formData.append('title', document.getElementById('newChannelTitle').value);
            } else {
                formData.append('tg_chat_id', existingChannelSelect.value);
            }

            const btn = driveForm.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = 'СОХРАНЕНИЕ...';
            
            try {
                await fetch('/api/drives', { method: 'POST', body: formData });
                driveModal.style.display = 'none';
                driveForm.reset();
                loadDrives();
            } catch (err) {
                alert('Ошибка при сохранении диска');
            } finally {
                btn.innerText = originalText;
            }
        });
    }

    loadDrives();
});
