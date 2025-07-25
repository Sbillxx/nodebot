require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const mysql = require("mysql2/promise");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Fungsi koneksi database
async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    charset: "utf8mb4",
  });
}

// ===== ADMIN SESSION & LOGIN =====
const adminSessions = {}; // { userId: { loggedIn: true, username: '...' } }

const adminAddState = {}; // { userId: { category, step, question } }

const adminEditState = {}; // { userId: { category, id, step, question } }

const adminOptionState = {}; // { userId: { step, type } }

// Helper: daftar handler kategori admin_qna_*
["kemuridan", "fiqih", "tassawuf", "keluarga"].forEach((cat) => {
  // Daftar pertanyaan per kategori
  bot.action(`admin_qna_${cat}`, async (ctx) => {
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT id, question FROM qna_${cat}`);
    await conn.end();
    if (!rows.length) {
      await ctx.editMessageText("Belum ada data dalam kategori ini.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_qna_list")]]));
      return;
    }
    const keyboard = rows.map((row) => [Markup.button.callback(row.question, `admin_detail_${cat}_${row.id}`)]);
    keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_qna_list")]);
    await ctx.editMessageText(`📖 *QnA ${cat.charAt(0).toUpperCase() + cat.slice(1)}*\nPilih pertanyaan untuk dikelola:`, { parse_mode: "Markdown", ...Markup.inlineKeyboard(keyboard) });
  });

  // Mulai tambah pertanyaan baru
  bot.action(`admin_add_${cat}`, async (ctx) => {
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    adminAddState[ctx.from.id] = { category: cat, step: "question" };
    await ctx.editMessageText("📝 *Tambah Pertanyaan Baru*\n\nSilakan ketik pertanyaan yang ingin ditambahkan:", { parse_mode: "Markdown" });
  });

  // Handler detail pertanyaan (update tombol edit & hapus)
  bot.action(new RegExp(`^admin_detail_${cat}_(\\d+)$`), async (ctx) => {
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    const id = ctx.match[1];
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT question, answer FROM qna_${cat} WHERE id = ?`, [id]);
    await conn.end();
    if (rows.length) {
      const qna = rows[0];
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("✏️ Edit", `admin_edit_${cat}_${id}`), Markup.button.callback("🗑️ Hapus", `admin_delete_${cat}_${id}`)], [Markup.button.callback("⬅️ Kembali", `admin_qna_${cat}`)]]);
      await ctx.editMessageText(`*Pertanyaan:*\n${qna.question}\n\n*Jawaban:*\n${qna.answer}`, { parse_mode: "Markdown", ...keyboard });
    } else {
      await ctx.editMessageText("Data tidak ditemukan.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", `admin_qna_${cat}`)]]));
    }
  });

  // Handler klik Edit (pakai RegExp)
  bot.action(new RegExp(`^admin_edit_${cat}_(\\d+)$`), async (ctx) => {
    const id = ctx.match[1];
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    adminEditState[ctx.from.id] = { category: cat, id, step: "question" };
    await ctx.editMessageText("✏️ *Edit Pertanyaan*\n\nSilakan ketik pertanyaan baru:", { parse_mode: "Markdown" });
  });

  // Handler klik Hapus (pakai RegExp)
  bot.action(new RegExp(`^admin_delete_${cat}_(\\d+)$`), async (ctx) => {
    const id = ctx.match[1];
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback("✅ Ya", `admin_confirm_delete_${cat}_${id}`), Markup.button.callback("❌ Tidak", `admin_detail_${cat}_${id}`)]]);
    await ctx.editMessageText("⚠️ *Konfirmasi Penghapusan*\n\nApakah Anda yakin ingin menghapus pertanyaan ini?", { parse_mode: "Markdown", ...keyboard });
  });

  // Handler konfirmasi hapus (pakai RegExp)
  bot.action(new RegExp(`^admin_confirm_delete_${cat}_(\\d+)$`), async (ctx) => {
    const id = ctx.match[1];
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
      return;
    }
    const conn = await getDbConnection();
    await conn.execute(`DELETE FROM qna_${cat} WHERE id = ?`, [id]);
    await conn.end();
    // Setelah hapus, kembali ke daftar QnA kategori
    const conn2 = await getDbConnection();
    const [rows] = await conn2.execute(`SELECT id, question FROM qna_${cat}`);
    await conn2.end();
    const keyboard = rows.map((row) => [Markup.button.callback(row.question, `admin_detail_${cat}_${row.id}`)]);
    keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_qna_list")]);
    await ctx.editMessageText("✅ *Berhasil!*\n\nPertanyaan telah dihapus.", { parse_mode: "Markdown", ...Markup.inlineKeyboard(keyboard) });
  });
});

