// PW VENOM LOG — Discord.js v14 // One logging channel per event.
Configure DISCORD_TOKEN and CLIENT_ID // (and optionally GUILD_ID) in
your hosting provider’s Environment settings.

‘use strict’;

const { Client, GatewayIntentBits, Partials, REST, Routes,
SlashCommandBuilder, ChannelType, ChannelSelectMenuBuilder,
EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder,
ButtonStyle, PermissionFlagsBits, Events } = require(‘discord.js’);
const fs = require(‘node:fs’); const path = require(‘node:path’); const
http = require(‘node:http’);

const TOKEN = process.env.DISCORD_TOKEN; const CLIENT_ID =
process.env.CLIENT_ID; const GUILD_ID = process.env.GUILD_ID || null;
const PORT = Number(process.env.PORT) || 10000; const CONFIG_FILE =
path.join(__dirname, ‘pw-venom-config.json’); const PANEL_IMAGE_URL =
‘https://cdn.discordapp.com/attachments/1566140735235817593/1567243375407534160/lv_0_20261026164646.gif’;

if (!TOKEN || !CLIENT_ID) { console.error(‘Missing DISCORD_TOKEN or
CLIENT_ID environment variable.’); process.exit(1); }

const CATEGORIES = { members: { name: ‘Members’, description: ‘Member
logs’, emoji: ‘👥’, events:
[‘memberJoin’,‘memberLeave’,‘memberKick’,‘nicknameUpdate’,‘memberRoles’]
}, messages: { name: ‘Messages’, description: ‘Message logs’, emoji:
‘💬’, events:
[‘messageDelete’,‘messageEdit’,‘messagePin’,‘messageUnpin’,‘reactionAdd’,‘reactionRemove’]
}, voice: { name: ‘Voice’, description: ‘Voice logs’, emoji: ‘🔊’,
events: [‘voiceJoin’,‘voiceLeave’,‘voiceMove’,‘voiceMute’,‘voiceDeafen’]
}, serverActions: { name: ‘Server Actions’, description: ‘Server action
logs’, emoji: ‘🌐’, events:
[‘inviteCreate’,‘inviteDelete’,‘emojiUpdate’,‘webhookUpdate’] },
channels: { name: ‘Channels’, description: ‘Channel logs’, emoji: ‘📁’,
events: [‘channelCreate’,‘channelDelete’,‘channelUpdate’,‘channelPerms’]
}, serverEvents: { name: ‘Server Events’, description: ‘Server updates’,
emoji: ‘⚙️’, events: [‘serverUpdate’] }, roles: { name: ‘Roles’,
description: ‘Role logs’, emoji: ‘🛡️’, events:
[‘roleCreate’,‘roleDelete’,‘roleUpdate’] }, modLogs: { name: ‘Mod Logs’,
description: ‘Moderation logs’, emoji: ‘🔨’, events:
[‘ban’,‘unban’,‘timeout’,‘timeoutRemoved’] } };

const EVENTS = { memberJoin:‘Member Join’, memberLeave:‘Member Leave’,
memberKick:‘Member Kick’, nicknameUpdate:‘Nickname Update’,
memberRoles:‘Member Roles Updated’, messageDelete:‘Message Delete’,
messageEdit:‘Message Edit’, messagePin:‘Message Pinned’,
messageUnpin:‘Message Unpinned’, reactionAdd:‘Reaction Added’,
reactionRemove:‘Reaction Removed’, voiceJoin:‘Voice Join’,
voiceLeave:‘Voice Leave’, voiceMove:‘Voice Move’, voiceMute:‘Voice
Mute’, voiceDeafen:‘Voice Deafen’, inviteCreate:‘Invite Created’,
inviteDelete:‘Invite Deleted’, emojiUpdate:‘Emoji Updated’,
webhookUpdate:‘Webhook Updated’, channelCreate:‘Channel Create’,
channelDelete:‘Channel Delete’, channelUpdate:‘Channel Update’,
channelPerms:‘Channel Permissions’, serverUpdate:‘Server Update’,
roleCreate:‘Role Create’, roleDelete:‘Role Delete’, roleUpdate:‘Role
Update’, ban:‘Ban’, unban:‘Unban’, timeout:‘Timeout’,
timeoutRemoved:‘Timeout Removed’ };

