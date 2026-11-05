// PW VENOM LOG — Discord.js v14
// Secrets must be set in the host's Environment Variables:
// DISCORD_TOKEN, CLIENT_ID, and optionally GUILD_ID.

'use strict';

const {
  Client, GatewayIntentBits, Partials, REST, Routes,
  SlashCommandBuilder, ChannelType, ChannelSelectMenuBuilder,
  EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits, AuditLogEvent,
  Events
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;
const PORT = Number(process.env.PORT) || 10000;
const CONFIG_FILE = path.join(__dirname, 'pw-venom-config.json');

const PANEL_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1566140735235817593/1567243375407534160/lv_0_20261026164646.gif?ex=6aeb78a2&is=6aea2722&hm=06494fff3a31cc7406b73597473da856b0f97431dc6867fe7522e617876a78a6&';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID environment variable.');
  process.exit(1);
}

const CATEGORIES = {
  members: { name: 'Members', description: 'Join, leave, kicks, roles and nicknames', emoji: '👥', events: ['memberJoin','memberLeave','memberKick','nicknameUpdate','memberRoles'] },
  messages: { name: 'Messages', description: 'Deleted/edited messages, pins and reactions', emoji: '💬', events: ['messageDelete','messageEdit','messagePin','messageUnpin','reactionAdd','reactionRemove'] },
  voice: { name: 'Voice', description: 'Voice joins, leaves, moves, mute and deafen', emoji: '🔊', events: ['voiceJoin','voiceLeave','voiceMove','voiceMute','voiceDeafen'] },
  serverActions: { name: 'Server Actions', description: 'Invites, emojis and webhooks', emoji: '🌐', events: ['inviteCreate','inviteDelete','emojiUpdate','webhookUpdate'] },
  channels: { name: 'Channels', description: 'Channel creation, deletion, edits and permissions', emoji: '📁', events: ['channelCreate','channelDelete','channelUpdate','channelPerms'] },
  serverEvents: { name: 'Server Events', description: 'Server modifications', emoji: '⚙️', events: ['serverUpdate'] },
  roles: { name: 'Roles', description: 'Role creation, deletion and edits', emoji: '🛡️', events: ['roleCreate','roleDelete','roleUpdate'] },
  modLogs: { name: 'Mod Logs', description: 'Bans, unbans and timeouts', emoji: '🔨', events: ['ban','unban','timeout','timeoutRemoved'] }
};

const EVENTS = {
  memberJoin:'Member Join', memberLeave:'Member Leave', memberKick:'Member Kick',
  nicknameUpdate:'Nickname Update', memberRoles:'Member Roles Updated',
  messageDelete:'Message Delete', messageEdit:'Message Edit', messagePin:'Message Pinned',
  messageUnpin:'Message Unpinned', reactionAdd:'Reaction Added', reactionRemove:'Reaction Removed',
  voiceJoin:'Voice Join', voiceLeave:'Voice Leave', voiceMove:'Voice Move',
  voiceMute:'Voice Mute', voiceDeafen:'Voice Deafen',
  inviteCreate:'Invite Created', inviteDelete:'Invite Deleted', emojiUpdate:'Emoji Updated',
  webhookUpdate:'Webhook Updated', channelCreate:'Channel Create', channelDelete:'Channel Delete',
  channelUpdate:'Channel Update', channelPerms:'Channel Permissions', serverUpdate:'Server Update',
  roleCreate:'Role Create', roleDelete:'Role Delete', roleUpdate:'Role Update',
  ban:'Ban', unban:'Unban', timeout:'Timeout', timeoutRemoved:'Timeout Removed'
};