// Handler input pertanyaan/jawaban tambah QnA
bot.on("text", async (ctx, next) => {
  // Jika sedang proses tambah QnA
  const state = adminAddState[ctx.from.id];
  if (state && adminSessions[ctx.from.id]?.loggedIn) {
    if (state.step === "question") {
      state.question = ctx.message.text;
      state.step = "answer";
      await ctx.reply("✍️ *Masukkan Jawaban*\n\nSilakan ketik jawaban untuk pertanyaan tersebut:", { parse_mode: "Markdown" });
      return;
    }
    if (state.step === "answer") {
      const answer = ctx.message.text;
      const { category, question } = state;
      const conn = await getDbConnection();
      await conn.execute(`INSERT INTO qna_${category} (question, answer) VALUES (?, ?)`, [question, answer]);
      await conn.end();
      delete adminAddState[ctx.from.id];
      // Setelah sukses, langsung tampilkan daftar pertanyaan di kategori yang sama
      // (panggil handler admin_qna_{category})
      // Kirim pesan sukses dulu (opsional, bisa dihapus jika ingin langsung balik)
      // await ctx.reply('✅ *Berhasil!*\n\nPertanyaan dan jawaban baru telah ditambahkan.', { parse_mode: 'Markdown' });
      // Panggil ulang handler daftar QnA kategori
      const conn2 = await getDbConnection();
      const [rows] = await conn2.execute(`SELECT id, question FROM qna_${category}`);
      await conn2.end();
      const keyboard = rows.map((row) => [Markup.button.callback(row.question, `admin_detail_${category}_${row.id}`)]);
      keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_qna_list")]);
      await ctx.reply(`📖 *QnA ${category.charAt(0).toUpperCase() + category.slice(1)}*\nPilih pertanyaan untuk dikelola:`, { parse_mode: "Markdown", ...Markup.inlineKeyboard(keyboard) });
      return;
    }
  }
  // Jika sedang proses edit QnA
  const editState = adminEditState[ctx.from.id];
  if (editState && adminSessions[ctx.from.id]?.loggedIn) {
    if (editState.step === "question") {
      editState.question = ctx.message.text;
      editState.step = "answer";
      await ctx.reply("✏️ *Edit Jawaban*\n\nSilakan ketik jawaban baru:", { parse_mode: "Markdown" });
      return;
    }
    if (editState.step === "answer") {
      const answer = ctx.message.text;
      const { category, id, question } = editState;
      const conn = await getDbConnection();
      await conn.execute(`UPDATE qna_${category} SET question = ?, answer = ? WHERE id = ?`, [question, answer, id]);
      await conn.end();
      delete adminEditState[ctx.from.id];
      // Setelah edit, kembali ke detail pertanyaan
      const conn2 = await getDbConnection();
      const [rows] = await conn2.execute(`SELECT question, answer FROM qna_${category} WHERE id = ?`, [id]);
      await conn2.end();
      if (rows.length) {
        const qna = rows[0];
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback("✏️ Edit", `admin_edit_${category}_${id}`), Markup.button.callback("🗑️ Hapus", `admin_delete_${category}_${id}`)],
          [Markup.button.callback("⬅️ Kembali", `admin_qna_${category}`)],
        ]);
        await ctx.reply(`*Pertanyaan:*\n${qna.question}\n\n*Jawaban:*\n${qna.answer}`, { parse_mode: "Markdown", ...keyboard });
      }
      return;
    }
  }
  // Jika sedang proses option
  const opt = adminOptionState[ctx.from.id];
  if (opt && adminSessions[ctx.from.id]?.loggedIn) {
    const userId = ctx.from.id;
    const username = adminSessions[userId]?.username;
    if (opt.type === "username") {
      // Cek username sudah dipakai?
      const newUsername = ctx.message.text;
      const conn = await getDbConnection();
      const [rows] = await conn.execute("SELECT * FROM admin_users WHERE username = ?", [newUsername]);
      if (rows.length) {
        await ctx.reply("❌ *Gagal!*\n\nUsername sudah digunakan. Silakan pilih username lain.", { parse_mode: "Markdown" });
        await conn.end();
        delete adminOptionState[userId];
        return;
      }
      await conn.execute("UPDATE admin_users SET username = ? WHERE username = ?", [newUsername, username]);
      await conn.end();
      adminSessions[userId].username = newUsername;
      await ctx.reply("✅ *Berhasil!*\n\nUsername telah diperbarui.", { parse_mode: "Markdown" });
      delete adminOptionState[userId];
      // Kembali ke panel
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_panel")]]);
      await ctx.reply("Kembali ke panel admin:", keyboard);
      return;
    }
    if (opt.type === "password") {
      const newPassword = ctx.message.text;
      if (newPassword.length < 6) {
        await ctx.reply("❌ *Gagal!*\n\nPassword harus minimal 6 karakter.", { parse_mode: "Markdown" });
        delete adminOptionState[userId];
        return;
      }
      const conn = await getDbConnection();
      await conn.execute("UPDATE admin_users SET password = ? WHERE username = ?", [newPassword, username]);
      await conn.end();
      await ctx.reply("✅ *Berhasil!*\n\nPassword telah diperbarui.", { parse_mode: "Markdown" });
      delete adminOptionState[userId];
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_panel")]]);
      await ctx.reply("Kembali ke panel admin:", keyboard);
      return;
    }
    if (opt.type === "panduan") {
      const newPanduan = ctx.message.text;
      const conn = await getDbConnection();
      const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM panduan");
      if (rows[0].cnt > 0) {
        await conn.execute("UPDATE panduan SET keterangan = ?", [newPanduan]);
      } else {
        await conn.execute("INSERT INTO panduan (keterangan) VALUES (?)", [newPanduan]);
      }
      await conn.end();
      await ctx.reply("✅ *Berhasil!*\n\nPanduan telah diperbarui.", { parse_mode: "Markdown" });
      delete adminOptionState[userId];
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_panel")]]);
      await ctx.reply("Kembali ke panel admin:", keyboard);
      return;
    }
    if (opt.type === "bantuan") {
      const newBantuan = ctx.message.text;
      const conn = await getDbConnection();
      const [rows] = await conn.execute("SELECT COUNT(*) as cnt FROM bantuan");
      if (rows[0].cnt > 0) {
        await conn.execute("UPDATE bantuan SET keterangan = ?", [newBantuan]);
      } else {
        await conn.execute("INSERT INTO bantuan (keterangan) VALUES (?)", [newBantuan]);
      }
      await conn.end();
      await ctx.reply("✅ *Berhasil!*\n\nBantuan telah diperbarui.", { parse_mode: "Markdown" });
      delete adminOptionState[userId];
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_panel")]]);
      await ctx.reply("Kembali ke panel admin:", keyboard);
      return;
    }
  }
  return next();
});

