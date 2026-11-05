// PW VENOM LOG — Discord.js v14

'use strict';

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
AuditLogEvent,
Events
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;
const PORT = Number(process.env.PORT) || 10000;

const CONFIG_FILE = path.join(
__dirname,
'pw-venom-config.json'
);

const PANEL_IMAGE_URL = 'https://cdn.discordapp.com/attachments/1566140735235817593/1567243375407534160/lv_0_20261026164646.gif';

if (!TOKEN || !CLIENT_ID) {
console.error('Missing DISCORD_TOKEN or CLIENT_ID');
process.exit(1);
}

const CATEGORIES = {
members: {
name: 'Members',
description: 'Member logs',
emoji: '👥',
events: [
'memberJoin',
'memberLeave',
'memberKick',
'nicknameUpdate',
'memberRoles'
]
},

messages: {
name: 'Messages',
description: 'Message logs',
emoji: '💬',
events: [
'messageDelete',
'messageEdit',
'messagePin',
'messageUnpin',
'reactionAdd',
'reactionRemove'
]
},

voice: {
name: 'Voice',
description: 'Voice logs',
emoji: '🔊',
events: [
'voiceJoin',
'voiceLeave',
'voiceMove',
'voiceMute',
'voiceDeafen'
]
},

serverActions: {
name: 'Server Actions',
description: 'Server action logs',
emoji: '🌐',
events: [
'inviteCreate',
'inviteDelete',
'emojiUpdate',
'webhookUpdate'
]
},

channels: {
name: 'Channels',
description: 'Channel logs',
emoji: '📁',
events: [
'channelCreate',
'channelDelete',
'channelUpdate',
'channelPerms'
]
},

serverEvents: {
name: 'Server Events',
description: 'Server updates',
emoji: '⚙️',
events: ['serverUpdate']
},

roles: {
name: 'Roles',
description: 'Role logs',
emoji: '🛡️',
events: [
'roleCreate',
'roleDelete',
'roleUpdate'
]
},

modLogs: {
name: 'Mod Logs',
description: 'Moderation logs',
emoji: '🔨',
events: [
'ban',
'unban',
'timeout',
'timeoutRemoved'
]
}
};

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

function loadConfig() {
try {
if (!fs.existsSync(CONFIG_FILE)) return {};

const data = JSON.parse(  
  fs.readFileSync(CONFIG_FILE, 'utf8')  
);  

return data || {};

} catch (error) {
console.error(error);
return {};
}
}

const config = loadConfig();

const panelData = new Map();
const pendingConfirmations = new Map();

function saveConfig() {
const temp = CONFIG_FILE + '.tmp';

fs.writeFileSync(
temp,
JSON.stringify(config, null, 2),
'utf8'
);

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

partials: [
Partials.Message,
Partials.Channel,
Partials.GuildMember,
Partials.User,
Partials.Reaction
]
});
// ===============================
// SLASH COMMANDS
// ===============================

const commands = [
new SlashCommandBuilder()
.setName('logpanel')
.setDescription('Open PW VENOM LOG panel')
.setDefaultMemberPermissions(
PermissionFlagsBits.ManageGuild
),

new SlashCommandBuilder()
.setName('loginfo')
.setDescription('Show log settings')
.setDefaultMemberPermissions(
PermissionFlagsBits.ManageGuild
),

new SlashCommandBuilder()
.setName('logtest')
.setDescription('Test a log event')
.addStringOption(option =>
option
.setName('event')
.setDescription('Choose an event')
.setRequired(true)
.setAutocomplete(true)
)
.setDefaultMemberPermissions(
PermissionFlagsBits.ManageGuild
)
].map(command => command.toJSON());

async function registerCommands() {
const rest = new REST({ version: '10' })
.setToken(TOKEN);

const route = GUILD_ID
? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
: Routes.applicationCommands(CLIENT_ID);

await rest.put(route, { body: commands });

console.log('Slash commands registered!');
}

// ===============================
// LOG SYSTEM
// ===============================

