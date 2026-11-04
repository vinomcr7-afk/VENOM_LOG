// ==========================================
// PW VENOM LOG - Discord.js v14
// ==========================================

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

// ================= CONFIG =================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID');
  process.exit(1);
}

const CONFIG_FILE = path.join(process.cwd(), 'pw-venom-config.json');

const PANEL_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/1566140735235817593/1567243375407534160/lv_0_20261026164646.gif?ex=6aeb78a2&is=6aea2722&hm=06494fff3a31cc7406b73597473da856b0f97431dc6867fe7522e617876a78a6&';

// ================= CATEGORIES =================

const CATEGORIES = {
  members: {
    name: 'Members',
    description: 'Member actions (join/leave, roles, nicknames)',
    emoji: '👥',
    events: ['memberJoin', 'memberLeave', 'memberKick', 'nicknameUpdate', 'memberRoles']
  },

  messages: {
    name: 'Messages',
    description: 'Message actions (deletions, edits, pins, reactions)',
    emoji: '💬',
    events: ['messageDelete', 'messageEdit', 'messagePin', 'messageUnpin', 'reactionAdd', 'reactionRemove']
  },

  voice: {
    name: 'Voice',
    description: 'Voice channel actions (join/leave, mute/deafen)',
    emoji: '🔊',
    events: ['voiceJoin', 'voiceLeave', 'voiceMove', 'voiceMute', 'voiceDeafen']
  },

  serverActions: {
    name: 'Server Actions',
    description: 'Server actions (invite creation/deletion, emojis)',
    emoji: '🌐',
    events: ['inviteCreate', 'inviteDelete', 'emojiUpdate', 'webhookUpdate']
  },

  channels: {
    name: 'Channels',
    description: 'Channel actions (creations/deletions, permissions)',
    emoji: '📁',
    events: ['channelCreate', 'channelDelete', 'channelUpdate', 'channelPerms']
  },

  serverEvents: {
    name: 'Server Events',
    description: 'General actions (server modifications)',
    emoji: '⚙️',
    events: ['serverUpdate']
  },

  roles: {
    name: 'Roles',
    description: 'Role actions (creations/deletions, permissions)',
    emoji: '🛡️',
    events: ['roleCreate', 'roleDelete', 'roleUpdate']
  },

  modLogs: {
    name: 'Mod Logs',
    description: 'Moderation actions (bans, kicks, timeouts)',
    emoji: '🔨',
    events: ['ban', 'unban', 'timeout', 'timeoutRemoved']
  }
};

// ================= EVENTS =================

const EVENTS = {
  memberJoin: 'Member Join',
  memberLeave: 'Member Leave',
  memberKick: 'Member Kick',
  nicknameUpdate: 'Nickname Update',
  memberRoles: 'Member Roles Updated',

  messageDelete: 'Message Delete',
  messageEdit: 'Message Edit',
  messagePin: 'Message Pinned',
  messageUnpin: 'Message Unpinned',
  reactionAdd: 'Reaction Added',
  reactionRemove: 'Reaction Removed',

  voiceJoin: 'Voice Join',
  voiceLeave: 'Voice Leave',
  voiceMove: 'Voice Move',
  voiceMute: 'Voice Mute',
  voiceDeafen: 'Voice Deafen',

  inviteCreate: 'Invite Created',
  inviteDelete: 'Invite Deleted',
  emojiUpdate: 'Emoji Updated',
  webhookUpdate: 'Webhook Updated',

  channelCreate: 'Channel Create',
  channelDelete: 'Channel Delete',
  channelUpdate: 'Channel Update',
  channelPerms: 'Channel Permissions',

  serverUpdate: 'Server Update',

  roleCreate: 'Role Create',
  roleDelete: 'Role Delete',
  roleUpdate: 'Role Update',

  ban: 'Ban',
  unban: 'Unban',
  timeout: 'Timeout',
  timeoutRemoved: 'Timeout Removed'
};