// Start command
bot.start(async (ctx) => {
  const firstName = ctx.from.first_name || "";
  await ctx.reply(`Halo ${firstName}! Klik /tanyajawab untuk mulai.`);
});

// Tanya Jawab command
bot.command("tanyajawab", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
    [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
    [Markup.button.callback("🙌 Panduan", "panduan")],
    [Markup.button.callback("🆘 Bantuan", "bantuan")],
  ]);
  await ctx.reply("Silakan pilih kategori:", keyboard);
});

// Handler kategori QnA
const qnaCategories = ["kemuridan", "fiqih", "tassawuf", "keluarga"];
qnaCategories.forEach((cat) => {
  bot.action(`qna_${cat}`, async (ctx) => {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT id, question FROM qna_${cat}`);
    await conn.end();
    if (!rows.length) {
      await ctx.editMessageText("Belum ada data dalam kategori ini.");
      return;
    }
    const keyboard = rows.map((row) => [Markup.button.callback(row.question, `qna_${cat}_${row.id}`)]);
    keyboard.push([Markup.button.callback("⬅️ Kembali", "tanyajawab")]);
    await ctx.editMessageText("Pilih pertanyaan:", Markup.inlineKeyboard(keyboard));
  });
});

// Handler detail QnA
qnaCategories.forEach((cat) => {
  bot.action(new RegExp(`^qna_${cat}_(\\d+)$`), async (ctx) => {
    const id = ctx.match[1];
    // Tracking view jika bukan admin
    if (!adminSessions[ctx.from.id]?.loggedIn) {
      const connTrack = await getDbConnection();
      await connTrack.execute("INSERT INTO qna_views (qna_category, qna_id, user_id) VALUES (?, ?, ?)", [cat, id, ctx.from.id]);
      await connTrack.end();
    }
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT question, answer FROM qna_${cat} WHERE id = ?`, [id]);
    await conn.end();
    if (rows.length) {
      const qna = rows[0];
      await ctx.editMessageText(`*Pertanyaan:*\n${qna.question}\n\n*Jawaban:*\n${qna.answer}`, {
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", `qna_${cat}`)]]).reply_markup,
      });
    } else {
      await ctx.editMessageText("Data tidak ditemukan.");
    }
  });
});

// Handler Panduan
bot.action("panduan", async (ctx) => {
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT keterangan FROM panduan LIMIT 1");
  await conn.end();
  const text = rows.length ? `📌 *Panduan:*\n\n${rows[0].keterangan}` : "Belum ada panduan yang tersedia.";
  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "tanyajawab")]]).reply_markup,
  });
});

// Handler Bantuan
bot.action("bantuan", async (ctx) => {
  const conn = await getDbConnection();
  const [bantuan] = await conn.execute("SELECT keterangan FROM bantuan LIMIT 1");
  await conn.end();
  const text = bantuan.length
    ? `🆘 *Bantuan:*

${bantuan[0].keterangan}`
    : "Belum ada informasi bantuan yang tersedia.";
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("💬 Tuliskan Feedback di sini", "user_feedback")], [Markup.button.callback("⬅️ Kembali", "tanyajawab")]]);
  await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
});