async function sendLog(guild, event, title, description) {
const configured = config[guild.id]?.[event];

const channelIds = Array.isArray(configured)
? configured
: configured ? [configured] : [];

if (!channelIds.length) return false;

const embed = new EmbedBuilder()
.setColor(0x168CFF)
.setTitle(title)
.setDescription(description || 'No details available.')
.setTimestamp()
.setFooter({
text: 'PW VENOM LOG SYSTEM'
});

const results = await Promise.all(
channelIds.slice(0, 3).map(async channelId => {
const channel = await guild.channels
.fetch(channelId)
.catch(() => null);

if (!channel || !channel.isTextBased()) {  
    return false;  
  }  

  try {  
    await channel.send({  
      embeds: [embed]  
    });  

    return true;  
  } catch (error) {  
    console.error(error);  
    return false;  
  }  
})

);

return results.some(Boolean);
}

// ===============================
// PANEL SYSTEM
// ===============================

function panelKey(interaction) {
return ${interaction.guildId}:${interaction.user.id};
}

function makePanelRows(data = {}) {

const categoryMenu = new StringSelectMenuBuilder()
.setCustomId('pwlog_category')
.setPlaceholder('📂 1. Select a category')
.addOptions(
Object.entries(CATEGORIES).map(([value, category]) => ({
label: category.name,
description: category.description,
value,
emoji: category.emoji
}))
);

const eventList = data.category
? CATEGORIES[data.category].events
: CATEGORIES.members.events;

const eventMenu = new StringSelectMenuBuilder()
.setCustomId('pwlog_event')
.setPlaceholder('📋 2. Select an event')
.addOptions(
eventList.map(event => ({
label: EVENTS[event],
value: event,
emoji: EVENT_EMOJIS[event]
}))
);

const channelMenu = new ChannelSelectMenuBuilder()
.setCustomId('pwlog_channel')
.setPlaceholder('📁 3. Select exactly 3 channels')
.setChannelTypes(ChannelType.GuildText)
.setMinValues(3)
.setMaxValues(3);

const rows = [
new ActionRowBuilder().addComponents(categoryMenu),
new ActionRowBuilder().addComponents(eventMenu),
new ActionRowBuilder().addComponents(channelMenu)
];

if (data.event && data.channels?.length === 3) {
rows.push(
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('pwlog_save')
.setLabel('SAVE')
.setEmoji('💾')
.setStyle(ButtonStyle.Success)
)
);
}

return rows;
}

function panelEmbed() {
const embed = new EmbedBuilder()
.setColor(0x168CFF)
.setTitle('💙 PW VENOM LOG')
.setDescription(
'SERVER LOG SETTINGS\n\n' +
'📂 Select a category.\n' +
'📋 Select an event.\n' +
'📁 Select exactly 3 channels.\n' +
'💾 Press SAVE and confirm.\n\n' +
'Each event sends logs to 3 channels.'
)
.setFooter({
text: 'PW VENOM LOG SYSTEM'
});

if (PANEL_IMAGE_URL) {
embed.setImage(PANEL_IMAGE_URL);
}

return embed;
}

function confirmationRows() {
return [
new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId('pwlog_confirm_yes')
.setLabel('YES, SAVE')
.setStyle(ButtonStyle.Success),

new ButtonBuilder()  
    .setCustomId('pwlog_confirm_no')  
    .setLabel('NO, CANCEL')  
    .setStyle(ButtonStyle.Danger)  
)

];
}

// ===============================
// READY EVENT
// ===============================

client.once(Events.ClientReady, readyClient => {
console.log(
PW VENOM LOG ONLINE: ${readyClient.user.tag}
);
});

// ===============================
// INTERACTIONS
// ===============================