const EVENT_EMOJIS = { memberJoin:‘🟢’, memberLeave:‘🔴’,
memberKick:‘👢’, nicknameUpdate:‘✏️’, memberRoles:‘🛡️’,
messageDelete:‘🗑️’, messageEdit:‘📝’, messagePin:‘📌’,
messageUnpin:‘📍’, reactionAdd:‘😀’, reactionRemove:‘➖’,
voiceJoin:‘🔊’, voiceLeave:‘🔇’, voiceMove:‘🔁’, voiceMute:‘🎙️’,
voiceDeafen:‘🔕’, inviteCreate:‘🔗’, inviteDelete:‘❌’,
emojiUpdate:‘😀’, webhookUpdate:‘🪝’, channelCreate:‘📁’,
channelDelete:‘🗑️’, channelUpdate:‘⚙️’, channelPerms:‘🔐’,
serverUpdate:‘🌐’, roleCreate:‘🆕’, roleDelete:‘❌’, roleUpdate:‘🛠️’,
ban:‘🔨’, unban:‘🔓’, timeout:‘⏳’, timeoutRemoved:‘✅’ };

function loadConfig() { try { if (!fs.existsSync(CONFIG_FILE)) return
{}; const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, ‘utf8’));
return parsed && typeof parsed === ‘object’ ? parsed : {}; } catch
(error) { console.error(‘Could not read config:’, error); return {}; } }
const config = loadConfig(); const panelData = new Map(); const
pendingConfirmations = new Map();

function saveConfig() { const tempFile = ${CONFIG_FILE}.tmp;
fs.writeFileSync(tempFile, JSON.stringify(config, null, 2), ‘utf8’);
fs.renameSync(tempFile, CONFIG_FILE); }

const client = new Client({ intents: [ GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration,
GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildWebhooks,
GatewayIntentBits.GuildInvites, GatewayIntentBits.GuildMessageReactions
], partials: [Partials.Message, Partials.Channel, Partials.GuildMember,
Partials.User, Partials.Reaction] });

const commands = [ new
SlashCommandBuilder().setName(‘logpanel’).setDescription(‘Open PW VENOM
LOG settings
panel’).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName(‘loginfo’).setDescription(‘Show
configured log
channels’).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName(‘logtest’).setDescription(‘Send a test
log’).addStringOption(option =>
option.setName(‘event’).setDescription(‘Choose an
event’).setRequired(true).setAutocomplete(true)
).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)].map(command
=> command.toJSON());

async function registerCommands() { const rest = new REST({ version:
‘10’ }).setToken(TOKEN); const route = GUILD_ID ?
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) :
Routes.applicationCommands(CLIENT_ID); await rest.put(route, { body:
commands });
console.log(Slash commands registered${GUILD_ID ? ' for guild' : ' globally'}.);
}

async function sendLog(guild, event, title, description) { const
configured = config[guild.id]?.[event]; const channelId =
Array.isArray(configured) ? configured[0] : configured; if (!channelId)
return false;

const channel = await guild.channels.fetch(channelId).catch(() => null);
if (!channel?.isTextBased() || !channel.guild) return false;

const embed = new EmbedBuilder() .setColor(0x168CFF) .setTitle(title)
.setDescription(String(description || ‘No details available.’).slice(0,
4000)) .setTimestamp() .setFooter({ text: ‘PW VENOM LOG SYSTEM’ });

try { await channel.send({ embeds: [embed] }); return true; } catch
(error) { console.error(Failed to send ${event} log:, error); return
false; } }

function panelKey(interaction) { return
${interaction.guildId}:${interaction.user.id}; }

function makePanelRows(data = {}) { const categoryMenu = new
StringSelectMenuBuilder() .setCustomId(‘pwlog_category’)
.setPlaceholder(‘📂 1. Select a category’)
.addOptions(Object.entries(CATEGORIES).map(([value, category]) => ({
label: category.name, description: category.description, value, emoji:
category.emoji })));

const eventList = data.category && CATEGORIES[data.category] ?
CATEGORIES[data.category].events : CATEGORIES.members.events;

const eventMenu = new StringSelectMenuBuilder()
.setCustomId(‘pwlog_event’) .setPlaceholder(‘📋 2. Select an event’)
.addOptions(eventList.map(event => ({ label: EVENTS[event], value:
event, emoji: EVENT_EMOJIS[event] })));

const channelMenu = new ChannelSelectMenuBuilder()
.setCustomId(‘pwlog_channel’) .setPlaceholder(‘📁 3. Select ONE logging
channel’) .setChannelTypes(ChannelType.GuildText) .setMinValues(1)
.setMaxValues(1);

const rows = [ new ActionRowBuilder().addComponents(categoryMenu), new
ActionRowBuilder().addComponents(eventMenu), new
ActionRowBuilder().addComponents(channelMenu) ];

if (data.category && data.event && data.channels?.length === 1) {
rows.push(new ActionRowBuilder().addComponents( new
ButtonBuilder().setCustomId(‘pwlog_save’).setLabel(‘SAVE’).setEmoji(‘💾’).setStyle(ButtonStyle.Success)
)); } return rows; }

