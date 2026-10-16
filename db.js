const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.db');

// Initialise le fichier JSON s'il n'existe pas
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Lit toutes les données du fichier JSON
function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Écrit les données dans le fichier JSON
function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const db = {
  // Récupérer toutes les demandes (avec filtre optionnel par statut)
  getAll(statut = null) {
    const demandes = readDb();
    let filtered = demandes;
    if (statut) {
      filtered = demandes.filter(d => d.statut === statut);
    }
    // Tri par date décroissante (plus récent en premier)
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  // Récupérer une demande par son ID
  getById(id) {
    const demandes = readDb();
    return demandes.find(d => d.id === id) || null;
  },

  // Créer une nouvelle demande
  create(pseudo_support, message) {
    const demandes = readDb();
    const newId = demandes.length > 0 ? Math.max(...demandes.map(d => d.id)) + 1 : 1;
    
    const newDemande = {
      id: newId,
      pseudo_support,
      message,
      created_at: new Date().toISOString(),
      statut: 'en_attente',
      claimed_at: null,
      claimed_by: null
    };

    demandes.push(newDemande);
    writeDb(demandes);
    return newDemande;
  },

  // Mettre à jour une demande existante
  update(id, fields) {
    const demandes = readDb();
    const index = demandes.findIndex(d => d.id === id);
    if (index === -1) return null;

    demandes[index] = { ...demandes[index], ...fields };
    writeDb(demandes);
    return demandes[index];
  }
};

module.exports = db;