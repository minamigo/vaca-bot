console.log("🔥 BOT FILE STARTED");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const fs = require("fs");
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is alive");
});

app.listen(3000, () => {
  console.log("Keep-alive server running");
});

// --- BOT SETUP ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const configPath = "./config.json";
let config = { freeAgentChannelId: null, recruitChannelId: null };

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ----------- SLASH COMMANDS -----------
const commands = [
  // 🟨 setchannel
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set the posting channels for free agents or recruitment.")
    .addStringOption(option =>
      option
        .setName("type")
        .setDescription("Select which channel type to set")
        .setRequired(true)
        .addChoices(
          { name: "free agent", value: "freeagent" },
          { name: "recruit", value: "recruit" }
        )
    )
    .addChannelOption(option =>
      option.setName("channel").setDescription("Channel to post in").setRequired(true)
    ),

  // 🟦 freeagent
  new SlashCommandBuilder()
    .setName("freeagent")
    .setDescription("Post yourself as a free agent.")
    .addStringOption(option =>
      option.setName("nationality").setDescription("Where are you from?").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("vc_compatibility").setDescription("Can you join VC?").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("ability").setDescription("Your ability level").setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("positions")
        .setDescription("Your main positions (separate with / )")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("style").setDescription("Your playstyle").setRequired(true)
    ),

  // 🟩 recruit (with logo upload)
  new SlashCommandBuilder()
    .setName("recruit")
    .setDescription("Post your team recruitment message.")
    .addAttachmentOption(option =>
      option
        .setName("logo")
        .setDescription("Upload your team logo (optional)")
        .setRequired(false)
    ),
].map(cmd => cmd.toJSON());

// --- REGISTER COMMANDS ---
const APP_ID = "1467102902811230416";

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

// -------------- INTERACTION HANDLER --------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 🟨 /setchannel
  if (interaction.commandName === "setchannel") {
    const type = interaction.options.getString("type");
    const channel = interaction.options.getChannel("channel");

    if (type === "freeagent") config.freeAgentChannelId = channel.id;
    else if (type === "recruit") config.recruitChannelId = channel.id;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return interaction.reply({
      content: `✅ ${type === "freeagent" ? "Free agent" : "Recruitment"} posts will now be sent to ${channel}.`,
      ephemeral: true,
    });
  }

  // 🟦 /freeagent
  if (interaction.commandName === "freeagent") {
    await interaction.deferReply({ ephemeral: true });

    if (!config.freeAgentChannelId) {
      return interaction.editReply({ content: "⚠️ Channel not set up yet." });
    }

    const nationality = interaction.options.getString("nationality");
    const vcCompatibility = interaction.options.getString("vc_compatibility");
    const ability = interaction.options.getString("ability");
    const positions = interaction.options.getString("positions");
    const style = interaction.options.getString("style");

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username} is looking for a club!`)
      .setDescription(`**Free Agent:** ${interaction.user}`)
      .setColor(0x2b2d31)
      .addFields(
        { name: "Nationality", value: nationality, inline: true },
        { name: "VC Compatibility", value: vcCompatibility, inline: true },
        { name: "Ability", value: ability, inline: true },
        { name: "Positions", value: positions, inline: true },
        { name: "Style", value: style, inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 128 }));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`interest_${interaction.user.id}`)
        .setLabel("Show Interest")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`cancel_${interaction.user.id}`)
        .setLabel("❌ Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const targetChannel = await client.channels.fetch(config.freeAgentChannelId);
      await targetChannel.send({ embeds: [embed], components: [row] });
      await interaction.editReply({ content: `✅ Your post was sent to ${targetChannel}.` });
    } catch (error) {
      console.error(error);
      await interaction.editReply({ content: `❌ Failed to post: ${error.message}` });
    }
  }

  // 🟩 /recruit
    if (interaction.commandName === "recruit") {
  const allowedRoleId = "1373170178644512851";

  if (!interaction.member.roles.cache.has(allowedRoleId)) {
    return interaction.reply({
      content: "🚫 You don’t have permission to use this command.",
      ephemeral: true,
    });
  }

    if (!config.recruitChannelId) {
      return interaction.reply({ content: "⚠️ Channel not set up yet.", ephemeral: true });
    }

    const logoAttachment = interaction.options.getAttachment("logo");
    const logoUrl = logoAttachment ? logoAttachment.url : "";

    const modal = new ModalBuilder().setCustomId("recruit_modal").setTitle("Team Recruitment");

    const team = new TextInputBuilder()
      .setCustomId("team_name")
      .setLabel("Team Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const nation = new TextInputBuilder()
      .setCustomId("nation")
      .setLabel("Nation (e.g. MY, SG)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const message = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("What would you say?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(team),
      new ActionRowBuilder().addComponents(nation),
      new ActionRowBuilder().addComponents(message)
    );

    // Store logo URL for modal handler
    interaction.client.recruitLogoMap = interaction.client.recruitLogoMap || {};
    interaction.client.recruitLogoMap[interaction.user.id] = logoUrl;

    await interaction.showModal(modal);
  }
});

// -------------- MODAL HANDLER --------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "recruit_modal") {
    try {

      await interaction.deferReply({ ephemeral: true });

      const team = interaction.fields.getTextInputValue("team_name");
      const region = interaction.fields.getTextInputValue("nation");
      const message = interaction.fields.getTextInputValue("message");

      const logo = interaction.client.recruitLogoMap?.[interaction.user.id] || null;

      const embed = new EmbedBuilder()
        .setTitle(`${team}`)
        .setColor(0x5865f2)
        .addFields(
          { name: "Owner:", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Nation", value: region, inline: true },
          { name: "Message", value: message, inline: true }
        )
        .setTimestamp();

      if (logo) embed.setImage(logo);
      else embed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 512 }));

      const button = new ButtonBuilder()
        .setLabel("I'm interested!")
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/users/${interaction.user.id}`);

      const row = new ActionRowBuilder().addComponents(button);

      const targetChannel = await client.channels.fetch(config.recruitChannelId);
      await targetChannel.send({ embeds: [embed], components: [row] });

      await interaction.editReply({ content: "✅ Post sent successfully." });
    } catch (err) {
      console.error(err);
      try {
        await interaction.editReply({ content: "❌ Something went wrong." });
      } catch {}
    }
  }
});
// -------------- BUTTON HANDLER --------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("cancel_")) {
    const userId = interaction.customId.split("_")[1];
    if (interaction.user.id !== userId)
      return interaction.reply({ content: "❌ this ain't your post cuh", ephemeral: true });

    try {
      await interaction.message.delete();
      await interaction.reply({ content: "🗑️ deleted!", ephemeral: true });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "⚠️ failed to delete.", ephemeral: true });
    }
  }

  if (interaction.customId.startsWith("interest_")) {
    const freeAgentId = interaction.customId.split("_")[1];
    const modal = new ModalBuilder()
      .setCustomId(`interest_modal_${freeAgentId}`)
      .setTitle("Interest message");

    const messageInput = new TextInputBuilder()
      .setCustomId("interest_message")
      .setLabel("what would you like to say?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setPlaceholder("I'm interested!");

    modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
    await interaction.showModal(modal);
  }
});