const EVENT_EMOJIS = {
  memberJoin:'🟢', memberLeave:'🔴', memberKick:'👢', nicknameUpdate:'✏️', memberRoles:'🛡️',
  messageDelete:'🗑️', messageEdit:'📝', messagePin:'📌', messageUnpin:'📍', reactionAdd:'😀', reactionRemove:'➖',
  voiceJoin:'🔊', voiceLeave:'🔇', voiceMove:'🔁', voiceMute:'🎙️', voiceDeafen:'🔕',
  inviteCreate:'🔗', inviteDelete:'❌', emojiUpdate:'😀', webhookUpdate:'🪝',
  channelCreate:'📁', channelDelete:'🗑️', channelUpdate:'⚙️', channelPerms:'🔐',
  serverUpdate:'🌐', roleCreate:'🆕', roleDelete:'❌', roleUpdate:'🛠️',
  ban:'🔨', unban:'🔓', timeout:'⏳', timeoutRemoved:'✅'
};

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Config file could not be read; starting with empty config:', error.message);
    return {};
  }
}
const config = loadConfig();
const panelData = new Map();
const pendingConfirmations = new Map();

function saveConfig() {
  const temp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(config, null, 2), 'utf8');
  fs.renameSync(temp, CONFIG_FILE);
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
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User, Partials.Reaction]
});

const commandData = [
  new SlashCommandBuilder().setName('logpanel').setDescription('Open PW VENOM LOG settings').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('loginfo').setDescription('Show configured log channels').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('logtest').setDescription('Test a configured log event')
    .addStringOption(o => o.setName('event').setDescription('Choose an event').setRequired(true).setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commandData });
  console.log(GUILD_ID ? `Slash commands registered in guild ${GUILD_ID}.` : 'Global slash commands registered (may take time to appear).');
}

async function sendLog(guild, event, title, description, options = {}) {
  const configured = config[guild.id]?.[event];
  const channelIds = Array.isArray(configured) ? configured : (configured ? [configured] : []);
  if (!channelIds.length) return false;

  const embed = new EmbedBuilder()
    .setColor(options.color ?? 0x168CFF)
    .setTitle(String(title).slice(0, 256))
    .setDescription(String(description || 'No details available.').slice(0, 4000))
    .setTimestamp()
    .setFooter({ text: 'PW VENOM LOG', iconURL: client.user?.displayAvatarURL() });
  if (options.avatar) embed.setThumbnail(options.avatar);
  if (options.image) embed.setImage(options.image);
  if (options.guildImage) embed.setThumbnail(options.guildImage);

  const results = await Promise.all(channelIds.slice(0, 3).map(async channelId => {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || typeof channel.send !== 'function') return false;
    try {
      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error(`Could not send ${event} log to ${channelId}:`, error.message);
      return false;
    }
  }));
  return results.some(Boolean);
}

async function findExecutor(guild, type, targetId) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 6 });
    const entry = logs.entries.find(e =>
      e.target?.id === targetId && Date.now() - e.createdTimestamp < 10000
    );
    return entry || null;
  } catch {
    return null; // Bot needs View Audit Log permission.
  }
}

function panelKey(interaction) {
  return `${interaction.guildId}:${interaction.user.id}`;
}

function makePanelRows(data = {}) {
  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId('pwlog_category').setPlaceholder('📂 Select a category')
    .addOptions(Object.entries(CATEGORIES).map(([value, c]) => ({
      label: c.name, description: c.description, value, emoji: c.emoji
    })));
  const rows = [new ActionRowBuilder().addComponents(categoryMenu)];

  if (data.category && CATEGORIES[data.category]) {
    const eventMenu = new StringSelectMenuBuilder()
      .setCustomId('pwlog_event').setPlaceholder('📋 Select an event')
      .addOptions(CATEGORIES[data.category].events.map(event => ({
        label: EVENTS[event], value: event, emoji: EVENT_EMOJIS[event]
      })));
    rows.push(new ActionRowBuilder().addComponents(eventMenu));
  }
  if (data.event) {
    const channelMenu = new ChannelSelectMenuBuilder()
      .setCustomId('pwlog_channel').setPlaceholder('📁 Select exactly 3 logging channels')
      .setChannelTypes(ChannelType.GuildText).setMinValues(3).setMaxValues(3);
    rows.push(new ActionRowBuilder().addComponents(channelMenu));
  }
  if (data.event && data.channels?.length === 3) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pwlog_save').setLabel('SAVE').setEmoji('💾').setStyle(ButtonStyle.Success)
    ));
  }
  return rows;
}