// Handler tombol kembali ke Tanya Jawab (update tombol search, tanpa statistik)
bot.action("tanyajawab", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
    [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
    [Markup.button.callback("🙌 Panduan", "panduan")],
    [Markup.button.callback("🆘 Bantuan", "bantuan")],
  ]);
  await ctx.editMessageText("Silakan pilih kategori:", keyboard);
});

// Handler /admin
bot.command("admin", async (ctx) => {
  adminSessions[ctx.from.id] = { step: "username" };
  await ctx.reply("Silakan masukkan username admin:");
});

// Handler input username/password admin
bot.on("text", async (ctx, next) => {
  const session = adminSessions[ctx.from.id];
  if (!session || session.loggedIn) return next();

  if (session.step === "username") {
    session.username = ctx.message.text;
    session.step = "password";
    await ctx.reply("Silakan masukkan password admin:");
    return;
  }
  if (session.step === "password") {
    const username = session.username;
    const password = ctx.message.text;
    // Cek ke database
    const conn = await getDbConnection();
    const [rows] = await conn.execute("SELECT * FROM admin_users WHERE username = ? AND password = ?", [username, password]);
    await conn.end();
    if (rows.length) {
      adminSessions[ctx.from.id] = { loggedIn: true, username };
      await ctx.reply("✅ Login berhasil! Selamat datang di Admin Panel.");
      // Tampilkan panel admin
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📜 Daftar QnA", "admin_qna_list")],
        [Markup.button.callback("➕ Tambah QnA", "admin_qna_add")],
        [Markup.button.callback("⚙️ Option", "admin_option")],
        [Markup.button.callback("🚪 Logout", "admin_logout")],
      ]);
      await ctx.reply("🔧 *Admin Panel*\nSilakan pilih menu:", { parse_mode: "Markdown", ...keyboard });
    } else {
      delete adminSessions[ctx.from.id];
      await ctx.reply("❌ Username atau password salah. Silakan coba lagi dengan /admin.");
    }
    return;
  }
  return next();
});

// Handler logout admin
bot.action("admin_logout", async (ctx) => {
  delete adminSessions[ctx.from.id];
  await ctx.editMessageText("Anda telah logout.");
  // Kembali ke menu Tanya Jawab
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
    [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
    [Markup.button.callback("🙌 Panduan", "panduan")],
    [Markup.button.callback("🆘 Bantuan", "bantuan")],
  ]);
  await ctx.reply("Silakan pilih kategori:", keyboard);
});

// Handler admin_qna_list (daftar kategori QnA untuk admin)
bot.action("admin_qna_list", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "admin_qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "admin_qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "admin_qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "admin_qna_keluarga")],
    [Markup.button.callback("⬅️ Kembali", "admin_panel")],
  ]);
  await ctx.editMessageText("📜 *Daftar QnA* Silakan pilih kategori:", { parse_mode: "Markdown", ...keyboard });
});

// Handler admin_qna_add (pilih kategori untuk tambah QnA)
bot.action("admin_qna_add", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "admin_add_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "admin_add_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "admin_add_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "admin_add_keluarga")],
    [Markup.button.callback("⬅️ Kembali", "admin_panel")],
  ]);
  await ctx.editMessageText("📝 *Tambah QnA*\nSilakan pilih kategori:", { parse_mode: "Markdown", ...keyboard });
});

// Handler admin_panel (tampilkan ulang panel admin)
bot.action("admin_panel", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📜 Daftar QnA", "admin_qna_list")],
    [Markup.button.callback("➕ Tambah QnA", "admin_qna_add")],
    [Markup.button.callback("⚙️ Option", "admin_option")],
    [Markup.button.callback("🚪 Logout", "admin_logout")],
  ]);
  await ctx.editMessageText("🔧 *Admin Panel*\nSilakan pilih menu:", { parse_mode: "Markdown", ...keyboard });
});

// Update handler admin_option
bot.action("admin_option", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("👤 Ganti Username", "change_username")],
    [Markup.button.callback("🔑 Ganti Password", "change_password")],
    [Markup.button.callback("📖 Ganti Panduan", "change_panduan")],
    [Markup.button.callback("❓ Ganti Bantuan", "change_bantuan")],
    [Markup.button.callback("📊 Statistik QnA", "admin_statistik_qna")],
    [Markup.button.callback("💬 Feedback", "admin_feedback_list")],
    [Markup.button.callback("🔔 Set Notif Feedback", "change_notif")],
    [Markup.button.callback("👥 Daftar User Notifikasi", "notif_user_list")],
    [Markup.button.callback("⬅️ Kembali", "admin_panel")],
  ]);
  await ctx.editMessageText("⚙️ *Option Menu*\nSilakan pilih menu pengaturan:", { parse_mode: "Markdown", ...keyboard });
});