client.on(Events.InteractionCreate, async interaction => {

try {

// AUTOCOMPLETE  
if (  
  interaction.isAutocomplete() &&  
  interaction.commandName === 'logtest'  
) {  
  const search = interaction.options  
    .getFocused()  
    .toLowerCase();  

  const choices = Object.entries(EVENTS)  
    .filter(([key, label]) =>  
      key.toLowerCase().includes(search) ||  
      label.toLowerCase().includes(search)  
    )  
    .slice(0, 25)  
    .map(([key, label]) => ({  
      name: label,  
      value: key  
    }));  

  return interaction.respond(choices);  
}  


// SLASH COMMANDS  
if (interaction.isChatInputCommand()) {  

  if (!interaction.guild) {  
    return interaction.reply({  
      content: 'Use this command inside a server.',  
      ephemeral: true  
    });  
  }  

  if (interaction.commandName === 'logpanel') {  

    const data = {  
      category: null,  
      event: null,  
      channels: []  
    };  

    panelData.set(panelKey(interaction), data);  

    return interaction.reply({  
      embeds: [panelEmbed()],  
      components: makePanelRows(data),  
      ephemeral: true  
    });  
  }  


  if (interaction.commandName === 'loginfo') {  

    const settings = config[interaction.guildId] || {};  

    const lines = Object.entries(EVENTS).map(([key, label]) => {  

      const ids = Array.isArray(settings[key])  
        ? settings[key]  
        : settings[key] ? [settings[key]] : [];  

      return `${EVENT_EMOJIS[key]} **${label}:** ${  
        ids.length  
          ? ids.map(id => `<#${id}>`).join(' • ')  
          : 'Not configured'  
      }`;  
    });  

    const embed = new EmbedBuilder()  
      .setColor(0x168CFF)  
      .setTitle('💙 PW VENOM LOG SETTINGS')  
      .setDescription(lines.join('\n'))  
      .setTimestamp();  

    return interaction.reply({  
      embeds: [embed],  
      ephemeral: true  
    });  
  }  


  if (interaction.commandName === 'logtest') {  

    const event = interaction.options  
      .getString('event', true);  

    const success = await sendLog(  
      interaction.guild,  
      event,  
      '🧪 LOG TEST',  
      `Test for **${EVENTS[event]}**`  
    );  

    return interaction.reply({  
      content: success  
        ? '✅ Test sent successfully!'  
        : '❌ No channels configured or permissions missing.',  
      ephemeral: true  
    });  
  }  
}  


if (!interaction.guild) return;  

const key = panelKey(interaction);  
const data = panelData.get(key);  


// CATEGORY SELECT  
if (  
  interaction.isStringSelectMenu() &&  
  interaction.customId === 'pwlog_category'  
) {  

  if (!data) {  
    return interaction.reply({  
      content: 'Run /logpanel again.',  
      ephemeral: true  
    });  
  }  

  data.category = interaction.values[0];  
  data.event = null;  
  data.channels = [];  

  return interaction.update({  
    embeds: [panelEmbed()],  
    components: makePanelRows(data),  
    content: null  
  });  
}  


// EVENT SELECT  
if (  
  interaction.isStringSelectMenu() &&  
  interaction.customId === 'pwlog_event'  
) {  

  if (!data || !data.category) {  
    return interaction.reply({  
      content: 'Select a category first.',  
      ephemeral: true  
    });  
  }  

  const selected = interaction.values[0];  

  if (!CATEGORIES[data.category].events.includes(selected)) {  
    return interaction.reply({  
      content: 'Choose an event from the selected category.',  
      ephemeral: true  
    });  
  }  

  data.event = selected;  
  data.channels = [];  

  return interaction.update({  
    embeds: [panelEmbed()],  
    components: makePanelRows(data),  
    content: null  
  });  
}  


// CHANNEL SELECT  
if (  
  interaction.isChannelSelectMenu() &&  
  interaction.customId === 'pwlog_channel'  
) {  

  if (!data?.event) {  
    return interaction.reply({  
      content: 'Select a category and event first.',  
      ephemeral: true  
    });  
  }  

  if (interaction.values.length !== 3) {  
    return interaction.reply({  
      content: 'Select exactly 3 channels.',  
      ephemeral: true  
    });  
  }  

  data.channels = interaction.values;  

  return interaction.update({  
    embeds: [panelEmbed()],  
    components: makePanelRows(data),  
    content: null  
  });  
}  


// SAVE BUTTON  
if (  
  interaction.isButton() &&  
  interaction.customId === 'pwlog_save'  
) {  

  if (  
    !data?.event ||  
    !data.category ||  
    data.channels?.length !== 3  
  ) {  
    return interaction.reply({  
      content: 'Complete all selections first.',  
      ephemeral: true  
    });  
  }  

  for (const channelId of data.channels) {  

    const channel = await interaction.guild.channels  
      .fetch(channelId)  
      .catch(() => null);  

    if (!channel?.isTextBased()) {  
      return interaction.reply({  
        content: `Channel <#${channelId}> is unavailable.`,  
        ephemeral: true  
      });  
    }  

    const permissions = channel.permissionsFor(  
      interaction.guild.members.me  
    );  

    if (!permissions?.has([  
      PermissionFlagsBits.ViewChannel,  
      PermissionFlagsBits.SendMessages,  
      PermissionFlagsBits.EmbedLinks  
    ])) {  
      return interaction.reply({  
        content: `Missing permissions in <#${channelId}>.`,  
        ephemeral: true  
      });  
    }  
  }  

  pendingConfirmations.set(key, {  
    event: data.event,  
    channels: data.channels,  
    expires: Date.now() + 60000  
  });  

  return interaction.update({  
    content:  
      `⚠️ **Confirm settings**\n` +  
      `Event: **${EVENTS[data.event]}**\n` +  
      `Channels:\n${data.channels.map(id => `<#${id}>`).join('\n')}`,  
    components: confirmationRows()  
  });  
}  


// CONFIRM OR CANCEL  
if (  
  interaction.isButton() &&  
  [  
    'pwlog_confirm_yes',  
    'pwlog_confirm_no'  
  ].includes(interaction.customId)  
) {  

  const pending = pendingConfirmations.get(key);  

  if (interaction.customId === 'pwlog_confirm_no') {  

    pendingConfirmations.delete(key);  

    return interaction.update({  
      content: '❌ Save cancelled.',  
      components: makePanelRows(data || {})  
    });  
  }  

  if (!pending || pending.expires < Date.now()) {  

    pendingConfirmations.delete(key);  

    return interaction.update({  
      content: '⌛ Confirmation expired. Start again.',  
      components: makePanelRows(data || {})  
    });  
  }  

  config[interaction.guildId] ??= {};  

  config[interaction.guildId][pending.event] =  
    pending.channels.slice(0, 3);  

  saveConfig();  

  pendingConfirmations.delete(key);  

  data.event = null;  
  data.channels = [];  

  return interaction.update({  
    content:  
      `✅ **SAVED SUCCESSFULLY**\n` +  
      `Event: **${EVENTS[pending.event]}**\n` +  
      `Channels:\n${pending.channels.map(id => `<#${id}>`).join('\n')}`,  
    embeds: [panelEmbed()],  
    components: makePanelRows(data)  
  });  
}

} catch (error) {

console.error('Interaction error:', error);  

if (!interaction.replied && !interaction.deferred) {  
  await interaction.reply({  
    content: 'An error occurred. Check the bot logs.',  
    ephemeral: true  
  }).catch(() => {});  
}

}
});
// =====================================
// MEMBER EVENTS
// =====================================

