import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const BRAIN_DIR = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain');
const OUTPUT_DIR = path.join(process.cwd(), 'session-history');

function getConversations() {
  if (!fs.existsSync(BRAIN_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(BRAIN_DIR, { withFileTypes: true });
  const convos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cid = entry.name;
    if (cid === 'tempmediaStorage') continue;

    const transcriptPath = path.join(BRAIN_DIR, cid, '.system_generated', 'logs', 'transcript.jsonl');
    const fullTranscriptPath = path.join(BRAIN_DIR, cid, '.system_generated', 'logs', 'transcript_full.jsonl');

    if (!fs.existsSync(transcriptPath)) continue;

    const stat = fs.statSync(transcriptPath);
    
    // Read first few lines of transcript to extract title & date
    let title = 'İsimsiz Sohbet';
    let createdAt = stat.mtime;
    let initialPrompt = '';
    let stepCount = 0;

    try {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      stepCount = lines.length;

      for (const line of lines.slice(0, 10)) {
        try {
          const step = JSON.parse(line);
          if (step.created_at) {
            createdAt = new Date(step.created_at);
          }
          if (step.type === 'USER_INPUT' && step.content) {
            const match = step.content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            const raw = match ? match[1].trim() : step.content.trim();
            initialPrompt = raw.split('\n')[0].slice(0, 80);
            title = initialPrompt;
            break;
          }
        } catch {}
      }
    } catch {}

    convos.push({
      id: cid,
      title: title || cid,
      date: createdAt,
      lastModified: stat.mtime,
      stepCount,
      transcriptPath,
      fullTranscriptPath: fs.existsSync(fullTranscriptPath) ? fullTranscriptPath : transcriptPath,
    });
  }

  // Sort newest first
  convos.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  return convos;
}

function formatDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

function exportToMarkdown(convo) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const targetFile = path.join(
    OUTPUT_DIR,
    `${convo.date.toISOString().slice(0, 10)}_${convo.id.slice(0, 8)}.md`
  );

  const lines = fs.readFileSync(convo.fullTranscriptPath, 'utf8').split('\n').filter(Boolean);

  let md = `# Konuşma Kaydı: ${convo.title}\n\n`;
  md += `- **Oturum ID:** \`${convo.id}\`\n`;
  md += `- **Tarih:** ${formatDate(convo.date)}\n`;
  md += `- **Toplam Adım Sayısı:** ${convo.stepCount}\n`;
  md += `- **Orijinal Dosya:** [transcript_full.jsonl](${convo.fullTranscriptPath})\n\n---\n\n`;

  let userCount = 0;
  let assistantCount = 0;

  for (const line of lines) {
    try {
      const step = JSON.parse(line);
      if (step.type === 'USER_INPUT' && step.content) {
        userCount++;
        let content = step.content;
        const match = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
        if (match) content = match[1].trim();
        md += `\n### 👤 Kullanıcı (Adım ${step.step_index})\n\n${content}\n\n---\n`;
      } else if (step.type === 'PLANNER_RESPONSE') {
        assistantCount++;
        md += `\n### 🤖 Asistan (Adım ${step.step_index})\n\n`;
        if (step.thinking) {
          md += `<details><summary>Düşünce Süreci (Thinking)</summary>\n\n${step.thinking}\n\n</details>\n\n`;
        }
        if (step.tool_calls && step.tool_calls.length > 0) {
          md += `**Çalıştırılan Araçlar:**\n`;
          for (const tc of step.tool_calls) {
            md += `- \`${tc.name}\`\n`;
          }
          md += `\n`;
        }
        md += `---\n`;
      }
    } catch {}
  }

  fs.writeFileSync(targetFile, md, 'utf8');
  return targetFile;
}

function printHelp() {
  console.log(`
Antigravity IDE Konuşma Geçmişi Yöneticisi

Kullanım:
  npm run history                -> Tüm geçmiş konuşmaları listeler
  npm run history -- --export 1  -> Listedeki 1 numaralı konuşmayı Markdown olarak session-history/ klasörüne çıkarır
  npm run history -- --export latest -> En son konuşmayı Markdown olarak çıkarır
  npm run history -- --export-all    -> Tüm konuşmaları Markdown olarak çıkarır
`);
}

function main() {
  const args = process.argv.slice(2);
  const convos = getConversations();

  if (convos.length === 0) {
    console.log('Hiçbir Antigravity konuşma kaydı bulunamadı.');
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const exportIdx = args.indexOf('--export');
  if (exportIdx !== -1) {
    const target = args[exportIdx + 1];
    let selected = null;
    if (target === 'latest' || target === '1') {
      selected = convos[0];
    } else {
      const num = parseInt(target, 10);
      if (!isNaN(num) && num >= 1 && num <= convos.length) {
        selected = convos[num - 1];
      } else {
        selected = convos.find((c) => c.id.startsWith(target));
      }
    }

    if (!selected) {
      console.log(`Hedef konuşma bulunamadı: ${target}`);
      return;
    }

    const exportedPath = exportToMarkdown(selected);
    console.log(`\n✅ Konuşma başarıyla dışa aktarıldı:`);
    console.log(`   ${exportedPath}\n`);
    console.log(`Artık Antigravity IDE dosya gezgininde 'session-history' klasöründen bu dosyaya tıklayıp inceleyebilirsiniz.\n`);
    return;
  }

  if (args.includes('--export-all')) {
    console.log(`\nToplam ${convos.length} konuşma dışa aktarılıyor...`);
    for (const c of convos) {
      const p = exportToMarkdown(c);
      console.log(`  ✓ [${formatDate(c.date)}] -> ${path.basename(p)}`);
    }
    console.log(`\n✅ Tüm konuşmalar 'session-history/' klasörüne aktarıldı!\n`);
    return;
  }

  console.log('\n========================================================================================');
  console.log('                     ANTIGRAVITY IDE GEÇMİŞ KONUŞMA KAYITLARI');
  console.log('========================================================================================\n');

  convos.forEach((c, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const dateStr = formatDate(c.date);
    const shortId = c.id.slice(0, 8);
    const titleSnippet = c.title.replace(/\r?\n/g, ' ').slice(0, 50);
    console.log(` [${num}] ${dateStr} | ID: ${shortId}... | ${titleSnippet}`);
  });

  console.log('\n----------------------------------------------------------------------------------------');
  console.log('İpucu: Bir konuşmayı okunabilir Markdown dosyasına dönüştürmek için:');
  console.log('       npm run history -- --export 1       (veya en son konuşma için: npm run history -- --export latest)');
  console.log('       npm run history -- --export-all     (tüm konuşmaları arşivlemek için)');
  console.log('----------------------------------------------------------------------------------------\n');
}

main();