function panelEmbed() { const embed = new EmbedBuilder()
.setColor(0x168CFF) .setTitle(‘💙 PW VENOM LOG’) .setDescription(
‘SERVER LOG SETTINGS’ + ‘📂 Select a category.’ + ‘📋 Select an
event.’ + ‘📁 Select exactly ONE destination channel.’ + ‘💾 Press SAVE,
then confirm with YES or cancel with NO.’ + ‘Each event sends its logs
to its selected channel.’ ) .setFooter({ text: ‘PW VENOM LOG SYSTEM’ });
if (PANEL_IMAGE_URL) embed.setImage(PANEL_IMAGE_URL); return embed; }

function confirmationRows() { return [new
ActionRowBuilder().addComponents( new
ButtonBuilder().setCustomId(‘pwlog_confirm_yes’).setLabel(‘YES,
SAVE’).setStyle(ButtonStyle.Success), new
ButtonBuilder().setCustomId(‘pwlog_confirm_no’).setLabel(‘NO,
CANCEL’).setStyle(ButtonStyle.Danger) )]; }

client.once(Events.ClientReady, readyClient => {
console.log(PW VENOM LOG ONLINE: ${readyClient.user.tag}); });

client.on(Events.InteractionCreate, async interaction => { try { if
(interaction.isAutocomplete() && interaction.commandName === ‘logtest’)
{ const search = interaction.options.getFocused().toLowerCase(); const
choices = Object.entries(EVENTS) .filter(([key, label]) =>
key.toLowerCase().includes(search) ||
label.toLowerCase().includes(search)) .slice(0, 25).map(([key, label])
=> ({ name: label, value: key })); return interaction.respond(choices);
}

    if (interaction.isChatInputCommand()) {
      if (!interaction.guild) {
        return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
      }

      if (interaction.commandName === 'logpanel') {
        const data = { category: null, event: null, channels: [] };
        panelData.set(panelKey(interaction), data);
        // Public message: remains visible in the channel after you leave Discord.
        return interaction.reply({ embeds: [panelEmbed()], components: makePanelRows(data), ephemeral: false });
      }

      if (interaction.commandName === 'loginfo') {
        const settings = config[interaction.guildId] || {};
        const lines = Object.entries(EVENTS).map(([key, label]) => {
          const saved = settings[key];
          const id = Array.isArray(saved) ? saved[0] : saved;
          return `${EVENT_EMOJIS[key]} **${label}:** ${id ? `<#${id}>` : 'Not configured'}`;
        });
        const embed = new EmbedBuilder().setColor(0x168CFF).setTitle('💙 PW VENOM LOG SETTINGS').setDescription(lines.join('\n')).setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.commandName === 'logtest') {
        const event = interaction.options.getString('event', true);
        const success = await sendLog(interaction.guild, event, '🧪 LOG TEST', `Test for **${EVENTS[event] || event}**`);
        return interaction.reply({
          content: success ? '✅ Test sent successfully!' : '❌ No channel configured or the bot lacks permissions.',
          ephemeral: true
        });
      }
    }

    if (!interaction.guild) return;
    const key = panelKey(interaction);
    const data = panelData.get(key);

    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_category') {
      if (!data) return interaction.reply({ content: 'Run /logpanel again.', ephemeral: true });
      data.category = interaction.values[0];
      data.event = null;
      data.channels = [];
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'pwlog_event') {
      if (!data?.category) return interaction.reply({ content: 'Select a category first.', ephemeral: true });
      const selected = interaction.values[0];
      if (!CATEGORIES[data.category].events.includes(selected)) {
        return interaction.reply({ content: 'Choose an event from the selected category.', ephemeral: true });
      }
      data.event = selected;
      data.channels = [];
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isChannelSelectMenu() && interaction.customId === 'pwlog_channel') {
      if (!data?.event) return interaction.reply({ content: 'Select a category and event first.', ephemeral: true });
      if (interaction.values.length !== 1) return interaction.reply({ content: 'Select exactly ONE channel.', ephemeral: true });
      data.channels = [interaction.values[0]];
      return interaction.update({ embeds: [panelEmbed()], components: makePanelRows(data), content: null });
    }

    if (interaction.isButton() && interaction.customId === 'pwlog_save') {
      if (!data?.category || !data.event || data.channels?.length !== 1) {
        return interaction.reply({ content: 'Complete all selections first. Select exactly ONE channel.', ephemeral: true });
      }

      const channelId = data.channels[0];
      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased() || !channel.guild) {
        return interaction.reply({ content: 'The selected channel is unavailable.', ephemeral: true });
      }

      const me = interaction.guild.members.me || await interaction.guild.members.fetchMe().catch(() => null);
      const permissions = me ? channel.permissionsFor(me) : null;
      if (!permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
      ])) {
        return interaction.reply({ content: `Missing View Channel, Send Messages, or Embed Links permission in <#${channelId}>.`, ephemeral: true });
      }

      pendingConfirmations.set(key, {
        event: data.event, channelId, expires: Date.now() + 60000
      });
      return interaction.update({
        content: `⚠️ **Confirm settings**\nEvent: **${EVENTS[data.event]}**\nChannel: <#${channelId}>`,
        components: confirmationRows()
      });
    }

    if (interaction.isButton() && ['pwlog_confirm_yes', 'pwlog_confirm_no'].includes(interaction.customId)) {
      const pending = pendingConfirmations.get(key);

      if (interaction.customId === 'pwlog_confirm_no') {
        pendingConfirmations.delete(key);
        return interaction.update({ content: '❌ Save cancelled. You can select again.', components: makePanelRows(data || {}) });
      }

      if (!pending || pending.expires < Date.now()) {
        pendingConfirmations.delete(key);
        return interaction.update({ content: '⌛ Confirmation expired. Run /logpanel again.', components: makePanelRows(data || {}) });
      }

      config[interaction.guildId] ??= {};
      config[interaction.guildId][pending.event] = pending.channelId;
      saveConfig();
      pendingConfirmations.delete(key);
      if (data) data.channels = [];
      return interaction.update({
        content: `✅ **SAVED SUCCESSFULLY**\nEvent: **${EVENTS[pending.event]}**\nChannel: <#${pending.channelId}>`,
        embeds: [panelEmbed()],
        components: makePanelRows(data || {})
      });
    }

} catch (error) { console.error(‘Interaction error:’, error); const
message = { content: ‘An error occurred. Check the hosting logs.’,
ephemeral: true }; if (interaction.deferred || interaction.replied) {
await interaction.followUp(message).catch(() => {}); } else { await
interaction.reply(message).catch(() => {}); } } });