// Tambahkan setelah handler bot.action("admin_option", ...)
bot.action("change_bantuan", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  adminOptionState[ctx.from.id] = { step: "bantuan", type: "bantuan" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Batal", "admin_option")]]);
  await ctx.editMessageText("❓ *Ganti Bantuan*\n\nSilakan ketik teks bantuan baru:", { parse_mode: "Markdown", ...keyboard });
});

// Handler untuk Ganti Username
bot.action("change_username", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  adminOptionState[ctx.from.id] = { step: "username", type: "username" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Batal", "admin_option")]]);
  await ctx.editMessageText("👤 *Ganti Username*\n\nSilakan ketik username baru:", { parse_mode: "Markdown", ...keyboard });
});

// Handler untuk Ganti Password
bot.action("change_password", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  adminOptionState[ctx.from.id] = { step: "password", type: "password" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Batal", "admin_option")]]);
  await ctx.editMessageText("🔑 *Ganti Password*\n\nSilakan ketik password baru (min 6 karakter):", { parse_mode: "Markdown", ...keyboard });
});

// Handler untuk Ganti Panduan
bot.action("change_panduan", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  adminOptionState[ctx.from.id] = { step: "panduan", type: "panduan" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Batal", "admin_option")]]);
  await ctx.editMessageText("📖 *Ganti Panduan*\n\nSilakan ketik panduan baru:", { parse_mode: "Markdown", ...keyboard });
});

// ===== SEARCH QNA =====
const userSearchState = {}; // { userId: true }

bot.action("search_qna", async (ctx) => {
  userSearchState[ctx.from.id] = true;
  await ctx.editMessageText(
    `🔍 *Cari Pertanyaan*

Silakan ketik kata kunci yang ingin dicari:`,
    { parse_mode: "Markdown" }
  );
});

bot.command("cari", async (ctx) => {
  userSearchState[ctx.from.id] = true;
  await ctx.reply(
    `🔍 *Cari Pertanyaan*

Silakan ketik kata kunci yang ingin dicari:`,
    { parse_mode: "Markdown" }
  );
});

bot.on("text", async (ctx, next) => {
  // ... existing code tambah/edit/option ...
  // Jika sedang proses search QnA
  if (userSearchState[ctx.from.id]) {
    const keyword = ctx.message.text.trim();
    if (!keyword || keyword.length < 2) {
      await ctx.reply("❌ Kata kunci terlalu pendek. Silakan ketik minimal 2 karakter.");
      return;
    }
    // Cari di semua tabel QnA
    const categories = ["kemuridan", "fiqih", "tassawuf", "keluarga"];
    let results = [];
    const conn = await getDbConnection();
    for (const cat of categories) {
      const [rows] = await conn.execute(`SELECT id, question FROM qna_${cat} WHERE question LIKE ?`, [`%${keyword}%`]);
      results = results.concat(rows.map((r) => ({ ...r, category: cat })));
    }
    await conn.end();
    userSearchState[ctx.from.id] = false;
    if (!results.length) {
      await ctx.reply("Tidak ditemukan pertanyaan yang cocok dengan kata kunci tersebut.");
      return;
    }
    // Tampilkan hasil pencarian
    const keyboard = results.map((r) => [Markup.button.callback(`${r.question} (${r.category})`, `search_detail_${r.category}_${r.id}`)]);
    keyboard.push([Markup.button.callback("⬅️ Kembali", "tanyajawab")]);
    await ctx.reply("Hasil pencarian:", Markup.inlineKeyboard(keyboard));
    return;
  }
  return next();
});

// Handler detail QnA dari hasil search
["kemuridan", "fiqih", "tassawuf", "keluarga"].forEach((cat) => {
  bot.action(new RegExp(`^search_detail_${cat}_(\\d+)$`), async (ctx) => {
    const id = ctx.match[1];
    const conn = await getDbConnection();
    const [rows] = await conn.execute(`SELECT question, answer FROM qna_${cat} WHERE id = ?`, [id]);
    await conn.end();
    if (rows.length) {
      const qna = rows[0];
      // Tambahkan tombol feedback
      const keyboard = Markup.inlineKeyboard([[Markup.button.callback("👍", `feedback_like_${cat}_${id}`), Markup.button.callback("👎", `feedback_dislike_${cat}_${id}`)], [Markup.button.callback("⬅️ Kembali", "tanyajawab")]]);
      await ctx.editMessageText(`*Pertanyaan:*\n${qna.question}\n\n*Jawaban:*\n${qna.answer}`, { parse_mode: "Markdown", ...keyboard });
    } else {
      await ctx.editMessageText("Data tidak ditemukan.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "tanyajawab")]]));
    }
  });
});

// ===== FEEDBACK TEKS USER =====
const userFeedbackState = {}; // { userId: { step, feedback } }

// Fungsi escape karakter khusus Markdown
function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

// 2. Handler proses input feedback user
bot.action("user_feedback", async (ctx) => {
  userFeedbackState[ctx.from.id] = { step: "input" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Batal", "user_feedback_cancel")]]);
  await ctx.editMessageText("💬 *Tulis Feedback*\n\nSilakan ketik feedback, saran, atau kritik Anda di bawah ini:", { parse_mode: "Markdown", ...keyboard });
});

// 3. Handler input feedback user
bot.on("text", async (ctx, next) => {
  const state = userFeedbackState[ctx.from.id];
  if (state && state.step === "input") {
    state.feedback = ctx.message.text;
    state.step = "confirm";
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback("✅ Kirim", "user_feedback_send"), Markup.button.callback("❌ Batal", "user_feedback_cancel")]]);
    await ctx.reply(`Kirim feedback berikut?\n\n"${escapeMarkdown(state.feedback)}"`, { parse_mode: "Markdown", ...keyboard });
    return;
  }
  return next();
});

