const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');

class SupportBot {
  constructor(io) {
    this.io = io;
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });

    this.setupListeners();
  }

  setupListeners() {
    this.client.once('ready', () => {
      console.log(`[BOT] Connecté en tant que ${this.client.user.tag}`);
    });

    // Gestion des interactions sur les boutons Discord
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isButton()) return;

      const [action, idStr] = interaction.customId.split('_');
      const id = parseInt(idStr, 10);

      if (isNaN(id)) return;

      const demande = db.getById(id);
      if (!demande) {
        return interaction.reply({ content: 'Demande introuvable.', ephemeral: true });
      }

      const moderatorName = interaction.user.tag;

      if (action === 'claim') {
        if (demande.statut !== 'en_attente') {
          return interaction.reply({ content: 'Cette demande a déjà été prise en charge ou terminée.', ephemeral: true });
        }

        db.update(id, {
          statut: 'claim',
          claimed_at: new Date().toISOString(),
          claimed_by: moderatorName
        });

        await this.updateDiscordMessage(interaction.message, id, 'claim', moderatorName);
        this.io.emit('ticket_updated', db.getById(id));
        
        return interaction.reply({ content: `Demande #${id} prise en charge par ${moderatorName}.`, ephemeral: true });
      } 
      
      if (action === 'termine') {
        db.update(id, { statut: 'termine' });

        await this.updateDiscordMessage(interaction.message, id, 'termine', demande.claimed_by || moderatorName);
        this.io.emit('ticket_updated', db.getById(id));

        return interaction.reply({ content: `Demande #${id} marquée comme terminée.`, ephemeral: true });
      }
    });
  }

  // Publication d'un embed dans le salon configuré
  async sendTicketEmbed(ticket) {
    try {
      const channelId = process.env.DISCORD_CHANNEL_ID;
      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(`Support - Demande #${ticket.id}`)
        .setColor(0xFFA500)
        .addFields(
          { name: 'Pseudonyme', value: ticket.pseudo_support, inline: true },
          { name: 'Statut', value: 'En attente', inline: true },
          { name: 'Message', value: ticket.message }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${ticket.id}`)
          .setLabel('Prendre en charge (Claim)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`termine_${ticket.id}`)
          .setLabel('Terminer')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('[BOT] Erreur lors de l\'envoi de l\'embed Discord :', error.message);
    }
  }

  // Mise à jour de l'embed Discord
  async updateDiscordMessage(message, id, statut, assignedTo) {
    try {
      const ticket = db.getById(id);
      const color = statut === 'termine' ? 0x00FF00 : 0x0000FF;
      const statusText = statut === 'termine' ? 'Terminé' : `Pris en charge par ${assignedTo}`;

      const embed = new EmbedBuilder()
        .setTitle(`Support - Demande #${ticket.id}`)
        .setColor(color)
        .addFields(
          { name: 'Pseudonyme', value: ticket.pseudo_support, inline: true },
          { name: 'Statut', value: statusText, inline: true },
          { name: 'Message', value: ticket.message }
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claim_${ticket.id}`)
          .setLabel('Pris en charge')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`termine_${ticket.id}`)
          .setLabel(statut === 'termine' ? 'Terminé' : 'Marquer comme terminé')
          .setStyle(statut === 'termine' ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(statut === 'termine')
      );

      await message.edit({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error('[BOT] Erreur lors de la mise à jour du message Discord :', error.message);
    }
  }

  start() {
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

module.exports = SupportBot;