function panelEmbed() {
  const embed = new EmbedBuilder().setColor(0x168CFF).setTitle('💙 PW VENOM LOG')
    .setDescription('**SERVER LOG SETTINGS**\n\n📂 Select a category.\n📋 Select an event.\n📁 Select exactly 3 destination channels.\n💾 Press SAVE, then confirm with YES or cancel with NO.\n\nEach event sends its logs to the 3 selected channels.')
    .setFooter({ text: 'PW VENOM LOG SYSTEM' });
  if (PANEL_IMAGE_URL) embed.setImage(PANEL_IMAGE_URL);
  return embed;
}

function confirmationRows() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pwlog_confirm_yes').setLabel('YES, SAVE').setEmoji('✅').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pwlog_confirm_no').setLabel('NO, CANCEL').setEmoji('❌').setStyle(ButtonStyle.Danger)
  )];
}

client.once(Events.ClientReady, readyClient => {
  console.log(`PW VENOM LOG online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === 'logtest') {
      const q = interaction.options.getFocused().toLowerCase();
      return interaction.respond(Object.entries(EVENTS)
        .filter(([key, label]) => key.toLowerCase().includes(q) || label.toLowerCase().includes(q))
        .slice(0, 25).map(([key, label]) => ({ name: `${EVENT_EMOJIS[key]} ${label}`.slice(0, 100), value: key })));
    }

    if (interaction.isChatInputCommand()) {
      if (!interaction.guild) return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });

      if (interaction.commandName === 'logpanel') {
        const data = { category: null, event: null, channels: [] };
        panelData.set(panelKey(interaction), data);
        return interaction.reply({ embeds: [panelEmbed()], components: makePanelRows(data), ephemeral: true });
      }

      if (interaction.commandName === 'loginfo') {
        const settings = config[interaction.guildId] || {};
        const lines = Object.entries(EVENTS).map(([key, label]) => {
          const ids = Array.isArray(settings[key]) ? settings[key] : (settings[key] ? [settings[key]] : []);
          return `${EVENT_EMOJIS[key]} **${label}:** ${ids.length ? ids.map(id => `<#${id}>`).join(' • ') : 'Not configured'}`;
        });
        const embed = new EmbedBuilder().setColor(0x168CFF).setTitle('💙 PW VENOM LOG SETTINGS')
          .setDescription(lines.join('\n')).setTimestamp();
        const icon = interaction.guild.iconURL();
        if (icon) embed.setThumbnail(icon);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.commandName === 'logtest') {
        const event = interaction.options.getString('event', true);
        if (!EVENTS[event]) return interaction.reply({ content: 'Unknown event.', ephemeral: true });
        const ok = await sendLog(interaction.guild, event, '🧪 LOG TEST', `Test for **${EVENTS[event]}**`, { avatar: interaction.user.displayAvatarURL() });
        return interaction.reply({ content: ok ? '✅ Test sent successfully.' : '❌ No channel configured or bot permissions are missing.', ephemeral: true });
      }
    }

    if (!interaction.guild || !interaction.guildId) return;
    const key = panelKey(interaction);
    const data = panelData.get(key);

    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_category') {
      if (!data) return interaction.reply({ content: 'Panel expired. Run /logpanel again.', ephemeral: true });
      data.category = interaction.values[0]; data.event = null; data.channels = [];
      pendingConfirmations.delete(key);
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_event') {
      if (!data) return interaction.reply({ content: 'Panel expired. Run /logpanel again.', ephemeral: true });
      data.event = interaction.values[0]; data.channels = [];
      pendingConfirmations.delete(key);
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'pwlog_channel') {
      if (!data?.event) return interaction.reply({ content: 'Select a category and event first.', ephemeral: true });
      if (interaction.values.length !== 3) {
        return interaction.reply({ content: 'Select exactly 3 logging channels.', ephemeral: true });
      }
      data.channels = interaction.values.slice(0, 3);
      pendingConfirmations.delete(key);
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isButton() && interaction.customId === 'pwlog_save') {
      if (!data?.category || !data?.event || data.channels?.length !== 3) {
        return interaction.reply({ content: 'Select a category, event and exactly 3 channels first.', ephemeral: true });
      }
      const botMember = interaction.guild.members.me;
      for (const channelId of data.channels) {
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased()) return interaction.reply({ content: `Channel <#${channelId}> is unavailable.`, ephemeral: true });
        const perms = channel.permissionsFor(botMember);
        if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
          return interaction.reply({ content: `Give the bot View Channel, Send Messages and Embed Links in <#${channelId}>.`, ephemeral: true });
        }
      }
      pendingConfirmations.set(key, { event: data.event, channelIds: data.channels.slice(0, 3), category: data.category, expires: Date.now() + 60000 });
      return interaction.update({
        content: `⚠️ **Confirm saving these settings**\nEvent: **${EVENTS[data.event]}**\nChannels:\n${data.channels.map(id => `• <#${id}>`).join('\n')}`,
        components: confirmationRows()
      });
    }

    if (interaction.isButton() && ['pwlog_confirm_yes', 'pwlog_confirm_no'].includes(interaction.customId)) {
      const pending = pendingConfirmations.get(key);
      if (interaction.customId === 'pwlog_confirm_no') {
        pendingConfirmations.delete(key);
        return interaction.update({ content: '↩️ Save cancelled. No settings were changed.', components: makePanelRows(data || {}) });
      }
      if (!pending || pending.expires < Date.now()) {
        pendingConfirmations.delete(key);
        return interaction.update({ content: '⌛ Confirmation expired. Select the event and channel again.', components: makePanelRows(data || {}) });
      }
      config[interaction.guildId] ??= {};
      config[interaction.guildId][pending.event] = pending.channelIds.slice(0, 3);
      try {
        saveConfig();
      } catch (error) {
        console.error('Config write failed:', error);
        return interaction.update({ content: '❌ Could not save settings. Check host disk permissions.', components: makePanelRows(data || {}) });
      }
      pendingConfirmations.delete(key);
      if (data) { data.event = null; data.channels = []; }
      return interaction.update({
        content: `💾 **SAVED SUCCESSFULLY**\n${EVENT_EMOJIS[pending.event]} Event: **${EVENTS[pending.event]}**\n📁 Channels:\n${pending.channelIds.map(id => `• <#${id}>`).join('\n')}`,
        embeds: [panelEmbed()], components: makePanelRows(data || {})
      });
    }
  } catch (error) {
    console.error('Interaction error:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred. Check the bot console.', ephemeral: true }).catch(() => {});
    }
  }
});