client.on(Events.GuildMemberAdd, async member => {
await sendLog(
member.guild,
'memberJoin',
'🟢 MEMBER JOINED',
**Member:** ${member.user.tag}\n**ID:** ${member.id}\n**Account:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>
);
});

client.on(Events.GuildMemberRemove, async member => {
await sendLog(
member.guild,
'memberLeave',
'🔴 MEMBER LEFT',
**Member:** ${member.user.tag}\n**ID:** ${member.id}
);
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
if (oldMember.nickname !== newMember.nickname) {
await sendLog(
newMember.guild,
'nicknameUpdate',
'✏️ NICKNAME UPDATED',
**Member:** ${newMember.user.tag}\n**Old:** ${oldMember.nickname || 'None'}\n**New:** ${newMember.nickname || 'None'}
);
}

const oldRoles = oldMember.roles.cache.map(r => r.id);
const newRoles = newMember.roles.cache.map(r => r.id);

if (JSON.stringify(oldRoles.sort()) !== JSON.stringify(newRoles.sort())) {
await sendLog(
newMember.guild,
'memberRoles',
'🛡️ MEMBER ROLES UPDATED',
**Member:** ${newMember.user.tag}\n**Roles:** ${newMember.roles.cache.map(r => r.name).join(', ') || 'None'}
);
}

const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
const newTimeout = newMember.communicationDisabledUntilTimestamp;

if (oldTimeout !== newTimeout) {
await sendLog(
newMember.guild,
newTimeout ? 'timeout' : 'timeoutRemoved',
newTimeout ? '⏳ MEMBER TIMED OUT' : '✅ TIMEOUT REMOVED',
**Member:** ${newMember.user.tag}\n**Until:** ${newTimeout ? new Date(newTimeout).toISOString() : 'Removed'}
);
}
});

// =====================================
// MESSAGE EVENTS
// =====================================

