<div align="center">

  <img src="https://cdn.jubbio.com/attachments/619840657938202624.svg" alt="code4ever Logo" width="100"/>

# Code4Ever 🚀

**A Social Media Platform Designed Exclusively for Developers.**

[![Version](https://img.shields.io/badge/Version-2.0.5-blue.svg?style=for-the-badge)](https://github.com/Code4Ever-team)
[![Platform](https://img.shields.io/badge/Platform-Web_-0078D6?style=for-the-badge\&logo=chrome)](https://app.lanux.online/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](#)

**🌐 Quick Access**

[🇬🇧 English](#english)   |   [🇹🇷 Türkçe](#türkçe)

  <br>

[🚀 Enter Code4Ever](https://app.lanux.online/)

</div>

<br>

<div align="center">
  <img width="1351" height="843" alt="Code4Ever Preview" src="https://cdn.jubbio.com/attachments/619844492157009920.png" />
  <br>
  <i>"Connect With Developers Around The World"</i>
</div>

<br>

<a name="english"></a>

# 🇬🇧 English

## 🌟 What is Code4Ever?

**Code4Ever** is a production-focused social media platform built specifically for developers who are tired of the noise found on other social platforms.

> "No Random Ads Popping Up Everywhere!"

Code4Ever provides developers with a dedicated environment where they can communicate, share their projects, discover other developers, and collaborate.

---

## ✨ Key Features

* **⚡ Real-Time Feed System:** Stay connected with developers from different parts of the world through a real-time social feed.
* **🐙 GitHub Integration:** Your GitHub repositories are synchronized with Code4Ever, allowing you to attach your repositories when creating feed posts.
* **🔐 Private Messaging:** Direct messages are encrypted in the browser (AES-GCM) and readable only by the conversation participants, enforced at the database level. See [SECURITY.md](SECURITY.md) for the exact threat model.
* **💼 Job Listings:** Quickly create job listings when you need a teammate or a developer to work on a project.
* **👥 Developer Community:** Discover, connect, and communicate with developers from around the world.
* **🎨 Spark Gradient Theme Studio:** Spark supporters can repaint the platform — every surface, text, border and glow colour, plus the gradient type (linear / radial / conic), its direction, centre point and up to six colour stops — and share the result on their profile so other members see it.
* **🚀 And More:** Code4Ever is constantly evolving with new features and improvements.

---

## 🚀 Installation

If you want to develop Code4Ever locally:

1. Go to the **[Releases](https://github.com/Code4Ever-team/Code4Ever/releases)** section.
2. Download the latest `Code4Ever-Source.zip`.
3. Extract the archive into a folder.
4. Open the folder with CMD or your preferred terminal.
5. Run the following commands:

```bash
npm install
npm run build
npm start
```

6. Open the application in your browser.

---

## 🧩 UI Stack

The interface is built with **Tailwind CSS v4** and a local **shadcn/ui** layer
(`src/components/ui`, Radix primitives + `cva`). Components read the same CSS variables the
Spark Theme Studio writes, so a member's custom gradient theme repaints every primitive
automatically. Add more primitives the usual way — the project ships a `components.json`
and the `cn()` helper in `src/lib/utils.ts`.

---

## 🛡️ Security & Setup

Before deploying, run the whole of [`supabase_schema.sql`](supabase_schema.sql) in the Supabase
SQL editor and fill in the variables from [`.env.example`](.env.example).
[`SECURITY.md`](SECURITY.md) documents the hardening work, the required environment variables
and the known limitations.

---

## 🤝 Contributing

Code4Ever is an open-source project that welcomes community contributions!

If you find a bug, have an idea, or have developed a new feature, feel free to contribute and send us your feedback.

Every contribution helps make Code4Ever better for developers.

---

## ❤️ Credits

<div align="center">
  <i>Made with ❤️ by <b>Lanux & Gloyis</b></i>
</div>

<br>
<br>

<div align="center">

[⬆️ Back to Top](#code4ever-🚀)

</div>

---

<a name="türkçe"></a>

# 🇹🇷 Türkçe

## 🌟 Code4Ever Nedir?

**Code4Ever**, diğer sosyal medya platformlarının gürültüsünden sıkılmış geliştiriciler için özel olarak tasarlanmış, üretim odaklı bir sosyal medya platformudur.

> "Oradan Buradan Fırlayan Reklamlar Yok!"

Code4Ever; geliştiricilerin projelerini paylaşabileceği, diğer geliştiricilerle iletişim kurabileceği, yeni insanlar keşfedebileceği ve ekipler oluşturabileceği özel bir ortam sunar.

---

## ✨ Öne Çıkan Özellikler

* **⚡ Eşzamanlı Feed Sistemi:** Dünyanın farklı bölgelerindeki geliştiriciler ile gerçek zamanlı feed sistemi üzerinden iletişimde kalın.
* **🐙 GitHub Entegrasyonu:** GitHub depolarınız Code4Ever ile senkronize edilir. Gönderi oluştururken depolarınızı gönderilerinize ekleyebilirsiniz.
* **🔐 Özel Mesajlaşma:** Mesajlar tarayıcıda şifrelenir (AES-GCM) ve veritabanı seviyesinde yalnızca konuşmanın taraflarına gösterilir. Tehdit modeli için [SECURITY.md](SECURITY.md) dosyasına bakın.
* **💼 İş İlanları:** Bir ekip arkadaşı veya projeniz için geliştirici arıyorsanız hızlı bir şekilde iş ilanı oluşturabilirsiniz.
* **👥 Geliştirici Topluluğu:** Dünyanın farklı bölgelerinden geliştiricileri keşfedin, bağlantı kurun ve iletişim kurun.
* **🎨 Spark Gradyan Tema Stüdyosu:** Spark destekçileri platformun tüm renklerini (zemin, kart, vurgu, banner, metin, kenarlık, ışıma) ve gradyanın türünü (doğrusal / dairesel / konik), yönünü, merkezini ve altıya kadar renk durağını değiştirebilir; temalarını profillerinde diğer kullanıcılara gösterebilir.
* **🚀 Ve Daha Fazlası:** Code4Ever sürekli olarak yeni özellikler ve geliştirmeler ile büyümeye devam ediyor.

---

## 🚀 Kurulum

Code4Ever'i yerel olarak geliştirmek için:

1. **[Releases](https://github.com/Code4Ever-team/Code4Ever/releases)** sekmesine gidin.
2. En güncel `Code4Ever-Source.zip` dosyasını indirin.
3. Dosyayı bir klasöre ayıklayın.
4. Klasörü CMD veya tercih ettiğiniz terminal ile açın.
5. Aşağıdaki komutları sırasıyla çalıştırın:

```bash
npm install
npm run build
npm start
```

6. Uygulamayı tarayıcınızdan açın.

---

## 🤝 Katkıda Bulunma

Code4Ever tamamen açık kaynak ve topluluk katkılarına açık bir projedir!

Bir hata bulduysanız, yeni bir fikriniz varsa veya yeni bir özellik geliştirdiyseniz katkıda bulunmaktan ve geri bildirim göndermekten çekinmeyin.

Yaptığınız her katkı Code4Ever'i geliştiriciler için daha iyi bir platform haline getirmeye yardımcı olur.

---

## ❤️ Katkıda Bulunanlar

<div align="center">
  <i>Made with ❤️ by <b>Lanux & Gloyis</b></i>
</div>

<br>

<div align="center">

[⬆️ Başa Dön](#code4ever-🚀)

</div>

<br>

<div align="center">

### 🌐 Quick Access

[🇬🇧 English](#english)   |   [🇹🇷 Türkçe](#türkçe)

<br><br>

[🚀 Code4Ever'a Gir](https://app.lanux.online/)

</div>