// Members, nicknames, roles, timeout
client.on(Events.GuildMemberAdd, member => sendLog(member.guild, 'memberJoin', '🟢 MEMBER JOIN',
  `**Member:** ${member.user.tag}\n**ID:** ${member.id}\n**Account:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
  { avatar: member.user.displayAvatarURL({ size: 512 }) }));

client.on(Events.GuildMemberRemove, async member => {
  const kick = await findExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
  if (kick) {
    await sendLog(member.guild, 'memberKick', '👢 MEMBER KICK', `**Member:** ${member.user?.tag || member.id}\n**Moderator:** ${kick.executor?.tag || 'Unknown'}`, { color: 0xE67E22 });
  } else {
    await sendLog(member.guild, 'memberLeave', '📤 MEMBER LEAVE', `**Member:** ${member.user?.tag || member.id}\n**ID:** ${member.id}`);
  }
});

client.on(Events.GuildMemberUpdate, (oldM, newM) => {
  const avatar = newM.user.displayAvatarURL({ size: 512 });
  if (oldM.nickname !== newM.nickname) sendLog(newM.guild, 'nicknameUpdate', '✏️ NICKNAME UPDATED',
    `**Member:** ${newM.user.tag}\n**Old:** ${oldM.nickname || 'None'}\n**New:** ${newM.nickname || 'None'}`, { avatar });

  const added = newM.roles.cache.filter(r => !oldM.roles.cache.has(r.id));
  const removed = oldM.roles.cache.filter(r => !newM.roles.cache.has(r.id));
  if (added.size || removed.size) sendLog(newM.guild, 'memberRoles', '🛡️ MEMBER ROLES UPDATED',
    `**Member:** ${newM.user.tag}\n**Added:** ${added.map(r => r.name).join(', ') || 'None'}\n**Removed:** ${removed.map(r => r.name).join(', ') || 'None'}`, { avatar });

  if (oldM.communicationDisabledUntilTimestamp !== newM.communicationDisabledUntilTimestamp) {
    const until = newM.communicationDisabledUntilTimestamp;
    sendLog(newM.guild, until ? 'timeout' : 'timeoutRemoved', until ? '⏳ MEMBER TIMEOUT' : '✅ TIMEOUT REMOVED',
      `**Member:** ${newM.user.tag}\n**Until:** ${until ? `<t:${Math.floor(until / 1000)}:F>` : 'Removed'}`, { avatar });
  }
});

// Bans
client.on(Events.GuildBanAdd, async ban => {
  const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  sendLog(ban.guild, 'ban', '🔨 MEMBER BANNED', `**User:** ${ban.user.tag}\n**Moderator:** ${entry?.executor?.tag || 'Unknown'}`, { avatar: ban.user.displayAvatarURL({ size: 512 }), color: 0xE74C3C });
});
client.on(Events.GuildBanRemove, async ban => {
  const entry = await findExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
  sendLog(ban.guild, 'unban', '🔓 MEMBER UNBANNED', `**User:** ${ban.user.tag}\n**Moderator:** ${entry?.executor?.tag || 'Unknown'}`, { avatar: ban.user.displayAvatarURL({ size: 512 }) });
});

// Messages and pins
client.on(Events.MessageDelete, async message => {
  if (!message.guild) return;
  if (message.partial) await message.fetch().catch(() => null);
  if (message.author?.bot) return;
  sendLog(message.guild, 'messageDelete', '🗑️ MESSAGE DELETED',
    `**Author:** ${message.author?.tag || 'Unknown'}\n**Channel:** <#${message.channelId}>\n**Content:** ${message.content || 'Unavailable (possibly uncached/partial)'}`,
    { avatar: message.author?.displayAvatarURL({ size: 512 }) });
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!newMsg.guild) return;
  if (oldMsg.partial) await oldMsg.fetch().catch(() => null);
  if (newMsg.partial) await newMsg.fetch().catch(() => null);
  if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
  sendLog(newMsg.guild, 'messageEdit', '📝 MESSAGE EDITED',
    `**Author:** ${newMsg.author?.tag || 'Unknown'}\n**Channel:** <#${newMsg.channelId}>\n**Before:** ${oldMsg.content || 'Empty/unavailable'}\n**After:** ${newMsg.content || 'Empty/unavailable'}\n[Jump to message](${newMsg.url})`,
    { avatar: newMsg.author?.displayAvatarURL({ size: 512 }) });
  if (oldMsg.pinned !== newMsg.pinned) sendLog(newMsg.guild, newMsg.pinned ? 'messagePin' : 'messageUnpin',
    newMsg.pinned ? '📌 MESSAGE PINNED' : '📍 MESSAGE UNPINNED',
    `**Channel:** <#${newMsg.channelId}>\n**Message ID:** ${newMsg.id}`);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (!reaction.message.guild) return;
  sendLog(reaction.message.guild, 'reactionAdd', '😀 REACTION ADDED',
    `**User:** ${user.tag}\n**Emoji:** ${reaction.emoji}\n**Channel:** <#${reaction.message.channelId}>`);
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  if (!reaction.message.guild) return;
  sendLog(reaction.message.guild, 'reactionRemove', '➖ REACTION REMOVED',
    `**User:** ${user.tag}\n**Emoji:** ${reaction.emoji}\n**Channel:** <#${reaction.message.channelId}>`);
});

