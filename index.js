
const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AuditLogEvent
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID');
  process.exit(1);
}

const CONFIG_FILE = path.join(process.cwd(), 'pw-venom-config.json');

const EVENTS = {
  memberJoin: 'Member Join',
  memberLeave: 'Member Leave',
  memberKick: 'Member Kick',
  ban: 'Ban',
  unban: 'Unban',
  timeout: 'Timeout',
  timeoutRemoved: 'Timeout Removed',
  nicknameUpdate: 'Nickname Update',
  messageDelete: 'Message Delete',
  messageEdit: 'Message Edit',
  channelCreate: 'Channel Create',
  channelDelete: 'Channel Delete',
  channelUpdate: 'Channel Update',
  roleCreate: 'Role Create',
  roleDelete: 'Role Delete',
  roleUpdate: 'Role Update',
  voiceJoin: 'Voice Join',
  voiceLeave: 'Voice Leave',
  voiceMove: 'Voice Move',
  serverUpdate: 'Server Update'
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Config error:', error);
  }
  return {};
}

const config = loadConfig();
const panelData = new Map();

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('logpanel')
    .setDescription('Open the PW VENOM LOG settings panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('loginfo')
    .setDescription('Show configured log channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('logtest')
    .setDescription('Test a log channel')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Choose an event')
        .setRequired(true)
        .addChoices(
          ...Object.entries(EVENTS).map(([value, name]) => ({
            name,
            value
          }))
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(command => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
  }

  console.log('Commands registered.');
}

async function sendLog(guild, event, title, description, color = 0x168CFF) {
  const channelId = config[guild.id]?.[event];
  if (!channelId) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) return false;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || 'No details available.')
    .setTimestamp()
    .setFooter({ text: 'PW VENOM LOG' });

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('Send log error:', error);
    return false;
  }
}

async function findExecutor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    const entry = logs.entries.find(item =>
      item.target?.id === targetId &&
      Date.now() - item.createdTimestamp < 10000
    );
    return entry?.executor || null;
  } catch {
    return null;
  }
}

function panelKey(interaction) {
  return `${interaction.guildId}:${interaction.user.id}`;
}

function makePanelRows() {
  const eventMenu = new StringSelectMenuBuilder()
    .setCustomId('pwlog_event')
    .setPlaceholder('Choose a log event')
    .addOptions(
      Object.entries(EVENTS).map(([value, label]) => ({
        label,
        value
      }))
    );

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('pwlog_channel')
    .setPlaceholder('Choose a logging channel')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const saveButton = new ButtonBuilder()
    .setCustomId('pwlog_save')
    .setLabel('SAVE')
    .setEmoji('💾')
    .setStyle(ButtonStyle.Success);

  return [
    new ActionRowBuilder().addComponents(eventMenu),
    new ActionRowBuilder().addComponents(channelMenu),
    new ActionRowBuilder().addComponents(saveButton)
  ];
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x168CFF)
    .setTitle('💙 PW VENOM LOG')
    .setDescription(
      '**Logging Settings**\n\n' +
      '1️⃣ Choose the event you want to log.\n' +
      '2️⃣ Choose the destination channel.\n' +
      '3️⃣ Press 💾 SAVE to save your settings.\n\n' +
      'Each event can have its own channel.'
    )
    .setFooter({ text: 'PW VENOM LOG SYSTEM' });
}