// ---------------- AUTO MESSAGE SYSTEM ----------------

const ACTIVE_CHANNEL_ID = "1430818759601422367";
const MENTION_CHANNEL_ID = "1371352988689371177";

let lastMessageTime = 0;
let hasSentRecently = false;
let lastBotMessage = null;

client.on("messageCreate", message => {
  if (message.author.bot) return;
  if (message.channel.id !== ACTIVE_CHANNEL_ID) return;

  lastMessageTime = Date.now();
  hasSentRecently = false;
});

setInterval(async () => {
  const now = Date.now();

  if (now - lastMessageTime < 10 * 60 * 1000 && !hasSentRecently && lastMessageTime !== 0) {
    try {
      const channel = await client.channels.fetch(ACTIVE_CHANNEL_ID);

      if (lastBotMessage) {
        try {
          const oldMsg = await channel.messages.fetch(lastBotMessage.id).catch(() => null);
          if (oldMsg) await oldMsg.delete();
        } catch (err) {
          console.warn("⚠️ Could not delete previous message:", err.message);
        }
      }

      // 📨 send new message
      const sent = await channel.send("to execute the command, please use /freeagent. if the problem persists, please @mi goreng" );

      lastBotMessage = sent;
      hasSentRecently = true;
    } catch (err) {
      console.error("⚠️ Failed to send message:", err);
    }
  }
},5 * 60 * 1000);

// -------- BOT LOGIN --------

console.log("Attempting login...");
console.log("Token exists?", !!process.env.TOKEN);
console.log("Token length:", process.env.TOKEN?.length);

client.login(process.env.TOKEN)
  .then(() => {
    console.log("✅ Login promise resolved");
  })
  .catch(err => {
    console.error("❌ Login failed:", err);
  });

client.on("error", console.error);
client.on("shardError", console.error);