// Voice
client.on(Events.VoiceStateUpdate, (oldS, newS) => {
  const member = newS.member || oldS.member;
  if (!member) return;
  const avatar = member.user.displayAvatarURL({ size: 512 });
  if (!oldS.channelId && newS.channelId) sendLog(member.guild, 'voiceJoin', '🔊 VOICE JOIN', `**Member:** ${member.user.tag}\n**Channel:** ${newS.channel}`, { avatar });
  else if (oldS.channelId && !newS.channelId) sendLog(member.guild, 'voiceLeave', '🔇 VOICE LEAVE', `**Member:** ${member.user.tag}\n**Channel:** ${oldS.channel}`, { avatar });
  else if (oldS.channelId !== newS.channelId) sendLog(member.guild, 'voiceMove', '🔁 VOICE MOVE', `**Member:** ${member.user.tag}\n**From:** ${oldS.channel}\n**To:** ${newS.channel}`, { avatar });
  if (oldS.serverMute !== newS.serverMute) sendLog(member.guild, 'voiceMute', '🎙️ SERVER MUTE UPDATED', `**Member:** ${member.user.tag}\n**Muted:** ${newS.serverMute ? 'Yes' : 'No'}`, { avatar });
  if (oldS.serverDeaf !== newS.serverDeaf) sendLog(member.guild, 'voiceDeafen', '🔕 SERVER DEAFEN UPDATED', `**Member:** ${member.user.tag}\n**Deafened:** ${newS.serverDeaf ? 'Yes' : 'No'}`, { avatar });
});

