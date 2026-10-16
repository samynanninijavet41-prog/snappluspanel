require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const SupportBot = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialisation du bot Discord
const bot = new SupportBot(io);
bot.start();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_par_defaut',
  resave: false,
  saveUninitialized: false
}));

// Protection des routes admin
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  res.redirect('/login');
}

// Authentification
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Panel admin
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'panel.html'));
});

// Création d'une demande (Validation stricte & absence de données sensibles)
app.post('/api/demande', async (req, res) => {
  const { pseudo_support, message } = req.body;

  if (!pseudo_support || typeof pseudo_support !== 'string' || pseudo_support.trim() === '') {
    return res.status(400).json({ error: 'Le pseudonyme de support est requis.' });
  }
  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Le message est requis.' });
  }

  const cleanPseudo = pseudo_support.trim().slice(0, 50);
  const cleanMessage = message.trim().slice(0, 1000);

  try {
    const newTicket = db.create(cleanPseudo, cleanMessage);

    // Diffusion temps réel Socket.io
    io.emit('new_ticket', newTicket);

    // Publication Discord
    await bot.sendTicketEmbed(newTicket);

    res.status(201).json({ success: true, id: newTicket.id });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Récupération des demandes pour le panel
app.get('/api/demandes', requireAuth, (req, res) => {
  const { statut } = req.query;
  const demandes = db.getAll(statut);
  res.json(demandes);
});

// Action Claim ou Termine depuis l'admin panel
app.post('/api/demande/:id/:action', requireAuth, (req, res) => {
  const { id, action } = req.params;
  const ticketId = parseInt(id, 10);
  const moderatorName = 'Admin Web';

  const ticket = db.getById(ticketId);
  if (!ticket) return res.status(404).json({ error: 'Demande introuvable.' });

  let updatedTicket = null;
  if (action === 'claim') {
    updatedTicket = db.update(ticketId, {
      statut: 'claim',
      claimed_at: new Date().toISOString(),
      claimed_by: moderatorName
    });
  } else if (action === 'termine') {
    updatedTicket = db.update(ticketId, { statut: 'termine' });
  } else {
    return res.status(400).json({ error: 'Action invalide.' });
  }

  io.emit('ticket_updated', updatedTicket);
  res.json({ success: true, ticket: updatedTicket });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SERVEUR] En écoute sur http://localhost:${PORT}`);
});