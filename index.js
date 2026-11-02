// PW VENOM LOG
// Discord.js v14

const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  AuditLogEvent
} = require('discord.js');

const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID environment variable.');
  process.exit(1);
}

const CONFIG_FILE = path.join(process.cwd(), 'pw-venom-config.json');

const EVENTS = {
  memberJoin: 'Member Join',
  memberLeave: 'Member Leave',
  memberKick: 'Member Kick',
  ban: 'Member Ban',
  unban: 'Member Unban',
  timeout: 'Member Timeout',
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
    console.error('Config load error:', error);
  }
  return {};
}

const config = loadConfig();

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
    .setName('setlog')
    .setDescription('Set a separate log channel for an event')
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Choose the event')
        .setRequired(true)
        .addChoices(
          ...Object.entries(EVENTS).map(([value, name]) => ({
            name,
            value
          }))
        )
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Choose the log channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
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

  console.log('Slash commands registered.');
}

async function sendLog(guild, event, title, description, color = 0x168CFF) {
  const channelId = config[guild.id]?.[event];
  if (!channelId) return false;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description || 'No details available.')
    .setTimestamp()
    .setFooter({ text: 'PW VENOM LOG' });

  await channel.send({ embeds: [embed] }).catch(error => {
    console.error('Log send error:', error);
  });

  return true;
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

client.once('ready', () => {
  console.log(`PW VENOM LOG online as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setlog') {
    const event = interaction.options.getString('event');
    const channel = interaction.options.getChannel('channel');

    config[interaction.guildId] ??= {};
    config[interaction.guildId][event] = channel.id;
    saveConfig();

    return interaction.reply({
      content: `✅ ${EVENTS[event]} logs will be sent to ${channel}.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'loginfo') {
    const guildConfig = config[interaction.guildId] || {};

    const lines = Object.entries(EVENTS).map(([key, name]) => {
      const channelId = guildConfig[key];
      return `**${name}:** ${channelId ? `<#${channelId}>` : 'Not configured'}`;
    });

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x168CFF)
          .setTitle('PW VENOM LOG — CONFIGURATION')
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
      `This is a test for **${EVENTS[event]}**.`
    );

    return interaction.reply({
      content: sent
        ? `✅ Test sent to the configured ${EVENTS[event]} channel.`
        : `❌ No channel configured for ${EVENTS[event]}. Use /setlog first.`,
      ephemeral: true
    });
  }
});

client.on('guildMemberAdd', member => {
  sendLog(member.guild, 'memberJoin', '📥 MEMBER JOIN',
    `${member.user.tag} joined the server.\nID: ${member.id}`);
});

client.on('guildMemberRemove', async member => {
  const executor = await findExecutor(
    member.guild,
    AuditLogEvent.MemberKick,
    member.id
  );

  if (executor) {
    await sendLog(member.guild, 'memberKick', '👢 MEMBER KICK',
      `${member.user.tag} was kicked.\nBy: ${executor.tag}`);
  } else {
    await sendLog(member.guild, 'memberLeave', '📤 MEMBER LEAVE',
      `${member.user.tag} left the server.\nID: ${member.id}`);
  }
});

client.on('guildBanAdd', async ban => {
  const executor = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanAdd,
    ban.user.id
  );

  sendLog(ban.guild, 'ban', '🔨 MEMBER BANNED',
    `${ban.user.tag} was banned.\nBy: ${executor?.tag || 'Unknown'}`,
    0xE74C3C);
});

client.on('guildBanRemove', async ban => {
  const executor = await findExecutor(
    ban.guild,
    AuditLogEvent.MemberBanRemove,
    ban.user.id
  );

  sendLog(ban.guild, 'unban', '🔓 MEMBER UNBANNED',
    `${ban.user.tag} was unbanned.\nBy: ${executor?.tag || 'Unknown'}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    sendLog(newMember.guild, 'nicknameUpdate', '✏️ NICKNAME UPDATE',
      `${newMember.user.tag}\nOld: ${oldMember.nickname || 'None'}\nNew: ${newMember.nickname || 'None'}`);
  }

  if (oldMember.communicationDisabledUntilTimestamp !==
      newMember.communicationDisabledUntilTimestamp) {
    const timedOut = newMember.communicationDisabledUntilTimestamp;

    sendLog(newMember.guild, timedOut ? 'timeout' : 'timeoutRemoved',
      timedOut ? '⏳ MEMBER TIMEOUT' : '✅ TIMEOUT REMOVED',
      `${newMember.user.tag}\n${timedOut
        ? `Until: ${new Date(timedOut).toLocaleString()}`
        : 'Timeout removed.'}`);
  }
});

client.on('messageDelete', async message => {
  if (!message.guild || message.author?.bot) return;

  sendLog(message.guild, 'messageDelete', '🗑️ MESSAGE DELETED',
    `Author: ${message.author?.tag || 'Unknown'}\nChannel: ${message.channel}\nContent: ${message.content || 'Unavailable'}`);
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.partial || newMessage.partial) return;
  if (oldMessage.content === newMessage.content) return;

  sendLog(newMessage.guild, 'messageEdit', '📝 MESSAGE EDITED',
    `Author: ${newMessage.author.tag}\nChannel: ${newMessage.channel}\nBefore: ${oldMessage.content || 'Empty'}\nAfter: ${newMessage.content || 'Empty'}\n[Jump to message](${newMessage.url})`);
});

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

client.on('channelUpdate', (oldChannel, newChannel) => {
  if (!newChannel.guild) return;

  sendLog(newChannel.guild, 'channelUpdate', '⚙️ CHANNEL UPDATED',
    `Channel: ${newChannel.name}\nID: ${newChannel.id}`);
});

client.on('roleCreate', async role => {
  const executor = await findExecutor(
    role.guild,
    AuditLogEvent.RoleCreate,
    role.id
  );

  sendLog(role.guild, 'roleCreate', '🆕 ROLE CREATED',
    `Role: ${role.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

client.on('roleDelete', async role => {
  const executor = await findExecutor(
    role.guild,
    AuditLogEvent.RoleDelete,
    role.id
  );

  sendLog(role.guild, 'roleDelete', '🗑️ ROLE DELETED',
    `Role: ${role.name}\nBy: ${executor?.tag || 'Unknown'}`);
});

client.on('roleUpdate', (oldRole, newRole) => {
  sendLog(newRole.guild, 'roleUpdate', '⚙️ ROLE UPDATED',
    `Role: ${newRole.name}\nID: ${newRole.id}`);
});

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

client.on('guildUpdate', (oldGuild, newGuild) => {
  sendLog(newGuild, 'serverUpdate', '⚙️ SERVER UPDATED',
    `Server name: ${oldGuild.name} → ${newGuild.name}`);
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

const http = require('node:http');
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