// Member logs client.on(Events.GuildMemberAdd, member =>
sendLog(member.guild, ‘memberJoin’, ‘🟢 MEMBER JOINED’,
**Member:** ${member.user.tag}\n**ID:** ${member.id}\n**Account:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>));

client.on(Events.GuildMemberRemove, async member => { await
sendLog(member.guild, ‘memberLeave’, ‘🔴 MEMBER LEFT’,
**Member:** ${member.user?.tag || 'Unknown'}\n**ID:** ${member.id}); });

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => { if
(oldMember.nickname !== newMember.nickname) { await
sendLog(newMember.guild, ‘nicknameUpdate’, ‘✏️ NICKNAME UPDATED’,
**Member:** ${newMember.user.tag}\n**Old:** ${oldMember.nickname || 'None'}\n**New:** ${newMember.nickname || 'None'});
} const oldRoles = oldMember.roles.cache.map(role => role.id).sort();
const newRoles = newMember.roles.cache.map(role => role.id).sort(); if
(JSON.stringify(oldRoles) !== JSON.stringify(newRoles)) { await
sendLog(newMember.guild, ‘memberRoles’, ‘🛡️ MEMBER ROLES UPDATED’,
**Member:** ${newMember.user.tag}\n**Roles:** ${newMember.roles.cache.map(role => role.name).join(', ') || 'None'});
} const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
const newTimeout = newMember.communicationDisabledUntilTimestamp; if
(oldTimeout !== newTimeout) { await sendLog(newMember.guild, newTimeout
? ‘timeout’ : ‘timeoutRemoved’, newTimeout ? ‘⏳ MEMBER TIMED OUT’ : ‘✅
TIMEOUT REMOVED’,
**Member:** ${newMember.user.tag}\n**Until:** ${newTimeout ? new Date(newTimeout).toISOString() : 'Removed'});
} });