// Channels and overwrites
client.on(Events.ChannelCreate, async channel => {
  if (!channel.guild) return;
  const entry = await findExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
  sendLog(channel.guild, 'channelCreate', '📁 CHANNEL CREATED', `**Channel:** ${channel.name}\n**Created by:** ${entry?.executor?.tag || 'Unknown'}`);
});
client.on(Events.ChannelDelete, async channel => {
  if (!channel.guild) return;
  const entry = await findExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
  sendLog(channel.guild, 'channelDelete', '🗑️ CHANNEL DELETED', `**Channel:** ${channel.name}\n**Deleted by:** ${entry?.executor?.tag || 'Unknown'}`);
});
client.on(Events.ChannelUpdate, (oldC, newC) => {
  if (!newC.guild) return;
  const changed = [];
  if (oldC.name !== newC.name) changed.push(`Name: ${oldC.name} → ${newC.name}`);
  if (oldC.topic !== newC.topic) changed.push(`Topic: ${oldC.topic || 'None'} → ${newC.topic || 'None'}`);
  if (changed.length) sendLog(newC.guild, 'channelUpdate', '⚙️ CHANNEL UPDATED', `**Channel:** <#${newC.id}>\n${changed.join('\n')}`);
  if (oldC.permissionOverwrites?.cache && newC.permissionOverwrites?.cache &&
      !oldC.permissionOverwrites.cache.equals(newC.permissionOverwrites.cache)) {
    sendLog(newC.guild, 'channelPerms', '🔐 CHANNEL PERMISSIONS UPDATED', `**Channel:** <#${newC.id}>\n**ID:** ${newC.id}`);
  }
});