client.once('ready', () => {
  console.log(`PW VENOM LOG online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'logpanel') {
        panelData.set(panelKey(interaction), {
          event: null,
          channel: null
        });

        return interaction.reply({
          embeds: [panelEmbed()],
          components: makePanelRows(),
          ephemeral: true
        });
      }

      if (interaction.commandName === 'loginfo') {
        const guildConfig = config[interaction.guildId] || {};

        const lines = Object.entries(EVENTS).map(([key, name]) => {
          const id = guildConfig[key];
          return `**${name}:** ${id ? `<#${id}>` : 'Not configured'}`;
        });

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x168CFF)
              .setTitle('💙 PW VENOM LOG SETTINGS')
              .setDescription(lines.join('\n'))
              .setTimestamp()
          ],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'logtest') {
        const event = interaction.options.getString('event');

        const sent = await sendLog(
          interaction.guild,
          event,
          '🧪 LOG TEST',
          `Test for **${EVENTS[event]}**`
        );

        return interaction.reply({
          content: sent
            ? '✅ Test sent successfully.'
            : '❌ No channel configured. Use /logpanel.',
          ephemeral: true
        });
      }
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === 'pwlog_event'
    ) {
      const data = panelData.get(panelKey(interaction));

      if (!data) {
        return interaction.reply({
          content: '❌ Open /logpanel again.',
          ephemeral: true
        });
      }

      data.event = interaction.values[0];
      panelData.set(panelKey(interaction), data);

      return interaction.reply({
        content: `✅ Event selected: **${EVENTS[data.event]}**. Now choose a channel.`,
        ephemeral: true
      });
    }

    if (
      interaction.isChannelSelectMenu() &&
      interaction.customId === 'pwlog_channel'
    ) {
      const data = panelData.get(panelKey(interaction));

      if (!data) {
        return interaction.reply({
          content: '❌ Open /logpanel again.',
          ephemeral: true
        });
      }

      data.channel = interaction.values[0];
      panelData.set(panelKey(interaction), data);

      return interaction.reply({
        content: `✅ Channel selected: <#${data.channel}>. Press SAVE.`,
        ephemeral: true
      });
    }

    if (
      interaction.isButton() &&
      interaction.customId === 'pwlog_save'
    ) {
      const data = panelData.get(panelKey(interaction));

      if (!data || !data.event || !data.channel) {
        return interaction.reply({
          content: '❌ Choose an event and a channel first.',
          ephemeral: true
        });
      }

      const channel = await interaction.guild.channels
        .fetch(data.channel)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: '❌ The selected channel is unavailable.',
          ephemeral: true
        });
      }

      const botMember = interaction.guild.members.me;
      const permissions = channel.permissionsFor(botMember);

      if (!permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ])) {
        return interaction.reply({
          content: '❌ The bot needs View Channel, Send Messages and Embed Links permissions in that channel.',
          ephemeral: true
        });
      }

      config[interaction.guildId] ??= {};
      config[interaction.guildId][data.event] = data.channel;
      saveConfig();

      panelData.set(panelKey(interaction), {
        event: null,
        channel: null
      });

      return interaction.reply({
        content:
          `💾 **SAVED SUCCESSFULLY**\n` +
          `Event: **${EVENTS[data.event]}**\n` +
          `Channel: <#${data.channel}>`,
        ephemeral: true
      });
    }

  } catch (error) {
    console.error('Interaction error:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// MEMBER JOIN
client.on('guildMemberAdd', member => {
  sendLog(member.guild, 'memberJoin', '📥 MEMBER JOIN',
    `${member.user.tag} joined the server.\nID: ${member.id}`);
});

// MEMBER LEAVE / KICK
client.on('guildMemberRemove', async member => {
  const executor = await findExecutor(
    member.guild,
    AuditLogEvent.MemberKick,
    member.id
  );

  if (executor) {
    sendLog(member.guild, 'memberKick', '👢 MEMBER KICK',
      `${member.user.tag} was kicked.\nBy: ${executor.tag}`);
  } else {
    sendLog(member.guild, 'memberLeave', '📤 MEMBER LEAVE',
      `${member.user.tag} left the server.\nID: ${member.id}`);
  }
});

// BAN
client.on('guildBanAdd', async ban => {
  const executor = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanAdd,
    ban.user.id
  );

  sendLog(ban.guild, 'ban', '🔨 MEMBER BANNED',
    `${ban.user.tag}\nBy: ${executor?.tag || 'Unknown'}`,
    0xE74C3C);
});

// UNBAN
client.on('guildBanRemove', async ban => {
  const executor = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanRemove,
    ban.user.id
  );

  sendLog(ban.guild, 'unban', '🔓 MEMBER UNBANNED',
    `${ban.user.tag}\nBy: ${executor?.tag || 'Unknown'}`);
});

