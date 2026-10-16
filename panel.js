<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Snap Plus Support - Panel Admin</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 1000px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2 { color: #2c3e50; }
        .disclaimer { background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 4px; font-size: 0.9em; margin-bottom: 20px; }
        .filters { margin-bottom: 20px; display: flex; gap: 10px; }
        button, select { padding: 8px 15px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; }
        button.active { background: #007bff; color: white; border-color: #007bff; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
        th { background: #f8f9fa; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
        .badge.en_attente { background: #ffc107; color: #000; }
        .badge.claim { background: #17a2b8; color: #fff; }
        .badge.termine { background: #28a745; color: #fff; }
        .login-box { max-width: 400px; margin: 100px auto; padding: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        input[type="password"] { width: 80%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; }
    </style>
</head>
<body>

    <div id="loginView" class="login-box" style="display:none;">
        <h2>Connexion Admin</h2>
        <div class="disclaimer">Projet indépendant non affilié à Snapchat.</div>
        <form id="loginForm">
            <input type="password" id="passwordInput" placeholder="Mot de passe admin" required><br>
            <button type="submit" style="background:#007bff; color:white; width:100%;">Se connecter</button>
        </form>
        <p id="loginError" style="color:red; font-size:0.9em;"></p>
    </div>

    <div id="adminView" class="container" style="display:none;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1>Snap Plus Support - Panel Admin</h1>
            <a href="/logout"><button>Déconnexion</button></a>
        </div>
        
        <div class="disclaimer">
            <strong>Avertissement :</strong> Snap Plus Support est un système de support totalement indépendant. Aucune donnée sensible n'est collectée.
        </div>

        <div class="filters">
            <button onclick="filterStatus('')" class="filter-btn active" id="btn-all">Tous</button>
            <button onclick="filterStatus('en_attente')" class="filter-btn" id="btn-en_attente">En attente</button>
            <button onclick="filterStatus('claim')" class="filter-btn" id="btn-claim">Pris en charge</button>
            <button onclick="filterStatus('termine')" class="filter-btn" id="btn-termine">Terminés</button>
        </div>

        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Pseudo Support</th>
                    <th>Message</th>
                    <th>Statut</th>
                    <th>Assigné à</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="ticketsTableBody"></tbody>
        </table>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        let currentFilter = '';

        async function checkAuth() {
            try {
                const res = await fetch('/api/demandes');
                if (res.status === 401) {
                    document.getElementById('loginView').style.display = 'block';
                } else {
                    document.getElementById('adminView').style.display = 'block';
                    loadDemandes();
                    initSocket();
                }
            } catch (e) {
                document.getElementById('loginView').style.display = 'block';
            }
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('passwordInput').value;
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
                window.location.reload();
            } else {
                document.getElementById('loginError').textContent = data.error;
            }
        });

        async function loadDemandes() {
            const url = currentFilter ? `/api/demandes?statut=${currentFilter}` : '/api/demandes';
            const res = await fetch(url);
            const demandes = await res.json();
            renderTable(demandes);
        }

        function renderTable(demandes) {
            const tbody = document.getElementById('ticketsTableBody');
            tbody.innerHTML = '';
            demandes.forEach(d => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>#${d.id}</td>
                    <td>${new Date(d.created_at).toLocaleString()}</td>
                    <td><strong>${escapeHtml(d.pseudo_support)}</strong></td>
                    <td>${escapeHtml(d.message)}</td>
                    <td><span class="badge ${d.statut}">${d.statut}</span></td>
                    <td>${d.claimed_by || '-'}</td>
                    <td>
                        ${d.statut === 'en_attente' ? `<button onclick="updateStatus(${d.id}, 'claim')">Claim</button>` : ''}
                        ${d.statut !== 'termine' ? `<button onclick="updateStatus(${d.id}, 'termine')" style="background:#28a745; color:white;">Terminer</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function updateStatus(id, action) {
            await fetch(`/api/demande/${id}/${action}`, { method: 'POST' });
        }

        function filterStatus(status) {
            currentFilter = status;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            if(status === '') document.getElementById('btn-all').classList.add('active');
            else document.getElementById(`btn-${status}`).classList.add('active');
            loadDemandes();
        }

        function initSocket() {
            const socket = io();
            socket.on('new_ticket', () => loadDemandes());
            socket.on('ticket_updated', () => loadDemandes());
        }

        function escapeHtml(text) {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
            return text.replace(/[&<>"']/g, function(m) { return map[m]; });
        }

        checkAuth();
    </script>
</body>
</html>