// Roles
client.on(Events.GuildRoleCreate, async role => {
  const entry = await findExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
  sendLog(role.guild, 'roleCreate', '🆕 ROLE CREATED', `**Role:** ${role.name}\n**Created by:** ${entry?.executor?.tag || 'Unknown'}`);
});
client.on(Events.GuildRoleDelete, async role => {
  const entry = await findExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
  sendLog(role.guild, 'roleDelete', '🗑️ ROLE DELETED', `**Role:** ${role.name}\n**Deleted by:** ${entry?.executor?.tag || 'Unknown'}`);
});
client.on(Events.GuildRoleUpdate, (oldR, newR) => {
  const changes = [];
  if (oldR.name !== newR.name) changes.push(`Name: ${oldR.name} → ${newR.name}`);
  if (oldR.hexColor !== newR.hexColor) changes.push('Color changed');
  if (oldR.permissions.bitfield !== newR.permissions.bitfield) changes.push('Permissions changed');
  if (oldR.hoist !== newR.hoist) changes.push('Hoist setting changed');
  if (oldR.mentionable !== newR.mentionable) changes.push('Mentionable setting changed');
  if (changes.length) sendLog(newR.guild, 'roleUpdate', '⚙️ ROLE UPDATED', `**Role:** <@&${newR.id}>\n${changes.join('\n')}`);
});

// Invites, emojis, webhooks
client.on(Events.InviteCreate, invite => {
  if (invite.guild) sendLog(invite.guild, 'inviteCreate', '🔗 INVITE CREATED',
    `**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'}\n**Creator:** ${invite.inviter?.tag || 'Unknown'}`);
});
client.on(Events.InviteDelete, invite => {
  if (invite.guild) sendLog(invite.guild, 'inviteDelete', '❌ INVITE DELETED', `**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'}`);
});
client.on(Events.GuildEmojiUpdate, (oldEmojis, newEmojis) => {
  const guild = newEmojis.first()?.guild || oldEmojis.first()?.guild;
  if (!guild) return;
  const added = newEmojis.filter(e => !oldEmojis.has(e.id));
  const removed = oldEmojis.filter(e => !newEmojis.has(e.id));
  sendLog(guild, 'emojiUpdate', '😀 SERVER EMOJIS UPDATED',
    `**Added:** ${added.map(e => e.name).join(', ') || 'None'}\n**Removed:** ${removed.map(e => e.name).join(', ') || 'None'}`);
});
client.on(Events.WebhooksUpdate, channel => {
  if (channel.guild) sendLog(channel.guild, 'webhookUpdate', '🪝 WEBHOOK UPDATED', `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`);
});

// Server
client.on(Events.GuildUpdate, (oldG, newG) => {
  const changes = [];
  if (oldG.name !== newG.name) changes.push(`Name: ${oldG.name} → ${newG.name}`);
  if (oldG.icon !== newG.icon) changes.push('Server icon changed');
  if (oldG.banner !== newG.banner) changes.push('Server banner changed');
  if (oldG.description !== newG.description) changes.push('Server description changed');
  if (changes.length) sendLog(newG, 'serverUpdate', '🌐 SERVER UPDATED', changes.join('\n'),
    { guildImage: newG.iconURL({ size: 512 }), image: newG.bannerURL({ size: 1024 }) });
});

// Small HTTP endpoint for hosts that expect a listening port.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('PW VENOM LOG is running');
});
server.listen(PORT, '0.0.0.0', () => console.log(`HTTP server listening on ${PORT}`));

client.on(Events.Error, error => console.error('Discord client error:', error));
process.on('unhandledRejection', error => console.error('Unhandled rejection:', error));
process.on('uncaughtException', error => console.error('Uncaught exception:', error));

(async () => {
  try {
    await registerCommands();
    await client.login(TOKEN);
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
})();

function shutdown() {
  console.log('Shutting down PW VENOM LOG...');
  server.close();
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
{
  "name": "pw-venom-log",
  "version": "2.0.0",
  "private": true,
  "description": "PW VENOM LOG - Discord server logging bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "engines": {
    "node": ">=18.17.0"
  },
  "dependencies": {
    "discord.js": "^14.19.3"
  }
}