// MEMBER UPDATE
client.on('guildMemberUpdate', (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    sendLog(newMember.guild, 'nicknameUpdate', '✏️ NICKNAME UPDATE',
      `${newMember.user.tag}\nOld: ${oldMember.nickname || 'None'}\nNew: ${newMember.nickname || 'None'}`);
  }

  if (
    oldMember.communicationDisabledUntilTimestamp !==
    newMember.communicationDisabledUntilTimestamp
  ) {
    const timedOut = newMember.communicationDisabledUntilTimestamp;

    sendLog(newMember.guild, timedOut ? 'timeout' : 'timeoutRemoved',
      timedOut ? '⏳ MEMBER TIMEOUT' : '✅ TIMEOUT REMOVED',
      `${newMember.user.tag}\n${timedOut
        ? `Until: ${new Date(timedOut).toLocaleString()}`
        : 'Timeout removed.'}`);
  }
});

// MESSAGE DELETE
client.on('messageDelete', message => {
  if (!message.guild || message.author?.bot) return;

  sendLog(message.guild, 'messageDelete', '🗑️ MESSAGE DELETED',
    `Author: ${message.author?.tag || 'Unknown'}\nChannel: ${message.channel}\nContent: ${message.content || 'Unavailable'}`);
});

// MESSAGE EDIT
client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.partial || newMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;

  sendLog(newMessage.guild, 'messageEdit', '📝 MESSAGE EDITED',
    `Author: ${newMessage.author.tag}\nChannel: ${newMessage.channel}\nBefore: ${oldMessage.content || 'Empty'}\nAfter: ${newMessage.content || 'Empty'}\n${newMessage.url}`);
});

// CHANNEL CREATE
client.on('channelCreate', async channel => {
  if (!channel.guild) return;

  const executor = await findExecutor(
    channel.guild,
    AuditLogEvent.ChannelCreate,
    channel.id
  );

  sendLog(channel.guild, 'channelCreate', '📁 CHANNEL CREATED',
    `Channel: ${channel.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

// CHANNEL DELETE
client.on('channelDelete', async channel => {
  if (!channel.guild) return;

  const executor = await findExecutor(
    channel.guild,
    AuditLogEvent.ChannelDelete,
    channel.id
  );

  sendLog(channel.guild, 'channelDelete', '🗑️ CHANNEL DELETED',
    `Channel: ${channel.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

// CHANNEL UPDATE
client.on('channelUpdate', (oldChannel, newChannel) => {
  if (!newChannel.guild) return;

  sendLog(newChannel.guild, 'channelUpdate', '⚙️ CHANNEL UPDATED',
    `Channel: ${newChannel.name}\nID: ${newChannel.id}`);
});

// ROLE CREATE
client.on('roleCreate', async role => {
  const executor = await findExecutor(
    role.guild,
    AuditLogEvent.RoleCreate,
    role.id
  );

  sendLog(role.guild, 'roleCreate', '🆕 ROLE CREATED',
    `Role: ${role.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

// ROLE DELETE
client.on('roleDelete', async role => {
  const executor = await findExecutor(
    role.guild,
    AuditLogEvent.RoleDelete,
    role.id
  );

  sendLog(role.guild, 'roleDelete', '🗑️ ROLE DELETED',
    `Role: ${role.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

// ROLE UPDATE
client.on('roleUpdate', (oldRole, newRole) => {
  sendLog(newRole.guild, 'roleUpdate', '⚙️ ROLE UPDATED',
    `Role: ${newRole.name}\nID: ${newRole.id}`);
});

// VOICE
client.on('voiceStateUpdate', (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  if (!oldState.channelId && newState.channelId) {
    sendLog(member.guild, 'voiceJoin', '🔊 VOICE JOIN',
      `${member.user.tag} joined ${newState.channel.name}.`);
  } else if (oldState.channelId && !newState.channelId) {
    sendLog(member.guild, 'voiceLeave', '🔇 VOICE LEAVE',
      `${member.user.tag} left ${oldState.channel.name}.`);
  } else if (oldState.channelId !== newState.channelId) {
    sendLog(member.guild, 'voiceMove', '🔁 VOICE MOVE',
      `${member.user.tag}\nFrom: ${oldState.channel.name}\nTo: ${newState.channel.name}`);
  }
});

// SERVER UPDATE
client.on('guildUpdate', (oldGuild, newGuild) => {
  sendLog(newGuild, 'serverUpdate', '⚙️ SERVER UPDATED',
    `Server name: ${oldGuild.name} → ${newGuild.name}`);
});

// HTTP SERVER FOR RENDER
const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PW VENOM LOG is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on ${PORT}`);
});

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();