client.on(Events.MessageDelete, async message => {
if (!message.guild || message.author?.bot) return;

await sendLog(
message.guild,
'messageDelete',
'🗑️ MESSAGE DELETED',
**Author:** ${message.author?.tag || 'Unknown'}\n**Channel:** ${message.channel}\n**Content:** ${(message.content || 'Unavailable').slice(0, 1500)}
);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
if (!newMessage.guild) return;

if (oldMessage.partial || newMessage.partial) {
await Promise.all([
oldMessage.fetch().catch(() => null),
newMessage.fetch().catch(() => null)
]);
}

if (newMessage.author?.bot) return;

if (oldMessage.content !== newMessage.content) {
await sendLog(
newMessage.guild,
'messageEdit',
'📝 MESSAGE EDITED',
**Author:** ${newMessage.author?.tag || 'Unknown'}\n**Channel:** ${newMessage.channel}\n**Before:** ${(oldMessage.content || 'Empty').slice(0, 1200)}\n**After:** ${(newMessage.content || 'Empty').slice(0, 1200)}
);
}

if (oldMessage.pinned !== newMessage.pinned) {
await sendLog(
newMessage.guild,
newMessage.pinned ? 'messagePin' : 'messageUnpin',
newMessage.pinned ? '📌 MESSAGE PINNED' : '📍 MESSAGE UNPINNED',
**Author:** ${newMessage.author?.tag || 'Unknown'}\n**Channel:** ${newMessage.channel}\n**Message ID:** ${newMessage.id}
);
}
});

// =====================================
// REACTION EVENTS
// =====================================

client.on(Events.MessageReactionAdd, async (reaction, user) => {
if (user.bot) return;

if (reaction.partial) {
reaction = await reaction.fetch().catch(() => null);
if (!reaction) return;
}

if (!reaction.message.guild) return;

await sendLog(
reaction.message.guild,
'reactionAdd',
'😀 REACTION ADDED',
**User:** ${user.tag}\n**Channel:** ${reaction.message.channel}\n**Emoji:** ${reaction.emoji}
);
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
if (user.bot) return;

if (reaction.partial) {
reaction = await reaction.fetch().catch(() => null);
if (!reaction) return;
}

if (!reaction.message.guild) return;

await sendLog(
reaction.message.guild,
'reactionRemove',
'➖ REACTION REMOVED',
**User:** ${user.tag}\n**Channel:** ${reaction.message.channel}\n**Emoji:** ${reaction.emoji}
);
});

// =====================================
// VOICE EVENTS
// =====================================

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
const member = newState.member || oldState.member;
if (!member) return;

const guild = member.guild;

if (!oldState.channelId && newState.channelId) {
await sendLog(
guild,
'voiceJoin',
'🔊 VOICE JOIN',
**Member:** ${member.user.tag}\n**Channel:** ${newState.channel}
);
}

if (oldState.channelId && !newState.channelId) {
await sendLog(
guild,
'voiceLeave',
'🔇 VOICE LEAVE',
**Member:** ${member.user.tag}\n**Channel:** ${oldState.channel}
);
}

if (
oldState.channelId &&
newState.channelId &&
oldState.channelId !== newState.channelId
) {
await sendLog(
guild,
'voiceMove',
'🔁 VOICE MOVE',
**Member:** ${member.user.tag}\n**From:** ${oldState.channel}\n**To:** ${newState.channel}
);
}

if (oldState.serverMute !== newState.serverMute) {
await sendLog(
guild,
'voiceMute',
'🎙️ VOICE MUTE UPDATED',
**Member:** ${member.user.tag}\n**Server Mute:** ${newState.serverMute}
);
}

if (oldState.serverDeaf !== newState.serverDeaf) {
await sendLog(
guild,
'voiceDeafen',
'🔕 VOICE DEAFEN UPDATED',
**Member:** ${member.user.tag}\n**Server Deaf:** ${newState.serverDeaf}
);
}
});

// =====================================
// CHANNEL EVENTS
// =====================================

client.on(Events.ChannelCreate, async channel => {
if (!channel.guild) return;

await sendLog(
channel.guild,
'channelCreate',
'📁 CHANNEL CREATED',
**Channel:** ${channel}\n**Name:** ${channel.name}
);
});