const EVENT_EMOJIS = {
  memberJoin: '🟢',
  memberLeave: '🔴',
  memberKick: '👢',
  nicknameUpdate: '✏️',
  memberRoles: '🛡️',

  messageDelete: '🗑️',
  messageEdit: '📝',
  messagePin: '📌',
  messageUnpin: '📍',
  reactionAdd: '😀',
  reactionRemove: '➖',

  voiceJoin: '🔊',
  voiceLeave: '🔇',
  voiceMove: '🔁',
  voiceMute: '🎙️',
  voiceDeafen: '🔕',

  inviteCreate: '🔗',
  inviteDelete: '❌',
  emojiUpdate: '😀',
  webhookUpdate: '🪝',

  channelCreate: '📁',
  channelDelete: '🗑️',
  channelUpdate: '⚙️',
  channelPerms: '🔐',

  serverUpdate: '🌐',

  roleCreate: '🆕',
  roleDelete: '❌',
  roleUpdate: '🛠️',

  ban: '🔨',
  unban: '🔓',
  timeout: '⏳',
  timeoutRemoved: '✅'
};

// ================= DATA =================

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
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
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.GuildMember,
    Partials.User,
    Partials.Reaction
  ]
});

// ================= COMMANDS =================

const commands = [
  new SlashCommandBuilder()
    .setName('logpanel')
    .setDescription('Open PW VENOM LOG settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('loginfo')
    .setDescription('Show configured log channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('logtest')
    .setDescription('Test a log channel')
    .addStringOption(option =>
      option
        .setName('event')
        .setDescription('Choose an event')
        .setRequired(true)
        .addChoices(
          ...Object.entries(EVENTS).map(([value, name]) => ({
            name: `${EVENT_EMOJIS[value]} ${name}`,
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

// ================= SEND LOG =================

async function sendLog(guild, event, title, description, options = {}) {
  const channelId = config[guild.id]?.[event];
  if (!channelId) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased() || !channel.send) {
    return false;
  }

  const embed = new EmbedBuilder()
    .setColor(options.color || 0x168CFF)
    .setTitle(title)
    .setDescription(String(description || 'No details available.').slice(0, 4000))
    .setTimestamp()
    .setFooter({
      text: 'PW VENOM LOG',
      iconURL: client.user.displayAvatarURL()
    });

  if (options.avatar) embed.setThumbnail(options.avatar);
  if (options.image) embed.setImage(options.image);
  if (options.guildImage) embed.setThumbnail(options.guildImage);

  try {
    await channel.send({ embeds: [embed] });
    return true;
  } catch (error) {
    console.error('Log send error:', error);
    return false;
  }
}

// ================= AUDIT LOG =================

async function findExecutor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });

    return logs.entries.find(entry =>
      entry.target?.id === targetId &&
      Date.now() - entry.createdTimestamp < 8000
    ) || null;
  } catch {
    return null;
  }
}

// ================= PANEL =================

function panelKey(interaction) {
  return `${interaction.guildId}:${interaction.user.id}`;
}

function makePanelRows(data = {}) {
  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId('pwlog_category')
    .setPlaceholder('📂 Select a category')
    .addOptions(
      Object.entries(CATEGORIES).map(([value, category]) => ({
        label: category.name,
        description: category.description,
        value,
        emoji: category.emoji
      }))
    );

  const rows = [
    new ActionRowBuilder().addComponents(categoryMenu)
  ];

  if (data.category && CATEGORIES[data.category]) {
    const category = CATEGORIES[data.category];

    const eventMenu = new StringSelectMenuBuilder()
      .setCustomId('pwlog_event')
      .setPlaceholder('📋 Select an event')
      .addOptions(
        category.events.map(event => ({
          label: EVENTS[event],
          value: event,
          emoji: EVENT_EMOJIS[event]
        }))
      );

    rows.push(new ActionRowBuilder().addComponents(eventMenu));
  }

  if (data.event) {
    const channelMenu = new ChannelSelectMenuBuilder()
      .setCustomId('pwlog_channel')
      .setPlaceholder('📁 Select a logging channel')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1);

    rows.push(new ActionRowBuilder().addComponents(channelMenu));
  }

  if (data.event && data.channel) {
    const saveButton = new ButtonBuilder()
      .setCustomId('pwlog_save')
      .setLabel('SAVE')
      .setEmoji('💾')
      .setStyle(ButtonStyle.Success);

    rows.push(new ActionRowBuilder().addComponents(saveButton));
  }

  return rows;
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x168CFF)
    .setTitle('💙 PW VENOM LOG')
    .setDescription(
      '**SERVER LOG SETTINGS**\n\n' +
      '📂 Select a category.\n' +
      '📋 Select an event.\n' +
      '📁 Select the destination channel.\n' +
      '💾 Press SAVE to store your settings.\n\n' +
      '**Each event can have its own log channel.**'
    )
    .setImage(PANEL_IMAGE_URL)
    .setFooter({ text: 'PW VENOM LOG SYSTEM' });
}

// ================= READY =================

client.once('ready', () => {
  console.log(`PW VENOM LOG online as ${client.user.tag}`);
});

// ================= INTERACTIONS =================

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'logpanel') {
        const key = panelKey(interaction);
        const data = { category: null, event: null, channel: null };

        panelData.set(key, data);

        return interaction.reply({
          embeds: [panelEmbed()],
          components: makePanelRows(data),
          ephemeral: true
        });
      }

      if (interaction.commandName === 'loginfo') {
        const guildConfig = config[interaction.guildId] || {};

        const lines = Object.entries(EVENTS).map(([key, name]) => {
          const id = guildConfig[key];

          return `${EVENT_EMOJIS[key]} **${name}:** ${
            id ? `<#${id}>` : 'Not configured'
          }`;
        });

        const embed = new EmbedBuilder()
          .setColor(0x168CFF)
          .setTitle('💙 PW VENOM LOG SETTINGS')
          .setDescription(lines.join('\n'))
          .setTimestamp();

        const icon = interaction.guild.iconURL();
        if (icon) embed.setThumbnail(icon);

        return interaction.reply({
          embeds: [embed],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'logtest') {
        const event = interaction.options.getString('event');

        const sent = await sendLog(
          interaction.guild,
          event,
          '🧪 LOG TEST',
          `Test for **${EVENTS[event]}**`,
          { avatar: interaction.user.displayAvatarURL() }
        );

        return interaction.reply({
          content: sent
            ? '✅ Test sent successfully.'
            : '❌ No channel configured or the bot lacks permissions.',
          ephemeral: true
        });
      }
    }

    const key = panelKey(interaction);
    const data = panelData.get(key);

    // CATEGORY SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_category') {
      if (!data) {
        return interaction.reply({
          content: '❌ Open /logpanel again.',
          ephemeral: true
        });
      }

      data.category = interaction.values[0];
      data.event = null;
      data.channel = null;

      return interaction.update({
        embeds: [panelEmbed()],
        components: makePanelRows(data)
      });
    }

    // EVENT SELECT
    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_event') {
      if (!data) {
        return interaction.reply({
          content: '❌ Open /logpanel again.',
          ephemeral: true
        });
      }

      data.event = interaction.values[0];
      data.channel = null;

      return interaction.update({
        embeds: [panelEmbed()],
        components: makePanelRows(data)
      });
    }

    // CHANNEL SELECT
    if (interaction.isChannelSelectMenu() && interaction.customId === 'pwlog_channel') {
      if (!data?.event) {
        return interaction.reply({
          content: '❌ Select a category and event first.',
          ephemeral: true
        });
      }

      data.channel = interaction.values[0];

      return interaction.update({
        embeds: [panelEmbed()],
        components: makePanelRows(data)
      });
    }

    // SAVE
    if (interaction.isButton() && interaction.customId === 'pwlog_save') {
      if (!data?.category || !data?.event || !data?.channel) {
        return interaction.reply({
          content: '❌ Select a category, event and channel first.',
          ephemeral: true
        });
      }

      const channel = await interaction.guild.channels
        .fetch(data.channel)
        .catch(() => null);

      if (!channel || !channel.isTextBased()) {
        return interaction.reply({
          content: '❌ Selected channel is unavailable.',
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
          content: '❌ Give the bot View Channel, Send Messages and Embed Links.',
          ephemeral: true
        });
      }

      config[interaction.guildId] ??= {};
      config[interaction.guildId][data.event] = data.channel;

      try {
        saveConfig();
      } catch (error) {
        console.error('Config save error:', error);

        return interaction.reply({
          content: '❌ Could not save settings.',
          ephemeral: true
        });
      }

      const savedEvent = data.event;
      const savedChannel = data.channel;

      panelData.set(key, {
        category: data.category,
        event: null,
        channel: null
      });

      return interaction.update({
        content:
          `💾 **SAVED SUCCESSFULLY**\n` +
          `${EVENT_EMOJIS[savedEvent]} Event: **${EVENTS[savedEvent]}**\n` +
          `📁 Channel: <#${savedChannel}>\n\n` +
          'You can now select another event.',
        embeds: [panelEmbed()],
        components: makePanelRows(panelData.get(key))
      });
    }
  } catch (error) {
    console.error('Interaction error:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ================= MEMBER EVENTS =================

client.on('guildMemberAdd', member => {
  sendLog(
    member.guild,
    'memberJoin',
    '🟢 MEMBER JOIN',
    `**Member:** ${member.user.tag}\n**ID:** ${member.id}\n` +
    `**Account:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
    { avatar: member.user.displayAvatarURL({ size: 512 }) }
  );
});

client.on('guildMemberRemove', async member => {
  const entry = await findExecutor(
    member.guild,
    AuditLogEvent.MemberKick,
    member.id
  );

  if (entry) {
    sendLog(
      member.guild,
      'memberKick',
      '👢 MEMBER KICK',
      `**Member:** ${member.user.tag}\n**Moderator:** ${entry.executor?.tag || 'Unknown'}`,
      {
        avatar: member.user.displayAvatarURL({ size: 512 }),
        color: 0xE67E22
      }
    );
  } else {
    sendLog(
      member.guild,
      'memberLeave',
      '📤 MEMBER LEAVE',
      `**Member:** ${member.user.tag}\n**ID:** ${member.id}`,
      { avatar: member.user.displayAvatarURL({ size: 512 }) }
    );
  }
});

client.on('guildMemberUpdate', (oldMember, newMember) => {
  const avatar = newMember.user.displayAvatarURL({ size: 512 });

  if (oldMember.nickname !== newMember.nickname) {
    sendLog(
      newMember.guild,
      'nicknameUpdate',
      '✏️ NICKNAME UPDATED',
      `**Member:** ${newMember.user.tag}\n` +
      `**Old:** ${oldMember.nickname || 'None'}\n` +
      `**New:** ${newMember.nickname || 'None'}`,
      { avatar }
    );
  }

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  if (!oldRoles.equals(newRoles)) {
    const added = newRoles.filter(role => !oldRoles.has(role.id));
    const removed = oldRoles.filter(role => !newRoles.has(role.id));

    sendLog(
      newMember.guild,
      'memberRoles',
      '🛡️ MEMBER ROLES UPDATED',
      `**Member:** ${newMember.user.tag}\n` +
      `**Added:** ${added.map(role => role.name).join(', ') || 'None'}\n` +
      `**Removed:** ${removed.map(role => role.name).join(', ') || 'None'}`,
      { avatar }
    );
  }

  if (
    oldMember.communicationDisabledUntilTimestamp !==
    newMember.communicationDisabledUntilTimestamp
  ) {
    const timeout = newMember.communicationDisabledUntilTimestamp;

    sendLog(
      newMember.guild,
      timeout ? 'timeout' : 'timeoutRemoved',
      timeout ? '⏳ MEMBER TIMEOUT' : '✅ TIMEOUT REMOVED',
      `**Member:** ${newMember.user.tag}\n` +
      `**Until:** ${timeout ? `<t:${Math.floor(timeout / 1000)}:F>` : 'Removed'}`,
      { avatar }
    );
  }
});

// ================= MODERATION =================

client.on('guildBanAdd', async ban => {
  const entry = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanAdd,
    ban.user.id
  );

  sendLog(
    ban.guild,
    'ban',
    '🔨 MEMBER BANNED',
    `**User:** ${ban.user.tag}\n**Moderator:** ${entry?.executor?.tag || 'Unknown'}`,
    {
      avatar: ban.user.displayAvatarURL({ size: 512 }),
      color: 0xE74C3C
    }
  );
});

client.on('guildBanRemove', async ban => {
  const entry = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanRemove,
    ban.user.id
  );

  sendLog(
    ban.guild,
    'unban',
    '🔓 MEMBER UNBANNED',
    `**User:** ${ban.user.tag}\n**Moderator:** ${entry?.executor?.tag || 'Unknown'}`,
    { avatar: ban.user.displayAvatarURL({ size: 512 }) }
  );
});

// ================= MESSAGE EVENTS =================

client.on('messageDelete', message => {
  if (!message.guild || message.author?.bot) return;

  sendLog(
    message.guild,
    'messageDelete',
    '🗑️ MESSAGE DELETED',
    `**Author:** ${message.author?.tag || 'Unknown'}\n` +
    `**Channel:** ${message.channel}\n` +
    `**Content:** ${message.content || 'Unavailable'}`,
    { avatar: message.author?.displayAvatarURL({ size: 512 }) }
  );
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.partial || newMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;

  sendLog(
    newMessage.guild,
    'messageEdit',
    '📝 MESSAGE EDITED',
    `**Author:** ${newMessage.author.tag}\n` +
    `**Channel:** ${newMessage.channel}\n` +
    `**Before:** ${oldMessage.content || 'Empty'}\n` +
    `**After:** ${newMessage.content || 'Empty'}\n` +
    `[Jump to message](${newMessage.url})`,
    { avatar: newMessage.author.displayAvatarURL({ size: 512 }) }
  );
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!newMessage.guild || oldMessage.pinned === newMessage.pinned) return;

  sendLog(
    newMessage.guild,
    newMessage.pinned ? 'messagePin' : 'messageUnpin',
    newMessage.pinned ? '📌 MESSAGE PINNED' : '📍 MESSAGE UNPINNED',
    `**Channel:** ${newMessage.channel}\n**Message ID:** ${newMessage.id}`
  );
});

client.on('messageReactionAdd', (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;

  sendLog(
    reaction.message.guild,
    'reactionAdd',
    '😀 REACTION ADDED',
    `**User:** ${user.tag}\n**Emoji:** ${reaction.emoji}\n` +
    `**Channel:** ${reaction.message.channel}`
  );
});

client.on('messageReactionRemove', (reaction, user) => {
  if (user.bot || !reaction.message.guild) return;

  sendLog(
    reaction.message.guild,
    'reactionRemove',
    '➖ REACTION REMOVED',
    `**User:** ${user.tag}\n**Emoji:** ${reaction.emoji}\n` +
    `**Channel:** ${reaction.message.channel}`
  );
});

// ================= VOICE EVENTS =================

client.on('voiceStateUpdate', (oldState, newState) => {
  const member = newState.member || oldState.member;
  if (!member) return;

  const avatar = member.user.displayAvatarURL({ size: 512 });

  if (!oldState.channelId && newState.channelId) {
    sendLog(
      member.guild,
      'voiceJoin',
      '🔊 VOICE JOIN',
      `**Member:** ${member.user.tag}\n**Channel:** ${newState.channel}`,
      { avatar }
    );
  } else if (oldState.channelId && !newState.channelId) {
    sendLog(
      member.guild,
      'voiceLeave',
      '🔇 VOICE LEAVE',
      `**Member:** ${member.user.tag}\n**Channel:** ${oldState.channel}`,
      { avatar }
    );
  } else if (oldState.channelId !== newState.channelId) {
    sendLog(
      member.guild,
      'voiceMove',
      '🔁 VOICE MOVE',
      `**Member:** ${member.user.tag}\n` +
      `**From:** ${oldState.channel}\n**To:** ${newState.channel}`,
      { avatar }
    );
  }

  if (oldState.serverMute !== newState.serverMute) {
    sendLog(
      member.guild,
      'voiceMute',
      '🎙️ SERVER MUTE UPDATED',
      `**Member:** ${member.user.tag}\n**Muted:** ${newState.serverMute ? 'Yes' : 'No'}`,
      { avatar }
    );
  }

  if (oldState.serverDeaf !== newState.serverDeaf) {
    sendLog(
      member.guild,
      'voiceDeafen',
      '🔕 SERVER DEAFEN UPDATED',
      `**Member:** ${member.user.tag}\n**Deafened:** ${newState.serverDeaf ? 'Yes' : 'No'}`,
      { avatar }
    );
  }
});

// ================= CHANNEL EVENTS =================

client.on('channelCreate', async channel => {
  if (!channel.guild) return;

  const entry = await findExecutor(
    channel.guild,
    AuditLogEvent.ChannelCreate,
    channel.id
  );

  sendLog(
    channel.guild,
    'channelCreate',
    '📁 CHANNEL CREATED',
    `**Channel:** ${channel.name}\n**Created by:** ${entry?.executor?.tag || 'Unknown'}`,
    { guildImage: channel.guild.iconURL({ size: 512 }) }
  );
});

client.on('channelDelete', async channel => {
  if (!channel.guild) return;

  const entry = await findExecutor(
    channel.guild,
    AuditLogEvent.ChannelDelete,
    channel.id
  );

  sendLog(
    channel.guild,
    'channelDelete',
    '🗑️ CHANNEL DELETED',
    `**Channel:** ${channel.name}\n**Deleted by:** ${entry?.executor?.tag || 'Unknown'}`,
    { guildImage: channel.guild.iconURL({ size: 512 }) }
  );
});

client.on('channelUpdate', (oldChannel, newChannel) => {
  if (!newChannel.guild) return;

  sendLog(
    newChannel.guild,
    'channelUpdate',
    '⚙️ CHANNEL UPDATED',
    `**Channel:** ${newChannel.name}\n**ID:** ${newChannel.id}`,
    { guildImage: newChannel.guild.iconURL({ size: 512 }) }
  );

  const oldPerms = oldChannel.permissionOverwrites?.cache;
  const newPerms = newChannel.permissionOverwrites?.cache;

  if (oldPerms && newPerms && !oldPerms.equals(newPerms)) {
    sendLog(
      newChannel.guild,
      'channelPerms',
      '🔐 CHANNEL PERMISSIONS UPDATED',
      `**Channel:** ${newChannel.name}\n**ID:** ${newChannel.id}`,
      { guildImage: newChannel.guild.iconURL({ size: 512 }) }
    );
  }
});

// ================= ROLE EVENTS =================

client.on('roleCreate', async role => {
  const entry = await findExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

  sendLog(
    role.guild,
    'roleCreate',
    '🆕 ROLE CREATED',
    `**Role:** ${role.name}\n**Created by:** ${entry?.executor?.tag || 'Unknown'}`,
    { guildImage: role.guild.iconURL({ size: 512 }) }
  );
});

client.on('roleDelete', async role => {
  const entry = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

  sendLog(
    role.guild,
    'roleDelete',
    '🗑️ ROLE DELETED',
    `**Role:** ${role.name}\n**Deleted by:** ${entry?.executor?.tag || 'Unknown'}`,
    { guildImage: role.guild.iconURL({ size: 512 }) }
  );
});

client.on('roleUpdate', (oldRole, newRole) => {
  sendLog(
    newRole.guild,
    'roleUpdate',
    '⚙️ ROLE UPDATED',
    `**Role:** ${newRole.name}\n**ID:** ${newRole.id}\n**Color:** ${newRole.hexColor}`,
    { guildImage: newRole.guild.iconURL({ size: 512 }) }
  );
});

// ================= INVITE EVENTS =================

client.on('inviteCreate', invite => {
  if (!invite.guild) return;

  sendLog(
    invite.guild,
    'inviteCreate',
    '🔗 INVITE CREATED',
    `**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'}\n` +
    `**Creator:** ${invite.inviter?.tag || 'Unknown'}`
  );
});

client.on('inviteDelete', invite => {
  if (!invite.guild) return;

  sendLog(
    invite.guild,
    'inviteDelete',
    '❌ INVITE DELETED',
    `**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'}`
  );
});

// ================= EMOJI EVENTS =================

client.on('guildEmojisUpdate', (guild, oldEmojis, newEmojis) => {
  const added = newEmojis.filter(emoji => !oldEmojis.has(emoji.id));
  const removed = oldEmojis.filter(emoji => !newEmojis.has(emoji.id));

  sendLog(
    guild,
    'emojiUpdate',
    '😀 SERVER EMOJIS UPDATED',
    `**Added:** ${added.map(emoji => emoji.name).join(', ') || 'None'}\n` +
    `**Removed:** ${removed.map(emoji => emoji.name).join(', ') || 'None'}`
  );
});

// ================= WEBHOOK EVENTS =================

client.on('webhookUpdate', channel => {
  if (!channel.guild) return;

  sendLog(
    channel.guild,
    'webhookUpdate',
    '🪝 WEBHOOK UPDATED',
    `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`
  );
});

// ================= SERVER EVENTS =================

client.on('guildUpdate', (oldGuild, newGuild) => {
  const changes = [];

  if (oldGuild.name !== newGuild.name) {
    changes.push(`**Name:** ${oldGuild.name} → ${newGuild.name}`);
  }

  if (oldGuild.icon !== newGuild.icon) {
    changes.push('**Server icon changed.**');
  }

  if (oldGuild.banner !== newGuild.banner) {
    changes.push('**Server banner changed.**');
  }

  if (oldGuild.description !== newGuild.description) {
    changes.push('**Server description changed.**');
  }

  if (!changes.length) return;

  sendLog(
    newGuild,
    'serverUpdate',
    '🌐 SERVER UPDATED',
    changes.join('\n'),
    {
      guildImage: newGuild.iconURL({ size: 512 }),
      image: newGuild.bannerURL({ size: 1024 })
    }
  );
});

// ================= RENDER HTTP SERVER =================

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('PW VENOM LOG is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on ${PORT}`);
});

// ================= START BOT =================

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error('Startup error:', error);
    process.exit(1);
  }
})();