// 4. Handler konfirmasi kirim/batal feedback
bot.action("user_feedback_send", async (ctx) => {
  const state = userFeedbackState[ctx.from.id];
  if (state && state.feedback) {
    const conn = await getDbConnection();
    const username = ctx.from.username || null;
    const firstName = ctx.from.first_name || null;
    await conn.execute("INSERT INTO feedback_text (user_id, username, first_name, feedback) VALUES (?, ?, ?, ?)", [ctx.from.id, username, firstName, state.feedback]);
    await conn.end();
    delete userFeedbackState[ctx.from.id];
    await ctx.editMessageText("✅ Terima kasih! Feedback Anda sudah dikirim.");

    // Kembali ke menu tanyajawab
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
      [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
      [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
      [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
      [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
      [Markup.button.callback("🙌 Panduan", "panduan")],
      [Markup.button.callback("🆘 Bantuan", "bantuan")],
    ]);
    await ctx.reply("Silakan pilih kategori:", keyboard);

    // Kirim notifikasi ke semua user_id di tabel admin_option
    const connNotif = await getDbConnection();
    const [notifRows] = await connNotif.execute("SELECT DISTINCT notif_user_id FROM admin_option");
    await connNotif.end();
    for (const row of notifRows) {
      if (row.notif_user_id) {
        try {
          await bot.telegram.sendMessage(row.notif_user_id, `🔔 Feedback Baru Masuk!\n\nDari: ${firstName || username || "User " + ctx.from.id}\n\n${state.feedback}`, { parse_mode: "Markdown" });
        } catch (e) {
          // Gagal kirim notif ke user ini
        }
      }
    }
  } else {
    await ctx.editMessageText("Tidak ada feedback yang dikirim.");
  }
});

bot.action("user_feedback_cancel", async (ctx) => {
  delete userFeedbackState[ctx.from.id];
  await ctx.editMessageText("Feedback dibatalkan.");
});

// 6. Handler list user feedback (setiap feedback satu entri)
bot.action("admin_feedback_list", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT id, user_id, username, first_name, feedback, timestamp FROM feedback_text ORDER BY timestamp DESC");
  await conn.end();
  if (!rows.length) {
    await ctx.editMessageText("Belum ada feedback dari user.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]));
    return;
  }
  const keyboard = rows.map((r) => {
    const displayName = r.first_name || r.username || `User ${r.user_id}`;
    return [Markup.button.callback(displayName, `admin_feedback_detail_${r.id}`)];
  });
  keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_option")]);
  await ctx.editMessageText("Daftar feedback yang masuk:", Markup.inlineKeyboard(keyboard));
});

// Handler detail feedback per feedback_id
bot.action(new RegExp("^admin_feedback_detail_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const feedbackId = ctx.match[1];
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT user_id, username, first_name, feedback, timestamp FROM feedback_text WHERE id = ?", [feedbackId]);
  await conn.end();
  if (!rows.length) {
    await ctx.editMessageText("Feedback tidak ditemukan.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_feedback_list")]]));
    return;
  }
  const r = rows[0];
  const displayName = r.first_name || r.username || `User ${r.user_id}`;
  let text = `Feedback dari ${displayName} (ID: ${r.user_id}):\n\n\"${r.feedback}\"\n\nWaktu: ${r.timestamp.toLocaleString ? r.timestamp.toLocaleString() : r.timestamp}`;
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("🗑️ Hapus", `admin_feedback_delete_confirm_${feedbackId}`), Markup.button.callback("⬅️ Kembali", "admin_feedback_list")]]);
  await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
});

// Handler konfirmasi hapus feedback
bot.action(new RegExp("^admin_feedback_delete_confirm_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const feedbackId = ctx.match[1];
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("✅ Ya, hapus", `admin_feedback_delete_${feedbackId}`), Markup.button.callback("❌ Batal", `admin_feedback_detail_${feedbackId}`)]]);
  await ctx.editMessageText("⚠️ Yakin ingin menghapus feedback ini?", { parse_mode: "Markdown", ...keyboard });
});