// Message logs client.on(Events.MessageDelete, async message => { if
(!message.guild || message.author?.bot) return; await
sendLog(message.guild, ‘messageDelete’, ‘🗑️ MESSAGE DELETED’,
**Author:** ${message.author?.tag || 'Unknown'}\n**Channel:** ${message.channel}\n**Content:** ${(message.content || 'Unavailable').slice(0, 1500)});
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => { if
(!newMessage.guild) return; if (oldMessage.partial) oldMessage = await
oldMessage.fetch().catch(() => oldMessage); if (newMessage.partial)
newMessage = await newMessage.fetch().catch(() => newMessage); if
(newMessage.author?.bot || oldMessage.content === newMessage.content)
return; await sendLog(newMessage.guild, ‘messageEdit’, ‘📝 MESSAGE
EDITED’,
**Author:** ${newMessage.author?.tag || 'Unknown'}\n**Channel:** ${newMessage.channel}\n**Before:** ${(oldMessage.content || 'Empty').slice(0, 1200)}\n**After:** ${(newMessage.content || 'Empty').slice(0, 1200)});
if (oldMessage.pinned !== newMessage.pinned) { await
sendLog(newMessage.guild, newMessage.pinned ? ‘messagePin’ :
‘messageUnpin’, newMessage.pinned ? ‘📌 MESSAGE PINNED’ : ‘📍 MESSAGE
UNPINNED’,
**Channel:** ${newMessage.channel}\n**Message ID:** ${newMessage.id}); }
});

// Reactions client.on(Events.MessageReactionAdd, async (reaction, user)
=> { if (user.bot) return; if (reaction.partial) reaction = await
reaction.fetch().catch(() => null); if (!reaction?.message.guild)
return; await sendLog(reaction.message.guild, ‘reactionAdd’, ‘😀
REACTION ADDED’,
**User:** ${user.tag}\n**Channel:** ${reaction.message.channel}\n**Emoji:** ${reaction.emoji});
}); client.on(Events.MessageReactionRemove, async (reaction, user) => {
if (user.bot) return; if (reaction.partial) reaction = await
reaction.fetch().catch(() => null); if (!reaction?.message.guild)
return; await sendLog(reaction.message.guild, ‘reactionRemove’, ‘➖
REACTION REMOVED’,
**User:** ${user.tag}\n**Channel:** ${reaction.message.channel}\n**Emoji:** ${reaction.emoji});
});

// Voice client.on(Events.VoiceStateUpdate, async (oldState, newState)
=> { const member = newState.member || oldState.member; if (!member)
return; const guild = member.guild; if (!oldState.channelId &&
newState.channelId) { await sendLog(guild, ‘voiceJoin’, ‘🔊 VOICE JOIN’,
**Member:** ${member.user.tag}\n**Channel:** ${newState.channel}); } if
(oldState.channelId && !newState.channelId) { await sendLog(guild,
‘voiceLeave’, ‘🔇 VOICE LEAVE’,
**Member:** ${member.user.tag}\n**Channel:** ${oldState.channel}); } if
(oldState.channelId && newState.channelId && oldState.channelId !==
newState.channelId) { await sendLog(guild, ‘voiceMove’, ‘🔁 VOICE MOVE’,
**Member:** ${member.user.tag}\n**From:** ${oldState.channel}\n**To:** ${newState.channel});
} if (oldState.serverMute !== newState.serverMute) { await
sendLog(guild, ‘voiceMute’, ‘🎙️ VOICE MUTE UPDATED’,
**Member:** ${member.user.tag}\n**Server Mute:** ${newState.serverMute});
} if (oldState.serverDeaf !== newState.serverDeaf) { await
sendLog(guild, ‘voiceDeafen’, ‘🔕 VOICE DEAFEN UPDATED’,
**Member:** ${member.user.tag}\n**Server Deaf:** ${newState.serverDeaf});
} });