client.on(Events.ChannelDelete, async channel => {
if (!channel.guild) return;

await sendLog(
channel.guild,
'channelDelete',
'🗑️ CHANNEL DELETED',
**Name:** ${channel.name}\n**ID:** ${channel.id}
);
});

client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
if (!newChannel.guild) return;

if (oldChannel.name !== newChannel.name) {
await sendLog(
newChannel.guild,
'channelUpdate',
'⚙️ CHANNEL UPDATED',
**Old Name:** ${oldChannel.name}\n**New Name:** ${newChannel.name}
);
}

if (
oldChannel.permissionOverwrites.cache.size !==
newChannel.permissionOverwrites.cache.size
) {
await sendLog(
newChannel.guild,
'channelPerms',
'🔐 CHANNEL PERMISSIONS UPDATED',
**Channel:** ${newChannel}\n**Name:** ${newChannel.name}
);
}
});

// =====================================
// ROLE EVENTS
// =====================================

client.on(Events.GuildRoleCreate, async role => {
await sendLog(
role.guild,
'roleCreate',
'🆕 ROLE CREATED',
**Role:** ${role.name}\n**ID:** ${role.id}
);
});

client.on(Events.GuildRoleDelete, async role => {
await sendLog(
role.guild,
'roleDelete',
'❌ ROLE DELETED',
**Role:** ${role.name}\n**ID:** ${role.id}
);
});

client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
if (oldRole.name !== newRole.name ||
oldRole.color !== newRole.color ||
oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
await sendLog(
newRole.guild,
'roleUpdate',
'🛠️ ROLE UPDATED',
**Role:** ${newRole.name}\n**ID:** ${newRole.id}
);
}
});

// =====================================
// MODERATION EVENTS
// =====================================

client.on(Events.GuildBanAdd, async ban => {
await sendLog(
ban.guild,
'ban',
'🔨 MEMBER BANNED',
**User:** ${ban.user.tag}\n**ID:** ${ban.user.id}\n**Reason:** ${ban.reason || 'Not provided'}
);
});

client.on(Events.GuildBanRemove, async ban => {
await sendLog(
ban.guild,
'unban',
'🔓 MEMBER UNBANNED',
**User:** ${ban.user.tag}\n**ID:** ${ban.user.id}
);
});

// =====================================
// INVITE EVENTS
// =====================================

client.on(Events.InviteCreate, async invite => {
if (!invite.guild) return;

await sendLog(
invite.guild,
'inviteCreate',
'🔗 INVITE CREATED',
**Code:** ${invite.code}\n**Channel:** ${invite.channel || 'Unknown'}
);
});

client.on(Events.InviteDelete, async invite => {
if (!invite.guild) return;

await sendLog(
invite.guild,
'inviteDelete',
'❌ INVITE DELETED',
**Code:** ${invite.code}
);
});

// =====================================
// SERVER EVENTS
// =====================================

client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
if (oldGuild.name !== newGuild.name ||
oldGuild.icon !== newGuild.icon ||
oldGuild.description !== newGuild.description) {
await sendLog(
newGuild,
'serverUpdate',
'🌐 SERVER UPDATED',
**Old Name:** ${oldGuild.name}\n**New Name:** ${newGuild.name}
);
}
});

client.on(Events.GuildEmojisUpdate, async (oldEmojis, newEmojis) => {
const guild = newEmojis.first()?.guild || oldEmojis.first()?.guild;
if (!guild) return;

await sendLog(
guild,
'emojiUpdate',
'😀 EMOJIS UPDATED',
'The server emoji list has changed.'
);
});

client.on(Events.WebhooksUpdate, async channel => {
if (!channel.guild) return;

await sendLog(
channel.guild,
'webhookUpdate',
'🪝 WEBHOOK UPDATED',
**Channel:** ${channel}
);
});

// =====================================
// HTTP SERVER FOR RENDER
// =====================================

const server = http.createServer((req, res) => {
res.writeHead(200, {
'Content-Type': 'text/plain'
});

res.end('PW VENOM LOG is running!');
});

server.listen(PORT, '0.0.0.0', () => {
console.log(HTTP server running on port ${PORT});
});

// =====================================
// START BOT
// =====================================

async function startBot() {
try {
await registerCommands();
console.log('Commands registered successfully.');

await client.login(TOKEN);

} catch (error) {
console.error('Bot startup error:', error);
process.exit(1);
}
}

startBot();