// Handler eksekusi hapus feedback
bot.action(new RegExp("^admin_feedback_delete_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const feedbackId = ctx.match[1];
  const conn = await getDbConnection();
  await conn.execute("DELETE FROM feedback_text WHERE id = ?", [feedbackId]);
  await conn.end();
  await ctx.editMessageText("✅ Feedback berhasil dihapus.");
  // Kembali ke daftar feedback
  const conn2 = await getDbConnection();
  const [rows] = await conn2.execute("SELECT id, user_id, username, first_name, feedback, timestamp FROM feedback_text ORDER BY timestamp DESC");
  await conn2.end();
  if (!rows.length) {
    await ctx.reply("Tidak ada feedback yang tersisa.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]));
    return;
  }
  const keyboard = rows.map((r) => {
    const displayName = r.first_name || r.username || `User ${r.user_id}`;
    return [Markup.button.callback(displayName, `admin_feedback_detail_${r.id}`)];
  });
  keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_option")]);
  await ctx.reply("Daftar feedback yang masuk:", Markup.inlineKeyboard(keyboard));
});

// ===== STATISTIK =====
// Hapus tombol Statistik dari menu utama Tanya Jawab
bot.command("tanyajawab", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
    [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
    [Markup.button.callback("🙌 Panduan", "panduan")],
    [Markup.button.callback("🆘 Bantuan", "bantuan")],
  ]);
  await ctx.reply("Silakan pilih kategori:", keyboard);
});

// Handler tombol kembali ke Tanya Jawab (update tombol search, tanpa statistik)
bot.action("tanyajawab", async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("📖 Qna Kemuridan", "qna_kemuridan")],
    [Markup.button.callback("🕌 Qna Fiqih", "qna_fiqih")],
    [Markup.button.callback("🧘 Qna Tassawuf", "qna_tassawuf")],
    [Markup.button.callback("👨‍👩‍👧‍👦 Qna Keluarga", "qna_keluarga")],
    [Markup.button.callback("🔍 Cari Pertanyaan", "search_qna")],
    [Markup.button.callback("🙌 Panduan", "panduan")],
    [Markup.button.callback("🆘 Bantuan", "bantuan")],
  ]);
  await ctx.editMessageText("Silakan pilih kategori:", keyboard);
});

// 3. Handler statistik QnA admin
bot.action("admin_statistik_qna", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const conn = await getDbConnection();
  // Ambil top 5 pertanyaan paling sering dibuka
  const [rows] = await conn.execute(`
    SELECT qna_category, qna_id, COUNT(*) as views
    FROM qna_views
    GROUP BY qna_category, qna_id
    ORDER BY views DESC
    LIMIT 5
  `);
  let text = "📊 *Statistik QnA Paling Sering Dibuka*\n";
  if (!rows.length) {
    text += "\nBelum ada data view.";
  } else {
    for (const [i, row] of rows.entries()) {
      const [qnaRows] = await conn.execute(`SELECT question FROM qna_${row.qna_category} WHERE id = ?`, [row.qna_id]);
      const pertanyaan = qnaRows.length ? qnaRows[0].question : "(pertanyaan tidak ditemukan)";
      text += `\n${i + 1}. [${row.qna_category}] ${pertanyaan}\n   Dibuka: ${row.views}x`;
    }
  }
  await conn.end();
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]);
  await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
});

// Tambah tombol baru di menu Option
// [Markup.button.callback("👥 Daftar User Notifikasi", "notif_user_list")],

// Handler tombol Option -> Notif
bot.action("change_notif", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT notif_user_id FROM admin_option WHERE notif_user_id = ?", [ctx.from.id]);
  await conn.end();
  const alreadySet = rows.length > 0;
  adminOptionState[ctx.from.id] = { step: "notif", type: "notif" };
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]);
  let text = `🔔 *Set Notifikasi Feedback ke Admin*\n\nUser ID Anda: ${ctx.from.id}`;
  if (alreadySet) {
    text += `\n\nUser ini sudah terdaftar sebagai penerima notifikasi feedback.`;
    await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
  } else {
    text += `\n\nKlik tombol di bawah untuk set user ini sebagai penerima notifikasi feedback.`;
    const setKeyboard = Markup.inlineKeyboard([[Markup.button.callback("Set User Ini", "set_notif_user")], [Markup.button.callback("⬅️ Kembali", "admin_option")]]);
    await ctx.editMessageText(text, { parse_mode: "Markdown", ...setKeyboard });
  }
});