// Channels client.on(Events.ChannelCreate, channel => { if
(channel.guild) return sendLog(channel.guild, ‘channelCreate’, ‘📁
CHANNEL CREATED’, **Channel:** ${channel}\n**Name:** ${channel.name});
}); client.on(Events.ChannelDelete, channel => { if (channel.guild)
return sendLog(channel.guild, ‘channelDelete’, ‘🗑️ CHANNEL DELETED’,
**Name:** ${channel.name}\n**ID:** ${channel.id}); });
client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => { if
(!newChannel.guild) return; if (oldChannel.name !== newChannel.name) {
await sendLog(newChannel.guild, ‘channelUpdate’, ‘⚙️ CHANNEL UPDATED’,
**Old Name:** ${oldChannel.name}\n**New Name:** ${newChannel.name}); }
if (oldChannel.permissionOverwrites?.cache &&
newChannel.permissionOverwrites?.cache &&
oldChannel.permissionOverwrites.cache.size !==
newChannel.permissionOverwrites.cache.size) { await
sendLog(newChannel.guild, ‘channelPerms’, ‘🔐 CHANNEL PERMISSIONS
UPDATED’, **Channel:** ${newChannel}\n**Name:** ${newChannel.name}); }
});

// Roles client.on(Events.GuildRoleCreate, role => sendLog(role.guild,
‘roleCreate’, ‘🆕 ROLE CREATED’,
**Role:** ${role.name}\n**ID:** ${role.id}));
client.on(Events.GuildRoleDelete, role => sendLog(role.guild,
‘roleDelete’, ‘❌ ROLE DELETED’,
**Role:** ${role.name}\n**ID:** ${role.id}));
client.on(Events.GuildRoleUpdate, (oldRole, newRole) => { if
(oldRole.name !== newRole.name || oldRole.color !== newRole.color ||
oldRole.permissions.bitfield !== newRole.permissions.bitfield) { return
sendLog(newRole.guild, ‘roleUpdate’, ‘🛠️ ROLE UPDATED’,
**Role:** ${newRole.name}\n**ID:** ${newRole.id}); } });

// Moderation client.on(Events.GuildBanAdd, ban => sendLog(ban.guild,
‘ban’, ‘🔨 MEMBER BANNED’,
**User:** ${ban.user.tag}\n**ID:** ${ban.user.id}\n**Reason:** ${ban.reason || 'Not provided'}));
client.on(Events.GuildBanRemove, ban => sendLog(ban.guild, ‘unban’, ‘🔓
MEMBER UNBANNED’, **User:** ${ban.user.tag}\n**ID:** ${ban.user.id}));

// Invites client.on(Events.InviteCreate, invite => { if (invite.guild)
return sendLog(invite.guild, ‘inviteCreate’, ‘🔗 INVITE CREATED’,
**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'});
}); client.on(Events.InviteDelete, invite => { if (invite.guild) return
sendLog(invite.guild, ‘inviteDelete’, ‘❌ INVITE DELETED’,
**Code:** ${invite.code}); });

// Server changes client.on(Events.GuildUpdate, (oldGuild, newGuild) =>
{ if (oldGuild.name !== newGuild.name || oldGuild.icon !== newGuild.icon
|| oldGuild.description !== newGuild.description) { return
sendLog(newGuild, ‘serverUpdate’, ‘🌐 SERVER UPDATED’,
**Old Name:** ${oldGuild.name}\n**New Name:** ${newGuild.name}); } });
client.on(Events.GuildEmojisUpdate, async (oldEmojis, newEmojis) => {
const guild = newEmojis.first()?.guild || oldEmojis.first()?.guild; if
(guild) await sendLog(guild, ‘emojiUpdate’, ‘😀 EMOJIS UPDATED’, ‘The
server emoji list has changed.’); }); client.on(Events.WebhooksUpdate,
channel => { if (channel.guild) return sendLog(channel.guild,
‘webhookUpdate’, ‘🪝 WEBHOOK UPDATED’, **Channel:** ${channel}); });

// Simple HTTP endpoint for Render web service health checks const
server = http.createServer((req, res) => { res.writeHead(200, {
‘Content-Type’: ‘text/plain; charset=utf-8’ }); res.end(‘PW VENOM LOG is
running!’); }); server.listen(PORT, ‘0.0.0.0’, () =>
console.log(HTTP server listening on ${PORT}));

async function startBot() { try { await registerCommands(); await
client.login(TOKEN); } catch (error) { console.error(‘Bot startup
error:’, error); process.exit(1); } } startBot();

process.on(‘unhandledRejection’, error => console.error(‘Unhandled
rejection:’, error)); process.on(‘uncaughtException’, error => {
console.error(‘Uncaught exception:’, error); process.exit(1); });