// Handler set_notif_user (pastikan username/first_name ikut disimpan, dan tidak duplikat)
bot.action("set_notif_user", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const notifUserId = ctx.from.id;
  const username = ctx.from.username || null;
  const firstName = ctx.from.first_name || null;
  const conn = await getDbConnection();
  await conn.execute("INSERT IGNORE INTO admin_option (notif_user_id, username, first_name) VALUES (?, ?, ?)", [notifUserId, username, firstName]);
  await conn.end();
  delete adminOptionState[ctx.from.id];
  await ctx.editMessageText(`✅ User ID notifikasi disimpan: ${notifUserId}`);
  // Kembali ke menu option
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("👤 Ganti Username", "change_username")],
    [Markup.button.callback("🔑 Ganti Password", "change_password")],
    [Markup.button.callback("📖 Ganti Panduan", "change_panduan")],
    [Markup.button.callback("❓ Ganti Bantuan", "change_bantuan")],
    [Markup.button.callback("📊 Statistik QnA", "admin_statistik_qna")],
    [Markup.button.callback("💬 Feedback", "admin_feedback_list")],
    [Markup.button.callback("🔔 Set Notif Feedback", "change_notif")],
    [Markup.button.callback("👥 Daftar User Notifikasi", "notif_user_list")],
    [Markup.button.callback("⬅️ Kembali", "admin_panel")],
  ]);
  await ctx.reply("Kembali ke menu Option:", keyboard);
});

// Handler daftar user notifikasi (hanya user unik)
bot.action("notif_user_list", async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT DISTINCT notif_user_id, username, first_name FROM admin_option");
  await conn.end();
  if (!rows.length) {
    await ctx.editMessageText("Belum ada user yang menerima notifikasi feedback.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]));
    return;
  }
  const keyboard = rows.map((r) => {
    const displayName = r.first_name || r.username || "";
    const label = displayName ? `${r.notif_user_id} (${displayName})` : `${r.notif_user_id}`;
    return [Markup.button.callback(label, `notif_user_detail_${r.notif_user_id}`)];
  });
  keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_option")]);
  await ctx.editMessageText("Daftar User ID penerima notifikasi:", Markup.inlineKeyboard(keyboard));
});

// Handler detail user notifikasi (tampilkan info dan tombol hapus)
bot.action(new RegExp("^notif_user_detail_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const userId = ctx.match[1];
  const conn = await getDbConnection();
  const [rows] = await conn.execute("SELECT notif_user_id, username, first_name FROM admin_option WHERE notif_user_id = ?", [userId]);
  await conn.end();
  if (!rows.length) {
    await ctx.editMessageText("User ID tidak ditemukan.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "notif_user_list")]]));
    return;
  }
  const r = rows[0];
  const displayName = r.first_name || r.username || "";
  let text = `User ID: ${r.notif_user_id}`;
  if (displayName) text += `\nNama: ${displayName}`;
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("🗑️ Hapus", `notif_user_delete_confirm_${r.notif_user_id}`), Markup.button.callback("⬅️ Kembali", "notif_user_list")]]);
  await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
});

// Handler konfirmasi hapus user notifikasi
bot.action(new RegExp("^notif_user_delete_confirm_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const userId = ctx.match[1];
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback("✅ Ya, hapus", `notif_user_delete_${userId}`), Markup.button.callback("❌ Batal", `notif_user_detail_${userId}`)]]);
  await ctx.editMessageText("⚠️ Yakin ingin menghapus user ini dari daftar notifikasi?", { parse_mode: "Markdown", ...keyboard });
});

// Handler eksekusi hapus user notifikasi
bot.action(new RegExp("^notif_user_delete_(\\d+)$"), async (ctx) => {
  if (!adminSessions[ctx.from.id]?.loggedIn) {
    await ctx.editMessageText("⚠️ Sesi telah berakhir. Silakan login kembali dengan /admin");
    return;
  }
  const userId = ctx.match[1];
  const conn = await getDbConnection();
  await conn.execute("DELETE FROM admin_option WHERE notif_user_id = ?", [userId]);
  await conn.end();
  await ctx.editMessageText("✅ User ID berhasil dihapus dari daftar notifikasi.");
  // Kembali ke daftar user notifikasi
  const conn2 = await getDbConnection();
  const [rows] = await conn2.execute("SELECT notif_user_id, username, first_name FROM admin_option");
  await conn2.end();
  if (!rows.length) {
    await ctx.reply("Belum ada user yang menerima notifikasi feedback.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ Kembali", "admin_option")]]));
    return;
  }
  const keyboard = rows.map((r) => {
    const displayName = r.first_name || r.username || "";
    const label = displayName ? `${r.notif_user_id} (${displayName})` : `${r.notif_user_id}`;
    return [Markup.button.callback(label, `notif_user_detail_${r.notif_user_id}`)];
  });
  keyboard.push([Markup.button.callback("⬅️ Kembali", "admin_option")]);
  await ctx.reply("Daftar User ID penerima notifikasi:", Markup.inlineKeyboard(keyboard));
});

// Jalankan bot
bot.launch();

console.log("�� Bot Telegram Node.js sudah berjalan!");
